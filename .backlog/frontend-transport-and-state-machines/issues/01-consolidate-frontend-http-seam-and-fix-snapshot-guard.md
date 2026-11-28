# 01 — 프론트엔드 원격 통신 이음새 단일화 및 과거 거래 경고 가드 복구

**Spec:** [spec.md](../spec.md)

**What to build:** 18개 프론트엔드 모듈에 흩어진 59곳의 생 `fetch()` 호출을 `apiClient` 단일 이음새로 일원화하고, 호출처 0건인 죽은 서비스 메서드를 정리하며, `TransactionsTab`이 `latest_snapshot_date` 오타 대신 실제 백엔드 계약(`latest_date`)을 읽어 과거 스냅샷 거래 경고 모달이 정상 작동하도록 복구한다.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] 프로덕션 UI 모듈에서 `apiClient` 외부의 직접 `fetch()` 호출이 제거된다.
- [ ] 호출처 0건인 죽은 서비스 메서드들이 정리된다.
- [ ] `TransactionsTab`이 `{ latest_date }` 계약을 정상 수신해 과거 스냅샷 이전 거래 등록·수정·삭제 시 경고 모달을 표시한다.
- [ ] 프론트엔드 테스트(Vitest)가 모두 통과한다.
