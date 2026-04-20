import pytest
import sys, os
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

# 프로젝트 루트를 path에 추가
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.backend.main import app
from src.backend.database import Base, engine, SessionLocal
from src.backend.models import Stock

client = TestClient(app)

@pytest.fixture(scope="module")
def setup_db():
    # 테스트용 DB 테이블 생성
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    # 기존 데이터 정리
    db.query(Stock).delete()
    db.commit()
    yield db
    db.close()

def test_sync_stocks_mocked(setup_db):
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

def test_delisting_on_sync(setup_db):
    """상장폐지 종목이 동기화 과정에서 삭제되는지 확인합니다."""
    db = setup_db
    # 기존에 '삭제될종목' 추가
    del_stock = Stock(stock_code="999999", stock_name="삭제될종목", market="KOSPI")
    db.add(del_stock)
    db.commit()
    
    # 동기화 시 '999999'가 없는 목록으로 모킹
    mock_stocks = [{"code": "005930", "name": "삼성전자", "marketName": "KOSPI"}]
    
    with patch("src.backend.services.kiwoom_service.KiwoomStockService.fetch_stock_list") as mock_fetch:
        mock_fetch.side_effect = [mock_stocks, []]
        
        client.post("/api/stocks/sync")
        
        # '999999'가 삭제되었는지 확인
        res = db.query(Stock).filter(Stock.stock_code == "999999").first()
        assert res is None
        # '005930'은 남아있어야 함
        res = db.query(Stock).filter(Stock.stock_code == "005930").first()
        assert res is not None
