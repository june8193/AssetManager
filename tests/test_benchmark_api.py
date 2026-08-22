# -*- coding: utf-8 -*-
"""벤치마크 비교 대시보드 API 엔드포인트 테스트 모듈입니다."""

import pytest
import datetime
from unittest.mock import patch
from fastapi.testclient import TestClient

from src.backend.main import app
from src.backend.models import Watchlist, AccountSnapshot, HistoricalPrice, User, Account, Asset, Transaction

client = TestClient(app)


@pytest.fixture(autouse=True)
def mock_external_market_adapters():
    """테스트 실행 중 외부 yfinance/키움 통신을 방지하기 위해 어댑터를 모킹합니다."""
    with patch("src.backend.market.adapters.yfinance.YahooFinanceAdapter.get_historical_prices", return_value=[]), \
         patch("src.backend.market.adapters.kiwoom.KiwoomAdapter.get_historical_prices", return_value=[]):
        yield


@pytest.fixture
def setup_benchmark_data(db_session):
    """테스트를 위한 벤치마크 데이터를 세팅하는 픽스처입니다."""
    # 0. User 및 Account 생성
    user = User(name="Test User")
    db_session.add(user)
    db_session.commit()

    account = Account(user_id=user.id, name="Test Account", provider="Test Bank", is_active=True)
    db_session.add(account)
    db_session.commit()

    # 원화 자산 추가
    cash_asset = Asset(ticker="KRW", name="Won", country="KR", major_category="현금", sub_category="원화예수금")
    db_session.add(cash_asset)
    db_session.commit()

    today = datetime.date.today()
    d1 = today - datetime.timedelta(days=4)
    d2 = today - datetime.timedelta(days=1)
    d3 = today

    # 실시간 자산 평가액을 1,100,000으로 만들기 위한 원화 입금 추가
    db_session.add(Transaction(
        account_id=account.id,
        asset_id=cash_asset.id,
        transaction_date=d1,
        type="DEPOSIT",
        quantity=1100000.0,
        total_amount=1100000.0,
        currency="KRW"
    ))
    db_session.commit()

    # 1. 포트폴리오 스냅샷 생성
    dates = [d1, d2, d3]
    for i, d in enumerate(dates):
        snapshot = AccountSnapshot(
            account_id=account.id,
            snapshot_date=d,
            period_deposit=1100000.0 if i == 0 else 0.0,
            total_valuation=1000000 + i * 50000,
            total_profit=0.0
        )
        db_session.add(snapshot)

    # 2. 지수 및 관심종목 가격 데이터 주입
    tickers = ["^KS11", "^KQ11", "^GSPC", "^IXIC"]
    for t in tickers:
        for i, d in enumerate(dates):
            p = HistoricalPrice(
                ticker=t,
                price_date=d,
                close_price=2000.0 + i * 100
            )
            db_session.add(p)

    # 관심종목 005930 시세 주입 (5/1: 70000, 5/4: 71000, 5/5: 72000)
    for i, d in enumerate(dates):
        db_session.add(HistoricalPrice(
            ticker="005930",
            price_date=d,
            close_price=70000.0 + i * 1000.0
        ))
        db_session.add(HistoricalPrice(
            ticker="AAPL",
            price_date=d,
            close_price=170.0 + i * 5.0
        ))

    # 3. 관심종목 추가
    db_session.add(Watchlist(stock_code="005930", stock_name="삼성전자", country="KR"))
    db_session.add(Watchlist(stock_code="AAPL", stock_name="Apple", country="US"))

    db_session.commit()


@pytest.mark.asyncio
@patch("src.backend.services.price_service.price_service.get_kr_prices")
@patch("src.backend.services.price_service.price_service.get_us_prices")
async def test_get_benchmark_dashboard_api(
    mock_get_us_prices,
    mock_get_kr_prices,
    setup_benchmark_data,
    db_session
):
    """대시보드 API 엔드포인트(/api/benchmark)가 정상 데이터를 반환하는지 테스트합니다."""
    today = datetime.date.today()
    d3 = today

    # 실시간 현재가 모킹
    mock_get_kr_prices.return_value = [
        {"stock_code": "005930", "current_price": 72000.0}
    ]
    mock_get_us_prices.return_value = [
        {"stock_code": "AAPL", "current_price": 180.0}
    ]

    response = client.get("/api/benchmark?period=1M")

    assert response.status_code == 200
    res_data = response.json()

    # 응답 데이터 구조 검증
    assert "portfolio" in res_data
    assert "indices" in res_data
    assert "chart" in res_data
    assert "watchlist" in res_data
    assert "alpha_analysis" in res_data
    assert "yearly_comparison" in res_data
    assert "daily_comparison" in res_data

    # 포트폴리오
    assert res_data["portfolio"]["total_valuation"] == 1100000
    assert res_data["portfolio"]["actual_latest_valuation"] == 1100000
    assert res_data["portfolio"]["actual_latest_date"] == d3.strftime("%Y-%m-%d")
    assert res_data["portfolio"]["ytd_return"] == -47.62

    # 지수 카드 정보 검증
    indices = res_data["indices"]
    assert "^KS11" in indices
    assert indices["^KS11"]["value"] == 2200.0

    # 관심 종목 검증 (메인 대시보드에서는 외부 API 시세 전수 조회 생략)
    watchlist = res_data["watchlist"]
    assert len(watchlist) == 2

    samsung = next(w for w in watchlist if w["stock_code"] == "005930")
    assert samsung["stock_name"] == "삼성전자"
    assert samsung["country"] == "KR"


@pytest.mark.asyncio
@patch("src.backend.services.price_service.price_service.get_kr_prices")
@patch("src.backend.services.price_service.price_service.get_us_prices")
async def test_get_benchmark_dashboard_api_with_missing_last_snapshot(
    mock_get_us_prices,
    mock_get_kr_prices,
    db_session
):
    """최종일에 포트폴리오 스냅샷이 누락된 경우, API 응답의 portfolio.ytd_return이 None이 아니라 최근 유효값을 반환하는지 테스트합니다."""
    # User, Account, Cash Asset 셋업
    user = User(name="Test User 2")
    db_session.add(user)
    db_session.commit()

    account = Account(user_id=user.id, name="Test Account 2", provider="Test Bank", is_active=True)
    db_session.add(account)
    db_session.commit()

    cash_asset = Asset(ticker="KRW", name="Won", country="KR", major_category="현금", sub_category="원화예수금")
    db_session.add(cash_asset)
    db_session.commit()

    today = datetime.date.today()
    d1 = today - datetime.timedelta(days=4)
    d2 = today - datetime.timedelta(days=1)
    d3 = today

    snapshots = [
        AccountSnapshot(account_id=account.id, snapshot_date=d1, period_deposit=0.0, total_valuation=1000000.0, total_profit=0.0),
        AccountSnapshot(account_id=account.id, snapshot_date=d2, period_deposit=0.0, total_valuation=1100000.0, total_profit=0.0),
    ]
    for s in snapshots:
        db_session.add(s)

    dates = [d1, d2, d3]
    tickers = ["^KS11"]
    for t in tickers:
        for i, d in enumerate(dates):
            p = HistoricalPrice(ticker=t, price_date=d, close_price=2000.0 + i * 100)
            db_session.add(p)

    db_session.commit()

    mock_get_kr_prices.return_value = []
    mock_get_us_prices.return_value = []

    response = client.get("/api/benchmark?period=1M")
    assert response.status_code == 200
    res_data = response.json()

    assert res_data["portfolio"]["ytd_return"] == 10.0
    assert res_data["portfolio"]["actual_latest_valuation"] == 1100000.0
    assert res_data["portfolio"]["actual_latest_date"] == d2.strftime("%Y-%m-%d")
