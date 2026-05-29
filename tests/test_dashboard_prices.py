import pytest
import datetime
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
    
    # Mock Asset 데이터 및 HistoricalPrice 캐시 미스 설정
    from src.backend.models import Asset, HistoricalPrice

    def mock_query(model):
        if model == Asset:
            mock_query_obj = MagicMock()
            def mock_filter(query):
                ticker = query.right.value if hasattr(query, 'right') else ""
                mock_asset = MagicMock(spec=Asset)
                mock_asset.ticker = ticker
                if ticker in ["005930", "000660"]:
                    mock_asset.country = "KR"
                else:
                    mock_asset.country = "US"
                return MagicMock(first=lambda: mock_asset)
            mock_query_obj.filter.side_effect = mock_filter
            return mock_query_obj
        else:
            mock_query_obj = MagicMock()
            mock_query_obj.filter.return_value.order_by.return_value.first.return_value = None
            return mock_query_obj

    mock_db.query.side_effect = mock_query

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


@pytest.mark.asyncio
async def test_get_current_prices_cache_hit_under_closed_market(dashboard_service, mock_db):
    """장외 시간이고 force_update=False일 때 DB 가격이 존재하면 yfinance를 호출하지 않고 반환하는지 테스트합니다."""
    
    # 1. Mock DB 설정 (HistoricalPrice 쿼리 결과로 mock_price 반환)
    from src.backend.models import HistoricalPrice, Asset
    mock_price = MagicMock(spec=HistoricalPrice)
    mock_price.close_price = 150.0
    mock_price.price_date = datetime.date.today()
    
    mock_asset = MagicMock(spec=Asset)
    mock_asset.country = "US"
    mock_asset.ticker = "AAPL"
    
    # query.filter().order_by() 등 체이닝 대응
    mock_db.query.return_value.filter.return_value.order_by.return_value.first.return_value = mock_price
    mock_db.query.return_value.filter.return_value.first.return_value = mock_asset

    # 2. 장외 시간으로 모킹
    dashboard_service.is_us_market_open = MagicMock(return_value=False)

    # 3. yfinance download 모킹 (절대 호출되면 안 됨)
    with patch("yfinance.download") as mock_yf:
        prices = await dashboard_service.get_current_prices(["AAPL"], force_update=False)
        
        # 검증
        assert prices["AAPL"] == 150.0
        mock_yf.assert_not_called()  # yfinance 호출되지 않음


@pytest.mark.asyncio
async def test_get_current_prices_cache_miss_under_open_market(dashboard_service, mock_db):
    """장중 시간 또는 force_update=True일 때 캐시를 타지 않고 yfinance를 강제 호출하는지 테스트합니다."""
    
    # 1. Mock DB 설정
    from src.backend.models import HistoricalPrice, Asset
    mock_price = MagicMock(spec=HistoricalPrice)
    mock_price.close_price = 150.0
    
    mock_asset = MagicMock(spec=Asset)
    mock_asset.country = "US"
    mock_asset.ticker = "AAPL"
    
    mock_db.query.return_value.filter.return_value.order_by.return_value.first.return_value = mock_price
    mock_db.query.return_value.filter.return_value.first.return_value = mock_asset

    # 2. 장중 시간으로 모킹
    dashboard_service.is_us_market_open = MagicMock(return_value=True)

    # 3. yfinance download 모킹 (호출되어 새 시세를 가져와야 함)
    with patch("yfinance.download") as mock_yf:
        mock_yf.return_value = MagicMock(empty=False)
        mock_yf.return_value.__getitem__.return_value.dropna.return_value.iloc = [180.0]
        
        # force_update = False 이지만 장중(market_open = True)이므로 yfinance 호출 필요
        prices = await dashboard_service.get_current_prices(["AAPL"], force_update=False)
        
        # 검증
        assert prices["AAPL"] == 180.0
        mock_yf.assert_called_once()
