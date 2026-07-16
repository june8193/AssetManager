# [TICKET-2] 자산 조회 MCP 도구(Tool) 구현

- **Type**: `task`
- **Status**: `blocked` (Waiting for [TICKET-1](file:///c:/localrepo/AssetManager/docs/wayfinder/tickets/ticket_1_dependency.md))
- **Assignee**: Antigravity
- **Blocked By**: [TICKET-1](file:///c:/localrepo/AssetManager/docs/wayfinder/tickets/ticket_1_dependency.md)
- **Blocks**: [TICKET-3](file:///c:/localrepo/AssetManager/docs/wayfinder/tickets/ticket_3_unit_tests.md)

## Question
기존 `query_asset.py`에서 수행하던 자산, 포트폴리오, 시세, 스냅샷, 거래 내역 등의 조회 기능을 어떻게 MCP 도구로 전환하고 DB 세션과 성공적으로 연동할 것인가?

## Context
`AssetManager` 백엔드 프로젝트 내에 `src/backend/mcp_server.py`를 새로 생성하여, `FastMCP("AssetManager")`를 통한 도구 세트를 작성합니다.
이 도구들은 FastAPI 웹 서버가 켜져 있지 않더라도 `SessionLocal`을 직접 열고 닫으면서 `DashboardService`, `PortfolioService` 등 내부 데이터 서비스를 안전하게 불러와야 합니다.

## Required Tasks
1. `src/backend/mcp_server.py` 신규 파일 생성.
2. 아래의 MCP 도구(Tool)들을 데코레이터(`@mcp.tool()`)로 구현 및 반환 타입 정의:
   - `get_asset_summary`
   - `get_asset_ratios`
   - `get_watchlist_prices`
   - `get_portfolio_status`
   - `get_yearly_stats`
   - `get_daily_stats`
   - `get_snapshots`
   - `get_transactions`
   - `get_market_history`
   - `get_stock_history`
3. DB 연결 시 check_same_thread 옵션을 다루는 `src.backend.database` 내 설정 점검 및 연동.
