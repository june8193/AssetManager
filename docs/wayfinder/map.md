# AssetManager MCP Integration Wayfinder Map

## Destination
`AssetManager` 백엔드 정보를 가져오는 방식을 쉘 명령어 기반의 `run_command` 실행에서 **Model Context Protocol (MCP)** 서버 연동 방식으로 전환하여, `Asset-jun-bot` 에이전트가 안전하고 표준화된 방식으로 자산 데이터를 조회할 수 있도록 마이그레이션합니다.

## Notes
- 모든 파이썬 스크립트 실행 및 라이브러리 관리는 `uv` 가상환경 내에서 이루어져야 합니다. (규칙 6 준수)
- 백엔드 코드 및 테스트 코드 작성 시 `__init__.py` 파일을 신규 생성하지 않습니다. (규칙 2 준수)
- TDD 원칙에 따라 테스트를 작성한 후 비즈니스 로직을 구현합니다. (규칙 3 준수)
- 독립 실행형 Stdio MCP 서버 구조로 구축하여, 백엔드 웹 서버의 구동 유무와 상관없이 작동할 수 있게 설계합니다.

## Decisions so far
*(결정된 티켓이 여기에 기록됩니다. 현재는 공란입니다.)*

## Open Tickets
- [TICKET-1: fastmcp 라이브러리 검증 및 의존성 추가](file:///c:/localrepo/AssetManager/docs/wayfinder/tickets/ticket_1_dependency.md) (Frontier)
- [TICKET-2: 자산 조회 MCP 도구(Tool) 구현](file:///c:/localrepo/AssetManager/docs/wayfinder/tickets/ticket_2_mcp_server.md) (Blocked by TICKET-1)
- [TICKET-3: MCP 서버 작동 단위 테스트 작성 및 검증](file:///c:/localrepo/AssetManager/docs/wayfinder/tickets/ticket_3_unit_tests.md) (Blocked by TICKET-2)
- [TICKET-4: Asset-jun-bot 에이전트 내 MCP 서버 바인딩](file:///c:/localrepo/AssetManager/docs/wayfinder/tickets/ticket_4_bot_integration.md) (Blocked by TICKET-3)
- [TICKET-5: 최종 통합 및 E2E 시나리오 검증](file:///c:/localrepo/AssetManager/docs/wayfinder/tickets/ticket_5_e2e_verification.md) (Blocked by TICKET-4)

## Not yet specified
- **시세 동기화 및 갱신(Refresh) 로직 처리**:
  MCP 도구 내부에서 즉시 시세 갱신을 수행할지, 아니면 단순 캐시 데이터만 조회할지에 대한 정책 결정 필요.

## Out of scope
- **자산 데이터 쓰기(Write) 작업**:
  자산 추가, 삭제 등 DB를 수정하는 도구는 이번 MCP 연동 범위에서 제외하며, 추후 필요 시 추가 티켓을 발급합니다.
