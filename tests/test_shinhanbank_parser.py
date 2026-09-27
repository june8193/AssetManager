# -*- coding: utf-8 -*-
"""신한은행 암호화 입출금 거래내역 PDF 명세서 파서 단위 테스트 모듈."""

from pathlib import Path
import pytest

from src.backend.parsers.exceptions import (
    ExpenseParserError,
    InvalidPasswordError,
)
from src.backend.parsers.shinhanbank import parse_shinhanbank_pdf

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "statements"
VALID_PASSWORD = "950913"
INVALID_PASSWORD = "000000"


@pytest.fixture
def shinhanbank_pdf_path() -> Path:
    """신한은행 실제 샘플 PDF 파일 경로 fixture."""
    matched = list(FIXTURES_DIR.glob("*신한*.pdf"))
    if not matched:
        matched = list(FIXTURES_DIR.glob("*shinhan*.pdf"))
    assert matched, "신한은행 샘플 PDF 파일이 존재하지 않습니다."
    return matched[0]


class TestShinhanBankParser:
    """신한은행 입출금 PDF 파서 단위 테스트."""

    def test_parse_shinhanbank_success_all_months(self, shinhanbank_pdf_path: Path):
        """올바른 비밀번호로 다중 페이지 복호화 및 전체 거래(83건)가 정규화 추출되는지 검증."""
        file_bytes = shinhanbank_pdf_path.read_bytes()
        result = parse_shinhanbank_pdf(file_bytes, password=VALID_PASSWORD)

        # 1. 메타데이터 검증
        assert result["institution"] == "신한은행"
        assert result["owner"] == "홍*은"
        assert result["account_identifier"] == "110-***-*57500"
        assert result["year_month"] == "2026-09"
        assert result["other_month_count"] == 0

        # 2. 거래 목록 건수 검증 (총 83건)
        transactions = result["transactions"]
        assert len(transactions) == 83

        # 3. 최신 거래(첫 행) 검증: 이자 입금 거래
        # 20260919 04:11:31 이자 0 53 06.20~09.18 27,503 디금융
        first = transactions[0]
        assert first["transaction_date"] == "2026-09-19 04:11:31"
        assert first["year_month"] == "2026-09"
        assert first["merchant"] == "06.20~09.18"
        assert first["amount"] == 53.0
        assert first["original_type"] == "입금"
        assert first["memo"] == "이자"

        # 4. 줄바꿈 적요 결합 검증: 오픈뱅킹 이체
        # 20260918 11:47:40 오픈뱅킹 이 \n 체 10,000 0 당근페이 27,450 자금부
        second = transactions[1]
        assert second["transaction_date"] == "2026-09-18 11:47:40"
        assert second["year_month"] == "2026-09"
        assert second["merchant"] == "당근페이"
        assert second["amount"] == 10000.0
        assert second["original_type"] == "출금"
        assert second["memo"] == "오픈뱅킹 이체"

        # 5. 줄바꿈 적요 결합 검증: 타행모바일뱅킹
        # 20260918 11:47:34 타행모바일 \n 뱅킹 0 30,000 홍성은 37,450 (카카)
        third = transactions[2]
        assert third["transaction_date"] == "2026-09-18 11:47:34"
        assert third["merchant"] == "홍성은"
        assert third["amount"] == 30000.0
        assert third["original_type"] == "입금"
        assert third["memo"] == "타행모바일뱅킹"

        # 6. 단일 행 펌뱅킹 이체 검증
        # 20260918 11:46:22 펌뱅킹 이체 0 4,976 홍성은 7,450 (하나)
        fourth = transactions[3]
        assert fourth["transaction_date"] == "2026-09-18 11:46:22"
        assert fourth["merchant"] == "홍성은"
        assert fourth["amount"] == 4976.0
        assert fourth["original_type"] == "입금"
        assert fourth["memo"] == "펌뱅킹 이체"

    def test_parse_shinhanbank_target_year_month_filtering_august(self, shinhanbank_pdf_path: Path):
        """target_year_month='2026-08' 지정 시 8월 거래(31건)만 반환되고 other_month_count가 52건인지 검증."""
        file_bytes = shinhanbank_pdf_path.read_bytes()
        result = parse_shinhanbank_pdf(
            file_bytes,
            password=VALID_PASSWORD,
            target_year_month="2026-08",
        )

        assert result["year_month"] == "2026-08"
        transactions = result["transactions"]
        assert len(transactions) == 31
        assert result["other_month_count"] == 52  # 83 - 31 = 52

        # 반환된 모든 거래가 2026-08 연월인지 확인
        assert all(tx["year_month"] == "2026-08" for tx in transactions)

        # 8월 특정 거래 검증
        # 20260828 17:45:16 펌뱅킹 이체 1,000 0 화성도시고속도 25,136 강남중
        highway_tx = next(tx for tx in transactions if tx["merchant"] == "화성도시고속도")
        assert highway_tx["transaction_date"] == "2026-08-28 17:45:16"
        assert highway_tx["amount"] == 1000.0
        assert highway_tx["original_type"] == "출금"
        assert highway_tx["memo"] == "펌뱅킹 이체"

    def test_parse_shinhanbank_invalid_password(self, shinhanbank_pdf_path: Path):
        """잘못된 비밀번호 제공 시 InvalidPasswordError가 발생하는지 검증."""
        file_bytes = shinhanbank_pdf_path.read_bytes()
        with pytest.raises(InvalidPasswordError):
            parse_shinhanbank_pdf(file_bytes, password=INVALID_PASSWORD)

    def test_parse_shinhanbank_missing_password(self, shinhanbank_pdf_path: Path):
        """암호화된 PDF에 비밀번호 미제공 시 InvalidPasswordError가 발생하는지 검증."""
        file_bytes = shinhanbank_pdf_path.read_bytes()
        with pytest.raises(InvalidPasswordError):
            parse_shinhanbank_pdf(file_bytes, password=None)

    def test_parse_shinhanbank_corrupted_data(self):
        """손상된 파일 바이너리 전달 시 ExpenseParserError가 발생하는지 검증."""
        corrupted_bytes = b"%PDF-1.4 corrupted invalid content"
        with pytest.raises(ExpenseParserError):
            parse_shinhanbank_pdf(corrupted_bytes, password=VALID_PASSWORD)
