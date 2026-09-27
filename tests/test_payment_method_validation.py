# -*- coding: utf-8 -*-
"""결제수단-명세서 금융기관 일치 검증 단위 및 통합 테스트 모듈입니다."""

from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.backend.main import app
from src.backend.database import Base, get_db
from src.backend.models import ExpenseCategory, PaymentMethod
from src.backend.services.expense_parser_service import (
    is_same_institution,
    normalize_institution,
)


# ==========================================
# 1. is_same_institution 단위 테스트
# ==========================================

@pytest.mark.parametrize(
    "pm_inst,detected_inst",
    [
        ("국민은행", "국민은행"),
        ("KB국민은행", "국민은행"),
        ("kb국민은행", "국민은행"),
        ("KB", "국민은행"),
        ("국민", "국민은행"),
        ("KB은행", "국민은행"),
        ("kbbank", "국민은행"),
        ("신한은행", "신한은행"),
        ("신한", "신한은행"),
        ("SHINHAN", "신한은행"),
        ("SHINHAN BANK", "신한은행"),
        ("shinhanbank", "신한은행"),
        ("현대카드", "현대카드"),
        ("현대", "현대카드"),
        ("hyundaicard", "현대카드"),
        ("카카오뱅크", "카카오뱅크"),
        ("카카오", "카카오뱅크"),
        ("kakaobank", "카카오뱅크"),
        ("KakaoBank", "카카오뱅크"),
    ],
)
def test_is_same_institution_matches(pm_inst: str, detected_inst: str):
    """호환되는 금융기관명칭인 경우 True를 반환하는지 검증합니다."""
    assert is_same_institution(pm_inst, detected_inst) is True


@pytest.mark.parametrize(
    "pm_inst,detected_inst",
    [
        # 서로 다른 금융기관
        ("국민은행", "신한은행"),
        ("신한은행", "국민은행"),
        ("현대카드", "카카오뱅크"),
        ("카카오뱅크", "현대카드"),
        ("현대카드", "국민은행"),
        ("카카오뱅크", "신한은행"),
        # 계열사 간 엄격 분리 (카드 vs 은행, 페이 vs 뱅크)
        ("국민카드", "국민은행"),
        ("KB국민카드", "국민은행"),
        ("신한카드", "신한은행"),
        ("카카오페이", "카카오뱅크"),
        ("카카오카드", "카카오뱅크"),
        # 미지원 은행 / 타 기관
        ("우리은행", "신한은행"),
        ("하나은행", "국민은행"),
        ("토스뱅크", "카카오뱅크"),
        ("삼성카드", "현대카드"),
        # 빈 문자열 및 None
        ("", "국민은행"),
        ("   ", "신한은행"),
        (None, "현대카드"),
        ("국민은행", ""),
        ("신한은행", None),
    ],
)
def test_is_same_institution_mismatches(pm_inst: str, detected_inst: str):
    """불일치하거나 카드/은행 간 오선택인 경우 False를 반환하는지 검증합니다."""
    assert is_same_institution(pm_inst, detected_inst) is False


# ==========================================
# 2. API 통합 테스트
# ==========================================

TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
def db_session():
    """테스트용 격리된 인메모리 DB 세션 fixture."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()

    # 다양한 기관 표기 및 카드/은행 결제수단 등록
    pm_kb_norm = PaymentMethod(owner="홍성은", institution="국민은행", alias="국민은행 계좌", account_number="111", is_active=True)
    pm_kb_alias = PaymentMethod(owner="홍성은", institution="KB국민은행", alias="KB국민 계좌", account_number="222", is_active=True)
    pm_kb_card = PaymentMethod(owner="홍성은", institution="국민카드", alias="KB국민카드", account_number="333", is_active=True)

    pm_sh_norm = PaymentMethod(owner="홍성은", institution="신한은행", alias="신한 주거래계좌", account_number="444", is_active=True)
    pm_sh_alias = PaymentMethod(owner="홍성은", institution="신한", alias="신한 계좌", account_number="555", is_active=True)
    pm_sh_card = PaymentMethod(owner="홍성은", institution="신한카드", alias="신한 신용카드", account_number="666", is_active=True)

    pm_hd = PaymentMethod(owner="장준", institution="현대카드", alias="현대 M포인트카드", account_number="777", is_active=True)
    pm_kakao = PaymentMethod(owner="장준", institution="카카오뱅크", alias="카카오 입출금", account_number="888", is_active=True)
    pm_kakaopay = PaymentMethod(owner="장준", institution="카카오페이", alias="카카오페이머니", account_number="999", is_active=True)

    session.add_all([
        pm_kb_norm, pm_kb_alias, pm_kb_card,
        pm_sh_norm, pm_sh_alias, pm_sh_card,
        pm_hd, pm_kakao, pm_kakaopay,
    ])

    cat = ExpenseCategory(name="식비/카페", color="#FF6B6B", is_default=True)
    session.add(cat)
    session.commit()

    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db_session):
    """테스트용 FastAPI TestClient fixture."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def fixtures_dir() -> Path:
    """테스트 픽스처 디렉토리 경로."""
    return Path(__file__).parent / "fixtures" / "statements"


def test_api_upload_preview_institution_mismatch_error_message(client, db_session, fixtures_dir):
    """국민은행 결제수단 선택 후 신한은행 파일 업로드 시 직관적인 에러 메시지와 함께 400을 반환하는지 검증합니다."""
    pm_kb = db_session.query(PaymentMethod).filter_by(institution="국민은행").first()
    sh_file = fixtures_dir / "신한은행_거래내역_2608.pdf"

    with open(sh_file, "rb") as f:
        res = client.post(
            "/api/expenses/upload-preview",
            files={"file": ("신한은행_거래내역_2608.pdf", f, "application/pdf")},
            data={"payment_method_id": str(pm_kb.id), "password": "950913"},
        )

    assert res.status_code == 400
    detail = res.json()["detail"]
    assert "선택한 결제수단(국민은행)과 업로드된 명세서(신한은행)가 일치하지 않습니다." in detail


def test_api_upload_preview_card_vs_bank_mismatch(client, db_session, fixtures_dir):
    """신한카드 결제수단 선택 후 신한은행 입출금 PDF 업로드 시 카드-은행 불일치로 400을 반환하는지 검증합니다."""
    pm_card = db_session.query(PaymentMethod).filter_by(institution="신한카드").first()
    sh_file = fixtures_dir / "신한은행_거래내역_2608.pdf"

    with open(sh_file, "rb") as f:
        res = client.post(
            "/api/expenses/upload-preview",
            files={"file": ("신한은행_거래내역_2608.pdf", f, "application/pdf")},
            data={"payment_method_id": str(pm_card.id), "password": "950913"},
        )

    assert res.status_code == 400
    detail = res.json()["detail"]
    assert "선택한 결제수단(신한카드)과 업로드된 명세서(신한은행)가 일치하지 않습니다." in detail


def test_compatible_payment_method_success(client, db_session, fixtures_dir):
    """호환되는 금융기관 표기(KB국민은행) 결제수단으로 국민은행 PDF 업로드 시 200 성공하는지 검증합니다."""
    pm_kb_alias = db_session.query(PaymentMethod).filter_by(institution="KB국민은행").first()
    kb_file = fixtures_dir / "KB거래내역조회_2608.pdf"

    with open(kb_file, "rb") as f:
        res = client.post(
            "/api/expenses/upload-preview",
            files={"file": ("KB거래내역조회_2608.pdf", f, "application/pdf")},
            data={"payment_method_id": str(pm_kb_alias.id), "password": "950913", "target_year_month": "2026-08"},
        )

    assert res.status_code == 200, res.text
    data = res.json()
    assert len(data["transactions"]) == 17
