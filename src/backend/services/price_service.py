# -*- coding: utf-8 -*-
"""국내 및 해외 주식의 실시간 시세, 과거 일별 종가, 환율, 장운영 상태를 관리하는 서비스 모듈입니다.

통합 마켓 데이터 프로바이더(MarketDataProvider) 및 시장 캘린더(MarketCalendar)로
기능을 위임하며 하위 호환성을 완벽하게 보장합니다.
"""

import asyncio
import datetime
from typing import Any, Dict, List, Optional
import pytz
from zoneinfo import ZoneInfo
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from src.kiwoom.api import KiwoomAPI
from src.kiwoom.auth import KiwoomAuthManager
from src.backend.market import (
    MarketCalendar,
    MarketDataProvider,
    KiwoomAdapter,
    YahooFinanceAdapter,
    MarketAdapterBase,
)


class PriceService:
    """국내 및 해외 주식의 실시간 시세 및 시장 데이터를 조회하고 관리하는 서비스 클래스입니다."""

    EXCHANGE_RATE_FETCH_START_HOUR = 9
    EXCHANGE_RATE_FETCH_START_MINUTE = 30

    def __init__(
        self,
        provider: Optional[MarketDataProvider] = None,
        calendar: Optional[MarketCalendar] = None,
        kr_adapter: Optional[MarketAdapterBase] = None,
        us_adapter: Optional[MarketAdapterBase] = None,
    ) -> None:
        """PriceService 초기화.

        Args:
            provider (Optional[MarketDataProvider]): 마켓 데이터 프로바이더
            calendar (Optional[MarketCalendar]): 시장 캘린더
            kr_adapter (Optional[MarketAdapterBase]): 국내 시장 어댑터
            us_adapter (Optional[MarketAdapterBase]): 미국 시장 어댑터
        """
        self.calendar = calendar or MarketCalendar()
        self._provider = provider
        self._kr_adapter = kr_adapter
        self._us_adapter = us_adapter
        self.kiwoom_api = KiwoomAPI()
        self.kiwoom_auth = KiwoomAuthManager()
        self.last_manual_refresh_time: Optional[datetime.datetime] = None

    def _get_provider(self, db: Session) -> MarketDataProvider:
        """세션이 바인딩된 MarketDataProvider 인스턴스를 반환합니다.

        Args:
            db (Session): SQLAlchemy 데이터베이스 세션

        Returns:
            MarketDataProvider: 마켓 데이터 프로바이더 인스턴스
        """
        if self._provider is not None:
            return self._provider

        kr = self._kr_adapter or KiwoomAdapter(auth_manager=self.kiwoom_auth, api=self.kiwoom_api)
        us = self._us_adapter or YahooFinanceAdapter()
        return MarketDataProvider(
            db=db,
            calendar=self.calendar,
            kr_adapter=kr,
            us_adapter=us,
        )

    def is_us_market_open(self) -> bool:
        """현재 뉴욕 현지 시각을 기준으로 미국 주식 시장이 개장 중인지 판별합니다."""
        return self.calendar.is_us_market_open()

    def is_kr_market_open(self) -> bool:
        """현재 한국 시각을 기준으로 한국 주식 시장이 개장 중인지 판별합니다."""
        return self.calendar.is_kr_market_open()

    async def get_kr_prices(self, codes: List[str], force_update: bool = False) -> List[Dict[str, Any]]:
        """국내 주식 시세를 조회합니다.

        Args:
            codes (List[str]): 종목 코드 리스트
            force_update (bool): 강제 갱신 여부

        Returns:
            List[Dict[str, Any]]: [{stock_code, current_price, change_rate}]
        """
        if not codes:
            return []

        from src.backend.database import SessionLocal
        with SessionLocal() as db:
            provider = self._get_provider(db)
            return await provider.get_current_prices_bulk(codes, country="KR", force_update=force_update)

    async def get_us_prices(self, symbols: List[str], force_update: bool = False) -> List[Dict[str, Any]]:
        """미국 주식 시세를 조회합니다.

        Args:
            symbols (List[str]): 티커 리스트
            force_update (bool): 강제 갱신 여부

        Returns:
            List[Dict[str, Any]]: [{stock_code, current_price, change_rate}]
        """
        if not symbols:
            return []

        from src.backend.database import SessionLocal
        with SessionLocal() as db:
            provider = self._get_provider(db)
            return await provider.get_current_prices_bulk(symbols, country="US", force_update=force_update)

    async def get_kr_historical_price(self, code: str, qry_dt: str) -> float:
        """특정 일자의 국내 주식 종가를 조회합니다.

        Args:
            code (str): 종목 코드
            qry_dt (str): 조회일자 (YYYYMMDD 또는 YYYY-MM-DD 형식)

        Returns:
            float: 종가 (조회 실패 시 0.0)
        """
        clean_dt = qry_dt.replace("-", "").strip()
        if len(clean_dt) != 8 or not clean_dt.isdigit():
            return 0.0

        try:
            target_date = datetime.datetime.strptime(clean_dt, "%Y%m%d").date()
        except ValueError:
            return 0.0

        from src.backend.database import SessionLocal
        with SessionLocal() as db:
            provider = self._get_provider(db)
            prices = await provider.get_historical_prices(
                code, target_date, target_date, country="KR", fill_missing=False
            )
            if prices:
                return float(prices[0].get("close_price", 0.0))
        return 0.0

    async def get_us_historical_price(self, symbol: str, qry_dt: str) -> float:
        """특정 일자의 미국 주식 종가를 조회합니다.

        Args:
            symbol (str): 티커
            qry_dt (str): 조회일자 (YYYYMMDD 또는 YYYY-MM-DD 형식)

        Returns:
            float: 종가 (조회 실패 시 0.0)
        """
        clean_dt = qry_dt.replace("-", "").strip()
        if len(clean_dt) != 8 or not clean_dt.isdigit():
            return 0.0

        try:
            target_date = datetime.datetime.strptime(clean_dt, "%Y%m%d").date()
        except ValueError:
            return 0.0

        from src.backend.database import SessionLocal
        with SessionLocal() as db:
            provider = self._get_provider(db)
            prices = await provider.get_historical_prices(
                symbol, target_date, target_date, country="US", fill_missing=False
            )
            if prices:
                return float(prices[0].get("close_price", 0.0))
        return 0.0

    async def get_stock_name(self, ticker: str, country: str) -> Optional[str]:
        """국가 및 티커를 기준으로 공식 종목명을 조회합니다.

        Args:
            ticker (str): 종목 코드 또는 티커
            country (str): 국가 ('KR' 또는 'US')

        Returns:
            Optional[str]: 종목명 (조회 실패 시 None)
        """
        from src.backend.database import SessionLocal
        with SessionLocal() as db:
            provider = self._get_provider(db)
            return await provider.get_stock_name(ticker, country=country)

    async def get_historical_prices_with_cache(
        self,
        db: Session,
        ticker: str,
        start_date: datetime.date,
        end_date: datetime.date,
        country: str
    ) -> List[Dict[str, Any]]:
        """DB 캐시를 활용하여 특정 기간의 주가(종가) 리스트를 조회합니다.

        Args:
            db (Session): SQLAlchemy 데이터베이스 세션
            ticker (str): 종목 코드 혹은 티커
            start_date (datetime.date): 조회 시작일
            end_date (datetime.date): 조회 종료일
            country (str): 국가 구분 ('KR' 또는 'US')

        Returns:
            List[Dict[str, Any]]: [{price_date: datetime.date, close_price: float}] 형식의 리스트 (날짜 오름차순)
        """
        provider = self._get_provider(db)
        prices = await provider.get_historical_prices(
            ticker=ticker,
            start_date=start_date,
            end_date=end_date,
            country=country,
            fill_missing=False,
        )
        return prices

    async def get_market_holiday_info(self, target_date: datetime.date, country: str) -> Optional[str]:
        """지정된 날짜가 해당 국가 주식 시장의 휴장일(주말 또는 공휴일)인 경우 휴장 사유를 반환합니다.

        영업일인 경우 None을 반환합니다.

        Args:
            target_date (datetime.date): 판별 대상 날짜
            country (str): 국가 코드 ('KR' 또는 'US')

        Returns:
            Optional[str]: 휴장 사유 또는 None
        """
        country_upper = (country or "KR").strip().upper()

        # 1. 주말 판정 (토요일: 5, 일요일: 6)
        if target_date.weekday() >= 5:
            return "주말"

        # 2. 키움 REST API 질의 시도 (테스트 모킹 호환)
        is_holiday = await self._query_kiwoom_holiday_api(target_date, country_upper)
        if is_holiday is None:
            raise RuntimeError(f"키움 API를 통한 휴장일 판단에 실패했습니다. (국가: {country_upper}, 일자: {target_date})")

        if is_holiday:
            backup_reason = self._get_holiday_reason_backup(target_date, country_upper)
            return backup_reason or "공휴일"
        else:
            return None

    async def _query_kiwoom_holiday_api(self, target_date: datetime.date, country: str) -> Optional[bool]:
        """키움 일봉 차트 API를 호출하여 해당 날짜가 영업일인지 판단합니다.

        영업일이면 False, 휴장일이면 True, 호출 실패 시 None을 반환합니다.
        """
        import httpx

        auth_manager = KiwoomAuthManager()
        base_url = auth_manager.base_url if auth_manager.base_url else "https://api.kiwoom.com"

        try:
            token = await auth_manager.get_valid_token()
        except Exception as e:
            print(f"[ERROR] 키움 API 토큰 획득 실패: {e}")
            return None

        date_str = target_date.strftime("%Y%m%d")

        async with httpx.AsyncClient() as client:
            if country == "KR":
                url = f"{base_url}/api/dostk/chart"
                headers = {
                    "Content-Type": "application/json;charset=UTF-8",
                    "api-id": "ka10081",
                    "authorization": f"Bearer {token}"
                }
                payload = {
                    "stk_cd": "069500",  # KODEX 200
                    "base_dt": date_str,
                    "upd_stkpc_tp": "1"
                }
                try:
                    response = await client.post(url, headers=headers, json=payload, timeout=5.0)
                    response.raise_for_status()
                    data = response.json()
                    if str(data.get("return_code")) != "0":
                        print(f"[ERROR] 키움 국내 일봉 차트 API 오류: {data.get('return_msg')}")
                        return None

                    chart_list = data.get("stk_dt_pole_chart_qry", [])
                    if not chart_list:
                        return True  # 데이터가 전혀 없으면 휴장일로 간주

                    latest_date = chart_list[0].get("dt")
                    if latest_date == date_str:
                        return False  # 영업일
                    else:
                        return True  # 휴장일
                except Exception as e:
                    print(f"[ERROR] 키움 국내 일봉 API 호출 중 예외 발생: {e}")
                    return None

            elif country == "US":
                url = f"{base_url}/api/us/chart"
                headers = {
                    "Content-Type": "application/json;charset=UTF-8",
                    "api-id": "usa06012",
                    "authorization": f"Bearer {token}"
                }
                payload = {
                    "stex_tp": "NY",
                    "stk_cd": "SPY",
                    "strt_dt": date_str,
                    "upd_stkpc_tp": "1",
                    "exrt_appl_tp": "0"
                }
                try:
                    response = await client.post(url, headers=headers, json=payload, timeout=5.0)
                    response.raise_for_status()
                    data = response.json()
                    if str(data.get("return_code")) != "0":
                        print(f"[ERROR] 키움 미국 일 차트 API 오류: {data.get('return_msg')}")
                        return None

                    chart_list = data.get("result_list", [])
                    if not chart_list:
                        return True

                    latest_date = chart_list[0].get("dt")
                    if latest_date == date_str:
                        return False  # 영업일
                    else:
                        return True  # 휴장일
                except Exception as e:
                    print(f"[ERROR] 키움 미국 일봉 API 호출 중 예외 발생: {e}")
                    return None

        return None

    def _get_holiday_reason_backup(self, target_date: datetime.date, country: str) -> Optional[str]:
        """휴장 사유 백업 판단 로직입니다."""
        return self.calendar.get_market_holiday_info(target_date, country=country)

    def _get_now(self) -> datetime.datetime:
        """현재 일시를 반환합니다. 테스트 시 모킹 편의성을 위해 분리되었습니다."""
        return datetime.datetime.now()

    def _get_today(self) -> datetime.date:
        """오늘 날짜를 반환합니다. 테스트 시 모킹 편의성을 위해 분리되었습니다."""
        return datetime.date.today()

    async def is_market_holiday(self, target_date: datetime.date, country: str) -> bool:
        """지정된 날짜가 해당 국가 주식 시장의 휴장일(주말 또는 공휴일)인지 판별합니다.

        Args:
            target_date (datetime.date): 판별 대상 날짜
            country (str): 국가 코드 ('KR' 또는 'US')

        Returns:
            bool: 휴장일인 경우 True, 그렇지 않으면 False
        """
        return (await self.get_market_holiday_info(target_date, country)) is not None

    async def fetch_and_save_exchange_rate(self, db: Session, target_date: datetime.date) -> Optional[float]:
        """환율을 조회하고 DB에 저장합니다 (매도적용환율 기준).

        Args:
            db (Session): 데이터베이스 세션
            target_date (datetime.date): 환율을 기록할 날짜

        Returns:
            Optional[float]: 저장된 환율 값 (실패 시 None)
        """
        try:
            provider = self._get_provider(db)
            sell_rate = await provider.get_exchange_rate(sell_currency="USD", buy_currency="KRW")

            if sell_rate is not None and sell_rate > 0.0:
                from src.backend.models import ExchangeRate
                existing_rate = db.query(ExchangeRate).filter(
                    ExchangeRate.date == target_date,
                    ExchangeRate.currency == "USD"
                ).first()

                if existing_rate:
                    existing_rate.rate = sell_rate
                else:
                    new_rate = ExchangeRate(
                        date=target_date,
                        currency="USD",
                        rate=sell_rate
                    )
                    db.add(new_rate)
                db.commit()
                print(f"[INFO] {target_date} 환율 저장 완료: {sell_rate}")
                return sell_rate
            else:
                print(f"[WARNING] 조회된 환율이 0 이하이거나 없습니다: {sell_rate}")
        except Exception as e:
            print(f"[ERROR] 환율 조회 및 저장 중 오류 발생: {e}")
        return None

    async def update_all_market_prices(self, is_manual: bool = False) -> None:
        """1시간마다 지수, 보유 자산, 관심 종목의 시세를 외부 API로부터 조회하여 DB를 업데이트합니다.

        Args:
            is_manual (bool): 수동 시세 새로고침 여부 (True일 경우 환율 자동 수집 제외)
        """
        from src.backend.database import SessionLocal
        from src.backend.models import Asset, Watchlist, HistoricalPrice
        from src.backend.tasks import task_manager_instance

        # 한국과 미국 현지 시간대 기준의 날짜 계산
        seoul_tz = pytz.timezone('Asia/Seoul')
        ny_tz = pytz.timezone('America/New_York')

        now = self._get_now()
        now_kst = now.astimezone(seoul_tz) if now.tzinfo else seoul_tz.localize(now)
        now_est = now.astimezone(ny_tz) if now.tzinfo else ny_tz.localize(now)

        today_kr = now_kst.date()
        today_us = now_est.date()

        is_kr_holiday = await self.is_market_holiday(today_kr, "KR")
        is_us_holiday = await self.is_market_holiday(today_us, "US")

        # 한국시간 기준 오전 9시 30분 이후이며 수동 갱신이 아니고, 오늘이 한국 휴장일이 아닐 때 당일 환율 정보가 없으면 자동 수집
        try:
            is_after_fetch_time = (
                now_kst.hour > self.EXCHANGE_RATE_FETCH_START_HOUR or (
                    now_kst.hour == self.EXCHANGE_RATE_FETCH_START_HOUR and
                    now_kst.minute >= self.EXCHANGE_RATE_FETCH_START_MINUTE
                )
            )
            if not is_manual and is_after_fetch_time:
                is_kr_holiday_today = await self.is_market_holiday(today_kr, "KR")
                if not is_kr_holiday_today:
                    with SessionLocal() as db:
                        from src.backend.models import ExchangeRate
                        exists = db.query(ExchangeRate).filter(
                            ExchangeRate.date == today_kr,
                            ExchangeRate.currency == "USD"
                        ).first()
                        if not exists:
                            print(f"[INFO] {today_kr} 자 환율 정보 없음. 환율 업데이트 시도...")
                            rate_res = await self.fetch_and_save_exchange_rate(db, today_kr)
                            if rate_res is not None and rate_res > 0.0:
                                task_manager_instance.update_task_success("exchange_rate_update")
                            else:
                                err_msg = f"{today_kr} 자 키움 API 환율 자동 수집 실패 (오전 9시 30분 시도)"
                                task_manager_instance.update_task_error("exchange_rate_update", err_msg)
        except Exception as e:
            print(f"[ERROR] 백그라운드 환율 업데이트 중 오류: {e}")
            task_manager_instance.update_task_error("exchange_rate_update", str(e))

        # 둘 다 휴장일이면 전체 건너뜀
        if is_kr_holiday and is_us_holiday:
            print(f"[INFO] 한국({today_kr}) 및 미국({today_us}) 모두 휴장일입니다. 백그라운드 시세 업데이트를 생략합니다.")
            return

        with SessionLocal() as db:
            # 1. 4대 지수 목록
            kr_indices = ["^KS11", "^KQ11"]
            us_indices = ["^GSPC", "^IXIC"]

            # 2. 보유 자산 중 현금이 아닌 주식/ETF 등의 티커 조회
            db_assets = db.query(Asset).filter(Asset.major_category != "현금").all()

            # 3. 관심종목 조회
            db_watchlist = db.query(Watchlist).all()

        # 국가 및 휴장 여부에 따라 업데이트 대상 코드 분류
        kr_codes = set()
        us_symbols = set()

        # 한국 지수 추가 (한국 휴장일이 아닐 때만)
        if not is_kr_holiday:
            for ticker in kr_indices:
                us_symbols.add(ticker)

        # 미국 지수 추가 (미국 휴장일이 아닐 때만)
        if not is_us_holiday:
            for ticker in us_indices:
                us_symbols.add(ticker)

        # 보유 자산 분류
        for asset in db_assets:
            if asset.country == "KR":
                if not is_kr_holiday:
                    kr_codes.add(asset.ticker)
            elif asset.country == "US":
                if not is_us_holiday:
                    us_symbols.add(asset.ticker)

        # 관심종목 분류
        for item in db_watchlist:
            if item.country == "KR":
                if not is_kr_holiday:
                    kr_codes.add(item.stock_code)
            elif item.country == "US":
                if not is_us_holiday:
                    us_symbols.add(item.stock_code)

        # 한국 주식 시세 업데이트
        kr_codes_list = list(kr_codes)
        if kr_codes_list:
            try:
                print(f"[INFO] 한국 주식 시세 조회 중... (대상 개수: {len(kr_codes_list)})")
                kr_prices = await self.get_kr_prices(kr_codes_list, force_update=True)

                with SessionLocal() as db:
                    for p in kr_prices:
                        code = p["stock_code"]
                        price_val = p["current_price"]
                        if price_val > 0.0:
                            stmt = sqlite_insert(HistoricalPrice).values(
                                ticker=code,
                                price_date=today_kr,
                                close_price=price_val,
                                updated_at=datetime.datetime.now()
                            )
                            stmt = stmt.on_conflict_do_update(
                                index_elements=['ticker', 'price_date'],
                                set_={
                                    'close_price': price_val,
                                    'updated_at': datetime.datetime.now()
                                }
                            )
                            db.execute(stmt)
                    db.commit()
            except Exception as e:
                print(f"[ERROR] 한국 주식 백그라운드 시세 업데이트 실패: {e}")

        # 미국 주식 및 지수 시세 업데이트
        us_symbols_list = list(us_symbols)
        if us_symbols_list:
            try:
                print(f"[INFO] 미국 주식 및 지수 시세 조회 중... (대상 개수: {len(us_symbols_list)})")
                us_prices = await self.get_us_prices(us_symbols_list, force_update=True)

                with SessionLocal() as db:
                    for p in us_prices:
                        symbol = p["stock_code"]
                        price_val = p["current_price"]
                        if price_val > 0.0:
                            stmt = sqlite_insert(HistoricalPrice).values(
                                ticker=symbol,
                                price_date=today_us,
                                close_price=price_val,
                                updated_at=datetime.datetime.now()
                            )
                            stmt = stmt.on_conflict_do_update(
                                index_elements=['ticker', 'price_date'],
                                set_={
                                    'close_price': price_val,
                                    'updated_at': datetime.datetime.now()
                                }
                            )
                            db.execute(stmt)
                    db.commit()
            except Exception as e:
                print(f"[ERROR] 미국 주식/지수 백그라운드 시세 업데이트 실패: {e}")


# 싱글톤 인스턴스
price_service = PriceService()
