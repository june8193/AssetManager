# -*- coding: utf-8 -*-
"""테스트용 인메모리 마켓 어댑터 (FakeMarketAdapter) 모듈.

외부 네트워크 통신 없이 테스트 환경에서 시세, 종목명, 환율, 지수 데이터를
사전에 주입하고 결정론적으로 조회할 수 있는 Test Seam을 제공합니다.
"""

import datetime
from typing import List, Dict, Any, Optional, Tuple, Union
from .base import MarketAdapterBase


class FakeMarketAdapter(MarketAdapterBase):
    """테스트를 위한 인메모리 가짜(Fake) 마켓 데이터 어댑터입니다."""

    def __init__(self) -> None:
        """FakeMarketAdapter의 인메모리 저장소를 초기화합니다."""
        self._current_prices: Dict[str, Dict[str, Any]] = {}
        self._historical_prices: Dict[str, Dict[datetime.date, float]] = {}
        self._stock_names: Dict[str, str] = {}
        self._exchange_rates: Dict[Tuple[str, str], float] = {}
        self._market_indices: Dict[str, List[Dict[str, Any]]] = {}

    def set_current_price(
        self,
        ticker: str,
        current_price: float,
        change_rate: float = 0.0
    ) -> None:
        """단일 종목의 실시간 현재가 및 등락률 데이터를 주입합니다.

        Args:
            ticker (str): 종목 코드 또는 티커
            current_price (float): 현재가
            change_rate (float, optional): 등락률 (기본값: 0.0)
        """
        self._current_prices[ticker] = {
            "stock_code": ticker,
            "current_price": float(current_price),
            "change_rate": float(change_rate),
        }

    def set_current_prices(
        self,
        prices: Union[Dict[str, float], List[Dict[str, Any]]]
    ) -> None:
        """복수 종목의 실시간 현재가 데이터를 일괄 주입합니다.

        Args:
            prices (Union[Dict[str, float], List[Dict[str, Any]]]):
                - Dict 형태: { "005930": 70000.0, "AAPL": 150.0 }
                - List 형태: [ {"stock_code": "005930", "current_price": 70000.0, "change_rate": 1.5}, ... ]
        """
        if isinstance(prices, dict):
            for ticker, price in prices.items():
                self.set_current_price(ticker, price, 0.0)
        elif isinstance(prices, list):
            for item in prices:
                ticker = item.get("stock_code") or item.get("ticker")
                if ticker:
                    self.set_current_price(
                        ticker,
                        item.get("current_price", 0.0),
                        item.get("change_rate", 0.0)
                    )

    def set_historical_price(
        self,
        ticker: str,
        price_date: datetime.date,
        close_price: float
    ) -> None:
        """특정 종목의 특정 일자 종가를 주입합니다.

        Args:
            ticker (str): 종목 코드 또는 티커
            price_date (datetime.date): 일자
            close_price (float): 종가
        """
        if ticker not in self._historical_prices:
            self._historical_prices[ticker] = {}
        self._historical_prices[ticker][price_date] = float(close_price)

    def set_historical_prices(
        self,
        ticker: str,
        prices: Union[Dict[datetime.date, float], List[Dict[str, Any]]]
    ) -> None:
        """특정 종목의 복수 일자 종가 데이터를 일괄 주입합니다.

        Args:
            ticker (str): 종목 코드 또는 티커
            prices (Union[Dict[datetime.date, float], List[Dict[str, Any]]]):
                - Dict 형태: { datetime.date(2026, 6, 1): 70000.0, ... }
                - List 형태: [ {"price_date": datetime.date(2026, 6, 1), "close_price": 70000.0}, ... ]
        """
        if isinstance(prices, dict):
            for p_date, price in prices.items():
                self.set_historical_price(ticker, p_date, price)
        elif isinstance(prices, list):
            for item in prices:
                p_date = item.get("price_date")
                close_p = item.get("close_price", 0.0)
                if p_date:
                    self.set_historical_price(ticker, p_date, close_p)

    def set_stock_name(self, ticker: str, name: str) -> None:
        """종목 코드 또는 티커의 공식 종목명을 주입합니다.

        Args:
            ticker (str): 종목 코드 또는 티커
            name (str): 종목명
        """
        self._stock_names[ticker] = name

    def set_exchange_rate(
        self,
        rate: float,
        sell_currency: str = "USD",
        buy_currency: str = "KRW"
    ) -> None:
        """특정 통화쌍의 환율을 주입합니다.

        Args:
            rate (float): 환율
            sell_currency (str, optional): 매도 통화 (기본값: 'USD')
            buy_currency (str, optional): 매수 통화 (기본값: 'KRW')
        """
        self._exchange_rates[(sell_currency.upper(), buy_currency.upper())] = float(rate)

    def set_market_indices(
        self,
        indices: List[Dict[str, Any]],
        country: str = "KR"
    ) -> None:
        """국가별 시장 지수 목록을 주입합니다.

        Args:
            indices (List[Dict[str, Any]]): 지수 데이터 리스트
            country (str, optional): 국가 코드 (기본값: 'KR')
        """
        self._market_indices[country.upper()] = indices

    def clear(self) -> None:
        """주입된 모든 인메모리 데이터를 초기화합니다."""
        self._current_prices.clear()
        self._historical_prices.clear()
        self._stock_names.clear()
        self._exchange_rates.clear()
        self._market_indices.clear()

    async def get_current_prices(self, tickers: List[str]) -> List[Dict[str, Any]]:
        """복수 종목의 실시간 현재가 및 등락률을 조회합니다.

        미등록 종목의 경우 현재가 0.0, 등락률 0.0을 반환합니다.

        Args:
            tickers (List[str]): 종목 코드 또는 티커 리스트

        Returns:
            List[Dict[str, Any]]: 현재가 정보 리스트
        """
        results = []
        for ticker in tickers:
            if ticker in self._current_prices:
                results.append(dict(self._current_prices[ticker]))
            else:
                results.append({
                    "stock_code": ticker,
                    "current_price": 0.0,
                    "change_rate": 0.0,
                })
        return results

    async def get_historical_prices(
        self,
        ticker: str,
        start_date: datetime.date,
        end_date: datetime.date
    ) -> List[Dict[str, Any]]:
        """지정된 기간 동안의 일별 종가 시계열 데이터를 조회합니다.

        Args:
            ticker (str): 종목 코드 또는 티커
            start_date (datetime.date): 조회 시작일
            end_date (datetime.date): 조회 종료일

        Returns:
            List[Dict[str, Any]]: 일자 오름차순 종가 리스트
        """
        ticker_prices = self._historical_prices.get(ticker, {})
        filtered = [
            {"price_date": p_date, "close_price": price}
            for p_date, price in ticker_prices.items()
            if start_date <= p_date <= end_date
        ]
        filtered.sort(key=lambda x: x["price_date"])
        return filtered

    async def get_stock_name(self, ticker: str) -> Optional[str]:
        """종목명을 조회합니다. 미등록 종목인 경우 None을 반환합니다.

        Args:
            ticker (str): 종목 코드 또는 티커

        Returns:
            Optional[str]: 종목명 또는 None
        """
        return self._stock_names.get(ticker)

    async def get_exchange_rate(
        self,
        sell_currency: str = "USD",
        buy_currency: str = "KRW"
    ) -> Optional[float]:
        """환율을 조회합니다. 동일 통화는 1.0, 미등록 통화쌍은 None을 반환합니다.

        Args:
            sell_currency (str, optional): 매도 통화 (기본값: 'USD')
            buy_currency (str, optional): 매수 통화 (기본값: 'KRW')

        Returns:
            Optional[float]: 환율 또는 None
        """
        sell = sell_currency.upper()
        buy = buy_currency.upper()
        if sell == buy:
            return 1.0
        return self._exchange_rates.get((sell, buy))

    async def get_market_indices(self, country: str = "KR") -> List[Dict[str, Any]]:
        """국가별 주요 시장 지수를 조회합니다.

        미주입 상태일 경우 국가별 기본 지수 목록을 0.0 가격으로 반환합니다.

        Args:
            country (str, optional): 국가 코드 (기본값: 'KR')

        Returns:
            List[Dict[str, Any]]: 지수 목록
        """
        country_upper = country.upper()
        if country_upper in self._market_indices:
            return list(self._market_indices[country_upper])

        if country_upper == "KR":
            return [
                {"index_name": "KOSPI", "current_price": 0.0, "change_rate": 0.0},
                {"index_name": "KOSDAQ", "current_price": 0.0, "change_rate": 0.0},
            ]
        elif country_upper == "US":
            return [
                {"index_name": "S&P 500", "current_price": 0.0, "change_rate": 0.0},
                {"index_name": "NASDAQ", "current_price": 0.0, "change_rate": 0.0},
                {"index_name": "DOW JONES", "current_price": 0.0, "change_rate": 0.0},
            ]
        return []
