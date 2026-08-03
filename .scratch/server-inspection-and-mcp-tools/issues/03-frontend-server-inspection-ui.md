Status: resolved
Type: task
Blocked by: 01

# Issue 03: Web UI '서버 점검' Menu, DB Explorer & Log Viewer Pages

## Description

Implement frontend pages and menu hierarchy:
- Update `Sidebar.jsx` to add '서버 점검' parent menu and submenus:
  - 'DB 탐색기' (`/system/db-explorer`)
  - '시스템 로그 보기' (`/system/logs`)
  - 'API 연결 관리' (`/connection`)
- Create `src/frontend/src/pages/DbExplorerPage.jsx`:
  - Table selection, schema view, paginated table data grid, read-only SQL query editor & result view.
- Create `src/frontend/src/pages/SystemLogPage.jsx`:
  - Log file selection, log level filter, search keyword filter, line limit, auto-refresh polling toggle.
- Update routes in `src/frontend/src/App.jsx`.

## Acceptance Criteria

- '서버 점검' menu correctly renders submenus and retains active state.
- DB Explorer page displays tables, schemas, paginated data, and query results.
- System Log Viewer page loads logs and supports filtering.
- Vitest frontend tests pass.

## Resolution
Implemented '서버 점검' menu in `Sidebar.jsx`, `DbExplorerPage.jsx`, `SystemLogPage.jsx`, `QueryResultTable.jsx`, registered routes in `App.jsx`, and passed all Vitest component tests (`QueryResultTable.test.jsx`, `DbExplorerPage.test.jsx`, `SystemLogPage.test.jsx`) and Code Review with NO_ISSUES_FOUND.
