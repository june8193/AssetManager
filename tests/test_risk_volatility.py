# -*- coding: utf-8 -*-
"""포트폴리오 내재 변동성 API(`GET /api/v1/risk/volatility`) 통합 테스트 모듈."""

import datetime
import math
import numpy as np
import pytest

from src.backend.main import app
from src.backend.models import User, Account, Asset, Transaction, ExchangeRate, HistoricalPrice
from src.backend.market import MarketDataProvider, FakeMarketAdapter
from src.backend.routers.risk import get_market_provider


def _build_trading_series(
    start_price: float,
    daily_returns: list[float],
    end_date: datetime.date,
) -> dict[datetime.date, float]:
    """주어진 일별 수익률 리스트를 바탕으로 평일 기준 가격 시계열을 생성합니다."""
    dates: list[datetime.date] = []
    cur = end_date
    needed = len(daily_returns) + 1
    while len(dates) < needed:
        if cur.weekday() < 5:
            dates.append(cur)
        cur -= datetime.timedelta(days=1)
    dates.reverse()

    series: dict[datetime.date, float] = {}
    price = start_price
    series[dates[0]] = round(price, 4)
    for idx, ret in enumerate(daily_returns):
        price = price * (1.0 + ret)
        series[dates[idx + 1]] = round(price, 4)
    return series


@pytest.fixture
def risk_test_env(db_session):
    """원장 보유 자산, 시세, 휴장일 센티널, 비보유 캐시 티커가 포함된 테스트 환경을 구성합니다."""
    today = datetime.date.today()

    user = User(name="리스크테스터")
    db_session.add(user)
    db_session.commit()

    account = Account(user_id=user.id, name="테스트계좌", provider="키움증권", is_active=True)
    db_session.add(account)
    db_session.commit()

    krw = Asset(ticker="KRW", name="원화예수금", major_category="현금", sub_category="원화예수금", country="KR")
    usd = Asset(ticker="USD", name="달러예수금", major_category="현금", sub_category="달러예수금", country="US")
    aapl = Asset(ticker="AAPL", name="Apple Inc.", major_category="주식", sub_category="알파(성장)", country="US")
    samsung = Asset(ticker="005930", name="삼성전자", major_category="주식", sub_category="코어(지수)", country="KR")
    db_session.add_all([krw, usd, aapl, samsung])
    db_session.commit()

    db_session.add(ExchangeRate(date=today, currency="USD", rate=1400.0))
    db_session.commit()

    # 입금 및 매수: 원화 1,400,000원, 달러 1,000달러 -> AAPL 5주, 삼성전자 10주 보유
    txs = [
        Transaction(
            account_id=account.id, asset_id=krw.id,
            transaction_date=today - datetime.timedelta(days=10),
            type="DEPOSIT", quantity=2100000.0, price=1.0, total_amount=2100000.0, currency="KRW",
        ),
        Transaction(
            account_id=account.id, asset_id=usd.id,
            transaction_date=today - datetime.timedelta(days=10),
            type="DEPOSIT", quantity=2000.0, price=1.0, total_amount=2000.0, currency="USD",
        ),
        Transaction(
            account_id=account.id, asset_id=samsung.id,
            transaction_date=today - datetime.timedelta(days=5),
            type="BUY", quantity=10.0, price=70000.0, total_amount=700000.0, currency="KRW",
        ),
        Transaction(
            account_id=account.id, asset_id=aapl.id,
            transaction_date=today - datetime.timedelta(days=5),
            type="BUY", quantity=5.0, price=200.0, total_amount=1000.0, currency="USD",
        ),
    ]
    db_session.add_all(txs)
    db_session.commit()

    # 비보유 시세 캐시 티커 (TSLA) 및 휴장일 센티널 (close_price <= 0) 삽입
    db_session.add_all([
        HistoricalPrice(ticker="TSLA", price_date=today - datetime.timedelta(days=2), close_price=250.0),
        HistoricalPrice(ticker="TSLA", price_date=today - datetime.timedelta(days=1), close_price=255.0),
        HistoricalPrice(ticker="AAPL", price_date=today - datetime.timedelta(days=3), close_price=0.0),
        HistoricalPrice(ticker="005930", price_date=today - datetime.timedelta(days=3), close_price=-1.0),
    ])
    db_session.commit()

    adapter = FakeMarketAdapter()
    adapter.set_exchange_rate(1400.0, "USD", "KRW")
    adapter.set_current_price("AAPL", 200.0, 0.5)
    adapter.set_current_price("005930", 70000.0, 1.0)
    adapter.set_stock_name("QQQ", "Invesco QQQ Trust")

    aapl_rets = [0.01, -0.02, 0.015, -0.005, 0.02, -0.01, 0.012, -0.008, 0.018, -0.012]
    sam_rets = [0.005, -0.01, 0.008, -0.004, 0.012, -0.006, 0.009, -0.003, 0.011, -0.007]
    sp500_rets = [0.008, -0.012, 0.01, -0.003, 0.011, -0.007, 0.009, -0.005, 0.010, -0.006]
    nasdaq_rets = [0.012, -0.018, 0.016, -0.006, 0.017, -0.011, 0.014, -0.009, 0.015, -0.010]
    kospi_rets = [0.006, -0.011, 0.009, -0.005, 0.010, -0.008, 0.007, -0.004, 0.009, -0.006]
    qqq_rets = [0.011, -0.017, 0.015, -0.005, 0.016, -0.010, 0.013, -0.008, 0.014, -0.009]

    aapl_series = _build_trading_series(200.0, aapl_rets, today)
    sam_series = _build_trading_series(70000.0, sam_rets, today)
    adapter.set_current_price("AAPL", aapl_series[max(aapl_series.keys())], 0.5)
    adapter.set_current_price("005930", sam_series[max(sam_series.keys())], 1.0)
    adapter.set_historical_prices("AAPL", aapl_series)
    adapter.set_historical_prices("005930", sam_series)
    adapter.set_historical_prices("^GSPC", _build_trading_series(5000.0, sp500_rets, today))
    adapter.set_historical_prices("^IXIC", _build_trading_series(16000.0, nasdaq_rets, today))
    adapter.set_historical_prices("^KS11", _build_trading_series(2600.0, kospi_rets, today))
    adapter.set_historical_prices("QQQ", _build_trading_series(450.0, qqq_rets, today))

    provider = MarketDataProvider(db=db_session, kr_adapter=adapter, us_adapter=adapter)
    app.dependency_overrides[get_market_provider] = lambda: provider
    yield adapter, provider
    app.dependency_overrides.pop(get_market_provider, None)


def test_risk_volatility_basic_contract_and_invariants(client, risk_test_env):
    """기본 API 응답 스키마, 현금 0 처리, 휴장일 센티널 및 비보유 종목 제외, PSD/오일러 불변식을 검증합니다."""
    resp = client.get("/api/v1/risk/volatility?period=1Y")
    assert resp.status_code == 200
    data = resp.json()

    assert data["period"] == "1Y"
    assert "as_of_date" in data
    # 원화 잔고 1,400,000 + 달러 잔고 1,000*1400 (1,400,000) + 삼성 10*종가 + AAPL 5*종가*1400
    adapter, _ = risk_test_env
    expected_total = (
        2800000.0
        + 10.0 * adapter._current_prices["005930"]["current_price"]
        + 5.0 * adapter._current_prices["AAPL"]["current_price"] * 1400.0
    )
    assert data["total_valuation_krw"] == pytest.approx(expected_total, rel=1e-4)

    portfolio = data["portfolio"]
    assert portfolio["annualized_volatility"] > 0.0
    # -100% 오염이 있었다면 연율화 변동성이 수백 %로 폭증했을 것임
    assert portfolio["annualized_volatility"] < 100.0
    expected_daily_pct = portfolio["annualized_volatility"] / math.sqrt(252)
    assert portfolio["daily_volatility_pct"] == pytest.approx(expected_daily_pct, abs=0.05)
    assert portfolio["daily_volatility_krw"] == pytest.approx(
        data["total_valuation_krw"] * (portfolio["daily_volatility_pct"] / 100.0),
        rel=0.02,
    )

    benchmarks = data["benchmarks"]
    assert set(benchmarks.keys()) == {"sp500", "nasdaq", "kospi"}
    assert benchmarks["sp500"]["ticker"] == "^GSPC"
    assert benchmarks["nasdaq"]["ticker"] == "^IXIC"
    assert benchmarks["kospi"]["ticker"] == "^KS11"
    assert benchmarks["sp500"]["max_mdd"] <= 0.0

    assets = data["assets"]
    tickers = [a["ticker"] for a in assets]
    assert "TSLA" not in tickers
    assert "CASH" in tickers
    assert "AAPL" in tickers
    assert "005930" in tickers

    cash_item = next(a for a in assets if a["ticker"] == "CASH")
    assert cash_item["is_cash"] is True
    assert cash_item["valuation_krw"] == pytest.approx(2800000.0, rel=1e-4)
    assert cash_item["annualized_volatility"] == 0.0
    assert cash_item["component_volatility"] == 0.0
    assert cash_item["volatility_share"] == 0.0

    # 오일러 위험 기여도 합산 불변식
    assert sum(a["volatility_share"] for a in assets) == pytest.approx(100.0, abs=0.2)
    assert sum(a["component_volatility"] for a in assets) == pytest.approx(
        portfolio["annualized_volatility"], abs=0.1
    )

    # 공분산 행렬 PSD 및 CASH 행/열 0 검증
    cov = np.array(data["covariance_matrix"], dtype=float)
    assert cov.shape == (len(assets), len(assets))
    cash_idx = tickers.index("CASH")
    assert np.allclose(cov[cash_idx, :], 0.0)
    assert np.allclose(cov[:, cash_idx], 0.0)
    eigenvalues = np.linalg.eigvalsh(cov)
    assert np.all(eigenvalues >= -1e-7)

    # 낙폭 비교 시계열 검증
    dd = data["drawdown_comparison"]
    assert len(dd["dates"]) > 0
    assert len(dd["portfolio_current"]) == len(dd["dates"])
    assert len(dd["benchmarks"]["sp500"]) == len(dd["dates"])
    assert set(dd["asset_daily_returns"].keys()) == set(tickers)
    assert all(v == 0.0 for v in dd["asset_daily_returns"]["CASH"])


def test_risk_volatility_single_index_tracking_consistency(client, db_session):
    """단일 지수 추종 자산(VOO 100%) 보유 시 S&P 500 벤치마크와 동일한 변동성 잣대로 계산되는지 검증합니다."""
    today = datetime.date.today()
    user = User(name="인덱스테스터")
    db_session.add(user)
    db_session.commit()
    account = Account(user_id=user.id, name="미국계좌", provider="키움증권", is_active=True)
    db_session.add(account)
    db_session.commit()

    usd = Asset(ticker="USD", name="달러예수금", major_category="현금", sub_category="달러예수금", country="US")
    voo = Asset(ticker="VOO", name="Vanguard S&P 500 ETF", major_category="주식", sub_category="코어(지수)", country="US")
    db_session.add_all([usd, voo])
    db_session.commit()
    db_session.add(ExchangeRate(date=today, currency="USD", rate=1400.0))
    db_session.commit()

    db_session.add_all([
        Transaction(
            account_id=account.id, asset_id=usd.id,
            transaction_date=today - datetime.timedelta(days=10),
            type="DEPOSIT", quantity=5000.0, price=1.0, total_amount=5000.0, currency="USD",
        ),
        Transaction(
            account_id=account.id, asset_id=voo.id,
            transaction_date=today - datetime.timedelta(days=5),
            type="BUY", quantity=10.0, price=500.0, total_amount=5000.0, currency="USD",
        ),
    ])
    db_session.commit()

    adapter = FakeMarketAdapter()
    adapter.set_exchange_rate(1400.0, "USD", "KRW")
    adapter.set_current_price("VOO", 500.0, 0.0)
    rets = [0.01, -0.015, 0.012, -0.008, 0.02, -0.01, 0.007, -0.005]
    adapter.set_historical_prices("VOO", _build_trading_series(500.0, rets, today))
    adapter.set_historical_prices("^GSPC", _build_trading_series(5000.0, rets, today))
    adapter.set_historical_prices("^IXIC", _build_trading_series(16000.0, rets, today))
    adapter.set_historical_prices("^KS11", _build_trading_series(2600.0, rets, today))

    provider = MarketDataProvider(db=db_session, kr_adapter=adapter, us_adapter=adapter)
    app.dependency_overrides[get_market_provider] = lambda: provider
    try:
        resp = client.get("/api/v1/risk/volatility?period=1Y")
        assert resp.status_code == 200
        data = resp.json()
        assert data["portfolio"]["annualized_volatility"] == pytest.approx(
            data["benchmarks"]["sp500"]["annualized_volatility"], abs=0.05
        )
        assert data["portfolio"]["sp500_ratio"] == pytest.approx(1.0, abs=0.02)
    finally:
        app.dependency_overrides.pop(get_market_provider, None)


def test_risk_volatility_period_and_extra_tickers(client, risk_test_env):
    """period 전환(1M/3M/1Y) 및 extra_tickers 편입, 잘못된 period 입력 422 처리를 검증합니다."""
    resp_1m = client.get("/api/v1/risk/volatility?period=1M&extra_tickers=QQQ")
    assert resp_1m.status_code == 200
    data = resp_1m.json()
    assert data["period"] == "1M"

    qqq = next((a for a in data["assets"] if a["ticker"] == "QQQ"), None)
    assert qqq is not None
    assert qqq["is_added"] is True
    assert qqq["is_cash"] is False
    assert qqq["valuation_krw"] == 0.0
    assert qqq["weight"] == 0.0
    assert qqq["volatility_share"] == 0.0
    assert qqq["annualized_volatility"] > 0.0
    assert "QQQ" in data["drawdown_comparison"]["asset_daily_returns"]

    bad_resp = client.get("/api/v1/risk/volatility?period=6M")
    assert bad_resp.status_code == 422


def test_risk_volatility_psd_projection_with_asynchronous_dates(client, db_session):
    """비동기 영업일 결측으로 non-PSD가 될 수 있는 상황에서도 공분산 행렬이 PSD를 만족하는지 검증합니다."""
    from src.backend.services.risk_service import _project_to_psd

    # 의도적으로 음수 고유값을 갖는 대칭 행렬 구성 (현금 0번 + 자산 1, 2)
    non_psd = np.array([
        [0.0, 0.0, 0.0],
        [0.0, 100.0, 150.0],
        [0.0, 150.0, 100.0],
    ])
    assert np.min(np.linalg.eigvalsh(non_psd)) < 0.0

    psd = _project_to_psd(non_psd, cash_index=0)
    assert np.all(np.linalg.eigvalsh(psd) >= -1e-9)
    assert np.allclose(psd[0, :], 0.0)
    assert np.allclose(psd[:, 0], 0.0)
    w = np.array([0.2, 0.5, -0.3])
    assert float(w @ psd @ w) >= 0.0


def test_legacy_performance_routes_removed(client):
    """구버전 /api/v1/performance/* 엔드포인트가 완전히 제거되어 404를 반환하는지 검증합니다."""
    for method, path in [
        ("GET", "/api/v1/performance/portfolio"),
        ("GET", "/api/v1/performance/assets/batch"),
        ("GET", "/api/v1/performance/asset/005930"),
        ("GET", "/api/v1/performance/settings/risk-free-rate"),
        ("PUT", "/api/v1/performance/settings/risk-free-rate"),
    ]:
        resp = client.request(method, path)
        assert resp.status_code == 404, f"{method} {path} returned {resp.status_code}"
