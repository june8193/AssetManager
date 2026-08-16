import pytest
import datetime
from unittest.mock import patch, AsyncMock
from src.backend.models import Account, Asset, Transaction, AccountSnapshot, ExchangeRate
from src.backend.services.dashboard_service import DashboardService
from src.backend.schemas import BrokerageCalculateRequest, TransactionSchema, BrokerageSaveRequest, BrokerageSaveAccountRequest
from src.backend.routers.snapshots import calculate_brokerage_snapshot, save_brokerage_snapshots


@pytest.fixture
def setup_assets(db_session):
    """증권 스냅샷 테스트용 기본 현금 및 주식 자산을 생성합니다."""
    krw = Asset(ticker="KRW", name="원화", major_category="현금", sub_category="원화예수금", country="KR")
    usd = Asset(ticker="USD", name="달러", major_category="현금", sub_category="달러예수금", country="US")
    stock = Asset(ticker="005930", name="삼성전자", major_category="일반주식", sub_category="국내주식", country="KR")
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
        current_usd=0,
        exchange_rate=1350.0
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
        TransactionSchema(account_id=account.id, asset_id=0, transaction_date=today, type="INTEREST", total_amount=10000, currency="KRW"),
        TransactionSchema(account_id=account.id, asset_id=0, transaction_date=today, type="CASH_ADJUSTMENT", total_amount=5000, currency="KRW"),
        TransactionSchema(account_id=account.id, asset_id=0, transaction_date=today, type="TAX", total_amount=5000, currency="KRW"),
        TransactionSchema(account_id=account.id, asset_id=0, transaction_date=today, type="BUY", total_amount=100000, currency="KRW"),
        TransactionSchema(account_id=account.id, asset_id=0, transaction_date=today, type="SELL", total_amount=200000, currency="KRW"),
    ]
    
    # 계산: 1,000,000 + 10,000(이자) + 5,000(조정) - 5,000(세금) - 100,000(매수) + 200,000(매도) = 1,110,000
    expected_krw = 1110000
    
    req = BrokerageCalculateRequest(
        account_id=account.id,
        snapshot_date=today,
        new_transactions=new_transactions,
        current_krw=expected_krw,
        current_usd=0,
        exchange_rate=1350.0
    )
    
    res = await calculate_brokerage_snapshot(req, db_session)
    assert res.theoretical_krw == expected_krw

@pytest.mark.asyncio
async def test_calculate_brokerage_snapshot_period_values(db_session, setup_assets):
    """이전 스냅샷이 있는 경우 스냅샷 마법사 계산 시 기간 입금액 및 기간 수익이 올바르게 구해지는지 테스트합니다."""
    krw, usd, stock = setup_assets
    account = Account(user_id=1, name="기간수익테스트계좌", provider="KB", account_type="BROKERAGE")
    db_session.add(account)
    db_session.commit()
    
    today = datetime.date.today()
    ten_days_ago = today - datetime.timedelta(days=10)
    
    # 1. 10일 전 마지막 스냅샷 생성 (총 평가액 1,000,000원)
    db_session.add(AccountSnapshot(
        account_id=account.id,
        snapshot_date=ten_days_ago,
        period_deposit=500000.0,
        total_valuation=1000000.0,
        total_profit=100000.0
    ))
    
    # 2. 현재 보유량 설정 (비현금 자산은 없음)
    db_session.commit()
    
    # 3. 신규 입금 100,000원 입력 시뮬레이션
    new_tx = TransactionSchema(
        account_id=account.id, asset_id=0, transaction_date=today,
        type="DEPOSIT", total_amount=100000.0, currency="KRW"
    )
    
    # 입력 예수금: 원화 600,000원 + 달러 100달러 (환율 1350원 적용 시 135,000원)
    # 현재 비현금 자산: 삼성전자 10주 (테스트에서 주가 API 호출은 005930에 대해 0.0을 반환할 수 있으므로, setup_assets에서 Mock이나 가격을 정의하는 대시보드 로직 동작)
    # 단, 테스트에서는 yfinance나 키움 API가 동작하지 않고 0.0을 리턴할 수 있으므로 이 부분 감안 필요.
    # get_current_prices의 mock을 위해 DashboardService의 가격 조회 부분을 감안하거나, ticker가 mock_price를 가지도록 처리 필요.
    # tests/test_brokerage_snapshot.py 에서는 yfinance 등이 호출되면 0.0을 반환하므로 주가를 Mock하지 않으면 non_cash_valuation이 0.0이 됨.
    # 안전하게, mock_price가 50,000원이라고 가정하고 계산할 수 있도록 테스트 코드를 작성하거나 
    # 혹은 Asset category가 'USD' / 'KRW'가 아닌 '005930'에 대해 calculate 시 non_cash_valuation을 계산할 때 mock을 적용해야 함.
    # 일단은 prices.get(ticker, 0.0)을 처리하기 위해 mock을 구성하거나 테스트 코드 내에서 DB의 stock가 아니라 cash만 다루는 테스트를 수행할 수 있음.
    # 예수금과 이전 스냅샷만으로 계산되는 시나리오를 만들어 봅시다:
    # 이전 스냅샷 총평가액 = 1,000,000원
    # 현재 예수금 = 1,150,000원
    # 신규 입금 = 100,000원
    # 현금 제외 자산(주식) = 없음 (0원)
    # 예상 기간 입금액 = 100,000원
    # 예상 기간 수익 = 현재 총 평가액(1,150,000) - 이전 스냅샷 총 평가액(1,000,000) - 기간 입금액(100,000) = 50,000원.
    # 이렇게 하면 주가 조회 Mocking 없이도 완벽하게 테스트 가능!
    
    req = BrokerageCalculateRequest(
        account_id=account.id,
        snapshot_date=today,
        new_transactions=[new_tx],
        current_krw=1015000.0, # 1,015,000원
        current_usd=100.0,     # 100달러 (환율 1350.0 적용 시 135,000원) -> 총 예수금 1,150,000원
        exchange_rate=1350.0
    )
    
    res = await calculate_brokerage_snapshot(req, db_session)
    assert res.period_deposit == 100000.0
    assert res.period_profit == 50000.0


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
    # 3. 세금(TAX) 2,000원 트랜잭션 추가 (주식 자산에 매칭)
    db_session.add(Transaction(
        account_id=account.id, asset_id=stock.id, transaction_date=today,
        type="TAX", quantity=0.0, price=0.0, total_amount=2000.0, currency="KRW"
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


def test_calculate_theoretical_cash_filters_before_initial_balance(db_session, setup_assets):
    """INITIAL_BALANCE 트랜잭션이 있을 때, 그 이전의 거래 내역이 이론상 현금 잔액 계산에서 제외되는지 테스트합니다."""
    krw, usd, stock = setup_assets
    account = Account(user_id=1, name="필터테스트계좌", provider="미래에셋", account_type="BROKERAGE")
    db_session.add(account)
    db_session.commit()

    today = datetime.date.today()
    ten_days_ago = today - datetime.timedelta(days=10)
    five_days_ago = today - datetime.timedelta(days=5)

    # 1. 10일 전 현금 입금 6,000,000원 (INITIAL_BALANCE 이전의 거래)
    db_session.add(Transaction(
        account_id=account.id, asset_id=krw.id, transaction_date=ten_days_ago,
        type="DEPOSIT", quantity=6000000.0, price=1.0, total_amount=6000000.0, currency="KRW"
    ))

    # 2. 5일 전 INITIAL_BALANCE 설정 (KRW 예수금 86,216원)
    db_session.add(Transaction(
        account_id=account.id, asset_id=krw.id, transaction_date=five_days_ago,
        type="INITIAL_BALANCE", quantity=86216.0, price=1.0, total_amount=86216.0, currency="KRW"
    ))
    db_session.commit()

    service = DashboardService(db_session)
    theoretical = service.calculate_theoretical_cash(account.id, today)

    # 이전 입금 6,000,000원은 무시되고, INITIAL_BALANCE인 86,216원만 남아야 함
    assert theoretical["KRW"] == 86216.0


@pytest.mark.asyncio
async def test_get_transactions_period_api(db_session, setup_assets):
    """지정 기간 내의 기존 트랜잭션 목록 조회 API를 테스트합니다."""
    krw, usd, stock = setup_assets
    account = Account(user_id=1, name="기간거래조회테스트", provider="KB", account_type="BROKERAGE")
    db_session.add(account)
    db_session.commit()
    
    today = datetime.date.today()
    five_days_ago = today - datetime.timedelta(days=5)
    ten_days_ago = today - datetime.timedelta(days=10)
    
    # 1. 기간 이전 거래 (12일 전)
    db_session.add(Transaction(
        account_id=account.id, asset_id=krw.id, transaction_date=today - datetime.timedelta(days=12),
        type="DEPOSIT", total_amount=100000.0, currency="KRW"
    ))
    # 2. 기간 내 거래 (8일 전)
    db_session.add(Transaction(
        account_id=account.id, asset_id=krw.id, transaction_date=today - datetime.timedelta(days=8),
        type="DEPOSIT", total_amount=200000.0, currency="KRW"
    ))
    # 3. 기간 내 거래 (2일 전)
    db_session.add(Transaction(
        account_id=account.id, asset_id=stock.id, transaction_date=today - datetime.timedelta(days=2),
        type="BUY", quantity=5, price=50000, total_amount=250000.0, currency="KRW"
    ))
    db_session.commit()
    
    # transactions 라우터의 get_period_transactions 엔드포인트 직접 호출
    from src.backend.routers.transactions import get_period_transactions
    
    # 10일 전 ~ 오늘
    res = get_period_transactions(
        account_id=account.id,
        start_date=ten_days_ago,
        end_date=today,
        db=db_session
    )
    
    assert len(res) == 2
    assert any(t.total_amount == 200000.0 for t in res)
    assert any(t.type == "BUY" and t.quantity == 5 for t in res)









