"""현대카드 VestMail 보안 HTML 명세서 파서 모듈."""

import base64
import json
import re
import subprocess
from typing import Any, Dict, List, Optional
from bs4 import BeautifulSoup

from src.backend.parsers.exceptions import (
    ExpenseDecryptionError,
    ExpenseParserError,
    InvalidPasswordError,
)


def _decrypt_vestmail_html(html_text: str, password: str) -> str:
    """VestMail HTML 스크립트를 추출하고 Node.js VM에서 복호화된 UTF-8 HTML을 반환합니다.

    Args:
        html_text: 현대카드 보안메일 HTML 텍스트.
        password: 복호화 비밀번호 (생년월일 6자리 등).

    Returns:
        복호화된 원본 UTF-8 HTML 문자열.

    Raises:
        InvalidPasswordError: 비밀번호가 일치하지 않는 경우.
        ExpenseParserError: HTML 내 복호화 스크립트 누락 또는 Node.js 실행 실패 시.
    """
    # 암호화 청크 배열(var s = new Array()) 추출
    s_match = re.search(
        r"<SCRIPT[^>]*>(\s*var\s+s\s*=\s*new\s+Array\(\);.*?)<\/SCRIPT>",
        html_text,
        re.IGNORECASE | re.DOTALL,
    )
    if not s_match:
        raise ExpenseParserError("현대카드 암호화 데이터(var s)를 찾을 수 없습니다.")
    s_code = s_match.group(1)

    # VestMail 암호화 라이브러리(x) 추출
    x_match = re.search(
        r"<SCRIPT[^>]*>(\s*[\"']undefined[\"']\s*!=\s*typeof\s*x.*?)<\/SCRIPT>",
        html_text,
        re.IGNORECASE | re.DOTALL,
    )
    if not x_match:
        raise ExpenseParserError("현대카드 복호화 라이브러리(x)를 찾을 수 없습니다.")
    x_code = x_match.group(1)

    # 비밀번호 안전 주입
    escaped_password = json.dumps(str(password))

    node_runner_code = f"""
const navigator = {{
    platform: "Win32",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    appVersion: "5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    vendor: "Google Inc."
}};
const window = global;
global.navigator = navigator;
var document = {{
    getElementById: function() {{ return null; }}
}};

{x_code}

{s_code}

function decryptRaw(pw) {{
    var E = pw;
    var F = x.s2(E, {{d: true}});
    var z = x.s2(F, {{d: true}});
    F = F.slice(0, 16);
    z = z.slice(0, 16);
    
    var I = [];
    for (var b = 0; b < s.length; b++) {{
        var k = x.b.l(s[b]);
        I[b] = x.y.m(k, z, {{c: new x.c.l(x.o.V), g: F}});
        if (I[b] === null || I[b] === undefined) {{
            return {{ error: "INVALID_PASSWORD" }};
        }}
    }}
    
    var resultBytes = [];
    for (var l = 0; l < I.length; l++) {{
        resultBytes = resultBytes.concat(I[l]);
    }}
    return {{ b64: Buffer.from(resultBytes).toString('base64') }};
}}

const res = decryptRaw({escaped_password});
process.stdout.write(JSON.stringify(res));
"""

    try:
        proc = subprocess.run(
            ["node", "-"],
            input=node_runner_code,
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=False,
        )
    except FileNotFoundError as exc:
        raise ExpenseParserError("Node.js 런타임을 찾을 수 없습니다. 시스템에 node가 설치되어 있어야 합니다.") from exc
    except Exception as exc:
        raise ExpenseParserError(f"Node.js 프로세스 실행 실패: {exc}") from exc

    if proc.returncode != 0 or not proc.stdout.strip():
        err_msg = proc.stderr.strip() if proc.stderr else f"Exit code {proc.returncode}"
        raise ExpenseParserError(f"현대카드 복호화 실행 에러: {err_msg}")

    try:
        output_data = json.loads(proc.stdout)
    except Exception as exc:
        raise ExpenseParserError(f"복호화 러너 결과 JSON 파싱 실패: {proc.stdout}") from exc

    if output_data.get("error") == "INVALID_PASSWORD":
        raise InvalidPasswordError("현대카드 명세서 비밀번호가 일치하지 않습니다.")

    b64_str = output_data.get("b64")
    if not b64_str:
        raise ExpenseParserError("복호화된 바이너리 내용이 비어있습니다.")

    raw_bytes = base64.b64decode(b64_str)
    return raw_bytes.decode("utf-8", errors="replace")


def parse_hyundaicard_html(
    content: bytes | str, password: str
) -> Dict[str, Any]:
    """현대카드 VestMail 보안 HTML 파일을 복호화하고 표준 거래 내역 형태로 파싱합니다.

    Args:
        content: 원본 HTML 파일 바이너리(bytes) 또는 문자열(str).
        password: 복호화 비밀번호 (생년월일 6자리 등).

    Returns:
        표준 지출 스키마 딕셔너리:
            - year_month (str): 기준 년월 (예: '2026-08')
            - owner (Optional[str]): 회원 성명 (예: '장준')
            - institution (str): 금융기관명 ('현대카드')
            - account_identifier (Optional[str]): 카드명/식별값 (예: 'HYUNDAI BLUE P')
            - transactions (List[dict]): 파싱된 거래 내역 목록

    Raises:
        InvalidPasswordError: 비밀번호가 일치하지 않는 경우.
        ExpenseParserError: HTML 복호화 또는 구조 파싱 실패 시.
    """
    if isinstance(content, bytes):
        for enc in ["cp949", "utf-8", "euc-kr"]:
            try:
                html_text = content.decode(enc)
                break
            except Exception:
                continue
        else:
            html_text = content.decode("utf-8", errors="ignore")
    else:
        html_text = content

    decrypted_html = _decrypt_vestmail_html(html_text, password)
    soup = BeautifulSoup(decrypted_html, "html.parser")

    # 1. 회원 성명 추출 (예: '장준 </span> 회원님')
    owner: Optional[str] = None
    name_match = re.search(r"([가-힣a-zA-Z]+)\s*(?:</span>)?\s*회원님", decrypted_html)
    if name_match:
        owner = name_match.group(1).strip()

    # 2. 청구년월 추출 (예: '2026년 09월 현대카드 이용 대금 명세서')
    billing_year: Optional[int] = None
    billing_month: Optional[int] = None
    bill_match = re.search(r"(\d{4})년\s*(\d{1,2})월\s*현대카드\s*이용\s*대금", decrypted_html)
    if bill_match:
        billing_year = int(bill_match.group(1))
        billing_month = int(bill_match.group(2))

    # 3. 거래 내역 테이블 탐색 (안쪽 자식 테이블 우선 또는 행 탐색)
    best_transactions: List[Dict[str, Any]] = []
    card_name: Optional[str] = None
    earliest_ym: Optional[str] = None

    for table in soup.find_all("table"):
        clean_table_txt = re.sub(r"\s+", "", table.get_text())
        if "이용가맹점" not in clean_table_txt or "이용금액" not in clean_table_txt:
            continue

        rows = table.find_all("tr")
        if not rows:
            continue

        current_table_txs: List[Dict[str, Any]] = []

        for row in rows:
            cells = row.find_all(["th", "td"])
            cell_texts = [td.get_text(strip=True) for td in cells]
            non_empty = [c for c in cell_texts if c]
            if not non_empty:
                continue

            first_val = non_empty[0]
            if any(k in first_val for k in ["소계", "합계", "총", "이용일"]):
                continue

            # 날짜 형식 체크 (예: '08.08' or '2026.08.08' or '08/08')
            date_match = re.match(r"^(\d{2})[./](\d{2})$", first_val)
            full_date_match = re.match(r"^(\d{4})[./](\d{2})[./](\d{2})$", first_val)

            if not date_match and not full_date_match:
                continue

            if full_date_match:
                tx_year = int(full_date_match.group(1))
                tx_month = int(full_date_match.group(2))
                tx_day = int(full_date_match.group(3))
            else:
                assert date_match is not None
                tx_month = int(date_match.group(1))
                tx_day = int(date_match.group(2))
                if billing_year and billing_month:
                    if tx_month > billing_month:
                        tx_year = billing_year - 1
                    else:
                        tx_year = billing_year
                else:
                    tx_year = 2026

            tx_date_str = f"{tx_year:04d}-{tx_month:02d}-{tx_day:02d}"
            tx_ym = f"{tx_year:04d}-{tx_month:02d}"
            if not earliest_ym:
                earliest_ym = tx_ym

            # 컬럼 인덱스 매핑:
            # non_empty 순서: [0] 날짜, [1] 카드명, [2] 가맹점, [3] 금액, [4] 할부 ...
            row_card = non_empty[1] if len(non_empty) > 1 else ""
            merchant = non_empty[2] if len(non_empty) > 2 else ""
            raw_amount = non_empty[3] if len(non_empty) > 3 else "0"

            if not card_name and row_card:
                card_name = row_card.replace("본인", "").strip() or row_card

            amount_val = abs(float(str(raw_amount).replace(",", "").strip() or 0))

            original_type = "일시불"
            if len(non_empty) > 4:
                installment = non_empty[4].strip()
                if installment and installment not in ["0", "", "일시불"]:
                    original_type = f"할부({installment})"

            current_table_txs.append(
                {
                    "transaction_date": tx_date_str,
                    "year_month": tx_ym,
                    "merchant": merchant,
                    "amount": amount_val,
                    "original_type": original_type,
                    "memo": "",
                }
            )

        # 가장 많은 유효 거래 건수를 추출한 테이블을 채택
        if len(current_table_txs) > len(best_transactions):
            best_transactions = current_table_txs

    if not best_transactions:
        raise ExpenseParserError("현대카드 거래 내역을 추출하지 못했습니다.")

    return {
        "year_month": earliest_ym or "",
        "owner": owner,
        "institution": "현대카드",
        "account_identifier": card_name,
        "transactions": best_transactions,
    }
