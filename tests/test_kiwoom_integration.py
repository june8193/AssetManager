import pytest
import asyncio
import json
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, Mock, mock_open
from src.kiwoom.auth import KiwoomAuthManager

@pytest.fixture(autouse=True)
def mock_secrets_json():
    """테스트 중에 secrets.json 파일을 읽지 않도록 Mocking합니다."""
    # KiwoomAuthManager는 싱글톤이므로 테스트마다 인스턴스를 초기화해야 할 수 있습니다.
    KiwoomAuthManager._instance = None
    
    mock_data = {
        "base_url": "https://api.kiwoom.com",
        "ws_url": "wss://api.kiwoom.com:10000",
        "accounts": [
            {
                "app_key": "mock_app_key",
                "secret_key": "mock_secret_key"
            }
        ]
    }
    
    # mock_open을 사용하여 context manager 프로토콜 지원
    with patch("pathlib.Path.exists", return_value=True), \
         patch("builtins.open", mock_open(read_data=json.dumps(mock_data))), \
         patch("json.load", return_value=mock_data):
        yield

@pytest.mark.asyncio
async def test_singleton_pattern():
    """KiwoomAuthManager가 싱글톤으로 동작하는지 확인합니다."""
    manager1 = KiwoomAuthManager()
    manager2 = KiwoomAuthManager()
    assert manager1 is manager2

@pytest.mark.asyncio
async def test_token_caching():
    """토큰이 유효할 때 캐시된 토큰을 반환하는지 확인합니다."""
    manager = KiwoomAuthManager()
    manager._access_token = "test_token"
    manager._expired_at = datetime.now() + timedelta(hours=1)
    
    token = await manager.get_valid_token()
    assert token == "test_token"

@pytest.mark.asyncio
async def test_token_refresh_on_expiration():
    """토큰이 만료되었을 때 새로운 토큰을 요청하는지 확인합니다."""
    manager = KiwoomAuthManager()
    manager._access_token = "old_token"
    manager._expired_at = datetime.now() - timedelta(seconds=1)
    
    with patch("httpx.AsyncClient.post") as mock_post:
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.json = Mock(return_value={
            "return_code": 0,
            "token": "new_token",
            "expires_in": 3600
        })
        mock_response.raise_for_status = Mock()
        mock_post.return_value = mock_response
        
        token = await manager.get_valid_token()
        assert token == "new_token"
        assert mock_post.called

@pytest.mark.asyncio
async def test_masking_logging(caplog):
    """로그 출력 시 중요한 정보가 마스킹되는지 확인합니다."""
    manager = KiwoomAuthManager()
    manager._access_token = "very_secret_token_12345"
    
    with caplog.at_level("INFO"):
        manager.log_token_info()
    
    assert "very_secret_token_12345" not in caplog.text
    assert "ve***45" in caplog.text  # 예시 마스킹 형태

from src.kiwoom.ws_client import KiwoomWebSocketClient

@pytest.mark.asyncio
async def test_ws_subscription_format():
    """웹소켓 구독 요청 JSON 포맷이 규격에 맞는지 확인합니다."""
    # KiwoomWebSocketClient 초기화 시 AuthManager를 생성하므로 Mocking이 필요함
    client = KiwoomWebSocketClient()
    codes = ["005930", "000660"]
    
    reg_msg = client._create_reg_message(codes)
    
    assert reg_msg["trnm"] == "REG"
    assert reg_msg["data"]["bcode"] == "0B"
    assert "005930" in reg_msg["data"]["codes"]

@pytest.mark.asyncio
async def test_ws_data_parsing():
    """수신된 REAL 데이터를 정상적으로 파싱하는지 확인합니다."""
    client = KiwoomWebSocketClient()
    
    mock_raw_data = {
        "trnm": "REAL",
        "data": {
            "item": "005930",
            "10": "70000",   # 현재가
            "12": "1.50"     # 등락율
        }
    }
    
    parsed = client._parse_real_data(mock_raw_data)
    
    assert parsed["stock_code"] == "005930"
    assert parsed["current_price"] == 70000
    assert parsed["change_rate"] == "1.50"
