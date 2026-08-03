Status: resolved
Type: task
Blocked by: 01

# Issue 02: AI Agent MCP Tools for Remote DB & Log Query

## Description

Create MCP tools in `src/mcp/tools/system.py` and register them in `src/mcp/main.py`:
- `get_db_tables`: Call backend API to list DB tables and row counts.
- `get_db_schema`: Call backend API to get schema of a specified table.
- `execute_db_query`: Call backend API to execute read-only SELECT SQL query with automatic row limit.
- `get_system_logs`: Call backend API to read recent backend logs with filtering.

Update `mcp_config_guide.md` with instructions for configuring `MCP_BACKEND_URL` on the developer's laptop to point to the server PC IP address.

## Acceptance Criteria

- MCP tools invoke `ApiClient` properly and return structured result schemas.
- Unit tests in `tests/test_mcp_system_tools.py` pass.
- `mcp_config_guide.md` updated with remote laptop environment variable setup.

## Resolution
Implemented MCP system tools in `src/mcp/tools/system.py`, registered them in `src/mcp/main.py`, updated `mcp_config_guide.md`, passed unit tests in `tests/test_mcp_system_tools.py` and passed Code Review with NO_ISSUES_FOUND.
