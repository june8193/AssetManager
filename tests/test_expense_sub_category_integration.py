# -*- coding: utf-8 -*-
"""지출 2차 카테고리 연동(원장 저장, 인라인 수정, 필터링, 통계 집계) TDD 테스트 모듈입니다."""

import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.backend.database import Base, get_db
from src.backend.main import app
from src.backend.models import PaymentMethod, ExpenseCategory, ExpenseSubCategory, Expense
from src.backend.schemas.expense import (
    ExpenseBase,
    ExpenseCreate,
    ExpenseUpdate,
    ExpenseResponse,
    ExpenseCommitItem,
    ExpenseUploadPreviewTransaction,
    ExpenseStatsResponse,
)


@pytest.fixture(name="session")
def session_fixture():
    """격리된 인메모리 SQLite DB 세션을 제공합니다."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(name="client")
def client_fixture(session):
    """테스트용 FastAPI 클라이언트를 제공합니다."""
    def override_get_db():
        try:
            yield session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(name="seed_data")
def seed_data_fixture(session):
    """기본 결제수단 및 카테고리/2차 카테고리 시드 데이터를 생성합니다."""
    pm = PaymentMethod(
        owner="장준",
        institution="현대카드",
        alias="장준 현대카드",
        account_number="1002",
        is_active=True,
    )
    cat1 = ExpenseCategory(name="식비/카페", color="#FF6B6B", is_default=True)
    cat2 = ExpenseCategory(name="문화/여가", color="#98D8C8", is_default=True)
    sub1 = ExpenseSubCategory(name="구독료", color="#8B5CF6", is_default=True)
    sub2 = ExpenseSubCategory(name="모임회비", color="#EC4899", is_default=True)

    session.add_all([pm, cat1, cat2, sub1, sub2])
    session.commit()
    session.refresh(pm)
    session.refresh(cat1)
    session.refresh(cat2)
    session.refresh(sub1)
    session.refresh(sub2)

    return {
        "payment_method": pm,
        "category_food": cat1,
        "category_culture": cat2,
        "sub_category_sub": sub1,
        "sub_category_dues": sub2,
    }


def test_expense_schema_definitions():
    """Expense 관련 스키마에 sub_category_id 및 sub_category 관련 필드가 정의되어 있는지 검증합니다."""
    # ExpenseBase / ExpenseCreate
    base_inst = ExpenseBase(
        transaction_date=datetime.now(),
        year_month="2026-08",
        merchant="넷플릭스",
        amount=17000.0,
        owner="장준",
        institution="현대카드",
        sub_category_id=1,
    )
    assert base_inst.sub_category_id == 1

    # ExpenseUpdate
    update_inst = ExpenseUpdate(sub_category_id=2)
    assert update_inst.sub_category_id == 2

    # ExpenseCommitItem
    commit_item = ExpenseCommitItem(
        transaction_date="2026-08-15",
        merchant="넷플릭스",
        amount=17000.0,
        sub_category_id=1,
    )
    assert commit_item.sub_category_id == 1

    # ExpenseUploadPreviewTransaction
    preview_tx = ExpenseUploadPreviewTransaction(
        transaction_date="2026-08-15",
        year_month="2026-08",
        merchant="넷플릭스",
        amount=17000.0,
        sub_category_id=1,
    )
    assert preview_tx.sub_category_id == 1

    # ExpenseStatsResponse has sub_category_breakdown
    assert "sub_category_breakdown" in ExpenseStatsResponse.model_fields


def test_commit_and_get_expenses_with_sub_category(client, seed_data):
    """지출 커밋 시 2차 카테고리가 저장되고 조회 시 정상 반환되는지 검증합니다."""
    pm = seed_data["payment_method"]
    cat = seed_data["category_culture"]
    sub = seed_data["sub_category_sub"]

    payload = {
        "payment_method_id": pm.id,
        "year_month": "2026-08",
        "source_file": "test.html",
        "items": [
            {
                "transaction_date": "2026-08-10 14:00:00",
                "year_month": "2026-08",
                "merchant": "넷플릭스",
                "amount": 17000.0,
                "category_id": cat.id,
                "sub_category_id": sub.id,
                "memo": "월 정기구독",
                "is_excluded": False,
            },
            {
                "transaction_date": "2026-08-12 18:00:00",
                "year_month": "2026-08",
                "merchant": "일반식당",
                "amount": 35000.0,
                "category_id": seed_data["category_food"].id,
                "sub_category_id": None,
                "memo": "",
                "is_excluded": False,
            },
        ],
    }

    # 커밋 실행
    res = client.post("/api/expenses/commit", json=payload)
    assert res.status_code == 200
    assert res.json()["count"] == 2

    # 조회 실행
    get_res = client.get("/api/expenses?year_month=2026-08")
    assert get_res.status_code == 200
    data = get_res.json()
    assert len(data) == 2

    netflix_item = next(item for item in data if item["merchant"] == "넷플릭스")
    assert netflix_item["sub_category_id"] == sub.id
    assert netflix_item["sub_category"] is not None
    assert netflix_item["sub_category"]["name"] == "구독료"
    assert netflix_item["sub_category"]["color"] == "#8B5CF6"

    food_item = next(item for item in data if item["merchant"] == "일반식당")
    assert food_item["sub_category_id"] is None
    assert food_item["sub_category"] is None


def test_filter_expenses_by_sub_category_id(client, seed_data):
    """sub_category_id 쿼리 파라미터로 지출 거래 목록이 필터링되는지 검증합니다."""
    pm = seed_data["payment_method"]
    sub1 = seed_data["sub_category_sub"]
    sub2 = seed_data["sub_category_dues"]

    payload = {
        "payment_method_id": pm.id,
        "year_month": "2026-08",
        "items": [
            {
                "transaction_date": "2026-08-01",
                "merchant": "넷플릭스",
                "amount": 17000.0,
                "sub_category_id": sub1.id,
            },
            {
                "transaction_date": "2026-08-05",
                "merchant": "등산모임",
                "amount": 20000.0,
                "sub_category_id": sub2.id,
            },
            {
                "transaction_date": "2026-08-08",
                "merchant": "서점",
                "amount": 15000.0,
                "sub_category_id": None,
            },
        ],
    }
    client.post("/api/expenses/commit", json=payload)

    # sub1 필터링
    res_sub1 = client.get(f"/api/expenses?year_month=2026-08&sub_category_id={sub1.id}")
    assert res_sub1.status_code == 200
    items1 = res_sub1.json()
    assert len(items1) == 1
    assert items1[0]["merchant"] == "넷플릭스"

    # sub2 필터링
    res_sub2 = client.get(f"/api/expenses?year_month=2026-08&sub_category_id={sub2.id}")
    assert res_sub2.status_code == 200
    items2 = res_sub2.json()
    assert len(items2) == 1
    assert items2[0]["merchant"] == "등산모임"


def test_update_expense_sub_category_inline(client, seed_data):
    """PUT 및 PATCH로 sub_category_id를 인라인 수정 및 해제할 수 있는지 검증합니다."""
    pm = seed_data["payment_method"]
    sub1 = seed_data["sub_category_sub"]
    sub2 = seed_data["sub_category_dues"]

    # 1건 생성
    payload = {
        "payment_method_id": pm.id,
        "year_month": "2026-08",
        "items": [
            {
                "transaction_date": "2026-08-01",
                "merchant": "테스트가맹점",
                "amount": 10000.0,
                "sub_category_id": sub1.id,
            }
        ],
    }
    client.post("/api/expenses/commit", json=payload)
    item = client.get("/api/expenses?year_month=2026-08").json()[0]
    expense_id = item["id"]
    assert item["sub_category_id"] == sub1.id

    # 1. PUT을 사용하여 sub2로 변경
    put_res = client.put(f"/api/expenses/{expense_id}", json={"sub_category_id": sub2.id})
    assert put_res.status_code == 200
    updated_data = put_res.json()
    assert updated_data["sub_category_id"] == sub2.id
    assert updated_data["sub_category"]["name"] == "모임회비"

    # 2. PATCH를 사용하여 None으로 해제
    patch_res = client.patch(f"/api/expenses/{expense_id}", json={"sub_category_id": None})
    assert patch_res.status_code == 200
    cleared_data = patch_res.json()
    assert cleared_data["sub_category_id"] is None
    assert cleared_data["sub_category"] is None


def test_expense_stats_includes_sub_category_breakdown(client, seed_data):
    """GET /api/expenses/stats 및 /api/expenses/summary에서 2차 카테고리 집계가 올바르게 반환되는지 검증합니다."""
    pm = seed_data["payment_method"]
    sub1 = seed_data["sub_category_sub"]
    sub2 = seed_data["sub_category_dues"]

    payload = {
        "payment_method_id": pm.id,
        "year_month": "2026-08",
        "items": [
            {
                "transaction_date": "2026-08-01",
                "merchant": "넷플릭스",
                "amount": 17000.0,
                "sub_category_id": sub1.id,
                "is_excluded": False,
            },
            {
                "transaction_date": "2026-08-02",
                "merchant": "유튜브 프리미엄",
                "amount": 14900.0,
                "sub_category_id": sub1.id,
                "is_excluded": False,
            },
            {
                "transaction_date": "2026-08-10",
                "merchant": "동창회 회비",
                "amount": 30000.0,
                "sub_category_id": sub2.id,
                "is_excluded": False,
            },
            {
                "transaction_date": "2026-08-15",
                "merchant": "통계제외 정기결제",
                "amount": 50000.0,
                "sub_category_id": sub1.id,
                "is_excluded": True,  # 제외 거래는 통계 집계에서 배제되어야 함
            },
        ],
    }
    client.post("/api/expenses/commit", json=payload)

    # stats 엔드포인트 확인
    stats_res = client.get("/api/expenses/stats?year_month=2026-08")
    assert stats_res.status_code == 200
    stats = stats_res.json()

    assert "sub_category_breakdown" in stats
    breakdown = stats["sub_category_breakdown"]
    assert len(breakdown) == 2

    # 금액 내림차순 또는 각 항목 확인
    sub1_stat = next(b for b in breakdown if b["id"] == sub1.id or b.get("sub_category_id") == sub1.id)
    assert sub1_stat["name"] == "구독료"
    assert sub1_stat["total_amount"] == 31900.0  # 17000 + 14900 (제외건 50000 제외)
    assert sub1_stat["count"] == 2
    assert sub1_stat["color"] == "#8B5CF6"

    sub2_stat = next(b for b in breakdown if b["id"] == sub2.id or b.get("sub_category_id") == sub2.id)
    assert sub2_stat["name"] == "모임회비"
    assert sub2_stat["total_amount"] == 30000.0
    assert sub2_stat["count"] == 1

    # summary 별칭 엔드포인트 확인
    summary_res = client.get("/api/expenses/summary?year_month=2026-08")
    assert summary_res.status_code == 200
    assert summary_res.json()["current_total"] == stats["current_total"]
