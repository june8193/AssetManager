Status: ready-for-agent

# Spec: Server PC DB & Log Inspection (Web UI & AI Agent MCP Tools)

## Problem Statement

When developing AssetManager on a personal laptop, the actual production SQLite database (`src/assets.db`) and backend application logs reside locally on the server PC. The developer cannot easily inspect real production data, troubleshoot issues, or query server logs during development. Furthermore, an AI coding agent (Antigravity) running on the laptop lacks tools to query the server's database tables or examine server logs over the network.

## Solution

Provide a unified "서버 점검" (Server Inspection) menu in the AssetManager Web UI with submenus for "DB 탐색기" (DB Explorer), "시스템 로그 보기" (System Log Viewer), and "API 연결 관리" (API Connection Management). In addition, create Read-Only MCP tools in `src/mcp/tools/system.py` allowing the AI agent on the laptop to inspect database tables/schemas, execute Read-Only `SELECT` SQL queries, and tail/filter server logs over HTTP via `MCP_BACKEND_URL`.

## User Stories

1. As a developer using a laptop, I want to open the '서버 점검' main menu in the AssetManager web app, so that I can access server diagnostic tools in one location.
2. As a developer, I want to access the 'DB 탐색기' page under '서버 점검', so that I can see all database tables and their row counts.
3. As a developer, I want to click on a table in the DB Explorer, so that I can view its column names, data types, primary keys, and foreign keys.
4. As a developer, I want to browse table records with pagination and sorting, so that I can inspect database contents without external DB management tools.
5. As a developer, I want to enter a custom Read-Only SQL query (`SELECT ...`) into the DB Explorer query editor and execute it, so that I can run complex ad-hoc analytical queries on the server database.
6. As a developer, I want non-SELECT statements (such as `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`) to be blocked with a clear error message, so that I cannot accidentally modify or corrupt the production database.
7. As a developer, I want to access the '시스템 로그 보기' page under '서버 점검', so that I can view the backend application and server logs.
8. As a developer, I want to select different log files (such as PM2 logs or backend system logs), so that I can focus on specific log sources.
9. As a developer, I want to filter log entries by log level (INFO, WARN, ERROR) and keyword search, so that I can quickly pinpoint errors and warnings.
10. As a developer, I want to toggle auto-refresh and select the number of log tail lines (50, 100, 500 lines), so that I can monitor real-time backend events.
11. As a developer, I want 'API 연결 관리' to be located under the '서버 점검' menu, so that all server monitoring and configuration options are logically grouped.
12. As an AI coding agent running on a developer's laptop, I want an MCP tool `get_db_tables` to retrieve a list of all tables and row counts from the server DB over HTTP, so that I can understand the DB structure during development.
13. As an AI coding agent, I want an MCP tool `get_db_schema` to inspect the columns, types, and constraints of any table in the server DB, so that I can write accurate queries and backend logic.
14. As an AI coding agent, I want an MCP tool `execute_db_query` to execute read-only `SELECT` SQL queries against the server DB with automatic row limiting (up to 500~1000 rows), so that I can debug data issues safely without memory overload.
15. As an AI coding agent, I want an MCP tool `get_system_logs` to fetch recent backend server logs with level filtering and keyword search, so that I can diagnose runtime issues on the server PC.

## Implementation Decisions

- Navigation & Sidebar: Add `서버 점검` parent menu in `Sidebar.jsx` with subItems for `/system/db-explorer`, `/system/logs`, and `/connection`. Move `/connection` inside `서버 점검`.
- Backend Routers: Expand `src/backend/routers/system.py` providing endpoints for table listing, schema inspection, read-only SQL execution, log file listing, and log content reading.
- SQL Safety: Enforce strict validation rejecting non-SELECT SQL statements before execution. Set query execution timeout and max row limits (default 500 rows).
- Log File Provider: Scan `backups/logs/` and standard log outputs safely preventing path traversal attacks by resolving target paths against allowed log directories.
- MCP Server Tools: Add `src/mcp/tools/system.py` exposing `get_db_tables`, `get_db_schema`, `execute_db_query`, and `get_system_logs`. Register them in `src/mcp/main.py`.
- Documentation: Update `mcp_config_guide.md` to document setting `MCP_BACKEND_URL` to point to the server PC's IP address.

## Testing Decisions

- Behavioral testing strategy focusing on public HTTP API contracts, MCP tool outputs, and frontend page rendering.
- Backend API Seam (`tests/test_system_api.py`): Test FastAPI system endpoints for DB tables, schema retrieval, SELECT query execution, SQL write blocking (`DELETE`, `DROP`), and log reading.
- MCP Tool Seam (`tests/test_mcp_system_tools.py`): Test MCP functions calling mocked `ApiClient` responses.
- Frontend Component Seam (`src/frontend/src/pages/DbExplorerPage.test.jsx`, `SystemLogPage.test.jsx`): Unit test pages using Vitest and React Testing Library.
- E2E Seam (`Playwright MCP`): Run E2E scenarios on `http://localhost:5173` powered by `uv run scripts/dev.py`.

## Out of Scope

- Writing or mutating data on the production server DB via DB Explorer or MCP tools.
- Remote terminal / SSH shell execution.
- Multi-user authentication/RBAC for DB explorer (local network private environment assumed).

## Further Notes

- `MCP_BACKEND_URL` defaults to `http://localhost:8000`. When developing on a laptop, developer sets `MCP_BACKEND_URL=http://<SERVER_IP>:8000` in `.agents/mcp_config.json`.
