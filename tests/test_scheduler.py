import pytest
import datetime
from unittest.mock import patch, AsyncMock, MagicMock
from sqlalchemy.orm import Session

from src.backend.models import Asset, Watchlist, HistoricalPrice
from src.backend.services.price_service import price_service


def test_is_market_holiday():
    """휴장일 판별 헬퍼 함수가 정상적으로 동작하는지 검증합니다."""
    # 주말 판정 (토요일)
    sat = datetime.date(2026, 6, 27)  # 토요일
    assert price_service.is_market_holiday(sat, "KR") is True
    assert price_service.is_market_holiday(sat, "US") is True

    # 평일 영업일 판정 (수요일)
    wed = datetime.date(2026, 6, 24)  # 수요일
    assert price_service.is_market_holiday(wed, "KR") is False
    assert price_service.is_market_holiday(wed, "US") is False

    # 한국 공휴일 판정 (삼일절)
    samil = datetime.date(2026, 3, 1)  # 삼일절 (공휴일)
    # 2026년 3월 1일은 일요일이므로 삼일절 자체는 휴일
    # 2026년 3월 2일 월요일은 삼일절 대체공휴일
    samil_alt = datetime.date(2026, 3, 2)
    assert price_service.is_market_holiday(samil, "KR") is True
    assert price_service.is_market_holiday(samil_alt, "KR") is True

    # 제헌절 판정 (7월 17일 - 한국거래소 영업일)
    jeheon = datetime.date(2026, 7, 17)
    assert price_service.is_market_holiday(jeheon, "KR") is False

    # 근로자의 날 판정 (5월 1일 - 한국거래소 휴장일)
    labor_day = datetime.date(2026, 5, 1)
    assert price_service.is_market_holiday(labor_day, "KR") is True

    # 미국 공휴일 판정 (독립기념일 7월 4일)
    # 2026년 7월 4일은 토요일이므로 7월 3일 금요일이 대체휴일(observed)
    independence_obs = datetime.date(2026, 7, 3)
    assert price_service.is_market_holiday(independence_obs, "US") is True


@pytest.mark.asyncio
async def test_update_all_market_prices_normal_day(db_session: Session):
    """영업일일 때 지수, 보유자산, 관심종목의 가격 정보가 DB에 정상 적재되는지 검증합니다."""
    # 테스트 데이터 준비
    # 1. 현금이 아닌 자산 등록
    asset_kr = Asset(ticker="005930", name="삼성전자", major_category="일반주식", sub_category="국내주식", country="KR")
    asset_us = Asset(ticker="AAPL", name="애플", major_category="일반주식", sub_category="해외주식", country="US")
    # 현금 자산 (업데이트 제외 대상)
    asset_cash = Asset(ticker="KRW", name="원화예수금", major_category="현금", sub_category="원화예수금", country="KR")
    
    # 2. 관심 종목 등록
    watchlist_kr = Watchlist(stock_code="000660", stock_name="SK하이닉스", country="KR")
    watchlist_us = Watchlist(stock_code="MSFT", stock_name="마이크로소프트", country="US")

    db_session.add_all([asset_kr, asset_us, asset_cash, watchlist_kr, watchlist_us])
    db_session.commit()

    # 영업일 날짜 설정 (2026-06-24 수요일)
    today = datetime.date(2026, 6, 24)

    # 외부 API 모킹
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
         patch.object(price_service, "_get_today", return_value=today):

        # 백그라운드 시세 업데이트 실행
        await price_service.update_all_market_prices()

        # DB 검증
        # 1. 한국 지수 적재 확인
        ks = db_session.query(HistoricalPrice).filter_by(ticker="^KS11", price_date=today).first()
        assert ks is not None
        assert ks.close_price == 2750.0

        # 2. 한국 주식 적재 확인
        samsung = db_session.query(HistoricalPrice).filter_by(ticker="005930", price_date=today).first()
        assert samsung is not None
        assert samsung.close_price == 75000.0

        # 3. 미국 주식 적재 확인
        aapl = db_session.query(HistoricalPrice).filter_by(ticker="AAPL", price_date=today).first()
        assert aapl is not None
        assert aapl.close_price == 185.0

        # 4. 현금(KRW)은 적재되지 않았음을 확인
        krw = db_session.query(HistoricalPrice).filter_by(ticker="KRW", price_date=today).first()
        assert krw is None


@pytest.mark.asyncio
async def test_update_all_market_prices_kr_holiday(db_session: Session):
    """한국 휴장일인 경우 한국 지수/자산 업데이트는 생략하고 미국 지수/자산만 업데이트되는지 검증합니다."""
    asset_kr = Asset(ticker="005930", name="삼성전자", major_category="일반주식", sub_category="국내주식", country="KR")
    asset_us = Asset(ticker="AAPL", name="애플", major_category="일반주식", sub_category="해외주식", country="US")
    db_session.add_all([asset_kr, asset_us])
    db_session.commit()

    # 한국 휴장일 날짜 설정 (2026-05-01 근로자의 날 - 금요일)
    # 미국은 정상 영업일임
    today = datetime.date(2026, 5, 1)

    mock_get_kr = AsyncMock()
    mock_get_us = AsyncMock(return_value=[
        {"stock_code": "^GSPC", "current_price": 5000.0, "change_rate": 0.5},
        {"stock_code": "^IXIC", "current_price": 16000.0, "change_rate": 0.8},
        {"stock_code": "AAPL", "current_price": 170.0, "change_rate": 0.2}
    ])

    with patch.object(price_service, "get_kr_prices", mock_get_kr), \
         patch.object(price_service, "get_us_prices", mock_get_us), \
         patch.object(price_service, "_get_today", return_value=today):

        await price_service.update_all_market_prices()

        # 한국 관련 API는 호출되지 않았어야 함
        mock_get_kr.assert_not_called()
        
        # 미국 관련 API는 호출되었어야 함
        mock_get_us.assert_called_once()

        # DB 검증
        # 미국 관련 가격은 업데이트됨
        aapl = db_session.query(HistoricalPrice).filter_by(ticker="AAPL", price_date=today).first()
        assert aapl is not None
        assert aapl.close_price == 170.0

        # 한국 관련 가격은 업데이트 안 됨
        samsung = db_session.query(HistoricalPrice).filter_by(ticker="005930", price_date=today).first()
        assert samsung is None
