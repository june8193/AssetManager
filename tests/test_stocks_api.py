import pytest
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from src.backend.main import app

client = TestClient(app)

def test_search_stocks():
    """검색어로 주식(KOSPI/KOSDAQ) 목록을 조회합니다."""
    # '삼성' 이라는 키워드로 검색
    response = client.get("/api/stocks/search?q=삼성")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    
    # 검색된 결과 중에 '삼성전자'가 있어야 함
    names = [item["stock_name"] for item in data]
    assert "삼성전자" in names
    
    # '005930' 코드의 일부 혹은 전체로 검색
    response = client.get("/api/stocks/search?q=005930")
    assert response.status_code == 200
    data = response.json()
    names = [item["stock_name"] for item in data]
    assert "삼성전자" in names
