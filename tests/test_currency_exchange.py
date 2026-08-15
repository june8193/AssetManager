"""환전(EXCHANGE) 트랜잭션 타입 지원 기능에 대한 단위 및 통합 테스트 모듈입니다."""

import pytest
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from src.backend.models import Base, User, Account, Asset, Transaction, ExchangeRate
from src.backend.services.portfolio_service import get_portfolio_status
from src.backend.main import app
from src.backend.database import get_db
from sqlalchemy.pool import StaticPool

@pytest.fixture(autouse=True)
def setup_exchange_data(db_session):
    """테스트용 기본 사용자, 계좌, 자산 데이터를 생성합니다."""
    user = User(name="테스터")
    db_session.add(user)
    db_session.commit()

    account = Account(user_id=user.id, name="5526-9093", provider="KB증권", alias="주식계좌")
    db_session.add(account)
    db_session.commit()

    krw_asset = Asset(ticker="KRW", name="원화예수금", major_category="현금", sub_category="원화예수금", country="KR")
    usd_asset = Asset(ticker="USD", name="달러예수금", major_category="현금", sub_category="달러예수금", country="US")
    db_session.add_all([krw_asset, usd_asset])
    db_session.commit()

    ex_rate = ExchangeRate(date=datetime.date(2026, 5, 1), currency="USD", rate=1350.0)
    db_session.add(ex_rate)
    db_session.commit()


def test_transaction_model_supports_target_asset_id_and_exchange_type(db_session):
    """Transaction 모델이 target_asset_id 컬럼 및 EXCHANGE 타입을 지원하는지 테스트합니다."""
    krw = db_session.query(Asset).filter_by(ticker="KRW").first()
    usd = db_session.query(Asset).filter_by(ticker="USD").first()
    account = db_session.query(Account).first()

    tx = Transaction(
        account_id=account.id,
        asset_id=krw.id,
        target_asset_id=usd.id,
        transaction_date=datetime.date(2026, 5, 1),
        type="EXCHANGE",
        quantity=1000.0,
        price=1350.0,
        total_amount=1350000.0,
        currency="KRW",
        exchange_rate=1350.0,
        memo="원화 135만 원 -> 달러 $1000 환전"
    )
    db_session.add(tx)
    db_session.commit()

    saved_tx = db_session.query(Transaction).filter_by(id=tx.id).first()
    assert saved_tx is not None
    assert saved_tx.type == "EXCHANGE"
    assert saved_tx.target_asset_id == usd.id


@pytest.mark.asyncio
async def test_portfolio_service_handles_currency_exchange(db_session):
    """EXCHANGE 트랜잭션 발생 시 KRW 차감 및 USD 가산이 정확하게 이루어지는지 테스트합니다."""
    krw = db_session.query(Asset).filter_by(ticker="KRW").first()
    usd = db_session.query(Asset).filter_by(ticker="USD").first()
    account = db_session.query(Account).first()

    # 1. 초기 입금: 2,000,000 KRW
    tx_init = Transaction(
        account_id=account.id,
        asset_id=krw.id,
        transaction_date=datetime.date(2026, 5, 1),
        type="INITIAL_BALANCE",
        quantity=2000000.0,
        price=1.0,
        total_amount=2000000.0,
        currency="KRW"
    )
    db_session.add(tx_init)

    # 2. 환전: 1,350,000 KRW -> $1,000 USD
    tx_exchange = Transaction(
        account_id=account.id,
        asset_id=krw.id,
        target_asset_id=usd.id,
        transaction_date=datetime.date(2026, 5, 2),
        type="EXCHANGE",
        quantity=1000.0,
        price=1350.0,
        total_amount=1350000.0,
        currency="KRW",
        exchange_rate=1350.0
    )
    db_session.add(tx_exchange)
    db_session.commit()

    portfolio = await get_portfolio_status(db_session, date_str="2026-05-02")
    cash_balances = portfolio.get("cash_balances", {})

    assert cash_balances.get("KRW") == 650000.0  # 2,000,000 - 1,350,000
    assert cash_balances.get("USD") == 1000.0    # 0 + 1,000


def test_api_create_exchange_transaction_success(client, db_session):
    """API를 통해 EXCHANGE 트랜잭션 생성 시 성공적으로 200 OK를 반환하는지 테스트합니다."""
    krw = db_session.query(Asset).filter_by(ticker="KRW").first()
    usd = db_session.query(Asset).filter_by(ticker="USD").first()
    account = db_session.query(Account).first()

    payload = {
        "account_id": account.id,
        "asset_id": krw.id,
        "target_asset_id": usd.id,
        "transaction_date": "2026-05-02",
        "type": "EXCHANGE",
        "quantity": 1000.0,
        "price": 1350.0,
        "total_amount": 1350000.0,
        "currency": "KRW",
        "exchange_rate": 1350.0,
        "memo": "API 환전 테스트"
    }

    response = client.post("/api/db/transactions", json=payload)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["type"] == "EXCHANGE"
    assert res_data["target_asset_id"] == usd.id


def test_api_create_exchange_transaction_missing_target_asset_id(client, db_session):
    """EXCHANGE 트랜잭션 생성 시 target_asset_id 누락 시 422 오류를 반환하는지 테스트합니다."""
    krw = db_session.query(Asset).filter_by(ticker="KRW").first()
    account = db_session.query(Account).first()

    payload = {
        "account_id": account.id,
        "asset_id": krw.id,
        "transaction_date": "2026-05-02",
        "type": "EXCHANGE",
        "quantity": 1000.0,
        "price": 1350.0,
        "total_amount": 1350000.0,
        "currency": "KRW"
    }

    response = client.post("/api/db/transactions", json=payload)
    assert response.status_code == 422


def test_dashboard_service_handles_currency_exchange(db_session):
    """DashboardService의 get_holdings 및 calculate_theoretical_cash에서 EXCHANGE 거래가 정확하게 반영되는지 테스트합니다."""
    from src.backend.services.dashboard_service import DashboardService
    
    krw = db_session.query(Asset).filter_by(ticker="KRW").first()
    usd = db_session.query(Asset).filter_by(ticker="USD").first()
    account = db_session.query(Account).first()

    # 1. 초기 입금: 2,000,000 KRW
    tx_init = Transaction(
        account_id=account.id,
        asset_id=krw.id,
        transaction_date=datetime.date(2026, 5, 1),
        type="INITIAL_BALANCE",
        quantity=2000000.0,
        price=1.0,
        total_amount=2000000.0,
        currency="KRW"
    )
    db_session.add(tx_init)

    # 2. 환전: 1,350,000 KRW -> $1,000 USD
    tx_exchange = Transaction(
        account_id=account.id,
        asset_id=krw.id,
        target_asset_id=usd.id,
        transaction_date=datetime.date(2026, 5, 2),
        type="EXCHANGE",
        quantity=1000.0,
        price=1350.0,
        total_amount=1350000.0,
        currency="KRW",
        exchange_rate=1350.0
    )
    db_session.add(tx_exchange)
    db_session.commit()

    service = DashboardService(db_session)
    holdings = service.get_holdings()
    
    krw_holding = next(h for h in holdings if h["asset"].id == krw.id)
    usd_holding = next(h for h in holdings if h["asset"].id == usd.id)

    assert krw_holding["quantity"] == 650000.0
    assert usd_holding["quantity"] == 1000.0

    theoretical = service.calculate_theoretical_cash(account_id=account.id, snapshot_date=datetime.date(2026, 5, 2))
    assert theoretical["KRW"] == 650000.0
    assert theoretical["USD"] == 1000.0


def test_api_create_exchange_transaction_non_cash_asset_validation(client, db_session):
    """EXCHANGE 트랜잭션의 출발/도착 자산이 현금이 아닐 때 422 오류를 반환하는지 테스트합니다."""
    stock_asset = Asset(ticker="005930", name="삼성전자", major_category="일반주식", sub_category="국내주식", country="KR")
    usd = db_session.query(Asset).filter_by(ticker="USD").first()
    account = db_session.query(Account).first()
    db_session.add(stock_asset)
    db_session.commit()

    payload = {
        "account_id": account.id,
        "asset_id": stock_asset.id,
        "target_asset_id": usd.id,
        "transaction_date": "2026-05-02",
        "type": "EXCHANGE",
        "quantity": 1000.0,
        "price": 1350.0,
        "total_amount": 1350000.0,
        "currency": "KRW"
    }

    response = client.post("/api/db/transactions", json=payload)
    assert response.status_code == 422
    assert "현금 카테고리 자산" in response.json()["detail"]


def test_get_period_transactions_eager_loads_target_asset(client, db_session):
    """특정 계좌 기간별 거래 조회 API가 target_asset_name 및 target_asset_ticker를 정상 반환하는지 테스트합니다."""
    krw = db_session.query(Asset).filter_by(ticker="KRW").first()
    usd = db_session.query(Asset).filter_by(ticker="USD").first()
    account = db_session.query(Account).first()

    tx = Transaction(
        account_id=account.id,
        asset_id=krw.id,
        target_asset_id=usd.id,
        transaction_date=datetime.date(2026, 5, 2),
        type="EXCHANGE",
        quantity=1000.0,
        price=1350.0,
        total_amount=1350000.0,
        currency="KRW"
    )
    db_session.add(tx)
    db_session.commit()

    response = client.get(f"/api/db/accounts/{account.id}/transactions/period?start_date=2026-05-01&end_date=2026-05-03")
    assert response.status_code == 200
    tx_list = response.json()
    assert len(tx_list) == 1
    assert tx_list[0]["target_asset_name"] == "달러예수금"
    assert tx_list[0]["target_asset_ticker"] == "USD"
