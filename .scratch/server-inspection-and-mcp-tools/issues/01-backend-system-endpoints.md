Status: resolved
Type: task

# Issue 01: Backend DB & Log System REST API Endpoints

## Description

Implement FastAPI REST API endpoints in `src/backend/routers/system.py` for DB inspection and log reading:
- `GET /api/v1/system/db/tables`: List all database tables and row counts.
- `GET /api/v1/system/db/schema/{table_name}`: Detailed column types, nullability, primary key and foreign key details.
- `POST /api/v1/system/db/query`: Execute read-only SQL queries (`SELECT` statement validation only, enforce maximum row limit up to 500 rows, block `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, etc.).
- `GET /api/v1/system/logs/files`: List log files from `backups/logs/`.
- `GET /api/v1/system/logs/content`: Read log file contents with tail line count, level filtering, and keyword search.

## Acceptance Criteria

- All `SELECT` SQL queries return column metadata and row lists.
- Any non-SELECT statement is rejected with HTTP 400 bad request.
- Log reading resolves file paths securely against allowed directory.
- Test suite `tests/test_system_api.py` passes completely.

## Resolution
Implemented system router endpoints in `src/backend/routers/system.py` and passed all 8 unit tests in `tests/test_system_api.py`.
