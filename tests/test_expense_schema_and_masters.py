# -*- coding: utf-8 -*-
"""지출 관리 DB 스키마 및 결제수단/카테고리 마스터 CRUD API 단위 테스트 모듈입니다."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import inspect

from src.backend.models import PaymentMethod, ExpenseCategory, Expense
from src.backend.database import engine
from src.backend.migrations import run_migrations, seed_expense_masters


def test_expense_schema_tables_exist(db_session: Session):
    """지출 관리 4개 테이블(payment_methods, expense_categories, expense_sub_categories, expenses)의 스키마 구조를 검증합니다."""
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    assert "payment_methods" in table_names
    assert "expense_categories" in table_names
    assert "expense_sub_categories" not in table_names
    assert "expenses" in table_names

    # payment_methods 모델 컬럼 검증 (default_password 제거 확인)
    model_col_names = {col.name for col in PaymentMethod.__table__.columns}
    assert {"id", "owner", "institution", "alias", "account_number", "is_active", "created_at"}.issubset(model_col_names)
    assert "default_password" not in model_col_names

    # expense_categories 컬럼 검증
    cat_cols = {col["name"] for col in inspector.get_columns("expense_categories")}
    assert {"id", "name", "color", "is_default", "created_at"}.issubset(cat_cols)

    # expenses 컬럼 검증 (sub_category_id 제거 확인)
    exp_cols = {col["name"] for col in inspector.get_columns("expenses")}
    assert {"id", "transaction_date", "year_month", "merchant", "amount", "payment_method_id", "owner", "institution", "category_id", "is_excluded", "memo", "source_file", "created_at"}.issubset(exp_cols)
    assert "sub_category_id" not in exp_cols


def test_seed_expense_masters(db_session: Session):
    """기본 결제수단 및 카테고리 시드 데이터 적재를 검증합니다."""
    seed_expense_masters(db_session)

    # 결제수단 시드 검증 (비밀번호 저장 없음 확인)
    pms = db_session.query(PaymentMethod).all()
    pm_map = {(pm.owner, pm.institution): pm for pm in pms}
    assert ("장준", "카카오뱅크") in pm_map
    assert ("장준", "현대카드") in pm_map

    kb = pm_map[("장준", "카카오뱅크")]
    assert kb.alias == "장준 카카오뱅크"
    assert kb.account_number == "3333"
    assert not hasattr(kb, "default_password")
    assert kb.is_active is True

    hd = pm_map[("장준", "현대카드")]
    assert hd.alias == "장준 현대카드"
    assert hd.account_number == "1002"
    assert not hasattr(hd, "default_password")
    assert hd.is_active is True

    # 카테고리 시드 검증 (구독료, 모임회비 포함 10개)
    categories = db_session.query(ExpenseCategory).all()
    cat_names = {cat.name: cat.color for cat in categories}
    expected_categories = {
        "식비/카페": "#FF6B6B",
        "쇼핑": "#4ECDC4",
        "주거/통신": "#45B7D1",
        "교통/차량": "#FFA07A",
        "문화/여가": "#98D8C8",
        "의료/건강": "#F7DC6F",
        "금융/보험": "#BB8FCE",
        "생활/기타": "#95A5A6",
        "구독료": "#8B5CF6",
        "모임회비": "#EC4899",
    }
    for name, color in expected_categories.items():
        assert name in cat_names
        assert cat_names[name] == color

    # 중복 실행 시에도 중복 적재되지 않아야 함 (멱등성)
    seed_expense_masters(db_session)
    assert db_session.query(PaymentMethod).count() == 2
    assert db_session.query(ExpenseCategory).count() == 10


def test_payment_methods_api_crud(client: TestClient, db_session: Session):
    """결제수단 API CRUD 엔드포인트를 검증합니다."""
    # 1. 초기 시드 데이터 적재
    seed_expense_masters(db_session)

    # 2. GET /api/expenses/payment-methods 목록 조회
    res = client.get("/api/expenses/payment-methods")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 2
    assert any(pm["alias"] == "장준 카카오뱅크" for pm in data)

    # 3. POST /api/expenses/payment-methods 신규 등록 (비밀번호 필드 없음)
    new_pm = {
        "owner": "성은",
        "institution": "지역화폐",
        "alias": "성은 수원페이",
        "account_number": "5555",
        "is_active": True,
    }
    res = client.post("/api/expenses/payment-methods", json=new_pm)
    assert res.status_code == 201
    created = res.json()
    assert created["id"] is not None
    assert created["owner"] == "성은"
    assert created["alias"] == "성은 수원페이"
    assert "default_password" not in created
    pm_id = created["id"]

    # 4. 소유주 필터링 GET
    res_filtered = client.get("/api/expenses/payment-methods?owner=성은")
    assert res_filtered.status_code == 200
    assert len(res_filtered.json()) == 1
    assert res_filtered.json()[0]["owner"] == "성은"

    # 5. PUT /api/expenses/payment-methods/{id} 수정
    update_data = {
        "alias": "성은 수원페이(수정)",
        "is_active": False,
    }
    res_update = client.put(f"/api/expenses/payment-methods/{pm_id}", json=update_data)
    assert res_update.status_code == 200
    updated = res_update.json()
    assert updated["alias"] == "성은 수원페이(수정)"
    assert updated["is_active"] is False

    # 6. DELETE /api/expenses/payment-methods/{id} 삭제
    res_del = client.delete(f"/api/expenses/payment-methods/{pm_id}")
    assert res_del.status_code == 204

    # 삭제 후 조회 시 존재하지 않아야 함
    res_check = client.get(f"/api/expenses/payment-methods?owner=성은")
    assert res_check.status_code == 200
    assert len(res_check.json()) == 0


def test_categories_api_crud(client: TestClient, db_session: Session):
    """지출 카테고리 API CRUD 엔드포인트를 검증합니다."""
    # 1. 초기 시드 데이터 적재
    seed_expense_masters(db_session)

    # 2. GET /api/expenses/categories 목록 조회 (기본 10개)
    res = client.get("/api/expenses/categories")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 10
    cat_names = {c["name"] for c in data}
    assert "구독료" in cat_names
    assert "모임회비" in cat_names

    # 3. POST /api/expenses/categories 신규 생성
    new_cat = {
        "name": "여행",
        "color": "#E056FD",
    }
    res = client.post("/api/expenses/categories", json=new_cat)
    assert res.status_code == 201
    created = res.json()
    assert created["name"] == "여행"
    assert created["color"] == "#E056FD"
    assert created["is_default"] is False
    cat_id = created["id"]

    # 4. 동일 이름 카테고리 등록 시 400 에러
    res_dup = client.post("/api/expenses/categories", json=new_cat)
    assert res_dup.status_code == 400

    # 5. PUT /api/expenses/categories/{id} 수정
    res_update = client.put(f"/api/expenses/categories/{cat_id}", json={"name": "해외여행", "color": "#686DE0"})
    assert res_update.status_code == 200
    assert res_update.json()["name"] == "해외여행"
    assert res_update.json()["color"] == "#686DE0"

    # 6. DELETE /api/expenses/categories/{id} 삭제
    res_del = client.delete(f"/api/expenses/categories/{cat_id}")
    assert res_del.status_code == 204

    # 7. 존재하지 않는 ID 수정 시 404
    res_nf = client.put("/api/expenses/categories/99999", json={"name": "없음"})
    assert res_nf.status_code == 404


def test_sub_categories_endpoints_removed(client: TestClient, db_session: Session):
    """2차 카테고리 API 엔드포인트가 완전히 제거되었는지(404) 검증합니다."""
    # GET
    res = client.get("/api/expenses/sub-categories")
    assert res.status_code == 404

    # POST
    res = client.post("/api/expenses/sub-categories", json={"name": "구독료", "color": "#8B5CF6"})
    assert res.status_code == 404

    # PUT
    res = client.put("/api/expenses/sub-categories/1", json={"name": "구독료"})
    assert res.status_code == 404

    # DELETE
    res = client.delete("/api/expenses/sub-categories/1")
    assert res.status_code == 404
