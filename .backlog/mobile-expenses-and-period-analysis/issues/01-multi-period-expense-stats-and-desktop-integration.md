# 01 — 다기간 지출 통계 API 확장 및 데스크탑 기간 분석 연동

**What to build:** 
사용자가 데스크탑 지출 관리 화면에서 단일 월뿐만 아니라 2~3개월, 6개월, 1년, YTD 등 정해진 기간을 선택하여 총 지출액, 월평균 지출액, 카테고리별 비중 및 월별 추이를 확인하고, 대용량 거래 원장을 100건 단위로 쾌적하게 페이징 조회할 수 있도록 백엔드 통계/목록 API 확장과 데스크탑 프론트엔드를 통합 구현합니다.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] 백엔드 `GET /api/expenses/stats` 엔드포인트에 `start_month`, `end_month` 쿼리 파라미터 지원 및 기존 `year_month` 하위 호환 유지
- [ ] 통계 응답 스키마에 `monthly_average`, `period_months`, `period_total`, `prev_period_total`, `prev_period_change_amount`, `prev_period_change_rate` 추가 및 기간 내 모든 월을 포함하는 `monthly_trends`와 누적 `category_breakdown` 산출
- [ ] 백엔드 `GET /api/expenses` 엔드포인트에 `start_month`, `end_month` 기간 필터링 및 `limit`, `offset` 페이징 파라미터 구현
- [ ] 프론트엔드 `expenseService.js`에 기간 파라미터 및 페이징 파라미터 연동
- [ ] 공통 기간 선택기 컴포넌트(`ExpensePeriodSelector.jsx`) 구현 (프리셋 5종: 당월, 3개월, 6개월, 1년, YTD + 시작월~종료월 직접 선택)
- [ ] 데스크탑 `ExpensesPage.jsx`에 기간 선택기 툴바, 신규 `월평균 지출` KPI 카드, 동적 월별 바차트 및 100건 단위 '내역 더보기(Load More)' 연동
- [ ] 백엔드 `pytest tests/test_expenses.py` 단위/통합 테스트 작성 및 통과
- [ ] 프론트엔드 `ExpensesPage.test.jsx` 및 `ExpensePeriodSelector.test.jsx` 테스트 작성 및 통과
