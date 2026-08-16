# -*- coding: utf-8 -*-
"""마켓 데이터 어댑터 추상 기본 클래스 (MarketAdapterBase) 모듈.

국내/해외 주식 실시간 시세, 과거 일별 종가, 종목명, 환율, 시장 지수 조회를 위한
어댑터 인터페이스 표준을 정의합니다.
"""

from abc import ABC, abstractmethod
import datetime
from typing import List, Dict, Any, Optional


class MarketAdapterBase(ABC):
    """마켓 데이터 어댑터의 표준 추상 기본 클래스 (ABC)입니다."""

    @abstractmethod
    async def get_current_prices(self, tickers: List[str]) -> List[Dict[str, Any]]:
        """복수 종목의 실시간 현재가 및 등락률을 조회합니다.

        Args:
            tickers (List[str]): 종목 코드 또는 티커 리스트

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
        pass

    @abstractmethod
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
            List[Dict[str, Any]]: [
                {
                    "price_date": datetime.date,
                    "close_price": float
                },
                ...
            ] (날짜 오름차순)
        """
        pass

    @abstractmethod
    async def get_stock_name(self, ticker: str) -> Optional[str]:
        """종목 코드 또는 티커에 해당하는 공식 종목명을 조회합니다.

        Args:
            ticker (str): 종목 코드 또는 티커

        Returns:
            Optional[str]: 종목명 (조회 실패 시 None)
        """
        pass

    @abstractmethod
    async def get_exchange_rate(
        self,
        sell_currency: str = "USD",
        buy_currency: str = "KRW",
        target_date: Optional[datetime.date] = None
    ) -> Optional[float]:
        """환율을 조회합니다.

        Args:
            sell_currency (str): 매도 통화 (기본값: 'USD')
            buy_currency (str): 매수 통화 (기본값: 'KRW')
            target_date (Optional[datetime.date]): 조회 기준 일자 (None일 경우 실시간/최근 환율)

        Returns:
            Optional[float]: 환율 값 (조회 실패 시 None)
        """
        pass

    @abstractmethod
    async def get_market_indices(self, country: str = "KR") -> List[Dict[str, Any]]:
        """국가별 주요 시장 지수 목록을 조회합니다.

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
        pass
