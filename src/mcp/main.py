# -*- coding: utf-8 -*-
"""AssetManager MCP 서버의 진입점 파일입니다.
FastMCP 인스턴스를 관리하며, 세분화된 모듈들로부터 도구(Tool)들을 가져와
명시적으로 등록하고 서버를 기동합니다.
"""

from fastmcp import FastMCP

# 기능별 도구 함수 가져오기
from src.mcp.tools.assets import get_asset_summary, get_asset_ratios, get_portfolio_status
from src.mcp.tools.stats import get_yearly_stats, get_daily_stats, get_snapshots
from src.mcp.tools.market import (
    get_watchlist_prices,
    get_market_history,
    get_stock_history,
    refresh_market_prices,
    check_market_holiday,
    get_market_indices,
)
from src.mcp.tools.transactions import get_transactions

# MCP 서버 객체 선언
mcp = FastMCP("AssetManager")

# 도구들을 명시적으로 등록
mcp.tool()(get_asset_summary)
mcp.tool()(get_asset_ratios)
mcp.tool()(get_portfolio_status)
mcp.tool()(get_yearly_stats)
mcp.tool()(get_daily_stats)
mcp.tool()(get_snapshots)
mcp.tool()(get_watchlist_prices)
mcp.tool()(get_market_history)
mcp.tool()(get_stock_history)
mcp.tool()(refresh_market_prices)
mcp.tool()(get_transactions)
mcp.tool()(check_market_holiday)
mcp.tool()(get_market_indices)

if __name__ == "__main__":
    mcp.run()
