# 01 — 격리 DB 기반 공식 @playwright/test E2E 하네스 구축

**Spec:** [spec.md](../spec.md)

**What to build:** 공유 개발 DB(`src/dev_assets.db`)를 전혀 건드리지 않고 전용 격리 SQLite DB와 `FakeMarketAdapter`를 주입한 백엔드·프론트엔드 서버를 자동 기동·시드·종료하는 `@playwright/test` 공식 E2E 하네스를 구축한다.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] `@playwright/test` 설정 및 격리 DB(`e2e_assets.db`) 기반 서버 자동 기동/종료 하네스가 동작한다.
- [ ] 테스트 실행 전후 `src/dev_assets.db`가 생성·변조·삭제되지 않음이 보장된다.
- [ ] 샘플 스모크 E2E 테스트가 단일 명령으로 결정론적으로 통과한다.
