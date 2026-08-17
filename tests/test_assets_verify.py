import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
from src.backend.main import app
from src.backend.models import VALID_CATEGORIES

client = TestClient(app)

def test_get_categories():
    """카테고리 조회 API가 VALID_CATEGORIES의 구조를 올바르게 반환하는지 테스트합니다."""
    response = client.get("/api/db/assets/categories")
    assert response.status_code == 200
    data = response.json()
    assert "현금" in data
    assert "일반주식" in data
    assert "원화예수금" in data["현금"]
    assert "국내주식" in data["일반주식"]
    assert data == VALID_CATEGORIES

@patch("src.backend.services.asset_service.price_service.get_stock_name", new_callable=AsyncMock)
def test_verify_asset_success(mock_get_name):
    """실제 주식시장에 존재하는 종목에 대해 200 응답과 함께 올바른 자산명을 반환하는지 테스트합니다."""
    # Mocking price_service.get_stock_name to return a name
    mock_get_name.return_value = "삼성전자"
    
    response = client.get("/api/db/assets/verify?ticker=005930&country=KR&major_category=일반주식")
    assert response.status_code == 200
    assert response.json() == {"name": "삼성전자"}
    mock_get_name.assert_called_once_with("005930", "KR")

@patch("src.backend.services.asset_service.price_service.get_stock_name", new_callable=AsyncMock)
def test_verify_asset_not_found(mock_get_name):
    """존재하지 않는 티커에 대해 404 Not Found를 반환하는지 테스트합니다."""
    # Mocking price_service.get_stock_name to return None
    mock_get_name.return_value = None
    
    response = client.get("/api/db/assets/verify?ticker=INVALID&country=US&major_category=일반주식")
    assert response.status_code == 404
    assert "찾을 수 없습니다" in response.json()["detail"]
    mock_get_name.assert_called_once_with("INVALID", "US")

def test_verify_cash_asset():
    """대분류가 현금인 경우의 자동 명칭 지정을 테스트합니다."""
    # KRW인 경우 -> 원화예수금
    response = client.get("/api/db/assets/verify?ticker=KRW&country=KR&major_category=현금")
    assert response.status_code == 200
    assert response.json() == {"name": "원화예수금"}
    
    # USD인 경우 -> 달러예수금
    response = client.get("/api/db/assets/verify?ticker=USD&country=US&major_category=현금")
    assert response.status_code == 200
    assert response.json() == {"name": "달러예수금"}
    
    # 그 외의 티커인 경우 -> 에러 (400)
    response = client.get("/api/db/assets/verify?ticker=JPY&country=JP&major_category=현금")
    assert response.status_code == 400
    assert "지원하지 않는 현금 티커" in response.json()["detail"]

def test_verify_asset_duplicate(db_session):
    """이미 DB에 등록된 자산(티커) 조회 시 400 에러와 함께 이미 등록된 자산임을 알리는지 테스트합니다."""
    from src.backend.models import Asset
    # 먼저 DB에 TSLA 추가
    asset = Asset(ticker="TSLA", name="테슬라", major_category="일반주식", sub_category="해외주식", country="US")
    db_session.add(asset)
    db_session.commit()

    # 동일한 TSLA 티커 조회 시도
    response = client.get("/api/db/assets/verify?ticker=TSLA&country=US&major_category=일반주식")
    assert response.status_code == 400
    assert "이미 등록된 자산" in response.json()["detail"]

def test_create_asset_duplicate(db_session):
    """이미 존재하는 티커로 새로운 자산을 추가하려 할 때 400 에러를 반환하는지 테스트합니다."""
    from src.backend.models import Asset
    # 먼저 DB에 TSLA 추가
    asset = Asset(ticker="TSLA", name="테슬라", major_category="일반주식", sub_category="해외주식", country="US")
    db_session.add(asset)
    db_session.commit()

    # 동일한 TSLA 티커로 POST 추가 시도
    payload = {
        "ticker": "TSLA",
        "name": "테슬라2",
        "major_category": "일반주식",
        "sub_category": "해외주식",
        "country": "US"
    }
    response = client.post("/api/db/assets", json=payload)
    assert response.status_code == 400
    assert "이미 등록된 자산" in response.json()["detail"]

