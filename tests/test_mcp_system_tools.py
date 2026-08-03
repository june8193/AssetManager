# -*- coding: utf-8 -*-
"""AI Agent MCP 시스템 도구 함수 단위 테스트 모듈입니다."""

import pytest
from unittest.mock import AsyncMock, patch
from src.mcp.tools.system import (
    get_db_tables,
    get_db_schema,
    execute_db_query,
    get_system_logs,
)


@pytest.mark.asyncio
async def test_get_db_tables_mcp():
    """get_db_tables MCP 도구가 백엔드 API를 올바르게 호출하는지 테스트합니다."""
    mock_data = [{"name": "accounts", "row_count": 5}]
    with patch("src.mcp.tools.system.api_client.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_data
        res = await get_db_tables()
        mock_get.assert_called_once_with("/api/v1/system/db/tables")
        assert res == mock_data


@pytest.mark.asyncio
async def test_get_db_schema_mcp():
    """get_db_schema MCP 도구가 테이블 스키마 API를 올바르게 호출하는지 테스트합니다."""
    mock_data = {
        "table_name": "accounts",
        "columns": [{"name": "id", "type": "INTEGER", "nullable": False, "primary_key": True, "default": None}],
        "foreign_keys": [],
    }
    with patch("src.mcp.tools.system.api_client.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_data
        res = await get_db_schema("accounts")
        mock_get.assert_called_once_with("/api/v1/system/db/schema/accounts")
        assert res == mock_data


@pytest.mark.asyncio
async def test_execute_db_query_mcp():
    """execute_db_query MCP 도구가 POST /api/v1/system/db/query를 올바르게 호출하는지 테스트합니다."""
    mock_data = {"columns": ["id", "name"], "rows": [[1, "Main"]], "row_count": 1, "truncated": False}
    with patch("src.mcp.tools.system.api_client.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_data
        query_str = "SELECT id, name FROM accounts"
        res = await execute_db_query(query_str, limit=100)
        mock_post.assert_called_once_with(
            "/api/v1/system/db/query",
            json_data={"query": query_str, "limit": 100},
        )
        assert res == mock_data


@pytest.mark.asyncio
async def test_get_system_logs_mcp():
    """get_system_logs MCP 도구가 백엔드 로그 API를 올바르게 호출하는지 테스트합니다."""
    mock_data = {"filename": "app.log", "total_lines": 1, "lines": ["2026-08-03 [ERROR] Failed"]}
    with patch("src.mcp.tools.system.api_client.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_data
        res = await get_system_logs(filename="app.log", lines=50, level="ERROR", keyword="Failed")
        mock_get.assert_called_once_with(
            "/api/v1/system/logs/content",
            params={"filename": "app.log", "lines": 50, "level": "ERROR", "keyword": "Failed"},
        )
        assert res == mock_data
