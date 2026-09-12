# 01 — MCP 도구 계층에서 get_market_indices 퇴역 및 get_market_history 다중 티커 검증

**What to build:** 
FastMCP 프로토콜 상의 직렬화 오류를 유발하고 시계열 조회가 불가능한 `get_market_indices` 도구를 MCP 서버에서 안전하게 퇴역(제거)시키고, 복수 지수와 VIX(`^VIX`)를 동시에 조회할 수 있는 `get_market_history` MCP 도구가 안정적으로 데이터를 반환하도록 검증합니다. 기존 웹 및 모바일 대시보드에서 사용 중인 백엔드 REST 엔드포인트는 변경 없이 온전히 보존합니다.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `src/mcp/tools/market.py`에서 `get_market_indices` 함수가 제거되었는가?
- [ ] `src/mcp/main.py`에서 `get_market_indices` 임포트 및 도구 등록 코드가 제거되었는가?
- [ ] `tests/test_mcp_server.py`에서 `get_market_indices` 관련 테스트가 정리되고, `get_market_history`가 다중 티커 및 VIX(`^VIX`) 조회를 정상 처리하는 테스트가 통과하는가?
- [ ] 백엔드 엔드포인트 `/api/market/indices`와 `/api/market/history`에 대한 기존 테스트(`tests/test_market.py`)가 100% 정상 통과하는가?
