# -*- coding: utf-8 -*-
"""테스트용 인메모리 시세 어댑터 (FakeMarketAdapter) 단위 테스트.

네트워크 통신 없이 결정론적으로 동작하는 FakeMarketAdapter의 데이터 주입 및
조회 인터페이스를 검증합니다.
"""

import datetime
import pytest
from src.backend.market.adapters.base import MarketAdapterBase
from src.backend.market.adapters.fake import FakeMarketAdapter


def test_market_adapter_base_is_abc():
    """MarketAdapterBase를 직접 인스턴스화할 수 없는 추상 클래스인지 검증합니다."""
    with pytest.raises(TypeError):
        MarketAdapterBase()  # type: ignore


@pytest.mark.asyncio
async def test_fake_market_adapter_current_prices():
    """현재가 데이터 주입 및 조회 기능을 검증합니다."""
    adapter = FakeMarketAdapter()

    # 1. 단일 종목 주입
    adapter.set_current_price("005930", 75000.0, 1.35)
    
    # 2. 일괄 종목 주입 (딕셔너리 및 리스트 포맷 지원)
    adapter.set_current_prices({
        "000660": 180000.0,
        "AAPL": 220.5
    })

    # 3. 조회 검증
    results = await adapter.get_current_prices(["005930", "000660", "AAPL", "UNKNOWN_TICKER"])
    assert len(results) == 4

    res_map = {r["stock_code"]: r for r in results}
    assert res_map["005930"] == {
        "stock_code": "005930",
        "current_price": 75000.0,
        "change_rate": 1.35
    }
    assert res_map["000660"]["current_price"] == 180000.0
    assert res_map["AAPL"]["current_price"] == 220.5
    # 미등록 종목은 0.0 기본값 반환
    assert res_map["UNKNOWN_TICKER"] == {
        "stock_code": "UNKNOWN_TICKER",
        "current_price": 0.0,
        "change_rate": 0.0
    }


@pytest.mark.asyncio
async def test_fake_market_adapter_historical_prices():
    """과거 일별 시세 데이터 주입 및 기간별 조회 기능을 검증합니다."""
    adapter = FakeMarketAdapter()

    # 데이터 주입
    adapter.set_historical_price("005930", datetime.date(2026, 6, 1), 70000.0)
    adapter.set_historical_price("005930", datetime.date(2026, 6, 2), 71000.0)
    adapter.set_historical_price("005930", datetime.date(2026, 6, 5), 73000.0)
    adapter.set_historical_price("005930", datetime.date(2026, 6, 10), 75000.0)

    # 1. 특정 구간 조회 (2026-06-02 ~ 2026-06-08)
    history = await adapter.get_historical_prices(
        "005930",
        datetime.date(2026, 6, 2),
        datetime.date(2026, 6, 8)
    )

    assert len(history) == 2
    assert history[0] == {"price_date": datetime.date(2026, 6, 2), "close_price": 71000.0}
    assert history[1] == {"price_date": datetime.date(2026, 6, 5), "close_price": 73000.0}

    # 2. 미등록 종목 조회 시 빈 리스트 반환
    unknown_history = await adapter.get_historical_prices(
        "UNKNOWN",
        datetime.date(2026, 6, 1),
        datetime.date(2026, 6, 10)
    )
    assert unknown_history == []


@pytest.mark.asyncio
async def test_fake_market_adapter_stock_name():
    """종목명 주입 및 조회 기능을 검증합니다."""
    adapter = FakeMarketAdapter()
    adapter.set_stock_name("005930", "삼성전자")
    adapter.set_stock_name("AAPL", "Apple Inc.")

    assert await adapter.get_stock_name("005930") == "삼성전자"
    assert await adapter.get_stock_name("AAPL") == "Apple Inc."
    assert await adapter.get_stock_name("NON_EXISTENT") is None


@pytest.mark.asyncio
async def test_fake_market_adapter_exchange_rate():
    """환율 데이터 주입 및 조회 기능을 검증합니다."""
    adapter = FakeMarketAdapter()
    adapter.set_exchange_rate(1350.50, sell_currency="USD", buy_currency="KRW")

    assert await adapter.get_exchange_rate("USD", "KRW") == 1350.50
    # 동일 통화는 1.0 반환
    assert await adapter.get_exchange_rate("USD", "USD") == 1.0
    assert await adapter.get_exchange_rate("KRW", "KRW") == 1.0
    # 미등록 통화쌍은 None 반환
    assert await adapter.get_exchange_rate("EUR", "KRW") is None


@pytest.mark.asyncio
async def test_fake_market_adapter_market_indices():
    """시장 지수 주입 및 조회 기능을 검증합니다."""
    adapter = FakeMarketAdapter()

    # 1. 기본값 반환 검증
    kr_defaults = await adapter.get_market_indices("KR")
    assert len(kr_defaults) == 2
    assert [idx["index_name"] for idx in kr_defaults] == ["KOSPI", "KOSDAQ"]

    us_defaults = await adapter.get_market_indices("US")
    assert len(us_defaults) == 3
    assert [idx["index_name"] for idx in us_defaults] == ["S&P 500", "NASDAQ", "DOW JONES"]

    # 2. 커스텀 지수 주입 후 조회 검증
    custom_kr = [
        {"index_name": "KOSPI", "current_price": 2800.0, "change_rate": 1.5},
        {"index_name": "KOSDAQ", "current_price": 900.0, "change_rate": -0.8},
    ]
    adapter.set_market_indices(custom_kr, country="KR")

    kr_result = await adapter.get_market_indices("KR")
    assert kr_result == custom_kr


@pytest.mark.asyncio
async def test_fake_market_adapter_clear():
    """데이터 초기화(clear) 기능을 검증합니다."""
    adapter = FakeMarketAdapter()
    adapter.set_current_price("005930", 75000.0)
    adapter.set_stock_name("005930", "삼성전자")
    adapter.set_exchange_rate(1350.0, "USD", "KRW")

    adapter.clear()

    prices = await adapter.get_current_prices(["005930"])
    assert prices[0]["current_price"] == 0.0
    assert await adapter.get_stock_name("005930") is None
    assert await adapter.get_exchange_rate("USD", "KRW") is None
