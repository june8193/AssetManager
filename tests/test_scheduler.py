import pytest
import datetime
from unittest.mock import patch, AsyncMock, MagicMock
from sqlalchemy.orm import Session

from src.backend.models import Asset, Watchlist, HistoricalPrice
from src.backend.services.price_service import price_service


@pytest.mark.asyncio
async def test_is_market_holiday():
    """휴장일 판별 헬퍼 함수가 정상적으로 동작하는지 검증합니다."""
    # 1. 주말 판정 (외부 API 호출 없이 주말 판정)
    sat = datetime.date(2026, 6, 27)  # 토요일
    assert await price_service.is_market_holiday(sat, "KR") is True
    assert await price_service.is_market_holiday(sat, "US") is True

    # 2. 키움 API 질의 시 영업일(False) 리턴
    wed = datetime.date(2026, 6, 24)  # 수요일
    with patch.object(price_service, "_query_kiwoom_holiday_api", new_callable=AsyncMock, return_value=False):
        assert await price_service.is_market_holiday(wed, "KR") is False
        assert await price_service.is_market_holiday(wed, "US") is False

    # 3. 키움 API 질의 시 휴장일(True) 리턴
    labor_day = datetime.date(2026, 5, 1)
    with patch.object(price_service, "_query_kiwoom_holiday_api", new_callable=AsyncMock, return_value=True):
        assert await price_service.is_market_holiday(labor_day, "KR") is True
        assert await price_service.is_market_holiday(labor_day, "US") is True

    # 4. 키움 API 호출 실패(None) 시 RuntimeError 예외 발생 검증
    with patch.object(price_service, "_query_kiwoom_holiday_api", new_callable=AsyncMock, return_value=None):
        with pytest.raises(RuntimeError):
            await price_service.is_market_holiday(wed, "KR")


@pytest.mark.asyncio
async def test_update_all_market_prices_normal_day(db_session: Session):
    """영업일일 때 지수, 보유자산, 관심종목의 가격 정보가 DB에 정상 적재되는지 검증합니다."""
    asset_kr = Asset(ticker="005930", name="삼성전자", major_category="일반주식", sub_category="국내주식", country="KR")
    asset_us = Asset(ticker="AAPL", name="애플", major_category="일반주식", sub_category="해외주식", country="US")
    asset_cash = Asset(ticker="KRW", name="원화예수금", major_category="현금", sub_category="원화예수금", country="KR")
    
    watchlist_kr = Watchlist(stock_code="000660", stock_name="SK하이닉스", country="KR")
    watchlist_us = Watchlist(stock_code="MSFT", stock_name="마이크로소프트", country="US")

    db_session.add_all([asset_kr, asset_us, asset_cash, watchlist_kr, watchlist_us])
    db_session.commit()

    today = datetime.date(2026, 6, 24)

    mock_get_kr = AsyncMock(return_value=[
        {"stock_code": "005930", "current_price": 75000.0, "change_rate": 1.2},
        {"stock_code": "000660", "current_price": 180000.0, "change_rate": -0.5}
    ])
    mock_get_us = AsyncMock(return_value=[
        {"stock_code": "^KS11", "current_price": 2750.0, "change_rate": 0.5},
        {"stock_code": "^KQ11", "current_price": 850.0, "change_rate": -0.2},
        {"stock_code": "^GSPC", "current_price": 5400.0, "change_rate": 0.8},
        {"stock_code": "^IXIC", "current_price": 17500.0, "change_rate": 1.1},
        {"stock_code": "AAPL", "current_price": 185.0, "change_rate": 0.3},
        {"stock_code": "MSFT", "current_price": 420.0, "change_rate": -0.4}
    ])

    with patch.object(price_service, "get_kr_prices", mock_get_kr), \
         patch.object(price_service, "get_us_prices", mock_get_us), \
         patch.object(price_service, "_get_today", return_value=today), \
         patch.object(price_service, "_get_now", return_value=datetime.datetime(2026, 6, 24, 10, 0, 0)), \
         patch.object(price_service, "_query_kiwoom_holiday_api", new_callable=AsyncMock, return_value=False):

        await price_service.update_all_market_prices()

        ks = db_session.query(HistoricalPrice).filter_by(ticker="^KS11", price_date=today).first()
        assert ks is not None
        assert ks.close_price == 2750.0

        samsung = db_session.query(HistoricalPrice).filter_by(ticker="005930", price_date=today).first()
        assert samsung is not None
        assert samsung.close_price == 75000.0

        aapl = db_session.query(HistoricalPrice).filter_by(ticker="AAPL", price_date=today).first()
        assert aapl is not None
        assert aapl.close_price == 185.0

        krw = db_session.query(HistoricalPrice).filter_by(ticker="KRW", price_date=today).first()
        assert krw is None


@pytest.mark.asyncio
async def test_update_all_market_prices_kr_holiday(db_session: Session):
    """한국 휴장일인 경우 한국 지수/자산 업데이트는 생략하고 미국 지수/자산만 업데이트되는지 검증합니다."""
    asset_kr = Asset(ticker="005930", name="삼성전자", major_category="일반주식", sub_category="국내주식", country="KR")
    asset_us = Asset(ticker="AAPL", name="애플", major_category="일반주식", sub_category="해외주식", country="US")
    db_session.add_all([asset_kr, asset_us])
    db_session.commit()

    today = datetime.date(2026, 5, 1)

    mock_get_kr = AsyncMock()
    mock_get_us = AsyncMock(return_value=[
        {"stock_code": "^GSPC", "current_price": 5000.0, "change_rate": 0.5},
        {"stock_code": "^IXIC", "current_price": 16000.0, "change_rate": 0.8},
        {"stock_code": "AAPL", "current_price": 170.0, "change_rate": 0.2}
    ])

    async def mock_kiwoom_holiday(target_date, country):
        return True if country == "KR" else False

    with patch.object(price_service, "get_kr_prices", mock_get_kr), \
         patch.object(price_service, "get_us_prices", mock_get_us), \
         patch.object(price_service, "_get_today", return_value=today), \
         patch.object(price_service, "_get_now", return_value=datetime.datetime(2026, 5, 1, 10, 0, 0)), \
         patch.object(price_service, "_query_kiwoom_holiday_api", side_effect=mock_kiwoom_holiday):

        await price_service.update_all_market_prices()

        mock_get_kr.assert_not_called()
        mock_get_us.assert_called_once()

        aapl = db_session.query(HistoricalPrice).filter_by(ticker="AAPL", price_date=today).first()
        assert aapl is not None
        assert aapl.close_price == 170.0

        samsung = db_session.query(HistoricalPrice).filter_by(ticker="005930", price_date=today).first()
        assert samsung is None
