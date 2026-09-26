"""지출 명세서 복호화 및 파서 단위/통합 테스트.

카카오뱅크 암호화 엑셀 파서 및 현대카드 VestMail 보안 HTML 파서의 복호화,
정규화 추출, 예외 처리 및 통합 서비스 동작을 검증합니다.
"""

from pathlib import Path
import pytest

from src.backend.parsers.exceptions import (
    ExpenseDecryptionError,
    ExpenseParserError,
    InvalidPasswordError,
    UnsupportedFileFormatError,
)
from src.backend.parsers.hyundaicard import parse_hyundaicard_html
from src.backend.parsers.kakaobank import parse_kakaobank_excel
from src.backend.services.expense_parser_service import ExpenseParserService

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "statements"
VALID_PASSWORD = "950811"
INVALID_PASSWORD = "000000"


@pytest.fixture
def kakaobank_file_path() -> Path:
    """카카오뱅크 실제 샘플 엑셀 파일 경로."""
    matched = list(FIXTURES_DIR.glob("*카카오뱅크*.xlsx"))
    if not matched:
        matched = list(FIXTURES_DIR.glob("*.xlsx"))
    assert matched, "카카오뱅크 샘플 파일이 존재하지 않습니다."
    return matched[0]


@pytest.fixture
def hyundaicard_file_path() -> Path:
    """현대카드 실제 샘플 보안 HTML 파일 경로."""
    matched = list(FIXTURES_DIR.glob("hyundaicard*.html"))
    if not matched:
        matched = list(FIXTURES_DIR.glob("*.html"))
    assert matched, "현대카드 샘플 파일이 존재하지 않습니다."
    return matched[0]


class TestKakaoBankParser:
    """카카오뱅크 암호화 엑셀 파서 테스트."""

    def test_parse_kakaobank_success(self, kakaobank_file_path: Path):
        """올바른 비밀번호로 복호화 및 거래 내역이 정상 추출되는지 검증."""
        file_bytes = kakaobank_file_path.read_bytes()
        result = parse_kakaobank_excel(file_bytes, VALID_PASSWORD)

        assert result["institution"] == "카카오뱅크"
        assert result["owner"] == "장준"
        assert "8864" in (result["account_identifier"] or "")
        assert result["year_month"] == "2026-08"

        transactions = result["transactions"]
        assert len(transactions) == 10

        # 첫 번째 출금 거래 검증
        first = transactions[0]
        assert first["transaction_date"] == "2026-08-01 10:28:41"
        assert first["year_month"] == "2026-08"
        assert first["merchant"] == "장준"
        assert first["amount"] == 10000.0  # 출금 음수(-10,000)가 양수 지출(10000.0)로 정규화
        assert first["original_type"] == "출금"

        # 입금 거래 검증
        deposit_tx = next(tx for tx in transactions if tx["original_type"] == "입금")
        assert deposit_tx["amount"] == 1.0
        assert deposit_tx["merchant"] == "키움928"

    def test_parse_kakaobank_invalid_password(self, kakaobank_file_path: Path):
        """잘못된 비밀번호 입력 시 InvalidPasswordError가 발생하는지 검증."""
        file_bytes = kakaobank_file_path.read_bytes()
        with pytest.raises(InvalidPasswordError):
            parse_kakaobank_excel(file_bytes, INVALID_PASSWORD)

    def test_parse_kakaobank_invalid_data(self):
        """손상된 파일 또는 비엑셀 데이터 전달 시 에러가 발생하는지 검증."""
        corrupted_bytes = b"NOT_A_VALID_OFFICE_FILE_CORRUPTED_BYTES"
        with pytest.raises(ExpenseParserError):
            parse_kakaobank_excel(corrupted_bytes, VALID_PASSWORD)


class TestHyundaiCardParser:
    """현대카드 VestMail 보안 HTML 파서 테스트."""

    def test_parse_hyundaicard_success(self, hyundaicard_file_path: Path):
        """올바른 비밀번호로 복호화 및 거래 내역이 정상 추출되는지 검증."""
        file_bytes = hyundaicard_file_path.read_bytes()
        result = parse_hyundaicard_html(file_bytes, VALID_PASSWORD)

        assert result["institution"] == "현대카드"
        assert result["owner"] == "장준"
        assert "HYUNDAI BLUE P" in (result["account_identifier"] or "")
        assert result["year_month"] == "2026-08"

        transactions = result["transactions"]
        assert len(transactions) == 10

        # 첫 번째 거래 검증
        first = transactions[0]
        assert first["transaction_date"] == "2026-08-08"
        assert first["year_month"] == "2026-08"
        assert "유니클로" in first["merchant"]
        assert first["amount"] == 49600.0
        assert first["original_type"] == "일시불"

        # 마지막 거래 검증
        last = transactions[-1]
        assert last["transaction_date"] == "2026-08-27"
        assert "현대해상" in last["merchant"]
        assert last["amount"] == 8830.0

    def test_parse_hyundaicard_invalid_password(self, hyundaicard_file_path: Path):
        """잘못된 비밀번호 입력 시 InvalidPasswordError가 발생하는지 검증."""
        file_bytes = hyundaicard_file_path.read_bytes()
        with pytest.raises(InvalidPasswordError):
            parse_hyundaicard_html(file_bytes, INVALID_PASSWORD)

    def test_parse_hyundaicard_invalid_html(self):
        """일반 HTML이나 손상된 데이터 전달 시 에러가 발생하는지 검증."""
        normal_html = b"<html><body><p>Hello world without vestmail</p></body></html>"
        with pytest.raises(ExpenseParserError):
            parse_hyundaicard_html(normal_html, VALID_PASSWORD)


class TestExpenseParserService:
    """통합 지출 파서 서비스 테스트."""

    def test_detect_and_parse_kakaobank(self, kakaobank_file_path: Path):
        """파일명 및 바이트 기반 카카오뱅크 자동 감지 및 파싱 검증."""
        file_bytes = kakaobank_file_path.read_bytes()
        service = ExpenseParserService()
        result = service.parse(file_bytes, filename=kakaobank_file_path.name, password=VALID_PASSWORD)

        assert result["institution"] == "카카오뱅크"
        assert len(result["transactions"]) == 10

    def test_detect_and_parse_hyundaicard(self, hyundaicard_file_path: Path):
        """파일명 및 바이트 기반 현대카드 자동 감지 및 파싱 검증."""
        file_bytes = hyundaicard_file_path.read_bytes()
        service = ExpenseParserService()
        result = service.parse(file_bytes, filename=hyundaicard_file_path.name, password=VALID_PASSWORD)

        assert result["institution"] == "현대카드"
        assert len(result["transactions"]) == 10

    def test_parse_with_explicit_institution(self, kakaobank_file_path: Path):
        """institution 매개변수를 직접 지정했을 때의 파싱 검증."""
        file_bytes = kakaobank_file_path.read_bytes()
        service = ExpenseParserService()
        result = service.parse(
            file_bytes,
            filename="unknown_name.dat",
            password=VALID_PASSWORD,
            institution="카카오뱅크",
        )
        assert result["institution"] == "카카오뱅크"
        assert len(result["transactions"]) == 10

    def test_unsupported_institution(self):
        """지원하지 않는 금융기관 명시 시 UnsupportedFileFormatError 검증."""
        service = ExpenseParserService()
        with pytest.raises(UnsupportedFileFormatError):
            service.parse(b"dummy", institution="신한카드")

    def test_unsupported_file_format(self):
        """지원하지 않는 확장자나 형식의 파일 전달 시 UnsupportedFileFormatError 검증."""
        service = ExpenseParserService()
        with pytest.raises(UnsupportedFileFormatError):
            service.parse(b"dummy pdf content", filename="statement.pdf", password=VALID_PASSWORD)

