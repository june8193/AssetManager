import pytest
import datetime
from src.backend.models import Account, Asset, Transaction, AccountSnapshot
from src.backend.services.dashboard_service import DashboardService
from src.backend.routers.db_manage import BrokerageCalculateRequest, TransactionSchema, BrokerageSaveRequest, BrokerageSaveAccountRequest, calculate_brokerage_snapshot, save_brokerage_snapshots

@pytest.fixture
def setup_assets(db_session):
    krw = Asset(ticker="KRW", name="원화", major_category="현금", sub_category="현금", country="KR")
    usd = Asset(ticker="USD", name="달러", major_category="현금", sub_category="현금", country="US")
    stock = Asset(ticker="005930", name="삼성전자", major_category="주식", sub_category="국내주식", country="KR")
    db_session.add_all([krw, usd, stock])
    db_session.commit()
    return krw, usd, stock

def test_calculate_theoretical_cash(db_session, setup_assets):
    """이론상 현금 잔액 계산 로직을 테스트합니다."""
    krw, usd, stock = setup_assets
    account = Account(user_id=1, name="테스트증권", provider="KB증권", account_type="BROKERAGE")
    db_session.add(account)
    db_session.commit()
    
    today = datetime.date.today()
    
    # 입금 1,000,000원
    db_session.add(Transaction(
        account_id=account.id, asset_id=krw.id, transaction_date=today,
        type="DEPOSIT", quantity=1000000, price=1.0, total_amount=1000000, currency="KRW"
    ))
    # 삼성전자 매수 500,000원
    db_session.add(Transaction(
        account_id=account.id, asset_id=stock.id, transaction_date=today,
        type="BUY", quantity=10, price=50000, total_amount=500000, currency="KRW"
    ))
    db_session.commit()
    
    service = DashboardService(db_session)
    theoretical = service.calculate_theoretical_cash(account.id, today)
    assert theoretical["KRW"] == 500000

@pytest.mark.asyncio
async def test_calculate_brokerage_snapshot_api(db_session, setup_assets):
    """브로커리지 스냅샷 계산 API 로직을 테스트합니다."""
    krw, usd, stock = setup_assets
    account = Account(user_id=1, name="테스트계좌", provider="KB", account_type="BROKERAGE")
    db_session.add(account)
    db_session.commit()
    
    today = datetime.date.today()
    
    # 기존 잔액 500,000원
    db_session.add(Transaction(
        account_id=account.id, asset_id=krw.id, transaction_date=today,
        type="INITIAL_BALANCE", total_amount=500000, currency="KRW"
    ))
    db_session.commit()
    
    # 신규 입금 100,000원 입력 시뮬레이션
    new_tx = TransactionSchema(
        account_id=account.id, asset_id=0, transaction_date=today,
        type="DEPOSIT", total_amount=100000, currency="KRW"
    )
    
    req = BrokerageCalculateRequest(
        account_id=account.id,
        snapshot_date=today,
        new_transactions=[new_tx],
        current_krw=650000, # 500k + 100k = 600k (이론상). 실제 650k이므로 50k가 배당금
        current_usd=0
    )
    
    res = await calculate_brokerage_snapshot(req, db_session)
    assert res.theoretical_krw == 600000
    assert res.diff_krw == 50000

@pytest.mark.asyncio
async def test_save_brokerage_snapshots_api(db_session, setup_assets):
    """브로커리지 스냅샷 저장 API 로직을 테스트합니다."""
    krw, usd, stock = setup_assets
    account = Account(user_id=1, name="저장테스트", provider="KB", account_type="BROKERAGE")
    db_session.add(account)
    db_session.commit()
    
    today = datetime.date.today()
    
    acc_req = BrokerageSaveAccountRequest(
        account_id=account.id,
        new_transactions=[
            TransactionSchema(account_id=account.id, asset_id=0, transaction_date=today, type="DEPOSIT", total_amount=100000, currency="KRW")
        ],
        diff_krw=50000,
        diff_usd=0
    )
    
    req = BrokerageSaveRequest(
        snapshot_date=today,
        exchange_rate=1350.0,
        accounts=[acc_req]
    )
    
    await save_brokerage_snapshots(req, db_session)
    
    # 1. 트랜잭션 확인
    txs = db_session.query(Transaction).filter(Transaction.account_id == account.id).all()
    assert len(txs) == 2 # DEPOSIT + CASH_ADJUSTMENT
    assert any(t.type == "DEPOSIT" and t.total_amount == 100000 for t in txs)
    assert any(t.type == "CASH_ADJUSTMENT" and t.total_amount == 50000 for t in txs)
    
    # 2. 스냅샷 확인
    snap = db_session.query(AccountSnapshot).filter(AccountSnapshot.account_id == account.id).first()
    assert snap is not None
    assert snap.total_valuation == 150000

@pytest.mark.asyncio
async def test_calculate_brokerage_snapshot_with_various_types(db_session, setup_assets):
    """증권계좌 계산 시 다양한 트랜잭션 타입이 반영되는지 테스트합니다."""
    krw, usd, stock = setup_assets
    account = Account(user_id=1, name="테스트계좌", provider="KB", account_type="BROKERAGE")
    db_session.add(account)
    db_session.commit()
    
    today = datetime.date.today()
    
    # 기초 잔액 1,000,000원
    db_session.add(Transaction(
        account_id=account.id, asset_id=krw.id, transaction_date=today,
        type="INITIAL_BALANCE", total_amount=1000000, currency="KRW"
    ))
    db_session.commit()
    
    # 신규 내역들
    new_transactions = [
        TransactionSchema(account_id=account.id, asset_id=0, transaction_date=today, type="DIVIDEND", total_amount=50000, currency="KRW"),
        TransactionSchema(account_id=account.id, asset_id=0, transaction_date=today, type="INTEREST", total_amount=10000, currency="KRW"),
        TransactionSchema(account_id=account.id, asset_id=0, transaction_date=today, type="CASH_ADJUSTMENT", total_amount=5000, currency="KRW"),
        TransactionSchema(account_id=account.id, asset_id=0, transaction_date=today, type="FEE", total_amount=2000, currency="KRW"),
        TransactionSchema(account_id=account.id, asset_id=0, transaction_date=today, type="TAX", total_amount=3000, currency="KRW"),
        TransactionSchema(account_id=account.id, asset_id=0, transaction_date=today, type="BUY", total_amount=100000, currency="KRW"),
        TransactionSchema(account_id=account.id, asset_id=0, transaction_date=today, type="SELL", total_amount=200000, currency="KRW"),
    ]
    
    # 계산: 1,000,000 + 50,000(배당) + 10,000(이자) + 5,000(조정) - 2,000(수수료) - 3,000(세금) - 100,000(매수) + 200,000(매도) = 1,160,000
    expected_krw = 1160000
    
    req = BrokerageCalculateRequest(
        account_id=account.id,
        snapshot_date=today,
        new_transactions=new_transactions,
        current_krw=expected_krw,
        current_usd=0
    )
    
    res = await calculate_brokerage_snapshot(req, db_session)
    assert res.theoretical_krw == expected_krw

def test_get_holdings_dynamic_cash_calculation(db_session, setup_assets):
    """주식 매매 및 비용 거래 발생 시 get_holdings()가 현금 보유량을 동적으로 가감하는지 테스트합니다."""
    krw, usd, stock = setup_assets
    account = Account(user_id=1, name="KB주식", provider="KB증권", account_type="BROKERAGE")
    db_session.add(account)
    db_session.commit()
    
    today = datetime.date.today()
    
    # 1. 1,000,000원 입금 트랜잭션 추가
    db_session.add(Transaction(
        account_id=account.id, asset_id=krw.id, transaction_date=today,
        type="DEPOSIT", quantity=1000000.0, price=1.0, total_amount=1000000.0, currency="KRW"
    ))
    # 2. 삼성전자 10주 매수 (50,000원 * 10 = 500,000원) 트랜잭션 추가
    db_session.add(Transaction(
        account_id=account.id, asset_id=stock.id, transaction_date=today,
        type="BUY", quantity=10.0, price=50000.0, total_amount=500000.0, currency="KRW"
    ))
    # 3. 수수료(FEE) 2,000원 트랜잭션 추가 (주식 자산에 매칭)
    db_session.add(Transaction(
        account_id=account.id, asset_id=stock.id, transaction_date=today,
        type="FEE", quantity=0.0, price=0.0, total_amount=2000.0, currency="KRW"
    ))
    db_session.commit()
    
    service = DashboardService(db_session)
    holdings = service.get_holdings()
    
    krw_qty = 0.0
    stock_qty = 0.0
    for h in holdings:
        if h['account'].id == account.id:
            if h['asset'].id == krw.id:
                krw_qty = h['quantity']
            elif h['asset'].id == stock.id:
                stock_qty = h['quantity']
                
    # 주식은 10주여야 함
    assert stock_qty == 10.0
    # 현금(KRW) 잔고는 입금(100만) - 매수(50만) - 수수료(2천) = 498,000원 이어야 함!
    assert krw_qty == 498000.0

