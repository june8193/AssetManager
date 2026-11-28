# 01 — 유령 SnapshotService 삭제 및 순입출금·이체 쌍 규칙 단일화

**Spec:** [spec.md](../spec.md)

**What to build:** 프로덕션에서 전혀 호출되지 않는 `SnapshotService`와 그 구형 단위 테스트를 삭제하고, 스냅샷 미리보기·계산·중간 스냅샷 생성·과거 재계산(`recalculate`)·대시보드가 모두 동일한 외화 환산(`tx.exchange_rate` 우선) 및 `TRANSFER` 순입출금 공식과 이체 쌍 생성 규칙을 공유하도록 통합한다.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] `SnapshotService` 모듈 및 해당 구형 테스트 파일이 제거되고 프로덕션·테스트 임포트 오류가 없다.
- [ ] USD 입출금이 포함된 계좌의 과거 스냅샷 재계산(`recalculate`) 시 원화 환산이 정확히 적용된다.
- [ ] 스냅샷 계산과 미리보기 간 `TRANSFER` 순입출금 결과가 일치하고 이체 쌍 생성이 단일 팩토리로 통일된다.
- [ ] `uv run pytest`로 스냅샷·원장·거래 테스트가 모두 통과한다.
