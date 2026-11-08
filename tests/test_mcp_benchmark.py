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
    """기준일(as_of_date) 생략 시 기본 호출 및 신규 attribution 응답 스키마 정합성을 테스트합니다."""
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
            {
                "ticker": "GOOGL",
                "name": "Alphabet Inc.",
                "major_category": "주식",
                "sub_category": "알파(성장)",
                "currency": "USD",
                "status": "HOLDING",
                "weight": 11.62,
                "capital_pnl": 5000.0,
                "dividend_pnl": 200.0,
                "total_pnl": 5200.0,
                "total_pnl_krw": 7020000,
                "capital_return": 77.88,
                "return": 80.98,
                "price_return": 75.00,
                "capital_contribution": 9.05,
                "dividend_contribution": 0.36,
                "contribution": 9.41,
            }
        ],
        "top_detractors_ytd": [
            {
                "ticker": "000660",
                "name": "SK하이닉스",
                "major_category": "주식",
                "sub_category": "알파(성장)",
                "currency": "KRW",
                "status": "HOLDING",
                "weight": 9.25,
                "capital_pnl": -1500000.0,
                "dividend_pnl": 50000.0,
                "total_pnl": -1450000.0,
                "total_pnl_krw": -1450000,
                "capital_return": -22.28,
                "return": -21.54,
                "price_return": -25.00,
                "capital_contribution": -2.06,
                "dividend_contribution": 0.07,
                "contribution": -1.99,
            },
            {
                "ticker": "069500",
                "name": "KODEX 200",
                "major_category": "주식",
                "sub_category": "코어(지수)",
                "currency": "KRW",
                "status": "CLOSED",
                "weight": 0.0,
                "capital_pnl": -500000.0,
                "dividend_pnl": 0.0,
                "total_pnl": -500000.0,
                "total_pnl_krw": -500000,
                "capital_return": -10.00,
                "return": -10.00,
                "price_return": -5.00,
                "capital_contribution": -0.69,
                "dividend_contribution": 0.0,
                "contribution": -0.69,
            },
        ],
        "top_contributors_1m": [
            {
                "ticker": "TLT",
                "name": "iShares 20+ Year Treasury Bond ETF",
                "major_category": "채권",
                "sub_category": "미국장기채",
                "currency": "USD",
                "status": "HOLDING",
                "weight": 6.72,
                "capital_pnl": 150.0,
                "dividend_pnl": 50.0,
                "total_pnl": 200.0,
                "total_pnl_krw": 270000,
                "capital_return": 3.10,
                "return": 4.14,
                "price_return": 3.00,
                "capital_contribution": 0.21,
                "dividend_contribution": 0.07,
                "contribution": 0.28,
            }
        ],
        "top_detractors_1m": [],
        "holdings_attribution": [
            {
                "ticker": "GOOGL",
                "name": "Alphabet Inc.",
                "major_category": "주식",
                "sub_category": "알파(성장)",
                "currency": "USD",
                "status": "HOLDING",
                "quantity": 250.0,
                "weight": 11.62,
                "valuation": 39383.81,
                "valuation_krw": 53168143,
                "capital_pnl": {"1M": 300.0, "3M": 800.0, "1Y": 2500.0, "YTD": 5000.0},
                "dividend_pnl": {"1M": 10.0, "3M": 30.0, "1Y": 100.0, "YTD": 200.0},
                "total_pnl": {"1M": 310.0, "3M": 830.0, "1Y": 2600.0, "YTD": 5200.0},
                "capital_pnl_krw": {"1M": 405000, "3M": 1080000, "1Y": 3375000, "YTD": 6750000},
                "dividend_pnl_krw": {"1M": 13500, "3M": 40500, "1Y": 135000, "YTD": 270000},
                "total_pnl_krw": {"1M": 418500, "3M": 1120500, "1Y": 3510000, "YTD": 7020000},
                "capital_returns": {"1M": 6.47, "3M": 14.65, "1Y": 43.36, "YTD": 77.88},
                "returns": {"1M": 6.69, "3M": 15.20, "1Y": 45.10, "YTD": 80.98},
                "price_returns": {"1M": 6.00, "3M": 14.00, "1Y": 40.00, "YTD": 75.00},
                "capital_contributions": {"1M": 0.75, "3M": 1.71, "1Y": 5.04, "YTD": 9.05},
                "dividend_contributions": {"1M": 0.03, "3M": 0.06, "1Y": 0.20, "YTD": 0.36},
                "contributions": {"1M": 0.78, "3M": 1.77, "1Y": 5.24, "YTD": 9.41},
            },
            {
                "ticker": "069500",
                "name": "KODEX 200",
                "major_category": "주식",
                "sub_category": "코어(지수)",
                "currency": "KRW",
                "status": "CLOSED",
                "quantity": 0.0,
                "weight": 0.0,
                "valuation": 0.0,
                "valuation_krw": 0,
                "capital_pnl": {"1M": 0.0, "3M": -200000.0, "1Y": -500000.0, "YTD": -500000.0},
                "dividend_pnl": {"1M": 0.0, "3M": 0.0, "1Y": 0.0, "YTD": 0.0},
                "total_pnl": {"1M": 0.0, "3M": -200000.0, "1Y": -500000.0, "YTD": -500000.0},
                "capital_pnl_krw": {"1M": 0, "3M": -200000, "1Y": -500000, "YTD": -500000},
                "dividend_pnl_krw": {"1M": 0, "3M": 0, "1Y": 0, "YTD": 0},
                "total_pnl_krw": {"1M": 0, "3M": -200000, "1Y": -500000, "YTD": -500000},
                "capital_returns": {"1M": 0.0, "3M": -4.0, "1Y": -10.0, "YTD": -10.0},
                "returns": {"1M": 0.0, "3M": -4.0, "1Y": -10.0, "YTD": -10.0},
                "price_returns": {"1M": 1.5, "3M": 2.0, "1Y": -5.0, "YTD": -5.0},
                "capital_contributions": {"1M": 0.0, "3M": -0.28, "1Y": -0.69, "YTD": -0.69},
                "dividend_contributions": {"1M": 0.0, "3M": 0.0, "1Y": 0.0, "YTD": 0.0},
                "contributions": {"1M": 0.0, "3M": -0.28, "1Y": -0.69, "YTD": -0.69},
            },
        ],
    }

    result = await get_benchmark_attribution()
    assert "error" not in result
    assert result["as_of_date"] == "2026-09-28"
    assert "benchmarks" in result
    assert "top_contributors_ytd" in result
    assert "top_detractors_ytd" in result
    assert "top_contributors_1m" in result
    assert "top_detractors_1m" in result
    assert "holdings_attribution" in result

    # 1. 랭킹 아이템 스키마 검증
    top_ytd = result["top_contributors_ytd"][0]
    assert top_ytd["ticker"] == "GOOGL"
    assert top_ytd["currency"] == "USD"
    assert top_ytd["status"] == "HOLDING"
    assert top_ytd["capital_pnl"] == 5000.0
    assert top_ytd["dividend_pnl"] == 200.0
    assert top_ytd["total_pnl"] == 5200.0
    assert top_ytd["total_pnl_krw"] == 7020000
    assert top_ytd["capital_return"] == 77.88
    assert top_ytd["return"] == 80.98
    assert top_ytd["price_return"] == 75.00
    assert top_ytd["capital_contribution"] == 9.05
    assert top_ytd["dividend_contribution"] == 0.36
    assert top_ytd["contribution"] == 9.41

    # 전량 매도 종목(CLOSED, weight 0.0) 검증
    closed_item = result["top_detractors_ytd"][1]
    assert closed_item["ticker"] == "069500"
    assert closed_item["status"] == "CLOSED"
    assert closed_item["weight"] == 0.0
    assert closed_item["total_pnl"] == -500000.0

    # 2. holdings_attribution 스키마 검증
    holding = result["holdings_attribution"][0]
    assert holding["ticker"] == "GOOGL"
    assert holding["currency"] == "USD"
    assert holding["status"] == "HOLDING"
    assert holding["weight"] == 11.62
    assert "capital_pnl" in holding
    assert "dividend_pnl" in holding
    assert "total_pnl" in holding
    assert "capital_pnl_krw" in holding
    assert "dividend_pnl_krw" in holding
    assert "total_pnl_krw" in holding
    assert "capital_returns" in holding
    assert "returns" in holding
    assert "price_returns" in holding
    assert "capital_contributions" in holding
    assert "dividend_contributions" in holding
    assert "contributions" in holding
    assert holding["returns"]["YTD"] == 80.98
    assert holding["capital_returns"]["YTD"] == 77.88
    assert holding["contributions"]["YTD"] == 9.41
    assert holding["capital_contributions"]["YTD"] == 9.05
    assert holding["dividend_contributions"]["YTD"] == 0.36

    closed_holding = result["holdings_attribution"][1]
    assert closed_holding["ticker"] == "069500"
    assert closed_holding["status"] == "CLOSED"
    assert closed_holding["quantity"] == 0.0
    assert closed_holding["weight"] == 0.0

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
