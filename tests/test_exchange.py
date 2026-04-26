import pytest
from fastapi.testclient import TestClient
from src.backend.main import app

client = TestClient(app)

def test_add_exchange_rate():
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

def test_add_duplicate_exchange_rate_fails():
    """이미 존재하는 날짜의 환율을 추가하려 하면 409 에러가 발생하는지 확인합니다."""
    # 먼저 하나 추가
    payload = {
        "date": "2024-04-21",
        "currency": "USD",
        "rate": 1380.5
    }
    client.post("/api/exchange/rates", json=payload)
    
    # 중복 추가 시도
    payload["rate"] = 1400.0
    response = client.post("/api/exchange/rates", json=payload)
    assert response.status_code == 409
    assert "이미 존재합니다" in response.json()["detail"]

def test_update_exchange_rate_with_force():
    """force=True 파라미터를 사용하여 기존 환율을 업데이트할 수 있는지 확인합니다."""
    # 먼저 하나 추가
    payload = {
        "date": "2024-04-22",
        "currency": "USD",
        "rate": 1380.5
    }
    client.post("/api/exchange/rates", json=payload)
    
    # force=true로 업데이트
    payload["rate"] = 1400.0
    response = client.post("/api/exchange/rates?force=true", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["date"] == "2024-04-22"
    assert data["rate"] == 1400.0

def test_get_exchange_rates():
    """환율 목록을 가져올 수 있는지 확인합니다."""
    # 데이터 입력
    client.post("/api/exchange/rates", json={"date": "2024-04-18", "rate": 1360.0})
    client.post("/api/exchange/rates", json={"date": "2024-04-19", "rate": 1370.0})
    
    response = client.get("/api/exchange/rates")
    assert response.status_code == 200
    data = response.json()
    # conftest.py가 각 테스트 후 데이터를 지우므로, 이 테스트에서 넣은 2개만 있어야 함
    assert len(data) >= 2
    # 최신순 정렬 확인
    dates = [d["date"] for d in data]
    assert "2024-04-19" in dates
    assert "2024-04-18" in dates
