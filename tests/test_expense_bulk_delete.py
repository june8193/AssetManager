# -*- coding: utf-8 -*-
"""지출 거래 내역 일괄 삭제 API 단위/통합 테스트 모듈입니다."""

from datetime import datetime
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.backend.main import app
from src.backend.database import Base, get_db
from src.backend.models import Expense, PaymentMethod, ExpenseCategory


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
    cats = [
        ExpenseCategory(name="식비/카페", color="#FF6B6B", is_default=True),
        ExpenseCategory(name="쇼핑", color="#4ECDC4", is_default=True),
    ]
    session.add_all(cats)
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
def sample_expenses(db_session):
    """일괄 삭제 테스트용 지출 거래 데이터 생성."""
    pm_card = PaymentMethod(owner="장준", institution="현대카드", alias="장준 현대카드", is_active=True)
    pm_bank = PaymentMethod(owner="장준", institution="카카오뱅크", alias="장준 카카오뱅크", is_active=True)
    pm_se = PaymentMethod(owner="성은", institution="신한은행", alias="성은 신한은행", is_active=True)
    db_session.add_all([pm_card, pm_bank, pm_se])
    db_session.commit()

    cat_food = db_session.query(ExpenseCategory).filter_by(name="식비/카페").first()

    expenses = [
        # 2026-08 (장준 현대카드 2건)
        Expense(
            transaction_date=datetime(2026, 8, 1, 12, 0),
            year_month="2026-08",
            merchant="가맹점A",
            amount=10000.0,
            payment_method_id=pm_card.id,
            owner="장준",
            institution="현대카드",
            category_id=cat_food.id,
        ),
        Expense(
            transaction_date=datetime(2026, 8, 2, 12, 0),
            year_month="2026-08",
            merchant="가맹점B",
            amount=20000.0,
            payment_method_id=pm_card.id,
            owner="장준",
            institution="현대카드",
            category_id=cat_food.id,
        ),
        # 2026-08 (장준 카카오뱅크 1건)
        Expense(
            transaction_date=datetime(2026, 8, 3, 12, 0),
            year_month="2026-08",
            merchant="가맹점C",
            amount=30000.0,
            payment_method_id=pm_bank.id,
            owner="장준",
            institution="카카오뱅크",
            category_id=cat_food.id,
        ),
        # 2026-08 (성은 신한은행 1건)
        Expense(
            transaction_date=datetime(2026, 8, 4, 12, 0),
            year_month="2026-08",
            merchant="가맹점D",
            amount=40000.0,
            payment_method_id=pm_se.id,
            owner="성은",
            institution="신한은행",
            category_id=cat_food.id,
        ),
        # 2026-07 (장준 현대카드 2건 - 다른 달)
        Expense(
            transaction_date=datetime(2026, 7, 10, 12, 0),
            year_month="2026-07",
            merchant="가맹점E",
            amount=50000.0,
            payment_method_id=pm_card.id,
            owner="장준",
            institution="현대카드",
            category_id=cat_food.id,
        ),
        Expense(
            transaction_date=datetime(2026, 7, 20, 12, 0),
            year_month="2026-07",
            merchant="가맹점F",
            amount=60000.0,
            payment_method_id=pm_card.id,
            owner="장준",
            institution="현대카드",
            category_id=cat_food.id,
        ),
    ]
    db_session.add_all(expenses)
    db_session.commit()

    return {
        "pm_card": pm_card,
        "pm_bank": pm_bank,
        "pm_se": pm_se,
        "expenses": expenses,
    }


def test_bulk_delete_expenses_success(client, sample_expenses, db_session):
    """선택된 지출 ID 목록을 원자적으로 일괄 삭제하고 삭제된 건수를 반환하는지 검증."""
    expenses = sample_expenses["expenses"]
    target_ids = [expenses[0].id, expenses[1].id, expenses[2].id]

    res = client.post("/api/expenses/bulk-delete", json={"ids": target_ids})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["deleted_count"] == 3

    # DB에서 실제 삭제되었는지 확인
    remaining_count = db_session.query(Expense).filter(Expense.id.in_(target_ids)).count()
    assert remaining_count == 0

    # 다른 항목들은 유지되는지 확인 (총 6건 중 3건 삭제 후 3건 잔여)
    assert db_session.query(Expense).count() == 3


def test_bulk_delete_non_existent_ids(client, sample_expenses, db_session):
    """존재하지 않는 ID가 포함되어 있어도 존재하는 항목만 삭제하고 정확한 건수를 반환하는지 검증."""
    expenses = sample_expenses["expenses"]
    target_ids = [expenses[0].id, 99999, 88888]

    res = client.post("/api/expenses/bulk-delete", json={"ids": target_ids})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["deleted_count"] == 1

    assert db_session.query(Expense).count() == 5


def test_bulk_delete_empty_ids_validation_error(client):
    """빈 ID 목록 전송 시 400 Bad Request 또는 422 validation error 반환 검증."""
    res = client.post("/api/expenses/bulk-delete", json={"ids": []})
    assert res.status_code in [400, 422]


def test_bulk_delete_invalid_payload(client):
    """유효하지 않은 요청 페이로드(예: 문자열) 전송 시 422 검증."""
    res = client.post("/api/expenses/bulk-delete", json={"ids": "not-a-list"})
    assert res.status_code == 422


def test_clear_expenses_by_year_month(client, sample_expenses, db_session):
    """기준 년월(year_month)에 속한 모든 거래를 일괄 삭제하는지 검증."""
    # 2026-08 거래는 4건, 2026-07 거래는 2건
    res = client.delete("/api/expenses/clear?year_month=2026-08")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["deleted_count"] == 4

    # 2026-08 거래는 0건, 2026-07 거래는 2건 유지
    assert db_session.query(Expense).filter(Expense.year_month == "2026-08").count() == 0
    assert db_session.query(Expense).filter(Expense.year_month == "2026-07").count() == 2


def test_clear_expenses_with_filters(client, sample_expenses, db_session):
    """year_month와 추가 필터(institution, payment_method_id, owner) 조합 삭제 검증."""
    pm_card = sample_expenses["pm_card"]

    # 2026-08 중 장준 현대카드 거래(2건)만 삭제
    res = client.delete(
        f"/api/expenses/clear?year_month=2026-08&payment_method_id={pm_card.id}&institution=현대카드&owner=장준"
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["deleted_count"] == 2

    # 2026-08의 현대카드 거래는 0건
    assert (
        db_session.query(Expense)
        .filter(Expense.year_month == "2026-08", Expense.institution == "현대카드")
        .count()
        == 0
    )
    # 2026-08의 다른 기관(카카오뱅크 1건, 신한은행 1건) 및 2026-07의 현대카드(2건)는 유지
    assert db_session.query(Expense).filter(Expense.year_month == "2026-08").count() == 2
    assert db_session.query(Expense).filter(Expense.year_month == "2026-07").count() == 2


def test_clear_expenses_missing_year_month_bad_request(client, sample_expenses, db_session):
    """year_month 누락 시 전체 DB 유실 방지를 위해 400 Bad Request 반환 및 삭제 방지 검증."""
    # 파라미터 미전달
    res = client.delete("/api/expenses/clear")
    assert res.status_code == 400

    # 빈 문자열 전달
    res_empty = client.delete("/api/expenses/clear?year_month=")
    assert res_empty.status_code == 400

    # 데이터 보존 확인
    assert db_session.query(Expense).count() == 6


def test_clear_expenses_invalid_year_month_format(client, sample_expenses, db_session):
    """year_month 형식이 잘못된 경우 400 Bad Request 반환 검증."""
    res_invalid = client.delete("/api/expenses/clear?year_month=202608")
    assert res_invalid.status_code == 400

    res_invalid_text = client.delete("/api/expenses/clear?year_month=invalid-date")
    assert res_invalid_text.status_code == 400

    assert db_session.query(Expense).count() == 6
