# -*- coding: utf-8 -*-
import asyncio
import os
import sys

# 프로젝트 루트를 path에 추가
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# 환경 변수 강제 설정
os.environ["MCP_BACKEND_URL"] = "http://192.168.0.27:8000"
os.environ["PYTHONPATH"] = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

from src.mcp.tools.assets import get_asset_summary, get_asset_ratios, get_portfolio_status
from src.mcp.tools.stats import get_yearly_stats, get_daily_stats, get_snapshots
from src.mcp.tools.market import get_watchlist_prices, get_market_history, get_stock_history, refresh_market_prices
from src.mcp.tools.transactions import get_transactions

async def run_test():
    print("=== MCP Tools Direct Execution Test ===")
    
    # 1. get_asset_summary
    try:
        res = await get_asset_summary()
        print(f"[OK] get_asset_summary: keys {list(res.keys()) if isinstance(res, dict) else type(res)}")
    except Exception as e:
        print(f"[FAIL] get_asset_summary: {e}")
        
    # 2. get_asset_ratios
    try:
        res = await get_asset_ratios()
        print(f"[OK] get_asset_ratios: keys {list(res.keys()) if isinstance(res, dict) else type(res)}")
    except Exception as e:
        print(f"[FAIL] get_asset_ratios: {e}")

    # 3. get_portfolio_status
    try:
        res = await get_portfolio_status()
        print(f"[OK] get_portfolio_status: keys {list(res.keys()) if isinstance(res, dict) else type(res)}")
    except Exception as e:
        print(f"[FAIL] get_portfolio_status: {e}")

    # 4. get_yearly_stats
    try:
        res = await get_yearly_stats()
        print(f"[OK] get_yearly_stats: keys {list(res.keys()) if isinstance(res, dict) else type(res)}")
    except Exception as e:
        print(f"[FAIL] get_yearly_stats: {e}")

    # 5. get_daily_stats
    try:
        res = await get_daily_stats()
        print(f"[OK] get_daily_stats: keys {list(res.keys()) if isinstance(res, dict) else type(res)}")
    except Exception as e:
        print(f"[FAIL] get_daily_stats: {e}")

    # 6. get_snapshots
    try:
        res = await get_snapshots()
        print(f"[OK] get_snapshots: keys {list(res.keys()) if isinstance(res, dict) else type(res)}")
    except Exception as e:
        print(f"[FAIL] get_snapshots: {e}")

    # 7. get_watchlist_prices
    try:
        res = await get_watchlist_prices(country="KR")
        print(f"[OK] get_watchlist_prices(KR): keys {list(res.keys()) if isinstance(res, dict) else type(res)}")
    except Exception as e:
        print(f"[FAIL] get_watchlist_prices(KR): {e}")

    # 8. get_market_history
    try:
        res = await get_market_history(tickers="^KS11")
        print(f"[OK] get_market_history(^KS11): keys {list(res.keys()) if isinstance(res, dict) else type(res)}")
    except Exception as e:
        print(f"[FAIL] get_market_history(^KS11): {e}")

    # 9. get_stock_history
    try:
        res = await get_stock_history(ticker="005930", start_date="2026-07-01")
        print(f"[OK] get_stock_history(005930): keys {list(res.keys()) if isinstance(res, dict) else type(res)}")
    except Exception as e:
        print(f"[FAIL] get_stock_history(005930): {e}")

    # 10. get_transactions
    try:
        res = await get_transactions()
        print(f"[OK] get_transactions: keys {list(res.keys()) if isinstance(res, dict) else type(res)}")
    except Exception as e:
        print(f"[FAIL] get_transactions: {e}")

    # 11. refresh_market_prices
    try:
        res = await refresh_market_prices()
        print(f"[OK] refresh_market_prices: keys {list(res.keys()) if isinstance(res, dict) else type(res)}")
    except Exception as e:
        print(f"[FAIL] refresh_market_prices: {e}")

if __name__ == "__main__":
    asyncio.run(run_test())
