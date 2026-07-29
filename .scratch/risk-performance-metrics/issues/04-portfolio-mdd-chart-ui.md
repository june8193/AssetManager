# 04 — 총 자산 MDD 추이 차트 및 성과 대시보드 UI 구현

**What to build:**
입출금이 배제된 총 자산 누적 TWR 지수 시계열로부터 **최근 MDD**, **기간 내 최고 MDD (Max MDD)** KPI 카드를 표출하고, 기존 지수 분석 메뉴와 동일한 디자인의 일별 Drawdown(%) 시간 경과 시계열 영역 차트(`PerformanceAnalysis.jsx`)를 성과 분석 화면에 구현합니다.

**Blocked by:** 03 — 불규칙 스냅샷 보간 기반 총 자산 TWR & 샤프/소티노 계산 엔진 및 API

**Status:** ready-for-agent

- [ ] 최근 MDD 및 기간 내 최고 MDD 수치 KPI 카드 UI 컴포넌트 개발
- [ ] 일별 Drawdown 백분율($DD_t$) 시계열 영역 차트(Chart.js 등) 구현
- [ ] 기간 선택 (1M, 3M, 6M, 1Y, YTD, Max) 변경 시 차트 및 KPI 수치 동적 업데이트 연동
- [ ] E2E 검증 및 차트 렌더링 스크린샷 캡처
