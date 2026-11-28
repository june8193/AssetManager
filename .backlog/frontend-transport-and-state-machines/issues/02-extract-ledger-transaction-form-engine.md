# 02 — 원장 거래 행 전이·검증 순수 도메인 모듈 추출

**Spec:** [spec.md](../spec.md)

**What to build:** `TransactionsTab` 내부에 이중 구현되어 드리프트가 발생한 다중 입력 시트와 인라인 행 편집의 필드 연쇄 규칙(비현금 전환 시 `BUY` 복원, `EXCHANGE` 출발·도착 통화 비중복, `TRANSFER` 대체 계좌 배정, `parseFormattedNumber` 직렬화)을 단일 순수 도메인 모듈로 추출하고 거래 배지/표시 규칙을 모바일 목록과 공유한다.

**Blocked by:** 01-consolidate-frontend-http-seam-and-fix-snapshot-guard

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] 다중 입력 시트와 인라인 편집이 동일한 순수 거래 행 전이·검증·직렬화 함수를 호출한다.
- [ ] 기존 유틸(`formatWithCommas`, `parseCommas`)을 재사용하고 중복 포맷터와 모바일과의 거래 표시 중복을 제거한다.
- [ ] 순수 거래 행 엔진 단위 테스트가 모든 거래 유형 전이 및 직렬화 불변식을 검증하며 Vitest가 통과한다.
