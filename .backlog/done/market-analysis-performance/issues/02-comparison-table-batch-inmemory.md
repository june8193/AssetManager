# 02 — MarketAnalysisService.get_index_comparison_table N+1 제거 및 인메모리 일괄 계산

**Spec:** [spec.md](../spec.md)

**What to build:**
`MarketAnalysisService.get_index_comparison_table`에서 연도별×지수별 중첩 루프마다 `benchmark_service.get_historical_prices`를 108회 이상 반복 호출하던 N+1 구조를 제거하고, `asyncio.gather`로 4대 지수의 전체 대상 기간(`datetime.date(start_year, 1, 1) - timedelta(days=10)` ~ `today`) 시세를 단 1회(총 4회) 병렬 조회한 뒤 메모리 상에서 연도별 수익률을 계산하도록 개선합니다.

**Blocked by:** 01-calendar-and-cache-optimization

**Status:** resolved

- [x] `MarketAnalysisService.get_index_comparison_table` 실행 시 `benchmark_service.get_historical_prices`가 4대 지수(`^KS11`, `^KQ11`, `^GSPC`, `^IXIC`)에 대해 지수당 1회씩(총 4회)만 `asyncio.gather`로 병렬 호출된다.
- [x] 직전 연도 마지막 영업일 종가 확보를 위해 `datetime.date(start_year, 1, 1) - datetime.timedelta(days=10)`부터 `today`까지 조회한 시세를 기반으로 인메모리에서 연도별 수익률을 계산한다.
- [x] 동적 시작 연도 산출(`start_year = max(min_years)`), 연도별 수익률 계산값(소수점 둘째 자리 반올림), 최신 연도순(내림차순) 정렬 결과가 기존과 동일하게 유지된다.
- [x] `tests/test_market_analysis.py`에 `get_index_comparison_table` 호출 시 `get_historical_prices` 호출 횟수(4회) 및 수익률 정합성을 검증하는 테스트가 추가되고 전체 백엔드 테스트가 통과한다 (`uv run pytest tests/test_market_analysis.py`).
