import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from src.backend.main import app
from src.backend.models import SystemSetting, HistoricalPrice, AccountSnapshot, Account, User
from src.backend.services.performance_service import PerformanceService

client = TestClient(app)

def test_risk_free_rate_setting(db_session):
    """무위험 수익률 조회 및 변경 테스트 (기본값 3.5%)"""
    service = PerformanceService(db_session)
    
    # 1. 기본값 조회 (3.5%)
    rate = service.get_risk_free_rate()
    assert rate == 3.5
    
    # 2. 값 변경
    updated_rate = service.set_risk_free_rate(4.2)
    assert updated_rate == 4.2
    
    # 3. 재조회 시 변경된 값 확인
    assert service.get_risk_free_rate() == 4.2


def test_risk_free_rate_api(db_session):
    """무위험 수익률 REST API (GET/PUT) 테스트"""
    # 1. GET 기본값
    resp = client.get("/api/v1/performance/settings/risk-free-rate")
    assert resp.status_code == 200
    assert resp.json()["rate"] == 3.5

    # 2. PUT 새로운 값
    resp = client.put("/api/v1/performance/settings/risk-free-rate", json={"rate": 4.0})
    assert resp.status_code == 200
    assert resp.json()["rate"] == 4.0

    # 3. GET 다시 확인
    resp = client.get("/api/v1/performance/settings/risk-free-rate")
    assert resp.status_code == 200
    assert resp.json()["rate"] == 4.0


def test_asset_performance_calculation(db_session):
    """개별 지수/종목 수정종가 시계열 기반 Sharpe, Sortino, MDD 계산 테스트"""
    service = PerformanceService(db_session)
    service.set_risk_free_rate(3.5)
    
    # 10일간의 가격 시계열 생성 (상승 후 하락 패턴)
    base_date = date(2026, 1, 1)
    prices = [100.0, 102.0, 105.0, 103.0, 108.0, 106.0, 110.0, 107.0, 105.0, 112.0]
    
    for i, p in enumerate(prices):
        hp = HistoricalPrice(
            ticker="^KS11",
            price_date=base_date + timedelta(days=i),
            close_price=p
        )
        db_session.add(hp)
    db_session.commit()
    
    res = service.calculate_asset_performance("^KS11", period="Max")
    
    assert "sharpe_ratio" in res
    assert "sortino_ratio" in res
    assert "mdd" in res
    assert "max_mdd" in res
    assert "drawdown_series" in res
    assert isinstance(res["sharpe_ratio"], float)
    assert isinstance(res["sortino_ratio"], float)
    assert res["mdd"] <= 0.0
    assert res["max_mdd"] <= 0.0


def test_portfolio_twr_irregular_snapshots(db_session):
    """입출금이 포함된 불규칙 스냅샷 보간 TWR 및 성과 지표 테스트"""
    user = User(name="Test User")
    db_session.add(user)
    db_session.commit()
    
    account = Account(user_id=user.id, name="Test Account", provider="Test", alias="Test", account_type="BROKERAGE")
    db_session.add(account)
    db_session.commit()
    
    # 불규칙 간격 스냅샷 (1월 1일, 1월 10일, 1월 25일, 2월 10일)
    # 1/1: 자산 1,000,000, 입금 0
    # 1/10: 자산 1,100,000 (10% 수익), 입금 0
    # 1/25: 자산 1,650,000 (추가 500,000 입금 포함 -> 순자산 1,150,000), 입금 500,000
    # 2/10: 자산 1,500,000 (손실 발생), 입금 0
    snapshots = [
        AccountSnapshot(account_id=account.id, snapshot_date=date(2026, 1, 1), total_valuation=1000000, period_deposit=0),
        AccountSnapshot(account_id=account.id, snapshot_date=date(2026, 1, 10), total_valuation=1100000, period_deposit=0),
        AccountSnapshot(account_id=account.id, snapshot_date=date(2026, 1, 25), total_valuation=1650000, period_deposit=500000),
        AccountSnapshot(account_id=account.id, snapshot_date=date(2026, 2, 10), total_valuation=1500000, period_deposit=0),
    ]
    for s in snapshots:
        db_session.add(s)
    db_session.commit()
    
    service = PerformanceService(db_session)
    res = service.calculate_portfolio_performance(period="Max")
    
    assert "sharpe_ratio" in res
    assert "sortino_ratio" in res
    assert "mdd" in res
    assert "max_mdd" in res
    assert "drawdown_series" in res
    assert len(res["drawdown_series"]) > 0


def test_assets_batch_performance_calculation(db_session):
    """보유 종목 및 대표 지수의 일괄 위험조정 성과 지표 계산 서비스 테스트"""
    service = PerformanceService(db_session)
    service.set_risk_free_rate(3.5)

    base_date = date(2026, 1, 1)
    prices = [100.0, 102.0, 105.0, 103.0, 108.0, 106.0, 110.0, 107.0, 105.0, 112.0]
    for i, p in enumerate(prices):
        db_session.add(HistoricalPrice(ticker="^KS11", price_date=base_date + timedelta(days=i), close_price=p))
        db_session.add(HistoricalPrice(ticker="005930", price_date=base_date + timedelta(days=i), close_price=p * 500))
    db_session.commit()

    res = service.calculate_assets_batch_performance(period="Max")
    assert isinstance(res, list)
    assert len(res) >= 2
    tickers = [item["ticker"] for item in res]
    assert "^KS11" in tickers
    assert "005930" in tickers

    for item in res:
        assert "name" in item
        assert "asset_type" in item  # "benchmark" or "holding"
        assert "sharpe_ratio" in item
        assert "sortino_ratio" in item
        assert "mdd" in item
        assert "annualized_return" in item


def test_assets_batch_performance_api(db_session):
    """보유 종목 및 대표 지수의 일괄 성과 지표 REST API 테스트"""
    resp = client.get("/api/v1/performance/assets/batch?period=1Y")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)

