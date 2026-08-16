# -*- coding: utf-8 -*-
"""통합 마켓 데이터 패키지.

MarketCalendar, HistoricalPriceCache, MarketDataProvider,
MarketAdapterBase, FakeMarketAdapter, KiwoomAdapter, YahooFinanceAdapter 등
마켓 데이터 관련 핵심 모듈을 제공합니다.
"""

from .calendar import MarketCalendar
from .cache import HistoricalPriceCache
from .adapters.base import MarketAdapterBase
from .adapters.fake import FakeMarketAdapter
from .adapters.kiwoom import KiwoomAdapter
from .adapters.yfinance import YahooFinanceAdapter
from .provider import MarketDataProvider

__all__ = [
    "MarketCalendar",
    "HistoricalPriceCache",
    "MarketAdapterBase",
    "FakeMarketAdapter",
    "KiwoomAdapter",
    "YahooFinanceAdapter",
    "MarketDataProvider",
]
