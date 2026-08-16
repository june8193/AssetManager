# -*- coding: utf-8 -*-
"""통합 마켓 데이터 프로바이더 파사드 (MarketDataProvider) 모듈.

국내/해외 주식 시세, 과거 일별 종가, 종목명, 환율, 시장 지수 조회를 단일화하고,
캐시 우선 조회, 실시간/장외 종가 자동 분기, 어댑터 자동 라우팅 및 결측치 보정(Forward-fill)을 제공합니다.
"""

import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from .calendar import MarketCalendar
from .cache import HistoricalPriceCache
from .adapters.base import MarketAdapterBase
from .adapters.fake import FakeMarketAdapter


class MarketDataProvider:
    """통합 마켓 데이터 단일 진입점 파사드 클래스입니다."""

    def __init__(
        self,
        db: Session,
        calendar: Optional[MarketCalendar] = None,
        cache: Optional[HistoricalPriceCache] = None,
        kr_adapter: Optional[MarketAdapterBase] = None,
        us_adapter: Optional[MarketAdapterBase] = None,
        adapters: Optional[Dict[str, MarketAdapterBase]] = None,
    ) -> None:
        """MarketDataProvider 초기화.

        Args:
            db (Session): SQLAlchemy 데이터베이스 세션
            calendar (Optional[MarketCalendar]): 시장 캘린더 (미지정 시 기본 생성)
            cache (Optional[HistoricalPriceCache]): 시세 캐시 관리자 (미지정 시 기본 생성)
            kr_adapter (Optional[MarketAdapterBase]): 국내 시장 어댑터
            us_adapter (Optional[MarketAdapterBase]): 미국 시장 어댑터
            adapters (Optional[Dict[str, MarketAdapterBase]]): 국가 코드별 어댑터 매핑 딕셔너리
        """
        self.db = db
        self.calendar = calendar or MarketCalendar()
        self.cache = cache or HistoricalPriceCache(db=db, calendar=self.calendar)
        self.adapters: Dict[str, MarketAdapterBase] = {}

        if adapters:
            for country_key, adapter_instance in adapters.items():
                self.adapters[country_key.upper()] = adapter_instance

        if kr_adapter:
            self.adapters["KR"] = kr_adapter
        if us_adapter:
            self.adapters["US"] = us_adapter

        # 미지정된 국가의 경우 기본 FakeMarketAdapter 설정
        if "KR" not in self.adapters:
            self.adapters["KR"] = FakeMarketAdapter()
        if "US" not in self.adapters:
            self.adapters["US"] = FakeMarketAdapter()

    def resolve_country(self, ticker: str, country: Optional[str] = None) -> str:
        """티커 형식 또는 명시적 인자를 기반으로 국가 코드('KR' 또는 'US')를 판정합니다.

        Args:
            ticker (str): 종목 코드 또는 티커
            country (Optional[str]): 명시적 국가 코드 (지정 시 최우선 적용)

        Returns:
            str: 'KR' 또는 'US'
        """
        if country and country.strip():
            return country.strip().upper()

        t = (ticker or "").strip().upper()
        if not t:
            return "KR"

        # 6자리 숫자인 경우 한국 주식 코드로 판정
        if len(t) == 6 and t.isdigit():
            return "KR"

        # 코스피/코스닥 야후 티커 접미사
        if t.endswith(".KS") or t.endswith(".KQ"):
            return "KR"

        # 국내 대표 시장 지수 심볼
        if t in ("^KS11", "^KQ11", "KOSPI", "KOSDAQ", "KRX100"):
            return "KR"

        # 미국 대표 시장 지수 심볼
        if t in ("^GSPC", "^IXIC", "^DJI", "^TNX", "SPX", "NDX", "DJI", "COMP"):
            return "US"

        # 그 외 알파벳 티커는 미국 주식으로 판정
        return "US"

    def get_adapter(self, country: str = "KR") -> MarketAdapterBase:
        """지정된 국가의 마켓 어댑터 인스턴스를 반환합니다.

        Args:
            country (str): 국가 코드 ('KR' 또는 'US')

        Returns:
            MarketAdapterBase: 해당 국가 어댑터 인스턴스
        """
        country_upper = (country or "KR").strip().upper()
        if country_upper not in self.adapters:
            self.adapters[country_upper] = FakeMarketAdapter()
        return self.adapters[country_upper]

    def set_adapter(self, country: str, adapter: MarketAdapterBase) -> None:
        """특정 국가의 마켓 어댑터를 등록하거나 교체합니다.

        Args:
            country (str): 국가 코드 ('KR' 또는 'US')
            adapter (MarketAdapterBase): 등록할 마켓 어댑터 인스턴스
        """
        self.adapters[(country or "KR").strip().upper()] = adapter

    async def get_current_price(
        self,
        ticker: str,
        country: Optional[str] = None,
        force_update: bool = False
    ) -> Dict[str, Any]:
        """단일 종목의 현재가 정보를 조회합니다.

        장외 시간이고 강제 갱신이 아니며 유효한 캐시가 있으면 DB 캐시를 반환하고,
        장중이거나 강제 갱신 또는 캐시 미스인 경우 어댑터에서 조회 후 DB 캐시를 갱신합니다.

        Args:
            ticker (str): 종목 코드 또는 티커
            country (Optional[str]): 국가 코드
            force_update (bool): 캐시 무시 및 강제 갱신 여부

        Returns:
            Dict[str, Any]: {"stock_code": str, "current_price": float, "change_rate": float}
        """
        resolved_country = self.resolve_country(ticker, country)
        is_open = (
            self.calendar.is_kr_market_open()
            if resolved_country == "KR"
            else self.calendar.is_us_market_open()
        )

        # 장외 시간 & 캐시 우선 조회
        if not force_update and not is_open:
            last_price = self.cache.get_last_known_price(ticker, datetime.date.today())
            if last_price is not None and last_price > 0:
                return {
                    "stock_code": ticker,
                    "current_price": float(last_price),
                    "change_rate": 0.0,
                }

        # 어댑터 호출 및 캐싱
        adapter = self.get_adapter(resolved_country)
        res_list = await adapter.get_current_prices([ticker])

        if res_list:
            item = res_list[0]
            price = float(item.get("current_price", 0.0))
            change_rate = float(item.get("change_rate", 0.0))
            if price > 0:
                self.cache.upsert_prices(ticker, [{"price_date": datetime.date.today(), "close_price": price}])
            return {
                "stock_code": ticker,
                "current_price": price,
                "change_rate": change_rate,
            }

        return {
            "stock_code": ticker,
            "current_price": 0.0,
            "change_rate": 0.0,
        }

    async def get_current_prices_bulk(
        self,
        tickers: List[str],
        country: Optional[str] = None,
        force_update: bool = False
    ) -> List[Dict[str, Any]]:
        """복수 종목의 현재가를 일괄 조회하고 입력된 티커 순서를 보존하여 반환합니다.

        Args:
            tickers (List[str]): 종목 코드 또는 티커 리스트
            country (Optional[str]): 공통 국가 코드 (미지정 시 종목별 자동 판정)
            force_update (bool): 캐시 무시 및 강제 갱신 여부

        Returns:
            List[Dict[str, Any]]: 현재가 정보 목록
        """
        if not tickers:
            return []

        result_map: Dict[str, Dict[str, Any]] = {}
        to_fetch: Dict[str, List[str]] = {}

        for ticker in tickers:
            c = self.resolve_country(ticker, country)
            is_open = (
                self.calendar.is_kr_market_open()
                if c == "KR"
                else self.calendar.is_us_market_open()
            )

            if not force_update and not is_open:
                last_price = self.cache.get_last_known_price(ticker, datetime.date.today())
                if last_price is not None and last_price > 0:
                    result_map[ticker] = {
                        "stock_code": ticker,
                        "current_price": float(last_price),
                        "change_rate": 0.0,
                    }
                else:
                    to_fetch.setdefault(c, []).append(ticker)
            else:
                to_fetch.setdefault(c, []).append(ticker)

        # 국가별 어댑터 일괄 요청
        for c, t_list in to_fetch.items():
            if not t_list:
                continue
            adapter = self.get_adapter(c)
            res_list = await adapter.get_current_prices(t_list)
            for item in res_list:
                code = item.get("stock_code") or item.get("ticker")
                price = float(item.get("current_price", 0.0))
                change_rate = float(item.get("change_rate", 0.0))
                if code:
                    if price > 0:
                        self.cache.upsert_prices(code, [{"price_date": datetime.date.today(), "close_price": price}])
                    result_map[code] = {
                        "stock_code": code,
                        "current_price": price,
                        "change_rate": change_rate,
                    }

        # 원래 입력 순서대로 반환
        results: List[Dict[str, Any]] = []
        for t in tickers:
            if t in result_map:
                results.append(result_map[t])
            else:
                results.append({
                    "stock_code": t,
                    "current_price": 0.0,
                    "change_rate": 0.0,
                })
        return results

    async def get_historical_prices(
        self,
        ticker: str,
        start_date: datetime.date,
        end_date: datetime.date,
        country: Optional[str] = None,
        fill_missing: bool = True
    ) -> List[Dict[str, Any]]:
        """지정된 기간의 일별 종가 시계열 데이터를 조회합니다.

        캐시에 누락된 영업일 구간만 어댑터에 요청하여 DB에 적재한 뒤,
        요청 옵션에 따라 Forward-fill 보정을 거쳐 반환합니다.

        Args:
            ticker (str): 종목 코드 또는 티커
            start_date (datetime.date): 조회 시작일
            end_date (datetime.date): 조회 종료일
            country (Optional[str]): 국가 코드
            fill_missing (bool): 비영업일/결측치 직전 종가 보정 적용 여부

        Returns:
            List[Dict[str, Any]]: [{'price_date': date, 'close_price': float}] 형태의 정렬된 시계열 데이터
        """
        if start_date > end_date:
            return []

        resolved_country = self.resolve_country(ticker, country)

        # 1. 누락 구간 식별 및 어댑터 보충 요청
        missing_ranges = self.cache.find_missing_ranges(ticker, start_date, end_date, country=resolved_country)
        if missing_ranges:
            adapter = self.get_adapter(resolved_country)
            for r_start, r_end in missing_ranges:
                fetched = await adapter.get_historical_prices(ticker, r_start, r_end)
                if fetched:
                    self.cache.upsert_prices(ticker, fetched)

        # 2. 캐시에서 전체 기간 시세 조회
        cached_models = self.cache.get_cached_prices(ticker, start_date, end_date)
        raw_prices = [
            {"price_date": m.price_date, "close_price": m.close_price}
            for m in cached_models
        ]

        if not fill_missing:
            return raw_prices

        # 3. Forward Fill 보정 적용
        trading_days = self.calendar.get_trading_days(start_date, end_date, country=resolved_country)
        fallback = self.cache.get_last_known_price(ticker, start_date - datetime.timedelta(days=1))
        return self.cache.apply_forward_fill(raw_prices, trading_days, fallback_price=fallback)

    async def get_stock_name(self, ticker: str, country: Optional[str] = None) -> Optional[str]:
        """종목명을 조회합니다.

        Args:
            ticker (str): 종목 코드 또는 티커
            country (Optional[str]): 국가 코드

        Returns:
            Optional[str]: 종목명 또는 None
        """
        resolved_country = self.resolve_country(ticker, country)
        adapter = self.get_adapter(resolved_country)
        return await adapter.get_stock_name(ticker)

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
            Optional[float]: 환율 또는 None
        """
        adapter = self.get_adapter("KR")
        return await adapter.get_exchange_rate(sell_currency=sell_currency, buy_currency=buy_currency)

    async def get_market_indices(self, country: str = "KR") -> List[Dict[str, Any]]:
        """국가별 주요 시장 지수 목록을 조회합니다.

        Args:
            country (str): 국가 코드 ('KR' 또는 'US')

        Returns:
            List[Dict[str, Any]]: 시장 지수 리스트
        """
        country_upper = (country or "KR").strip().upper()
        adapter = self.get_adapter(country_upper)
        return await adapter.get_market_indices(country=country_upper)
