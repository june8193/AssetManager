# 03 — 방치된 34개 일회성 E2E 스크립트 삭제 및 러너 연결

**Spec:** [spec.md](../spec.md)

**What to build:** 레포지토리에 추적 중인 34개의 일회성·임시(`scratch*`) E2E 스크립트를 일괄 삭제하고, 프로젝트 통합 테스트 러너(`scripts/test.py` 및 프론트엔드 `package.json`)에서 공식 E2E 스위트를 실행할 수 있도록 연결한다.

**Blocked by:** 02-implement-core-user-journey-e2e-specs

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] 34개의 레거시·임시 E2E 스크립트가 레포지토리에서 모두 제거된다.
- [ ] 통합 테스트 러너 및 `package.json`에서 공식 E2E 스위트 실행 명령이 정상 동작한다.
- [ ] 공식 E2E 스위트가 격리 환경에서 모두 통과한다.
