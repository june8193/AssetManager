# -*- coding: utf-8 -*-
"""지출(Expense) 관련 MCP 도구 함수 단위 테스트 모듈입니다."""

import pytest
from unittest.mock import AsyncMock, patch

from src.mcp.tools.expenses import (
    get_expense_categories,
    get_expense_summary,
    get_expenses,
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
# get_expenses 테스트
# ==========================================

@pytest.mark.asyncio
async def test_get_expenses_default(mock_api_client):
    """기본 인자로 호출 시 limit=50, offset=0 파라미터로 GET /api/expenses를 호출하는지 테스트합니다."""
    mock_get, _ = mock_api_client
    mock_expenses = [
        {"id": 1, "merchant": "스타벅스", "amount": 6500.0},
        {"id": 2, "merchant": "이마트", "amount": 45000.0},
    ]
    mock_get.return_value = mock_expenses

    res = await get_expenses()

    mock_get.assert_called_once_with(
        "/api/expenses",
        params={"limit": 50, "offset": 0},
    )
    assert res == {
        "total_count": 2,
        "expenses": mock_expenses,
    }


@pytest.mark.asyncio
async def test_get_expenses_with_all_filters(mock_api_client):
    """모든 필터 파라미터가 백엔드 API 파라미터로 올바르게 전달되는지 테스트합니다."""
    mock_get, _ = mock_api_client
    mock_get.return_value = []

    res = await get_expenses(
        year_month="2026-08",
        start_month="2026-01",
        end_month="2026-08",
        owner="장준",
        category_id=3,
        search="카페",
        limit=20,
        offset=10,
    )

    mock_get.assert_called_once_with(
        "/api/expenses",
        params={
            "year_month": "2026-08",
            "start_month": "2026-01",
            "end_month": "2026-08",
            "owner": "장준",
            "category_id": 3,
            "search": "카페",
            "limit": 20,
            "offset": 10,
        },
    )
    assert res == {"total_count": 0, "expenses": []}


@pytest.mark.asyncio
async def test_get_expenses_category_name_mapping_success(mock_api_client):
    """category_name 전달 시 카테고리 목록을 조회하여 category_id로 자동 변환 매핑하는지 테스트합니다."""
    mock_get, _ = mock_api_client

    async def side_effect(url, params=None):
        if url == "/api/expenses/categories":
            return [
                {"id": 1, "name": "주거/통신"},
                {"id": 5, "name": "식비"},
            ]
        elif url == "/api/expenses":
            return [{"id": 101, "merchant": "맥도날드", "amount": 8000.0, "category_id": 5}]
        return []

    mock_get.side_effect = side_effect

    res = await get_expenses(category_name="식비", year_month="2026-08")

    assert mock_get.call_count == 2
    # 첫 번째 호출: 카테고리 목록 조회
    assert mock_get.call_args_list[0].args[0] == "/api/expenses/categories"
    # 두 번째 호출: 매핑된 category_id=5로 지출 내역 조회
    assert mock_get.call_args_list[1].args[0] == "/api/expenses"
    assert mock_get.call_args_list[1].kwargs["params"] == {
        "year_month": "2026-08",
        "category_id": 5,
        "limit": 50,
        "offset": 0,
    }
    assert res == {
        "total_count": 1,
        "expenses": [{"id": 101, "merchant": "맥도날드", "amount": 8000.0, "category_id": 5}],
    }


@pytest.mark.asyncio
async def test_get_expenses_category_name_whitespace_and_case(mock_api_client):
    """category_name의 공백 및 대소문자가 달라도 정상 매핑되는지 테스트합니다."""
    mock_get, _ = mock_api_client

    async def side_effect(url, params=None):
        if url == "/api/expenses/categories":
            return [{"id": 7, "name": "Coffee & Tea"}]
        elif url == "/api/expenses":
            return [{"id": 201, "merchant": "스타벅스", "amount": 5000.0}]
        return []

    mock_get.side_effect = side_effect

    res = await get_expenses(category_name="  coffee & tea  ")

    assert mock_get.call_count == 2
    assert mock_get.call_args_list[1].kwargs["params"]["category_id"] == 7
    assert res["total_count"] == 1


@pytest.mark.asyncio
async def test_get_expenses_category_name_not_found(mock_api_client):
    """일치하는 category_name이 없을 경우 백엔드 지출 조회를 생략하고 빈 목록을 반환하는지 테스트합니다."""
    mock_get, _ = mock_api_client
    mock_get.return_value = [
        {"id": 1, "name": "식비"},
        {"id": 2, "name": "교통"},
    ]

    res = await get_expenses(category_name="존재하지않는카테고리")

    # 카테고리 목록만 1회 조회되고 /api/expenses는 호출되지 않아야 함
    mock_get.assert_called_once_with("/api/expenses/categories")
    assert res == {"total_count": 0, "expenses": []}


@pytest.mark.asyncio
async def test_get_expenses_category_id_overrides_category_name(mock_api_client):
    """category_id와 category_name이 둘 다 주어지면 카테고리 조회 없이 category_id를 사용하는지 테스트합니다."""
    mock_get, _ = mock_api_client
    mock_get.return_value = [{"id": 99, "merchant": "테스트", "amount": 1000.0}]

    res = await get_expenses(category_name="무시될이름", category_id=99)

    # 카테고리 조회가 아닌 지출 내역 직접 조회 1회만 호출됨
    mock_get.assert_called_once_with(
        "/api/expenses",
        params={"category_id": 99, "limit": 50, "offset": 0},
    )
    assert res["total_count"] == 1


@pytest.mark.asyncio
async def test_get_expenses_category_fetch_api_error(mock_api_client):
    """category_name 매핑 중 카테고리 API 오류 발생 시 해당 오류를 반환하는지 테스트합니다."""
    mock_get, _ = mock_api_client
    mock_get.return_value = {"error": "카테고리 API 오류"}

    res = await get_expenses(category_name="식비")

    mock_get.assert_called_once_with("/api/expenses/categories")
    assert res == {"error": "카테고리 API 오류"}


@pytest.mark.asyncio
async def test_get_expenses_api_error(mock_api_client):
    """지출 내역 조회 시 백엔드 API 에러 응답 처리 테스트."""
    mock_get, _ = mock_api_client
    mock_get.return_value = {"error": "HTTP 오류 발생 (500): Internal Server Error"}

    res = await get_expenses()

    assert res == {"error": "HTTP 오류 발생 (500): Internal Server Error"}


@pytest.mark.asyncio
async def test_get_expenses_exception(mock_api_client):
    """지출 내역 조회 중 예외 발생 시 에러 딕셔너리 반환 테스트."""
    mock_get, _ = mock_api_client
    mock_get.side_effect = RuntimeError("네트워크 단절")

    res = await get_expenses()

    assert "error" in res
    assert "지출 내역 목록 조회 중 오류 발생" in res["error"]


# ==========================================
# MCP 서버 등록 테스트
# ==========================================

@pytest.mark.asyncio
async def test_expense_tools_registered_in_mcp():
    """get_expense_categories, get_expense_summary, get_expenses가 FastMCP 인스턴스에 정상 등록되었는지 검증합니다."""
    import src.mcp.main as mcp_main

    tools = await mcp_main.mcp._local_provider.list_tools()
    registered_tool_names = [t.name for t in tools]

    assert "get_expense_categories" in registered_tool_names, (
        "get_expense_categories 도구가 FastMCP 등록 도구 목록에 포함되어야 합니다."
    )
    assert "get_expense_summary" in registered_tool_names, (
        "get_expense_summary 도구가 FastMCP 등록 도구 목록에 포함되어야 합니다."
    )
    assert "get_expenses" in registered_tool_names, (
        "get_expenses 도구가 FastMCP 등록 도구 목록에 포함되어야 합니다."
    )
