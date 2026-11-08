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
    """보유 종목별 스키마(카테고리, 통화, 상태, 분리 손익, 3종 수익률 및 3종 기여도)의 완전성을 검증합니다."""
    as_of = setup_attribution_data

    result = await benchmark_service.get_attribution_summary(as_of_date=as_of)

    holdings = result["holdings_attribution"]
    assert len(holdings) == 4  # GOOGL, NVDA, 005930, 000660

    for h in holdings:
        # 기본 메타데이터 및 상태 검증
        assert "ticker" in h
        assert "name" in h
        assert "major_category" in h
        assert "sub_category" in h
        assert "currency" in h
        assert "status" in h
        assert h["status"] in ["HOLDING", "CLOSED"]
        assert "quantity" in h
        assert "weight" in h
        assert "valuation" in h
        assert "valuation_krw" in h

        # 손익 필드 (기본 통화 및 KRW 환산 보조)
        assert "capital_pnl" in h
        assert "dividend_pnl" in h
        assert "total_pnl" in h
        assert "capital_pnl_krw" in h
        assert "dividend_pnl_krw" in h
        assert "total_pnl_krw" in h

        # 3종 수익률 (%)
        assert "capital_returns" in h
        assert "returns" in h
        assert "price_returns" in h

        # 3종 기여도 (%p)
        assert "capital_contributions" in h
        assert "dividend_contributions" in h
        assert "contributions" in h

        # 4개 기간별 키 존재 및 불변식 검증
        for period in ["1M", "3M", "1Y", "YTD"]:
            assert period in h["capital_pnl"]
            assert period in h["dividend_pnl"]
            assert period in h["total_pnl"]
            assert period in h["capital_returns"]
            assert period in h["returns"]
            assert period in h["price_returns"]
            assert period in h["capital_contributions"]
            assert period in h["dividend_contributions"]
            assert period in h["contributions"]

            # 총 손익 = 자본 손익 + 배당 손익 불변식
            assert h["total_pnl"][period] == pytest.approx(
                h["capital_pnl"][period] + h["dividend_pnl"][period], abs=0.01
            )


@pytest.mark.asyncio
async def test_scenario_unheld_period_gain_exclusion(benchmark_service: BenchmarkService, db_session: Session):
    """시나리오 1: 기간 중 신규 매수 시 미보유 기간 주가 급등이 배제되고 실제 매수 이후의 손익만 반영되는지 검증합니다."""
    as_of = datetime.date(2026, 9, 28)
    d_ytd = datetime.date(2026, 1, 1)
    d_buy = datetime.date(2026, 7, 1)

    user = User(name="Scenario 1 User")
    db_session.add(user)
    db_session.commit()
    account = Account(user_id=user.id, name="Acc 1", provider="Bank", is_active=True)
    db_session.add(account)
    db_session.commit()

    krw_asset = Asset(ticker="KRW", name="원화", country="KR", major_category="현금", sub_category="원화예수금")
    stock_a = Asset(ticker="005935", name="신규매수주", country="KR", major_category="주식", sub_category="알파(성장)")
    db_session.add_all([krw_asset, stock_a])
    db_session.commit()

    db_session.add(Transaction(
        account_id=account.id, asset_id=krw_asset.id, transaction_date=d_ytd,
        type="INITIAL_BALANCE", total_amount=10000000.0, currency="KRW"
    ))
    db_session.add(Transaction(
        account_id=account.id, asset_id=stock_a.id, transaction_date=d_buy,
        type="BUY", quantity=100.0, price=20000.0, total_amount=2000000.0, currency="KRW"
    ))
    db_session.commit()

    db_session.add(HistoricalPrice(ticker="005935", price_date=d_ytd, close_price=10000.0))
    db_session.add(HistoricalPrice(ticker="005935", price_date=d_buy, close_price=20000.0))
    db_session.add(HistoricalPrice(ticker="005935", price_date=as_of, close_price=18000.0))
    db_session.commit()

    result = await benchmark_service.get_attribution_summary(as_of_date=as_of)
    h_a = next(item for item in result["holdings_attribution"] if item["ticker"] == "005935")

    # 시장 주가 등락률(price_returns)은 10,000 -> 18,000으로 +80%
    assert h_a["price_returns"]["YTD"] == 80.0
    # 내 포지션 자본 손익: 기말(1,800,000) - 기초(0) - 매수(2,000,000) = -200,000원
    assert h_a["capital_pnl"]["YTD"] == -200000.0
    assert h_a["total_pnl"]["YTD"] == -200000.0
    # 내 포지션 수익률은 -10.0%
    assert h_a["capital_returns"]["YTD"] == -10.0
    assert h_a["returns"]["YTD"] == -10.0
    # 기여도는 음수(-)
    assert h_a["contributions"]["YTD"] < 0


@pytest.mark.asyncio
async def test_scenario_partial_buy_and_sell(benchmark_service: BenchmarkService, db_session: Session):
    """시나리오 2: 기간 중 분할 매수 및 일부 매도가 발생했을 때 실제 손익과 수익률이 정합하게 산출되는지 검증합니다."""
    as_of = datetime.date(2026, 9, 28)
    d_start = as_of - datetime.timedelta(days=30)  # 1M: 2026-08-29

    user = User(name="Scenario 2 User")
    db_session.add(user)
    db_session.commit()
    account = Account(user_id=user.id, name="Acc 2", provider="Bank", is_active=True)
    db_session.add(account)
    db_session.commit()

    stock_b = Asset(ticker="035420", name="분할매매주", country="KR", major_category="주식", sub_category="코어(지수)")
    db_session.add(stock_b)
    db_session.commit()

    # 1. 기초(2026-08-01) 10주 매수 보유 (기초 이전 매수)
    db_session.add(Transaction(
        account_id=account.id, asset_id=stock_b.id, transaction_date=datetime.date(2026, 8, 1),
        type="BUY", quantity=10.0, price=1000.0, total_amount=10000.0, currency="KRW"
    ))
    # 2. 1M 기간 내 추가 매수: 10주 @ 1,200원 (총 12,000원) on 2026-09-05
    db_session.add(Transaction(
        account_id=account.id, asset_id=stock_b.id, transaction_date=datetime.date(2026, 9, 5),
        type="BUY", quantity=10.0, price=1200.0, total_amount=12000.0, currency="KRW"
    ))
    # 3. 1M 기간 내 일부 매도: 5주 @ 1,500원 (총 7,500원) on 2026-09-15
    db_session.add(Transaction(
        account_id=account.id, asset_id=stock_b.id, transaction_date=datetime.date(2026, 9, 15),
        type="SELL", quantity=5.0, price=1500.0, total_amount=7500.0, currency="KRW"
    ))
    db_session.commit()

    # 시세: d_start 종가 1,000원, as_of 종가 1,400원
    db_session.add(HistoricalPrice(ticker="035420", price_date=d_start, close_price=1000.0))
    db_session.add(HistoricalPrice(ticker="035420", price_date=as_of, close_price=1400.0))
    db_session.commit()

    result = await benchmark_service.get_attribution_summary(as_of_date=as_of)
    h_b = next(item for item in result["holdings_attribution"] if item["ticker"] == "035420")

    # 기말 잔고: 10 + 10 - 5 = 15주. 기말 종가 1,400원 -> 기말평가액 21,000원
    assert h_b["quantity"] == 15.0
    assert h_b["valuation"] == 21000.0
    assert h_b["status"] == "HOLDING"

    # 기초평가액 = 10 * 1,000 = 10,000원
    # 자본손익 = 21,000 - 10,000 - (12,000 - 7,500) = 11,000 - 4,500 = 6,500원
    assert h_b["capital_pnl"]["1M"] == 6500.0
    # 투입원금 = 기초평가액(10,000) + 추가매수(12,000) = 22,000원
    # capital_returns = 6,500 / 22,000 * 100 = 29.55%
    assert h_b["capital_returns"]["1M"] == 29.55


@pytest.mark.asyncio
async def test_scenario_closed_position_included(benchmark_service: BenchmarkService, db_session: Session):
    """시나리오 3: 기간 중 전량 매도(CLOSED)된 종목이 holdings_attribution 및 Top Detractors 랭킹에 정상 포함되는지 검증합니다."""
    as_of = datetime.date(2026, 9, 28)
    d_1m = as_of - datetime.timedelta(days=30)

    user = User(name="Scenario 3 User")
    db_session.add(user)
    db_session.commit()
    account = Account(user_id=user.id, name="Acc 3", provider="Bank", is_active=True)
    db_session.add(account)
    db_session.commit()

    closed_stock = Asset(ticker="069500", name="KODEX200", country="KR", major_category="주식", sub_category="코어(지수)")
    holding_stock = Asset(ticker="005930", name="삼성전자", country="KR", major_category="주식", sub_category="코어(지수)")
    db_session.add_all([closed_stock, holding_stock])
    db_session.commit()

    # 1. holding_stock 보유 중
    db_session.add(Transaction(
        account_id=account.id, asset_id=holding_stock.id, transaction_date=d_1m,
        type="BUY", quantity=10.0, price=70000.0, total_amount=700000.0, currency="KRW"
    ))
    # 2. closed_stock: 1M 기간 내 2026-09-01에 10주 @ 50,000원(500,000원) 매수 후 2026-09-20에 10주 @ 30,000원(300,000원) 전량 매도
    db_session.add(Transaction(
        account_id=account.id, asset_id=closed_stock.id, transaction_date=datetime.date(2026, 9, 1),
        type="BUY", quantity=10.0, price=50000.0, total_amount=500000.0, currency="KRW"
    ))
    db_session.add(Transaction(
        account_id=account.id, asset_id=closed_stock.id, transaction_date=datetime.date(2026, 9, 20),
        type="SELL", quantity=10.0, price=30000.0, total_amount=300000.0, currency="KRW"
    ))
    db_session.commit()

    db_session.add(HistoricalPrice(ticker="069500", price_date=d_1m, close_price=50000.0))
    db_session.add(HistoricalPrice(ticker="069500", price_date=as_of, close_price=30000.0))
    db_session.add(HistoricalPrice(ticker="005930", price_date=d_1m, close_price=70000.0))
    db_session.add(HistoricalPrice(ticker="005930", price_date=as_of, close_price=75000.0))
    db_session.commit()

    result = await benchmark_service.get_attribution_summary(as_of_date=as_of)
    h_closed = next(item for item in result["holdings_attribution"] if item["ticker"] == "069500")

    # 전량 매도 종목 속성 검증
    assert h_closed["status"] == "CLOSED"
    assert h_closed["quantity"] == 0.0
    assert h_closed["weight"] == 0.0
    assert h_closed["valuation"] == 0.0
    assert h_closed["valuation_krw"] == 0
    # 손익: 0 - 0 - (500,000 - 300,000) = -200,000원
    assert h_closed["capital_pnl"]["1M"] == -200000.0
    assert h_closed["capital_returns"]["1M"] == -40.0

    # 1M Top Detractors에 포함되어 있어야 함
    detractor_tickers = [item["ticker"] for item in result["top_detractors_1m"]]
    assert "069500" in detractor_tickers


@pytest.mark.asyncio
async def test_scenario_dividend_pnl_separation(benchmark_service: BenchmarkService, db_session: Session):
    """시나리오 4: 자본 손익과 세후 배당/이자 손익이 정확히 분리되고 총 손익/기여도에 합산되는지 검증합니다."""
    as_of = datetime.date(2026, 9, 28)
    d_1m = as_of - datetime.timedelta(days=30)

    user = User(name="Scenario 4 User")
    db_session.add(user)
    db_session.commit()
    account = Account(user_id=user.id, name="Acc 4", provider="Bank", is_active=True)
    db_session.add(account)
    db_session.commit()

    div_stock = Asset(ticker="O", name="Realty Income", country="US", major_category="주식", sub_category="알파(성장)")
    db_session.add(div_stock)
    db_session.commit()

    # 환율
    db_session.add(ExchangeRate(date=as_of, currency="USD", rate=1300.0))

    # 기초 이전 매수: 100주 @ 50 USD
    db_session.add(Transaction(
        account_id=account.id, asset_id=div_stock.id, transaction_date=datetime.date(2026, 8, 1),
        type="BUY", quantity=100.0, price=50.0, total_amount=5000.0, currency="USD"
    ))
    # 1M 기간 내 배당금 수령: INTEREST 50 USD, TAX 7.5 USD (USD)
    db_session.add(Transaction(
        account_id=account.id, asset_id=div_stock.id, transaction_date=datetime.date(2026, 9, 10),
        type="INTEREST", total_amount=50.0, currency="USD"
    ))
    db_session.add(Transaction(
        account_id=account.id, asset_id=div_stock.id, transaction_date=datetime.date(2026, 9, 10),
        type="TAX", total_amount=7.5, currency="USD"
    ))
    db_session.commit()

    # 주가는 50.0으로 변동 없음 (자본 손익 = 0)
    db_session.add(HistoricalPrice(ticker="O", price_date=d_1m, close_price=50.0))
    db_session.add(HistoricalPrice(ticker="O", price_date=as_of, close_price=50.0))
    db_session.commit()

    result = await benchmark_service.get_attribution_summary(as_of_date=as_of)
    h_o = next(item for item in result["holdings_attribution"] if item["ticker"] == "O")

    # 기본 통화(USD) 기준 검증
    assert h_o["capital_pnl"]["1M"] == 0.0
    assert h_o["dividend_pnl"]["1M"] == 42.5  # 50 - 7.5
    assert h_o["total_pnl"]["1M"] == 42.5
    assert h_o["capital_returns"]["1M"] == 0.0
    # returns: 42.5 / 5000 * 100 = 0.85%
    assert h_o["returns"]["1M"] == 0.85

    # 원화 보조 지표 검증 (환율 1300)
    assert h_o["dividend_pnl_krw"]["1M"] == round(42.5 * 1300.0)
    assert h_o["total_pnl_krw"]["1M"] == round(42.5 * 1300.0)
    assert h_o["dividend_contributions"]["1M"] > 0
    assert h_o["contributions"]["1M"] == h_o["dividend_contributions"]["1M"]


@pytest.mark.asyncio
async def test_scenario_us_stock_usd_and_krw_auxiliary(benchmark_service: BenchmarkService, db_session: Session):
    """시나리오 5: 미국 종목(USD)의 기본 지표는 환율 개입 없이 순수 USD이고, 보조 지표에만 기준일 환율이 적용되는지 검증합니다."""
    as_of = datetime.date(2026, 9, 28)
    d_1m = as_of - datetime.timedelta(days=30)

    user = User(name="Scenario 5 User")
    db_session.add(user)
    db_session.commit()
    account = Account(user_id=user.id, name="Acc 5", provider="Bank", is_active=True)
    db_session.add(account)
    db_session.commit()

    aapl = Asset(ticker="AAPL", name="Apple Inc.", country="US", major_category="주식", sub_category="알파(성장)")
    db_session.add(aapl)
    # 환율: 1 USD = 1400 KRW
    db_session.add(ExchangeRate(date=as_of, currency="USD", rate=1400.0))
    db_session.commit()

    # 기초에 10주 보유 (종가 150 -> 1500 USD)
    db_session.add(Transaction(
        account_id=account.id, asset_id=aapl.id, transaction_date=datetime.date(2026, 8, 1),
        type="BUY", quantity=10.0, price=150.0, total_amount=1500.0, currency="USD"
    ))
    db_session.commit()

    # 1M: 150 -> 180 (+30 USD per share, 총 +300 USD)
    db_session.add(HistoricalPrice(ticker="AAPL", price_date=d_1m, close_price=150.0))
    db_session.add(HistoricalPrice(ticker="AAPL", price_date=as_of, close_price=180.0))
    db_session.commit()

    result = await benchmark_service.get_attribution_summary(as_of_date=as_of)
    h_aapl = next(item for item in result["holdings_attribution"] if item["ticker"] == "AAPL")

    assert h_aapl["currency"] == "USD"
    assert h_aapl["capital_pnl"]["1M"] == 300.0
    assert h_aapl["total_pnl"]["1M"] == 300.0
    assert h_aapl["capital_returns"]["1M"] == 20.0  # 300 / 1500 * 100
    assert h_aapl["returns"]["1M"] == 20.0
    assert h_aapl["price_returns"]["1M"] == 20.0

    # 원화 보조 지표 검증 (환율 1400)
    assert h_aapl["capital_pnl_krw"]["1M"] == 300 * 1400  # 420,000 KRW
    assert h_aapl["total_pnl_krw"]["1M"] == 300 * 1400



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

    # 3. 랭킹 아이템 스키마 검증
    for item in top_ytd + detractors_ytd:
        assert "ticker" in item
        assert "name" in item
        assert "major_category" in item
        assert "sub_category" in item
        assert "currency" in item
        assert "status" in item
        assert "weight" in item
        assert "capital_pnl" in item
        assert "dividend_pnl" in item
        assert "total_pnl" in item
        assert "total_pnl_krw" in item
        assert "capital_return" in item
        assert "return" in item
        assert "price_return" in item
        assert "capital_contribution" in item
        assert "dividend_contribution" in item
        assert "contribution" in item

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

