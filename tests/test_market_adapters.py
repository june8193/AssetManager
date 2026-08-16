# -*- coding: utf-8 -*-
"""마켓 데이터 어댑터(KiwoomAdapter, YahooFinanceAdapter) 단위 테스트 모듈.

외부 네트워크 호출(키움 REST API, yfinance) 없이 격리된 Mock을 통해
성공, 실패, 결측치, 비정상 응답 케이스에 대한 정규화 및 에러 핸들링을 검증합니다.
"""

import datetime
from unittest.mock import AsyncMock, MagicMock, patch
import pandas as pd
import pytest

from src.backend.market.adapters.kiwoom import KiwoomAdapter
from src.backend.market.adapters.yfinance import YahooFinanceAdapter
from src.backend.market.adapters.base import MarketAdapterBase


# ============================================================================
# KiwoomAdapter 단위 테스트
# ============================================================================

class TestKiwoomAdapter:
    """KiwoomAdapter 단위 테스트 스위트."""

    def test_inherits_market_adapter_base(self):
        """MarketAdapterBase를 상속받았는지 확인합니다."""
        adapter = KiwoomAdapter()
        assert isinstance(adapter, MarketAdapterBase)

    @pytest.mark.asyncio
    async def test_get_current_prices_success(self):
        """키움 API bulk 조회가 성공할 때 가격과 등락률(+/-)이 정상 파싱되는지 검증합니다."""
        mock_auth = MagicMock()
        mock_auth.get_valid_token = AsyncMock(return_value="test-token")

        mock_api = MagicMock()
        mock_api.get_bulk_stock_info.return_value = {
            "return_code": 0,
            "atn_stk_infr": [
                {
                    "stk_cd": "005930",
                    "cur_prc": "+75,000",
                    "flu_rt": "+2.50",
                },
                {
                    "stk_cd": "000660",
                    "cur_prc": "-130,000",
                    "flu_rt": "-1.85",
                },
            ]
        }

        adapter = KiwoomAdapter(auth_manager=mock_auth, api=mock_api)
        results = await adapter.get_current_prices(["005930", "000660"])

        assert len(results) == 2
        assert results[0] == {
            "stock_code": "005930",
            "current_price": 75000.0,
            "change_rate": 2.50,
        }
        assert results[1] == {
            "stock_code": "000660",
            "current_price": 130000.0,
            "change_rate": -1.85,
        }

    @pytest.mark.asyncio
    async def test_get_current_prices_empty_or_failure_fallback(self):
        """빈 리스트 입력 및 API 응답 실패 시 안전하게 기본값을 반환하는지 검증합니다."""
        mock_auth = MagicMock()
        mock_auth.get_valid_token = AsyncMock(return_value="test-token")

        mock_api = MagicMock()
        # 실패 응답
        mock_api.get_bulk_stock_info.return_value = {
            "return_code": -1,
            "return_msg": "System Error",
            "atn_stk_infr": []
        }
        # get_stock_info fallback도 실패
        mock_api.get_stock_info.return_value = None

        adapter = KiwoomAdapter(auth_manager=mock_auth, api=mock_api)

        # 1. 빈 리스트
        empty_res = await adapter.get_current_prices([])
        assert empty_res == []

        # 2. 실패 시 기본값 0.0 반환
        fail_res = await adapter.get_current_prices(["005930"])
        assert len(fail_res) == 1
        assert fail_res[0]["stock_code"] == "005930"
        assert fail_res[0]["current_price"] == 0.0
        assert fail_res[0]["change_rate"] == 0.0

    @pytest.mark.asyncio
    async def test_get_current_prices_exception_handling(self):
        """인증 예외 또는 네트워크 예외 발생 시 예외를 던지지 않고 0.0 기본값을 반환하는지 검증합니다."""
        mock_auth = MagicMock()
        mock_auth.get_valid_token = AsyncMock(side_effect=RuntimeError("Auth failed"))

        adapter = KiwoomAdapter(auth_manager=mock_auth)
        results = await adapter.get_current_prices(["005930", "035720"])

        assert len(results) == 2
        assert results[0] == {"stock_code": "005930", "current_price": 0.0, "change_rate": 0.0}
        assert results[1] == {"stock_code": "035720", "current_price": 0.0, "change_rate": 0.0}

    @pytest.mark.asyncio
    async def test_get_historical_prices_success(self):
        """일별 주가 시계열 조회 성공 시 날짜 오름차순 및 범위 필터링이 정상 동작하는지 검증합니다."""
        mock_auth = MagicMock()
        mock_auth.get_valid_token = AsyncMock(return_value="test-token")

        mock_api = MagicMock()
        mock_api.get_historical_stock_price.return_value = {
            "return_code": 0,
            "daly_stkpc": [
                {"date": "20260603", "close_pric": "+72,000"},
                {"date": "20260602", "close_pric": "71000"},
                {"date": "20260601", "close_pric": "-70000"},
                {"date": "20260530", "close_pric": "69000"},  # 범위 밖
            ]
        }

        adapter = KiwoomAdapter(auth_manager=mock_auth, api=mock_api)
        start_d = datetime.date(2026, 6, 1)
        end_d = datetime.date(2026, 6, 3)

        results = await adapter.get_historical_prices("005930", start_d, end_d)

        assert len(results) == 3
        # 날짜 오름차순 정렬 확인
        assert results[0] == {"price_date": datetime.date(2026, 6, 1), "close_price": 70000.0}
        assert results[1] == {"price_date": datetime.date(2026, 6, 2), "close_price": 71000.0}
        assert results[2] == {"price_date": datetime.date(2026, 6, 3), "close_price": 72000.0}

    @pytest.mark.asyncio
    async def test_get_historical_prices_failure(self):
        """일별 주가 조회 실패 시 빈 리스트를 반환하는지 검증합니다."""
        mock_auth = MagicMock()
        mock_auth.get_valid_token = AsyncMock(return_value="test-token")

        mock_api = MagicMock()
        mock_api.get_historical_stock_price.return_value = {"return_code": -1, "return_msg": "Fail"}

        adapter = KiwoomAdapter(auth_manager=mock_auth, api=mock_api)
        results = await adapter.get_historical_prices(
            "005930",
            datetime.date(2026, 6, 1),
            datetime.date(2026, 6, 3)
        )
        assert results == []

    @pytest.mark.asyncio
    async def test_get_stock_name_success_and_fail(self):
        """종목명 조회 성공 및 실패 처리를 검증합니다."""
        mock_auth = MagicMock()
        mock_auth.get_valid_token = AsyncMock(return_value="test-token")

        mock_api = MagicMock()
        mock_api.get_stock_info.side_effect = [
            {"return_code": 0, "stk_nm": "  삼성전자  "},
            {"return_code": -1, "return_msg": "Not found"},
        ]

        adapter = KiwoomAdapter(auth_manager=mock_auth, api=mock_api)

        name1 = await adapter.get_stock_name("005930")
        assert name1 == "삼성전자"

        name2 = await adapter.get_stock_name("999999")
        assert name2 is None

    @pytest.mark.asyncio
    async def test_get_exchange_rate_success_and_fail(self):
        """환율 조회 성공, 동일 통화, 실패 케이스를 검증합니다."""
        mock_auth = MagicMock()
        mock_auth.get_valid_token = AsyncMock(return_value="test-token")

        mock_api = MagicMock()
        mock_api.get_exchange_rate.return_value = {
            "return_code": 0,
            "sell_aplc_exrt": "1,350.50"
        }

        adapter = KiwoomAdapter(auth_manager=mock_auth, api=mock_api)

        # 1. 동일 통화는 API 호출 없이 1.0 반환
        assert await adapter.get_exchange_rate("KRW", "KRW") == 1.0

        # 2. USD -> KRW 조회
        rate = await adapter.get_exchange_rate("USD", "KRW")
        assert rate == 1350.50

        # 3. API 실패 시 None 반환
        mock_api.get_exchange_rate.return_value = {"return_code": -1}
        fail_rate = await adapter.get_exchange_rate("JPY", "KRW")
        assert fail_rate is None

    @pytest.mark.asyncio
    async def test_get_market_indices(self):
        """국내 지수 조회 시 안전하게 기본 포맷의 지수 목록을 반환하는지 검증합니다."""
        adapter = KiwoomAdapter()
        indices = await adapter.get_market_indices("KR")
        assert len(indices) >= 2
        names = [idx["index_name"] for idx in indices]
        assert "KOSPI" in names
        assert "KOSDAQ" in names


# ============================================================================
# YahooFinanceAdapter 단위 테스트
# ============================================================================

class TestYahooFinanceAdapter:
    """YahooFinanceAdapter 단위 테스트 스위트."""

    def test_inherits_market_adapter_base(self):
        """MarketAdapterBase를 상속받았는지 확인합니다."""
        adapter = YahooFinanceAdapter()
        assert isinstance(adapter, MarketAdapterBase)

    @pytest.mark.asyncio
    async def test_get_current_prices_success(self):
        """yfinance fast_info로부터 현재가 및 등락률을 성공적으로 계산하는지 검증합니다."""
        mock_ticker_aapl = MagicMock()
        mock_ticker_aapl.fast_info = {
            "last_price": 180.0,
            "previous_close": 175.0,
        }

        mock_ticker_tsla = MagicMock()
        mock_ticker_tsla.fast_info = {
            "last_price": 200.0,
            "previous_close": 210.0,
        }

        mock_tickers_obj = MagicMock()
        mock_tickers_obj.tickers = {
            "AAPL": mock_ticker_aapl,
            "TSLA": mock_ticker_tsla,
        }

        with patch("src.backend.market.adapters.yfinance.yf.Tickers", return_value=mock_tickers_obj):
            adapter = YahooFinanceAdapter()
            results = await adapter.get_current_prices(["AAPL", "TSLA"])

        assert len(results) == 2
        assert results[0]["stock_code"] == "AAPL"
        assert results[0]["current_price"] == 180.0
        # ((180 / 175) - 1) * 100 = 2.857... -> 2.86
        assert results[0]["change_rate"] == 2.86

        assert results[1]["stock_code"] == "TSLA"
        assert results[1]["current_price"] == 200.0
        # ((200 / 210) - 1) * 100 = -4.7619... -> -4.76
        assert results[1]["change_rate"] == -4.76

    @pytest.mark.asyncio
    async def test_get_current_prices_empty_or_exception(self):
        """빈 리스트 및 yfinance 예외 발생 시 안전한 기본값을 반환하는지 검증합니다."""
        adapter = YahooFinanceAdapter()

        # 1. 빈 리스트
        assert await adapter.get_current_prices([]) == []

        # 2. 전체 예외 발생
        with patch("src.backend.market.adapters.yfinance.yf.Tickers", side_effect=Exception("Network error")):
            results = await adapter.get_current_prices(["AAPL", "MSFT"])
            assert len(results) == 2
            assert results[0] == {"stock_code": "AAPL", "current_price": 0.0, "change_rate": 0.0}
            assert results[1] == {"stock_code": "MSFT", "current_price": 0.0, "change_rate": 0.0}

    @pytest.mark.asyncio
    async def test_get_historical_prices_success(self):
        """yfinance history로부터 과거 일별 종가 시계열을 정상 파싱하는지 검증합니다."""
        dates = pd.date_range("2026-06-01", periods=3, freq="D")
        df = pd.DataFrame(
            {"Close": [150.0, 155.0, 160.0]},
            index=dates
        )

        mock_ticker = MagicMock()
        mock_ticker.history.return_value = df

        with patch("src.backend.market.adapters.yfinance.yf.Ticker", return_value=mock_ticker):
            adapter = YahooFinanceAdapter()
            results = await adapter.get_historical_prices(
                "AAPL",
                datetime.date(2026, 6, 1),
                datetime.date(2026, 6, 3)
            )

        assert len(results) == 3
        assert results[0] == {"price_date": datetime.date(2026, 6, 1), "close_price": 150.0}
        assert results[1] == {"price_date": datetime.date(2026, 6, 2), "close_price": 155.0}
        assert results[2] == {"price_date": datetime.date(2026, 6, 3), "close_price": 160.0}

    @pytest.mark.asyncio
    async def test_get_historical_prices_empty_or_failure(self):
        """yfinance history 결과가 비어있거나 예외 발생 시 빈 리스트를 반환하는지 검증합니다."""
        mock_ticker = MagicMock()
        mock_ticker.history.return_value = pd.DataFrame()

        with patch("src.backend.market.adapters.yfinance.yf.Ticker", return_value=mock_ticker):
            adapter = YahooFinanceAdapter()
            results = await adapter.get_historical_prices(
                "AAPL",
                datetime.date(2026, 6, 1),
                datetime.date(2026, 6, 3)
            )
            assert results == []

        with patch("src.backend.market.adapters.yfinance.yf.Ticker", side_effect=Exception("Failed")):
            results = await adapter.get_historical_prices(
                "AAPL",
                datetime.date(2026, 6, 1),
                datetime.date(2026, 6, 3)
            )
            assert results == []

    @pytest.mark.asyncio
    async def test_get_stock_name_success_and_fail(self):
        """yfinance info로부터 종목명 조회 성공 및 실패를 검증합니다."""
        mock_ticker_success = MagicMock()
        mock_ticker_success.info = {"longName": "Apple Inc."}

        mock_ticker_fail = MagicMock()
        mock_ticker_fail.info = {}

        with patch("src.backend.market.adapters.yfinance.yf.Ticker", side_effect=[mock_ticker_success, mock_ticker_fail]):
            adapter = YahooFinanceAdapter()
            name1 = await adapter.get_stock_name("AAPL")
            assert name1 == "Apple Inc."

            name2 = await adapter.get_stock_name("UNKNOWN")
            assert name2 is None

    @pytest.mark.asyncio
    async def test_get_exchange_rate_success_and_fail(self):
        """yfinance를 통한 환율(USDKRW=X) 조회 성공 및 실패를 검증합니다."""
        mock_ticker_fx = MagicMock()
        mock_ticker_fx.fast_info = {"last_price": 1340.5}

        with patch("src.backend.market.adapters.yfinance.yf.Ticker", return_value=mock_ticker_fx):
            adapter = YahooFinanceAdapter()

            # 1. 동일 통화는 1.0
            assert await adapter.get_exchange_rate("USD", "USD") == 1.0

            # 2. USD -> KRW 조회
            rate = await adapter.get_exchange_rate("USD", "KRW")
            assert rate == 1340.5

        # 3. 실패 시 None
        with patch("src.backend.market.adapters.yfinance.yf.Ticker", side_effect=Exception("FX error")):
            adapter = YahooFinanceAdapter()
            assert await adapter.get_exchange_rate("EUR", "KRW") is None

    @pytest.mark.asyncio
    async def test_get_market_indices(self):
        """yfinance를 통한 미국 및 한국 지수 조회를 검증합니다."""
        mock_spx = MagicMock()
        mock_spx.fast_info = {"last_price": 5000.0, "previous_close": 4950.0}

        mock_ndx = MagicMock()
        mock_ndx.fast_info = {"last_price": 18000.0, "previous_close": 18000.0}

        mock_dji = MagicMock()
        mock_dji.fast_info = {"last_price": 39000.0, "previous_close": 39200.0}

        mock_tickers_obj = MagicMock()
        mock_tickers_obj.tickers = {
            "^GSPC": mock_spx,
            "^IXIC": mock_ndx,
            "^DJI": mock_dji,
        }

        with patch("src.backend.market.adapters.yfinance.yf.Tickers", return_value=mock_tickers_obj):
            adapter = YahooFinanceAdapter()
            us_indices = await adapter.get_market_indices("US")

        assert len(us_indices) == 3
        assert us_indices[0]["index_name"] == "S&P 500"
        assert us_indices[0]["current_price"] == 5000.0
        assert us_indices[0]["change_rate"] == 1.01  # ((5000 / 4950) - 1) * 100 = 1.0101... -> 1.01

        # 미지원 국가
        adapter = YahooFinanceAdapter()
        assert await adapter.get_market_indices("UNKNOWN") == []
