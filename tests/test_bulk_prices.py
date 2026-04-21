import pytest
from unittest.mock import MagicMock, patch
from src.kiwoom.api import KiwoomAPI

@pytest.fixture
def kiwoom_api():
    # Mock settings.json 로딩을 위해 patch 사용
    with patch("src.kiwoom.api.KiwoomAPI._load_settings") as mock_load:
        mock_load.return_value = {
            "base_url": "https://api.kiwoom.com",
            "accounts": [
                {
                    "broker": "kiwoom",
                    "account": "test_acc",
                    "app_key": "test_key",
                    "secret_key": "test_secret"
                }
            ]
        }
        return KiwoomAPI(settings_path="dummy.json")

def test_get_bulk_stock_info_success(kiwoom_api):
    """여러 종목의 정보를 성공적으로 조회하는지 테스트합니다."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "return_code": 0,
        "return_msg": "정상처리",
        "atn_stk_infr": [
            {"stk_cd": "005930", "stk_nm": "삼성전자", "cur_prc": "-214500"},
            {"stk_cd": "000660", "stk_nm": "SK하이닉스", "cur_prc": "+1166000"}
        ]
    }

    with patch("requests.post", return_value=mock_response):
        # 파이프로 구분된 문자열 또는 리스트를 인자로 받을 수 있도록 설계
        result = kiwoom_api.get_bulk_stock_info("test_token", ["005930", "000660"])
        
        assert result is not None
        assert result["return_code"] == 0
        assert "atn_stk_infr" in result
        assert len(result["atn_stk_infr"]) == 2
        assert result["atn_stk_infr"][0]["stk_cd"] == "005930"
        assert result["atn_stk_infr"][1]["cur_prc"] == "+1166000"


def test_get_bulk_stock_info_format_conversion(kiwoom_api):
    """리스트 입력 시 파이프(|) 구분자 문자열로 변환하여 요청하는지 확인합니다."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"return_code": 0}

    with patch("requests.post", return_value=mock_response) as mock_post:
        kiwoom_api.get_bulk_stock_info("test_token", ["005930", "000660", "035420"])
        
        # 호출된 데이터 확인
        call_args = mock_post.call_args
        sent_json = call_args[1]["json"]
        assert sent_json["stk_cd"] == "005930|000660|035420"
