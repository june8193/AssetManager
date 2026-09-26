# -*- coding: utf-8 -*-
"""지출 자동분류 규칙(ExpenseRule) 데이터 모델 및 CRUD API 테스트 모듈입니다."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.backend.main import app
from src.backend.database import Base, get_db
from src.backend.models import ExpenseCategory, ExpenseRule


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


def test_create_category_rule_success(client, db_session):
    """카테고리 자동분류 규칙 생성 및 키워드 공백 trim 테스트."""
    cat = db_session.query(ExpenseCategory).filter_by(name="식비/카페").first()

    payload = {
        "keyword": "  스타벅스  ",
        "category_id": cat.id,
        "is_excluded": False,
    }
    response = client.post("/api/expenses/rules", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["id"] is not None
    assert data["keyword"] == "스타벅스"  # trim 확인
    assert data["category_id"] == cat.id
    assert data["category_name"] == "식비/카페"
    assert data["category_color"] == "#FF6B6B"
    assert data["is_excluded"] is False
    assert "created_at" in data


def test_create_excluded_rule_success(client, db_session):
    """통계 제외 전용 규칙 생성 테스트 (카테고리 없음 또는 None 처리)."""
    payload = {
        "keyword": "카드대금",
        "category_id": None,
        "is_excluded": True,
    }
    response = client.post("/api/expenses/rules", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["keyword"] == "카드대금"
    assert data["category_id"] is None
    assert data["category_name"] is None
    assert data["is_excluded"] is True

    # is_excluded=True인데 category_id를 전달해도 강제로 None 처리되어야 함
    cat = db_session.query(ExpenseCategory).filter_by(name="쇼핑").first()
    payload2 = {
        "keyword": "선결제",
        "category_id": cat.id,
        "is_excluded": True,
    }
    response2 = client.post("/api/expenses/rules", json=payload2)
    assert response2.status_code == 201
    data2 = response2.json()
    assert data2["keyword"] == "선결제"
    assert data2["category_id"] is None
    assert data2["is_excluded"] is True


def test_create_rule_validation_error(client, db_session):
    """규칙 생성 시 유효성 검증 실패 테스트."""
    # 1. is_excluded=False 인데 category_id 누락
    payload = {
        "keyword": "배달의민족",
        "category_id": None,
        "is_excluded": False,
    }
    response = client.post("/api/expenses/rules", json=payload)
    assert response.status_code in [400, 422]

    # 2. 빈 문자열 또는 공백만 있는 키워드
    cat = db_session.query(ExpenseCategory).filter_by(name="식비/카페").first()
    payload_empty = {
        "keyword": "   ",
        "category_id": cat.id,
        "is_excluded": False,
    }
    response_empty = client.post("/api/expenses/rules", json=payload_empty)
    assert response_empty.status_code in [400, 422]


def test_create_duplicate_keyword_rule(client, db_session):
    """중복 키워드 규칙 등록 차단 테스트 (400 또는 409)."""
    cat = db_session.query(ExpenseCategory).filter_by(name="식비/카페").first()

    payload = {
        "keyword": "쿠팡",
        "category_id": cat.id,
        "is_excluded": False,
    }
    res1 = client.post("/api/expenses/rules", json=payload)
    assert res1.status_code == 201

    # 동일 키워드 재등록 시도
    res2 = client.post("/api/expenses/rules", json=payload)
    assert res2.status_code in [400, 409]

    # 공백 포함 동일 키워드 재등록 시도
    payload_trimmed = {
        "keyword": " 쿠팡 ",
        "category_id": cat.id,
        "is_excluded": False,
    }
    res3 = client.post("/api/expenses/rules", json=payload_trimmed)
    assert res3.status_code in [400, 409]


def test_get_rules_sorting(client, db_session):
    """규칙 목록 조회 및 정렬(길이 내림차순, 최신순) 테스트."""
    cat_food = db_session.query(ExpenseCategory).filter_by(name="식비/카페").first()
    cat_shop = db_session.query(ExpenseCategory).filter_by(name="쇼핑").first()

    # 등록 순서:
    # 1. '쿠팡' (길이 2)
    # 2. '쿠팡이츠' (길이 4)
    # 3. '스타벅스' (길이 4)
    # 4. 'GS25' (길이 4)
    client.post("/api/expenses/rules", json={"keyword": "쿠팡", "category_id": cat_shop.id, "is_excluded": False})
    client.post("/api/expenses/rules", json={"keyword": "쿠팡이츠", "category_id": cat_food.id, "is_excluded": False})
    client.post("/api/expenses/rules", json={"keyword": "스타벅스", "category_id": cat_food.id, "is_excluded": False})
    client.post("/api/expenses/rules", json={"keyword": "GS25", "category_id": cat_food.id, "is_excluded": False})

    response = client.get("/api/expenses/rules")
    assert response.status_code == 200
    items = response.json()
    assert len(items) == 4

    keywords = [item["keyword"] for item in items]
    # 길이가 4인 것들이 먼저 오고, 길이가 2인 '쿠팡'이 마지막에 와야 함
    assert keywords[-1] == "쿠팡"
    # 길이가 4인 것들 중 최신 등록순: GS25, 스타벅스, 쿠팡이츠
    assert keywords[:3] == ["GS25", "스타벅스", "쿠팡이츠"]


def test_update_rule(client, db_session):
    """규칙 수정 API 테스트."""
    cat_food = db_session.query(ExpenseCategory).filter_by(name="식비/카페").first()
    cat_shop = db_session.query(ExpenseCategory).filter_by(name="쇼핑").first()

    res = client.post("/api/expenses/rules", json={"keyword": "쿠팡", "category_id": cat_shop.id, "is_excluded": False})
    rule_id = res.json()["id"]

    # 카테고리 및 키워드 변경
    update_payload = {
        "keyword": " 쿠팡마켓 ",
        "category_id": cat_food.id,
        "is_excluded": False,
    }
    update_res = client.put(f"/api/expenses/rules/{rule_id}", json=update_payload)
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["keyword"] == "쿠팡마켓"
    assert updated["category_id"] == cat_food.id
    assert updated["category_name"] == "식비/카페"

    # 통계 제외로 변경
    update_to_excluded = {
        "keyword": "쿠팡마켓",
        "category_id": cat_food.id,  # 제외로 변경 시 None으로 정리되어야 함
        "is_excluded": True,
    }
    update_res2 = client.put(f"/api/expenses/rules/{rule_id}", json=update_to_excluded)
    assert update_res2.status_code == 200
    updated2 = update_res2.json()
    assert updated2["is_excluded"] is True
    assert updated2["category_id"] is None
    assert updated2["category_name"] is None

    # 존재하지 않는 ID 수정 시 404
    not_found_res = client.put("/api/expenses/rules/9999", json=update_payload)
    assert not_found_res.status_code == 404


def test_delete_rule(client, db_session):
    """규칙 삭제 API 테스트."""
    cat = db_session.query(ExpenseCategory).filter_by(name="식비/카페").first()
    res = client.post("/api/expenses/rules", json={"keyword": "배민", "category_id": cat.id, "is_excluded": False})
    rule_id = res.json()["id"]

    # 삭제
    del_res = client.delete(f"/api/expenses/rules/{rule_id}")
    assert del_res.status_code in [200, 204]

    # 목록 조회 시 없어야 함
    get_res = client.get("/api/expenses/rules")
    rules = get_res.json()
    assert all(r["id"] != rule_id for r in rules)

    # 존재하지 않는 ID 삭제 시 404
    del_not_found = client.delete(f"/api/expenses/rules/{rule_id}")
    assert del_not_found.status_code == 404


def test_category_cascade_delete(client, db_session):
    """카테고리 삭제 시 연관된 규칙 연쇄 삭제(Cascade) 검증."""
    new_cat = ExpenseCategory(name="테스트카테고리", color="#123456", is_default=False)
    db_session.add(new_cat)
    db_session.commit()
    db_session.refresh(new_cat)

    res = client.post("/api/expenses/rules", json={"keyword": "임시키워드", "category_id": new_cat.id, "is_excluded": False})
    assert res.status_code == 201
    rule_id = res.json()["id"]

    # 카테고리 삭제 API 호출 (DELETE /api/expenses/categories/{cat_id})
    del_cat_res = client.delete(f"/api/expenses/categories/{new_cat.id}")
    assert del_cat_res.status_code in [200, 204]

    # 해당 규칙이 연쇄 삭제되었는지 확인
    get_rules = client.get("/api/expenses/rules")
    rules = get_rules.json()
    assert all(r["id"] != rule_id for r in rules)
    rule_in_db = db_session.query(ExpenseRule).filter_by(id=rule_id).first()
    assert rule_in_db is None
