# -*- coding: utf-8 -*-
"""마켓 데이터 어댑터 패키지.

다양한 데이터 소스(키움, 야후파이낸스, 테스트 Fake 등)를 위한
어댑터 클래스들을 export합니다.
"""

from .base import MarketAdapterBase
from .fake import FakeMarketAdapter

__all__ = [
    "MarketAdapterBase",
    "FakeMarketAdapter",
]
