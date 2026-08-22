# -*- coding: utf-8 -*-
"""과거 시세 캐시(HistoricalPriceCache) 모듈.

SQLite historical_prices 테이블을 활용하여 과거 시세를 캐싱하고,
누락된 영업일 및 연속 구간 식별, 일괄 Upsert, Forward-fill 결측치 보정 기능을 제공합니다.
"""

import datetime
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union
from sqlalchemy.orm import Session
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from src.backend.models import HistoricalPrice
from src.backend.market.calendar import MarketCalendar


class HistoricalPriceCache:
    """과거 시세 데이터베이스 캐시 및 보정 관리 클래스입니다."""

    def __init__(self, db: Session, calendar: Optional[MarketCalendar] = None) -> None:
        """HistoricalPriceCache 초기화.

        Args:
            db (Session): SQLAlchemy 데이터베이스 세션
            calendar (Optional[MarketCalendar]): 시장 캘린더 인스턴스 (미지정 시 기본 인스턴스 생성)
        """
        self.db = db
        self.calendar = calendar or MarketCalendar()

    def get_cached_prices(
        self,
        ticker: str,
        start_date: datetime.date,
        end_date: datetime.date
    ) -> List[HistoricalPrice]:
        """DB에 캐싱된 특정 종목의 기간별 시세 목록을 날짜 오름차순으로 조회합니다.

        Args:
            ticker (str): 종목 코드 또는 티커
            start_date (datetime.date): 시작일
            end_date (datetime.date): 종료일

        Returns:
            List[HistoricalPrice]: 조회된 HistoricalPrice 모델 인스턴스 리스트
        """
        if start_date > end_date:
            return []

        return (
            self.db.query(HistoricalPrice)
            .filter(
                HistoricalPrice.ticker == ticker,
                HistoricalPrice.price_date >= start_date,
                HistoricalPrice.price_date <= end_date
            )
            .order_by(HistoricalPrice.price_date.asc())
            .all()
        )

    def find_missing_trading_days(
        self,
        ticker: str,
        start_date: datetime.date,
        end_date: datetime.date,
        country: str = "KR"
    ) -> List[datetime.date]:
        """조회 기간 중 DB에 캐시되지 않았거나 갱신이 필요한 영업일 목록을 반환합니다.

        오늘이 평일/영업일이고 장중인 경우 오늘의 날짜는 최신 시세 수집을 위해 누락일로 판정합니다.

        Args:
            ticker (str): 종목 코드 또는 티커
            start_date (datetime.date): 시작일
            end_date (datetime.date): 종료일
            country (str): 국가 코드 ('KR' 또는 'US')

        Returns:
            List[datetime.date]: 누락된 거래일 목록 (오름차순)
        """
        if start_date > end_date:
            return []

        # 1. 캘린더 기준 전체 영업일 목록 산출
        trading_days = self.calendar.get_trading_days(start_date, end_date, country=country)
        if not trading_days:
            return []

        # 2. DB에 이미 저장된 시세 날짜 추출 (휴장일/결측일 등으로 0.0 캐싱된 과거일 포함)
        cached_prices = self.get_cached_prices(ticker, start_date, end_date)
        cached_dates = {p.price_date for p in cached_prices}

        # 3. 오늘 날짜 및 장중 여부 판별
        today = datetime.date.today()
        country_upper = country.upper()
        is_market_open = False
        if country_upper == "KR":
            is_market_open = self.calendar.is_kr_market_open()
        elif country_upper == "US":
            is_market_open = self.calendar.is_us_market_open()

        # 4. 누락일 산출 (장중인 오늘은 캐시 여부와 무관하게 갱신 대상)
        missing_days = []
        for day in trading_days:
            if day == today and is_market_open:
                missing_days.append(day)
            elif day not in cached_dates:
                missing_days.append(day)

        return missing_days

    def find_missing_ranges(
        self,
        ticker: str,
        start_date: datetime.date,
        end_date: datetime.date,
        country: str = "KR"
    ) -> List[Tuple[datetime.date, datetime.date]]:
        """누락된 영업일들을 연속된 시작/종료일 구간(Tuple[date, date]) 목록으로 그룹화합니다.

        외부 API 호출 시 구간 단위 벌크 요청을 최적화하기 위해 사용됩니다.

        Args:
            ticker (str): 종목 코드 또는 티커
            start_date (datetime.date): 시작일
            end_date (datetime.date): 종료일
            country (str): 국가 코드 ('KR' 또는 'US')

        Returns:
            List[Tuple[datetime.date, datetime.date]]: 연속된 누락 구간 리스트
        """
        missing_days = self.find_missing_trading_days(ticker, start_date, end_date, country=country)
        if not missing_days:
            return []

        # 전체 영업일 리스트에서의 인덱스를 기준으로 연속성을 판별
        all_trading_days = self.calendar.get_trading_days(start_date, end_date, country=country)
        day_to_idx = {d: i for i, d in enumerate(all_trading_days)}

        ranges: List[Tuple[datetime.date, datetime.date]] = []
        range_start = missing_days[0]
        prev_day = missing_days[0]

        for current_day in missing_days[1:]:
            # 영업일 인덱스 상 연속되는지 검사
            if day_to_idx.get(current_day, -1) == day_to_idx.get(prev_day, -2) + 1:
                prev_day = current_day
            else:
                ranges.append((range_start, prev_day))
                range_start = current_day
                prev_day = current_day

        ranges.append((range_start, prev_day))
        return ranges

    def upsert_prices(
        self,
        ticker: str,
        prices: Union[Sequence[Dict[str, Any]], Dict[datetime.date, float]]
    ) -> None:
        """주어진 티커의 시세 데이터를 historical_prices 테이블에 Upsert합니다.

        이미 동일 (ticker, price_date) 행이 존재하는 경우 최신 가격과 갱신 시각으로 업데이트합니다.
        휴장일/결측일 표시를 위한 0.0 가격(Negative Caching)도 지원합니다.

        Args:
            ticker (str): 종목 코드 또는 티커
            prices (Union[Sequence[Dict[str, Any]], Dict[datetime.date, float]]):
                시세 데이터 목록 또는 {날짜: 종가} 딕셔너리
        """
        normalized_items: List[Tuple[datetime.date, float]] = []

        if isinstance(prices, dict):
            for k, v in prices.items():
                p_date = self._parse_date(k)
                close_p = self._parse_price(v)
                if p_date and close_p is not None and close_p >= 0.0:
                    normalized_items.append((p_date, close_p))
        elif isinstance(prices, (list, tuple)):
            for item in prices:
                if not isinstance(item, dict):
                    continue
                raw_date = None
                for d_key in ("price_date", "date"):
                    if d_key in item and item[d_key] is not None:
                        raw_date = item[d_key]
                        break

                raw_price = None
                for p_key in ("close_price", "close", "current_price", "price"):
                    if p_key in item and item[p_key] is not None:
                        raw_price = item[p_key]
                        break

                p_date = self._parse_date(raw_date)
                close_p = self._parse_price(raw_price)
                if p_date and close_p is not None and close_p >= 0.0:
                    normalized_items.append((p_date, close_p))

        if not normalized_items:
            return

        now = datetime.datetime.now()
        for p_date, close_p in normalized_items:
            stmt = sqlite_insert(HistoricalPrice).values(
                ticker=ticker,
                price_date=p_date,
                close_price=close_p,
                updated_at=now
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=["ticker", "price_date"],
                set_={
                    "close_price": close_p,
                    "updated_at": now
                }
            )
            self.db.execute(stmt)

        self.db.commit()

    def get_last_known_price(
        self,
        ticker: str,
        before_date: datetime.date
    ) -> Optional[float]:
        """지정된 날짜 이전(당일 포함)의 가장 최근 유효 종가를 반환합니다.

        Args:
            ticker (str): 종목 코드 또는 티커
            before_date (datetime.date): 기준 일자

        Returns:
            Optional[float]: 조회된 최근 종가, 없으면 None
        """
        row = (
            self.db.query(HistoricalPrice)
            .filter(
                HistoricalPrice.ticker == ticker,
                HistoricalPrice.price_date <= before_date,
                HistoricalPrice.close_price > 0.0
            )
            .order_by(HistoricalPrice.price_date.desc())
            .first()
        )
        return row.close_price if row else None

    def apply_forward_fill(
        self,
        prices: Union[Sequence[Dict[str, Any]], Dict[datetime.date, float]],
        target_dates: Sequence[datetime.date],
        fallback_price: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """타깃 날짜 리스트에 대해 비영업일/결측치를 직전 거래일 종가로 채우는 Forward-fill을 적용합니다.

        Args:
            prices (Union[Sequence[Dict[str, Any]], Dict[datetime.date, float]]): 원본 시세 데이터
            target_dates (Sequence[datetime.date]): 결과로 생성할 연속된 날짜 시퀀스
            fallback_price (Optional[float]): 시작 시점 이전 가격이 없을 때 사용할 기본 종가

        Returns:
            List[Dict[str, Any]]: [{'price_date': date, 'close_price': float}] 형태의 정렬된 시계열 데이터
        """
        if not target_dates:
            return []

        # 1. 맵핑 딕셔너리 생성
        price_map: Dict[datetime.date, float] = {}
        if isinstance(prices, dict):
            for k, v in prices.items():
                p_date = self._parse_date(k)
                close_p = self._parse_price(v)
                if p_date and close_p is not None and close_p > 0.0:
                    price_map[p_date] = close_p
        elif isinstance(prices, (list, tuple)):
            for item in prices:
                if isinstance(item, dict):
                    raw_date = None
                    for d_key in ("price_date", "date"):
                        if d_key in item and item[d_key] is not None:
                            raw_date = item[d_key]
                            break

                    raw_price = None
                    for p_key in ("close_price", "close", "current_price", "price"):
                        if p_key in item and item[p_key] is not None:
                            raw_price = item[p_key]
                            break

                    p_date = self._parse_date(raw_date)
                    close_p = self._parse_price(raw_price)
                    if p_date and close_p is not None and close_p > 0.0:
                        price_map[p_date] = close_p

        # 2. Forward Fill 적용
        sorted_targets = sorted(target_dates)
        results: List[Dict[str, Any]] = []
        last_price = fallback_price

        for current_date in sorted_targets:
            if current_date in price_map:
                last_price = price_map[current_date]

            if last_price is not None:
                results.append({
                    "price_date": current_date,
                    "close_price": last_price
                })

        return results

    @staticmethod
    def _parse_date(value: Any) -> Optional[datetime.date]:
        """다양한 형태의 날짜 입력을 datetime.date 객체로 파싱합니다."""
        if value is None:
            return None
        if isinstance(value, datetime.date):
            if isinstance(value, datetime.datetime):
                return value.date()
            return value
        if isinstance(value, str):
            clean = value.strip().replace("-", "").replace("/", "").replace(".", "")
            if len(clean) == 8 and clean.isdigit():
                try:
                    return datetime.datetime.strptime(clean, "%Y%m%d").date()
                except ValueError:
                    return None
            try:
                # ISO 포맷 등 시도
                return datetime.date.fromisoformat(value.strip()[:10])
            except ValueError:
                pass
        return None

    @staticmethod
    def _parse_price(value: Any) -> Optional[float]:
        """다양한 형태의 가격 입력을 float 값으로 파싱합니다."""
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            clean = value.strip().replace(",", "").replace("+", "").replace(" ", "")
            try:
                return float(clean)
            except ValueError:
                return None
        return None
