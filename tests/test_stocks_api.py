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

def test_get_stock_prices_validation():
    """필수 파라미터가 없거나 형식이 잘못되었을 때 422 에러를 반환하는지 검증합니다."""
    # 파라미터 누락
    response = client.get("/api/stocks/prices")
    assert response.status_code == 422
    
    # start_date 누락
    response = client.get("/api/stocks/prices?ticker=005930")
    assert response.status_code == 422

def test_get_stock_prices_kr(db_session):
    """국내 주식 주가 조회가 정상 동작하고 DB 캐싱이 수행되는지 검증합니다."""
    # 임의의 종목 데이터 삽입
    db_session.add(Stock(stock_code="005930", stock_name="삼성전자", market="KOSPI"))
    db_session.commit()
    
    # 2026-06-01 ~ 2026-06-02 주가 조회
    # 장외 시간이라고 가정하여 모킹 (is_kr_market_open=False)
    with patch("src.backend.services.price_service.price_service.is_kr_market_open", return_value=False):
        # 키움 API 응답 모킹
        mock_response = {
            "return_code": 0,
            "daly_stkpc": [
                {"date": "20260602", "close_pric": "75000"},
                {"date": "20260601", "close_pric": "74000"}
            ]
        }
        with patch("src.backend.services.price_service.price_service.kiwoom_auth.get_valid_token", return_value="mock_token"), \
             patch("src.backend.services.price_service.price_service.kiwoom_api.get_historical_stock_price", return_value=mock_response):
            
            response = client.get("/api/stocks/prices?ticker=005930&start_date=2026-06-01&end_date=2026-06-02")
            assert response.status_code == 200
            data = response.json()
            
            # 응답 구조 검증
            assert data["ticker"] == "005930"
            assert data["name"] == "삼성전자"
            assert data["market"] == "KOSPI"
            assert len(data["prices"]) == 2
            assert data["prices"][0]["date"] == "2026-06-01"
            assert data["prices"][0]["close_price"] == 74000.0
            assert data["prices"][1]["date"] == "2026-06-02"
            assert data["prices"][1]["close_price"] == 75000.0
            
            # DB 캐싱 결과 검증
            from src.backend.models import HistoricalPrice
            import datetime
            cached = db_session.query(HistoricalPrice).filter(HistoricalPrice.ticker == "005930").all()
            assert len(cached) == 2
            dates = [c.price_date.strftime("%Y-%m-%d") for c in cached]
            assert "2026-06-01" in dates
            assert "2026-06-02" in dates

def test_get_stock_prices_us(db_session):
    """미국 주식 주가 조회가 정상 동작하고 DB 캐싱이 수행되는지 검증합니다."""
    # 장외 시간이라고 가정하여 모킹 (is_us_market_open=False)
    with patch("src.backend.services.price_service.price_service.is_us_market_open", return_value=False):
        # yfinance history 모킹
        import pandas as pd
        mock_data = pd.DataFrame(
            {"Close": [150.0, 152.0]},
            index=pd.to_datetime(["2026-06-01", "2026-06-02"])
        )
        
        with patch("yfinance.Ticker") as mock_ticker:
            mock_ticker.return_value.history.return_value = mock_data
            
            # yfinance.Ticker.info 모킹 (종목명 검색용)
            # PropertyMock이나 getattr 모킹 대신 간단히 dict 속성 모킹
            mock_ticker.return_value.info = {"longName": "Apple Inc."}
            
            response = client.get("/api/stocks/prices?ticker=AAPL&start_date=2026-06-01&end_date=2026-06-02")
            assert response.status_code == 200
            data = response.json()
            
            # 응답 구조 검증
            assert data["ticker"] == "AAPL"
            assert data["name"] == "Apple Inc."
            assert len(data["prices"]) == 2
            assert data["prices"][0]["date"] == "2026-06-01"
            assert data["prices"][0]["close_price"] == 150.0
            
            # DB 캐싱 결과 검증
            from src.backend.models import HistoricalPrice
            cached = db_session.query(HistoricalPrice).filter(HistoricalPrice.ticker == "AAPL").all()
            assert len(cached) == 2

