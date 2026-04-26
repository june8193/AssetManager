import pytest
import datetime
from src.backend.models import Account, Asset, Transaction, AccountSnapshot
from src.backend.routers.db_manage import BankSaveRequest, BankSaveAccountRequest, TransactionSchema, save_bank_snapshots

@pytest.fixture
def setup_bank_assets(db_session):
    krw = Asset(ticker="KRW", name="원화", major_category="현금", sub_category="현금", country="KR")
    db_session.add(krw)
    db_session.commit()
    return krw

@pytest.mark.asyncio
async def test_save_bank_snapshots_with_memo(db_session, setup_bank_assets):
    """은행 계좌 스냅샷 저장 및 메모 필드를 테스트합니다."""
    krw = setup_bank_assets
    account = Account(user_id=1, name="테스트은행", provider="신한은행", account_type="BANK")
    db_session.add(account)
    db_session.commit()
    
    today = datetime.date.today()
    memo_text = "재웅이형 축의금"
    
    acc_req = BankSaveAccountRequest(
        account_id=account.id,
        new_transactions=[
            TransactionSchema(
                account_id=account.id, 
                asset_id=0, 
                transaction_date=today, 
                type="WITHDRAW", 
                total_amount=50000, 
                currency="KRW",
                memo=memo_text
            ),
            TransactionSchema(
                account_id=account.id, 
                asset_id=0, 
                transaction_date=today, 
                type="INTEREST", 
                total_amount=1000, 
                currency="KRW",
                memo="예금이차"
            )
        ],
        total_valuation=1000000.0
    )
    
    req = BankSaveRequest(
        snapshot_date=today,
        accounts=[acc_req]
    )
    
    await save_bank_snapshots(req, db_session)
    
    # 1. 트랜잭션 및 메모 확인
    txs = db_session.query(Transaction).filter(Transaction.account_id == account.id).all()
    assert len(txs) == 2
    withdraw_tx = next(t for t in txs if t.type == "WITHDRAW")
    assert withdraw_tx.memo == memo_text
    assert withdraw_tx.total_amount == 50000
    
    interest_tx = next(t for t in txs if t.type == "INTEREST")
    assert interest_tx.memo == "예금이차"
    
    # 2. 스냅샷 확인
    snap = db_session.query(AccountSnapshot).filter(AccountSnapshot.account_id == account.id).first()
    assert snap is not None
    assert snap.total_valuation == 1000000.0
    # 입금/출금만 원금 변동으로 계산 (INTEREST는 제외되어야 함)
    # 초기 잔액 0에서 -50,000(WITHDRAW) = -50,000
    assert snap.period_deposit == -50000.0
