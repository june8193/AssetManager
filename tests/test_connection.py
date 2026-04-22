import pytest
import sys, os
from fastapi.testclient import TestClient
from unittest.mock import patch

# 프로젝트 루트를 path에 추가
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.backend.main import app

client = TestClient(app)

def test_api_connection_success():
    """API 연결 테스트 엔드포인트가 성공할 때의 동작을 검증합니다."""
    mock_results = [
        {
            "broker": "키움",
            "account": "1234-5678",
            "token_success": True,
            "api_success": True,
            "message": "연결 성공",
            "acct_no": "1234567810"
        }
    ]
    
    with patch("src.backend.routers.connection.KiwoomAPI") as MockAPI:
        instance = MockAPI.return_value
        instance.check_all_connections.return_value = mock_results
        
        response = client.get("/api/connection/test")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["data"] == mock_results

def test_api_connection_failure():
    """API 연결 테스트 중 예외가 발생했을 때 500 에러를 반환하는지 검증합니다."""
    with patch("src.backend.routers.connection.KiwoomAPI") as MockAPI:
        instance = MockAPI.return_value
        instance.check_all_connections.side_effect = Exception("API 서버 오류")
        
        response = client.get("/api/connection/test")
        
        assert response.status_code == 500
        data = response.json()
        assert "연결 테스트 중 오류가 발생했습니다" in data["detail"]
