# 01 — 지출 카테고리 및 종합 통계 조회 MCP 도구

**What to build:**
AI 에이전트가 지출 분류 체계(`get_expense_categories`)와 특정 월 또는 기간의 지출 총액, 월별 추이, 카테고리별/결제수단별 비중 통계(`get_expense_summary`)를 MCP 프로토콜을 통해 즉시 조회할 수 있는 종단 간 동작을 구현합니다.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] 백엔드 API 클라이언트를 통해 지출 카테고리 목록을 조회하는 `get_expense_categories` MCP 도구가 구현됨
- [ ] 백엔드 통계 API를 통해 기준월/기간별 지출 통계 및 비중을 조회하는 `get_expense_summary` MCP 도구가 구현됨
- [ ] `api_client` 모킹을 통한 단위 테스트가 `tests/test_mcp_expenses.py`에 작성되어 성공적으로 통과함 (TDD)
- [ ] MCP 서버 진입점(`src/mcp/main.py`)에 도구들이 정상 등록되고 에러 없이 기동됨
