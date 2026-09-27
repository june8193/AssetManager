# -*- coding: utf-8 -*-
"""신한은행 암호화 입출금 거래내역 PDF 명세서 파서 모듈입니다."""

import io
import re
from typing import Any, Dict, List, Optional
import pypdf

from src.backend.parsers.exceptions import (
    ExpenseParserError,
    InvalidPasswordError,
)

HEADER_KEYWORDS = [
    "거래내역조회",
    "계좌번호",
    "성명",
    "조회기간",
    "대출한도",
    "출금가능금액",
    "미결제타점권",
    "총잔액",
    "지급제한금액",
    "거래일자",
    "거래시간",
    "적요",
    "출금(원)",
    "입금(원)",
    "내용",
    "잔액(원)",
    "거래점",
    "SHINHAN BANK",
    "본 명세는 단순 참고용",
]

DATE_TIME_PATTERN = re.compile(r"^\d{8}\s+\d{2}:\d{2}:\d{2}")
TX_LINE_PATTERN = re.compile(
    r"^(\d{8})\s+(\d{2}:\d{2}:\d{2})\s+(.+?)\s+([\d,]+)\s+([\d,]+)\s+(.+?)\s+([\d,]+)\s+(\S+)$"
)


def parse_shinhanbank_pdf(
    content: bytes | io.BytesIO,
    password: Optional[str] = None,
    target_year_month: Optional[str] = None,
) -> Dict[str, Any]:
    """신한은행 암호화 PDF 파일을 복호화하고 표준 거래 내역 형태로 파싱합니다.

    Args:
        content: PDF 파일 바이너리 데이터 또는 BytesIO 스트림.
        password: PDF 복호화 비밀번호 (생년월일 6자리 등).
        target_year_month: 추출 대상 연월 (예: '2026-08'). 지정 시 해당 월 외 거래는 제외.

    Returns:
        표준 지출 스키마 딕셔너리:
            - year_month (str): 기준 년월 (예: '2026-08')
            - owner (Optional[str]): 예금주 성명
            - institution (str): 금융기관명 ('신한은행')
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
            raise InvalidPasswordError("신한은행 명세서 복호화를 위한 비밀번호가 필요합니다.")

        try:
            decrypt_result = reader.decrypt(password)
        except Exception as exc:
            raise InvalidPasswordError(f"비밀번호 복호화 처리 중 오류가 발생했습니다: {exc}") from exc

        # pypdf: 0 = NOT_DECRYPTED, 1 = USER_PASSWORD, 2 = OWNER_PASSWORD
        if decrypt_result == pypdf.PasswordType.NOT_DECRYPTED or decrypt_result == 0:
            raise InvalidPasswordError("신한은행 PDF 비밀번호가 일치하지 않습니다.")

    # 2. 다중 페이지 텍스트 추출
    raw_lines: List[str] = []
    full_text = ""

    for page in reader.pages:
        try:
            page_text = page.extract_text() or ""
            full_text += "\n" + page_text
            for line in page_text.split("\n"):
                line_clean = line.strip()
                if line_clean:
                    raw_lines.append(line_clean)
        except Exception as exc:
            raise ExpenseParserError(f"PDF 페이지 텍스트 추출 중 오류가 발생했습니다: {exc}") from exc

    # 3. 메타데이터 파싱 (예금주, 계좌번호, 조회기간)
    owner = _extract_owner(full_text)
    account_number = _extract_account_number(full_text)
    header_year_month = _extract_header_year_month(full_text)

    # 4. 거래 행 블록 그룹화 및 줄바꿈 복원
    tx_blocks: List[List[str]] = []
    current_block: List[str] = []

    for line in raw_lines:
        if _is_header_or_footer(line):
            continue
        if DATE_TIME_PATTERN.match(line):
            if current_block:
                tx_blocks.append(current_block)
            current_block = [line]
        else:
            if current_block:
                current_block.append(line)

    if current_block:
        tx_blocks.append(current_block)

    # 5. 거래 파싱 및 정규화
    all_raw_txs: List[Dict[str, Any]] = []
    for block in tx_blocks:
        tx = _parse_transaction_block(block)
        if tx:
            all_raw_txs.append(tx)

    # 6. 대상 연월 필터링
    default_ym = ""
    if all_raw_txs:
        default_ym = all_raw_txs[0]["year_month"]
    elif header_year_month:
        default_ym = header_year_month

    effective_year_month = target_year_month or default_ym

    filtered_transactions: List[Dict[str, Any]] = []
    other_month_count = 0

    for tx in all_raw_txs:
        tx_ym = tx.get("year_month", "")
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
        "institution": "신한은행",
        "account_identifier": account_number,
        "transactions": filtered_transactions,
        "other_month_count": other_month_count,
    }


def _is_header_or_footer(line: str) -> bool:
    """텍스트 행이 머리글 또는 바닥글 키워드를 포함하는지 검사합니다."""
    for kw in HEADER_KEYWORDS:
        if kw in line:
            return True
    return False


def _extract_owner(text: str) -> Optional[str]:
    """텍스트에서 성명(예금주)을 추출합니다."""
    m = re.search(r"성명\s+([가-힣A-Za-z0-9*]+)", text)
    if m:
        return m.group(1).strip()
    return None


def _extract_account_number(text: str) -> Optional[str]:
    """텍스트에서 계좌번호를 추출합니다."""
    m = re.search(r"계좌번호\s*(?:\[[^\]]+\])?\s*([0-9*-]+)", text)
    if m:
        return m.group(1).strip()
    return None


def _extract_header_year_month(text: str) -> Optional[str]:
    """조회기간 종료 시점을 기반으로 기준 연월(YYYY-MM)을 추출합니다."""
    m = re.search(r"조회기간\s*[\d.]+\s*~\s*(\d{4})\.(\d{2})\.\d{2}", text)
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


def _parse_transaction_block(block: List[str]) -> Optional[Dict[str, Any]]:
    """줄바꿈이 발생할 수 있는 거래 텍스트 블록을 단일 거래 딕셔너리로 파싱합니다."""
    if not block:
        return None

    if len(block) == 1:
        merged = block[0]
    elif len(block) == 2:
        # Line 1: '20260918 11:47:40 오픈뱅킹 이'
        # Line 2: '체 10,000 0 당근페이 27,450 자금부'
        m_dt = DATE_TIME_PATTERN.match(block[0])
        if m_dt:
            dt_part = m_dt.group(0)
            rem1 = block[0][len(dt_part) :].strip()
            parts2 = block[1].split()
            first_word2 = parts2[0] if parts2 else ""
            rest2 = " ".join(parts2[1:]) if len(parts2) > 1 else ""
            merged_summary = (rem1 + first_word2).strip()
            merged = f"{dt_part} {merged_summary} {rest2}".strip()
        else:
            merged = " ".join(block)
    else:
        merged = " ".join(block)

    m = TX_LINE_PATTERN.match(merged)
    if not m:
        return None

    d_str, t_str, summary, w_amt, d_amt, content, bal, branch = m.groups()
    norm_dt = f"{d_str[:4]}-{d_str[4:6]}-{d_str[6:8]} {t_str}"
    w_val = _clean_amount(w_amt)
    d_val = _clean_amount(d_amt)

    if w_val > 0:
        amount = w_val
        orig_type = "출금"
    elif d_val > 0:
        amount = d_val
        orig_type = "입금"
    else:
        amount = 0.0
        orig_type = "출금"

    return {
        "transaction_date": norm_dt,
        "year_month": norm_dt[:7],
        "merchant": content.strip(),
        "amount": amount,
        "original_type": orig_type,
        "memo": summary.strip(),
    }
