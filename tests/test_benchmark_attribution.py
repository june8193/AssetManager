# -*- coding: utf-8 -*-
"""벤치마크 다기간 성과 및 보유 종목 손익 기여도(Attribution) 서비스 및 API 테스트 모듈입니다."""

import datetime
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.backend.main import app
from src.backend.models import (
    User,
    Account,
    Asset,
    Transaction,
    AccountSnapshot,
    HistoricalPrice,
    ExchangeRate,
)
from src.backend.market import MarketDataProvider, MarketCalendar, FakeMarketAdapter
from src.backend.services.benchmark_service import BenchmarkService

client = TestClient(app)


@pytest.fixture(autouse=True)
def mock_external_market_adapters():
    """테스트 실행 중 외부 통신을 방지하기 위해 어댑터를 모킹합니다."""
    with patch("src.backend.market.adapters.yfinance.YahooFinanceAdapter.get_historical_prices", return_value=[]), \
         patch("src.backend.market.adapters.kiwoom.KiwoomAdapter.get_historical_prices", return_value=[]):
        yield


@pytest.fixture
def fake_market_provider(db_session: Session):
    """테스트용 FakeMarketAdapter가 설정된 MarketDataProvider를 제공합니다."""
    kr_adapter = FakeMarketAdapter()
    us_adapter = FakeMarketAdapter()
    return MarketDataProvider(
        db=db_session,
        calendar=MarketCalendar(),
        kr_adapter=kr_adapter,
        us_adapter=us_adapter
    )


@pytest.fixture
def benchmark_service(db_session: Session, fake_market_provider: MarketDataProvider):
    """테스트용 BenchmarkService 인스턴스를 제공합니다."""
    return BenchmarkService(db_session, provider=fake_market_provider)


@pytest.fixture
def setup_attribution_data(db_session: Session):
    """벤치마크 성과 및 기여도 계산 테스트를 위한 기초 데이터를 설정합니다."""
    as_of = datetime.date(2026, 9, 28)
    d_1m = as_of - datetime.timedelta(days=30)   # 2026-08-29
    d_3m = as_of - datetime.timedelta(days=90)   # 2026-06-30
    d_1y = as_of - datetime.timedelta(days=365)  # 2025-09-28
    d_ytd = datetime.date(as_of.year, 1, 1)      # 2026-01-01

    # 1. 사용자 및 활성 계좌 생성
    user = User(name="Attribution Test User")
    db_session.add(user)
    db_session.commit()

    account = Account(user_id=user.id, name="Attribution Account", provider="Test Bank", is_active=True)
    db_session.add(account)
    db_session.commit()

    # 2. 통화 자산 및 주식 종목 생성
    krw_asset = Asset(ticker="KRW", name="원화", country="KR", major_category="현금", sub_category="원화예수금")
    usd_asset = Asset(ticker="USD", name="달러", country="US", major_category="현금", sub_category="달러예수금")
    samsung = Asset(ticker="005930", name="삼성전자", country="KR", major_category="주식", sub_category="코어(지수)")
    skhynix = Asset(ticker="000660", name="SK하이닉스", country="KR", major_category="주식", sub_category="알파(성장)")
    googl = Asset(ticker="GOOGL", name="Alphabet Inc.", country="US", major_category="주식", sub_category="알파(성장)")
    nvda = Asset(ticker="NVDA", name="NVIDIA Corp.", country="US", major_category="주식", sub_category="알파(성장)")
    db_session.add_all([krw_asset, usd_asset, samsung, skhynix, googl, nvda])
    db_session.commit()

    # 환율 레코드 (1 USD = 1350 KRW)
    db_session.add(ExchangeRate(date=as_of, currency="USD", rate=1350.0))
    db_session.commit()

    # 3. 거래 내역 (BUY 거래로 보유 수량 생성: 1년 전 이전에 매수 완료된 상태)
    tx_base_date = datetime.date(2025, 1, 10)
    db_session.add(Transaction(
        account_id=account.id,
        asset_id=krw_asset.id,
        transaction_date=tx_base_date,
        type="INITIAL_BALANCE",
        total_amount=50000000.0,
        currency="KRW"
    ))
    db_session.add(Transaction(
        account_id=account.id,
        asset_id=usd_asset.id,
        transaction_date=tx_base_date,
        type="INITIAL_BALANCE",
        total_amount=50000.0,
        currency="USD"
    ))
    # 삼성전자 100주
    db_session.add(Transaction(
        account_id=account.id,
        asset_id=samsung.id,
        transaction_date=tx_base_date,
        type="BUY",
        quantity=100.0,
        price=60000.0,
        total_amount=6000000.0,
        currency="KRW"
    ))
    # SK하이닉스 50주
    db_session.add(Transaction(
        account_id=account.id,
        asset_id=skhynix.id,
        transaction_date=tx_base_date,
        type="BUY",
        quantity=50.0,
        price=120000.0,
        total_amount=6000000.0,
        currency="KRW"
    ))
    # GOOGL 100주
    db_session.add(Transaction(
        account_id=account.id,
        asset_id=googl.id,
        transaction_date=tx_base_date,
        type="BUY",
        quantity=100.0,
        price=100.0,
        total_amount=10000.0,
        currency="USD"
    ))
    # NVDA 50주
    db_session.add(Transaction(
        account_id=account.id,
        asset_id=nvda.id,
        transaction_date=tx_base_date,
        type="BUY",
        quantity=50.0,
        price=100.0,
        total_amount=5000.0,
        currency="USD"
    ))
    db_session.commit()

    # 4. 시세 데이터 (지수 3대: ^GSPC, ^IXIC, ^KS11 및 개별 종목 4개)
    # 날짜 목록: d_1y, d_3m, d_ytd, d_1m, as_of
    # 편의상 각 기간별 가격 정의
    # 지수 종가 정의
    # ^GSPC: 1Y(5000) -> 3M(5200) -> YTD(5100) -> 1M(5500) -> AsOf(5700)
    # ^IXIC: 1Y(16000) -> 3M(17000) -> YTD(16500) -> 1M(17500) -> AsOf(18000)
    # ^KS11: 1Y(2500) -> 3M(2600) -> YTD(2550) -> 1M(2650) -> AsOf(2700)
    index_prices = {
        "^GSPC": {d_1y: 5000.0, d_3m: 5200.0, d_ytd: 5100.0, d_1m: 5500.0, as_of: 5700.0},
        "^IXIC": {d_1y: 16000.0, d_3m: 17000.0, d_ytd: 16500.0, d_1m: 17500.0, as_of: 18000.0},
        "^KS11": {d_1y: 2500.0, d_3m: 2600.0, d_ytd: 2550.0, d_1m: 2650.0, as_of: 2700.0},
    }
    for ticker, date_map in index_prices.items():
        for d, p in date_map.items():
            db_session.add(HistoricalPrice(ticker=ticker, price_date=d, close_price=p))

    # 종목별 종가 정의 (현지통화)
    # GOOGL (USD): 1Y(100.0) -> 3M(140.0) -> YTD(120.0) -> 1M(160.0) -> AsOf(180.0)
    # NVDA (USD):  1Y(80.0)  -> 3M(100.0) -> YTD(90.0)  -> 1M(110.0) -> AsOf(120.0)
    # 005930 (KRW): 1Y(70000) -> 3M(72000) -> YTD(71000) -> 1M(73000) -> AsOf(75000)
    # 000660 (KRW): 1Y(130000) -> 3M(125000) -> YTD(140000) -> 1M(115000) -> AsOf(110000)  (하락 Detractor)
    stock_prices = {
        "GOOGL": {d_1y: 100.0, d_3m: 140.0, d_ytd: 120.0, d_1m: 160.0, as_of: 180.0},
        "NVDA": {d_1y: 80.0, d_3m: 100.0, d_ytd: 90.0, d_1m: 110.0, as_of: 120.0},
        "005930": {d_1y: 70000.0, d_3m: 72000.0, d_ytd: 71000.0, d_1m: 73000.0, as_of: 75000.0},
        "000660": {d_1y: 130000.0, d_3m: 125000.0, d_ytd: 140000.0, d_1m: 115000.0, as_of: 110000.0},
    }
    for ticker, date_map in stock_prices.items():
        for d, p in date_map.items():
            db_session.add(HistoricalPrice(ticker=ticker, price_date=d, close_price=p))

    # 5. 포트폴리오 스냅샷 (1Y, 3M, YTD, 1M, AsOf 시점)
    # 총 평가액 및 입출금
    snapshots = [
        (d_1y, 100000000.0, 100000000.0),
        (d_3m, 110000000.0, 0.0),
        (d_ytd, 105000000.0, 0.0),
        (d_1m, 115000000.0, 0.0),
        (as_of, 120000000.0, 0.0),
    ]
    for d, val, dep in snapshots:
        db_session.add(AccountSnapshot(
            account_id=account.id,
            snapshot_date=d,
            period_deposit=dep,
            total_valuation=val,
            total_profit=val - 100000000.0
        ))

    db_session.commit()
    return as_of


@pytest.mark.asyncio
async def test_get_attribution_summary_structure(benchmark_service: BenchmarkService, setup_attribution_data: datetime.date):
    """get_attribution_summary가 사양서 규격의 데이터 구조를 충실히 반환하는지 검증합니다."""
    as_of = setup_attribution_data

    result = await benchmark_service.get_attribution_summary(as_of_date=as_of)

    # 1. 최상위 키 검증
    assert "as_of_date" in result
    assert result["as_of_date"] == as_of.isoformat()
    assert "benchmarks" in result
    assert "top_contributors_ytd" in result
    assert "top_detractors_ytd" in result
    assert "top_contributors_1m" in result
    assert "top_detractors_1m" in result
    assert "holdings_attribution" in result

    # 2. 4개 기간 벤치마크 키 및 하위 필드 검증
    for period in ["1M", "3M", "1Y", "YTD"]:
        assert period in result["benchmarks"]
        b_data = result["benchmarks"][period]
        assert "portfolio" in b_data
        assert "sp500" in b_data
        assert "nasdaq" in b_data
        assert "kospi" in b_data
        assert "alpha_vs_sp500" in b_data
        # Alpha 정합성: portfolio - sp500
        assert b_data["alpha_vs_sp500"] == round(b_data["portfolio"] - b_data["sp500"], 2)


@pytest.mark.asyncio
async def test_attribution_holdings_and_contributions(benchmark_service: BenchmarkService, setup_attribution_data: datetime.date):
    """보유 종목별 비중, 주가 수익률 및 가중 손익 기여도(Attribution) 공식의 정합성을 검증합니다."""
    as_of = setup_attribution_data

    result = await benchmark_service.get_attribution_summary(as_of_date=as_of)

    holdings = result["holdings_attribution"]
    assert len(holdings) == 4  # GOOGL, NVDA, 005930, 000660

    for h in holdings:
        assert "ticker" in h
        assert "name" in h
        assert "weight" in h
        assert "valuation_krw" in h
        assert "returns" in h
        assert "contributions" in h

        # 4개 기간 returns & contributions 존재 검증
        for period in ["1M", "3M", "1Y", "YTD"]:
            assert period in h["returns"]
            assert period in h["contributions"]
            ret = h["returns"][period]
            contrib = h["contributions"][period]
            expected_contrib = round(h["weight"] * ret / 100.0, 2)
            assert contrib == pytest.approx(expected_contrib, abs=0.02)


@pytest.mark.asyncio
async def test_top_contributors_and_detractors_ranking(benchmark_service: BenchmarkService, setup_attribution_data: datetime.date):
    """Top 3 기여 종목 및 Bottom 3 부진 종목 랭킹의 올바른 정렬 및 추출을 검증합니다."""
    as_of = setup_attribution_data

    result = await benchmark_service.get_attribution_summary(as_of_date=as_of)

    # 1. YTD Top Contributors (내림차순, 최대 3개)
    top_ytd = result["top_contributors_ytd"]
    assert len(top_ytd) <= 3
    for i in range(len(top_ytd) - 1):
        assert top_ytd[i]["contribution"] >= top_ytd[i + 1]["contribution"]

    # 2. YTD Top Detractors (오름차순, 최대 3개)
    detractors_ytd = result["top_detractors_ytd"]
    assert len(detractors_ytd) <= 3
    for i in range(len(detractors_ytd) - 1):
        assert detractors_ytd[i]["contribution"] <= detractors_ytd[i + 1]["contribution"]

    # 000660은 주가가 하락했으므로 YTD 부진 종목 1위에 위치해야 함
    assert detractors_ytd[0]["ticker"] == "000660"
    assert detractors_ytd[0]["contribution"] < 0

    # GOOGL은 YTD 큰 상승률을 기록했으므로 YTD 기여 상위권에 위치해야 함
    top_tickers = [item["ticker"] for item in top_ytd]
    assert "GOOGL" in top_tickers


@pytest.mark.asyncio
async def test_attribution_api_endpoint(setup_attribution_data: datetime.date):
    """GET /api/benchmark/attribution REST API 엔드포인트의 HTTP 응답 및 as_of_date 파라미터를 검증합니다."""
    as_of_str = setup_attribution_data.isoformat()

    # 1. 쿼리 파라미터 포함 요청
    response = client.get(f"/api/benchmark/attribution?as_of_date={as_of_str}")
    assert response.status_code == 200
    data = response.json()
    assert data["as_of_date"] == as_of_str
    assert "benchmarks" in data
    assert "top_contributors_ytd" in data
    assert "top_detractors_ytd" in data
    assert "holdings_attribution" in data

    # 2. 기본값(생략) 요청
    resp_default = client.get("/api/benchmark/attribution")
    assert resp_default.status_code == 200
    default_data = resp_default.json()
    assert "benchmarks" in default_data


@pytest.mark.asyncio
async def test_attribution_empty_holdings(benchmark_service: BenchmarkService, db_session: Session):
    """보유 종목이 전혀 없는 신규/빈 계좌 환경에서 안전하게 빈 결과를 반환하는지 검증합니다."""
    today = datetime.date.today()
    result = await benchmark_service.get_attribution_summary(as_of_date=today)

    assert result["as_of_date"] == today.isoformat()
    assert result["benchmarks"] is not None
    assert result["holdings_attribution"] == []
    assert result["top_contributors_ytd"] == []
    assert result["top_detractors_ytd"] == []
    assert result["top_contributors_1m"] == []
    assert result["top_detractors_1m"] == []


@pytest.mark.asyncio
async def test_attribution_api_invalid_date_format():
    """as_of_date 형식이 올바르지 않은 경우 FastAPI 유효성 검사 에러(422)를 반환하는지 검증합니다."""
    response = client.get("/api/benchmark/attribution?as_of_date=invalid-date")
    assert response.status_code == 422

