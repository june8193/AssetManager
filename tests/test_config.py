import pytest
import json
from pathlib import Path
from unittest.mock import patch, mock_open
from src.kiwoom.auth import KiwoomAuthManager
from src.kiwoom.api import KiwoomAPI

@pytest.fixture
def mock_invalid_settings():
    """URL이 누락된 settings.json 데이터를 제공합니다."""
    return {
        "accounts": [
            {
                "app_key": "test_key",
                "secret_key": "test_secret"
            }
        ]
    }

def test_auth_manager_raises_value_error_if_urls_missing(mock_invalid_settings):
    """KiwoomAuthManager가 settings.json에 URL이 없을 때 ValueError를 발생하는지 확인합니다."""
    KiwoomAuthManager._instance = None
    
    with patch("pathlib.Path.exists", return_value=True), \
         patch("builtins.open", mock_open(read_data=json.dumps(mock_invalid_settings))), \
         patch("json.load", return_value=mock_invalid_settings):
        
        with pytest.raises(ValueError) as excinfo:
            KiwoomAuthManager()
        
        assert "base_url" in str(excinfo.value)

def test_api_raises_value_error_if_urls_missing(mock_invalid_settings, tmp_path):
    """KiwoomAPI가 settings.json에 base_url이 없을 때 ValueError를 발생하는지 확인합니다."""
    settings_file = tmp_path / "settings.json"
    settings_file.write_text(json.dumps(mock_invalid_settings))
    
    with pytest.raises(ValueError) as excinfo:
        KiwoomAPI(settings_path=str(settings_file))
    
    assert "base_url" in str(excinfo.value)
