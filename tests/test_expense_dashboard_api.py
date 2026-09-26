# -*- coding: utf-8 -*-
"""지출 모니터링 대시보드 API (목록 조회, 통계 집계, 인라인 수정, 삭제) 테스트 모듈입니다."""

from datetime import datetime
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
def sample_data(db_session):
    """테스트용 결제수단, 카테고리, 지출 거래 데이터 생성 fixture."""
    # 결제수단 조회 또는 생성
    pm_hyundai = db_session.query(PaymentMethod).filter(PaymentMethod.institution == "현대카드", PaymentMethod.owner == "장준").first()
    if not pm_hyundai:
        pm_hyundai = PaymentMethod(owner="장준", institution="현대카드", alias="장준 현대카드", is_active=True)
        db_session.add(pm_hyundai)
        db_session.flush()

    pm_kakao = db_session.query(PaymentMethod).filter(PaymentMethod.institution == "카카오뱅크", PaymentMethod.owner == "장준").first()
    if not pm_kakao:
        pm_kakao = PaymentMethod(owner="장준", institution="카카오뱅크", alias="장준 카카오뱅크", is_active=True)
        db_session.add(pm_kakao)
        db_session.flush()

    pm_seongeun = db_session.query(PaymentMethod).filter(PaymentMethod.owner == "성은").first()
    if not pm_seongeun:
        pm_seongeun = PaymentMethod(owner="성은", institution="지역화폐", alias="성은 지역화폐", is_active=True)
        db_session.add(pm_seongeun)
        db_session.flush()

    # 카테고리 조회
    cat_food = db_session.query(ExpenseCategory).filter(ExpenseCategory.name == "식비/카페").first()
    cat_shopping = db_session.query(ExpenseCategory).filter(ExpenseCategory.name == "쇼핑").first()
    cat_living = db_session.query(ExpenseCategory).filter(ExpenseCategory.name == "생활/기타").first()

    # 2026-08월 지출 데이터 생성
    e1 = Expense(
        transaction_date=datetime(2026, 8, 15, 12, 30),
        year_month="2026-08",
        merchant="스타벅스 강남점",
        amount=10000.0,
        payment_method_id=pm_hyundai.id,
        owner="장준",
        institution="현대카드",
        category_id=cat_food.id if cat_food else None,
        is_excluded=False,
        memo="아이스 아메리카노",
    )
    e2 = Expense(
        transaction_date=datetime(2026, 8, 20, 18, 0),
        year_month="2026-08",
        merchant="쿠팡 로켓배송",
        amount=50000.0,
        payment_method_id=pm_hyundai.id,
        owner="장준",
        institution="현대카드",
        category_id=cat_shopping.id if cat_shopping else None,
        is_excluded=False,
        memo="생필품 구매",
    )
    e3 = Expense(
        transaction_date=datetime(2026, 8, 25, 9, 0),
        year_month="2026-08",
        merchant="현대카드 결제대금",
        amount=60000.0,
        payment_method_id=pm_kakao.id,
        owner="장준",
        institution="카카오뱅크",
        category_id=None,
        is_excluded=True,  # 통계 제외
        memo="카드대금 출금",
    )
    e4 = Expense(
        transaction_date=datetime(2026, 8, 10, 14, 0),
        year_month="2026-08",
        merchant="동네 마트",
        amount=40000.0,
        payment_method_id=pm_seongeun.id,
        owner="성은",
        institution="지역화폐",
        category_id=cat_food.id if cat_food else None,
        is_excluded=False,
        memo="장보기",
    )

    # 2026-07월 (전월) 데이터
    e_prev = Expense(
        transaction_date=datetime(2026, 7, 15, 12, 0),
        year_month="2026-07",
        merchant="식당",
        amount=80000.0,
        payment_method_id=pm_hyundai.id,
        owner="장준",
        institution="현대카드",
        category_id=cat_food.id if cat_food else None,
        is_excluded=False,
    )

    # 2026-06월 (전전월) 데이터
    e_prev2 = Expense(
        transaction_date=datetime(2026, 6, 10, 10, 0),
        year_month="2026-06",
        merchant="마트",
        amount=70000.0,
        payment_method_id=pm_hyundai.id,
        owner="장준",
        institution="현대카드",
        category_id=cat_living.id if cat_living else None,
        is_excluded=False,
    )

    db_session.add_all([e1, e2, e3, e4, e_prev, e_prev2])
    db_session.commit()
    db_session.refresh(e1)
    db_session.refresh(e2)
    db_session.refresh(e3)
    db_session.refresh(e4)

    return {
        "pm_hyundai": pm_hyundai,
        "pm_kakao": pm_kakao,
        "pm_seongeun": pm_seongeun,
        "cat_food": cat_food,
        "cat_shopping": cat_shopping,
        "expenses": [e1, e2, e3, e4, e_prev, e_prev2],
    }


def test_get_expenses_list_and_filters(client, sample_data):
    """지출 거래 목록 조회 및 다양한 필터 동작을 검증합니다."""
    # 1. 필터 없이 전체 조회 (총 6건)
    res = client.get("/api/expenses")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 6
    # 응답에 카테고리명과 결제수단 별칭이 포함되어야 함
    first = data[0]
    assert "category_name" in first
    assert "payment_method_alias" in first

    # 2. year_month 필터 ('2026-08' -> 4건)
    res = client.get("/api/expenses?year_month=2026-08")
    assert res.status_code == 200
    assert len(res.json()) == 4

    # 3. owner 필터 ('장준' -> 5건, '성은' -> 1건)
    res_jj = client.get("/api/expenses?owner=장준")
    assert res_jj.status_code == 200
    assert len(res_jj.json()) == 5

    res_se = client.get("/api/expenses?owner=성은")
    assert res_se.status_code == 200
    assert len(res_se.json()) == 1
    assert res_se.json()[0]["merchant"] == "동네 마트"

    # 4. category_id 필터
    cat_food_id = sample_data["cat_food"].id
    res_cat = client.get(f"/api/expenses?category_id={cat_food_id}")
    assert res_cat.status_code == 200
    for it in res_cat.json():
        assert it["category_id"] == cat_food_id

    # 5. institution 필터
    res_inst = client.get("/api/expenses?institution=카카오뱅크")
    assert res_inst.status_code == 200
    assert len(res_inst.json()) == 1
    assert res_inst.json()[0]["institution"] == "카카오뱅크"

    # 6. is_excluded 필터
    res_excl = client.get("/api/expenses?is_excluded=true")
    assert res_excl.status_code == 200
    assert len(res_excl.json()) == 1
    assert res_excl.json()[0]["is_excluded"] is True

    # 7. search 필터 (가맹점명 또는 메모)
    res_search = client.get("/api/expenses?search=스타벅스")
    assert res_search.status_code == 200
    assert len(res_search.json()) == 1
    assert "스타벅스" in res_search.json()[0]["merchant"]

    res_search_memo = client.get("/api/expenses?search=생필품")
    assert res_search_memo.status_code == 200
    assert len(res_search_memo.json()) == 1


def test_get_expense_stats_calculation(client, sample_data):
    """지출 대시보드 통계 집계(당월 총액, MoM, 카테고리/결제수단 비중, 월별 추이)를 검증합니다."""
    # 2026-08 전체 통계
    res = client.get("/api/expenses/stats?year_month=2026-08")
    assert res.status_code == 200
    stats = res.json()

    assert stats["year_month"] == "2026-08"
    # 당월 유효 지출: 스타벅스(10,000) + 쿠팡(50,000) + 동네마트(40,000) = 100,000 (카드대금 60,000은 제외)
    assert stats["current_total"] == 100000.0
    # 전월 유효 지출: 2026-07 식당(80,000)
    assert stats["prev_total"] == 80000.0
    # MoM 증감액: 100,000 - 80,000 = +20,000
    assert stats["mom_change_amount"] == 20000.0
    # MoM 증감율: (20,000 / 80,000) * 100 = 25.0%
    assert stats["mom_change_rate"] == 25.0
    # 통계 제외 총액: 카드대금 60,000
    assert stats["excluded_total"] == 60000.0

    # 카테고리별 비중 검증
    # 식비/카페: 10,000 + 40,000 = 50,000 (50.0%)
    # 쇼핑: 50,000 (50.0%)
    cat_breakdown = stats["category_breakdown"]
    assert len(cat_breakdown) == 2
    cat_names = [c["category_name"] for c in cat_breakdown]
    assert "식비/카페" in cat_names
    assert "쇼핑" in cat_names

    # 결제수단별 비중 검증
    # 장준 현대카드: 60,000 (60.0%)
    # 성은 지역화폐: 40,000 (40.0%)
    pm_breakdown = stats["payment_method_breakdown"]
    assert len(pm_breakdown) == 2

    # 월별 추이(monthly_trends)에 2026-08(100,000), 2026-07(80,000), 2026-06(70,000) 포함 확인
    trends = {t["year_month"]: t["total_amount"] for t in stats["monthly_trends"]}
    assert trends.get("2026-08") == 100000.0
    assert trends.get("2026-07") == 80000.0
    assert trends.get("2026-06") == 70000.0

    # 2차 카테고리 폐지에 따라 sub_category_breakdown 필드는 완전히 제거되어야 함
    assert "sub_category_breakdown" not in stats


def test_get_expense_stats_includes_subscription_and_club_dues(client, db_session, sample_data):
    """구독료 및 모임회비 단일 카테고리가 stats의 category_breakdown에 정상 집계되는지 검증합니다."""
    cat_sub = db_session.query(ExpenseCategory).filter(ExpenseCategory.name == "구독료").first()
    cat_dues = db_session.query(ExpenseCategory).filter(ExpenseCategory.name == "모임회비").first()
    pm_hyundai = sample_data["pm_hyundai"]

    e_sub = Expense(
        transaction_date=datetime(2026, 8, 5, 10, 0),
        year_month="2026-08",
        merchant="넷플릭스 정기구독",
        amount=17000.0,
        payment_method_id=pm_hyundai.id,
        owner="장준",
        institution="현대카드",
        category_id=cat_sub.id if cat_sub else None,
        is_excluded=False,
    )
    e_dues = Expense(
        transaction_date=datetime(2026, 8, 12, 19, 0),
        year_month="2026-08",
        merchant="동창회 모임회비",
        amount=30000.0,
        payment_method_id=pm_hyundai.id,
        owner="장준",
        institution="현대카드",
        category_id=cat_dues.id if cat_dues else None,
        is_excluded=False,
    )
    db_session.add_all([e_sub, e_dues])
    db_session.commit()

    res = client.get("/api/expenses/stats?year_month=2026-08")
    assert res.status_code == 200
    stats = res.json()

    cat_breakdown = {c["category_name"]: c["amount"] for c in stats["category_breakdown"]}
    assert "구독료" in cat_breakdown
    assert cat_breakdown["구독료"] == 17000.0
    assert "모임회비" in cat_breakdown
    assert cat_breakdown["모임회비"] == 30000.0


def test_get_expense_stats_owner_filtering(client, sample_data):
    """소유주별 탭 필터링 시 통계가 해당 소유주 데이터만으로 정확히 집계되는지 검증합니다."""
    # 장준 통계
    res_jj = client.get("/api/expenses/stats?year_month=2026-08&owner=장준")
    assert res_jj.status_code == 200
    stats_jj = res_jj.json()
    # 장준 당월 유효 지출: 스타벅스(10,000) + 쿠팡(50,000) = 60,000 (동네마트 성은 40,000 제외)
    assert stats_jj["current_total"] == 60000.0
    assert stats_jj["prev_total"] == 80000.0
    assert stats_jj["mom_change_amount"] == -20000.0
    assert stats_jj["mom_change_rate"] == -25.0
    assert stats_jj["excluded_total"] == 60000.0

    # 성은 통계
    res_se = client.get("/api/expenses/stats?year_month=2026-08&owner=성은")
    assert res_se.status_code == 200
    stats_se = res_se.json()
    # 성은 당월 지출: 동네마트(40,000)
    assert stats_se["current_total"] == 40000.0
    assert stats_se["prev_total"] == 0.0
    assert stats_se["mom_change_amount"] == 40000.0
    assert stats_se["mom_change_rate"] == 0.0  # 전월 0일 경우


def test_patch_expense_inline_update(client, sample_data):
    """단일 거래의 카테고리, 통계제외 여부, 메모 인라인 수정 동작을 검증합니다."""
    e1 = sample_data["expenses"][0]  # 스타벅스 10,000 (is_excluded=False)
    cat_shopping = sample_data["cat_shopping"]

    # 1. 카테고리 및 통계 제외 여부 수정
    patch_payload = {
        "category_id": cat_shopping.id,
        "is_excluded": True,
        "memo": "지인 선물용 상품권 구매",
    }
    res = client.patch(f"/api/expenses/{e1.id}", json=patch_payload)
    assert res.status_code == 200
    updated = res.json()
    assert updated["category_id"] == cat_shopping.id
    assert updated["category_name"] == cat_shopping.name
    assert updated["is_excluded"] is True
    assert updated["memo"] == "지인 선물용 상품권 구매"

    # 2. 통계 지표에 즉시 반영되었는지 확인 (e1이 제외되었으므로 당월 총지출이 100,000에서 90,000으로 감소해야 함)
    stats_res = client.get("/api/expenses/stats?year_month=2026-08")
    assert stats_res.status_code == 200
    assert stats_res.json()["current_total"] == 90000.0
    assert stats_res.json()["excluded_total"] == 70000.0

    # 3. 존재하지 않는 ID 수정 시 404
    res_404 = client.patch("/api/expenses/999999", json={"memo": "없는 거래"})
    assert res_404.status_code == 404


def test_delete_expense(client, sample_data):
    """단일 지출 거래 삭제 API 동작을 검증합니다."""
    e2 = sample_data["expenses"][1]  # 쿠팡 50,000원

    # 1. 삭제 요청 (204 No Content)
    res = client.delete(f"/api/expenses/{e2.id}")
    assert res.status_code == 204

    # 2. 목록 조회 시 e2가 없어야 함
    list_res = client.get(f"/api/expenses?year_month=2026-08")
    ids = [it["id"] for it in list_res.json()]
    assert e2.id not in ids

    # 3. 통계에 반영되었는지 확인 (쿠팡 50,000원 삭제 -> 100,000에서 50,000으로 감소)
    stats_res = client.get("/api/expenses/stats?year_month=2026-08")
    assert stats_res.json()["current_total"] == 50000.0

    # 4. 존재하지 않는 거래 삭제 시 404 반환
    res_404 = client.delete("/api/expenses/999999")
    assert res_404.status_code == 404
