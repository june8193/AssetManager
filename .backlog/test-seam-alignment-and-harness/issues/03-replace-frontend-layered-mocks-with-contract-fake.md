# 03 — 프론트엔드 3중 모킹 적층 정리 및 계약 검증 Fake HTTP 전환

**Spec:** [spec.md](../spec.md)

**What to build:** 얕은 패스스루 서비스 단위 테스트와 중간 훅/서비스 적층 모킹, 6개 파일에 중복된 `recharts` 스텁을 정리하고, 공통 렌더 헬퍼(`renderWithProviders`) 및 백엔드 실제 계약과 일치하는 단일 Fake HTTP 어댑터 이음새에서 화면·도메인 모듈을 검증하도록 전환한다.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] `total_assets`·`latest_snapshot_date` 같은 가짜 스키마 모킹이 제거되고 백엔드 실제 응답 계약 기반 픽스처 팩토리를 사용한다.
- [ ] 중복된 `recharts` 스텁과 Provider 래퍼가 공통 테스트 헬퍼 한 곳으로 통합된다.
- [ ] 얕은 패스스루 테스트가 정리되고 페이지/도메인 인터페이스 단위 테스트(Vitest)가 모두 통과한다.
