import pytest
from fastapi.testclient import TestClient
from datetime import date
from src.backend.main import app
from src.backend.models import User, Account, Asset, Transaction

client = TestClient(app)

@pytest.fixture
def setup_test_data(db_session):
    """테스트를 위한 유저, 계좌, 자산 기초 데이터를 셋업합니다."""
    user = User(name="Bug Test User")
    db_session.add(user)
    db_session.flush()

    account = Account(
        user_id=user.id,
        name="BUG-TEST-ACC",
        provider="BugBank",
        alias="BugAlias",
        account_type="BROKERAGE",
        is_active=True
    )
    db_session.add(account)
    
    asset = Asset(
        ticker="005930",
        name="삼성전자",
        major_category="일반주식",
        sub_category="국내주식",
        country="KR"
    )
    db_session.add(asset)
    
    db_session.commit()
    
    return {
        "user_id": user.id,
        "account_id": account.id,
        "asset_id": asset.id
    }

def test_create_transaction_with_asset_details(setup_test_data):
    """TransactionSchema에 asset_name과 asset_ticker가 포함되어도
    거래 내역 생성(POST)이 500 에러 없이 성공하는지 테스트합니다."""
    payload = {
        "account_id": setup_test_data["account_id"],
        "asset_id": setup_test_data["asset_id"],
        "transaction_date": str(date.today()),
        "type": "BUY",
        "quantity": 10.0,
        "price": 50000.0,
        "total_amount": 500000.0,
        "currency": "KRW",
        "asset_name": "삼성전자",
        "asset_ticker": "005930"
    }
    
    # POST 요청 전송
    response = client.post("/api/db/transactions", json=payload)
    
    # 수정 전에는 이 부분에서 500 Internal Server Error 발생 예상 (Red)
    assert response.status_code == 200
    data = response.json()
    assert data["quantity"] == 10.0
    assert data["total_amount"] == 500000.0
    
    tx_id = data["id"]
    
    # PUT 요청에서도 동일한 스키마 구조로 수정 시도
    payload["quantity"] = 20.0
    payload["total_amount"] = 1000000.0
    
    put_response = client.put(f"/api/db/transactions/{tx_id}", json=payload)
    # 수정 전에는 여기서도 500 Internal Server Error 발생 예상 (Red)
    assert put_response.status_code == 200
    put_data = put_response.json()
    assert put_data["quantity"] == 20.0
    assert put_data["total_amount"] == 1000000.0
    
    # 삭제 정리
    client.delete(f"/api/db/transactions/{tx_id}")
