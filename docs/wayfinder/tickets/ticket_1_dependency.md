# [TICKET-1] fastmcp 라이브러리 검증 및 의존성 추가

- **Type**: `task`
- **Status**: `closed` (Completed)
- **Assignee**: Antigravity
- **Blocks**: [TICKET-2](file:///c:/localrepo/AssetManager/docs/wayfinder/tickets/ticket_2_mcp_server.md)

## Resolution
`fastmcp` 패키지를 `pyproject.toml`에 성공적으로 추가하고, `src/backend/mcp_hello.py`를 통해 stdio 통신을 백그라운드로 성공적으로 실행하여 연동성 검증을 마쳤습니다.
- 추가 패키지: `fastmcp==3.4.4` (및 관련 의존성 패키지들)
- 검증 완료 날짜: 2026-07-17 (KST)

## Question
`fastmcp` 패키지를 `AssetManager` 프로젝트에 어떻게 도입하고 연동할 것인가?

## Context
파이썬에서 MCP 서버를 구축하기 위해 Anthropic에서 제공하는 고수준 라이브러리인 `fastmcp`를 사용할 계획입니다.
이 패키지가 의존성에 정상적으로 추가되고, 로컬 헬로월드 수준의 stdio MCP 통신이 문제없이 열리는지 검증해야 합니다.

## Required Tasks
1. `AssetManager`의 `pyproject.toml`에 `fastmcp`를 추가합니다. (`uv add fastmcp`)
2. `fastmcp`를 이용한 헬로월드 스크립트 작성 및 stdio 기동 테스트.
3. 기동 여부를 확인한 후 개발 의존성에 정상 등록 완료 처리합니다.
