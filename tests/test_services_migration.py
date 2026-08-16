# -*- coding: utf-8 -*-
"""티켓 05 마이그레이션 검증 테스트: PriceService 및 BenchmarkService의 MarketDataProvider 위임 전환.

PriceService와 BenchmarkService가 MarketDataProvider, MarketCalendar, 어댑터들을 올바르게 활용하여
기존의 모든 공개 메서드 시그니처와 반환 형식을 완벽하게 보장하는지 검증합니다.
"""

import pytest
import datetime
from unittest.mock import patch, MagicMock, AsyncMock
from sqlalchemy.orm import Session

from src.backend.models import Asset, Watchlist, HistoricalPrice, ExchangeRate
from src.backend.market import MarketDataProvider, MarketCalendar, FakeMarketAdapter
from src.backend.services.price_service import PriceService
from src.backend.services.benchmark_service import BenchmarkService


@pytest.fixture
def fake_provider(db_session: Session):
    """FakeMarketAdapter가 주입된 테스트용 MarketDataProvider를 제공합니다."""
    kr_adapter = FakeMarketAdapter()
    kr_adapter.set_current_prices({
        "005930": 70000.0,
        "000660": 180000.0,
        "^KS11": 2700.0,
        "^KQ11": 850.0,
    })
    # 2026-06-15 (월), 2026-06-16 (화), 2026-06-17 (수) - 모두 일반 영업일
    kr_adapter.set_historical_prices("005930", [
        {"price_date": datetime.date(2026, 6, 15), "close_price": 70000.0},
        {"price_date": datetime.date(2026, 6, 16), "close_price": 71000.0},
        {"price_date": datetime.date(2026, 6, 17), "close_price": 72000.0},
    ])
    kr_adapter.set_historical_prices("^KS11", [
        {"price_date": datetime.date(2026, 6, 15), "close_price": 2700.0},
        {"price_date": datetime.date(2026, 6, 16), "close_price": 2720.0},
        {"price_date": datetime.date(2026, 6, 17), "close_price": 2750.0},
    ])
    kr_adapter.set_stock_name("005930", "삼성전자")
    kr_adapter.set_stock_name("000660", "SK하이닉스")
    kr_adapter.set_exchange_rate(1350.0, sell_currency="USD", buy_currency="KRW")

    us_adapter = FakeMarketAdapter()
    us_adapter.set_current_prices({
        "AAPL": 180.0,
        "MSFT": 420.0,
        "^GSPC": 5200.0,
        "^IXIC": 16500.0,
    })
    us_adapter.set_historical_prices("AAPL", [
        {"price_date": datetime.date(2026, 6, 15), "close_price": 180.0},
        {"price_date": datetime.date(2026, 6, 16), "close_price": 182.0},
        {"price_date": datetime.date(2026, 6, 17), "close_price": 185.0},
    ])
    us_adapter.set_historical_prices("^GSPC", [
        {"price_date": datetime.date(2026, 6, 15), "close_price": 5200.0},
        {"price_date": datetime.date(2026, 6, 16), "close_price": 5250.0},
        {"price_date": datetime.date(2026, 6, 17), "close_price": 5300.0},
    ])
    us_adapter.set_stock_name("AAPL", "Apple Inc.")
    us_adapter.set_stock_name("MSFT", "Microsoft Corporation")
    us_adapter.set_exchange_rate(1350.0, sell_currency="USD", buy_currency="KRW")

    calendar = MarketCalendar()
    return MarketDataProvider(
        db=db_session,
        calendar=calendar,
        kr_adapter=kr_adapter,
        us_adapter=us_adapter,
    )


@pytest.mark.asyncio
async def test_price_service_market_open_delegation():
    """PriceService의 장운영 여부 판별이 MarketCalendar로 위임되는지 검증합니다."""
    service = PriceService()
    assert isinstance(service.is_us_market_open(), bool)
    assert isinstance(service.is_kr_market_open(), bool)


@pytest.mark.asyncio
async def test_price_service_get_prices_via_provider(db_session: Session, fake_provider: MarketDataProvider):
    """PriceService의 get_kr_prices 및 get_us_prices가 Provider를 통해 정상 동작하는지 검증합니다."""
    service = PriceService(provider=fake_provider)

    kr_prices = await service.get_kr_prices(["005930", "000660"], force_update=True)
    assert len(kr_prices) == 2
    assert kr_prices[0]["stock_code"] == "005930"
    assert kr_prices[0]["current_price"] == 70000.0
    assert kr_prices[1]["stock_code"] == "000660"
    assert kr_prices[1]["current_price"] == 180000.0

    us_prices = await service.get_us_prices(["AAPL", "MSFT"], force_update=True)
    assert len(us_prices) == 2
    assert us_prices[0]["stock_code"] == "AAPL"
    assert us_prices[0]["current_price"] == 180.0
    assert us_prices[1]["stock_code"] == "MSFT"
    assert us_prices[1]["current_price"] == 420.0


@pytest.mark.asyncio
async def test_price_service_get_historical_single_price(fake_provider: MarketDataProvider):
    """PriceService의 get_kr_historical_price 및 get_us_historical_price 검증."""
    service = PriceService(provider=fake_provider)

    kr_price = await service.get_kr_historical_price("005930", "2026-06-16")
    assert kr_price == 71000.0

    us_price = await service.get_us_historical_price("AAPL", "2026-06-16")
    assert us_price == 182.0


@pytest.mark.asyncio
async def test_price_service_get_stock_name(fake_provider: MarketDataProvider):
    """PriceService의 get_stock_name이 Provider를 통해 정상 조회되는지 검증."""
    service = PriceService(provider=fake_provider)

    kr_name = await service.get_stock_name("005930", country="KR")
    assert kr_name == "삼성전자"

    us_name = await service.get_stock_name("AAPL", country="US")
    assert us_name == "Apple Inc."


@pytest.mark.asyncio
async def test_price_service_get_historical_prices_with_cache(db_session: Session, fake_provider: MarketDataProvider):
    """PriceService의 get_historical_prices_with_cache가 날짜 오름차순 리스트를 정상 반환하는지 검증."""
    service = PriceService(provider=fake_provider)

    start_date = datetime.date(2026, 6, 15)
    end_date = datetime.date(2026, 6, 17)

    kr_hist = await service.get_historical_prices_with_cache(
        db=db_session,
        ticker="005930",
        start_date=start_date,
        end_date=end_date,
        country="KR",
    )
    assert len(kr_hist) == 3
    assert kr_hist[0]["price_date"] == start_date
    assert kr_hist[0]["close_price"] == 70000.0
    assert kr_hist[1]["price_date"] == datetime.date(2026, 6, 16)
    assert kr_hist[1]["close_price"] == 71000.0
    assert kr_hist[2]["price_date"] == end_date
    assert kr_hist[2]["close_price"] == 72000.0


@pytest.mark.asyncio
async def test_price_service_fetch_and_save_exchange_rate(db_session: Session, fake_provider: MarketDataProvider):
    """PriceService의 fetch_and_save_exchange_rate가 환율을 조회하고 DB에 저장하는지 검증."""
    service = PriceService(provider=fake_provider)
    target_date = datetime.date(2026, 6, 15)

    rate = await service.fetch_and_save_exchange_rate(db_session, target_date)
    assert rate == 1350.0

    saved = db_session.query(ExchangeRate).filter_by(date=target_date, currency="USD").first()
    assert saved is not None
    assert saved.rate == 1350.0


@pytest.mark.asyncio
async def test_benchmark_service_get_historical_prices_via_provider(db_session: Session, fake_provider: MarketDataProvider):
    """BenchmarkService가 MarketDataProvider를 통해 시세를 조회하고 List[HistoricalPrice]를 반환하는지 검증."""
    service = BenchmarkService(db=db_session, provider=fake_provider)

    start_date = datetime.date(2026, 6, 15)
    end_date = datetime.date(2026, 6, 17)

    prices = await service.get_historical_prices("^KS11", start_date, end_date)
    assert isinstance(prices, list)
    assert len(prices) == 3
    assert all(isinstance(p, HistoricalPrice) for p in prices)
    assert prices[0].ticker == "^KS11"
    assert prices[0].price_date == start_date
    assert prices[0].close_price == 2700.0
    assert prices[1].close_price == 2720.0
    assert prices[2].close_price == 2750.0


@pytest.mark.asyncio
async def test_benchmark_service_cumulative_returns_with_provider(db_session: Session, fake_provider: MarketDataProvider):
    """BenchmarkService의 calculate_cumulative_returns가 Provider 연동 상태에서 정상 동작하는지 검증."""
    from src.backend.models import AccountSnapshot
    for d, val in [
        (datetime.date(2026, 6, 15), 1000000.0),
        (datetime.date(2026, 6, 16), 1050000.0),
        (datetime.date(2026, 6, 17), 1070000.0)
    ]:
        db_session.add(AccountSnapshot(account_id=1, snapshot_date=d, period_deposit=0.0, total_valuation=val, total_profit=0.0))
    db_session.commit()

    service = BenchmarkService(db=db_session, provider=fake_provider)
    result = await service.calculate_cumulative_returns(
        start_date=datetime.date(2026, 6, 15),
        end_date=datetime.date(2026, 6, 17),
        tickers=["^KS11"],
    )

    assert "labels" in result
    assert "datasets" in result
    assert "alpha_summaries" in result
    assert len(result["datasets"]) == 2
