import pytest
import datetime
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

from src.backend.main import app
from src.backend.services.price_service import price_service

client = TestClient(app)

@pytest.mark.asyncio
async def test_dashboard_refresh_success():
    """최초 대시보드 시세 새로고침 요청 시 성공적으로 가격 업데이트가 수행되는지 검증합니다."""
    price_service.last_manual_refresh_time = None
    # price_service.update_all_market_prices 호출 모킹
    mock_update = AsyncMock()
    
    with patch.object(price_service, "update_all_market_prices", mock_update):
        response = client.post("/api/dashboard/refresh")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "최신화되었습니다" in data["message"]
        mock_update.assert_called_once()


@pytest.mark.asyncio
async def test_dashboard_refresh_rate_limit():
    """1분 이내에 대시보드 시세 새로고침을 연속으로 요청할 경우, 두 번째 요청은 생략되는지 검증합니다."""
    price_service.last_manual_refresh_time = None
    mock_update = AsyncMock()

    
    with patch.object(price_service, "update_all_market_prices", mock_update):
        # 첫 번째 요청
        response1 = client.post("/api/dashboard/refresh")
        assert response1.status_code == 200
        assert response1.json()["status"] == "success"
        
        # 1분 이내에 즉시 두 번째 요청
        response2 = client.post("/api/dashboard/refresh")
        assert response2.status_code == 200
        data2 = response2.json()
        
        # 두 번째 요청은 skipped여야 함
        assert data2["status"] == "skipped"
        assert "1분 이내" in data2["message"]
        
        # update_all_market_prices는 단 한 번만 호출되어야 함
        mock_update.assert_called_once()
