# -*- coding: utf-8 -*-
"""시장 캘린더 (MarketCalendar) 모듈.

한국거래소(KRX) 및 뉴욕증시(NYSE)의 장운영 시간 판정, 공휴일/휴장일 판정,
연말 폐장일 계산 및 거래일(영업일) 목록 산출 기능을 제공합니다.
"""

import datetime
from typing import List, Optional
from zoneinfo import ZoneInfo
import holidays


class MarketCalendar:
    """한국 및 미국 주식 시장의 운영 시간 및 휴장일을 판정하는 캘린더 클래스입니다."""

    # 국가별 시장 기준 시간대
    COUNTRY_TIMEZONES = {
        "KR": "Asia/Seoul",
        "US": "America/New_York",
    }

    # 영문 공휴일 명칭 -> 한글 공휴일 명칭 매핑
    HOLIDAY_NAME_MAP = {
        # 한국 공휴일
        "New Year's Day": "신정",
        "Alternative holiday for New Year's Day": "신정 대체공휴일",
        "Lunar New Year's Day": "설날 연휴",
        "Alternative holiday for Lunar New Year's Day": "설날 대체공휴일",
        "Independence Movement Day": "삼일절",
        "Alternative holiday for Independence Movement Day": "삼일절 대체공휴일",
        "Labor Day": "근로자의 날",
        "Children's Day": "어린이날",
        "Alternative holiday for Children's Day": "어린이날 대체공휴일",
        "Buddha's Birthday": "부처님오신날",
        "Alternative holiday for Buddha's Birthday": "부처님오신날 대체공휴일",
        "Memorial Day": "현충일",
        "Liberation Day": "광복절",
        "Alternative holiday for Liberation Day": "광복절 대체공휴일",
        "Chuseok": "추석 연휴",
        "Alternative holiday for Chuseok": "추석 대체공휴일",
        "National Foundation Day": "개천절",
        "Alternative holiday for National Foundation Day": "개천절 대체공휴일",
        "Hangeul Day": "한글날",
        "Alternative holiday for Hangeul Day": "한글날 대체공휴일",
        "Christmas Day": "성탄절",
        "Alternative holiday for Christmas Day": "성탄절 대체공휴일",
        "기독탄신일": "성탄절",
        "기독탄신일 대체공휴일": "성탄절 대체공휴일",
        "석가탄신일": "부처님오신날",
        "부처님오신날": "부처님오신날",
        "부처님 오신 날": "부처님오신날",

        # 미국 공휴일 (NYSE)
        "Martin Luther King Jr. Day": "마틴 루터 킹 주니어 추모일",
        "Martin Luther King, Jr. Day": "마틴 루터 킹 주니어 추모일",
        "Washington's Birthday": "대통령의 날",
        "Presidents' Day": "대통령의 날",
        "Good Friday": "성금요일",
        "Memorial Day": "메모리얼 데이",
        "Juneteenth National Independence Day": "준틴스 독립기념일",
        "Juneteenth": "준틴스 독립기념일",
        "Independence Day": "독립기념일",
        "Independence Day (observed)": "독립기념일 대체휴일",
        "Labor Day": "노동절",
        "Thanksgiving": "추수감사절",
        "Thanksgiving Day": "추수감사절",
    }

    @staticmethod
    def _is_krx_year_end_holiday(d: datetime.date) -> bool:
        """한국거래소(KRX)의 연말 휴장일 여부를 판별합니다.

        12월의 마지막 평일(월~금)이 연말 휴장일입니다.

        Args:
            d (datetime.date): 대상 일자

        Returns:
            bool: 연말 휴장일이면 True, 아니면 False
        """
        if d.month != 12:
            return False
        dec31 = datetime.date(d.year, 12, 31)
        weekday = dec31.weekday()
        if weekday < 5:  # 월~금
            target = dec31
        elif weekday == 5:  # 토요일
            target = datetime.date(d.year, 12, 30)
        else:  # 일요일
            target = datetime.date(d.year, 12, 29)
        return d == target

    @classmethod
    def get_market_holiday_info(cls, target_date: datetime.date, country: str = "KR") -> Optional[str]:
        """지정된 날짜의 휴장 사유를 반환합니다. 영업일인 경우 None을 반환합니다.

        Args:
            target_date (datetime.date): 판별 대상 날짜
            country (str): 국가 코드 ('KR' 또는 'US')

        Returns:
            Optional[str]: 휴장 사유(예: '주말', '근로자의 날', '성탄절') 또는 None

        Raises:
            ValueError: 지원하지 않는 국가 코드인 경우
        """
        country_upper = country.upper()
        if country_upper not in ["KR", "US"]:
            raise ValueError(f"지원하지 않는 국가 코드입니다: {country}. KR 또는 US를 입력해 주세요.")

        # 1. 주말 판정 (토요일: 5, 일요일: 6)
        if target_date.weekday() >= 5:
            return "주말"

        if country_upper == "KR":
            # 근로자의 날 (5월 1일)
            if target_date.month == 5 and target_date.day == 1:
                return "근로자의 날"

            # KRX 연말 휴장일
            if cls._is_krx_year_end_holiday(target_date):
                return "연말 휴장일"

            # SouthKorea 공휴일
            kr_holidays = holidays.SouthKorea(years=target_date.year)
            if target_date in kr_holidays:
                holiday_name = kr_holidays.get(target_date)
                # 제헌절(7/17)은 2008년 이후 공휴일에서 제외되었으며 한국 증시는 개장함
                if holiday_name in ["Constitution Day", "제헌절"] or (target_date.month == 7 and target_date.day == 17):
                    return None
                return cls.HOLIDAY_NAME_MAP.get(holiday_name, holiday_name)

        elif country_upper == "US":
            nyse_holidays = holidays.NYSE(years=target_date.year)
            if target_date in nyse_holidays:
                holiday_name = nyse_holidays.get(target_date)
                return cls.HOLIDAY_NAME_MAP.get(holiday_name, holiday_name)

        return None

    @classmethod
    async def query_kiwoom_holiday_api(cls, target_date: datetime.date, country: str = "KR") -> Optional[bool]:
        """키움 일봉 차트 API를 호출하여 해당 날짜가 영업일인지 판단합니다.

        Args:
            target_date (datetime.date): 대상 일자
            country (str): 국가 코드 ('KR' 또는 'US')

        Returns:
            Optional[bool]: 영업일이면 False, 휴장일이면 True, 호출 실패 시 None
        """
        import httpx
        from src.kiwoom.auth import KiwoomAuthManager

        country_upper = country.upper()
        auth_manager = KiwoomAuthManager()
        base_url = auth_manager.base_url if auth_manager.base_url else "https://api.kiwoom.com"

        try:
            token = await auth_manager.get_valid_token()
        except Exception:
            return None

        date_str = target_date.strftime("%Y%m%d")

        async with httpx.AsyncClient() as client:
            if country_upper == "KR":
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
                        return None

                    chart_list = data.get("stk_dt_pole_chart_qry", [])
                    if not chart_list:
                        return True

                    latest_date = chart_list[0].get("dt")
                    return latest_date != date_str
                except Exception:
                    return None

            elif country_upper == "US":
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
                        return None

                    chart_list = data.get("result_list", [])
                    if not chart_list:
                        return True

                    latest_date = chart_list[0].get("dt")
                    return latest_date != date_str
                except Exception:
                    return None

        return None

    @classmethod
    async def get_market_holiday_info_with_api(
        cls,
        target_date: datetime.date,
        country: str = "KR",
        use_api: bool = True
    ) -> Optional[str]:
        """주말/공휴일 판정 및 외부 API 검증을 종합하여 휴장 사유를 반환합니다.

        Args:
            target_date (datetime.date): 판별 대상 날짜
            country (str): 국가 코드 ('KR' 또는 'US')
            use_api (bool): 외부 API 질의 수행 여부

        Returns:
            Optional[str]: 휴장 사유 또는 None
        """
        country_upper = country.upper()

        if target_date.weekday() >= 5:
            return "주말"

        if use_api:
            is_holiday = await cls.query_kiwoom_holiday_api(target_date, country_upper)
            if is_holiday is None:
                raise RuntimeError(f"키움 API를 통한 휴장일 판단에 실패했습니다. (국가: {country_upper}, 일자: {target_date})")

            if is_holiday:
                backup = cls.get_market_holiday_info(target_date, country=country_upper)
                return backup or "공휴일"
            else:
                return None

        return cls.get_market_holiday_info(target_date, country=country_upper)

    @classmethod
    def is_market_holiday(cls, target_date: datetime.date, country: str = "KR") -> bool:
        """지정된 날짜가 휴장일(주말 또는 공휴일)인지 판별합니다.

        Args:
            target_date (datetime.date): 판별 대상 날짜
            country (str): 국가 코드 ('KR' 또는 'US')

        Returns:
            bool: 휴장일이면 True, 영업일이면 False
        """
        return cls.get_market_holiday_info(target_date, country=country) is not None

    @classmethod
    def is_kr_market_open(cls, now: Optional[datetime.datetime] = None) -> bool:
        """현재(또는 지정된 일시) 한국 주식 시장(KRX)이 개장 중인지 판별합니다.

        운영 시간: KST 평일 09:00:00 ~ 15:30:00 (공휴일/휴장일 제외)

        Args:
            now (Optional[datetime.datetime]): 검증할 일시 (지정하지 않으면 현재 KST 시각)

        Returns:
            bool: 개장 중이면 True, 장외 또는 휴장일이면 False
        """
        seoul_tz = ZoneInfo("Asia/Seoul")
        if now is None:
            now_dt = datetime.datetime.now(seoul_tz)
        elif now.tzinfo is None:
            now_dt = now.replace(tzinfo=seoul_tz)
        else:
            now_dt = now.astimezone(seoul_tz)

        # 휴장일(주말, 공휴일) 여부 확인
        if cls.is_market_holiday(now_dt.date(), country="KR"):
            return False

        # 장운영 시간: 09:00:00 ~ 15:30:00
        open_time = datetime.time(9, 0, 0)
        close_time = datetime.time(15, 30, 0)
        current_time = now_dt.time()

        return open_time <= current_time <= close_time

    @classmethod
    def is_us_market_open(cls, now: Optional[datetime.datetime] = None) -> bool:
        """현재(또는 지정된 일시) 미국 주식 시장(NYSE/NASDAQ)이 개장 중인지 판별합니다.

        운영 시간: America/New_York (EST/EDT) 평일 09:30:00 ~ 16:00:00 (공휴일 제외)

        Args:
            now (Optional[datetime.datetime]): 검증할 일시 (지정하지 않으면 현재 New York 시각)

        Returns:
            bool: 개장 중이면 True, 장외 또는 휴장일이면 False
        """
        ny_tz = ZoneInfo("America/New_York")
        if now is None:
            now_dt = datetime.datetime.now(ny_tz)
        elif now.tzinfo is None:
            now_dt = now.replace(tzinfo=ny_tz)
        else:
            now_dt = now.astimezone(ny_tz)

        # 휴장일(주말, 공휴일) 여부 확인
        if cls.is_market_holiday(now_dt.date(), country="US"):
            return False

        # 장운영 시간: 09:30:00 ~ 16:00:00
        open_time = datetime.time(9, 30, 0)
        close_time = datetime.time(16, 0, 0)
        current_time = now_dt.time()

        return open_time <= current_time <= close_time

    @classmethod
    def get_trading_days(
        cls,
        start_date: datetime.date,
        end_date: datetime.date,
        country: str = "KR"
    ) -> List[datetime.date]:
        """지정된 기간 내의 모든 영업일(거래일) 목록을 오름차순으로 반환합니다.

        Args:
            start_date (datetime.date): 시작일
            end_date (datetime.date): 종료일
            country (str): 국가 코드 ('KR' 또는 'US')

        Returns:
            List[datetime.date]: 거래일 날짜 리스트
        """
        if start_date > end_date:
            return []

        trading_days = []
        current = start_date
        one_day = datetime.timedelta(days=1)
        while current <= end_date:
            if not cls.is_market_holiday(current, country=country):
                trading_days.append(current)
            current += one_day

        return trading_days
