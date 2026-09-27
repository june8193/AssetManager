# 02 — 지출 거래 내역 목록 및 검색 MCP 도구

**What to build:**
AI 에이전트가 기간(월/범위), 소유주, 카테고리명(예: '식비'), 카테고리 ID, 가맹점/메모 검색어, 페이징 옵션을 전달하여 세부 지출 거래 내역을 조회(`get_expenses`)할 수 있는 기능을 구현합니다. 특히 에이전트가 정수 카테고리 ID를 몰라도 한글 카테고리명을 지정하면 내부에서 자동으로 ID로 매핑하여 조회하는 편의 기능을 제공합니다.

**Blocked by:** 01 — 지출 카테고리 및 종합 통계 조회 MCP 도구

**Status:** ready-for-agent

- [ ] 기간, 소유주, 검색어, 페이징 조건을 지원하는 `get_expenses` MCP 도구가 구현됨
- [ ] `category_name` 전달 시 카테고리 목록을 조회하여 적절한 `category_id`로 자동 변환 매핑하는 로직이 구현됨
- [ ] 카테고리명 자동 매핑 및 필터링 동작에 대한 단위 테스트가 `tests/test_mcp_expenses.py`에 추가되어 통과함 (TDD)
- [ ] MCP 서버 진입점(`src/mcp/main.py`)에 `get_expenses` 도구가 등록됨
