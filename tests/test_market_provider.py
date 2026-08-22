# -*- coding: utf-8 -*-
"""MarketDataProvider 파사드 단위 및 통합 테스트 모듈.

어댑터 자동 라우팅, 캐시 우선 조회, 실시간/장외 종가 자동 분기,
누락 구간 자동 어댑터 요청 및 캐싱, Forward-fill 결측치 보정,
환율 및 시장 지수 조회, Pytest Fixture 연동을 검증합니다.
"""

import datetime
from unittest.mock import patch, AsyncMock
import pytest

from src.backend.models import HistoricalPrice
from src.backend.market.calendar import MarketCalendar
from src.backend.market.cache import HistoricalPriceCache
from src.backend.market.adapters.fake import FakeMarketAdapter
from src.backend.market.provider import MarketDataProvider


class TestMarketDataProvider:
    """MarketDataProvider 테스트 스위트."""

    def test_provider_initialization(self, db_session):
        """파사드 객체의 기본 초기화 및 커스텀 인스턴스 주입을 검증합니다."""
        # 1. 기본 생성 (캘린더, 캐시, 어댑터 자동 생성)
        provider = MarketDataProvider(db=db_session)
        assert provider.db is db_session
        assert isinstance(provider.calendar, MarketCalendar)
        assert isinstance(provider.cache, HistoricalPriceCache)
        assert isinstance(provider.get_adapter("KR"), FakeMarketAdapter)
        assert isinstance(provider.get_adapter("US"), FakeMarketAdapter)

        # 2. 커스텀 어댑터 주입 생성
        kr_adapter = FakeMarketAdapter()
        us_adapter = FakeMarketAdapter()
        provider2 = MarketDataProvider(
            db=db_session,
            kr_adapter=kr_adapter,
            us_adapter=us_adapter
        )
        assert provider2.get_adapter("KR") is kr_adapter
        assert provider2.get_adapter("US") is us_adapter

    def test_resolve_country(self, db_session):
        """종목 코드 패턴 및 명시적 인자에 따른 국가 코드 판별을 검증합니다."""
        provider = MarketDataProvider(db=db_session)

        # 6자리 숫자 -> KR
        assert provider.resolve_country("005930") == "KR"
        assert provider.resolve_country("035420") == "KR"

        # .KS / .KQ 접미사 -> KR
        assert provider.resolve_country("005930.KS") == "KR"
        assert provider.resolve_country("035720.KQ") == "KR"

        # 국내 시장 지수 -> KR
        assert provider.resolve_country("^KS11") == "KR"
        assert provider.resolve_country("^KQ11") == "KR"
        assert provider.resolve_country("KOSPI") == "KR"
        assert provider.resolve_country("KOSDAQ") == "KR"

        # 미국 시장 지수 -> US
        assert provider.resolve_country("^GSPC") == "US"
        assert provider.resolve_country("^IXIC") == "US"
        assert provider.resolve_country("^DJI") == "US"
        assert provider.resolve_country("^TNX") == "US"

        # 일반 미국 티커 -> US
        assert provider.resolve_country("AAPL") == "US"
        assert provider.resolve_country("TSLA") == "US"
        assert provider.resolve_country("SPY") == "US"
        assert provider.resolve_country("QQQ") == "US"

        # 명시적 country 인자가 주어진 경우 우선 적용
        assert provider.resolve_country("AAPL", country="KR") == "KR"
        assert provider.resolve_country("005930", country="US") == "US"
        assert provider.resolve_country("005930", country="kr") == "KR"

    def test_get_adapter_routing(self, db_session):
        """국가 코드에 따라 독립적인 어댑터가 반환되는지 검증합니다."""
        kr_adapter = FakeMarketAdapter()
        us_adapter = FakeMarketAdapter()
        provider = MarketDataProvider(
            db=db_session,
            kr_adapter=kr_adapter,
            us_adapter=us_adapter
        )

        assert provider.get_adapter("KR") is kr_adapter
        assert provider.get_adapter("kr") is kr_adapter
        assert provider.get_adapter("US") is us_adapter
        assert provider.get_adapter("us") is us_adapter

    @pytest.mark.asyncio
    async def test_get_current_price_market_closed_uses_cache(self, db_session):
        """장외 시간이고 강제 갱신이 아닌 경우 DB 캐시 시세를 우선 반환하는지 검증합니다."""
        kr_adapter = FakeMarketAdapter()
        kr_adapter.set_current_price("005930", 75000.0, 2.0)
        provider = MarketDataProvider(db=db_session, kr_adapter=kr_adapter)

        today = datetime.date.today()
        # DB에 어제자 종가 캐싱
        provider.cache.upsert_prices("005930", [{"price_date": today, "close_price": 70000.0}])

        # 장외 상태 모킹
        with patch.object(provider.calendar, "is_kr_market_open", return_value=False):
            result = await provider.get_current_price("005930", force_update=False)
            # 어댑터 시세(75000)가 아니라 캐시 시세(70000)가 반환되어야 함
            assert result["stock_code"] == "005930"
            assert result["current_price"] == 70000.0
            assert result["change_rate"] == 0.0

    @pytest.mark.asyncio
    async def test_get_current_price_market_open_fetches_adapter_and_caches(self, db_session):
        """장중인 경우 어댑터에서 실시간 시세를 조회하고 DB 캐시에 갱신하는지 검증합니다."""
        kr_adapter = FakeMarketAdapter()
        kr_adapter.set_current_price("005930", 72000.0, 1.5)
        provider = MarketDataProvider(db=db_session, kr_adapter=kr_adapter)

        # 장중 상태 모킹
        with patch.object(provider.calendar, "is_kr_market_open", return_value=True):
            result = await provider.get_current_price("005930", force_update=False)
            assert result["stock_code"] == "005930"
            assert result["current_price"] == 72000.0
            assert result["change_rate"] == 1.5

            # DB에 오늘 날짜로 캐시되었는지 확인
            cached = provider.cache.get_last_known_price("005930", datetime.date.today())
            assert cached == 72000.0

    @pytest.mark.asyncio
    async def test_get_current_price_force_update_bypasses_cache(self, db_session):
        """장외 시간이라도 force_update=True인 경우 어댑터를 직접 호출하고 캐시를 갱신하는지 검증합니다."""
        kr_adapter = FakeMarketAdapter()
        kr_adapter.set_current_price("005930", 73000.0, 2.5)
        provider = MarketDataProvider(db=db_session, kr_adapter=kr_adapter)

        # 이전 캐시 저장
        today = datetime.date.today()
        provider.cache.upsert_prices("005930", [{"price_date": today, "close_price": 70000.0}])

        with patch.object(provider.calendar, "is_kr_market_open", return_value=False):
            result = await provider.get_current_price("005930", force_update=True)
            assert result["current_price"] == 73000.0
            assert result["change_rate"] == 2.5

            # DB 캐시도 73000으로 갱신되었는지 확인
            cached = provider.cache.get_last_known_price("005930", today)
            assert cached == 73000.0

    @pytest.mark.asyncio
    async def test_get_current_price_cache_miss_fetches_adapter(self, db_session):
        """장외 시간이라도 캐시에 데이터가 없으면 어댑터에서 시세를 수집하는지 검증합니다."""
        kr_adapter = FakeMarketAdapter()
        kr_adapter.set_current_price("005930", 71000.0, 0.5)
        provider = MarketDataProvider(db=db_session, kr_adapter=kr_adapter)

        with patch.object(provider.calendar, "is_kr_market_open", return_value=False):
            result = await provider.get_current_price("005930", force_update=False)
            assert result["current_price"] == 71000.0
            assert result["change_rate"] == 0.5

    @pytest.mark.asyncio
    async def test_get_current_prices_bulk(self, db_session):
        """국내/미국 혼합 복수 종목을 일괄 조회하고 원래 순서를 보존하여 반환하는지 검증합니다."""
        kr_adapter = FakeMarketAdapter()
        kr_adapter.set_current_price("005930", 70000.0, 1.0)
        kr_adapter.set_current_price("035420", 200000.0, -0.5)

        us_adapter = FakeMarketAdapter()
        us_adapter.set_current_price("AAPL", 180.0, 0.8)
        us_adapter.set_current_price("TSLA", 250.0, -1.2)

        provider = MarketDataProvider(
            db=db_session,
            kr_adapter=kr_adapter,
            us_adapter=us_adapter
        )

        tickers = ["TSLA", "005930", "AAPL", "035420"]

        # 장중 상태 모킹
        with patch.object(provider.calendar, "is_kr_market_open", return_value=True):
            with patch.object(provider.calendar, "is_us_market_open", return_value=True):
                results = await provider.get_current_prices_bulk(tickers)

                assert len(results) == 4
                assert results[0] == {"stock_code": "TSLA", "current_price": 250.0, "change_rate": -1.2}
                assert results[1] == {"stock_code": "005930", "current_price": 70000.0, "change_rate": 1.0}
                assert results[2] == {"stock_code": "AAPL", "current_price": 180.0, "change_rate": 0.8}
                assert results[3] == {"stock_code": "035420", "current_price": 200000.0, "change_rate": -0.5}

    @pytest.mark.asyncio
    async def test_get_historical_prices_cache_first_and_fetch_missing(self, db_session):
        """과거 시세 조회 시 누락 구간만 어댑터에서 요청하고 DB에 캐싱하는지 검증합니다."""
        kr_adapter = FakeMarketAdapter()
        # 어댑터에 2026-01-02 ~ 2026-01-09 시세 주입
        kr_adapter.set_historical_prices("005930", {
            datetime.date(2026, 1, 2): 69000.0,
            datetime.date(2026, 1, 5): 70000.0,
            datetime.date(2026, 1, 6): 71000.0,
            datetime.date(2026, 1, 7): 72000.0,
            datetime.date(2026, 1, 8): 71500.0,
            datetime.date(2026, 1, 9): 73000.0,
        })

        provider = MarketDataProvider(db=db_session, kr_adapter=kr_adapter)

        # 1. DB에 1/5과 1/6만 사전 캐싱
        provider.cache.upsert_prices("005930", [
            {"price_date": datetime.date(2026, 1, 5), "close_price": 70000.0},
            {"price_date": datetime.date(2026, 1, 6), "close_price": 71000.0},
        ])

        # 2. 1/2 ~ 1/9 구간 조회 요청
        start = datetime.date(2026, 1, 2)
        end = datetime.date(2026, 1, 9)
        results = await provider.get_historical_prices("005930", start, end, fill_missing=False)

        # 6개 영업일 시세가 모두 반환되어야 함
        assert len(results) == 6
        assert results[0] == {"price_date": datetime.date(2026, 1, 2), "close_price": 69000.0}
        assert results[-1] == {"price_date": datetime.date(2026, 1, 9), "close_price": 73000.0}

        # 3. DB에 누락되었던 1/2, 1/7, 1/8, 1/9 시세가 모두 캐시되었는지 검증
        all_cached = provider.cache.get_cached_prices("005930", start, end)
        assert len(all_cached) == 6

    @pytest.mark.asyncio
    async def test_get_historical_prices_forward_fill(self, db_session):
        """fill_missing=True 설정 시 주말/휴장일 또는 결측일이 직전 종가로 보정되는지 검증합니다."""
        kr_adapter = FakeMarketAdapter()
        # 1/2(금)과 1/6(화) 시세만 어댑터에 존재 (1/5 월요일 결측 상황)
        kr_adapter.set_historical_prices("005930", {
            datetime.date(2026, 1, 2): 69000.0,
            datetime.date(2026, 1, 6): 71000.0,
        })
        provider = MarketDataProvider(db=db_session, kr_adapter=kr_adapter)

        start = datetime.date(2026, 1, 2)
        end = datetime.date(2026, 1, 6)

        # fill_missing=True -> 1/2(금), 1/5(월), 1/6(화) 3개 영업일에 대해 1/5이 69000으로 보정됨
        results = await provider.get_historical_prices("005930", start, end, fill_missing=True)
        assert len(results) == 3
        assert results[0] == {"price_date": datetime.date(2026, 1, 2), "close_price": 69000.0}
        assert results[1] == {"price_date": datetime.date(2026, 1, 5), "close_price": 69000.0}  # Forward-fill
        assert results[2] == {"price_date": datetime.date(2026, 1, 6), "close_price": 71000.0}

    @pytest.mark.asyncio
    async def test_get_stock_name(self, db_session):
        """종목명 조회가 적절한 국가 어댑터로 위임되는지 검증합니다."""
        kr_adapter = FakeMarketAdapter()
        kr_adapter.set_stock_name("005930", "삼성전자")

        us_adapter = FakeMarketAdapter()
        us_adapter.set_stock_name("AAPL", "Apple Inc.")

        provider = MarketDataProvider(
            db=db_session,
            kr_adapter=kr_adapter,
            us_adapter=us_adapter
        )

        assert await provider.get_stock_name("005930") == "삼성전자"
        assert await provider.get_stock_name("AAPL") == "Apple Inc."
        assert await provider.get_stock_name("UNKNOWN") is None

    @pytest.mark.asyncio
    async def test_get_exchange_rate(self, db_session):
        """환율 조회가 KR 어댑터로 위임되는지 검증합니다."""
        kr_adapter = FakeMarketAdapter()
        kr_adapter.set_exchange_rate(1350.0, "USD", "KRW")

        provider = MarketDataProvider(db=db_session, kr_adapter=kr_adapter)

        rate = await provider.get_exchange_rate("USD", "KRW")
        assert rate == 1350.0
        assert await provider.get_exchange_rate("USD", "USD") == 1.0

    @pytest.mark.asyncio
    async def test_get_market_indices(self, db_session):
        """시장 지수 조회가 국가별 어댑터로 위임되는지 검증합니다."""
        kr_adapter = FakeMarketAdapter()
        kr_adapter.set_market_indices([
            {"index_name": "KOSPI", "current_price": 2600.0, "change_rate": 0.5},
            {"index_name": "KOSDAQ", "current_price": 850.0, "change_rate": -0.2},
        ], country="KR")

        us_adapter = FakeMarketAdapter()
        us_adapter.set_market_indices([
            {"index_name": "S&P 500", "current_price": 5000.0, "change_rate": 0.3},
        ], country="US")

        provider = MarketDataProvider(
            db=db_session,
            kr_adapter=kr_adapter,
            us_adapter=us_adapter
        )

        kr_indices = await provider.get_market_indices("KR")
        assert len(kr_indices) == 2
        assert kr_indices[0]["index_name"] == "KOSPI"

        us_indices = await provider.get_market_indices("US")
        assert len(us_indices) == 1
        assert us_indices[0]["index_name"] == "S&P 500"

    def test_package_export(self):
        """src.backend.market 패키지에서 MarketDataProvider가 정상 export되는지 검증합니다."""
        from src.backend.market import MarketDataProvider as ExportedProvider
        assert ExportedProvider is MarketDataProvider

    @pytest.mark.asyncio
    async def test_fixture_fake_market_provider(self, fake_market_provider):
        """conftest.py의 fake_market_provider 픽스처가 정상 동작하는지 검증합니다."""
        assert isinstance(fake_market_provider, MarketDataProvider)

        # 픽스처 기본 데이터 확인
        price_res = await fake_market_provider.get_current_price("005930", force_update=True)
        assert price_res["current_price"] == 70000.0

        rate = await fake_market_provider.get_exchange_rate("USD", "KRW")
        assert rate == 1350.0

        name = await fake_market_provider.get_stock_name("AAPL")
        assert name == "Apple Inc."

    @pytest.mark.asyncio
    async def test_get_current_prices_bulk_empty_list(self, db_session):
        """빈 티커 리스트로 벌크 조회 시 빈 리스트를 반환하는지 검증합니다."""
        provider = MarketDataProvider(db=db_session)
        assert await provider.get_current_prices_bulk([]) == []

    @pytest.mark.asyncio
    async def test_get_historical_prices_invalid_date_range(self, db_session):
        """start_date > end_date인 경우 빈 리스트를 반환하는지 검증합니다."""
        provider = MarketDataProvider(db=db_session)
        start = datetime.date(2026, 1, 10)
        end = datetime.date(2026, 1, 1)
        assert await provider.get_historical_prices("005930", start, end) == []

    def test_set_adapter_dynamic_registration(self, db_session):
        """동적으로 신규 어댑터를 등록하고 조회할 수 있는지 검증합니다."""
        provider = MarketDataProvider(db=db_session)
        custom_adapter = FakeMarketAdapter()
        provider.set_adapter("JP", custom_adapter)
        assert provider.get_adapter("JP") is custom_adapter
        assert provider.get_adapter("jp") is custom_adapter

    def test_resolve_country_none_or_empty(self, db_session):
        """빈 문자열이나 None 티커 입력 시 기본값 'KR'을 반환하는지 검증합니다."""
        provider = MarketDataProvider(db=db_session)
        assert provider.resolve_country("") == "KR"
        assert provider.resolve_country(None) == "KR"
        assert provider.resolve_country("   ") == "KR"

    @pytest.mark.asyncio
    async def test_get_historical_prices_us_stock_routing(self, db_session):
        """미국 주식(AAPL)의 과거 시세 조회가 US 어댑터로 라우팅되고 캐싱되는지 검증합니다."""
        us_adapter = FakeMarketAdapter()
        us_adapter.set_historical_prices("AAPL", {
            datetime.date(2026, 1, 2): 180.0,
            datetime.date(2026, 1, 5): 182.0,
        })
        provider = MarketDataProvider(db=db_session, us_adapter=us_adapter)

        start = datetime.date(2026, 1, 2)
        end = datetime.date(2026, 1, 5)
        results = await provider.get_historical_prices("AAPL", start, end, fill_missing=False)

        assert len(results) == 2
        assert results[0]["close_price"] == 180.0
        assert results[1]["close_price"] == 182.0

        # DB 캐시 확인
        cached = provider.cache.get_cached_prices("AAPL", start, end)
        assert len(cached) == 2

    @pytest.mark.asyncio
    async def test_get_current_price_missing_in_adapter_returns_zero(self, db_session):
        """어댑터에 등록되지 않은 종목 조회 시 0.0 가격과 0.0 등락률을 안전하게 반환하는지 검증합니다."""
        provider = MarketDataProvider(db=db_session)
        with patch.object(provider.calendar, "is_kr_market_open", return_value=True):
            res = await provider.get_current_price("999999", force_update=True)
            assert res["stock_code"] == "999999"
            assert res["current_price"] == 0.0
            assert res["change_rate"] == 0.0

    @pytest.mark.asyncio
    async def test_index_symbol_direct_routing_to_us_adapter(self, db_session):
        """^KS11, ^KQ11 등 지수 심볼 조회 시 KR 어댑터를 거치지 않고 US 어댑터로 즉시 라우팅되는지 검증합니다."""
        kr_adapter = FakeMarketAdapter()
        us_adapter = FakeMarketAdapter()
        
        # US 어댑터에만 지수 시세 설정
        us_adapter.set_current_price("^KS11", 2600.0, 1.5)
        us_adapter.set_historical_prices("^KQ11", {
            datetime.date(2026, 1, 2): 850.0,
            datetime.date(2026, 1, 5): 855.0,
        })
        
        provider = MarketDataProvider(
            db=db_session,
            kr_adapter=kr_adapter,
            us_adapter=us_adapter
        )

        with patch.object(kr_adapter, "get_current_prices", wraps=kr_adapter.get_current_prices) as mock_kr_current, \
             patch.object(kr_adapter, "get_historical_prices", wraps=kr_adapter.get_historical_prices) as mock_kr_hist:
            
            # 현재가 조회
            with patch.object(provider.calendar, "is_kr_market_open", return_value=True):
                cur_res = await provider.get_current_price("^KS11", force_update=True)
                assert cur_res["current_price"] == 2600.0
                # KR 어댑터는 절대 호출되지 않아야 함
                mock_kr_current.assert_not_called()

            # 과거 시세 조회
            start = datetime.date(2026, 1, 2)
            end = datetime.date(2026, 1, 5)
            hist_res = await provider.get_historical_prices("^KQ11", start, end, fill_missing=False)
            assert len(hist_res) == 2
            assert hist_res[0]["close_price"] == 850.0
            mock_kr_hist.assert_not_called()

