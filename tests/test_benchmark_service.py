# -*- coding: utf-8 -*-
"""BenchmarkService 단위 및 통합 테스트 모듈입니다."""

import pytest
import datetime
from unittest.mock import patch, MagicMock, AsyncMock
import pandas as pd
from sqlalchemy.orm import Session

from src.backend.models import AccountSnapshot, HistoricalPrice, Watchlist
from src.backend.market import MarketDataProvider, MarketCalendar, FakeMarketAdapter
from src.backend.services.benchmark_service import BenchmarkService


@pytest.fixture
def fake_market_provider(db_session: Session):
    """테스트용 FakeMarketAdapter가 설정된 MarketDataProvider를 제공합니다."""
    kr_adapter = FakeMarketAdapter()
    us_adapter = FakeMarketAdapter()
    return MarketDataProvider(
        db=db_session,
        calendar=MarketCalendar(),
        kr_adapter=kr_adapter,
        us_adapter=us_adapter
    )


@pytest.fixture
def benchmark_service(db_session: Session, fake_market_provider: MarketDataProvider):
    """테스트용 BenchmarkService 인스턴스를 제공합니다."""
    return BenchmarkService(db_session, provider=fake_market_provider)


@pytest.mark.asyncio
async def test_calculate_cumulative_returns_normal(benchmark_service, db_session):
    """포트폴리오 평가액과 지수 종가 시계열을 바탕으로 한 누적 수익률 정규화 계산 테스트"""
    # 1. 테스트용 포트폴리오 스냅샷 생성
    # 2026-06-15 ~ 2026-06-19 일자별 평가액
    dates = [
        datetime.date(2026, 6, 15),
        datetime.date(2026, 6, 16),
        datetime.date(2026, 6, 17),
    ]
    for i, d in enumerate(dates):
        val = 1000000 + (50000 if i == 1 else (70000 if i == 2 else 0))
        snapshot = AccountSnapshot(
            account_id=2,
            snapshot_date=d,
            period_deposit=0.0,
            total_valuation=val,
            total_profit=0.0
        )
        db_session.add(snapshot)

    # 2. 지수 가격 데이터 주입
    kospi_prices = [
        (datetime.date(2026, 6, 15), 2500.0),
        (datetime.date(2026, 6, 16), 2550.0),
        (datetime.date(2026, 6, 17), 2600.0),
    ]
    for d, price in kospi_prices:
        p = HistoricalPrice(
            ticker="^KS11",
            price_date=d,
            close_price=price
        )
        db_session.add(p)

    db_session.commit()

    # 3. 비즈니스 로직 호출
    result = await benchmark_service.calculate_cumulative_returns(
        start_date=datetime.date(2026, 6, 15),
        end_date=datetime.date(2026, 6, 17),
        tickers=["^KS11"]
    )

    # 4. 검증
    assert result["labels"] == ["2026-06-15", "2026-06-16", "2026-06-17"]

    portfolio_dataset = next(ds for ds in result["datasets"] if ds["label"] == "내 포트폴리오")
    assert portfolio_dataset["data"] == [0.0, 5.0, 7.0]

    kospi_dataset = next(ds for ds in result["datasets"] if ds["label"] == "KOSPI")
    assert kospi_dataset["data"] == [0.0, 2.0, 4.0]

    alpha_kospi = next(summary for summary in result["alpha_summaries"] if summary["benchmark"] == "KOSPI")
    assert alpha_kospi["benchmark_return"] == 4.0
    assert alpha_kospi["portfolio_return"] == 7.0
    assert alpha_kospi["alpha"] == 3.0
    assert alpha_kospi["judgment"] == "시장 상회"


@pytest.mark.asyncio
async def test_sync_historical_prices_lazy(benchmark_service, fake_market_provider, db_session):
    """MarketDataProvider 연동 및 지연 캐싱(Lazy Caching) 검증"""
    ticker = "^KS11"
    start_date = datetime.date(2026, 6, 15)
    end_date = datetime.date(2026, 6, 15)

    kr_adapter = fake_market_provider.get_adapter("KR")
    kr_adapter.set_historical_prices(ticker, [
        {"price_date": start_date, "close_price": 2500.0}
    ])

    # 1. 로컬 DB에 데이터가 없을 때 어댑터를 통해 조회 및 캐싱
    prices = await benchmark_service.get_historical_prices(ticker, start_date, end_date)
    assert len(prices) == 1
    assert prices[0].close_price == 2500.0
    assert prices[0].price_date == start_date

    # DB에 적재되었는지 확인
    cached = db_session.query(HistoricalPrice).filter_by(ticker=ticker).all()
    assert len(cached) >= 1

    # 2. 두 번째 호출 시에는 DB 캐시를 활용하여 조회되는지 검증
    with patch.object(kr_adapter, "get_historical_prices", new_callable=AsyncMock) as mock_fetch:
        prices_cached = await benchmark_service.get_historical_prices(ticker, start_date, end_date)
        mock_fetch.assert_not_called()
        assert len(prices_cached) == 1
        assert prices_cached[0].close_price == 2500.0


@pytest.mark.asyncio
async def test_get_watchlist_historical_returns(benchmark_service, fake_market_provider, db_session):
    """관심 종목의 과거 시계열 데이터 조회 및 정규화 리턴 검증 (Lazy Loading)"""
    start_date = datetime.date(2026, 6, 15)
    end_date = datetime.date(2026, 6, 17)

    kr_adapter = fake_market_provider.get_adapter("KR")
    kr_adapter.set_historical_prices("^KS11", [
        {"price_date": datetime.date(2026, 6, 15), "close_price": 2500.0},
        {"price_date": datetime.date(2026, 6, 16), "close_price": 2550.0},
        {"price_date": datetime.date(2026, 6, 17), "close_price": 2600.0},
    ])

    us_adapter = fake_market_provider.get_adapter("US")
    us_adapter.set_historical_prices("AAPL", [
        {"price_date": datetime.date(2026, 6, 15), "close_price": 100.0},
        {"price_date": datetime.date(2026, 6, 16), "close_price": 105.0},
        {"price_date": datetime.date(2026, 6, 17), "close_price": 110.0},
    ])

    # 관심 종목 추가
    watchlist_item = Watchlist(
        stock_code="AAPL",
        stock_name="Apple",
        country="US"
    )
    db_session.add(watchlist_item)
    db_session.commit()

    # AAPL 데이터 조회
    result = await benchmark_service.get_watchlist_returns(
        ticker="AAPL",
        start_date=start_date,
        end_date=end_date
    )

    # 검증
    # 6/15: (100/100-1)*100 = 0%
    # 6/16: (105/100-1)*100 = 5%
    # 6/17: (110/100-1)*100 = 10%
    assert result["ticker"] == "AAPL"
    assert result["labels"] == ["2026-06-15", "2026-06-16", "2026-06-17"]
    assert result["data"] == [0.0, 5.0, 10.0]


@pytest.mark.asyncio
async def test_calculate_cumulative_returns_with_weekend_deposit(benchmark_service, db_session):
    """주말(비영업일)에 발생한 입금액과 자산 스냅샷이 누락되지 않고 누적 수익률에 반영되는지 검증하는 테스트"""
    # 2026-06-19(금) ~ 2026-06-23(화)
    # 6/19(금) 자산: 1,000,000, 입금: 0
    # 6/20(토) 자산: 1,050,000, 입금: 50,000 (주말 입금 발생)
    # 6/22(월) 자산: 1,100,000, 입금: 0
    # 6/23(화) 자산: 1,120,000, 입금: 0
    d_fri = datetime.date(2026, 6, 19)
    d_sat = datetime.date(2026, 6, 20)
    d_mon = datetime.date(2026, 6, 22)
    d_tue = datetime.date(2026, 6, 23)

    snapshots = [
        AccountSnapshot(account_id=2, snapshot_date=d_fri, period_deposit=0.0, total_valuation=1000000.0, total_profit=0.0),
        AccountSnapshot(account_id=2, snapshot_date=d_sat, period_deposit=50000.0, total_valuation=1050000.0, total_profit=0.0),
        AccountSnapshot(account_id=2, snapshot_date=d_mon, period_deposit=0.0, total_valuation=1100000.0, total_profit=0.0),
        AccountSnapshot(account_id=2, snapshot_date=d_tue, period_deposit=0.0, total_valuation=1120000.0, total_profit=0.0),
    ]
    for s in snapshots:
        db_session.add(s)

    kospi_prices = [
        (d_fri, 2500.0),
        (d_mon, 2550.0),
        (d_tue, 2600.0),
    ]
    for d, price in kospi_prices:
        p = HistoricalPrice(ticker="^KS11", price_date=d, close_price=price)
        db_session.add(p)

    db_session.commit()

    result = await benchmark_service.calculate_cumulative_returns(
        start_date=d_fri,
        end_date=d_tue,
        tickers=["^KS11"]
    )

    assert result["labels"] == ["2026-06-19", "2026-06-22", "2026-06-23"]

    portfolio_dataset = next(ds for ds in result["datasets"] if ds["label"] == "내 포트폴리오")
    assert portfolio_dataset["data"] == [0.0, 4.76, 6.67]
    assert result["portfolio_final_valuation"] == 1120000.0


@pytest.mark.asyncio
async def test_calculate_cumulative_returns_with_holiday_zero_price(benchmark_service, db_session):
    """공휴일 등의 이유로 특정 지수의 가격이 0.0으로 저장되어 있을 때, 이전 영업일 가격으로 보간되는지 검증"""
    d1 = datetime.date(2026, 6, 15)
    d2 = datetime.date(2026, 6, 16)
    d3 = datetime.date(2026, 6, 17)

    snapshots = [
        AccountSnapshot(account_id=2, snapshot_date=d1, period_deposit=0.0, total_valuation=1000000.0, total_profit=0.0),
        AccountSnapshot(account_id=2, snapshot_date=d2, period_deposit=0.0, total_valuation=1000000.0, total_profit=0.0),
        AccountSnapshot(account_id=2, snapshot_date=d3, period_deposit=0.0, total_valuation=1000000.0, total_profit=0.0),
    ]
    for s in snapshots:
        db_session.add(s)

    kospi_prices = [
        (d1, 2500.0),
        (d2, 0.0),
        (d3, 2600.0),
    ]
    gspc_prices = [
        (d1, 4000.0),
        (d2, 4100.0),
        (d3, 4200.0),
    ]

    for d, price in kospi_prices:
        db_session.add(HistoricalPrice(ticker="^KS11", price_date=d, close_price=price))
    for d, price in gspc_prices:
        db_session.add(HistoricalPrice(ticker="^GSPC", price_date=d, close_price=price))

    db_session.commit()

    result = await benchmark_service.calculate_cumulative_returns(
        start_date=d1,
        end_date=d3,
        tickers=["^KS11", "^GSPC"]
    )

    assert result["labels"] == ["2026-06-15", "2026-06-16", "2026-06-17"]

    kospi_dataset = next(ds for ds in result["datasets"] if ds["label"] == "KOSPI")
    assert kospi_dataset["data"] == [0.0, 0.0, 4.0]


@pytest.mark.asyncio
async def test_calculate_cumulative_returns_with_missing_snapshots(benchmark_service, db_session):
    """중간 및 최종 날짜에 포트폴리오 스냅샷이 누락된 경우 해당 날짜의 포트폴리오 수익률이 None이 되며, 초과수익률은 가장 최근 유효 값으로 정상 계산되는지 검증하는 테스트"""
    d1 = datetime.date(2026, 6, 15)
    d2 = datetime.date(2026, 6, 16)
    d3 = datetime.date(2026, 6, 17)

    snapshots = [
        AccountSnapshot(account_id=2, snapshot_date=d1, period_deposit=0.0, total_valuation=1000000.0, total_profit=0.0),
        AccountSnapshot(account_id=2, snapshot_date=d2, period_deposit=0.0, total_valuation=1100000.0, total_profit=0.0),
    ]
    for s in snapshots:
        db_session.add(s)

    kospi_prices = [
        (d1, 2500.0),
        (d2, 2550.0),
        (d3, 2600.0),
    ]
    for d, price in kospi_prices:
        db_session.add(HistoricalPrice(ticker="^KS11", price_date=d, close_price=price))

    db_session.commit()

    result = await benchmark_service.calculate_cumulative_returns(
        start_date=d1,
        end_date=d3,
        tickers=["^KS11"]
    )

    portfolio_dataset = next(ds for ds in result["datasets"] if ds["label"] == "내 포트폴리오")
    assert portfolio_dataset["data"] == [0.0, 10.0, None]

    alpha_kospi = next(summary for summary in result["alpha_summaries"] if summary["benchmark"] == "KOSPI")
    assert alpha_kospi["benchmark_return"] == 4.0
    assert alpha_kospi["portfolio_return"] == 10.0
    assert alpha_kospi["alpha"] == 6.0


@pytest.mark.asyncio
async def test_get_comparison_tables(benchmark_service, db_session):
    """연간 및 일간 수익률 비교표 데이터 생성 로직 검증"""
    snapshots = [
        AccountSnapshot(account_id=2, snapshot_date=datetime.date(2025, 5, 1), period_deposit=0.0, total_valuation=1000000.0, total_profit=0.0),
        AccountSnapshot(account_id=2, snapshot_date=datetime.date(2025, 12, 31), period_deposit=0.0, total_valuation=1200000.0, total_profit=0.0),
        AccountSnapshot(account_id=2, snapshot_date=datetime.date(2026, 5, 1), period_deposit=100000.0, total_valuation=1300000.0, total_profit=0.0),
        AccountSnapshot(account_id=2, snapshot_date=datetime.date(2026, 5, 5), period_deposit=0.0, total_valuation=1500000.0, total_profit=0.0),
    ]
    for s in snapshots:
        db_session.add(s)

    kospi_prices = [
        (datetime.date(2025, 1, 2), 2000.0),
        (datetime.date(2025, 5, 1), 2050.0),
        (datetime.date(2025, 12, 30), 2200.0),
        (datetime.date(2025, 12, 31), 2200.0),
        (datetime.date(2026, 1, 2), 2200.0),
        (datetime.date(2026, 5, 1), 2300.0),
        (datetime.date(2026, 5, 5), 2420.0),
    ]
    for d, price in kospi_prices:
        for ticker in ["^KS11", "^KQ11", "^GSPC", "^IXIC"]:
            db_session.add(HistoricalPrice(ticker=ticker, price_date=d, close_price=price))

    db_session.commit()

    result = await benchmark_service.get_comparison_tables()

    assert "yearly" in result
    yearly = result["yearly"]
    assert len(yearly) == 2

    assert yearly[0]["year"] == 2026
    assert yearly[1]["year"] == 2025

    assert yearly[1]["kospi"] == 10.0
    assert yearly[0]["kospi"] == 10.0

    assert "daily" in result
    daily = result["daily"]
    assert len(daily) == 4

    assert daily[0]["date"] == "2026-05-05"
    assert daily[1]["date"] == "2026-05-01"
    assert daily[2]["date"] == "2025-12-31"
    assert daily[3]["date"] == "2025-05-01"

    assert daily[3]["kospi"] == 0.0
    assert daily[2]["kospi"] == 7.32
    assert daily[1]["kospi"] == 4.55
    assert daily[0]["kospi"] == 5.22


@pytest.mark.asyncio
async def test_sync_historical_prices_needs_fetch_threshold(fake_market_provider, benchmark_service, db_session):
    """누락된 영업일 구간이 있을 때 어댑터 조회가 호출되는지 검증"""
    # 2026-06-15(월) ~ 2026-06-17(수)
    d_start = datetime.date(2026, 6, 15)
    d_end = datetime.date(2026, 6, 17)

    # 6/15(월) 데이터만 DB에 캐시되어 있고 6/16(화), 6/17(수) 데이터는 누락된 상태
    p = HistoricalPrice(
        ticker="^KS11",
        price_date=d_start,
        close_price=2500.0
    )
    db_session.add(p)
    db_session.commit()

    kr_adapter = fake_market_provider.get_adapter("KR")
    kr_adapter.set_historical_prices("^KS11", [
        {"price_date": datetime.date(2026, 6, 16), "close_price": 2520.0},
        {"price_date": d_end, "close_price": 2550.0}
    ])

    with patch.object(kr_adapter, "get_historical_prices", wraps=kr_adapter.get_historical_prices) as mock_fetch:
        prices = await benchmark_service.get_historical_prices("^KS11", d_start, d_end)
        # 누락 구간이 존재하므로 어댑터가 호출되었는지 검증
        assert mock_fetch.call_count >= 1
        assert len(prices) == 3
