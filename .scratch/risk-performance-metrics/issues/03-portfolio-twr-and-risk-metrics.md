# 03 — 불규칙 스냅샷 보간 기반 총 자산 TWR & 샤프/소티노 계산 엔진 및 API

**What to build:**
`account_snapshots`의 평가액($V_t$)과 외부 추가 입금액($CF_t$)을 사용하여 입출금 현금 흐름이 배제된 시간가중수익률(TWR) 시계열을 구축하고, 2주~1달 간격의 불규칙한 스냅샷을 일별로 보간($r_{daily, k} = (1 + r_k)^{1/\Delta t_k} - 1$)하여 포트폴리오 샤프/소티노 지수 및 MDD 연산 API (`GET /api/v1/performance/portfolio`)를 제공합니다.

**Blocked by:** 01 — 무위험 수익률 DB 저장 및 API/UI 설정 기능

**Status:** ready-for-agent

- [ ] `account_snapshots` 및 `transactions` 기반 외부 입출금 배제 TWR 시계열 연산 엔진 구축
- [ ] 스냅샷의 불규칙한 실제 경과 일수 $\Delta t_k$ 기반 일별 시계열 보간(Daily Interpolation) 적용
- [ ] 총 자산 포트폴리오 연율화 Sharpe, Sortino 및 MDD 연산 로직 완성
- [ ] `GET /api/v1/performance/portfolio?period=1Y` REST API 구현
- [ ] 외부 입출금이 포함된 시나리오에 대한 pytest 단위 테스트 작성 및 통과
