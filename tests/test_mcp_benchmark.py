# -*- coding: utf-8 -*-
import pytest
from unittest.mock import patch, AsyncMock

from src.mcp.tools.benchmark import get_benchmark_attribution


@pytest.fixture
def mock_api_client():
    """src.mcp.client.api_client의 get 메서드를 모킹하는 fixture입니다."""
    with patch("src.mcp.client.api_client.get", new_callable=AsyncMock) as mock_get:
        yield mock_get


@pytest.mark.asyncio
async def test_get_benchmark_attribution_default(mock_api_client):
    """기준일(as_of_date) 생략 시 기본 호출을 테스트합니다."""
    mock_get = mock_api_client
    mock_get.return_value = {
        "as_of_date": "2026-09-28",
        "benchmarks": {
            "1M": {"portfolio": 0.44, "sp500": 3.84, "nasdaq": 4.88, "kospi": 1.48, "alpha_vs_sp500": -3.40},
            "3M": {"portfolio": -1.97, "sp500": 13.56, "nasdaq": 16.03, "kospi": 4.77, "alpha_vs_sp500": -15.53},
            "1Y": {"portfolio": 3.75, "sp500": 15.68, "nasdaq": 19.86, "kospi": 5.48, "alpha_vs_sp500": -11.93},
            "YTD": {"portfolio": 5.39, "sp500": 12.33, "nasdaq": 14.51, "kospi": 4.19, "alpha_vs_sp500": -6.94},
        },
        "top_contributors_ytd": [
            {"ticker": "GOOGL", "name": "Alphabet Inc.", "weight": 11.62, "return": 80.98, "contribution": 9.41}
        ],
        "top_detractors_ytd": [
            {"ticker": "000660", "name": "SK하이닉스", "weight": 9.25, "return": -21.54, "contribution": -1.99}
        ],
        "top_contributors_1m": [],
        "top_detractors_1m": [],
        "holdings_attribution": [
            {
                "ticker": "GOOGL",
                "name": "Alphabet Inc.",
                "weight": 11.62,
                "valuation_krw": 53168143.0,
                "returns": {"1M": 6.69, "3M": 15.20, "1Y": 45.10, "YTD": 80.98},
                "contributions": {"1M": 0.78, "3M": 1.77, "1Y": 5.24, "YTD": 9.41},
            }
        ],
    }

    result = await get_benchmark_attribution()
    assert "error" not in result
    assert result["as_of_date"] == "2026-09-28"
    assert "benchmarks" in result
    assert "top_contributors_ytd" in result
    assert "holdings_attribution" in result
    assert len(result["top_contributors_ytd"]) == 1
    mock_get.assert_called_once_with("/api/benchmark/attribution", params={})


@pytest.mark.asyncio
async def test_get_benchmark_attribution_with_as_of_date(mock_api_client):
    """기준일(as_of_date) 지정 시 파라미터 전달 및 응답 결과를 테스트합니다."""
    mock_get = mock_api_client
    mock_get.return_value = {
        "as_of_date": "2026-06-30",
        "benchmarks": {},
        "top_contributors_ytd": [],
        "top_detractors_ytd": [],
        "top_contributors_1m": [],
        "top_detractors_1m": [],
        "holdings_attribution": [],
    }

    result = await get_benchmark_attribution(as_of_date="2026-06-30")
    assert "error" not in result
    assert result["as_of_date"] == "2026-06-30"
    mock_get.assert_called_once_with("/api/benchmark/attribution", params={"as_of_date": "2026-06-30"})


@pytest.mark.asyncio
async def test_get_benchmark_attribution_exception(mock_api_client):
    """API 호출 중 예외 발생 시 에러 딕셔너리 반환을 테스트합니다."""
    mock_get = mock_api_client
    mock_get.side_effect = Exception("연결 실패")

    result = await get_benchmark_attribution()
    assert "error" in result
    assert "연결 실패" in result["error"]


@pytest.mark.asyncio
async def test_benchmark_tool_registered_in_fastmcp():
    """FastMCP 서버 인스턴스에 get_benchmark_attribution 도구가 올바르게 등록되어 있는지 검증합니다."""
    import src.mcp.main as mcp_main

    tools = await mcp_main.mcp._local_provider.list_tools()
    registered_tool_names = [t.name for t in tools]
    assert "get_benchmark_attribution" in registered_tool_names, (
        "get_benchmark_attribution 도구가 FastMCP 등록 도구 목록에 포함되어야 합니다."
    )
