# 03 — MarketAnalysisPage 비교 탭 지연 로딩(Lazy Load) 및 상태 캐싱 적용

**Spec:** [spec.md](../spec.md)

**What to build:**
`MarketAnalysisPage.jsx` 마운트 시 비활성 탭인 `'4대 지수 연간 수익률 비교'` API(`/api/market/analysis/comparison`)를 무조건 동시 호출하던 로직을 제거하고, 사용자가 `'4대 지수 연간 수익률 비교'` 탭(`activeTab === 'comparison'`)을 클릭했을 때 데이터가 아직 로드되지 않은 경우에만 1회 호출(로딩/에러 상태 표시 및 탭 재전환 시 캐시 재사용)하도록 개선합니다.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] `MarketAnalysisPage` 최초 마운트 시(기본 `activeTab === 'individual'`)에는 `/api/market/analysis/historical`과 `/api/market/analysis/stats`만 호출되고, `/api/market/analysis/comparison`은 호출되지 않는다.
- [x] 사용자가 `'4대 지수 연간 수익률 비교'` 탭을 처음 클릭하면 `/api/market/analysis/comparison`을 호출하며, 로딩 중 인디케이터 및 에러 발생 시 재시도 UI가 정상 동작한다.
- [x] 이미 `comparisonData`가 로드된 상태에서 `'지수별 상세 분석'` 탭과 `'4대 지수 연간 수익률 비교'` 탭을 왕복 전환할 때 `/api/market/analysis/comparison`을 중복 재호출하지 않고 캐시된 데이터를 즉시 표시한다.
- [x] `src/frontend/src/pages/MarketAnalysisPage.test.jsx`에 초기 마운트 시 `comparison` 미호출 및 탭 전환 시 지연 로딩·캐싱 동작을 검증하는 단위 테스트가 추가되고 통과한다 (`pnpm test -- run MarketAnalysisPage.test.jsx`).
