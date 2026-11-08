# 01 — MarketCalendar 공휴일 객체 캐싱 및 HistoricalPriceCache 영업일 중복 계산 제거

**Spec:** [spec.md](../spec.md)

**What to build:**
`MarketCalendar`에서 `(country, year)` 단위로 `holidays.SouthKorea` 및 `holidays.NYSE` 인스턴스를 캐싱하여 매 날짜마다 공휴일 객체를 재생성하던 CPU 병목(전체 지연의 89.4%)을 제거하고, `HistoricalPriceCache.find_missing_ranges`에서 동일 구간에 대해 `get_trading_days`가 2회 중복 호출되던 구조를 1회 호출로 단일화합니다.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] `MarketCalendar`에서 한국(`KR`) 및 미국(`US`)의 연도별 `holidays` 인스턴스를 캐싱하여 동일 연도 날짜 판정 시 `holidays.SouthKorea` / `holidays.NYSE`가 재생성되지 않는다.
- [x] 주말, 근로자의 날(5/1), KRX 연말 휴장일, 제헌절(7/17 영업일 예외), 미국 NYSE 공휴일 등 기존 `get_market_holiday_info`, `is_market_holiday`, `get_trading_days`의 모든 판정 결과가 기존과 100% 동일하게 유지된다.
- [x] `HistoricalPriceCache.find_missing_ranges` 실행 시 내부에서 `calendar.get_trading_days`가 중복 호출되지 않고 1회만 호출된다.
- [x] 38년 구간(1988-01-01 ~ 2026-12-31)에 대한 `MarketCalendar.get_trading_days` 호출이 KR/US 각각 100ms 이내에 완료됨을 검증하는 단위 테스트가 추가되고 통과한다 (`uv run pytest tests/test_market_calendar.py tests/test_market_cache.py`).
