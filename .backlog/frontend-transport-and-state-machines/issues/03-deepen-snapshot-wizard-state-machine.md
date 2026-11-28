# 03 — 스냅샷 5단계 위저드 상태 머신 심화 및 정합성 판정 통합

**Spec:** [spec.md](../spec.md)

**What to build:** 스냅샷 위저드의 거래/잔액 변경 시 영향받는 도착 계좌(`target_account_id`)의 확정·계산 상태를 원자적으로 무효화하고, 4곳에 복제된 정합성 경고 판정과 경고 확인 가드를 엔진 내부로 흡수하며, `alert/confirm` 직접 호출 분리, 예상 예수금 `EXCHANGE` 규칙 정렬, 미사용 유틸·별칭 7종 제거를 수행한다.

**Blocked by:** 01-consolidate-frontend-http-seam-and-fix-snapshot-guard

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] 계좌 B에서 확정된 계좌 A로 이체(`TRANSFER`)를 추가·수정·삭제하거나 잔액을 변경하면 관련 계좌의 확정 상태가 즉시 무효화된다.
- [ ] 정합성 경고 판정 및 5단계 저장 가드가 단일 엔진 상태로 통합되고, 예상 예수금 `EXCHANGE` 계산이 백엔드와 일치한다.
- [ ] 엔진 내부 `window.alert/confirm` 직접 호출과 미사용 유틸/서비스/별칭 7종이 제거된다.
- [ ] 주입된 Fake 어댑터 기반 위저드 상태 머신 테스트를 포함해 Vitest가 통과한다.
