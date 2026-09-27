# -*- coding: utf-8 -*-
"""지출(Expense) 관련 MCP 도구 함수 단위 테스트 모듈입니다."""

import pytest
from unittest.mock import AsyncMock, patch

from src.mcp.tools.expenses import (
    get_expense_categories,
    get_expense_summary,
)


@pytest.fixture
def mock_api_client():
    """src.mcp.client.api_client의 get 및 post 메서드를 모킹하는 fixture입니다."""
    with patch("src.mcp.client.api_client.get", new_callable=AsyncMock) as mock_get, \
         patch("src.mcp.client.api_client.post", new_callable=AsyncMock) as mock_post:
        yield mock_get, mock_post


# ==========================================
# get_expense_categories 테스트
# ==========================================

@pytest.mark.asyncio
async def test_get_expense_categories_success(mock_api_client):
    """지출 카테고리 목록 조회 성공 시 정상 구조를 반환하는지 테스트합니다."""
    mock_get, _ = mock_api_client
    mock_categories = [
        {"id": 1, "name": "식비", "color": "#FF5733", "is_default": True},
        {"id": 2, "name": "교통", "color": "#33FF57", "is_default": False},
    ]
    mock_get.return_value = mock_categories

    res = await get_expense_categories()

    mock_get.assert_called_once_with("/api/expenses/categories")
    assert res == {"categories": mock_categories}


@pytest.mark.asyncio
async def test_get_expense_categories_api_error(mock_api_client):
    """지출 카테고리 조회 시 백엔드 API 에러 응답 처리 테스트."""
    mock_get, _ = mock_api_client
    mock_get.return_value = {"error": "HTTP 오류 발생 (500): Internal Server Error"}

    res = await get_expense_categories()

    assert "error" in res
    assert res["error"] == "HTTP 오류 발생 (500): Internal Server Error"


@pytest.mark.asyncio
async def test_get_expense_categories_exception(mock_api_client):
    """지출 카테고리 조회 중 예외 발생 시 에러 딕셔너리 반환 테스트."""
    mock_get, _ = mock_api_client
    mock_get.side_effect = RuntimeError("서버 연결 실패")

    res = await get_expense_categories()

    assert "error" in res
    assert "지출 카테고리 목록 조회 중 오류 발생" in res["error"]


# ==========================================
# get_expense_summary 테스트
# ==========================================

@pytest.mark.asyncio
async def test_get_expense_summary_default(mock_api_client):
    """매개변수 없이 get_expense_summary 호출 시 빈 params로 stats 엔드포인트를 호출하는지 테스트합니다."""
    mock_get, _ = mock_api_client
    mock_stats = {
        "period_start": "2026-08",
        "period_end": "2026-08",
        "period_total": 1500000.0,
        "monthly_trends": [],
        "category_breakdown": [],
        "payment_method_breakdown": [],
    }
    mock_get.return_value = mock_stats

    res = await get_expense_summary()

    mock_get.assert_called_once_with("/api/expenses/stats", params={})
    assert res == mock_stats


@pytest.mark.asyncio
async def test_get_expense_summary_with_params(mock_api_client):
    """모든 매개변수를 전달할 때 params가 올바르게 구성되어 호출되는지 테스트합니다."""
    mock_get, _ = mock_api_client
    mock_stats = {
        "period_start": "2026-01",
        "period_end": "2026-08",
        "period_total": 12000000.0,
        "monthly_trends": [],
        "category_breakdown": [],
        "payment_method_breakdown": [],
    }
    mock_get.return_value = mock_stats

    res = await get_expense_summary(
        year_month="2026-08",
        start_month="2026-01",
        end_month="2026-08",
        owner="장준",
    )

    mock_get.assert_called_once_with(
        "/api/expenses/stats",
        params={
            "year_month": "2026-08",
            "start_month": "2026-01",
            "end_month": "2026-08",
            "owner": "장준",
        },
    )
    assert res == mock_stats


@pytest.mark.asyncio
async def test_get_expense_summary_api_error(mock_api_client):
    """지출 종합 통계 조회 시 백엔드 API 에러 응답 처리 테스트."""
    mock_get, _ = mock_api_client
    mock_get.return_value = {"error": "HTTP 오류 발생 (404): Not Found"}

    res = await get_expense_summary(year_month="2026-99")

    assert "error" in res
    assert res["error"] == "HTTP 오류 발생 (404): Not Found"


@pytest.mark.asyncio
async def test_get_expense_summary_exception(mock_api_client):
    """지출 종합 통계 조회 중 예외 발생 시 에러 딕셔너리 반환 테스트."""
    mock_get, _ = mock_api_client
    mock_get.side_effect = RuntimeError("연결 끊김")

    res = await get_expense_summary()

    assert "error" in res
    assert "지출 종합 통계 조회 중 오류 발생" in res["error"]


# ==========================================
# MCP 서버 등록 테스트
# ==========================================

@pytest.mark.asyncio
async def test_expense_tools_registered_in_mcp():
    """get_expense_categories와 get_expense_summary가 FastMCP 인스턴스에 정상 등록되었는지 검증합니다."""
    import src.mcp.main as mcp_main

    tools = await mcp_main.mcp._local_provider.list_tools()
    registered_tool_names = [t.name for t in tools]

    assert "get_expense_categories" in registered_tool_names, (
        "get_expense_categories 도구가 FastMCP 등록 도구 목록에 포함되어야 합니다."
    )
    assert "get_expense_summary" in registered_tool_names, (
        "get_expense_summary 도구가 FastMCP 등록 도구 목록에 포함되어야 합니다."
    )
