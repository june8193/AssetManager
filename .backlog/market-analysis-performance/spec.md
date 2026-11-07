# Spec: 지수분석(MarketAnalysisPage) 초기 화면 로딩 속도 최적화

## Problem Statement (문제 정의)

데스크탑 웹의 `시장분석 > 지수분석` (`/market/analysis`) 메뉴로 진입할 때 초기 차트 및 상세 통계 화면이 표시되기까지 **약 21.5초(재진입 시 최대 30.3초)**가 소요되며, 백그라운드 비교 테이블 API 완료까지는 **최대 145초**가 걸려 심각한 사용자 경험 저하가 발생하고 있습니다.

프로파일링(`cProfile`) 및 네트워크 측정 결과 확인된 4가지 병목 원인은 다음과 같습니다:

1. **`MarketCalendar`의 공휴일 인스턴스 매 날짜 반복 생성 (전체 시간의 89.4% 차지)**:
   - `MarketCalendar.get_trading_days()`가 조회 기간의 모든 날짜를 순회하며 `is_market_holiday()` ➔ `get_market_holiday_info()`를 호출할 때, 평일 매 날짜마다 `holidays.SouthKorea(years=target_date.year)` 또는 `holidays.NYSE(years=target_date.year)` 인스턴스를 새로 생성하고 `gettext` 번역 파일 탐색을 반복합니다.
   - `get_index_comparison_table()` 1회 실행(98.9초) 중 `holidays` 생성자가 **56,570회** 호출되며 **88.38초**를 소모합니다.
2. **`HistoricalPriceCache.find_missing_ranges`의 영업일 목록 2중 산출**:
   - `find_missing_ranges()` 내부에서 `find_missing_trading_days()`(내부적으로 `get_trading_days()` 호출)를 실행한 직후, 연속 구간 판별을 위해 동일한 기간의 `self.calendar.get_trading_days()`를 또 한 번 호출하여 모든 `get_historical_prices` 호출마다 캘린더 연산 비용이 2배로 증가합니다.
3. **`MarketAnalysisService.get_index_comparison_table`의 중첩 루프 N+1 호출 (총 112회 호출)**:
   - 4대 지수(`^KS11`, `^KQ11`, `^GSPC`, `^IXIC`)의 전체 구간 시세를 조회한 뒤에도, 연도별(`start_year ~ end_year`) × 지수별 중첩 루프 안에서 이미 조회된 시세를 재사용하지 않고 `benchmark_service.get_historical_prices()`를 **108회 추가 호출**합니다.
4. **프론트엔드(`MarketAnalysisPage.jsx`) 마운트 시 비활성 탭(`comparison`) 동시 호출로 인한 이벤트 루프 블로킹**:
   - 초기 활성 탭이 `'지수별 상세 분석'`(`individual`)임에도 마운트 시점에 두 번째 탭 전용 API인 `/api/market/analysis/comparison`을 무조건 동시에 호출합니다.
   - 백엔드 `comparison` 요청이 동기 CPU 연산(`find_missing_ranges`)으로 단일 FastAPI 이벤트 루프를 점유하면서, 원래 합쳐서 1초 미만이면 끝날 `historical`과 `stats` 응답까지 15~21초 이상 지연됩니다.

## Solution (해결 방안)

1. **`MarketCalendar` 공휴일 객체 캐싱 및 `HistoricalPriceCache` 영업일 산출 단일화**:
   - `MarketCalendar`에서 `(country, year)` 단위로 `holidays.SouthKorea` 및 `holidays.NYSE` 인스턴스를 캐싱하여 동일 연도에 대해 공휴일 객체가 1회만 생성되도록 개선합니다.
   - `HistoricalPriceCache.find_missing_ranges()`에서 `get_trading_days()`를 1회만 호출하여 누락 영업일 판별과 연속 구간 그룹화에 공통으로 재사용합니다.
2. **`get_index_comparison_table` 인메모리 일괄 연산 전환**:
   - 4대 지수의 전체 대상 기간(`datetime.date(start_year, 1, 1) - timedelta(days=10)` ~ `today`) 시세를 `asyncio.gather`로 1회(총 4회)만 병렬 조회한 뒤, 반환된 시세 리스트를 메모리에서 연도별로 그룹화하여 수익률을 계산합니다.
3. **`MarketAnalysisPage` 비교 탭 지연 로딩(Lazy Load) 및 상태 캐싱**:
   - 페이지 최초 마운트 시에는 활성 탭인 `'지수별 상세 분석'`(`historical`, `stats`) API만 호출합니다.
   - 사용자가 `'4대 지수 연간 수익률 비교'` 탭(`activeTab === 'comparison'`)을 클릭했을 때만 `comparisonData`가 없을 경우에 한해 `/api/market/analysis/comparison`을 호출하고, 이후 탭 전환 시에는 상태에 캐싱된 데이터를 재사용합니다.

## User Stories (사용자 스토리)

1. As an investor, I want the `시장분석 > 지수분석` initial screen (`지수별 상세 분석` tab) to load within 1 second on desktop web, so that I can immediately analyze index trends, MDD, and VIX without waiting 20+ seconds.
2. As an investor, I want the frontend to avoid fetching the `'4대 지수 연간 수익률 비교'` data on initial page mount when I am viewing the `'지수별 상세 분석'` tab, so that background requests do not block or delay the initial chart rendering.
3. As an investor, I want the `'4대 지수 연간 수익률 비교'` table to load quickly when I click its tab and remain cached when I switch back and forth between tabs, so that tab navigation feels instantaneous.
4. As a developer, I want `MarketCalendar` to cache `holidays` instances per `(country, year)` and `HistoricalPriceCache.find_missing_ranges` to compute trading days only once per call, so that multi-decade trading day lookups complete in milliseconds across the entire application.
5. As a developer, I want `MarketAnalysisService.get_index_comparison_table` to fetch the 4 benchmark indices once in parallel via `asyncio.gather` and compute annual returns in memory, so that N+1 database and calendar queries are completely eliminated.

## Implementation Decisions (구현 결정사항)

1. **API 스펙 및 하위 호환성 유지**:
   - 기존 백엔드 엔드포인트(`GET /api/market/analysis/historical`, `GET /api/market/analysis/stats`, `GET /api/market/analysis/comparison`)의 경로, 쿼리 파라미터, 응답 JSON 스키마는 변경하지 않습니다.
2. **`MarketCalendar` 공휴일 캐시 계약 (`src/backend/market/calendar.py`)**:
   - 연도별 공휴일 조회 헬퍼(예: `_get_kr_holidays(year: int)`, `_get_us_holidays(year: int)`)에 `@functools.lru_cache(maxsize=128)` 또는 클래스 캐시를 적용하여 `(country, year)`당 최초 1회만 `holidays.SouthKorea(years=year)` / `holidays.NYSE(years=year)`를 생성합니다.
   - 기존 공휴일 명칭 매핑(`HOLIDAY_NAME_MAP`), 근로자의 날(5/1), KRX 연말 휴장일, 제헌절(7/17 영업일 예외) 판정 불변식은 100% 동일하게 유지합니다.
3. **`HistoricalPriceCache` 영업일 산출 단일화 (`src/backend/market/cache.py`)**:
   - `find_missing_trading_days`와 `find_missing_ranges`에서 `self.calendar.get_trading_days(start_date, end_date, country=country)`가 중복 호출되지 않도록 내부 헬퍼 분리 또는 `all_trading_days` 재사용 구조로 리팩토링합니다.
4. **`MarketAnalysisService.get_index_comparison_table` 인메모리 집계 (`src/backend/services/market_analysis_service.py`)**:
   - `start_year` 결정 후 `query_start = datetime.date(start_year, 1, 1) - datetime.timedelta(days=10)`부터 `today`까지의 시세를 4대 지수에 대해 `await asyncio.gather(*(self.benchmark_service.get_historical_prices(t, query_start, today) for t in tickers))`로 1회 일괄 수집합니다.
   - 각 지수별로 유효 종가(`close_price > 0.0`)를 날짜 오름차순으로 정렬해 메모리에 보관하고, `for year in range(start_year, end_year + 1):` 루프에서는 추가 DB/프로바이더 호출 없이 인메모리 리스트에서 당해 연도 시세(`curr_year_prices`)와 직전 연도 말일 기준가(`prev_year_end_val`)를 찾아 기존과 동일한 수익률 공식(`((year_end_val - base_val) / base_val) * 100`)으로 계산합니다.
5. **프론트엔드 지연 로딩 및 캐싱 (`src/frontend/src/pages/MarketAnalysisPage.jsx`)**:
   - 마운트 시 무조건 `fetchComparisonData()`를 호출하던 `useEffect(() => { fetchComparisonData(); }, [])`를 제거합니다.
   - `activeTab === 'comparison'`일 때 `comparisonData === null`인 경우에만 `fetchComparisonData()`를 실행하며, 로딩 중 상태(`loading`)와 에러 상태(`error`)를 일관되게 처리합니다. 이미 `comparisonData`가 로드된 상태라면 탭 재전환 시 API를 재호출하지 않습니다.

## Testing Decisions (테스트 결정사항)

- **검증 기준**: 구현 세부사항이 아닌 공개 인터페이스(메서드 반환값, 호출 횟수 계약, UI 렌더링 및 네트워크 요청 발생 시점)를 검증합니다.
- **핵심 테스트 심 (Test Seams)**:
  1. `tests/test_market_calendar.py` & `tests/test_market_cache.py`:
     - 공휴일 판정 및 영업일 추출 결과의 기존 정합성 유지 검증.
     - 장기간(예: 1988~2026년, 38년) `get_trading_days` 반복 호출 시 캐싱을 통해 고속(수십 ms 이내)으로 완료되는지 검증.
     - `find_missing_ranges` 호출 시 `calendar.get_trading_days`가 1회만 호출되는지 검증.
  2. `tests/test_market_analysis.py`:
     - `get_index_comparison_table()` 호출 시 `benchmark_service.get_historical_prices`가 지수당 1회씩 총 4회만 호출되는지(중첩 루프 N+1 제거) 검증.
     - 동적 시작 연도(`test_market_analysis_service_dynamic_start_year`) 및 연도별 수익률 계산 결과가 기존과 동일하게 유지되는지 검증.
  3. `src/frontend/src/pages/MarketAnalysisPage.test.jsx`:
     - 초기 렌더링(`지수별 상세 분석` 탭) 시 `/api/market/analysis/historical`과 `/api/market/analysis/stats`만 호출되고 `/api/market/analysis/comparison`은 호출되지 않음을 검증.
     - `'4대 지수 연간 수익률 비교'` 탭 클릭 시 `/api/market/analysis/comparison`이 호출되어 테이블이 렌더링되고, 다시 탭을 왕복 전환할 때 중복 호출되지 않음을 검증.

## Out of Scope (범위 제외 사항)

- 데이터베이스 스키마 변경 및 Alembic 마이그레이션.
- `/api/market/analysis/historical`과 `/api/market/analysis/stats` 엔드포인트의 통폐합.
- 차트 시각화(Recharts) 디자인 및 지수/기간 필터 UI 레이아웃 변경.

## Further Notes (기타 참고사항)

- 모든 구현과 테스트는 `GEMINI.md`의 규칙(한국어 주석/문서/커밋, `uv run pytest` 순차 실행, Vitest 단위 테스트 및 E2E 브라우저 검증)을 엄격히 준수합니다.
