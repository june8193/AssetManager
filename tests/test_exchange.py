import pytest
import sys, os
from fastapi.testclient import TestClient
from datetime import date

# 프로젝트 루트를 path에 추가
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.backend.main import app
from src.backend.database import Base, engine, SessionLocal
from src.backend.models import ExchangeRate

client = TestClient(app)

@pytest.fixture(scope="module")
def setup_db():
    # 테스트용 DB 테이블 생성
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    # 기존 데이터 정리
    db.query(ExchangeRate).delete()
    db.commit()
    yield db
    db.close()

def test_add_exchange_rate(setup_db):
    """환율을 정상적으로 추가할 수 있는지 테스트합니다."""
    payload = {
        "date": "2024-04-20",
        "currency": "USD",
        "rate": 1380.5
    }
    response = client.post("/api/exchange/rates", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["date"] == "2024-04-20"
    assert data["rate"] == 1380.5

def test_add_duplicate_exchange_rate_fails(setup_db):
    """이미 존재하는 날짜의 환율을 추가하려 하면 409 에러가 발생하는지 확인합니다."""
    payload = {
        "date": "2024-04-20",
        "currency": "USD",
        "rate": 1400.0
    }
    response = client.post("/api/exchange/rates", json=payload)
    assert response.status_code == 409
    assert "이미 존재합니다" in response.json()["detail"]

def test_update_exchange_rate_with_force(setup_db):
    """force=True 파라미터를 사용하여 기존 환율을 업데이트할 수 있는지 확인합니다."""
    payload = {
        "date": "2024-04-20",
        "currency": "USD",
        "rate": 1400.0
    }
    response = client.post("/api/exchange/rates?force=true", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["date"] == "2024-04-20"
    assert data["rate"] == 1400.0

def test_get_exchange_rates(setup_db):
    """환율 목록을 가져올 수 있는지 확인합니다."""
    # 추가 데이터 입력
    client.post("/api/exchange/rates", json={"date": "2024-04-19", "rate": 1370.0})
    
    response = client.get("/api/exchange/rates")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    assert data[0]["date"] == "2024-04-20" # 최신 날짜순 정렬 확인
    assert data[1]["date"] == "2024-04-19"
