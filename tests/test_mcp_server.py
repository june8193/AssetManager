# -*- coding: utf-8 -*-
import pytest
import datetime
from unittest.mock import patch, AsyncMock

# 새로운 위치의 도구들을 임포트
from src.mcp.tools.assets import (
    get_asset_summary,
    get_asset_ratios,
    get_portfolio_status,
)
from src.mcp.tools.stats import (
    get_yearly_stats,
    get_daily_stats,
    get_snapshots,
)
from src.mcp.tools.market import (
    get_watchlist_prices,
    get_market_history,
    get_stock_history,
    refresh_market_prices,
    check_market_holiday,
    get_market_indices,
)
from src.mcp.tools.transactions import (
    get_transactions,
)

@pytest.fixture
def mock_api_client():
    """src.mcp.client.api_client의 get 및 post 메서드를 모킹하는 fixture입니다."""
    with patch("src.mcp.client.api_client.get", new_callable=AsyncMock) as mock_get, \
         patch("src.mcp.client.api_client.post", new_callable=AsyncMock) as mock_post:
        yield mock_get, mock_post

@pytest.mark.asyncio
async def test_get_asset_summary_mcp(mock_api_client):
    """총자산 요약 정보 MCP 도구 조회 결과를 테스트합니다."""
    mock_get, _ = mock_api_client
    mock_get.return_value = {
        "total_valuation_krw": 1500000.0,
        "total_principal": 1200000.0,
        "total_profit": 300000.0,
        "profit_rate": 25.0
    }
    
    result = await get_asset_summary()
    assert "error" not in result
    assert "total_valuation_krw" in result
    assert result["total_valuation_krw"] == 1500000.0
    mock_get.assert_called_once_with("/api/dashboard/summary", params={"force_update": False})

@pytest.mark.asyncio
async def test_get_asset_ratios_mcp(mock_api_client):
    """자산 비중 조회 MCP 도구 결과를 테스트합니다."""
    mock_get, _ = mock_api_client
    async def mock_get_side_effect(url, params=None):
        if url == "/api/ratios/rebalancing":
            return {
                "total_valuation": 1500000.0,
                "total_target": 1500000.0,
                "additional_cash": 0.0,
                "major_results": [
                    {"category_name": "주식", "valuation": 1000000.0, "percentage": 66.7, "target_percentage": 70.0},
                    {"category_name": "현금", "valuation": 500000.0, "percentage": 33.3, "target_percentage": 30.0}
                ],
                "sub_results": []
            }
        elif url == "/api/v1/performance/portfolio":
            return {"sharpe_ratio": 1.25, "sortino_ratio": 1.5, "mdd": -5.2, "max_mdd": -8.5}
        return {}

    mock_get.side_effect = mock_get_side_effect
    
    result = await get_asset_ratios()
    assert "error" not in result
    assert "major_results" in result
    assert len(result["major_results"]) == 2
    assert result["sharpe_ratio"] == 1.25
    assert result["sortino_ratio"] == 1.5
    assert result["mdd"] == -5.2


@pytest.mark.asyncio
async def test_get_portfolio_status_mcp(mock_api_client):
    """포트폴리오 상태 조회 MCP 도구 결과를 테스트합니다."""
    mock_get, _ = mock_api_client
    async def mock_get_side_effect(url, params=None):
        if url == "/api/portfolio/status":
            return {
                "total_valuation_krw": 1500000.0,
                "cash_balances": {"KRW": 500000.0},
                "exchange_rate": 1300.0,
                "holdings": [
                    {
                        "ticker": "005930",
                        "name": "삼성전자",
                        "major_category": "주식",
                        "sub_category": "알파(성장)",
                        "country": "KR",
                        "quantity": 10.0,
                        "current_price": 70000.0,
                        "valuation": 700000.0,
                        "valuation_krw": 700000.0
                    }
                ]
            }
        elif url == "/api/v1/performance/portfolio":
            return {"sharpe_ratio": 1.25, "sortino_ratio": 1.5, "mdd": -5.2, "max_mdd": -8.5}
        return {}

    mock_get.side_effect = mock_get_side_effect
    
    result = await get_portfolio_status()
    assert "error" not in result
    assert "cash_balances" in result
    assert "holdings" in result
    assert result["cash_balances"]["KRW"] == 500000.0
    assert result["sharpe_ratio"] == 1.25
    assert result["sortino_ratio"] == 1.5
    assert result["mdd"] == -5.2


@pytest.mark.asyncio
async def test_get_yearly_stats_mcp(mock_api_client):
    """연도별 통계 조회 MCP 도구 결과를 테스트합니다."""
    mock_get, _ = mock_api_client
    mock_get.return_value = [
        {"year": 2026, "principal": 1200000.0, "valuation": 1500000.0, "profit": 300000.0, "profit_rate": 25.0}
    ]
    
    result = await get_yearly_stats()
    assert "error" not in result
    assert "stats" in result
    assert result["stats"][0]["year"] == 2026
    mock_get.assert_called_once_with("/api/dashboard/yearly")

@pytest.mark.asyncio
async def test_get_daily_stats_mcp(mock_api_client):
    """일자별 통계 조회 MCP 도구 결과를 테스트합니다."""
    mock_get, _ = mock_api_client
    mock_get.return_value = [
        {"date": "2026-07-18", "principal": 1200000.0, "valuation": 1500000.0, "profit": 300000.0, "profit_rate": 25.0}
    ]
    
    result = await get_daily_stats()
    assert "error" not in result
    assert "stats" in result
    assert result["stats"][0]["date"] == "2026-07-18"
    mock_get.assert_called_once_with("/api/dashboard/daily", params={"all": False})

@pytest.mark.asyncio
async def test_get_daily_stats_mcp_with_date_range(mock_api_client):
    """일자별 통계 조회 MCP 도구에 기간 필터를 적용하여 결과를 테스트합니다."""
    mock_get, _ = mock_api_client
    mock_get.return_value = [
        {"date": "2026-07-18", "principal": 1200000.0, "valuation": 1500000.0, "profit": 300000.0, "profit_rate": 25.0}
    ]
    
    result = await get_daily_stats(start_date="2026-07-01", end_date="2026-07-18", all_data=True)
    assert "error" not in result
    assert "stats" in result
    mock_get.assert_called_once_with(
        "/api/dashboard/daily", 
        params={"all": True, "start_date": "2026-07-01", "end_date": "2026-07-18"}
    )

@pytest.mark.asyncio
async def test_get_snapshots_mcp(mock_api_client):
    """계좌 스냅샷 이력 조회 MCP 도구 결과를 테스트합니다."""
    mock_get, _ = mock_api_client
    mock_get.return_value = {
        "2026-07-18": {"KB Account": 1500000.0}
    }
    
    result = await get_snapshots()
    assert "error" not in result
    assert "2026-07-18" in result
    mock_get.assert_called_once_with("/api/dashboard/snapshots", params={"all": False})

@pytest.mark.asyncio
async def test_get_snapshots_mcp_with_date_range(mock_api_client):
    """계좌 스냅샷 이력 조회 MCP 도구에 기간 필터를 적용하여 결과를 테스트합니다."""
    mock_get, _ = mock_api_client
    mock_get.return_value = {
        "2026-07-18": {"KB Account": 1500000.0}
    }
    
    result = await get_snapshots(start_date="2026-07-01", end_date="2026-07-18", all_data=True)
    assert "error" not in result
    assert "2026-07-18" in result
    mock_get.assert_called_once_with(
        "/api/dashboard/snapshots", 
        params={"all": True, "start_date": "2026-07-01", "end_date": "2026-07-18"}
    )

@pytest.mark.asyncio
async def test_get_watchlist_prices_mcp(mock_api_client):
    """관심종목 시세 조회 MCP 도구 결과를 테스트합니다."""
    mock_get, _ = mock_api_client
    
    # 두 번의 GET 요청 호출에 대한 응답 순차적 셋업
    # 1. /api/watchlist -> 관심종목 기본 정보
    # 2. /api/watchlist/prices -> 시세 정보
    mock_get.side_effect = [
        [{"stock_code": "005930", "stock_name": "삼성전자", "country": "KR"}],
        [{"stock_code": "005930", "current_price": 72000.0, "change_rate": 2.8}]
    ]
    
    result = await get_watchlist_prices(country="KR")
    assert "error" not in result
    assert result["country"] == "KR"
    assert len(result["prices"]) > 0
    assert result["prices"][0]["stock_code"] == "005930"
    assert result["prices"][0]["stock_name"] == "삼성전자"
    assert result["prices"][0]["current_price"] == 72000.0
    
    assert mock_get.call_count == 2

@pytest.mark.asyncio
async def test_get_market_history_mcp(mock_api_client):
    """시장 지수 역사적 가격 조회 MCP 도구 결과를 테스트합니다."""
    mock_get, _ = mock_api_client
    mock_get.return_value = {
        "^KS11": [{"date": "2026-07-18", "close_price": 2500.0}]
    }
    
    result = await get_market_history(tickers="^KS11")
    assert "error" not in result
    assert "^KS11" in result
    assert len(result["^KS11"]) == 1
    assert result["^KS11"][0]["close_price"] == 2500.0
    mock_get.assert_called_once_with("/api/market/history", params={"tickers": "^KS11"})

@pytest.mark.asyncio
async def test_get_stock_history_mcp(mock_api_client):
    """개별 주가 조회 MCP 도구 결과를 테스트합니다."""
    mock_get, _ = mock_api_client
    mock_get.return_value = {
        "ticker": "005930",
        "name": "삼성전자",
        "market": "KOSPI",
        "prices": [{"date": "2026-07-18", "close_price": 70000.0}]
    }
    
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    result = await get_stock_history(ticker="005930", start_date=today_str)
    assert "error" not in result
    assert result["ticker"] == "005930"
    assert result["name"] == "삼성전자"
    assert len(result["prices"]) == 1
    mock_get.assert_called_once_with("/api/stocks/prices", params={"ticker": "005930", "start_date": today_str})

@pytest.mark.asyncio
async def test_get_transactions_mcp(mock_api_client):
    """거래 내역 조회 MCP 도구 결과를 테스트합니다."""
    mock_get, _ = mock_api_client
    mock_get.return_value = [
        {
            "id": 1,
            "account_id": 1,
            "asset_id": 2,
            "transaction_date": "2026-07-18",
            "type": "BUY",
            "quantity": 10.0,
            "price": 70000.0,
            "total_amount": 700000.0,
            "currency": "KRW",
            "exchange_rate": 1.0,
            "memo": "삼성전자 매수",
            "asset_name": "삼성전자",
            "asset_ticker": "005930"
        }
    ]
    
    result = await get_transactions()
    assert "error" not in result
    assert "transactions" in result
    assert len(result["transactions"]) == 1
    assert result["transactions"][0]["asset_name"] == "삼성전자"
    mock_get.assert_called_once_with("/api/db/transactions", params={})

@pytest.mark.asyncio
async def test_refresh_market_prices_mcp(mock_api_client):
    """수동 시세 최신화 MCP 도구 결과를 테스트합니다."""
    _, mock_post = mock_api_client
    mock_post.return_value = {
        "status": "success",
        "message": "성공적으로 모든 시장 지수 및 자산의 주가를 최신 상태로 동기화했습니다."
    }
    
    result = await refresh_market_prices()
    assert result["status"] == "success"
    mock_post.assert_called_once_with("/api/dashboard/refresh")

@pytest.mark.asyncio
async def test_check_market_holiday_mcp(mock_api_client):
    """시장 휴장일 조회 MCP 도구 결과를 테스트합니다."""
    mock_get, _ = mock_api_client
    mock_get.return_value = {
        "date": "2026-07-18",
        "country": "KR",
        "is_holiday": True,
        "description": "주말"
    }
    
    result = await check_market_holiday(date="2026-07-18", country="KR")
    assert "error" not in result
    assert result["is_holiday"] is True
    assert result["description"] == "주말"
    mock_get.assert_called_once_with("/api/market/holiday", params={"country": "KR", "date": "2026-07-18"})

@pytest.mark.asyncio
async def test_get_market_indices_mcp(mock_api_client):
    """시장 지수 조회 MCP 도구 결과를 테스트합니다."""
    mock_get, _ = mock_api_client
    mock_get.return_value = [
        {"index_name": "KOSPI", "current_price": 2500.0, "change_rate": 1.2}
    ]
    
    result = await get_market_indices(country="KR")
    assert "error" not in result
    assert isinstance(result, list)
    assert result[0]["index_name"] == "KOSPI"
    mock_get.assert_called_once_with("/api/market/indices", params={"country": "KR"})
