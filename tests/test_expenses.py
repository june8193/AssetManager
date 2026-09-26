# -*- coding: utf-8 -*-
"""다기간 지출 통계 및 거래 내역 페이징 API 테스트 모듈입니다."""

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
        ExpenseCategory(name="생활/기타", color="#95A5A6", is_default=True),
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
def multi_period_data(db_session):
    """다기간 통계 및 페이징 검증을 위한 다중 월 데이터 생성."""
    pm_card = PaymentMethod(owner="장준", institution="현대카드", alias="장준 현대카드", is_active=True)
    pm_bank = PaymentMethod(owner="장준", institution="카카오뱅크", alias="장준 카카오뱅크", is_active=True)
    pm_se = PaymentMethod(owner="성은", institution="지역화폐", alias="성은 지역화폐", is_active=True)
    db_session.add_all([pm_card, pm_bank, pm_se])
    db_session.commit()

    cat_food = db_session.query(ExpenseCategory).filter_by(name="식비/카페").first()
    cat_shop = db_session.query(ExpenseCategory).filter_by(name="쇼핑").first()
    cat_living = db_session.query(ExpenseCategory).filter_by(name="생활/기타").first()

    # 데이터 구성:
    # 2026-08 (당월): 식비 100,000, 쇼핑 50,000, 카드대금(제외) 80,000 => 유효 150,000
    # 2026-07 (직전1): 식비 80,000, 쇼핑 40,000 => 유효 120,000
    # 2026-06 (직전2): 생활 90,000 => 유효 90,000
    # -> 최근 3개월 (2026-06 ~ 2026-08): 총 360,000원, 월평균 120,000원, 3개월간
    # 2026-05 (직전동기간1): 식비 70,000
    # 2026-04 (직전동기간2): 식비 60,000
    # 2026-03 (직전동기간3): 식비 50,000
    # -> 직전 동기간 (2026-03 ~ 2026-05): 총 180,000원
    # 증감: +180,000원 (+100.0%)
    expenses = [
        # 2026-08
        Expense(transaction_date=datetime(2026, 8, 20, 12, 0), year_month="2026-08", merchant="식당A", amount=100000.0, payment_method_id=pm_card.id, owner="장준", institution="현대카드", category_id=cat_food.id, is_excluded=False),
        Expense(transaction_date=datetime(2026, 8, 15, 15, 0), year_month="2026-08", merchant="쇼핑몰B", amount=50000.0, payment_method_id=pm_card.id, owner="장준", institution="현대카드", category_id=cat_shop.id, is_excluded=False),
        Expense(transaction_date=datetime(2026, 8, 25, 9, 0), year_month="2026-08", merchant="카드대금출금", amount=80000.0, payment_method_id=pm_bank.id, owner="장준", institution="카카오뱅크", category_id=None, is_excluded=True),
        # 2026-07
        Expense(transaction_date=datetime(2026, 7, 10, 12, 0), year_month="2026-07", merchant="식당C", amount=80000.0, payment_method_id=pm_card.id, owner="장준", institution="현대카드", category_id=cat_food.id, is_excluded=False),
        Expense(transaction_date=datetime(2026, 7, 18, 14, 0), year_month="2026-07", merchant="쇼핑몰D", amount=40000.0, payment_method_id=pm_card.id, owner="장준", institution="현대카드", category_id=cat_shop.id, is_excluded=False),
        # 2026-06
        Expense(transaction_date=datetime(2026, 6, 5, 11, 0), year_month="2026-06", merchant="생활용품E", amount=90000.0, payment_method_id=pm_se.id, owner="성은", institution="지역화폐", category_id=cat_living.id, is_excluded=False),
        # 2026-05
        Expense(transaction_date=datetime(2026, 5, 1, 12, 0), year_month="2026-05", merchant="식당F", amount=70000.0, payment_method_id=pm_card.id, owner="장준", institution="현대카드", category_id=cat_food.id, is_excluded=False),
        # 2026-04
        Expense(transaction_date=datetime(2026, 4, 1, 12, 0), year_month="2026-04", merchant="식당G", amount=60000.0, payment_method_id=pm_card.id, owner="장준", institution="현대카드", category_id=cat_food.id, is_excluded=False),
        # 2026-03
        Expense(transaction_date=datetime(2026, 3, 1, 12, 0), year_month="2026-03", merchant="식당H", amount=50000.0, payment_method_id=pm_card.id, owner="장준", institution="현대카드", category_id=cat_food.id, is_excluded=False),
    ]
    db_session.add_all(expenses)
    db_session.commit()
    return {
        "pm_card": pm_card,
        "pm_bank": pm_bank,
        "pm_se": pm_se,
        "cat_food": cat_food,
        "cat_shop": cat_shop,
        "cat_living": cat_living,
        "expenses": expenses,
    }


def test_multi_period_stats_calculation(client, multi_period_data):
    """start_month와 end_month를 사용한 다기간 지출 통계 집계 검증."""
    # 2026-06 ~ 2026-08 (3개월) 조회
    res = client.get("/api/expenses/stats?start_month=2026-06&end_month=2026-08")
    assert res.status_code == 200
    data = res.json()

    assert data["start_month"] == "2026-06"
    assert data["end_month"] == "2026-08"
    assert data["period_months"] == 3
    # 총 유효 지출: 150,000(8월) + 120,000(7월) + 90,000(6월) = 360,000
    assert data["period_total"] == 360000.0
    # 월평균 지출: 360,000 / 3 = 120,000
    assert data["monthly_average"] == 120000.0
    # 통계 제외 합계: 80,000 (8월 카드대금)
    assert data["excluded_total"] == 80000.0

    # 직전 동기간 (2026-03 ~ 2026-05) 총액: 70,000 + 60,000 + 50,000 = 180,000
    assert data["prev_period_total"] == 180000.0
    # 증감액: 360,000 - 180,000 = +180,000
    assert data["prev_period_change_amount"] == 180000.0
    # 증감률: (180,000 / 180,000) * 100 = 100.0%
    assert data["prev_period_change_rate"] == 100.0

    # 기간 내 모든 월의 monthly_trends (2026-06, 2026-07, 2026-08 순서)
    trends = data["monthly_trends"]
    assert len(trends) == 3
    assert [t["year_month"] for t in trends] == ["2026-06", "2026-07", "2026-08"]
    assert [t["total_amount"] for t in trends] == [90000.0, 120000.0, 150000.0]

    # 누적 카테고리 비중 (3개월 합산 360,000 기준)
    # 식비: 100,000 + 80,000 = 180,000 (50.0%)
    # 쇼핑: 50,000 + 40,000 = 90,000 (25.0%)
    # 생활/기타: 90,000 (25.0%)
    cat_map = {c["category_name"]: c for c in data["category_breakdown"]}
    assert cat_map["식비/카페"]["amount"] == 180000.0
    assert cat_map["식비/카페"]["percentage"] == 50.0
    assert cat_map["쇼핑"]["amount"] == 90000.0
    assert cat_map["쇼핑"]["percentage"] == 25.0
    assert cat_map["생활/기타"]["amount"] == 90000.0
    assert cat_map["생활/기타"]["percentage"] == 25.0


def test_stats_legacy_year_month_backward_compatibility(client, multi_period_data):
    """기존 year_month 파라미터만 전달했을 때 하위 호환성 유지 검증."""
    res = client.get("/api/expenses/stats?year_month=2026-08")
    assert res.status_code == 200
    data = res.json()

    assert data["year_month"] == "2026-08"
    assert data["start_month"] == "2026-08"
    assert data["end_month"] == "2026-08"
    assert data["period_months"] == 1
    assert data["period_total"] == 150000.0
    assert data["current_total"] == 150000.0
    assert data["monthly_average"] == 150000.0
    assert data["prev_total"] == 120000.0
    assert data["prev_period_total"] == 120000.0
    assert data["mom_change_amount"] == 30000.0
    assert data["prev_period_change_amount"] == 30000.0
    assert data["mom_change_rate"] == 25.0
    assert data["prev_period_change_rate"] == 25.0


def test_expenses_period_and_pagination(client, multi_period_data):
    """GET /api/expenses 엔드포인트의 start_month, end_month 기간 필터링 및 limit/offset 페이징 검증."""
    # 1. 2026-06 ~ 2026-08 기간 조회 (총 6건: 8월 3건, 7월 2건, 6월 1건)
    res = client.get("/api/expenses?start_month=2026-06&end_month=2026-08")
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 6

    # 최신순 정렬 확인 (transaction_date desc)
    dates = [it["transaction_date"] for it in items]
    assert dates == sorted(dates, reverse=True)

    # 2. limit=2, offset=0 페이징 (첫 페이지 2건)
    res_p1 = client.get("/api/expenses?start_month=2026-06&end_month=2026-08&limit=2&offset=0")
    assert res_p1.status_code == 200
    p1_items = res_p1.json()
    assert len(p1_items) == 2
    assert p1_items[0]["id"] == items[0]["id"]
    assert p1_items[1]["id"] == items[1]["id"]

    # 3. limit=2, offset=2 페이징 (두 번째 페이지 2건)
    res_p2 = client.get("/api/expenses?start_month=2026-06&end_month=2026-08&limit=2&offset=2")
    assert res_p2.status_code == 200
    p2_items = res_p2.json()
    assert len(p2_items) == 2
    assert p2_items[0]["id"] == items[2]["id"]
    assert p2_items[1]["id"] == items[3]["id"]
