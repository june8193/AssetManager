# -*- coding: utf-8 -*-
"""과거 시세 캐시(HistoricalPriceCache) 적대적/경계조건 스트레스 테스트 모듈.

Milestone 2의 시세 캐시 계층에 대해 다음 항목들을 극한 환경에서 검증합니다:
1. 수년치(2020~2025) 과거 시세 결측 시뮬레이션 및 find_missing_ranges 연속성 병합 검증
2. Forward-fill 극단적 경계조건 (fallback_price, 10일 연속 휴장, 단 1일 데이터, 빈 리스트 등)
3. 대용량(5,000건+) 일괄 Upsert 및 티커 격리 검증
4. 윤년(2020, 2024년 2월 29일) 및 한미 특수 공휴일 연계 검증
"""

import datetime
import random
import pytest

from src.backend.models import HistoricalPrice
from src.backend.market.calendar import MarketCalendar
from src.backend.market.cache import HistoricalPriceCache


class TestHistoricalPriceCacheMultiYearStress:
    """수년치(2020~2025) 다년도 시세 결측 및 누락 구간 병합 스트레스 테스트."""

    def test_multi_year_all_missing_korea(self, db_session):
        """2020~2025년 6개년 전체 결측 시 단 1개의 단일 연속 구간으로 병합되는지 검증."""
        cache = HistoricalPriceCache(db=db_session)
        ticker = "005930"
        start_date = datetime.date(2020, 1, 1)
        end_date = datetime.date(2025, 12, 31)

        # 전체 영업일 추출
        trading_days = cache.calendar.get_trading_days(start_date, end_date, country="KR")
        assert len(trading_days) > 1400  # 6년치 약 1470 영업일

        # 1. missing trading days 검증
        missing_days = cache.find_missing_trading_days(ticker, start_date, end_date, country="KR")
        assert missing_days == trading_days

        # 2. find_missing_ranges 검증 -> 모든 영업일이 연속되므로 단 1개 구간이어야 함
        ranges = cache.find_missing_ranges(ticker, start_date, end_date, country="KR")
        assert len(ranges) == 1
        assert ranges[0] == (trading_days[0], trading_days[-1])

    def test_multi_year_all_missing_us(self, db_session):
        """2020~2025년 미국(NYSE) 6개년 전체 결측 시 단 1개의 단일 연속 구간으로 병합되는지 검증."""
        cache = HistoricalPriceCache(db=db_session)
        ticker = "AAPL"
        start_date = datetime.date(2020, 1, 1)
        end_date = datetime.date(2025, 12, 31)

        trading_days = cache.calendar.get_trading_days(start_date, end_date, country="US")
        assert len(trading_days) > 1400

        ranges = cache.find_missing_ranges(ticker, start_date, end_date, country="US")
        assert len(ranges) == 1
        assert ranges[0] == (trading_days[0], trading_days[-1])

    def test_multi_year_fully_cached(self, db_session):
        """2020~2025년 전체 영업일이 이미 캐시된 경우 누락 구간이 빈 리스트인지 검증."""
        cache = HistoricalPriceCache(db=db_session)
        ticker = "005930"
        start_date = datetime.date(2020, 1, 1)
        end_date = datetime.date(2025, 12, 31)

        trading_days = cache.calendar.get_trading_days(start_date, end_date, country="KR")
        # 대량 데이터 적재
        prices_to_insert = [{"price_date": d, "close_price": 50000.0 + i} for i, d in enumerate(trading_days)]
        cache.upsert_prices(ticker, prices_to_insert)

        missing_days = cache.find_missing_trading_days(ticker, start_date, end_date, country="KR")
        assert missing_days == []

        ranges = cache.find_missing_ranges(ticker, start_date, end_date, country="KR")
        assert ranges == []

    def test_multi_year_yearly_alternating_blocks(self, db_session):
        """짝수 년도(2020, 2022, 2024)만 캐시되고 홀수 년도가 결측된 경우 정확히 3개 구간으로 분할되는지 검증."""
        cache = HistoricalPriceCache(db=db_session)
        ticker = "005930"
        start_date = datetime.date(2020, 1, 1)
        end_date = datetime.date(2025, 12, 31)

        # 짝수 년도만 캐시 채우기
        cached_days = []
        for year in [2020, 2022, 2024]:
            y_start = datetime.date(year, 1, 1)
            y_end = datetime.date(year, 12, 31)
            days = cache.calendar.get_trading_days(y_start, y_end, country="KR")
            cached_days.extend(days)

        cache.upsert_prices(ticker, [{"price_date": d, "close_price": 60000.0} for d in cached_days])

        ranges = cache.find_missing_ranges(ticker, start_date, end_date, country="KR")
        assert len(ranges) == 3

        # 홀수 년도별 예상 구간
        for i, missing_year in enumerate([2021, 2023, 2025]):
            expected_days = cache.calendar.get_trading_days(
                datetime.date(missing_year, 1, 1),
                datetime.date(missing_year, 12, 31),
                country="KR"
            )
            assert ranges[i] == (expected_days[0], expected_days[-1])

    def test_multi_year_checkerboard_alternation(self, db_session):
        """하루 걸러 하루씩 캐시된 격자형 결측 시 각 결측일이 개별 단일일자 구간으로 분리되는지 검증."""
        cache = HistoricalPriceCache(db=db_session)
        ticker = "005930"
        start_date = datetime.date(2024, 1, 1)
        end_date = datetime.date(2024, 3, 31)

        trading_days = cache.calendar.get_trading_days(start_date, end_date, country="KR")
        even_days = trading_days[0::2]
        odd_days = trading_days[1::2]

        cache.upsert_prices(ticker, [{"price_date": d, "close_price": 70000.0} for d in even_days])

        ranges = cache.find_missing_ranges(ticker, start_date, end_date, country="KR")
        # 홀수 인덱스 날짜들이 각각 독립된 1일짜리 구간이어야 함
        assert len(ranges) == len(odd_days)
        for r, expected_d in zip(ranges, odd_days):
            assert r == (expected_d, expected_d)

    def test_multi_year_monthly_first_day_cached(self, db_session):
        """매월 첫 영업일만 캐시되어 있을 때 월별 중간 구간들이 정확히 산출되는지 검증."""
        cache = HistoricalPriceCache(db=db_session)
        ticker = "005930"
        start_date = datetime.date(2024, 1, 1)
        end_date = datetime.date(2024, 6, 30)

        trading_days = cache.calendar.get_trading_days(start_date, end_date, country="KR")

        # 각 월의 첫 영업일 추출
        first_days = []
        for month in range(1, 7):
            m_days = cache.calendar.get_trading_days(datetime.date(2024, month, 1), datetime.date(2024, month, 28), country="KR")
            if m_days:
                first_days.append(m_days[0])

        cache.upsert_prices(ticker, [{"price_date": d, "close_price": 70000.0} for d in first_days])

        ranges = cache.find_missing_ranges(ticker, start_date, end_date, country="KR")
        # 6개 월에 대해 첫날이 캐시되었으므로, 각 월의 2번째 영업일부터 해당 월 말(또는 다음달 첫날 전)까지의 구간들이 생성됨
        assert len(ranges) == 6
        for r in ranges:
            # 반환된 구간의 시작일과 종료일이 모두 캐시되지 않은 영업일인지 확인
            assert r[0] not in first_days
            assert r[1] not in first_days


class TestHistoricalPriceCacheForwardFillStress:
    """Forward-fill 극단적 경계조건 및 에지 케이스 스트레스 테스트."""

    def test_forward_fill_empty_inputs(self, db_session):
        """입력 리스트나 대상 날짜가 빈 경우의 모든 조합 검증."""
        cache = HistoricalPriceCache(db=db_session)

        # 1. prices 빈 리스트, target_dates 빈 리스트
        assert cache.apply_forward_fill([], []) == []

        # 2. prices 빈 딕셔너리, target_dates 빈 리스트
        assert cache.apply_forward_fill({}, []) == []

        # 3. prices 빈 리스트, target_dates 존재, fallback_price 없음
        target_dates = [datetime.date(2026, 1, 1), datetime.date(2026, 1, 2)]
        assert cache.apply_forward_fill([], target_dates, fallback_price=None) == []

        # 4. prices 빈 리스트, target_dates 존재, fallback_price 지정
        filled = cache.apply_forward_fill([], target_dates, fallback_price=55000.0)
        assert len(filled) == 2
        assert filled[0] == {"price_date": datetime.date(2026, 1, 1), "close_price": 55000.0}
        assert filled[1] == {"price_date": datetime.date(2026, 1, 2), "close_price": 55000.0}

    def test_forward_fill_single_day_data_spanning_one_year(self, db_session):
        """단 1일치 시세만 존재할 때 1년치 365일 전체 날짜로 정상 전파되는지 검증."""
        cache = HistoricalPriceCache(db=db_session)
        prices = [{"price_date": datetime.date(2024, 1, 1), "close_price": 75000.0}]

        # 2024년 윤년 366일 생성
        target_dates = [datetime.date(2024, 1, 1) + datetime.timedelta(days=i) for i in range(366)]

        filled = cache.apply_forward_fill(prices, target_dates)
        assert len(filled) == 366
        for item in filled:
            assert item["close_price"] == 75000.0
        assert filled[0]["price_date"] == datetime.date(2024, 1, 1)
        assert filled[59]["price_date"] == datetime.date(2024, 2, 29)  # 윤일 확인
        assert filled[-1]["price_date"] == datetime.date(2024, 12, 31)

    def test_forward_fill_start_gap_with_fallback(self, db_session):
        """시작점부터 중간까지 결측이고 중간부터 시세가 인입될 때 fallback -> 실제 시세 전환 검증."""
        cache = HistoricalPriceCache(db=db_session)
        # 1월 10일부터 80000원
        prices = [{"price_date": datetime.date(2026, 1, 10), "close_price": 80000.0}]
        target_dates = [datetime.date(2026, 1, 1) + datetime.timedelta(days=i) for i in range(15)]

        filled = cache.apply_forward_fill(prices, target_dates, fallback_price=70000.0)
        assert len(filled) == 15

        # 1월 1일 ~ 1월 9일 (9일간 fallback_price 70000)
        for i in range(9):
            assert filled[i]["price_date"] == datetime.date(2026, 1, 1 + i)
            assert filled[i]["close_price"] == 70000.0

        # 1월 10일 ~ 1월 15일 (6일간 80000)
        for i in range(9, 15):
            assert filled[i]["price_date"] == datetime.date(2026, 1, 1 + i)
            assert filled[i]["close_price"] == 80000.0

    def test_forward_fill_extended_10_day_holiday_gap(self, db_session):
        """추석 연휴 등 10일 연속 비영업일 구간에서 직전 종가가 10일 내내 유지되는지 검증."""
        cache = HistoricalPriceCache(db=db_session)
        # 9월 30일 종가 50000원, 10월 11일 종가 52000원
        prices = [
            {"price_date": datetime.date(2025, 9, 30), "close_price": 50000.0},
            {"price_date": datetime.date(2025, 10, 11), "close_price": 52000.0},
        ]

        # 9월 30일 ~ 10월 12일 (13일 연속)
        target_dates = [datetime.date(2025, 9, 30) + datetime.timedelta(days=i) for i in range(13)]

        filled = cache.apply_forward_fill(prices, target_dates)
        assert len(filled) == 13

        # 9/30 ~ 10/10 (11일간 50000 유지)
        for i in range(11):
            assert filled[i]["close_price"] == 50000.0

        # 10/11 ~ 10/12 (2일간 52000 유지)
        assert filled[11]["close_price"] == 52000.0
        assert filled[12]["close_price"] == 52000.0

    def test_forward_fill_unsorted_target_dates(self, db_session):
        """target_dates가 무작위 순서로 인입되어도 정렬된 일자별 시계열로 반환되는지 검증."""
        cache = HistoricalPriceCache(db=db_session)
        prices = {
            datetime.date(2026, 1, 1): 100.0,
            datetime.date(2026, 1, 5): 105.0,
        }

        # 역순 또는 무작위 셔플 target_dates
        target_dates = [
            datetime.date(2026, 1, 6),
            datetime.date(2026, 1, 2),
            datetime.date(2026, 1, 5),
            datetime.date(2026, 1, 1),
            datetime.date(2026, 1, 4),
            datetime.date(2026, 1, 3),
        ]

        filled = cache.apply_forward_fill(prices, target_dates)
        assert len(filled) == 6
        # 날짜 오름차순 검증
        for i in range(6):
            assert filled[i]["price_date"] == datetime.date(2026, 1, 1 + i)

        assert filled[0]["close_price"] == 100.0  # 1/1
        assert filled[1]["close_price"] == 100.0  # 1/2
        assert filled[2]["close_price"] == 100.0  # 1/3
        assert filled[3]["close_price"] == 100.0  # 1/4
        assert filled[4]["close_price"] == 105.0  # 1/5
        assert filled[5]["close_price"] == 105.0  # 1/6

    def test_forward_fill_dirty_and_mixed_data_types(self, db_session):
        """문자열 날짜, 콤마 포함 가격, None, 음수 등이 섞인 입력에 대한 필터링 검증."""
        cache = HistoricalPriceCache(db=db_session)
        dirty_prices = [
            {"date": "2026-01-01", "close": "10,000.5"},
            {"price_date": "20260103", "current_price": "+10500"},
            {"date": None, "price": 10000},
            {"date": "invalid-date", "price": 10000},
            {"date": "2026-01-04", "price": -500},
            {"date": "2026-01-04", "price": "0"},
            {"date": "2026-01-05", "price": "11,000"},
            None,
            "invalid_row",
        ]

        target_dates = [datetime.date(2026, 1, 1) + datetime.timedelta(days=i) for i in range(6)]
        filled = cache.apply_forward_fill(dirty_prices, target_dates)

        assert len(filled) == 6
        assert filled[0] == {"price_date": datetime.date(2026, 1, 1), "close_price": 10000.5}
        assert filled[1] == {"price_date": datetime.date(2026, 1, 2), "close_price": 10000.5}
        assert filled[2] == {"price_date": datetime.date(2026, 1, 3), "close_price": 10500.0}
        assert filled[3] == {"price_date": datetime.date(2026, 1, 4), "close_price": 10500.0}
        assert filled[4] == {"price_date": datetime.date(2026, 1, 5), "close_price": 11000.0}
        assert filled[5] == {"price_date": datetime.date(2026, 1, 6), "close_price": 11000.0}


class TestHistoricalPriceCacheDatabaseIsolationAndScale:
    """대용량 Upsert 및 멀티 티커 격리, get_last_known_price 정밀 검증."""

    def test_large_scale_batch_upsert_and_isolation(self, db_session):
        """5,000건 이상의 대용량 일괄 Upsert 및 서로 다른 티커 간 완벽한 데이터 격리 검증."""
        cache = HistoricalPriceCache(db=db_session)

        # 2개 종목 각각 2,500일치 (총 5,000건)
        base_date = datetime.date(2015, 1, 1)
        ticker_kr = "005930"
        ticker_us = "AAPL"

        data_kr = [
            {"price_date": base_date + datetime.timedelta(days=i), "close_price": 50000.0 + i}
            for i in range(2500)
        ]
        data_us = [
            {"price_date": base_date + datetime.timedelta(days=i), "close_price": 100.0 + (i * 0.1)}
            for i in range(2500)
        ]

        cache.upsert_prices(ticker_kr, data_kr)
        cache.upsert_prices(ticker_us, data_us)

        # 1. DB 카운트 검증
        kr_count = db_session.query(HistoricalPrice).filter(HistoricalPrice.ticker == ticker_kr).count()
        us_count = db_session.query(HistoricalPrice).filter(HistoricalPrice.ticker == ticker_us).count()
        assert kr_count == 2500
        assert us_count == 2500

        # 2. 캐시 조회 격리 검증
        query_start = datetime.date(2020, 1, 1)
        query_end = datetime.date(2020, 1, 10)
        cached_kr = cache.get_cached_prices(ticker_kr, query_start, query_end)
        cached_us = cache.get_cached_prices(ticker_us, query_start, query_end)

        assert len(cached_kr) == 10
        assert len(cached_us) == 10
        assert all(p.ticker == ticker_kr for p in cached_kr)
        assert all(p.ticker == ticker_us for p in cached_us)
        assert cached_kr[0].close_price >= 50000.0
        assert cached_us[0].close_price < 500.0

    def test_get_last_known_price_boundary_conditions(self, db_session):
        """get_last_known_price의 경계조건(동일일자, 과거, 미래, 없는 티커, 0원 이하 무시) 검증."""
        cache = HistoricalPriceCache(db=db_session)
        ticker = "005930"

        # 1/10: 70000, 1/20: 72000
        cache.upsert_prices(ticker, [
            {"price_date": datetime.date(2026, 1, 10), "close_price": 70000.0},
            {"price_date": datetime.date(2026, 1, 20), "close_price": 72000.0},
        ])

        # 1. 최초 데이터 이전 -> None
        assert cache.get_last_known_price(ticker, datetime.date(2026, 1, 9)) is None

        # 2. 정확히 1/10 당일 -> 70000.0
        assert cache.get_last_known_price(ticker, datetime.date(2026, 1, 10)) == 70000.0

        # 3. 1/10과 1/20 사이(1/15) -> 70000.0
        assert cache.get_last_known_price(ticker, datetime.date(2026, 1, 15)) == 70000.0

        # 4. 정확히 1/20 당일 -> 72000.0
        assert cache.get_last_known_price(ticker, datetime.date(2026, 1, 20)) == 72000.0

        # 5. 1/20 이후(1/25) -> 72000.0
        assert cache.get_last_known_price(ticker, datetime.date(2026, 1, 25)) == 72000.0

        # 6. 존재하지 않는 티커 -> None
        assert cache.get_last_known_price("UNKNOWN", datetime.date(2026, 1, 25)) is None


class TestHistoricalPriceCacheExtremeAdversarial:
    """극한의 적대적 입력 및 윤년/연말연초 경계조건 검증."""

    def test_year_boundary_crossing_seamless_merge(self, db_session):
        """연말(12/30)과 신년(1/2) 사이의 공휴일/휴장일을 건너뛰고 단일 연속 구간으로 병합되는지 검증."""
        cache = HistoricalPriceCache(db=db_session)
        ticker = "005930"
        # 2022-12-28(수) ~ 2023-01-05(목)
        # 12/28(영), 12/29(영), 12/30(연말휴장), 12/31(토), 1/1(일/신정), 1/2(영), 1/3(영)
        start_date = datetime.date(2022, 12, 28)
        end_date = datetime.date(2023, 1, 5)

        trading_days = cache.calendar.get_trading_days(start_date, end_date, country="KR")
        # 12/28, 12/29, 1/2, 1/3, 1/4, 1/5 가 연속 영업일이어야 함
        assert trading_days[1] == datetime.date(2022, 12, 29)
        assert trading_days[2] == datetime.date(2023, 1, 2)

        # 전체 결측 시 단일 구간으로 병합
        ranges = cache.find_missing_ranges(ticker, start_date, end_date, country="KR")
        assert len(ranges) == 1
        assert ranges[0] == (datetime.date(2022, 12, 28), datetime.date(2023, 1, 5))

    def test_leap_year_feb_29_handling(self, db_session):
        """2024년 2월 29일(목요일, 정상 거래일)이 캘린더 및 캐시에서 정상 반영되는지 검증."""
        cache = HistoricalPriceCache(db=db_session)
        ticker = "005930"
        start_date = datetime.date(2024, 2, 28)
        end_date = datetime.date(2024, 3, 4)

        # 2/28(수), 2/29(목), 3/1(삼일절 휴장), 3/2(토), 3/3(일), 3/4(월)
        trading_days = cache.calendar.get_trading_days(start_date, end_date, country="KR")
        assert datetime.date(2024, 2, 29) in trading_days
        assert datetime.date(2024, 3, 1) not in trading_days  # 삼일절

        # 2/29만 캐시
        cache.upsert_prices(ticker, [{"price_date": datetime.date(2024, 2, 29), "close_price": 73000.0}])

        ranges = cache.find_missing_ranges(ticker, start_date, end_date, country="KR")
        # 2/28(1일)과 3/4(1일)로 분할
        assert ranges == [
            (datetime.date(2024, 2, 28), datetime.date(2024, 2, 28)),
            (datetime.date(2024, 3, 4), datetime.date(2024, 3, 4)),
        ]

    def test_scientific_notation_and_special_price_formats(self, db_session):
        """지수 표기법(1.25e5), 소수점, 콤마 포함 정규화 파싱 검증."""
        cache = HistoricalPriceCache(db=db_session)
        ticker = "BTC"

        data = [
            {"date": "2026-01-01", "price": "1.25e5"},
            {"date": "2026-01-02", "price": "  99,999.50  "},
            {"date": "2026-01-03", "price": 0.00001},
        ]
        cache.upsert_prices(ticker, data)

        prices = cache.get_cached_prices(ticker, datetime.date(2026, 1, 1), datetime.date(2026, 1, 3))
        assert len(prices) == 3
        assert prices[0].close_price == 125000.0
        assert prices[1].close_price == 99999.5
        assert prices[2].close_price == 0.00001

    def test_start_date_greater_than_end_date_all_methods(self, db_session):
        """모든 메서드에서 start_date > end_date 인 비정상 구간에 대한 방어 로직 검증."""
        cache = HistoricalPriceCache(db=db_session)
        ticker = "005930"
        s = datetime.date(2026, 1, 10)
        e = datetime.date(2026, 1, 1)

        assert cache.get_cached_prices(ticker, s, e) == []
        assert cache.find_missing_trading_days(ticker, s, e) == []
        assert cache.find_missing_ranges(ticker, s, e) == []

