import pytest
import datetime
from unittest.mock import patch, AsyncMock
from src.backend.models import Account, Asset, Transaction, AccountSnapshot, ExchangeRate
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
        TransactionSchema(account_id=account.id, asset_id=0, transaction_date=today, type="FEE", total_amount=2000, currency="KRW"),
        TransactionSchema(account_id=account.id, asset_id=0, transaction_date=today, type="TAX", total_amount=3000, currency="KRW"),
        TransactionSchema(account_id=account.id, asset_id=0, transaction_date=today, type="BUY", total_amount=100000, currency="KRW"),
        TransactionSchema(account_id=account.id, asset_id=0, transaction_date=today, type="SELL", total_amount=200000, currency="KRW"),
    ]
    
    # 계산: 1,000,000 + 10,000(이자) + 5,000(조정) - 2,000(수수료) - 3,000(세금) - 100,000(매수) + 200,000(매도) = 1,110,000
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
    
    # db_manage 라우터의 get_period_transactions 엔드포인트 직접 호출
    from src.backend.routers.db_manage import get_period_transactions
    
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


@pytest.mark.asyncio
async def test_calculate_brokerage_snapshot_with_asset_profits(db_session, setup_assets):
    """증권계좌 정산 계산 시 종목별 기간수익이 올바르게 반환되는지 테스트합니다."""
    krw, usd, stock = setup_assets
    account = Account(user_id=1, name="종목수익테스트", provider="KB", account_type="BROKERAGE")
    db_session.add(account)
    db_session.commit()
    
    today = datetime.date.today()
    ten_days_ago = today - datetime.timedelta(days=10)
    
    # 1. 이전 스냅샷 등록 (10일 전)
    db_session.add(AccountSnapshot(
        account_id=account.id,
        snapshot_date=ten_days_ago,
        period_deposit=0.0,
        total_valuation=500000.0, # 이전 평가액 50만원
        total_profit=50000.0
    ))
    
    # 2. 이전 시점(10일 전) 주식 잔고 설정: 삼성전자 10주 보유 중이었음
    db_session.add(Transaction(
        account_id=account.id, asset_id=stock.id, transaction_date=ten_days_ago - datetime.timedelta(days=1),
        type="BUY", quantity=10.0, price=45000.0, total_amount=450000.0, currency="KRW"
    ))
    # 3. 기간 내 추가 거래: 삼성전자 5주 추가 매수 (50,000원 * 5 = 250,000원)
    db_session.add(Transaction(
        account_id=account.id, asset_id=stock.id, transaction_date=today - datetime.timedelta(days=2),
        type="BUY", quantity=5.0, price=50000.0, total_amount=250000.0, currency="KRW"
    ))
    db_session.commit()
    
    req = BrokerageCalculateRequest(
        account_id=account.id,
        snapshot_date=today,
        new_transactions=[],
        current_krw=100000.0, # 현재 예수금
        current_usd=0.0,
        exchange_rate=1350.0
    )
    
    from src.backend.services.price_service import price_service
    from unittest.mock import patch, AsyncMock
    
    # price_service의 과거 주가 조회 및 DashboardService의 현재 주가 조회 Mocking
    with patch.object(price_service, 'get_kr_historical_price', new_callable=AsyncMock) as mock_hist, \
         patch('src.backend.services.dashboard_service.DashboardService.get_current_prices', new_callable=AsyncMock) as mock_curr:
        
        mock_hist.return_value = 45000.0 # 10일 전 주가
        mock_curr.return_value = {"005930": 60000.0} # 현재 주가
        
        res = await calculate_brokerage_snapshot(req, db_session)
        
        # asset_profits 확인
        assert len([p for p in res.asset_profits if p.ticker not in ["KRW", "USD"]]) == 1
        profit_data = next(p for p in res.asset_profits if p.ticker == "005930")
        assert profit_data.ticker == "005930"
        assert profit_data.last_valuation == 450000.0
        assert profit_data.current_valuation == 900000.0
        assert profit_data.period_buy == 250000.0
        assert profit_data.period_profit == 200000.0


@pytest.mark.asyncio
async def test_calculate_brokerage_snapshot_sell_all(db_session, setup_assets):
    """특정 종목을 전량 매도한 엣지 케이스에 대해 기간수익이 올바르게 계산되는지 테스트합니다."""
    krw, usd, stock = setup_assets
    account = Account(user_id=1, name="전량매도테스트", provider="KB", account_type="BROKERAGE")
    db_session.add(account)
    db_session.commit()
    
    today = datetime.date.today()
    ten_days_ago = today - datetime.timedelta(days=10)
    
    # 1. 이전 스냅샷 등록
    db_session.add(AccountSnapshot(
        account_id=account.id,
        snapshot_date=ten_days_ago,
        period_deposit=0.0,
        total_valuation=450000.0,
        total_profit=0.0
    ))
    
    # 2. 10일 전 시점에 10주 보유 중이었음
    db_session.add(Transaction(
        account_id=account.id, asset_id=stock.id, transaction_date=ten_days_ago - datetime.timedelta(days=1),
        type="BUY", quantity=10.0, price=45000.0, total_amount=450000.0, currency="KRW"
    ))
    
    # 3. 기간 내 전량 매도 (10주 매도, 총 600,000원 획득)
    db_session.add(Transaction(
        account_id=account.id, asset_id=stock.id, transaction_date=today - datetime.timedelta(days=2),
        type="SELL", quantity=10.0, price=60000.0, total_amount=600000.0, currency="KRW"
    ))
    db_session.commit()
    
    # 현재 수량 = 0
    # 예상 수익 = 현재평가(0) - 이전평가(450,000) - 기간매수(0) + 기간매도(600,000) = 150,000원 이익
    
    req = BrokerageCalculateRequest(
        account_id=account.id,
        snapshot_date=today,
        new_transactions=[],
        current_krw=600000.0,
        current_usd=0.0,
        exchange_rate=1350.0
    )
    
    from src.backend.services.price_service import price_service
    
    with patch.object(price_service, 'get_kr_historical_price', new_callable=AsyncMock) as mock_hist, \
         patch('src.backend.services.dashboard_service.DashboardService.get_current_prices', new_callable=AsyncMock) as mock_curr:
        
        mock_hist.return_value = 45000.0
        mock_curr.return_value = {"005930": 65000.0} # 현재 수량이 0이므로 현재 주가는 계산에 영향 없음
        
        res = await calculate_brokerage_snapshot(req, db_session)
        
        assert len([p for p in res.asset_profits if p.ticker not in ["KRW", "USD"]]) == 1
        profit_data = next(p for p in res.asset_profits if p.ticker == "005930")
        assert profit_data.ticker == "005930"
        assert profit_data.last_valuation == 450000.0
        assert profit_data.current_valuation == 0.0
        assert profit_data.period_sell == 600000.0
        assert profit_data.period_profit == 150000.0


@pytest.mark.asyncio
async def test_calculate_brokerage_snapshot_new_asset(db_session, setup_assets):
    """신규로 종목이 추가된 엣지 케이스에 대해 기간수익이 올바르게 계산되는지 테스트합니다."""
    krw, usd, stock = setup_assets
    account = Account(user_id=1, name="신규종목테스트", provider="KB", account_type="BROKERAGE")
    db_session.add(account)
    db_session.commit()
    
    today = datetime.date.today()
    ten_days_ago = today - datetime.timedelta(days=10)
    
    # 1. 이전 스냅샷 등록
    db_session.add(AccountSnapshot(
        account_id=account.id,
        snapshot_date=ten_days_ago,
        period_deposit=0.0,
        total_valuation=0.0,
        total_profit=0.0
    ))
    db_session.commit()
    
    # 2. 10일 전 시점에 0주 보유 (이전 트랜잭션 없음)
    # 3. 기간 내 10주 신규 매수 (총 500,000원 지출)
    db_session.add(Transaction(
        account_id=account.id, asset_id=stock.id, transaction_date=today - datetime.timedelta(days=2),
        type="BUY", quantity=10.0, price=50000.0, total_amount=500000.0, currency="KRW"
    ))
    db_session.commit()
    
    # 현재 수량 = 10주. 현재가 = 60,000원 (현재 평가액 = 60만원)
    # 예상 수익 = 현재평가(600,000) - 이전평가(0) - 기간매수(500,000) + 기간매도(0) = 100,000원 이익
    
    req = BrokerageCalculateRequest(
        account_id=account.id,
        snapshot_date=today,
        new_transactions=[],
        current_krw=100000.0,
        current_usd=0.0,
        exchange_rate=1350.0
    )
    
    from src.backend.services.price_service import price_service
    
    with patch.object(price_service, 'get_kr_historical_price', new_callable=AsyncMock) as mock_hist, \
         patch('src.backend.services.dashboard_service.DashboardService.get_current_prices', new_callable=AsyncMock) as mock_curr:
        
        mock_hist.return_value = 0.0 # 이전 주가 조회는 발생하지 않음 (l_qty = 0이므로)
        mock_curr.return_value = {"005930": 60000.0} # 현재 주가
        
        res = await calculate_brokerage_snapshot(req, db_session)
        
        assert len([p for p in res.asset_profits if p.ticker not in ["KRW", "USD"]]) == 1
        profit_data = next(p for p in res.asset_profits if p.ticker == "005930")
        assert profit_data.ticker == "005930"
        assert profit_data.last_valuation == 0.0
        assert profit_data.current_valuation == 600000.0
        assert profit_data.period_buy == 500000.0
        assert profit_data.period_profit == 100000.0


@pytest.mark.asyncio
async def test_calculate_brokerage_snapshot_needs_last_rate(db_session, setup_assets):
    """이전 스냅샷이 있고 해외 자산을 보유하고 있으나 당일 환율 데이터가 없는 경우 환율 입력을 요구하는지 테스트합니다."""
    krw, usd, stock_kr = setup_assets
    
    # 미국 주식 생성
    stock_us = Asset(ticker="KO", name="Coca-Cola", major_category="주식", sub_category="해외주식", country="US")
    db_session.add(stock_us)
    
    account = Account(user_id=1, name="해외주식테스트", provider="KB", account_type="BROKERAGE")
    db_session.add(account)
    db_session.commit()
    
    today = datetime.date.today()
    ten_days_ago = today - datetime.timedelta(days=10)
    
    # 1. 10일 전 스냅샷 등록
    db_session.add(AccountSnapshot(
        account_id=account.id,
        snapshot_date=ten_days_ago,
        period_deposit=0.0,
        total_valuation=1000000.0,
        total_profit=10000.0
    ))
    
    # 2. 10일 전 시점에 미국 주식 10주 보유 중이었음
    db_session.add(Transaction(
        account_id=account.id, asset_id=stock_us.id, transaction_date=ten_days_ago - datetime.timedelta(days=1),
        type="BUY", quantity=10.0, price=50.0, total_amount=500.0, currency="USD"
    ))
    db_session.commit()
    
    # 3. DB에 ten_days_ago (10일 전) 환율 데이터가 없는 상태로 계산 요청
    req = BrokerageCalculateRequest(
        account_id=account.id,
        snapshot_date=today,
        new_transactions=[],
        current_krw=100000.0,
        current_usd=0.0,
        exchange_rate=1350.0
    )
    
    res = await calculate_brokerage_snapshot(req, db_session)
    assert res.need_last_exchange_rate is True
    assert res.last_snapshot_date == ten_days_ago


@pytest.mark.asyncio
async def test_calculate_brokerage_snapshot_with_cash_assets_and_us_dollars(db_session, setup_assets):
    """원화 예수금, 달러 예수금 행이 상세 기간수익 목록에 추가되고, 해외 주식의 매수/매도 금액이 달러로 표시되는지 테스트합니다."""
    krw, usd, stock_kr = setup_assets
    
    # 1. 미국 주식 생성
    stock_us = Asset(ticker="AAPL", name="Apple", major_category="주식", sub_category="해외주식", country="US")
    db_session.add(stock_us)
    
    account = Account(user_id=1, name="통합정산테스트", provider="KB", account_type="BROKERAGE")
    db_session.add(account)
    db_session.commit()
    
    today = datetime.date.today()
    ten_days_ago = today - datetime.timedelta(days=10)
    
    # 2. 10일 전 스냅샷 등록
    db_session.add(AccountSnapshot(
        account_id=account.id,
        snapshot_date=ten_days_ago,
        period_deposit=0.0,
        total_valuation=1000000.0,
        total_profit=10000.0
    ))
    
    # 10일 전 환율 설정
    db_session.add(ExchangeRate(date=ten_days_ago, rate=1300.0, currency="USD"))
    
    # 3. 10일 전 시점 자산 보유 현황 (이론상 계산용 이전 트랜잭션들)
    # 원화 예수금 100,000원
    db_session.add(Transaction(
        account_id=account.id, asset_id=krw.id, transaction_date=ten_days_ago - datetime.timedelta(days=2),
        type="INITIAL_BALANCE", quantity=100000.0, price=1.0, total_amount=100000.0, currency="KRW"
    ))
    # 달러 예수금 1200달러 (이후 AAPL 1000달러 매수하여 잔액 200달러)
    db_session.add(Transaction(
        account_id=account.id, asset_id=usd.id, transaction_date=ten_days_ago - datetime.timedelta(days=2),
        type="INITIAL_BALANCE", quantity=1200.0, price=1.0, total_amount=1200.0, currency="USD"
    ))
    # 미국 주식 10주
    db_session.add(Transaction(
        account_id=account.id, asset_id=stock_us.id, transaction_date=ten_days_ago - datetime.timedelta(days=2),
        type="BUY", quantity=10.0, price=100.0, total_amount=1000.0, currency="USD"
    ))
    
    # 4. 기간 내 추가 거래 내역 등록
    # 미국 주식 5주 추가 매수 (120달러 * 5 = 600달러, 적용환율 1320원)
    db_session.add(Transaction(
        account_id=account.id, asset_id=stock_us.id, transaction_date=today - datetime.timedelta(days=5),
        type="BUY", quantity=5.0, price=120.0, total_amount=600.0, currency="USD", exchange_rate=1320.0
    ))
    # 원화 입금 50,000원
    db_session.add(Transaction(
        account_id=account.id, asset_id=krw.id, transaction_date=today - datetime.timedelta(days=5),
        type="DEPOSIT", total_amount=50000.0, currency="KRW"
    ))
    # 달러 입금 650달러
    db_session.add(Transaction(
        account_id=account.id, asset_id=usd.id, transaction_date=today - datetime.timedelta(days=5),
        type="DEPOSIT", total_amount=650.0, currency="USD"
    ))
    db_session.commit()
    
    # 5. 계산 요청 파라미터 (현재 환율 1350원)
    # 현재 입력 잔고: 원화 150,000원, 달러 250달러
    # (이론상 잔고와 정확히 일치하여 보정액 0원)
    req = BrokerageCalculateRequest(
        account_id=account.id,
        snapshot_date=today,
        new_transactions=[],
        current_krw=150000.0,
        current_usd=250.0,
        exchange_rate=1350.0
    )
    
    from src.backend.services.price_service import price_service
    
    with patch.object(price_service, 'get_us_historical_price', new_callable=AsyncMock) as mock_hist, \
         patch('src.backend.services.dashboard_service.DashboardService.get_current_prices', new_callable=AsyncMock) as mock_curr:
        
        mock_hist.return_value = 100.0 # 10일 전 주가
        mock_curr.return_value = {"AAPL": 150.0} # 현재 주가
        
        res = await calculate_brokerage_snapshot(req, db_session)
        
        # asset_profits 에 AAPL, KRW, USD 자산이 모두 존재해야 함
        assert len(res.asset_profits) == 3
        
        # AAPL (미국 주식) 검증
        aapl_profit = next(p for p in res.asset_profits if p.ticker == "AAPL")
        # 미국 주식이므로 매수액이 원화가 아닌 달러 자체 금액(600달러)이어야 함
        assert aapl_profit.period_buy == 600.0
        # 수익(원화) = 현재(15 * 150 * 1350 = 3,037,500) - 이전(10 * 100 * 1300 = 1,300,000) - 매수원화(600 * 1320 = 792,000) = 945,500원
        assert aapl_profit.period_profit == 945500.0
        
        # 원화 예수금 검증
        krw_profit = next(p for p in res.asset_profits if p.ticker == "KRW")
        assert krw_profit.asset_name == "원화 예수금"
        assert krw_profit.last_valuation == 100000.0
        assert krw_profit.current_valuation == 150000.0
        assert krw_profit.period_buy == 50000.0 # 입금액
        assert krw_profit.period_sell == 0.0 # 출금액
        assert krw_profit.period_profit == 0.0 # 보정액이 0이므로
        assert krw_profit.cash_buy_stock == 0.0
        assert krw_profit.cash_sell_stock == 0.0
        
        # 달러 예수금 검증
        usd_profit = next(p for p in res.asset_profits if p.ticker == "USD")
        assert usd_profit.asset_name == "달러 예수금"
        assert usd_profit.last_valuation == 200.0 * 1300.0 # 260,000원
        assert usd_profit.current_valuation == 250.0 * 1350.0 # 337,500원
        assert usd_profit.period_buy == 650.0 # 달러 입금액 (달러 단위)
        assert usd_profit.period_sell == 0.0
        assert usd_profit.period_profit == -8000.0
        assert usd_profit.cash_buy_stock == 600.0  # AAPL 5주 매수 (120달러 * 5 = 600달러)
        assert usd_profit.cash_sell_stock == 0.0






