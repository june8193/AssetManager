# 01 — 백엔드 스냅샷 TWR 수익 지수(1,000pt) 산출 및 실시간(Live) 차트 끝점 데이터 연동

**Spec:** [spec.md](../spec.md)

**What to build:** 백엔드 `DashboardService.get_snapshots()`에서 일자별 스냅샷의 입출금(`period_deposit`)을 제외한 시간가중수익률(TWR) 연쇄 지수(`index`, `index_change_pct`, `index_cum_return_pct`)를 `1,000.00 pt` 시작 기준으로 산출하고, `get_dashboard_summary()`에 `pending_deposits_krw`를 노출한 뒤, 프론트엔드(`useDashboard.js` 및 순수 빌더 유틸리티)에서 스냅샷 시계열 맨 끝점에 오늘의 실시간 총자산·계좌별 자산·실시간 수익 지수(Live Index)를 자동으로 병합하여 제공합니다.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `DashboardService.get_snapshots()`의 `history` 각 항목에 `period_deposit`, `index`(최초 스냅샷일 `1000.0`, 소수점 2자리), `index_change_pct`(직전 스냅샷 대비 등락률 %, 소수점 2자리), `index_cum_return_pct`(1,000pt 대비 누적 등락률 %, 소수점 2자리) 필드가 포함되어 반환된다.
- [ ] 구간 수익률 $r_t$ 산출 시 `get_daily_stats()`와 동일하게 분모를 `prev_total + curr_deposit`으로 계산($r_t = \frac{(V_t - V_{t-1}) - D_t}{V_{t-1} + D_t}$)하여, `index_change_pct`가 대시보드 하단 '일자별 현황' 테이블의 일별 `roi`와 소수점까지 정확히 일치한다.
- [ ] `DashboardService.get_dashboard_summary()` 반환 딕셔너리에 마지막 스냅샷 이후 발생한 미반영 순입출금액인 `pending_deposits_krw` 필드가 포함된다.
- [ ] 프론트엔드에서 스냅샷 시계열(`snapshots.history`)과 실시간 요약(`summary`)을 결합할 때, 마지막 스냅샷 일자 이후 오늘의 실시간 평가액(`total_valuation_krw` 및 계좌별 `acc_{id}`)과 `pending_deposits_krw`를 반영한 실시간 수익 지수(`index`, `index_change_pct`, `index_cum_return_pct`, `is_live: true`)가 차트 맨 끝점에 자동으로 추가(또는 당일 스냅샷 존재 시 최신 실시간 값으로 갱신)된다.
- [ ] `tests/test_dashboard_snapshots.py` 및 프론트엔드 단위 테스트에서 입출금이 포함된 다중 스냅샷 시나리오의 지수 연쇄 계산과 실시간 끝점 병합 로직이 검증된다.
