"""지출 명세서 자동 감지 및 파싱 통합 서비스 모듈."""

from pathlib import Path
from typing import Any, Dict, Optional

from src.backend.parsers.exceptions import (
    ExpenseParserError,
    UnsupportedFileFormatError,
)
from src.backend.parsers.hyundaicard import parse_hyundaicard_html
from src.backend.parsers.kakaobank import parse_kakaobank_excel
from src.backend.parsers.kbbank import parse_kbbank_pdf
from src.backend.parsers.shinhanbank import parse_shinhanbank_pdf


def normalize_institution(name: Optional[str]) -> str:
    """금융기관명을 대표 표준 기관명으로 정규화합니다.

    카드와 은행, 뱅크와 페이 등 서로 다른 금융상품/기관은 엄격히 구분하여 정규화합니다.

    Args:
        name (Optional[str]): 원본 금융기관명 (예: 'KB국민은행', '신한', 'kakaobank', '현대').

    Returns:
        str: 정규화된 대표 기관명 또는 소문자 정리 문자열.
    """
    if not name or not isinstance(name, str):
        return ""
    clean = name.strip().replace(" ", "").lower()
    if not clean:
        return ""

    # 1. 국민 계열 (국민은행 vs 국민카드)
    if "카드" in clean and ("국민" in clean or "kb" in clean):
        return "국민카드"
    if any(k in clean for k in ["국민은행", "kb국민", "kb은행", "kbbank"]) or clean in ["국민", "kb"]:
        return "국민은행"
    if ("국민" in clean or "kb" in clean) and "은행" in clean:
        return "국민은행"

    # 2. 신한 계열 (신한은행 vs 신한카드)
    if "카드" in clean and ("신한" in clean or "shinhan" in clean):
        return "신한카드"
    if any(k in clean for k in ["신한은행", "shinhanbank"]) or clean in ["신한", "shinhan"]:
        return "신한은행"
    if ("신한" in clean or "shinhan" in clean) and "은행" in clean:
        return "신한은행"

    # 3. 카카오 계열 (카카오뱅크 vs 카카오페이 vs 카카오카드)
    if "페이" in clean and "카카오" in clean:
        return "카카오페이"
    if "카드" in clean and "카카오" in clean:
        return "카카오카드"
    if any(k in clean for k in ["카카오뱅크", "kakaobank"]) or clean in ["카카오", "kakao"]:
        return "카카오뱅크"
    if ("카카오" in clean or "kakao" in clean) and "뱅크" in clean:
        return "카카오뱅크"

    # 4. 현대 계열 (현대카드 vs 타 금융)
    if any(k in clean for k in ["현대카드", "hyundaicard"]) or clean in ["현대", "hyundai"]:
        return "현대카드"
    if ("현대" in clean or "hyundai" in clean) and "카드" in clean:
        return "현대카드"

    return clean


def is_same_institution(pm_inst: Optional[str], detected_inst: Optional[str]) -> bool:
    """결제수단에 등록된 기관명과 파서가 감지한 금융기관이 일치하거나 호환되는지 엄격히 검증합니다.

    Args:
        pm_inst (Optional[str]): 결제수단 기관명 (예: 'KB국민은행', '신한', '현대카드').
        detected_inst (Optional[str]): 파서가 감지한 금융기관명 (예: '국민은행', '신한은행', '현대카드', '카카오뱅크').

    Returns:
        bool: 두 기관명이 동일하거나 상호 호환되면 True, 불일치하거나 비어있으면 False.
    """
    if not pm_inst or not detected_inst:
        return False

    norm_pm = normalize_institution(pm_inst)
    norm_detected = normalize_institution(detected_inst)

    if not norm_pm or not norm_detected:
        return False

    return norm_pm == norm_detected



class ExpenseParserService:
    """금융기관별 명세서를 자동 판별하고 복호화 및 거래 내역을 정규화 추출하는 통합 서비스."""

    @staticmethod
    def detect_institution(file_bytes: bytes, filename: str = "") -> str:
        """파일 내용과 파일명을 기반으로 금융기관 및 포맷을 감지합니다.

        Args:
            file_bytes: 파일의 바이너리 내용.
            filename: 원본 파일명 (선택).

        Returns:
            감지된 금융기관 식별자 ('카카오뱅크', '현대카드' 또는 '국민은행').

        Raises:
            UnsupportedFileFormatError: 지원하지 않는 파일 형식인 경우.
        """
        lower_name = filename.lower()
        suffix = Path(filename).suffix.lower()

        # 1. 파일명 기반 우선 감지
        if "국민" in lower_name or "kb" in lower_name or "kbbank" in lower_name:
            return "국민은행"
        if "신한" in lower_name or "shinhan" in lower_name:
            return "신한은행"
        if "카카오" in lower_name or "kakaobank" in lower_name:
            return "카카오뱅크"
        if "현대" in lower_name or "hyundai" in lower_name:
            return "현대카드"

        # 2. 확장자 및 매직바이트/내용 기반 감지
        if suffix in [".xlsx", ".xls"]:
            return "카카오뱅크"

        if suffix in [".html", ".htm"]:
            return "현대카드"

        # 3. 매직바이트 / 내용 검사
        # OLE Compound Document (MS Office 암호화 파일): D0 CF 11 E0 A1 B1 1A E1
        # Zip 기반 파일: PK\x03\x04
        if file_bytes.startswith(b"\xd0\xcf\x11\xe0") or file_bytes.startswith(b"PK\x03\x04"):
            return "카카오뱅크"

        # HTML 태그 검사
        sample = file_bytes[:4096].lower()
        if b"<html" in sample or b"<!doctype html" in sample or b"vestmail" in sample:
            return "현대카드"

        # PDF 검사 (%PDF- 매직바이트 또는 .pdf 확장자)
        if file_bytes.startswith(b"%PDF-") or suffix == ".pdf":
            kb_signatures = [
                b"KBFG",
                b"kbstar",
                "KB국민은행".encode("utf-8"),
                "KB국민은행".encode("euc-kr"),
                "KB마이핏".encode("utf-8"),
                "KB마이핏".encode("euc-kr"),
                "국민은행".encode("utf-8"),
                "국민은행".encode("euc-kr"),
            ]
            if any(sig in file_bytes for sig in kb_signatures):
                return "국민은행"

            shinhan_signatures = [
                b"SHINHAN",
                b"shinhan",
                "신한은행".encode("utf-8"),
                "신한은행".encode("euc-kr"),
                "신한".encode("utf-8"),
                "신한".encode("euc-kr"),
            ]
            if any(sig in file_bytes for sig in shinhan_signatures):
                return "신한은행"

            # 암호화되지 않은 PDF의 경우 텍스트 직접 검사 시도
            try:
                import io
                import pypdf
                reader = pypdf.PdfReader(io.BytesIO(file_bytes))
                if not reader.is_encrypted and len(reader.pages) > 0:
                    text = reader.pages[0].extract_text() or ""
                    if any(kw in text for kw in ["KB국민은행", "KB마이핏", "국민은행", "kbstar"]):
                        return "국민은행"
                    if any(kw in text for kw in ["신한은행", "SHINHAN BANK", "신한", "shinhan"]):
                        return "신한은행"
            except Exception:
                pass

        raise UnsupportedFileFormatError(
            f"지원하지 않는 명세서 형식이거나 금융기관을 감지할 수 없습니다: {filename}"
        )

    def parse(
        self,
        file_bytes: bytes,
        filename: str = "",
        password: str = "",
        institution: Optional[str] = None,
        target_year_month: Optional[str] = None,
    ) -> Dict[str, Any]:
        """업로드된 명세서 파일을 파싱하여 정규화된 지출 데이터로 반환합니다.

        Args:
            file_bytes: 명세서 파일 바이너리.
            filename: 원본 파일명 (선택).
            password: 복호화 비밀번호 (생년월일 6자리 등).
            institution: 금융기관 직접 지정 (미지정 시 자동 감지).
            target_year_month: 대상 연월 필터링 (선택).

        Returns:
            표준 지출 스키마 딕셔너리:
                - year_month (str): 기준 년월 (예: '2026-08')
                - owner (Optional[str]): 소유주 성명
                - institution (str): 금융기관명
                - account_identifier (Optional[str]): 카드명 또는 계좌 식별값
                - transactions (List[dict]): 정규화된 거래 목록
                - other_month_count (int): 대상 월 외 제외된 거래 건수

        Raises:
            InvalidPasswordError: 비밀번호가 일치하지 않는 경우.
            UnsupportedFileFormatError: 지원하지 않는 파일 형식인 경우.
            ExpenseParserError: 파싱 중 에러 발생 시.
        """
        if not institution:
            institution = self.detect_institution(file_bytes, filename)

        result: Dict[str, Any]
        if institution == "카카오뱅크":
            result = parse_kakaobank_excel(file_bytes, password=password)
            result.setdefault("other_month_count", 0)
            return result
        elif institution == "현대카드":
            result = parse_hyundaicard_html(file_bytes, password=password)
            result.setdefault("other_month_count", 0)
            return result
        elif institution == "국민은행":
            return parse_kbbank_pdf(
                file_bytes,
                password=password,
                target_year_month=target_year_month,
            )
        elif institution == "신한은행":
            return parse_shinhanbank_pdf(
                file_bytes,
                password=password,
                target_year_month=target_year_month,
            )
        else:
            raise UnsupportedFileFormatError(f"지원하지 않는 금융기관입니다: {institution}")
