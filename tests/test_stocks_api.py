import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
from src.backend.main import app
from src.backend.models import Stock

client = TestClient(app)

def test_sync_stocks_mocked():
    """키움 API 동기화 API를 모킹하여 테스트합니다."""
    mock_stocks = [
        {"code": "005930", "name": "삼성전자", "marketName": "KOSPI"},
        {"code": "000660", "name": "SK하이닉스", "marketName": "KOSPI"},
        {"code": "068270", "name": "셀트리온", "marketName": "KOSPI"}
    ]
    
    with patch("src.backend.services.kiwoom_service.KiwoomStockService.fetch_stock_list") as mock_fetch:
        # 코스피(0) 호출 시 mock_stocks 반환, 코스닥(10) 호출 시 빈 리스트 반환
        mock_fetch.side_effect = [mock_stocks, []]
        
        response = client.post("/api/stocks/sync")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["count"] == 3

def test_search_stocks_after_sync():
    """동기화된 후 종목 검색이 정상적으로 작동하는지 확인합니다."""
    # conftest.py가 데이터를 지우므로, 여기서 다시 동기화하거나 직접 삽입해야 함
    # 여기서는 직접 삽입을 선택 (속도와 제어성)
    mock_stocks = [
        {"code": "005930", "name": "삼성전자", "marketName": "KOSPI"},
        {"code": "000660", "name": "SK하이닉스", "marketName": "KOSPI"}
    ]
    
    with patch("src.backend.services.kiwoom_service.KiwoomStockService.fetch_stock_list") as mock_fetch:
        mock_fetch.side_effect = [mock_stocks, []]
        client.post("/api/stocks/sync")

    # '삼성' 검색
    response = client.get("/api/stocks/search?q=삼성")
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    assert any(item["stock_name"] == "삼성전자" for item in data)
    
    # '000660' 코드 검색
    response = client.get("/api/stocks/search?q=000660")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["stock_name"] == "SK하이닉스"

def test_delisting_on_sync(db_session):
    """상장폐지 종목이 동기화 과정에서 삭제되는지 확인합니다."""
    # 기존에 '999999' 추가
    del_stock = Stock(stock_code="999999", stock_name="삭제될종목", market="KOSPI")
    db_session.add(del_stock)
    db_session.commit()
    
    # 동기화 시 '999999'가 없는 목록으로 모킹
    mock_stocks = [{"code": "005930", "name": "삼성전자", "marketName": "KOSPI"}]
    
    with patch("src.backend.services.kiwoom_service.KiwoomStockService.fetch_stock_list") as mock_fetch:
        mock_fetch.side_effect = [mock_stocks, []]
        
        client.post("/api/stocks/sync")
        
        # '999999'가 삭제되었는지 확인
        res = db_session.query(Stock).filter(Stock.stock_code == "999999").first()
        assert res is None
        # '005930'은 남아있어야 함
        res = db_session.query(Stock).filter(Stock.stock_code == "005930").first()
        assert res is not None
