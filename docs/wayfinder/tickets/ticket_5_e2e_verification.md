# [TICKET-5] 최종 통합 및 E2E 시나리오 검증

- **Type**: `task`
- **Status**: `blocked` (Waiting for [TICKET-4](file:///c:/localrepo/AssetManager/docs/wayfinder/tickets/ticket_4_bot_integration.md))
- **Assignee**: Antigravity
- **Blocked By**: [TICKET-4](file:///c:/localrepo/AssetManager/docs/wayfinder/tickets/ticket_4_bot_integration.md)

## Question
에이전트가 텔레그램이나 시뮬레이션 환경에서 자산 요약이나 포트폴리오를 조회해 달라는 사용자 질문에 대해, 실제로 MCP 도구를 무사히 호출하여 완결성 높고 정확한 대답을 구성하는가?

## Context
실제로 서버와 봇을 종합 실행하여 에이전트의 대화 품질과 MCP 도구 호출 흐름의 무결성을 최종 E2E 단계에서 검증합니다.

## Required Tasks
1. `Asset-jun-bot`과 `AssetManager` 백엔드 서버를 연동하여 기동합니다.
2. 봇을 실행하고 텔레그램 또는 에이전트 대화 창구로 테스트 프롬프트를 입력합니다. (예: "성은이네 부부 총자산 요약해줘", "미국 주식 관심종목 주가 어때?")
3. 에이전트가 `run_command` 실행 없이, 백그라운드 MCP 프로세스 통신만으로 즉각 알맞은 도구를 호출하는지 로그 및 최종 답변 결과를 캡처하여 검증합니다.
4. 검증 결과 캡처(로그 또는 UI 스크린샷)를 `c:\localrepo\AssetManager\screenshots\` 폴더에 보관합니다. (규칙 4 준수)
