import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from src.backend.services.dashboard_service import DashboardService
from src.backend.models import Asset

@pytest.fixture
def mock_db():
    return MagicMock()

@pytest.fixture
def dashboard_service(mock_db):
    with patch("src.backend.services.dashboard_service.KiwoomAPI") as MockAPI, \
         patch("src.backend.services.dashboard_service.KiwoomAuthManager") as MockAuth:
        
        # 싱글톤처럼 동작하도록 Mock 설정
        MockAuth.return_value.get_valid_token = AsyncMock(return_value="test_token")
        
        service = DashboardService(mock_db)
        return service


@pytest.mark.asyncio
async def test_get_current_prices_split_logic(dashboard_service, mock_db):
    """국내 주식과 해외 주식이 올바르게 분류되어 각각의 API를 호출하는지 테스트합니다."""
    
    # Mock Asset 데이터 설정
    def mock_filter(query):
        ticker = query.right.value if hasattr(query, 'right') else ""
        mock_asset = MagicMock(spec=Asset)
        mock_asset.ticker = ticker
        if ticker in ["005930", "000660"]:
            mock_asset.country = "KR"
        else:
            mock_asset.country = "US"
        return MagicMock(first=lambda: mock_asset)

    mock_db.query.return_value.filter.side_effect = mock_filter

    # Mock Kiwoom Auth & API
    dashboard_service.kiwoom_auth.get_valid_token = AsyncMock(return_value="test_token")
    dashboard_service.kiwoom_api.get_bulk_stock_info = MagicMock(return_value={
        "return_code": 0,
        "atn_stk_infr": [
            {"stk_cd": "005930", "cur_prc": "-80000"},
            {"stk_cd": "000660", "cur_prc": "+180000"}
        ]
    })


    # Mock yfinance
    with patch("yfinance.download") as mock_yf:
        mock_yf.return_value = MagicMock(empty=False)
        # yfinance 응답 구조 모사
        mock_yf.return_value.__getitem__.return_value.__getitem__.return_value.iloc = [-1]
        mock_yf.return_value.__getitem__.return_value.dropna.return_value.iloc = [150.0]

        tickers = ["005930", "000660", "AAPL"]
        prices = await dashboard_service.get_current_prices(tickers)

        # 검증
        assert prices["005930"] == 80000.0
        assert prices["000660"] == 180000.0
        assert "AAPL" in prices
        
        # 키움 API는 국내 주식에 대해서만 호출되었는지 확인
        dashboard_service.kiwoom_api.get_bulk_stock_info.assert_called_once()
        args = dashboard_service.kiwoom_api.get_bulk_stock_info.call_args[0]
        assert "005930" in args[1]
        assert "000660" in args[1]
        assert "AAPL" not in args[1]
