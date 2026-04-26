import pytest
from fastapi.testclient import TestClient
from src.backend.main import app
from src.backend.models import User

client = TestClient(app)

@pytest.fixture
def test_user(db_session):
    """테스트용 유저를 생성합니다."""
    user = User(name="Test User")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

def test_get_users(test_user):
    response = client.get("/api/db/users")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert any(u["name"] == "Test User" for u in data)

def test_create_and_get_account(test_user):
    user_id = test_user.id

    # 계좌 생성
    payload = {
        "user_id": user_id,
        "name": "TEST-ACC-123",
        "provider": "TestBank",
        "alias": "TestAlias",
        "account_type": "BROKERAGE",
        "is_active": True
    }
    response = client.post("/api/db/accounts", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "TEST-ACC-123"
    assert data["account_type"] == "BROKERAGE"
    account_id = data["id"]

    # 목록 조회 확인
    get_res = client.get("/api/db/accounts")
    assert any(a["id"] == account_id for a in get_res.json())

    # 수정 (은행으로 변경)
    payload["name"] = "UPDATED-ACC"
    payload["account_type"] = "BANK"
    put_res = client.put(f"/api/db/accounts/{account_id}", json=payload)
    assert put_res.status_code == 200
    assert put_res.json()["name"] == "UPDATED-ACC"
    assert put_res.json()["account_type"] == "BANK"

    # 삭제
    del_res = client.delete(f"/api/db/accounts/{account_id}")
    assert del_res.status_code == 200

def test_create_and_get_asset():
    payload = {
        "ticker": "TEST_TICKER",
        "name": "Test Asset",
        "major_category": "Stock",
        "sub_category": "Domestic",
        "country": "KR"
    }
    response = client.post("/api/db/assets", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["ticker"] == "TEST_TICKER"
    asset_id = data["id"]

    # 수정
    payload["name"] = "Updated Asset"
    put_res = client.put(f"/api/db/assets/{asset_id}", json=payload)
    assert put_res.status_code == 200
    assert put_res.json()["name"] == "Updated Asset"

    # 삭제
    client.delete(f"/api/db/assets/{asset_id}")

def test_get_snapshots():
    response = client.get("/api/db/snapshots")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
