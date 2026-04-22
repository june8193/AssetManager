import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.backend.main import app
from src.backend.database import Base, get_db
from src.backend.models import User
import datetime

# 테스트용 인메모리 SQLite DB 설정
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# DB 테이블 생성
Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    """각 테스트 전에 테이블을 새로 생성하고 초기 데이터를 추가합니다."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    # 초기 유저 생성
    db = TestingSessionLocal()
    user = User(name="Test User")
    db.add(user)
    db.commit()
    db.close()
    yield

def test_get_users():
    response = client.get("/api/db/users")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Test User"

def test_create_and_get_account():
    # 유저 ID 조회
    users_res = client.get("/api/db/users")
    user_id = users_res.json()[0]["id"]

    # 계좌 생성
    payload = {
        "user_id": user_id,
        "name": "TEST-ACC-123",
        "provider": "TestBank",
        "alias": "TestAlias",
        "is_active": True
    }
    response = client.post("/api/db/accounts", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "TEST-ACC-123"
    account_id = data["id"]

    # 목록 조회 확인
    get_res = client.get("/api/db/accounts")
    assert any(a["id"] == account_id for a in get_res.json())

    # 수정
    payload["name"] = "UPDATED-ACC"
    put_res = client.put(f"/api/db/accounts/{account_id}", json=payload)
    assert put_res.status_code == 200
    assert put_res.json()["name"] == "UPDATED-ACC"

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
