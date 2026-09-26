# 모바일 지출 관리 및 기간별 지출 분석 사양서 (Mobile Expenses and Period Analysis Spec)

Status: ready-for-agent

## Problem Statement

현재 AssetManager의 지출 관리 시스템은 다음과 같은 한계가 존재합니다:

1. **모바일 접근성 부재**: 지출 관리 기능이 오직 데스크탑 웹 환경(`/expenses`)에만 종속되어 있으며, 모바일 하단 탭 바 및 전용 모바일 화면이 없어 사용자가 스마트폰으로 이동 중이거나 일상생활 중 즉각적으로 최근 지출이나 예산 소진 현황을 모니터링하기 어렵습니다.
2. **단일 월(1개월) 조회에 국한된 분석 한계**: 현재 통계 및 원장 조회가 단일 월(`year_month`)로 고정되어 있어, 2~3개월 분기별 지출 흐름, 최근 반기(6개월) 또는 1년간의 누적 지출 규모, 특정 계절별/연간 지출 패턴 및 카테고리별 비중을 종합적으로 비교·분석할 수 없습니다.
3. **평균 지출 파악 및 대용량 데이터 로딩 부하**: 기간이 길어질 경우 해당 기간 동안의 '월평균 지출' 수준을 직관적으로 확인하기 어려우며, 수개월~수년 치 거래 내역을 한 번에 모두 브라우저 메모리에 로드할 경우 렌더링 지연과 브라우저 성능 저하가 발생할 수 있습니다.

## Solution

1. **모바일 6대 탭 바 및 모바일 전용 지출 관리 화면 신설**:
   - 모바일 하단 탭 바에 '지출' 탭(`/m/expenses`)을 추가하여 6대 핵심 탭 체계(대시보드 / 자산 조회 / 지출 / 지수분석 / 비중 점검 / 설정)로 즉시 전환을 지원합니다.
   - 스마트폰 뷰포트에 맞춘 KPI 요약 카드(총 지출, 월평균 지출, 전기간 대비 증감률), 카테고리 비중 랭킹, 카드형 거래 내역 및 100건 단위 페이징(더보기) 기능을 제공합니다.
2. **정해진 기간(Multi-Period) 지출 분석 기능 도입 (데스크탑 및 모바일 공통)**:
   - **빠른 프리셋 지원**: `당월`, `최근 3개월`, `최근 6개월`, `최근 1년`, `올해 누적(YTD)` 원클릭 선택 버튼 제공.
   - **시작월 ~ 종료월 직접 지정 지원**: 데스크탑 콤보박스 및 모바일 토글형 패널을 통해 원하는 기간(Start YYYY-MM ~ End YYYY-MM)을 자유롭게 설정.
   - **신규 핵심 지표 제공**: 선택 기간 총 지출액과 함께 기간 개월 수로 나눈 **`월평균 지출(Monthly Average)`** 카드 신설 및 직전 동기간 대비 증감률 표시.
   - **동적 다기간 시각화**: 선택한 기간(2~12개월 등)에 맞춰 월별 지출 추이 막대 그래프와 카테고리별 누적 비중 차트를 실시간 재집계하여 렌더링.
3. **100건 단위 페이징 및 성능 최적화**:
   - 데이터베이스 수준에서 기간 총액 및 카테고리 비중을 집계하고, 거래 목록은 최신순 정렬 + 100건 단위 페이징(더보기)으로 처리하여 대용량 거래 데이터에서도 쾌적한 반응성을 보장합니다.

## User Stories

1. As a mobile user, I want to access the expense management screen via a dedicated '지출' tab on the mobile bottom tab bar, so that I can quickly review household outlays on my smartphone.
2. As a mobile user, I want the bottom tab bar to neatly accommodate all 6 navigation tabs without overflowing or visual clipping, so that switching between dashboard, assets, expenses, market, ratios, and settings is frictionless.
3. As a mobile user, I want the route guard to permit access to `/m/expenses`, so that mobile navigation does not redirect me back to the root dashboard unexpectedly.
4. As a user, I want to switch between preset periods ('당월', '최근 3개월', '최근 6개월', '최근 1년', '올해 누적') with a single click, so that I can immediately examine short-term and long-term spending patterns.
5. As a user, I want to select a custom start month and end month on both desktop and mobile, so that I can analyze arbitrary spending periods such as specific vacation durations or project cycles.
6. As a mobile user, I want a toggleable custom date picker panel that fits within standard smartphone screen widths, so that specifying custom date ranges is thumb-friendly and intuitive.
7. As a user, I want to view the 'Total Expenses' for the selected period, so that I understand my aggregate capital outflow over that specific timeframe.
8. As a user, I want to view the 'Monthly Average Expenses' alongside the total expenses, so that I can easily gauge my baseline monthly burn rate normalized across multi-month periods.
9. As a user, I want to see how the current period's total and average compare to the preceding period of identical duration (e.g., comparing the last 3 months with the prior 3 months), so that I know whether my spending trajectory is expanding or contracting.
10. As a user, I want to view the latest month's total spending and its month-over-month (MoM) change rate, so that I stay aware of immediate recent changes even when browsing multi-month stats.
11. As a user, I want to see the total amount of excluded transactions for the selected period, so that I can verify that internal transfers and credit card repayments are accurately omitted from living expense totals.
12. As a desktop user, I want a multi-bar trend chart displaying each month's spending within the selected duration, so that I can spot spending spikes, seasonality, or steady declines.
13. As a desktop user, I want a dashed horizontal benchmark line representing the period's monthly average drawn over the bar chart, so that I can instantly tell which months exceeded the baseline.
14. As a mobile user, I want a responsive or horizontally scrollable monthly trend chart, so that I can examine multi-month bars without cramped labels on smaller screens.
15. As a user, I want to view category expenditure totals and percentage shares aggregated over the entire selected period, so that I can evaluate which categories dominate my long-term consumption.
16. As a user, I want category breakdown visualizations (progress bars and rank orders) that update immediately when the date range or owner changes, so that the analysis remains strictly synchronized with my filter criteria.
17. As a user, I want to filter both statistics and transactions by owner ('전체', '장준', '성은') across any selected period, so that I can distinguish between individual personal expenses and combined household outlays.
18. As a mobile user, I want to view recent transactions formatted as clean touch-friendly cards showing merchant name, date, owner, payment method, category badge, and amount, so that ledger review is effortless on mobile devices.
19. As a user, I want transaction ledgers over long periods to paginate in batches of 100 with a 'Load More' button, so that the browser does not freeze or stutter when handling thousands of transaction rows.
20. As a desktop user, I want to change an individual transaction's category inline from the ledger table, and have the period statistics recalculate immediately without a full page reload.
21. As a desktop user, I want to toggle a transaction's statistic exclusion checkbox inline from the ledger table, and observe the period total and monthly average update instantly.
22. As a mobile user, I want to search and filter transactions by merchant keyword or category within the selected period, so that I can quickly track down specific past purchases on my phone.
23. As a user, I want statement file upload and payment method/category master configuration to remain housed on desktop, preventing accidental heavy operations on mobile touchscreens.

## Implementation Decisions

### 1. 백엔드 통계 및 거래 API 확장 계약

- **`GET /api/expenses/stats` 엔드포인트 파라미터 확장**:
  - `start_month` (Optional[str], 형식: `YYYY-MM`): 조회 시작년월
  - `end_month` (Optional[str], 형식: `YYYY-MM`): 조회 종료년월
  - `year_month` (Optional[str]): 기존 단일월 파라미터 (하위 호환성 유지: `start_month`/`end_month` 미지정 시 단일월 기준으로 자동 매핑)
  - `owner` (Optional[str]): 소유주 필터 ('전체' 또는 None 지정 시 가구 전체)
- **통계 응답 스키마 (`ExpenseStatsResponse`) 확장**:
  - `start_month` (str): 집계 시작월
  - `end_month` (str): 집계 종료월
  - `period_months` (int): 집계 기간 총 개월 수 (예: 3)
  - `period_total` (float): 해당 기간 동안의 총 지출 순합계 (통계 제외 거래 제외)
  - `monthly_average` (float): 기간 총 지출을 개월 수로 나눈 균등 월평균 (`period_total / period_months`)
  - `prev_period_total` (float): 직전 동기간(동일 개월 수) 총 지출액
  - `prev_period_change_amount` (float): 직전 동기간 대비 증감액
  - `prev_period_change_rate` (float): 직전 동기간 대비 증감률 (%)
  - `monthly_trends` (List[MonthlyTrendItem]): 기간 내에 포함된 모든 월의 `year_month` 및 `total_amount` 리스트 (최신 기간에 맞춘 동적 바차트 데이터)
  - `category_breakdown` (List[CategoryBreakdownItem]): 기간 누적 카테고리별 합계 금액 및 비중(%)
  - `payment_method_breakdown` (List[PaymentMethodBreakdownItem]): 기간 누적 결제수단별 합계 금액 및 비중(%)
- **`GET /api/expenses` 거래 목록 엔드포인트 확장**:
  - `start_month`, `end_month` 필터링 지원 (`Expense.year_month >= start_month`, `<= end_month`).
  - `limit` (기본값: 100, 최대값: 200) 및 `offset` (기본값: 0) 파라미터 지원.
  - 최신순 정렬(`transaction_date.desc()`, `id.desc()`) 유지.

### 2. 프론트엔드 서비스 및 컴포넌트 아키텍처

- **서비스 레이어 (`expenseService.js`)**:
  - `getStats({ start_month, end_month, year_month, owner })`: 기간 파라미터 전달 지원.
  - `getExpenses({ start_month, end_month, year_month, owner, category_id, institution, is_excluded, search, limit, offset })`: 페이징 및 기간 파라미터 연동.
- **공통 기간 선택기 모듈 (`ExpensePeriodSelector`)**:
  - 프리셋 버튼 그룹: `당월`, `3개월`, `6개월`, `1년`, `올해 누적(YTD)`.
  - 직접 선택 콤보박스: 시작월 및 종료월 셀렉트 드롭다운.
  - 반응형 디자인 지원: 데스크탑에서는 가로 한 줄 인라인 툴바, 모바일에서는 가로 스크롤 칩 + 접이식 직접 지정 패널.
- **데스크탑 화면 (`ExpensesPage.jsx`) 개선**:
  - 기존 단일월 셀렉트를 `ExpensePeriodSelector`로 교체.
  - KPI 카드 섹션에 `월평균 지출` 신규 카드 배치.
  - 월별 추이 바차트에 선택 기간 전체 월 렌더링 및 월평균 가이드 점선 표시.
  - 원장 테이블 하단에 100건 단위 '내역 더보기(Load More)' 버튼 배치.
- **모바일 화면 및 네비게이션 (`MobileExpensesPage.jsx`, `MobileTabBar.jsx`) 신설**:
  - 모바일 하단 탭 바를 6개 탭 구조로 최적화하여 3번째 위치에 '지출' 탭(`Receipt` 아이콘) 추가.
  - 모바일 라우트 가드 및 `App.jsx`에 `/m/expenses` 경로 등록.
  - 모바일 전용 컴포넌트 구성:
    - 모바일 최적화 기간 선택 칩 및 직접 선택 패널
    - 총 지출 및 월평균 지출이 강조된 모바일 요약 카드
    - 카테고리 비중 랭킹 바
    - 카드형 거래 목록 및 '더보기' 버튼 (터치 인라인 제외 토글 및 카테고리 확인)
  - 명세서 업로드 및 결제수단/카테고리 마스터 모달은 데스크탑 전용으로 유지하여 모바일 조작 안정성 확보.

## Testing Decisions

### What makes a good test
- 내부 구현 세부사항(내부 루프나 특정 변수명 등)이 아닌, 외부 인터페이스(REST API 응답 규격 및 사용자 컴포넌트 이벤트)의 동작을 정확하게 검증합니다.
- 복수 개월(3개월, 6개월, 12개월) 조회 시 총 지출 합계와 월평균 금액이 일치하는지 수학적 정합성을 검증합니다.
- 기간 외의 거래가 통계나 목록에 포함되지 않는 경계값(Boundary) 필터링을 검증합니다.
- 모바일 탭 바 및 라우트 가드가 신규 지출 경로(`/m/expenses`)를 정상 허용하고 렌더링하는지 검증합니다.

### Modules to be tested
1. **백엔드 API 테스트 (`pytest tests/test_expenses.py`)**:
   - `start_month` ~ `end_month` 기간 통계 집계 검증 (총액, 월평균, 전기간 대비 증감, 기간 내 월별 추이 리스트).
   - 기간별 거래 내역 조회 및 `limit`/`offset` 페이징 동작 검증.
   - 단일 `year_month` 파라미터 전달 시 기존 하위 호환성 유지 검증.
2. **프론트엔드 컴포넌트 테스트 (`Vitest`)**:
   - `ExpensePeriodSelector.test.jsx`: 프리셋 클릭 시 시작/종료월 상태 갱신 및 직접 지정 드롭다운 변경 이벤트 검증.
   - `MobileTabBar.test.jsx`: 6대 탭 바 렌더링, '지출' 탭 활성화 상태 및 라우트 이동 검증.
   - `MobileExpensesPage.test.jsx`: 모바일 요약 카드, 기간 칩 선택, 더보기 버튼 클릭 시 페이징 목록 누적 검증.
   - `ExpensesPage.test.jsx`: 데스크탑 화면에서 기간 변경에 따른 월평균 지출 카드 렌더링 및 테이블 페이징 검증.
3. **E2E 동작 검증**:
   - `scripts/dev.py` 구동 후 모바일 뷰포트(390×844) 및 데스크탑 화면에서 기간별 지출 조회 및 탭 전환 검증.

### Prior art
- `tests/test_expenses.py` (지출 API 테스트 세트)
- `src/frontend/src/pages/ExpensesPage.test.jsx` (기존 데스크탑 지출 페이지 테스트)
- `src/frontend/src/components/mobile/MobileTabBar.test.jsx` (모바일 탭 바 테스트)
- `src/frontend/src/pages/mobile/MobileDashboardPage.test.jsx` (모바일 페이지 테스트 패턴)

## Out of Scope

- 모바일 환경에서의 대용량 명세서 엑셀/PDF 업로드 및 파싱 모달 (데스크탑 전용 유지).
- 모바일 환경에서의 결제수단 및 카테고리 마스터 데이터 생성/수정/삭제 모달 (데스크탑 전용 유지).
- 일(Day) 단위 상세 날짜 범위 피커 (가계부 특성 및 기존 월 단위 명세서 체계에 맞춰 월 `YYYY-MM` 단위 분석에 집중).
- AI/머신러닝 기반 미래 소비 지출 예측 모델링.

## Further Notes

- 데이터베이스 스키마 자체의 파괴적인 변경(DDL 컬럼 추가/삭제)은 불필요하며, 기존 `expenses` 테이블의 인덱스(`ix_expenses_year_month`, `ix_expenses_transaction_date`)를 그대로 활용하여 고성능 쿼리를 수행합니다.
- 기존 단일월 API 클라이언트 호출부와의 완전한 하위 호환성을 유지하여 다른 모듈이나 보고서 배치 작업에 영향이 없습니다.
