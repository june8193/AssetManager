# -*- coding: utf-8 -*-
"""지출 명세서 업로드 미리보기 및 확정 등록(덮어쓰기) 플로우 테스트 모듈입니다."""

from datetime import datetime
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.backend.main import app
from src.backend.database import Base, get_db
from src.backend.migrations import seed_expense_masters
from src.backend.models import Expense, PaymentMethod, ExpenseCategory


# 테스트용 인메모리 SQLite DB 설정
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
    seed_expense_masters(session)
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



def test_upload_preview_missing_payment_method_id(client, fixtures_dir):
    """결제수단 ID(payment_method_id) 누락 시 HTTP 422 Unprocessable Entity 에러를 반환하는지 검증합니다."""
    kb_file = fixtures_dir / "카카오뱅크_거래내역_N1991286375_2026092609021842.xlsx"
    with open(kb_file, "rb") as f:
        response = client.post(
            "/api/expenses/upload-preview",
            files={"file": ("kakaobank_statement.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )

    assert response.status_code == 422, f"Expected 422, got {response.status_code}: {response.text}"


def test_upload_preview_nonexistent_payment_method_id(client, fixtures_dir):
    """존재하지 않는 payment_method_id로 요청 시 HTTP 404 Not Found 에러를 반환하는지 검증합니다."""
    kb_file = fixtures_dir / "카카오뱅크_거래내역_N1991286375_2026092609021842.xlsx"
    with open(kb_file, "rb") as f:
        response = client.post(
            "/api/expenses/upload-preview",
            files={"file": ("kakaobank_statement.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={"payment_method_id": 99999},
        )

    assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"


def test_upload_preview_kakaobank_without_password_fails(client, db_session, fixtures_dir):
    """암호화된 카카오뱅크 엑셀 파일을 일회성 비밀번호 없이 업로드 시 복호화 실패(400)를 반환하는지 검증합니다."""
    kb_file = fixtures_dir / "카카오뱅크_거래내역_N1991286375_2026092609021842.xlsx"
    pm = db_session.query(PaymentMethod).filter_by(institution="카카오뱅크").first()
    assert pm is not None, "카카오뱅크 결제수단이 시드 데이터에 있어야 합니다."

    with open(kb_file, "rb") as f:
        response = client.post(
            "/api/expenses/upload-preview",
            files={"file": ("kakaobank_statement.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={"payment_method_id": pm.id},
        )

    assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"


def test_upload_preview_kakaobank_success_with_password(client, db_session, fixtures_dir):
    """카카오뱅크 엑셀 파일을 업로드할 때 사용자가 일회성 복호화 비밀번호를 입력하면 성공적으로 파싱되는지 검증합니다."""
    kb_file = fixtures_dir / "카카오뱅크_거래내역_N1991286375_2026092609021842.xlsx"
    pm = db_session.query(PaymentMethod).filter_by(institution="카카오뱅크").first()
    assert pm is not None, "카카오뱅크 결제수단이 시드 데이터에 있어야 합니다."

    assert kb_file.exists(), f"픽스처 파일이 없습니다: {kb_file}"

    with open(kb_file, "rb") as f:
        response = client.post(
            "/api/expenses/upload-preview",
            files={"file": ("kakaobank_statement.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={"payment_method_id": pm.id, "password": "950811"},
        )

    assert response.status_code == 200, response.text
    data = response.json()

    assert data["year_month"] == "2026-08"
    assert data["payment_method"] is not None
    assert data["payment_method"]["institution"] == "카카오뱅크"
    assert data["payment_method"]["owner"] == "장준"
    assert len(data["transactions"]) > 0

    # 카드대금 출금 건 등 is_excluded 자동 판단 확인
    excluded_items = [t for t in data["transactions"] if t.get("is_excluded")]
    assert len(excluded_items) > 0, "현대카드 출금 건 등은 is_excluded가 True여야 합니다."


def test_upload_preview_hyundaicard_success(client, db_session, fixtures_dir):
    """현대카드 보안 HTML 파일을 업로드하여 명시적 비밀번호(950811)로 미리보기 데이터를 성공적으로 반환받는지 검증합니다."""
    hc_file = fixtures_dir / "hyundaicard_2608.html"
    pm = db_session.query(PaymentMethod).filter_by(institution="현대카드").first()
    assert pm is not None, "현대카드 결제수단이 시드 데이터에 있어야 합니다."

    assert hc_file.exists(), f"픽스처 파일이 없습니다: {hc_file}"

    with open(hc_file, "rb") as f:
        response = client.post(
            "/api/expenses/upload-preview",
            files={"file": ("hyundaicard_2608.html", f, "text/html")},
            data={"password": "950811", "payment_method_id": pm.id},
        )

    assert response.status_code == 200, response.text
    data = response.json()

    assert data["year_month"] == "2026-08"
    assert data["payment_method"] is not None
    assert data["payment_method"]["institution"] == "현대카드"
    assert len(data["transactions"]) > 0

    # 각 거래에 기본 카테고리가 매칭되었는지 확인
    for tx in data["transactions"]:
        assert tx.get("category_id") is not None


def test_upload_preview_invalid_password(client, db_session, fixtures_dir):
    """잘못된 비밀번호로 업로드 시 400 에러를 반환하는지 검증합니다."""
    kb_file = fixtures_dir / "카카오뱅크_거래내역_N1991286375_2026092609021842.xlsx"
    pm = db_session.query(PaymentMethod).filter_by(institution="카카오뱅크").first()

    with open(kb_file, "rb") as f:
        response = client.post(
            "/api/expenses/upload-preview",
            files={"file": ("kakaobank_statement.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={"password": "wrong_password", "payment_method_id": pm.id},
        )

    assert response.status_code == 400
    assert "비밀번호" in response.json()["detail"] or "복호화" in response.json()["detail"]


def test_commit_expenses_and_overwrite(client, db_session):
    """동일 청구년월 및 결제수단에 대해 커밋 시 기존 레코드를 모두 삭제하고 새 레코드로 통째로 대체(Overwrite)하는지 검증합니다."""
    pm = db_session.query(PaymentMethod).first()
    cat = db_session.query(ExpenseCategory).first()
    year_month = "2026-08"

    # 1. 1차 커밋 (2건 등록)
    payload_1 = {
        "payment_method_id": pm.id,
        "year_month": year_month,
        "source_file": "first_upload.xlsx",
        "items": [
            {
                "transaction_date": "2026-08-01 12:00:00",
                "year_month": year_month,
                "merchant": "식당 A",
                "amount": 15000.0,
                "category_id": cat.id,
                "is_excluded": False,
                "memo": "첫번째 점심",
            },
            {
                "transaction_date": "2026-08-02 18:30:00",
                "year_month": year_month,
                "merchant": "카페 B",
                "amount": 5500.0,
                "category_id": cat.id,
                "is_excluded": False,
                "memo": "커피",
            },
        ],
    }

    res_1 = client.post("/api/expenses/commit", json=payload_1)
    assert res_1.status_code == 200, res_1.text
    assert res_1.json()["count"] == 2

    # DB에 2건 적재되었는지 확인
    records_1 = db_session.query(Expense).filter_by(payment_method_id=pm.id, year_month=year_month).all()
    assert len(records_1) == 2
    assert {r.merchant for r in records_1} == {"식당 A", "카페 B"}

    # 2. 2차 커밋 (동일 년월/결제수단에 3건 재등록 - Overwrite 검증)
    payload_2 = {
        "payment_method_id": pm.id,
        "year_month": year_month,
        "source_file": "second_upload_updated.xlsx",
        "items": [
            {
                "transaction_date": "2026-08-05 13:00:00",
                "year_month": year_month,
                "merchant": "마트 C",
                "amount": 42000.0,
                "category_id": cat.id,
                "is_excluded": False,
                "memo": "장보기",
            },
            {
                "transaction_date": "2026-08-10 20:00:00",
                "year_month": year_month,
                "merchant": "주유소 D",
                "amount": 70000.0,
                "category_id": cat.id,
                "is_excluded": False,
                "memo": "주유",
            },
            {
                "transaction_date": "2026-08-15 09:00:00",
                "year_month": year_month,
                "merchant": "약국 E",
                "amount": 12000.0,
                "category_id": cat.id,
                "is_excluded": True,
                "memo": "영양제",
            },
        ],
    }

    res_2 = client.post("/api/expenses/commit", json=payload_2)
    assert res_2.status_code == 200, res_2.text
    assert res_2.json()["count"] == 3

    # DB 확인: 이전 식당 A, 카페 B는 삭제되고 새 3건만 존재해야 함 (중복 누적 없음)
    records_2 = db_session.query(Expense).filter_by(payment_method_id=pm.id, year_month=year_month).all()
    assert len(records_2) == 3
    assert {r.merchant for r in records_2} == {"마트 C", "주유소 D", "약국 E"}
    assert all(r.source_file == "second_upload_updated.xlsx" for r in records_2)


def test_commit_expenses_invalid_payment_method(client, db_session):
    """존재하지 않는 payment_method_id로 커밋 시 404 에러를 반환하는지 검증합니다."""
    payload = {
        "payment_method_id": 999999,
        "year_month": "2026-08",
        "source_file": "test.xlsx",
        "items": [],
    }
    response = client.post("/api/expenses/commit", json=payload)
    assert response.status_code == 404


def test_upload_preview_no_stored_password_fallback_when_password_missing(client, db_session, fixtures_dir, monkeypatch):
    """요청 시 password가 전달되지 않으면 설정이나 DB의 폴백 없이 즉시 복호화 실패(400)를 반환하는지 검증합니다."""
    # 환경변수에 구 비밀번호가 설정되어 있더라도 무시되어야 함
    monkeypatch.setenv("EXPENSES_DEFAULT_PASSWORD", "950811")

    hc_file = fixtures_dir / "hyundaicard_2608.html"
    pm = db_session.query(PaymentMethod).filter_by(institution="현대카드").first()
    assert pm is not None, "현대카드 결제수단이 있어야 합니다."

    with open(hc_file, "rb") as f:
        # password 파라미터 미전달
        response = client.post(
            "/api/expenses/upload-preview",
            files={"file": ("hyundaicard_2608.html", f, "text/html")},
            data={"payment_method_id": pm.id},
        )

    # 폴백 체인이 제거되었으므로 400 에러가 발생해야 함
    assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"


def test_commit_expenses_multi_month_and_flexible_date_overwrite(client, db_session):
    """명세서 내 다중 월(예: 7월 말일 승인건과 8월 승인건)이 혼재되어 있거나 초 단위가 생략된 날짜 포맷일 때도 덮어쓰기 무결성이 유지되는지 검증합니다."""
    pm = db_session.query(PaymentMethod).first()
    cat = db_session.query(ExpenseCategory).first()

    # 1. 1차 커밋: 7월 말일 1건 + 8월 초 1건
    payload_1 = {
        "payment_method_id": pm.id,
        "year_month": "2026-08",
        "source_file": "august_statement.xlsx",
        "items": [
            {
                "transaction_date": "2026-07-31 23:50", # 초 단위 생략 포맷
                "year_month": "2026-07",
                "merchant": "7월 말 식당",
                "amount": 20000.0,
                "category_id": cat.id,
            },
            {
                "transaction_date": "2026-08-01", # 날짜만 있는 포맷
                "year_month": "2026-08",
                "merchant": "8월 초 서점",
                "amount": 15000.0,
                "category_id": cat.id,
            },
        ],
    }

    res_1 = client.post("/api/expenses/commit", json=payload_1)
    assert res_1.status_code == 200
    assert res_1.json()["count"] == 2

    # 2. 동일 명세서 갱신 재업로드 (Overwrite): 7월 1건 갱신 + 8월 2건 갱신
    payload_2 = {
        "payment_method_id": pm.id,
        "year_month": "2026-08",
        "source_file": "august_statement_v2.xlsx",
        "items": [
            {
                "transaction_date": "2026-07-31 23:50:00",
                "year_month": "2026-07",
                "merchant": "7월 말 식당 (수정)",
                "amount": 22000.0,
                "category_id": cat.id,
            },
            {
                "transaction_date": "2026-08-02 10:15:00",
                "year_month": "2026-08",
                "merchant": "8월 신규 편의점",
                "amount": 3000.0,
                "category_id": cat.id,
            },
        ],
    }

    res_2 = client.post("/api/expenses/commit", json=payload_2)
    assert res_2.status_code == 200
    assert res_2.json()["count"] == 2

    # DB 검증: 이전 7월 말 식당, 8월 초 서점은 삭제되고 신규 2건만 존재해야 함 (중복 누적 없음)
    records = db_session.query(Expense).filter(Expense.payment_method_id == pm.id).all()
    assert len(records) == 2
    merchants = {r.merchant for r in records}
    assert merchants == {"7월 말 식당 (수정)", "8월 신규 편의점"}


