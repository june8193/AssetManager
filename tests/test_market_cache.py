# -*- coding: utf-8 -*-
"""과거 시세 캐시 계층(HistoricalPriceCache) 단위 테스트 모듈.

SQLite historical_prices 테이블 기반 시세 캐싱, 누락 영업일 탐지,
연속 누락 구간 그룹화, 시세 일괄 Upsert, Forward-fill 결측치 보정 로직을 검증합니다.
"""

import datetime
from unittest.mock import patch
import pytest

from src.backend.models import HistoricalPrice
from src.backend.market.calendar import MarketCalendar
from src.backend.market.cache import HistoricalPriceCache


class TestHistoricalPriceCache:
    """HistoricalPriceCache 클래스 테스트 스위트."""

    def test_cache_initialization(self, db_session):
        """캐시 객체 초기화 및 캘린더 기본값 주입을 검증합니다."""
        cache = HistoricalPriceCache(db=db_session)
        assert cache.db is db_session
        assert isinstance(cache.calendar, MarketCalendar)

        custom_calendar = MarketCalendar()
        cache2 = HistoricalPriceCache(db=db_session, calendar=custom_calendar)
        assert cache2.calendar is custom_calendar

    def test_get_cached_prices_empty(self, db_session):
        """데이터가 없는 경우 빈 리스트를 반환하는지 검증합니다."""
        cache = HistoricalPriceCache(db=db_session)
        start = datetime.date(2026, 1, 1)
        end = datetime.date(2026, 1, 10)

        prices = cache.get_cached_prices("005930", start, end)
        assert prices == []

    def test_get_cached_prices_filtered_and_ordered(self, db_session):
        """특정 티커 및 기간에 대해 날짜 오름차순으로 필터링되어 반환되는지 검증합니다."""
        cache = HistoricalPriceCache(db=db_session)

        # 데이터 적재: 005930 (3일치), AAPL (2일치)
        db_session.add_all([
            HistoricalPrice(ticker="005930", price_date=datetime.date(2026, 1, 5), close_price=70000.0),
            HistoricalPrice(ticker="005930", price_date=datetime.date(2026, 1, 2), close_price=69000.0),
            HistoricalPrice(ticker="005930", price_date=datetime.date(2026, 1, 15), close_price=72000.0),  # 범위 밖
            HistoricalPrice(ticker="AAPL", price_date=datetime.date(2026, 1, 5), close_price=180.0),       # 다른 티커
        ])
        db_session.commit()

        start = datetime.date(2026, 1, 1)
        end = datetime.date(2026, 1, 10)

        results = cache.get_cached_prices("005930", start, end)
        assert len(results) == 2
        assert results[0].price_date == datetime.date(2026, 1, 2)
        assert results[0].close_price == 69000.0
        assert results[1].price_date == datetime.date(2026, 1, 5)
        assert results[1].close_price == 70000.0

    def test_upsert_prices_list_of_dicts(self, db_session):
        """딕셔너리 리스트 형태의 시세 데이터를 성공적으로 적재(Upsert)하는지 검증합니다."""
        cache = HistoricalPriceCache(db=db_session)
        ticker = "005930"

        price_data = [
            {"price_date": datetime.date(2026, 1, 2), "close_price": 69000.0},
            {"price_date": datetime.date(2026, 1, 5), "close_price": 70000.0},
        ]
        cache.upsert_prices(ticker, price_data)

        cached = cache.get_cached_prices(ticker, datetime.date(2026, 1, 1), datetime.date(2026, 1, 10))
        assert len(cached) == 2
        assert cached[0].close_price == 69000.0
        assert cached[1].close_price == 70000.0

    def test_upsert_prices_dict_mapping(self, db_session):
        """Dict[date, float] 형태의 시세 데이터를 성공적으로 적재(Upsert)하는지 검증합니다."""
        cache = HistoricalPriceCache(db=db_session)
        ticker = "AAPL"

        price_dict = {
            datetime.date(2026, 1, 2): 180.5,
            datetime.date(2026, 1, 5): 182.0,
        }
        cache.upsert_prices(ticker, price_dict)

        cached = cache.get_cached_prices(ticker, datetime.date(2026, 1, 1), datetime.date(2026, 1, 10))
        assert len(cached) == 2
        assert cached[0].close_price == 180.5
        assert cached[1].close_price == 182.0

    def test_upsert_prices_update_conflict(self, db_session):
        """동일 날짜의 시세가 다시 인입될 때 기존 행을 덮어쓰기(Update)하는지 검증합니다."""
        cache = HistoricalPriceCache(db=db_session)
        ticker = "005930"
        p_date = datetime.date(2026, 1, 5)

        # 1차 삽입
        cache.upsert_prices(ticker, [{"price_date": p_date, "close_price": 70000.0}])
        cached = cache.get_cached_prices(ticker, p_date, p_date)
        assert len(cached) == 1
        assert cached[0].close_price == 70000.0

        # 2차 수정 Upsert
        cache.upsert_prices(ticker, [{"price_date": p_date, "close_price": 71500.0}])
        cached_after = cache.get_cached_prices(ticker, p_date, p_date)
        assert len(cached_after) == 1
        assert cached_after[0].close_price == 71500.0

    def test_upsert_prices_string_dates_and_formatted_numbers(self, db_session):
        """다양한 날짜 및 숫자 문자열 형식을 정상 정규화하여 저장하는지 검증합니다."""
        cache = HistoricalPriceCache(db=db_session)
        ticker = "005930"

        price_data = [
            {"date": "2026-01-02", "close": "69,500"},
            {"price_date": "20260105", "close_price": "+70500.0"},
            {"price_date": datetime.datetime(2026, 1, 6, 15, 30), "close_price": 71000},
        ]
        cache.upsert_prices(ticker, price_data)

        cached = cache.get_cached_prices(ticker, datetime.date(2026, 1, 1), datetime.date(2026, 1, 10))
        assert len(cached) == 3
        assert cached[0].price_date == datetime.date(2026, 1, 2)
        assert cached[0].close_price == 69500.0
        assert cached[1].price_date == datetime.date(2026, 1, 5)
        assert cached[1].close_price == 70500.0
        assert cached[2].price_date == datetime.date(2026, 1, 6)
        assert cached[2].close_price == 71000.0

    def test_upsert_prices_invalid_or_zero_ignored(self, db_session):
        """0 이하의 비정상 가격이나 유효하지 않은 항목은 무시하는지 검증합니다."""
        cache = HistoricalPriceCache(db=db_session)
        ticker = "005930"

        price_data = [
            {"price_date": datetime.date(2026, 1, 2), "close_price": 0.0},
            {"price_date": datetime.date(2026, 1, 3), "close_price": -100.0},
            {"price_date": datetime.date(2026, 1, 5), "close_price": 70000.0},
            {},
        ]
        cache.upsert_prices(ticker, price_data)

        cached = cache.get_cached_prices(ticker, datetime.date(2026, 1, 1), datetime.date(2026, 1, 10))
        assert len(cached) == 1
        assert cached[0].price_date == datetime.date(2026, 1, 5)
        assert cached[0].close_price == 70000.0

    def test_upsert_empty_input(self, db_session):
        """빈 입력에 대해 에러 없이 정상 처리되는지 검증합니다."""
        cache = HistoricalPriceCache(db=db_session)
        cache.upsert_prices("005930", [])
        cache.upsert_prices("005930", {})

    def test_find_missing_trading_days_all_missing(self, db_session):
        """캐시가 전혀 없을 때 조회 기간 내의 모든 영업일이 누락 목록으로 반환되는지 검증합니다."""
        cache = HistoricalPriceCache(db=db_session)
        ticker = "005930"

        # 2026-01-01(신정, 목) ~ 2026-01-07(수)
        # 영업일: 1/2(금), 1/5(월), 1/6(화), 1/7(수) -> 4일
        start = datetime.date(2026, 1, 1)
        end = datetime.date(2026, 1, 7)

        missing = cache.find_missing_trading_days(ticker, start, end, country="KR")
        assert missing == [
            datetime.date(2026, 1, 2),
            datetime.date(2026, 1, 5),
            datetime.date(2026, 1, 6),
            datetime.date(2026, 1, 7),
        ]

    def test_find_missing_trading_days_partially_cached(self, db_session):
        """일부 날짜만 캐시된 경우 누락된 영업일만 정확히 반환되는지 검증합니다."""
        cache = HistoricalPriceCache(db=db_session)
        ticker = "005930"

        # 1/2와 1/6 캐시 저장
        cache.upsert_prices(ticker, [
            {"price_date": datetime.date(2026, 1, 2), "close_price": 69000.0},
            {"price_date": datetime.date(2026, 1, 6), "close_price": 71000.0},
        ])

        start = datetime.date(2026, 1, 1)
        end = datetime.date(2026, 1, 7)

        missing = cache.find_missing_trading_days(ticker, start, end, country="KR")
        # 누락: 1/5(월), 1/7(수)
        assert missing == [
            datetime.date(2026, 1, 5),
            datetime.date(2026, 1, 7),
        ]

    def test_find_missing_trading_days_market_open_today(self, db_session):
        """오늘이 영업일이고 장중인 경우 캐시 여부와 무관하게 누락일(갱신 대상)로 처리되는지 검증합니다."""
        cache = HistoricalPriceCache(db=db_session)
        ticker = "005930"

        today = datetime.date(2026, 1, 5)  # 월요일 (영업일)
        cache.upsert_prices(ticker, [{"price_date": today, "close_price": 70000.0}])

        # 1. 장중인 경우 -> 오늘이 누락일로 판정되어야 함
        with patch.object(cache.calendar, "is_kr_market_open", return_value=True):
            with patch("src.backend.market.cache.datetime") as mock_dt:
                mock_dt.date.today.return_value = today
                mock_dt.date.side_effect = datetime.date
                mock_dt.timedelta = datetime.timedelta

                missing = cache.find_missing_trading_days(ticker, today, today, country="KR")
                assert today in missing

        # 2. 장 마감 후인 경우 -> 이미 캐시되어 있으므로 누락되지 않음
        with patch.object(cache.calendar, "is_kr_market_open", return_value=False):
            with patch("src.backend.market.cache.datetime") as mock_dt:
                mock_dt.date.today.return_value = today
                mock_dt.date.side_effect = datetime.date
                mock_dt.timedelta = datetime.timedelta

                missing = cache.find_missing_trading_days(ticker, today, today, country="KR")
                assert missing == []

    def test_find_missing_trading_days_invalid_range(self, db_session):
        """start_date > end_date인 경우 빈 리스트를 반환하는지 검증합니다."""
        cache = HistoricalPriceCache(db=db_session)
        start = datetime.date(2026, 1, 10)
        end = datetime.date(2026, 1, 1)

        missing = cache.find_missing_trading_days("005930", start, end, country="KR")
        assert missing == []

    def test_find_missing_ranges_empty_and_single(self, db_session):
        """누락일이 없거나 단일 일자인 경우 누락 구간 생성을 검증합니다."""
        cache = HistoricalPriceCache(db=db_session)
        ticker = "005930"

        # 1. 누락일 없음
        cache.upsert_prices(ticker, [
            {"price_date": datetime.date(2026, 1, 2), "close_price": 69000.0},
        ])
        ranges = cache.find_missing_ranges(ticker, datetime.date(2026, 1, 2), datetime.date(2026, 1, 2), country="KR")
        assert ranges == []

        # 2. 단일 누락일 (1/5 월요일)
        ranges2 = cache.find_missing_ranges(ticker, datetime.date(2026, 1, 5), datetime.date(2026, 1, 5), country="KR")
        assert ranges2 == [(datetime.date(2026, 1, 5), datetime.date(2026, 1, 5))]

    def test_find_missing_ranges_consecutive_and_split(self, db_session):
        """연속된 누락 영업일 그룹화 및 주말을 건너뛴 연속 구간 처리를 검증합니다."""
        cache = HistoricalPriceCache(db=db_session)
        ticker = "005930"

        # 2026-01-01(신정,목) ~ 2026-01-14(수)
        # 영업일 목록:
        # W1: 1/2(금)
        # W2: 1/5(월), 1/6(화), 1/7(수), 1/8(목), 1/9(금)
        # W3: 1/12(월), 1/13(화), 1/14(수)

        # 1/7(수)와 1/8(목)만 캐시 저장
        cache.upsert_prices(ticker, [
            {"price_date": datetime.date(2026, 1, 7), "close_price": 70000.0},
            {"price_date": datetime.date(2026, 1, 8), "close_price": 70500.0},
        ])

        start = datetime.date(2026, 1, 1)
        end = datetime.date(2026, 1, 14)

        ranges = cache.find_missing_ranges(ticker, start, end, country="KR")
        # 구간 1: 1/2(금) ~ 1/6(화) (1/2 금요일과 1/5 월요일은 연속 영업일)
        # 구간 2: 1/9(금) ~ 1/14(수) (1/9 금요일과 1/12 월요일은 연속 영업일)
        assert ranges == [
            (datetime.date(2026, 1, 2), datetime.date(2026, 1, 6)),
            (datetime.date(2026, 1, 9), datetime.date(2026, 1, 14)),
        ]

    def test_get_last_known_price(self, db_session):
        """특정 날짜 이전의 가장 최근 유효 종가를 정상 조회하는지 검증합니다."""
        cache = HistoricalPriceCache(db=db_session)
        ticker = "005930"

        # 1/2: 69000, 1/5: 70000, 1/8: 71000
        cache.upsert_prices(ticker, [
            {"price_date": datetime.date(2026, 1, 2), "close_price": 69000.0},
            {"price_date": datetime.date(2026, 1, 5), "close_price": 70000.0},
            {"price_date": datetime.date(2026, 1, 8), "close_price": 71000.0},
        ])

        # 1/1 이전 -> 없음 (None)
        assert cache.get_last_known_price(ticker, datetime.date(2026, 1, 1)) is None

        # 1/5 이전(당일 포함) -> 70000.0
        assert cache.get_last_known_price(ticker, datetime.date(2026, 1, 5)) == 70000.0

        # 1/7 이전 -> 1/5의 70000.0
        assert cache.get_last_known_price(ticker, datetime.date(2026, 1, 7)) == 70000.0

        # 1/10 이전 -> 1/8의 71000.0
        assert cache.get_last_known_price(ticker, datetime.date(2026, 1, 10)) == 71000.0

    def test_apply_forward_fill_basic(self, db_session):
        """비영업일/결측일에 대해 직전 유효 거래일 종가로 Forward-fill 되는지 검증합니다."""
        cache = HistoricalPriceCache(db=db_session)

        # 1/2(금): 69000, 1/5(월): 70000
        prices = [
            {"price_date": datetime.date(2026, 1, 2), "close_price": 69000.0},
            {"price_date": datetime.date(2026, 1, 5), "close_price": 70000.0},
        ]

        # 1/2(금) ~ 1/6(화) 전체 날짜에 대해 forward-fill
        target_dates = [
            datetime.date(2026, 1, 2),  # 금
            datetime.date(2026, 1, 3),  # 토 (주말)
            datetime.date(2026, 1, 4),  # 일 (주말)
            datetime.date(2026, 1, 5),  # 월
            datetime.date(2026, 1, 6),  # 화 (결측일)
        ]

        filled = cache.apply_forward_fill(prices, target_dates)
        assert len(filled) == 5
        assert filled[0] == {"price_date": datetime.date(2026, 1, 2), "close_price": 69000.0}
        assert filled[1] == {"price_date": datetime.date(2026, 1, 3), "close_price": 69000.0}
        assert filled[2] == {"price_date": datetime.date(2026, 1, 4), "close_price": 69000.0}
        assert filled[3] == {"price_date": datetime.date(2026, 1, 5), "close_price": 70000.0}
        assert filled[4] == {"price_date": datetime.date(2026, 1, 6), "close_price": 70000.0}

    def test_apply_forward_fill_with_fallback(self, db_session):
        """시작 구간 결측 시 fallback_price를 활용하여 Forward-fill 되는지 검증합니다."""
        cache = HistoricalPriceCache(db=db_session)

        # 1/5(월)부터 가격 존재
        prices = [
            {"price_date": datetime.date(2026, 1, 5), "close_price": 70000.0},
        ]

        target_dates = [
            datetime.date(2026, 1, 1),
            datetime.date(2026, 1, 2),
            datetime.date(2026, 1, 5),
        ]

        # fallback_price = 68000.0 지정
        filled = cache.apply_forward_fill(prices, target_dates, fallback_price=68000.0)
        assert len(filled) == 3
        assert filled[0] == {"price_date": datetime.date(2026, 1, 1), "close_price": 68000.0}
        assert filled[1] == {"price_date": datetime.date(2026, 1, 2), "close_price": 68000.0}
        assert filled[2] == {"price_date": datetime.date(2026, 1, 5), "close_price": 70000.0}

    def test_apply_forward_fill_with_dict_and_empty_targets(self, db_session):
        """Dict 입력 형식 및 빈 target_dates에 대해 정상 동작하는지 검증합니다."""
        cache = HistoricalPriceCache(db=db_session)

        price_dict = {
            datetime.date(2026, 1, 2): 100.0,
            datetime.date(2026, 1, 5): 105.0,
        }

        # 빈 target_dates
        assert cache.apply_forward_fill(price_dict, []) == []

        # Dict 입력 forward fill
        target_dates = [
            datetime.date(2026, 1, 2),
            datetime.date(2026, 1, 3),
            datetime.date(2026, 1, 5),
        ]
        filled = cache.apply_forward_fill(price_dict, target_dates)
        assert len(filled) == 3
        assert filled[0]["close_price"] == 100.0
        assert filled[1]["close_price"] == 100.0
        assert filled[2]["close_price"] == 105.0

    def test_package_export(self):
        """src.backend.market 패키지에서 HistoricalPriceCache가 정상 export되는지 검증합니다."""
        from src.backend.market import HistoricalPriceCache as ExportedCache
        assert ExportedCache is HistoricalPriceCache

    def test_find_missing_trading_days_us_market_open(self, db_session):
        """미국 시장(US)에 대해 장중일 때 오늘의 날짜가 누락일로 판정되는지 검증합니다."""
        cache = HistoricalPriceCache(db=db_session)
        ticker = "AAPL"
        today = datetime.date(2026, 1, 5)  # 월요일

        cache.upsert_prices(ticker, [{"price_date": today, "close_price": 185.0}])

        with patch.object(cache.calendar, "is_us_market_open", return_value=True):
            with patch("src.backend.market.cache.datetime") as mock_dt:
                mock_dt.date.today.return_value = today
                mock_dt.date.side_effect = datetime.date
                mock_dt.timedelta = datetime.timedelta

                missing = cache.find_missing_trading_days(ticker, today, today, country="US")
                assert today in missing

    def test_apply_forward_fill_no_initial_price_and_no_fallback(self, db_session):
        """fallback_price가 없고 첫 타깃 날짜들에 대해 시세가 없는 경우 해당 날짜들은 결과에서 제외되는지 검증합니다."""
        cache = HistoricalPriceCache(db=db_session)

        # 1/5부터 시세 존재
        prices = [
            {"price_date": datetime.date(2026, 1, 5), "close_price": 70000.0},
        ]
        target_dates = [
            datetime.date(2026, 1, 2),  # 시세 없음, fallback 없음 -> 제외
            datetime.date(2026, 1, 3),  # 시세 없음, fallback 없음 -> 제외
            datetime.date(2026, 1, 5),  # 70000.0
            datetime.date(2026, 1, 6),  # 70000.0 (Forward-fill)
        ]

        filled = cache.apply_forward_fill(prices, target_dates, fallback_price=None)
        assert len(filled) == 2
        assert filled[0] == {"price_date": datetime.date(2026, 1, 5), "close_price": 70000.0}
        assert filled[1] == {"price_date": datetime.date(2026, 1, 6), "close_price": 70000.0}

