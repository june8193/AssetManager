# -*- coding: utf-8 -*-
"""시장 캘린더 (MarketCalendar) 모듈의 단위 테스트.

한국거래소(KRX) 및 뉴욕증시(NYSE)의 장운영 시간, 공휴일/휴장일 판정,
영업일 목록 추출 기능의 정상 동작 및 예외 처리를 검증합니다.
"""

import datetime
from zoneinfo import ZoneInfo
import pytest
from src.backend.market.calendar import MarketCalendar


# ============================================================================
# 1. 한국 시장(KRX) 장운영 여부 판정 (is_kr_market_open) 테스트
# ============================================================================

def test_is_kr_market_open_regular_hours():
    """KST 평일 09:00~15:30 정상 장운영 시간 판정을 검증합니다."""
    # 2026-06-16 화요일 (영업일)
    # 09:00 정각 -> 개장
    dt_open_exact = datetime.datetime(2026, 6, 16, 9, 0, 0, tzinfo=ZoneInfo("Asia/Seoul"))
    assert MarketCalendar.is_kr_market_open(dt_open_exact) is True

    # 11:30 장중 -> 개장
    dt_midday = datetime.datetime(2026, 6, 16, 11, 30, 0, tzinfo=ZoneInfo("Asia/Seoul"))
    assert MarketCalendar.is_kr_market_open(dt_midday) is True

    # 15:30 정각 -> 개장 (마감 경계값 포함)
    dt_close_exact = datetime.datetime(2026, 6, 16, 15, 30, 0, tzinfo=ZoneInfo("Asia/Seoul"))
    assert MarketCalendar.is_kr_market_open(dt_close_exact) is True


def test_is_kr_market_open_outside_hours():
    """KST 평일 장 시작 전 및 마감 후 장외 시간 판정을 검증합니다."""
    # 2026-06-16 화요일 08:59:59 -> 장 시작 전
    dt_before_open = datetime.datetime(2026, 6, 16, 8, 59, 59, tzinfo=ZoneInfo("Asia/Seoul"))
    assert MarketCalendar.is_kr_market_open(dt_before_open) is False

    # 2026-06-16 화요일 15:30:01 -> 장 마감 후
    dt_after_close = datetime.datetime(2026, 6, 16, 15, 30, 1, tzinfo=ZoneInfo("Asia/Seoul"))
    assert MarketCalendar.is_kr_market_open(dt_after_close) is False

    # 2026-06-16 화요일 22:00:00 -> 심야 시간
    dt_night = datetime.datetime(2026, 6, 16, 22, 0, 0, tzinfo=ZoneInfo("Asia/Seoul"))
    assert MarketCalendar.is_kr_market_open(dt_night) is False


def test_is_kr_market_open_weekends_and_holidays():
    """주말 및 공휴일에는 장운영 시간대라도 False를 반환하는지 검증합니다."""
    # 2026-06-14 일요일 10:00:00 -> 주말 휴장
    dt_weekend = datetime.datetime(2026, 6, 14, 10, 0, 0, tzinfo=ZoneInfo("Asia/Seoul"))
    assert MarketCalendar.is_kr_market_open(dt_weekend) is False

    # 2026-05-01 금요일 10:00:00 -> 근로자의 날 휴장
    dt_labor_day = datetime.datetime(2026, 5, 1, 10, 0, 0, tzinfo=ZoneInfo("Asia/Seoul"))
    assert MarketCalendar.is_kr_market_open(dt_labor_day) is False

    # 2026-10-09 금요일 10:00:00 -> 한글날 공휴일 휴장
    dt_hangeul = datetime.datetime(2026, 10, 9, 10, 0, 0, tzinfo=ZoneInfo("Asia/Seoul"))
    assert MarketCalendar.is_kr_market_open(dt_hangeul) is False

    # 2026-12-31 목요일 10:00:00 -> 연말 휴장일
    dt_year_end = datetime.datetime(2026, 12, 31, 10, 0, 0, tzinfo=ZoneInfo("Asia/Seoul"))
    assert MarketCalendar.is_kr_market_open(dt_year_end) is False


def test_is_kr_market_open_timezone_handling():
    """Naive datetime 및 타임존 변환(UTC -> KST)이 정상 처리되는지 검증합니다."""
    # Naive datetime 입력 (Asia/Seoul 기준 10:00으로 해석)
    dt_naive = datetime.datetime(2026, 6, 16, 10, 0, 0)
    assert MarketCalendar.is_kr_market_open(dt_naive) is True

    # UTC 2026-06-16 01:00:00 == KST 2026-06-16 10:00:00 -> 장중
    dt_utc = datetime.datetime(2026, 6, 16, 1, 0, 0, tzinfo=datetime.timezone.utc)
    assert MarketCalendar.is_kr_market_open(dt_utc) is True

    # UTC 2026-06-16 07:00:00 == KST 2026-06-16 16:00:00 -> 장 마감 후
    dt_utc_closed = datetime.datetime(2026, 6, 16, 7, 0, 0, tzinfo=datetime.timezone.utc)
    assert MarketCalendar.is_kr_market_open(dt_utc_closed) is False


# ============================================================================
# 2. 미국 시장(NYSE) 장운영 여부 판정 (is_us_market_open) 테스트
# ============================================================================

def test_is_us_market_open_regular_hours():
    """EST/EDT 평일 09:30~16:00 정상 장운영 시간 판정을 검증합니다."""
    # 2026-06-16 화요일 (영업일, 서머타임 EDT 적용 기간)
    # 09:30 정각 -> 개장
    dt_open_exact = datetime.datetime(2026, 6, 16, 9, 30, 0, tzinfo=ZoneInfo("America/New_York"))
    assert MarketCalendar.is_us_market_open(dt_open_exact) is True

    # 13:00 장중 -> 개장
    dt_midday = datetime.datetime(2026, 6, 16, 13, 0, 0, tzinfo=ZoneInfo("America/New_York"))
    assert MarketCalendar.is_us_market_open(dt_midday) is True

    # 16:00 정각 -> 개장 (마감 경계값 포함)
    dt_close_exact = datetime.datetime(2026, 6, 16, 16, 0, 0, tzinfo=ZoneInfo("America/New_York"))
    assert MarketCalendar.is_us_market_open(dt_close_exact) is True


def test_is_us_market_open_outside_hours():
    """EST/EDT 평일 장 시작 전 및 마감 후 장외 시간 판정을 검증합니다."""
    # 2026-06-16 화요일 09:29:59 -> 장 시작 전
    dt_before_open = datetime.datetime(2026, 6, 16, 9, 29, 59, tzinfo=ZoneInfo("America/New_York"))
    assert MarketCalendar.is_us_market_open(dt_before_open) is False

    # 2026-06-16 화요일 16:00:01 -> 장 마감 후
    dt_after_close = datetime.datetime(2026, 6, 16, 16, 0, 1, tzinfo=ZoneInfo("America/New_York"))
    assert MarketCalendar.is_us_market_open(dt_after_close) is False


def test_is_us_market_open_weekends_and_holidays():
    """주말 및 미국 공휴일에는 장운영 시간대라도 False를 반환하는지 검증합니다."""
    # 2026-06-14 일요일 10:00:00 -> 주말
    dt_weekend = datetime.datetime(2026, 6, 14, 10, 0, 0, tzinfo=ZoneInfo("America/New_York"))
    assert MarketCalendar.is_us_market_open(dt_weekend) is False

    # 2026-04-03 금요일 10:00:00 -> 성금요일 (Good Friday)
    dt_good_friday = datetime.datetime(2026, 4, 3, 10, 0, 0, tzinfo=ZoneInfo("America/New_York"))
    assert MarketCalendar.is_us_market_open(dt_good_friday) is False

    # 2026-11-26 목요일 10:00:00 -> 추수감사절 (Thanksgiving Day)
    dt_thanksgiving = datetime.datetime(2026, 11, 26, 10, 0, 0, tzinfo=ZoneInfo("America/New_York"))
    assert MarketCalendar.is_us_market_open(dt_thanksgiving) is False


def test_is_us_market_open_timezone_handling():
    """KST 기준 일시를 입력받았을 때 뉴욕 시간대로 정확히 변환되어 판정되는지 검증합니다."""
    # KST 2026-06-16 23:00:00 == EDT 2026-06-16 10:00:00 -> 미국 장중 (True)
    dt_kst = datetime.datetime(2026, 6, 16, 23, 0, 0, tzinfo=ZoneInfo("Asia/Seoul"))
    assert MarketCalendar.is_us_market_open(dt_kst) is True

    # KST 2026-06-16 10:00:00 == EDT 2026-06-15 21:00:00 -> 미국 장 마감 후 (False)
    dt_kst_morning = datetime.datetime(2026, 6, 16, 10, 0, 0, tzinfo=ZoneInfo("Asia/Seoul"))
    assert MarketCalendar.is_us_market_open(dt_kst_morning) is False


# ============================================================================
# 3. 휴장일 사유 판정 (get_market_holiday_info) 테스트
# ============================================================================

@pytest.mark.parametrize(
    "target_date, country, expected_reason",
    [
        # 한국 공휴일 및 특수일
        (datetime.date(2026, 6, 14), "KR", "주말"),
        (datetime.date(2026, 5, 1), "KR", "근로자의 날"),
        (datetime.date(2026, 12, 31), "KR", "연말 휴장일"),
        (datetime.date(2023, 12, 29), "KR", "연말 휴장일"),  # 2023년 12월 31일이 일요일이므로 12/29가 폐장일
        (datetime.date(2024, 12, 31), "KR", "연말 휴장일"),  # 2024년 12월 31일 화요일이 폐장일
        (datetime.date(2026, 10, 9), "KR", "한글날"),
        (datetime.date(2026, 12, 25), "KR", "성탄절"),
        # 핵심 규칙: 제헌절(7/17)은 개장일이므로 None 반환
        (datetime.date(2026, 7, 17), "KR", None),
        (datetime.date(2024, 7, 17), "KR", None),
        # 한국 일반 영업일
        (datetime.date(2026, 6, 16), "KR", None),

        # 미국 공휴일 및 특수일
        (datetime.date(2026, 6, 14), "US", "주말"),
        (datetime.date(2026, 1, 1), "US", "신정"),
        (datetime.date(2026, 1, 19), "US", "마틴 루터 킹 주니어 추모일"),
        (datetime.date(2026, 2, 16), "US", "대통령의 날"),
        (datetime.date(2026, 4, 3), "US", "성금요일"),
        (datetime.date(2026, 5, 25), "US", "메모리얼 데이"),
        (datetime.date(2026, 6, 19), "US", "준틴스 독립기념일"),
        (datetime.date(2026, 7, 3), "US", "독립기념일 대체휴일"),  # 7/4가 토요일이라 7/3 금요일 대체휴일
        (datetime.date(2026, 9, 7), "US", "노동절"),
        (datetime.date(2026, 11, 26), "US", "추수감사절"),
        (datetime.date(2026, 12, 25), "US", "성탄절"),
        # 미국 일반 영업일
        (datetime.date(2026, 6, 16), "US", None),
    ]
)
def test_get_market_holiday_info(target_date, country, expected_reason):
    """국가별 공휴일, 주말, 특수 폐장일 및 제헌절 영업일 예외 처리를 검증합니다."""
    result = MarketCalendar.get_market_holiday_info(target_date, country=country)
    assert result == expected_reason


def test_is_market_holiday():
    """휴장일 여부 bool 반환을 검증합니다."""
    # 공휴일
    assert MarketCalendar.is_market_holiday(datetime.date(2026, 5, 1), "KR") is True
    # 주말
    assert MarketCalendar.is_market_holiday(datetime.date(2026, 6, 14), "KR") is True
    # 제헌절 (영업일)
    assert MarketCalendar.is_market_holiday(datetime.date(2026, 7, 17), "KR") is False
    # 일반 영업일
    assert MarketCalendar.is_market_holiday(datetime.date(2026, 6, 16), "KR") is False


def test_invalid_country_handling():
    """지원하지 않는 국가 코드 전달 시 ValueError를 발생시키는지 검증합니다."""
    with pytest.raises(ValueError, match="지원하지 않는 국가 코드"):
        MarketCalendar.get_market_holiday_info(datetime.date(2026, 6, 16), country="JP")

    with pytest.raises(ValueError, match="지원하지 않는 국가 코드"):
        MarketCalendar.is_market_holiday(datetime.date(2026, 6, 16), country="UK")

    with pytest.raises(ValueError, match="지원하지 않는 국가 코드"):
        MarketCalendar.get_trading_days(datetime.date(2026, 6, 1), datetime.date(2026, 6, 10), country="CN")


# ============================================================================
# 4. 영업일 목록 추출 (get_trading_days) 테스트
# ============================================================================

def test_get_trading_days_kr():
    """한국 거래소 기준 기간 내 영업일 목록 추출을 검증합니다."""
    # 2026-05-01(금) ~ 2026-05-06(수)
    # 5/1: 근로자의 날(휴장)
    # 5/2, 5/3: 주말(토/일)
    # 5/4: 영업일 (월)
    # 5/5: 어린이날 (휴장)
    # 5/6: 영업일 (수)
    start_date = datetime.date(2026, 5, 1)
    end_date = datetime.date(2026, 5, 6)
    trading_days = MarketCalendar.get_trading_days(start_date, end_date, country="KR")

    assert trading_days == [
        datetime.date(2026, 5, 4),
        datetime.date(2026, 5, 6),
    ]


def test_get_trading_days_constitution_day_included():
    """제헌절(7/17)이 영업일 목록에 반드시 포함되는지 검증합니다."""
    # 2026-07-16(목) ~ 2026-07-20(월)
    # 7/16: 목 (영업일)
    # 7/17: 금 제헌절 (영업일)
    # 7/18, 7/19: 주말
    # 7/20: 월 (영업일)
    start_date = datetime.date(2026, 7, 16)
    end_date = datetime.date(2026, 7, 20)
    trading_days = MarketCalendar.get_trading_days(start_date, end_date, country="KR")

    assert trading_days == [
        datetime.date(2026, 7, 16),
        datetime.date(2026, 7, 17),
        datetime.date(2026, 7, 20),
    ]


def test_get_trading_days_us():
    """미국 거래소 기준 기간 내 영업일 목록 추출을 검증합니다."""
    # 2026-11-25(수) ~ 2026-11-30(월)
    # 11/25: 수 (영업일)
    # 11/26: 목 추수감사절 (휴장)
    # 11/27: 금 (영업일)
    # 11/28, 11/29: 주말
    # 11/30: 월 (영업일)
    start_date = datetime.date(2026, 11, 25)
    end_date = datetime.date(2026, 11, 30)
    trading_days = MarketCalendar.get_trading_days(start_date, end_date, country="US")

    assert trading_days == [
        datetime.date(2026, 11, 25),
        datetime.date(2026, 11, 27),
        datetime.date(2026, 11, 30),
    ]


def test_get_trading_days_invalid_or_single_range():
    """start_date > end_date 인 경우 빈 리스트 반환 및 당일 조회 검증."""
    # start_date > end_date
    assert MarketCalendar.get_trading_days(datetime.date(2026, 6, 20), datetime.date(2026, 6, 10)) == []

    # 단 하루(영업일)
    assert MarketCalendar.get_trading_days(datetime.date(2026, 6, 16), datetime.date(2026, 6, 16)) == [
        datetime.date(2026, 6, 16)
    ]

    # 단 하루(휴장일)
    assert MarketCalendar.get_trading_days(datetime.date(2026, 5, 1), datetime.date(2026, 5, 1)) == []
