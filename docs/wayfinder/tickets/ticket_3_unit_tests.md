# [TICKET-3] MCP 서버 작동 단위 테스트 작성 및 검증

- **Type**: `task`
- **Status**: `blocked` (Waiting for [TICKET-2](file:///c:/localrepo/AssetManager/docs/wayfinder/tickets/ticket_2_mcp_server.md))
- **Assignee**: Antigravity
- **Blocked By**: [TICKET-2](file:///c:/localrepo/AssetManager/docs/wayfinder/tickets/ticket_2_mcp_server.md)
- **Blocks**: [TICKET-4](file:///c:/localrepo/AssetManager/docs/wayfinder/tickets/ticket_4_bot_integration.md)

## Question
MCP 서버의 각 도구들이 모의(Mock) 혹은 격리된 테스트용 DB(`test_pytest.db`)를 기반으로 정형화된 JSON 또는 올바른 구조의 데이터를 안정적으로 반환하는가?

## Context
TDD 개발 규칙에 따라 비즈니스 로직(도구 바인딩)을 검증하는 독립적인 테스트 코드가 필요합니다. `pytest` 환경에서 MCP 서버의 도구들을 직접 실행하고 응답을 받아와 그 필드 구성을 테스트합니다.

## Required Tasks
1. `tests/test_mcp_server.py` 신규 파일 작성.
2. `pytest` 실행 시 `pytest.mark.asyncio`를 활용하여 각 도구 함수를 가상 호출해보고 반환값을 분석하는 단위 테스트 작성.
3. `uv run pytest tests/test_mcp_server.py`를 통해 모든 단위 테스트가 통과하는지 검증.
