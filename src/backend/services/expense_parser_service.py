"""지출 명세서 자동 감지 및 파싱 통합 서비스 모듈."""

from pathlib import Path
from typing import Any, Dict, Optional

from src.backend.parsers.exceptions import (
    ExpenseParserError,
    UnsupportedFileFormatError,
)
from src.backend.parsers.hyundaicard import parse_hyundaicard_html
from src.backend.parsers.kakaobank import parse_kakaobank_excel


class ExpenseParserService:
    """금융기관별 명세서를 자동 판별하고 복호화 및 거래 내역을 정규화 추출하는 통합 서비스."""

    @staticmethod
    def detect_institution(file_bytes: bytes, filename: str = "") -> str:
        """파일 내용과 파일명을 기반으로 금융기관 및 포맷을 감지합니다.

        Args:
            file_bytes: 파일의 바이너리 내용.
            filename: 원본 파일명 (선택).

        Returns:
            감지된 금융기관 식별자 ('카카오뱅크' 또는 '현대카드').

        Raises:
            UnsupportedFileFormatError: 지원하지 않는 파일 형식인 경우.
        """
        lower_name = filename.lower()
        suffix = Path(filename).suffix.lower()

        # 1. 파일명 기반 우선 감지
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

        raise UnsupportedFileFormatError(
            f"지원하지 않는 명세서 형식이거나 금융기관을 감지할 수 없습니다: {filename}"
        )

    def parse(
        self,
        file_bytes: bytes,
        filename: str = "",
        password: str = "",
        institution: Optional[str] = None,
    ) -> Dict[str, Any]:
        """업로드된 명세서 파일을 파싱하여 정규화된 지출 데이터로 반환합니다.

        Args:
            file_bytes: 명세서 파일 바이너리.
            filename: 원본 파일명 (선택).
            password: 복호화 비밀번호 (생년월일 6자리 등).
            institution: 금융기관 직접 지정 (미지정 시 자동 감지).

        Returns:
            표준 지출 스키마 딕셔너리:
                - year_month (str): 기준 년월 (예: '2026-08')
                - owner (Optional[str]): 소유주 성명
                - institution (str): 금융기관명
                - account_identifier (Optional[str]): 카드명 또는 계좌 식별값
                - transactions (List[dict]): 정규화된 거래 목록

        Raises:
            InvalidPasswordError: 비밀번호가 일치하지 않는 경우.
            UnsupportedFileFormatError: 지원하지 않는 파일 형식인 경우.
            ExpenseParserError: 파싱 중 에러 발생 시.
        """
        if not institution:
            institution = self.detect_institution(file_bytes, filename)

        if institution == "카카오뱅크":
            return parse_kakaobank_excel(file_bytes, password=password)
        elif institution == "현대카드":
            return parse_hyundaicard_html(file_bytes, password=password)
        else:
            raise UnsupportedFileFormatError(f"지원하지 않는 금융기관입니다: {institution}")
