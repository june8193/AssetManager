import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock, MagicMock

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.backend.main import app
from src.backend.database import Base, get_db
from src.backend.models import Watchlist

# 테스트용 DB 설정
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_watchlist.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

client = TestClient(app)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(autouse=True)
def setup_db():
    """테스트용 DB 테이블을 생성하고 삭제합니다."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db_session():
    """테스트용 DB 세션을 제공합니다."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_get_watchlist_empty(db_session):
    """관심종목이 없을 때 빈 리스트를 반환하는지 확인합니다."""
    response = client.get("/api/watchlist?country=KR")
    assert response.status_code == 200
    assert response.json() == []

def test_add_to_watchlist(db_session):
    """관심종목 추가 기능이 정상 동작하는지 확인합니다."""
    data = {
        "stock_code": "005930",
        "stock_name": "삼성전자",
        "country": "KR"
    }
    response = client.post("/api/watchlist", json=data)
    assert response.status_code == 201
    assert response.json()["stock_code"] == "005930"

@pytest.mark.asyncio
@patch("src.backend.services.price_service.price_service.get_kr_prices")
async def test_get_watchlist_prices_kr(mock_get_prices, db_session):
    """국내 주식 시세 조회 API가 정상 동작하는지 확인합니다."""
    # 데이터 준비
    db_session.add(Watchlist(stock_code="005930", stock_name="삼성전자", country="KR"))
    db_session.commit()
    
    # Mock 설정
    mock_get_prices.return_value = [
        {"stock_code": "005930", "current_price": 70000.0, "change_rate": 1.5}
    ]
    
    response = client.get("/api/watchlist/prices?country=KR")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["stock_code"] == "005930"
    assert data[0]["current_price"] == 70000.0

@pytest.mark.asyncio
@patch("src.backend.services.price_service.price_service.get_us_prices")
async def test_get_watchlist_prices_us(mock_get_prices, db_session):
    """미국 주식 시세 조회 API가 정상 동작하는지 확인합니다."""
    # 데이터 준비
    db_session.add(Watchlist(stock_code="AAPL", stock_name="Apple", country="US"))
    db_session.commit()
    
    # Mock 설정
    mock_get_prices.return_value = [
        {"stock_code": "AAPL", "current_price": 180.0, "change_rate": 0.5}
    ]
    
    response = client.get("/api/watchlist/prices?country=US")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["stock_code"] == "AAPL"
    assert data[0]["current_price"] == 180.0

def test_remove_from_watchlist(db_session):
    """관심종목 삭제 기능이 정상 동작하는지 확인합니다."""
    # 데이터 준비
    db_session.add(Watchlist(stock_code="005930", stock_name="삼성전자", country="KR"))
    db_session.commit()
    
    response = client.delete("/api/watchlist/005930")
    assert response.status_code == 204
    
    # 삭제 확인
    check_res = client.get("/api/watchlist?country=KR")
    assert len(check_res.json()) == 0
