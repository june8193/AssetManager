import pytest
import datetime
from src.backend.models import Account, Asset, Transaction, AccountSnapshot
from src.backend.schemas import BankSaveRequest, BankSaveAccountRequest, TransactionSchema
from src.backend.routers.snapshots import save_bank_snapshots

@pytest.fixture
def setup_bank_assets(db_session):
    """은행 스냅샷 테스트용 기본 현금(KRW) 자산을 생성합니다."""
    krw = Asset(ticker="KRW", name="원화", major_category="현금", sub_category="원화예수금", country="KR")
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
    # 기간 손익: 1,000,000 - 0(직전) - (-50,000)(순입금) = 1,050,000
    assert snap.total_profit == 1050000.0


@pytest.mark.asyncio
async def test_consecutive_bank_snapshots_period_profit(db_session, setup_bank_assets):
    """연속적인 은행 스냅샷 생성 시 기간 손익이 누적이 아닌 해당 기간의 손익으로 올바르게 기록되는지 검증합니다."""
    krw = setup_bank_assets
    account = Account(user_id=1, name="카카오뱅크", provider="카카오", account_type="BANK")
    db_session.add(account)
    db_session.commit()
    
    # 1. 1차 스냅샷 (2026-07-01): 초기 잔고 10,000,000원 + 이자 50,000원 -> 잔액 10,050,000원
    snap1_date = datetime.date(2026, 7, 1)
    req1 = BankSaveRequest(
        snapshot_date=snap1_date,
        accounts=[
            BankSaveAccountRequest(
                account_id=account.id,
                new_transactions=[
                    TransactionSchema(
                        account_id=account.id, asset_id=0, transaction_date=snap1_date,
                        type="DEPOSIT", total_amount=10000000, currency="KRW"
                    ),
                    TransactionSchema(
                        account_id=account.id, asset_id=0, transaction_date=snap1_date,
                        type="INTEREST", total_amount=50000, currency="KRW"
                    )
                ],
                total_valuation=10050000.0
            )
        ]
    )
    await save_bank_snapshots(req1, db_session)
    
    snap1 = db_session.query(AccountSnapshot).filter(
        AccountSnapshot.account_id == account.id,
        AccountSnapshot.snapshot_date == snap1_date
    ).first()
    assert snap1.period_deposit == 10000000.0
    assert snap1.total_valuation == 10050000.0
    assert snap1.total_profit == 50000.0  # 1차 기간 손익: +50,000원
    
    # 2. 2차 스냅샷 (2026-08-01): 단순 입출금만 발생 (입금 2,000,000원, 출금 500,000원), 이자/세금 없음
    # 잔액 = 10,050,000 + 1,500,000 = 11,550,000원
    snap2_date = datetime.date(2026, 8, 1)
    req2 = BankSaveRequest(
        snapshot_date=snap2_date,
        accounts=[
            BankSaveAccountRequest(
                account_id=account.id,
                new_transactions=[
                    TransactionSchema(
                        account_id=account.id, asset_id=0, transaction_date=snap2_date,
                        type="DEPOSIT", total_amount=2000000, currency="KRW"
                    ),
                    TransactionSchema(
                        account_id=account.id, asset_id=0, transaction_date=snap2_date,
                        type="WITHDRAW", total_amount=500000, currency="KRW"
                    )
                ],
                total_valuation=11550000.0
            )
        ]
    )
    await save_bank_snapshots(req2, db_session)
    
    snap2 = db_session.query(AccountSnapshot).filter(
        AccountSnapshot.account_id == account.id,
        AccountSnapshot.snapshot_date == snap2_date
    ).first()
    assert snap2.period_deposit == 1500000.0
    assert snap2.total_valuation == 11550000.0
    # 2차 기간 손익: 11,550,000 - 10,050,000(직전평가) - 1,500,000(순입금) = 0원이어야 함! (과거 누적 50,000원이 고정되면 안 됨)
    assert snap2.total_profit == 0.0
