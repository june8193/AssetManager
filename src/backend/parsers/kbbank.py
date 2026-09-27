# -*- coding: utf-8 -*-
"""국민은행 암호화 입출금 거래내역 PDF 명세서 파서 모듈입니다."""

from collections import defaultdict
import io
import re
from typing import Any, Dict, List, Optional
import pypdf

from src.backend.parsers.exceptions import (
    ExpenseParserError,
    InvalidPasswordError,
)


def parse_kbbank_pdf(
    content: bytes | io.BytesIO,
    password: Optional[str] = None,
    target_year_month: Optional[str] = None,
) -> Dict[str, Any]:
    """국민은행 암호화 PDF 파일을 복호화하고 표준 거래 내역 형태로 파싱합니다.

    Args:
        content: PDF 파일 바이너리 데이터 또는 BytesIO 스트림.
        password: PDF 복호화 비밀번호 (생년월일 6자리 등).
        target_year_month: 추출 대상 연월 (예: '2026-08'). 지정 시 해당 월 외 거래는 제외.

    Returns:
        표준 지출 스키마 딕셔너리:
            - year_month (str): 기준 년월 (예: '2026-08')
            - owner (Optional[str]): 예금주 성명
            - institution (str): 금융기관명 ('국민은행')
            - account_identifier (Optional[str]): 계좌번호 식별값
            - transactions (List[dict]): 파싱 및 필터링된 거래 내역 목록
            - other_month_count (int): 대상 연월 이외의 제외된 거래 건수

    Raises:
        InvalidPasswordError: 비밀번호가 누락되었거나 일치하지 않는 경우.
        ExpenseParserError: PDF 파일 손상 또는 구조 파싱 실패 시.
    """
    if isinstance(content, bytes):
        input_stream = io.BytesIO(content)
    else:
        input_stream = content
        input_stream.seek(0)

    try:
        reader = pypdf.PdfReader(input_stream)
    except Exception as exc:
        raise ExpenseParserError(f"PDF 문서를 열 수 없습니다: {exc}") from exc

    # 1. 복호화 처리
    if reader.is_encrypted:
        if not password:
            raise InvalidPasswordError("국민은행 명세서 복호화를 위한 비밀번호가 필요합니다.")

        try:
            decrypt_result = reader.decrypt(password)
        except Exception as exc:
            raise InvalidPasswordError(f"비밀번호 복호화 처리 중 오류가 발생했습니다: {exc}") from exc

        # pypdf: 0 = NOT_DECRYPTED, 1 = USER_PASSWORD, 2 = OWNER_PASSWORD
        if decrypt_result == pypdf.PasswordType.NOT_DECRYPTED or decrypt_result == 0:
            raise InvalidPasswordError("국민은행 PDF 비밀번호가 일치하지 않습니다.")

    # 2. 메타데이터 및 거래 내역 추출
    full_text = ""
    all_raw_txs: List[Dict[str, Any]] = []

    for page_idx, page in enumerate(reader.pages):
        try:
            page_text = page.extract_text() or ""
            full_text += "\n" + page_text
        except Exception:
            page_text = ""

        # 전략 1: visitor_text를 활용한 좌표 기반 테이블 행 추출
        page_txs = _extract_transactions_by_coordinates(page)

        # 전략 2: 좌표 기반 추출 결과가 없을 경우 텍스트 라인 정규식 fallback
        if not page_txs and page_text:
            page_txs = _extract_transactions_by_regex(page_text)

        all_raw_txs.extend(page_txs)

    # 3. 메타데이터 파싱 (예금주, 계좌번호, 조회기간)
    owner = _extract_owner(full_text)
    account_number = _extract_account_number(full_text)
    header_year_month = _extract_header_year_month(full_text)

    # 4. 대상 연월 필터링 및 거래 목록 정규화
    effective_year_month = target_year_month or header_year_month or ""

    filtered_transactions: List[Dict[str, Any]] = []
    other_month_count = 0

    for tx in all_raw_txs:
        tx_ym = tx.get("year_month", "")
        if not effective_year_month and tx_ym:
            effective_year_month = tx_ym

        if target_year_month:
            if tx_ym == target_year_month:
                filtered_transactions.append(tx)
            else:
                other_month_count += 1
        else:
            filtered_transactions.append(tx)

    return {
        "year_month": effective_year_month,
        "owner": owner,
        "institution": "국민은행",
        "account_identifier": account_number,
        "transactions": filtered_transactions,
        "other_month_count": other_month_count,
    }


def _extract_owner(text: str) -> Optional[str]:
    """텍스트에서 예금주 성명을 추출합니다."""
    m = re.search(r"예금주\s+([가-힣A-Za-z0-9]+)", text)
    if m:
        return m.group(1).strip()
    return None


def _extract_account_number(text: str) -> Optional[str]:
    """텍스트에서 계좌번호를 추출합니다."""
    m = re.search(r"(?:계좌번호|계좌 번호)\s*([0-9-]+)", text)
    if m:
        return m.group(1).strip()
    return None


def _extract_header_year_month(text: str) -> Optional[str]:
    """텍스트에서 조회기간을 기반으로 기준 연월(YYYY-MM)을 추출합니다."""
    m = re.search(r"(\d{4})[./-](\d{2})[./-]\d{2}\s*~\s*\d{4}[./-]\d{2}[./-]\d{2}", text)
    if m:
        return f"{m.group(1)}-{m.group(2)}"
    return None


def _clean_amount(val_str: str) -> float:
    """통화 문자열을 실수(float) 값으로 안전하게 변환합니다."""
    clean = re.sub(r"[^\d.-]", "", val_str)
    try:
        return abs(float(clean))
    except (ValueError, TypeError):
        return 0.0


def _extract_transactions_by_coordinates(page: pypdf.PageObject) -> List[Dict[str, Any]]:
    """pypdf의 visitor_text를 사용하여 좌표 기반으로 테이블 거래 행을 정확하게 추출합니다."""
    items: List[tuple[float, float, str]] = []

    def visitor(text: str, cm: Any, tm: Any, font_dict: Any, font_size: Any) -> None:
        t = text.strip()
        if t:
            items.append((float(tm[4]), float(tm[5]), t))

    try:
        page.extract_text(visitor_text=visitor)
    except Exception:
        return []

    if not items:
        return []

    # y 좌표 기준 오차 4pt 이내의 항목들을 동일 행으로 그룹화
    rows = defaultdict(list)
    for x, y, t in sorted(items, key=lambda item: (-item[1], item[0])):
        matched_y = None
        for ry in rows.keys():
            if abs(ry - y) < 4.0:
                matched_y = ry
                break
        if matched_y is None:
            matched_y = y
        rows[matched_y].append((x, t))

    transactions: List[Dict[str, Any]] = []

    for ry in sorted(rows.keys(), reverse=True):
        r_items = rows[ry]
        if not r_items:
            continue

        first_x, first_t = r_items[0]
        # 날짜 형식 'YYYY.MM.DD HH:MM:SS' 로 시작하는 행 식별
        if not re.match(r"^\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2}:\d{2}", first_t):
            continue

        cols = defaultdict(list)
        for x, t in r_items:
            if x < 105:
                cols["date"].append(t)
            elif x < 170:
                cols["summary"].append(t)
            elif x < 250:
                cols["counterparty"].append(t)
            elif x < 310:
                cols["withdraw"].append(t)
            elif x < 370:
                cols["deposit"].append(t)
            elif x < 450:
                cols["balance"].append(t)
            elif x < 510:
                cols["memo"].append(t)
            else:
                cols["branch"].append(t)

        date_raw = " ".join(cols["date"]).strip()
        norm_date = re.sub(r"^(\d{4})\.(\d{2})\.(\d{2})", r"\1-\2-\3", date_raw)
        summary = " ".join(cols["summary"]).strip()
        counterparty = " ".join(cols["counterparty"]).strip()
        withdraw_amt = _clean_amount(" ".join(cols["withdraw"]))
        deposit_amt = _clean_amount(" ".join(cols["deposit"]))
        tx_memo = " ".join(cols["memo"]).strip()

        if withdraw_amt > 0:
            amount = withdraw_amt
            original_type = "출금"
        elif deposit_amt > 0:
            amount = deposit_amt
            original_type = "입금"
        else:
            amount = 0.0
            original_type = "출금"

        # 메모 구성: 적요 + (송금메모가 유효할 경우 병합)
        if tx_memo and tx_memo != "-":
            final_memo = f"{summary} ({tx_memo})"
        else:
            final_memo = summary

        transactions.append(
            {
                "transaction_date": norm_date,
                "year_month": norm_date[:7],
                "merchant": counterparty,
                "amount": amount,
                "original_type": original_type,
                "memo": final_memo,
            }
        )

    return transactions


def _extract_transactions_by_regex(text: str) -> List[Dict[str, Any]]:
    """텍스트 라인 단위 정규식을 활용한 fallback 거래 추출 함수입니다."""
    line_pattern = re.compile(
        r"^(\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2}:\d{2})\s+(.+?)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+(\S+)\s+(.+)$"
    )

    known_summaries = [
        "CMS 공동",
        "FBS 출금",
        "FBS출금",
        "오픈뱅킹출금",
        "오픈뱅킹입금",
        "전자금융",
        "제휴 CD",
        "결산이자",
        "타행이체",
        "체크카드",
        "자동이체",
    ]

    transactions: List[Dict[str, Any]] = []

    for line in text.split("\n"):
        line_clean = line.strip()
        m = line_pattern.match(line_clean)
        if not m:
            continue

        raw_dt, middle, w_amt_str, d_amt_str, bal_str, tx_memo, branch = m.groups()
        norm_date = re.sub(r"^(\d{4})\.(\d{2})\.(\d{2})", r"\1-\2-\3", raw_dt.strip())

        # middle을 적요와 보낸분/받는분으로 분리
        middle_clean = middle.strip()
        summary = ""
        counterparty = middle_clean

        for ks in known_summaries:
            if middle_clean.startswith(ks):
                summary = ks
                counterparty = middle_clean[len(ks) :].strip()
                break

        if not summary:
            parts = middle_clean.split(" ", 1)
            summary = parts[0]
            counterparty = parts[1] if len(parts) > 1 else ""

        withdraw_amt = _clean_amount(w_amt_str)
        deposit_amt = _clean_amount(d_amt_str)

        if withdraw_amt > 0:
            amount = withdraw_amt
            original_type = "출금"
        elif deposit_amt > 0:
            amount = deposit_amt
            original_type = "입금"
        else:
            amount = 0.0
            original_type = "출금"

        if tx_memo and tx_memo != "-":
            final_memo = f"{summary} ({tx_memo})"
        else:
            final_memo = summary

        transactions.append(
            {
                "transaction_date": norm_date,
                "year_month": norm_date[:7],
                "merchant": counterparty,
                "amount": amount,
                "original_type": original_type,
                "memo": final_memo,
            }
        )

    return transactions
