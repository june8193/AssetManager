# -*- coding: utf-8 -*-
"""국민은행 암호화 입출금 거래내역 PDF 명세서 파서 단위 테스트 모듈."""

from pathlib import Path
import pytest

from src.backend.parsers.exceptions import (
    ExpenseParserError,
    InvalidPasswordError,
)
from src.backend.parsers.kbbank import parse_kbbank_pdf

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "statements"
VALID_PASSWORD = "950913"
INVALID_PASSWORD = "000000"


@pytest.fixture
def kbbank_pdf_path() -> Path:
    """국민은행 실제 샘플 PDF 파일 경로 fixture."""
    matched = list(FIXTURES_DIR.glob("*KB*.pdf"))
    if not matched:
        matched = list(FIXTURES_DIR.glob("*.pdf"))
    assert matched, "국민은행 샘플 PDF 파일이 존재하지 않습니다."
    return matched[0]


class TestKBBankParser:
    """국민은행 입출금 PDF 파서 단위 테스트."""

    def test_parse_kbbank_success(self, kbbank_pdf_path: Path):
        """올바른 비밀번호로 복호화 및 거래 내역이 정상 정규화 추출되는지 검증."""
        file_bytes = kbbank_pdf_path.read_bytes()
        result = parse_kbbank_pdf(file_bytes, password=VALID_PASSWORD)

        # 1. 메타데이터 검증
        assert result["institution"] == "국민은행"
        assert result["owner"] == "홍성은"
        assert result["account_identifier"] == "546902-01-407474"
        assert result["year_month"] == "2026-08"
        assert result["other_month_count"] == 0

        # 2. 거래 목록 건수 검증
        transactions = result["transactions"]
        assert len(transactions) == 17

        # 3. 최신 거래(첫 행) 검증: 입금 거래
        # 2026.08.31 10:57:42 전자금융 삼성카드 0 7,000 411,227 - SC은행
        first = transactions[0]
        assert first["transaction_date"] == "2026-08-31 10:57:42"
        assert first["year_month"] == "2026-08"
        assert first["merchant"] == "삼성카드"
        assert first["amount"] == 7000.0
        assert first["original_type"] == "입금"
        assert "전자금융" in first["memo"]

        # 4. 출금 거래 검증 (오픈뱅킹출금)
        # 2026.08.28 23:42:09 오픈뱅킹출금 토스 홍성은 100,000 0 404,227 - 스타뱅
        second = transactions[1]
        assert second["transaction_date"] == "2026-08-28 23:42:09"
        assert second["year_month"] == "2026-08"
        assert second["merchant"] == "토스 홍성은"
        assert second["amount"] == 100000.0
        assert second["original_type"] == "출금"
        assert "오픈뱅킹출금" in second["memo"]

        # 5. CMS 거래 검증
        # 2026.08.05 19:58:17 CMS 공동 삼성화08020 18,725 0 541,848 - ERP사
        cms_tx = next(tx for tx in transactions if tx["merchant"] == "삼성화08020")
        assert cms_tx["transaction_date"] == "2026-08-05 19:58:17"
        assert cms_tx["amount"] == 18725.0
        assert cms_tx["original_type"] == "출금"
        assert "CMS 공동" in cms_tx["memo"]

        # 6. 이자 입금 거래 검증
        # 2026.08.15 01:45:02 결산이자 이자세금:20원 0 132 541,980 - 왕십리
        interest_tx = next(tx for tx in transactions if "결산이자" in tx["memo"])
        assert interest_tx["amount"] == 132.0
        assert interest_tx["original_type"] == "입금"
        assert interest_tx["merchant"] == "이자세금:20원"

    def test_parse_kbbank_invalid_password(self, kbbank_pdf_path: Path):
        """잘못된 비밀번호 제공 시 InvalidPasswordError가 발생하는지 검증."""
        file_bytes = kbbank_pdf_path.read_bytes()
        with pytest.raises(InvalidPasswordError):
            parse_kbbank_pdf(file_bytes, password=INVALID_PASSWORD)

    def test_parse_kbbank_missing_password(self, kbbank_pdf_path: Path):
        """암호화된 PDF에 비밀번호 미제공 시 InvalidPasswordError가 발생하는지 검증."""
        file_bytes = kbbank_pdf_path.read_bytes()
        with pytest.raises(InvalidPasswordError):
            parse_kbbank_pdf(file_bytes, password=None)

    def test_parse_kbbank_corrupted_data(self):
        """손상된 파일 바이너리 전달 시 ExpenseParserError가 발생하는지 검증."""
        corrupted_bytes = b"%PDF-1.4 corrupted invalid content"
        with pytest.raises(ExpenseParserError):
            parse_kbbank_pdf(corrupted_bytes, password=VALID_PASSWORD)

    def test_parse_kbbank_target_year_month_matching(self, kbbank_pdf_path: Path):
        """target_year_month 지정 시 해당 연월 거래만 추출되고 other_month_count가 0인지 검증."""
        file_bytes = kbbank_pdf_path.read_bytes()
        result = parse_kbbank_pdf(
            file_bytes,
            password=VALID_PASSWORD,
            target_year_month="2026-08",
        )
        assert result["year_month"] == "2026-08"
        assert len(result["transactions"]) == 17
        assert result["other_month_count"] == 0

    def test_parse_kbbank_target_year_month_filtering_other_month(self, kbbank_pdf_path: Path):
        """target_year_month와 다른 월인 경우 거래가 제외되고 other_month_count로 집계되는지 검증."""
        file_bytes = kbbank_pdf_path.read_bytes()
        result = parse_kbbank_pdf(
            file_bytes,
            password=VALID_PASSWORD,
            target_year_month="2026-07",
        )
        assert result["year_month"] == "2026-07"
        assert len(result["transactions"]) == 0
        assert result["other_month_count"] == 17
