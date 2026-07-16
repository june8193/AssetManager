# [TICKET-4] Asset-jun-bot 에이전트 내 MCP 서버 바인딩

- **Type**: `task`
- **Status**: `blocked` (Waiting for [TICKET-3](file:///c:/localrepo/AssetManager/docs/wayfinder/tickets/ticket_3_unit_tests.md))
- **Assignee**: Antigravity
- **Blocked By**: [TICKET-3](file:///c:/localrepo/AssetManager/docs/wayfinder/tickets/ticket_3_unit_tests.md)
- **Blocks**: [TICKET-5](file:///c:/localrepo/AssetManager/docs/wayfinder/tickets/ticket_5_e2e_verification.md)

## Question
`Asset-jun-bot` 에이전트 환경(Antigravity SDK)에 어떻게 로컬 `AssetManager` MCP 서버를 바인딩하고 스킬 설정을 개편할 것인가?

## Context
`Asset-jun-bot` 프로젝트의 에이전트 기동 설정인 `agent_runner.py`에서 `McpStdioServer` 설정을 활용하여 `AssetManager` MCP 서버를 실행합니다.
또한, 봇 에이전트가 더 이상 구형 파이썬 CLI 스크립트 실행(예: `scripts/query_asset.py`)을 요구하지 않고, MCP가 제공하는 정밀 도구들을 올바르게 인식하도록 스킬 정의서(`SKILL.md`)를 개편해야 합니다.

## Required Tasks
1. `C:\localrepo\Asset-jun-bot\src\asset_jun_bot\agent_runner.py`를 수정하여 `McpStdioServer` 등록.
2. `C:\localrepo\Asset-jun-bot\.agents\skills\asset-advisor\SKILL.md`를 수정하여 도구 사용 지침(CLI 명령어 기반 -> MCP 도구 함수명 기반) 업데이트.
3. 봇 구동 시 백그라운드로 MCP 서버 프로세스가 정상 구동되는지 로그 확인.
