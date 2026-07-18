# [TICKET-4] Asset-jun-bot 에이전트 내 MCP 서버 바인딩

- **Type**: `task`
- **Status**: `completed`
- **Assignee**: Antigravity
- **Blocked By**: [TICKET-3](file:///c:/localrepo/AssetManager/docs/wayfinder/tickets/ticket_3_unit_tests.md) (Completed)
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

## Answer
- `agent_runner.py`에 `from google.antigravity.types import McpStdioServer`를 적용하고 `LocalAgentConfig` 생성 시 `mcp_servers` 매개변수로 `AssetManager` MCP 서버 기동 정보를 등록했습니다.
- `AssetManager`는 별개의 프로젝트 경로에 존재하므로, `uv` command를 실행할 때 `--directory C:\localrepo\AssetManager` 옵션을 포함하여 실행 경로를 고정하고 파이썬 모듈 실행 지시(`python -m src.backend.mcp_server`)를 수행하도록 온전한 실행 명세(Arguments)를 구성했습니다.
- `asset-advisor` 스킬 정의 파일(`SKILL.md`)을 완전히 개편하여, 에이전트가 기존의 쉘 명령어 기반 `run_command` 호출에서 벗어나 `mcp_AssetManager_` 프리픽스를 가진 MCP 표준화된 도구 함수들(총 12가지)을 다이렉트로 인식 및 호출하도록 가이드를 수정하였습니다.
- 수정 사항을 반영한 후 `Asset-jun-bot` 프로젝트 내에서 전체 테스트를 구동한 결과, 88개 전체 테스트 케이스가 성공적으로 통과(Passed)함을 확인하였습니다.
