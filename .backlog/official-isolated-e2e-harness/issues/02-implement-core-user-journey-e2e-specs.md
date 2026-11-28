# 02 — 핵심 사용자 여정 5~7개 E2E 스펙 작성

**Spec:** [spec.md](../spec.md)

**What to build:** 대시보드, 원장 거래 관리, 스냅샷 5단계 위저드, 지출 모니터링, 자산 비중·리스크 진단, 모바일 주요 화면을 아우르는 핵심 사용자 여정 5~7개 E2E 스펙을 고정 대기(`waitForTimeout`)나 Tailwind 클래스 셀렉터 없이 접근성 역할 기반 단언으로 구현한다.

**Blocked by:** 01-bootstrap-isolated-playwright-e2e-harness

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] 5~7개 핵심 사용자 여정(데스크톱 및 모바일 포함) E2E 스펙이 작성된다.
- [ ] 모든 스펙이 고정 `sleep`과 스타일 클래스 셀렉터 대신 웹 접근성 역할(`getByRole` 등)과 `expect` 단언을 사용한다.
- [ ] 공식 Playwright E2E 스위트 전체가 결정론적으로 통과한다.
