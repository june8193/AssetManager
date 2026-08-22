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

    def get_adapter_for_ticker(self, ticker: str, country: Optional[str] = None) -> MarketAdapterBase:
        """티커의 특성에 맞는 적절한 마켓 어댑터를 반환합니다.

        지수 심볼('^'로 시작)은 국내 증권사 REST API에서 지원하지 않으므로
        Yahoo Finance가 연동된 'US' 어댑터로 즉시 직결 라우팅합니다.

        Args:
            ticker (str): 종목 코드 또는 티커
            country (Optional[str]): 국가 코드

        Returns:
            MarketAdapterBase: 해당 티커를 처리할 마켓 어댑터 인스턴스
        """
        t = (ticker or "").strip()
        if t.startswith("^"):
            return self.get_adapter("US")
        resolved_country = self.resolve_country(ticker, country)
        return self.get_adapter(resolved_country)

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
        adapter = self.get_adapter_for_ticker(ticker, country)
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

            hit_cache = False
            if not force_update and not is_open:
                last_price = self.cache.get_last_known_price(ticker, datetime.date.today())
                if last_price is not None and last_price > 0:
                    result_map[ticker] = {
                        "stock_code": ticker,
                        "current_price": float(last_price),
                        "change_rate": 0.0,
                    }
                    hit_cache = True

            if not hit_cache:
                adapter_key = "US" if (ticker or "").strip().startswith("^") else c
                to_fetch.setdefault(adapter_key, []).append(ticker)

        # 국가/어댑터별 일괄 요청
        for adapter_key, t_list in to_fetch.items():
            if not t_list:
                continue
            adapter = self.get_adapter(adapter_key)
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
            adapter = self.get_adapter_for_ticker(ticker, country)
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

    async def get_historical_price_on_date(
        self,
        ticker: str,
        target_date: datetime.date,
        country: Optional[str] = None,
        fill_missing: bool = True,
    ) -> float:
        """특정 일자의 종가를 조회합니다.

        비영업일/휴일 요청 시 정책(fill_missing=True)에 따라 직전 영업일 종가로 보정하여 반환합니다.

        Args:
            ticker (str): 종목 코드 또는 티커
            target_date (datetime.date): 조회 대상 일자
            country (Optional[str]): 국가 코드
            fill_missing (bool): 결측치 직전 영업일 종가 보정 여부 (기본값: True)

        Returns:
            float: 종가 (조회 실패 시 0.0)
        """
        # start_date를 target_date보다 여유 있게 설정하여 Forward-fill 기준점을 확보
        if fill_missing:
            # 7일 전부터 조회하여 직전 거래일 가격을 확보
            lookback_start = target_date - datetime.timedelta(days=7)
            prices = await self.get_historical_prices(
                ticker=ticker,
                start_date=lookback_start,
                end_date=target_date,
                country=country,
                fill_missing=True,
            )
            # target_date에 해당하는 데이터 또는 가장 최근 데이터 반환
            for p in reversed(prices):
                if p["price_date"] <= target_date:
                    return float(p.get("close_price", 0.0))
            return 0.0
        else:
            prices = await self.get_historical_prices(
                ticker=ticker,
                start_date=target_date,
                end_date=target_date,
                country=country,
                fill_missing=False,
            )
            if prices:
                return float(prices[0].get("close_price", 0.0))
            return 0.0

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
        buy_currency: str = "KRW",
        target_date: Optional[datetime.date] = None,
        force_update: bool = False,
    ) -> Optional[float]:
        """환율을 조회합니다. 기준 일자가 지정되면 DB 캐시를 우선 조회하고 캐싱합니다.

        Args:
            sell_currency (str): 매도 통화 (기본값: 'USD')
            buy_currency (str): 매수 통화 (기본값: 'KRW')
            target_date (Optional[datetime.date]): 환율 기준 일자 (None일 경우 실시간)
            force_update (bool): DB 캐시 무시 및 강제 갱신 여부

        Returns:
            Optional[float]: 환율 또는 None
        """
        sell = sell_currency.upper()
        buy = buy_currency.upper()

        if sell == buy:
            return 1.0

        from src.backend.models import ExchangeRate

        # 1. 특정 일자 환율 조회 시 DB 캐시 확인 (force_update가 아닐 때)
        if not force_update and target_date is not None and self.db is not None:
            db_rate = (
                self.db.query(ExchangeRate)
                .filter(ExchangeRate.date == target_date, ExchangeRate.currency == sell)
                .first()
            )
            if db_rate and db_rate.rate > 0.0:
                return float(db_rate.rate)

        # 2. 어댑터에서 환율 조회
        adapter = self.get_adapter("KR")
        rate = await adapter.get_exchange_rate(sell_currency=sell, buy_currency=buy, target_date=target_date)
        if rate is None or rate <= 0.0:
            us_adapter = self.get_adapter("US")
            rate = await us_adapter.get_exchange_rate(sell_currency=sell, buy_currency=buy, target_date=target_date)

        # 3. 조회 성공 시 DB 캐시 저장
        if rate is not None and rate > 0.0 and target_date is not None and self.db is not None:
            try:
                existing = (
                    self.db.query(ExchangeRate)
                    .filter(ExchangeRate.date == target_date, ExchangeRate.currency == sell)
                    .first()
                )
                if existing:
                    existing.rate = rate
                else:
                    self.db.add(ExchangeRate(date=target_date, currency=sell, rate=rate))
                self.db.commit()
            except Exception:
                self.db.rollback()

        return rate

    async def get_market_indices(self, country: str = "KR") -> List[Dict[str, Any]]:
        """국가별 주요 시장 지수 목록을 조회합니다.

        Args:
            country (str): 국가 코드 ('KR' 또는 'US')

        Returns:
            List[Dict[str, Any]]: 시장 지수 리스트
        """
        country_upper = (country or "KR").strip().upper()
        adapter = self.get_adapter(country_upper)
        indices = await adapter.get_market_indices(country=country_upper)

        # 어댑터에서 가격이 모두 0.0이거나 비어있을 경우 YahooFinance(us_adapter) fallback 시도
        if not indices or all(item.get("current_price", 0.0) == 0.0 for item in indices):
            us_adapter = self.get_adapter("US")
            if us_adapter != adapter:
                fallback_indices = await us_adapter.get_market_indices(country=country_upper)
                if fallback_indices and any(item.get("current_price", 0.0) > 0.0 for item in fallback_indices):
                    return fallback_indices

        return indices
