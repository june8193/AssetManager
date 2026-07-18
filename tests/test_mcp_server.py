# -*- coding: utf-8 -*-
import pytest
import datetime
from unittest.mock import patch, AsyncMock
from src.backend.models import User, Account, Asset, Transaction, ExchangeRate, HistoricalPrice, Watchlist, Stock
from src.backend.mcp_server import (
    get_asset_summary,
    get_asset_ratios,
    get_watchlist_prices,
    get_portfolio_status,
    get_yearly_stats,
    get_daily_stats,
    get_snapshots,
    get_transactions,
    get_market_history,
    get_stock_history,
    refresh_market_prices
)

@pytest.fixture
def setup_mcp_data(db_session):
    """MCP 서버 테스트를 위한 기본 데이터를 셋업합니다."""
    # 1. 사용자 및 계좌 생성
    user = User(name="MCP Owner")
    db_session.add(user)
    db_session.commit()

    account = Account(user_id=user.id, name="KB Account", provider="KB증권", is_active=True)
    db_session.add(account)
    db_session.commit()

    # 2. 자산 마스터 데이터 생성
    krw_cash = Asset(ticker="KRW", name="원화예수금", major_category="현금", sub_category="원화예수금", country="KR")
    usd_cash = Asset(ticker="USD", name="달러예수금", major_category="현금", sub_category="달러예수금", country="US")
    aapl = Asset(ticker="AAPL", name="애플", major_category="일반주식", sub_category="해외주식", country="US")
    samsung = Asset(ticker="005930", name="삼성전자", major_category="일반주식", sub_category="국내주식", country="KR")
    db_session.add_all([krw_cash, usd_cash, aapl, samsung])
    db_session.commit()

    # 3. 관심종목 셋업
    wl_kr = Watchlist(stock_code="005930", stock_name="삼성전자", country="KR")
    wl_us = Watchlist(stock_code="AAPL", stock_name="애플", country="US")
    db_session.add_all([wl_kr, wl_us])
    db_session.commit()

    # 4. 주가 정보 셋업
    today = datetime.date.today()
    price_aapl = HistoricalPrice(ticker="AAPL", price_date=today, close_price=180.0)
    price_sam = HistoricalPrice(ticker="005930", price_date=today, close_price=70000.0)
    db_session.add_all([price_aapl, price_sam])
    db_session.commit()

    # 5. 거래 내역 삽입
    tx1 = Transaction(
        account_id=account.id, asset_id=krw_cash.id,
        transaction_date=today, type="DEPOSIT",
        quantity=1000000.0, price=1.0, total_amount=1000000.0, currency="KRW"
    )
    tx2 = Transaction(
        account_id=account.id, asset_id=samsung.id,
        transaction_date=today, type="BUY",
        quantity=10.0, price=70000.0, total_amount=700000.0, currency="KRW"
    )
    db_session.add_all([tx1, tx2])
    db_session.commit()

    return {
        "account": account,
        "samsung": samsung,
        "aapl": aapl
    }

@pytest.mark.asyncio
async def test_get_asset_summary_mcp(db_session, setup_mcp_data):
    """총자산 요약 정보 MCP 도구 조회 결과를 테스트합니다."""
    # DashboardService 내부의 복잡한 로직을 모킹하거나 실제 DB 연동 동작 확인
    # mcp_server.py의 get_asset_summary 호출
    result = await get_asset_summary()
    assert "error" not in result
    assert "total_valuation_krw" in result

@pytest.mark.asyncio
async def test_get_asset_ratios_mcp(db_session, setup_mcp_data):
    """자산 비중 조회 MCP 도구 결과를 테스트합니다."""
    result = await get_asset_ratios()
    assert "error" not in result
    assert "major_results" in result

@pytest.mark.asyncio
async def test_get_watchlist_prices_mcp(db_session, setup_mcp_data):
    """관심종목 시세 조회 MCP 도구 결과를 테스트합니다."""
    # price_service를 모킹하여 외부 API 호출 방지
    with patch("src.backend.mcp.market.price_service") as mock_price_service:
        mock_price_service.get_kr_prices = AsyncMock(return_value=[
            {"stock_code": "005930", "current_price": 72000.0, "change_rate": 2.8}
        ])
        result = await get_watchlist_prices(country="KR")
        assert result["country"] == "KR"
        assert len(result["prices"]) > 0
        assert result["prices"][0]["stock_code"] == "005930"

@pytest.mark.asyncio
async def test_get_portfolio_status_mcp(db_session, setup_mcp_data):
    """포트폴리오 상태 조회 MCP 도구 결과를 테스트합니다."""
    result = await get_portfolio_status()
    assert "error" not in result
    assert "cash_balances" in result
    assert "holdings" in result

@pytest.mark.asyncio
async def test_get_yearly_stats_mcp(db_session, setup_mcp_data):
    """연도별 통계 조회 MCP 도구 결과를 테스트합니다."""
    result = await get_yearly_stats()
    assert "error" not in result
    assert "stats" in result

@pytest.mark.asyncio
async def test_get_daily_stats_mcp(db_session, setup_mcp_data):
    """일자별 통계 조회 MCP 도구 결과를 테스트합니다."""
    result = await get_daily_stats()
    assert "error" not in result
    assert "stats" in result

@pytest.mark.asyncio
async def test_get_snapshots_mcp(db_session, setup_mcp_data):
    """계좌 스냅샷 이력 조회 MCP 도구 결과를 테스트합니다."""
    result = await get_snapshots()
    assert "error" not in result

@pytest.mark.asyncio
async def test_get_transactions_mcp(db_session, setup_mcp_data):
    """거래 내역 조회 MCP 도구 결과를 테스트합니다."""
    result = await get_transactions()
    assert "error" not in result
    assert "transactions" in result
    assert len(result["transactions"]) > 0

@pytest.mark.asyncio
async def test_get_market_history_mcp(db_session, setup_mcp_data):
    """시장 지수 역사적 가격 조회 MCP 도구 결과를 테스트합니다."""
    # BenchmarkService를 모킹하여 테스트
    with patch("src.backend.mcp.market.BenchmarkService") as MockBenchmarkService:
        mock_service = MockBenchmarkService.return_value
        # mock_service.get_historical_prices 는 비동기 함수임
        mock_service.get_historical_prices = AsyncMock(return_value=[
            {"price_date": datetime.date.today(), "close_price": 2500.0}
        ])
        
        result = await get_market_history(tickers="^KS11")
        assert "^KS11" in result
        assert len(result["^KS11"]) > 0

@pytest.mark.asyncio
async def test_get_stock_history_mcp(db_session, setup_mcp_data):
    """개별 주가 조회 MCP 도구 결과를 테스트합니다."""
    # price_service를 모킹하여 테스트
    with patch("src.backend.mcp.market.price_service") as mock_price_service:
        mock_price_service.get_historical_prices_with_cache = AsyncMock(return_value=[
            {"price_date": datetime.date.today(), "close_price": 70000.0}
        ])
        mock_price_service.get_stock_name = AsyncMock(return_value="삼성전자")
        
        result = await get_stock_history(ticker="005930", start_date=datetime.date.today().strftime("%Y-%m-%d"))
        assert result["ticker"] == "005930"
        assert len(result["prices"]) > 0

@pytest.mark.asyncio
async def test_refresh_market_prices_mcp():
    """수동 시세 최신화 MCP 도구 결과를 테스트합니다."""
    with patch("src.backend.mcp.market.price_service") as mock_price_service:
        mock_price_service.update_all_market_prices = AsyncMock()
        result = await refresh_market_prices()
        assert result["status"] == "success"
        mock_price_service.update_all_market_prices.assert_called_once()
