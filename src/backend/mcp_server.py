# -*- coding: utf-8 -*-
"""AssetManager 백엔드 서비스와 통신하는 독립형 MCP(Model Context Protocol) Stdio 서버의 래퍼 파일입니다.

기존 mcp_server.py의 하위 호환성을 보장하기 위해 새롭게 분리된 src/backend/mcp 패키지의
mcp 인스턴스 및 툴 함수들을 가져와 재배포(re-export)합니다.
"""

# mcp 인스턴스 임포트
from src.backend.mcp.main import mcp

# 각 세분화된 모듈로부터 개별 툴 함수들을 가져와 re-export하여 하위 호환성 유지
from src.backend.mcp.assets import (
    get_asset_summary,
    get_asset_ratios,
    get_portfolio_status,
)
from src.backend.mcp.stats import (
    get_yearly_stats,
    get_daily_stats,
    get_snapshots,
)
from src.backend.mcp.market import (
    get_watchlist_prices,
    get_market_history,
    get_stock_history,
    refresh_market_prices,
)
from src.backend.mcp.transactions import (
    get_transactions,
)

if __name__ == "__main__":
    mcp.run()
