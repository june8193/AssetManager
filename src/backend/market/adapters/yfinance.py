# -*- coding: utf-8 -*-
"""Yahoo Finance 마켓 데이터 어댑터 (YahooFinanceAdapter) 모듈.

yfinance 라이브러리를 통해 미국/국내 주식 현재가, 과거 일별 종가 시계열,
종목명, 외화 환율, 시장 지수를 비동기 논블로킹(스레드풀) 방식으로 조회하고 정규화합니다.
"""

import datetime
import logging
from typing import Any, Dict, List, Optional
import yfinance as yf
from starlette.concurrency import run_in_threadpool

from .base import MarketAdapterBase

logger = logging.getLogger(__name__)


class YahooFinanceAdapter(MarketAdapterBase):
    """Yahoo Finance API(yfinance) 기반의 마켓 데이터 어댑터 클래스입니다."""

    async def get_current_prices(self, tickers: List[str]) -> List[Dict[str, Any]]:
        """복수 종목의 실시간 현재가 및 등락률을 조회합니다.

        Args:
            tickers (List[str]): 종목 코드 또는 티커 리스트 (예: ['AAPL', 'MSFT', '005930.KS'])

        Returns:
            List[Dict[str, Any]]: [
                {
                    "stock_code": str,
                    "current_price": float,
                    "change_rate": float
                },
                ...
            ]
        """
        if not tickers:
            return []

        results: List[Dict[str, Any]] = []

        try:
            tickers_obj = await run_in_threadpool(yf.Tickers, " ".join(tickers))

            for symbol in tickers:
                try:
                    ticker = tickers_obj.tickers.get(symbol)
                    if not ticker:
                        results.append({"stock_code": symbol, "current_price": 0.0, "change_rate": 0.0})
                        continue

                    info = ticker.fast_info
                    last_price = self._extract_float(info, ["last_price", "lastPrice", "regular_market_price", "regularMarketPrice"])
                    prev_close = self._extract_float(
                        info,
                        ["previous_close", "previousClose", "regular_market_previous_close", "regularMarketPreviousClose"]
                    )

                    change_rate = 0.0
                    if prev_close > 0 and last_price > 0:
                        change_rate = round(((last_price / prev_close) - 1) * 100, 2)

                    results.append({
                        "stock_code": symbol,
                        "current_price": last_price,
                        "change_rate": change_rate,
                    })
                except Exception as sym_err:
                    logger.debug("yfinance 개별 티커(%s) 파싱 중 오류: %s", symbol, sym_err)
                    results.append({"stock_code": symbol, "current_price": 0.0, "change_rate": 0.0})

        except Exception as e:
            logger.warning("yfinance 주식 현재가 조회 중 예외 발생: %s", e)
            for symbol in tickers:
                results.append({"stock_code": symbol, "current_price": 0.0, "change_rate": 0.0})

        return results

    async def get_historical_prices(
        self,
        ticker: str,
        start_date: datetime.date,
        end_date: datetime.date
    ) -> List[Dict[str, Any]]:
        """지정된 기간 동안의 일별 종가 시계열 데이터를 조회합니다.

        Args:
            ticker (str): 종목 티커 (예: 'AAPL', 'MSFT')
            start_date (datetime.date): 조회 시작일
            end_date (datetime.date): 조회 종료일

        Returns:
            List[Dict[str, Any]]: [
                {
                    "price_date": datetime.date,
                    "close_price": float
                },
                ...
            ] (날짜 오름차순)
        """
        try:
            start_str = start_date.strftime("%Y-%m-%d")
            # yfinance는 end 일자가 exclusive하므로 +1일하여 요청
            end_str = (end_date + datetime.timedelta(days=1)).strftime("%Y-%m-%d")

            ticker_obj = await run_in_threadpool(yf.Ticker, ticker)
            hist = await run_in_threadpool(ticker_obj.history, start=start_str, end=end_str)

            if hist is None or hist.empty:
                return []

            results: List[Dict[str, Any]] = []
            for idx, row in hist.iterrows():
                try:
                    p_date = idx.date() if hasattr(idx, "date") else idx
                    if isinstance(p_date, datetime.datetime):
                        p_date = p_date.date()

                    close_p = float(row.get("Close", 0.0))
                    if start_date <= p_date <= end_date and close_p > 0.0:
                        results.append({
                            "price_date": p_date,
                            "close_price": close_p,
                        })
                except Exception:
                    continue

            results.sort(key=lambda x: x["price_date"])
            return results

        except Exception as e:
            logger.warning("yfinance 일별 주가 조회 중 예외 발생 (%s): %s", ticker, e)
            return []

    async def get_stock_name(self, ticker: str) -> Optional[str]:
        """티커에 해당하는 공식 종목명을 조회합니다.

        Args:
            ticker (str): 종목 티커 (예: 'AAPL')

        Returns:
            Optional[str]: 종목명 (조회 실패 시 None)
        """
        try:
            stock = await run_in_threadpool(yf.Ticker, ticker)
            info = await run_in_threadpool(getattr, stock, "info")
            if info and isinstance(info, dict):
                name = info.get("longName") or info.get("shortName") or info.get("name")
                if name:
                    return str(name).strip()
        except Exception as e:
            logger.warning("yfinance 종목명 조회 중 예외 발생 (%s): %s", ticker, e)

        return None

    async def get_exchange_rate(
        self,
        sell_currency: str = "USD",
        buy_currency: str = "KRW"
    ) -> Optional[float]:
        """환율을 조회합니다.

        Args:
            sell_currency (str): 매도 통화 (기본값: 'USD')
            buy_currency (str): 매수 통화 (기본값: 'KRW')

        Returns:
            Optional[float]: 환율 값 (조회 실패 시 None)
        """
        sell = sell_currency.upper()
        buy = buy_currency.upper()

        if sell == buy:
            return 1.0

        pair_symbol = f"{sell}{buy}=X"

        try:
            ticker_obj = await run_in_threadpool(yf.Ticker, pair_symbol)
            info = ticker_obj.fast_info
            last_price = self._extract_float(info, ["last_price", "lastPrice", "regular_market_price"])
            if last_price > 0.0:
                return last_price
        except Exception as e:
            logger.warning("yfinance 환율 조회 중 예외 발생 (%s): %s", pair_symbol, e)

        return None

    async def get_market_indices(self, country: str = "US") -> List[Dict[str, Any]]:
        """국가별 주요 시장 지수 목록 및 등락률을 조회합니다.

        Args:
            country (str): 국가 코드 ('KR' 또는 'US')

        Returns:
            List[Dict[str, Any]]: [
                {
                    "index_name": str,
                    "current_price": float,
                    "change_rate": float
                },
                ...
            ]
        """
        country_upper = country.upper()
        if country_upper == "KR":
            index_mapping = [("KOSPI", "^KS11"), ("KOSDAQ", "^KQ11")]
        elif country_upper == "US":
            index_mapping = [("S&P 500", "^GSPC"), ("NASDAQ", "^IXIC"), ("DOW JONES", "^DJI")]
        else:
            return []

        symbols_str = " ".join([sym for _, sym in index_mapping])

        try:
            tickers_obj = await run_in_threadpool(yf.Tickers, symbols_str)
            results: List[Dict[str, Any]] = []

            for name, ticker_symbol in index_mapping:
                try:
                    ticker = tickers_obj.tickers.get(ticker_symbol)
                    if not ticker:
                        results.append({"index_name": name, "current_price": 0.0, "change_rate": 0.0})
                        continue

                    info = ticker.fast_info
                    last_price = self._extract_float(info, ["last_price", "lastPrice", "regular_market_price"])
                    prev_close = self._extract_float(
                        info,
                        ["previous_close", "previousClose", "regular_market_previous_close"]
                    )

                    change_rate = 0.0
                    if prev_close > 0 and last_price > 0:
                        change_rate = round(((last_price / prev_close) - 1) * 100, 2)

                    results.append({
                        "index_name": name,
                        "current_price": last_price,
                        "change_rate": change_rate,
                    })
                except Exception:
                    results.append({"index_name": name, "current_price": 0.0, "change_rate": 0.0})

            return results

        except Exception as e:
            logger.warning("yfinance 시장 지수 조회 중 예외 발생 (%s): %s", country, e)
            return [
                {"index_name": name, "current_price": 0.0, "change_rate": 0.0}
                for name, _ in index_mapping
            ]

    @staticmethod
    def _extract_float(obj: Any, keys: List[str]) -> float:
        """딕셔너리 또는 객체 속성에서 주어진 키 목록 중 존재하는 float 값을 추출합니다."""
        if obj is None:
            return 0.0

        for key in keys:
            val = None
            if isinstance(obj, dict):
                val = obj.get(key)
            elif hasattr(obj, key):
                val = getattr(obj, key)
            elif hasattr(obj, "get"):
                try:
                    val = obj.get(key)
                except Exception:
                    val = None

            if val is not None:
                try:
                    return float(val)
                except (ValueError, TypeError):
                    continue

        return 0.0
