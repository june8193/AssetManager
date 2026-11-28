# 02 — 백엔드 시세 내부 patch 및 MCP·텔레그램 수동 JSON 모킹 대체

**Spec:** [spec.md](../spec.md)

**What to build:** `yfinance`·SQLAlchemy 쿼리 체인·내부 메서드를 `patch`하던 시세·대시보드·벤치마크 테스트를 `FakeMarketAdapter` 주입 방식으로 전환하고, 수동 JSON `AsyncMock`에 의존하던 MCP·텔레그램 테스트를 `httpx.ASGITransport` 인메모리 어댑터(실제 FastAPI 앱 + 인메모리 SQLite) 관통 검증으로 대체한다.

**Blocked by:** 01-unify-backend-test-harness-and-scenario-builder

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] 시세·벤치마크·대시보드 가격 테스트에서 `yfinance` 내부 구조 및 `mock_db` 쿼리 체인 `patch`가 제거되고 `FakeMarketAdapter` 이음새를 사용한다.
- [ ] MCP 도구 및 텔레그램 클라이언트 테스트가 `ASGITransport` 기반 실제 백엔드 앱을 통과하며, 응답 스키마 불일치 시 즉시 실패한다.
- [ ] `uv run pytest` 전체 테스트가 통과한다.
