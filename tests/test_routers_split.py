"""분할된 기본 CRUD 라우터(accounts, assets, transactions) 엔드포인트 통합 테스트."""

import pytest
from datetime import date
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock

from src.backend.main import app
from src.backend.models import User, Account, Asset, Transaction


@pytest.fixture
def client(db_session):
    """FastAPI TestClient 픽스처."""
    return TestClient(app)


def test_accounts_router_crud(client, db_session):
    """사용자 조회 및 계좌 CRUD 엔드포인트 동작 검증."""
    user = User(id=999, name="테스터")
    db_session.add(user)
    db_session.commit()

    # 1. 사용자 조회
    res = client.get("/api/db/users")
    assert res.status_code == 200
    users = res.json()
    assert any(u["id"] == 999 and u["name"] == "테스터" for u in users)

    # 2. 계좌 생성
    payload = {
        "user_id": 999,
        "name": "새증권계좌",
        "provider": "미래에셋",
        "alias": "투자용",
        "account_type": "BROKERAGE",
        "is_active": True
    }
    res = client.post("/api/db/accounts", json=payload)
    assert res.status_code == 200
    created = res.json()
    account_id = created["id"]
    assert created["name"] == "새증권계좌"

    # 3. 계좌 목록 조회
    res = client.get("/api/db/accounts")
    assert res.status_code == 200
    accounts = res.json()
    assert any(a["id"] == account_id and a["user_name"] == "테스터" for a in accounts)

    # 4. 계좌 수정
    payload["name"] = "수정된증권계좌"
    res = client.put(f"/api/db/accounts/{account_id}", json=payload)
    assert res.status_code == 200
    assert res.json()["name"] == "수정된증권계좌"

    # 5. 계좌 삭제
    res = client.delete(f"/api/db/accounts/{account_id}")
    assert res.status_code == 200
    assert res.json()["message"] == "삭제되었습니다."


def test_assets_router_crud(client, db_session):
    """자산 마스터 CRUD 및 카테고리 검증 엔드포인트 동작 검증."""
    # 1. 카테고리 목록 조회
    res = client.get("/api/db/assets/categories")
    assert res.status_code == 200
    categories = res.json()
    assert "일반주식" in categories
    assert "현금" in categories

    # 2. 자산 실시간 검증 엔드포인트 (현금 및 주식)
    res = client.get("/api/db/assets/verify", params={"ticker": "KRW", "country": "KR", "major_category": "현금"})
    assert res.status_code == 200
    assert res.json()["name"] == "원화예수금"

    # 3. 자산 생성
    asset_payload = {
        "ticker": "SPLIT_TEST_01",
        "name": "스플릿테스트종목",
        "major_category": "일반주식",
        "sub_category": "국내주식",
        "country": "KR"
    }
    res = client.post("/api/db/assets", json=asset_payload)
    assert res.status_code == 200
    created = res.json()
    asset_id = created["id"]

    # 4. 자산 목록 조회
    res = client.get("/api/db/assets")
    assert res.status_code == 200
    assets = res.json()
    assert any(a["id"] == asset_id and a["ticker"] == "SPLIT_TEST_01" for a in assets)

    # 5. 자산 수정
    asset_payload["name"] = "수정된스플릿종목"
    res = client.put(f"/api/db/assets/{asset_id}", json=asset_payload)
    assert res.status_code == 200
    assert res.json()["name"] == "수정된스플릿종목"

    # 6. 자산 삭제
    res = client.delete(f"/api/db/assets/{asset_id}")
    assert res.status_code == 200
    assert res.json()["message"] == "삭제되었습니다."


def test_transactions_router_crud_and_transfer(client, db_session):
    """거래 내역 CRUD 및 이체(Transfer) 엔드포인트 동작 검증."""
    # 기초 데이터 생성
    user = User(id=888, name="이체테스터")
    db_session.add(user)
    acc1 = Account(id=801, user_id=888, name="보내는계좌", provider="국민", account_type="BANK", is_active=True)
    acc2 = Account(id=802, user_id=888, name="받는계좌", provider="신한", account_type="BANK", is_active=True)
    asset = Asset(id=810, ticker="KRW_T", name="원화예수금", major_category="현금", sub_category="원화예수금", country="KR")
    db_session.add_all([acc1, acc2, asset])
    db_session.commit()

    # 1. 거래 생성
    tx_payload = {
        "account_id": 801,
        "asset_id": 810,
        "transaction_date": "2026-08-01",
        "type": "DEPOSIT",
        "quantity": 1000000.0,
        "price": 1.0,
        "total_amount": 1000000.0,
        "currency": "KRW",
        "memo": "초기입금"
    }
    res = client.post("/api/db/transactions", json=tx_payload)
    assert res.status_code == 200
    tx_id = res.json()["id"]

    # 2. 거래 조회
    res = client.get("/api/db/transactions")
    assert res.status_code == 200
    tx_list = res.json()
    assert any(t["id"] == tx_id for t in tx_list)

    # 3. 기간별 거래 조회
    res = client.get(f"/api/db/accounts/801/transactions/period?start_date=2026-07-31&end_date=2026-08-01")
    assert res.status_code == 200
    period_txs = res.json()
    assert any(t["id"] == tx_id for t in period_txs)

    # 4. 이체 생성
    transfer_payload = {
        "source_account_id": 801,
        "target_account_id": 802,
        "asset_id": 810,
        "amount": 300000.0,
        "transaction_date": "2026-08-01",
        "memo": "용돈이체"
    }
    res = client.post("/api/db/transactions/transfer", json=transfer_payload)
    assert res.status_code == 200
    transfer_pair = res.json()
    assert len(transfer_pair) == 2

    # 5. 거래 수정
    tx_payload["memo"] = "수정된입금"
    res = client.put(f"/api/db/transactions/{tx_id}", json=tx_payload)
    assert res.status_code == 200
    assert res.json()["memo"] == "수정된입금"

    # 6. 거래 삭제
    res = client.delete(f"/api/db/transactions/{tx_id}")
    assert res.status_code == 200
    assert res.json()["message"] == "삭제되었습니다."
