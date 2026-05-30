"""벤치마크 비교 대시보드 API 엔드포인트 테스트 모듈입니다."""

import pytest
import datetime
from unittest.mock import patch, MagicMock
import pandas as pd
from fastapi.testclient import TestClient

from src.backend.main import app
from src.backend.models import Watchlist, AccountSnapshot, HistoricalPrice, User, Account, Asset, Transaction

client = TestClient(app)


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
    cash_asset = Asset(ticker="KRW", name="Won", country="KR", major_category="현금", sub_category="현금")
    db_session.add(cash_asset)
    db_session.commit()

    # 실시간 자산 평가액을 1,100,000으로 만들기 위한 원화 입금 추가
    db_session.add(Transaction(
        account_id=account.id,
        asset_id=cash_asset.id,
        transaction_date=datetime.date(2026, 5, 1),
        type="DEPOSIT",
        quantity=1100000.0,
        total_amount=1100000.0,
        currency="KRW"
    ))
    db_session.commit()

    # 1. 포트폴리오 스냅샷 생성
    dates = [
        datetime.date(2026, 5, 1),
        datetime.date(2026, 5, 4),
        datetime.date(2026, 5, 5),
    ]
    for i, d in enumerate(dates):
        # 5/1: 평가액 100만, 추가액 110만
        snapshot = AccountSnapshot(
            account_id=account.id,
            snapshot_date=d,
            period_deposit=1100000.0 if i == 0 else 0.0,
            total_valuation=1000000 + i * 50000,  # 100만, 105만, 110만
            total_profit=0.0
        )
        db_session.add(snapshot)

    # 2. 지수 가격 데이터 주입
    tickers = ["^KS11", "^KQ11", "^GSPC", "^IXIC"]
    for t in tickers:
        for i, d in enumerate(dates):
            p = HistoricalPrice(
                ticker=t,
                price_date=d,
                close_price=2000.0 + i * 100  # 2000, 2100, 2200
            )
            db_session.add(p)

    # 3. 관심종목 추가
    db_session.add(Watchlist(stock_code="005930", stock_name="삼성전자", country="KR"))
    db_session.add(Watchlist(stock_code="AAPL", stock_name="Apple", country="US"))
    
    db_session.commit()


@pytest.mark.asyncio
@patch("yfinance.download")
@patch("src.backend.services.price_service.price_service.get_kr_prices")
@patch("src.backend.services.price_service.price_service.get_us_prices")
async def test_get_benchmark_dashboard_api(
    mock_get_us_prices,
    mock_get_kr_prices,
    mock_yf_download,
    setup_benchmark_data,
    db_session
):
    """대시보드 API 엔드포인트(/api/benchmark)가 정상 데이터를 반환하는지 테스트합니다."""
    
    # yfinance download 모킹
    mock_df = pd.DataFrame(
        data={"Close": [70000.0, 71000.0, 72000.0]},
        index=pd.DatetimeIndex([
            datetime.datetime(2026, 5, 1),
            datetime.datetime(2026, 5, 4),
            datetime.datetime(2026, 5, 5),
        ])
    )
    mock_df.index.name = "Date"
    mock_yf_download.return_value = mock_df

    # 실시간 현재가 모킹
    mock_get_kr_prices.return_value = [
        {"stock_code": "005930", "current_price": 72000.0}
    ]
    mock_get_us_prices.return_value = [
        {"stock_code": "AAPL", "current_price": 180.0}
    ]

    # API 호출 (1M 기간으로 조회하여 셋업한 5/1 데이터가 캐시 히트 범위(7일 이내)에 들도록 함)
    response = client.get("/api/benchmark?period=1M")

    assert response.status_code == 200
    res_data = response.json()

    # 응답 데이터 구조 검증
    assert "portfolio" in res_data
    assert "indices" in res_data
    assert "chart" in res_data
    assert "watchlist" in res_data
    assert "alpha_analysis" in res_data

    # 포트폴리오
    assert res_data["portfolio"]["total_valuation"] == 1100000
    # 선택된 1M 기간(5/1~5/5)의 정규화 누적 수익률: -47.62%
    assert res_data["portfolio"]["ytd_return"] == -47.62

    # 지수 카드 정보 검증
    indices = res_data["indices"]
    assert "^KS11" in indices
    assert indices["^KS11"]["value"] == 2200.0

    # 관심 종목 검증
    watchlist = res_data["watchlist"]
    assert len(watchlist) == 2
    
    samsung = next(w for w in watchlist if w["stock_code"] == "005930")
    assert samsung["stock_name"] == "삼성전자"
    assert samsung["current_price"] == 72000.0
    # YTD return: 5/1(70000) 대비 5/5(72000) -> ((72000 - 70000) / 70000) * 100 = 2.86%
    assert samsung["ytd_return"] == 2.86
