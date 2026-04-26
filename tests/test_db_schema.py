import pytest
import datetime
from src.backend.models import User, Account, Asset, Transaction, AccountSnapshot

def test_models_exist():
    """새로운 모델 클래스들이 정의되어 있는지 확인합니다."""
    assert User is not None, "User 모델이 정의되지 않았습니다."
    assert Account is not None, "Account 모델이 정의되지 않았습니다."
    assert Asset is not None, "Asset 모델이 정의되지 않았습니다."
    assert Transaction is not None, "Transaction 모델이 정의되지 않았습니다."
    assert AccountSnapshot is not None, "AccountSnapshot 모델이 정의되지 않았습니다."

def test_create_user(db_session):
    """사용자 생성을 테스트합니다."""
    user = User(name="테스트유저")
    db_session.add(user)
    db_session.commit()
    
    saved_user = db_session.query(User).filter_by(name="테스트유저").first()
    assert saved_user is not None
    assert saved_user.name == "테스트유저"
    assert isinstance(saved_user.created_at, datetime.datetime)

def test_create_account(db_session):
    """계좌 생성을 테스트합니다."""
    user = User(name="테스트유저")
    db_session.add(user)
    db_session.commit()
    
    # 1. 명시적으로 account_type을 지정하여 생성
    account = Account(
        user_id=user.id, 
        name="테스트계좌", 
        provider="KB증권",
        account_type="BANK"
    )
    db_session.add(account)
    db_session.commit()
    
    saved_account = db_session.query(Account).filter_by(name="테스트계좌").first()
    assert saved_account is not None
    assert saved_account.user_id == user.id
    assert saved_account.account_type == "BANK"

    # 2. account_type을 생략할 경우 기본값(BROKERAGE) 확인
    default_account = Account(
        user_id=user.id,
        name="기본계좌",
        provider="미래에셋"
    )
    db_session.add(default_account)
    db_session.commit()

    saved_default = db_session.query(Account).filter_by(name="기본계좌").first()
    assert saved_default.account_type == "BROKERAGE"

def test_create_asset(db_session):
    """자산 마스터 생성을 테스트합니다."""
    asset = Asset(ticker="AAPL", name="애플", major_category="일반주식", sub_category="해외주식")
    db_session.add(asset)
    db_session.commit()
    
    saved_asset = db_session.query(Asset).filter_by(ticker="AAPL").first()
    assert saved_asset is not None
    assert saved_asset.name == "애플"

def test_create_transaction(db_session):
    """거래 내역(원장) 생성을 테스트합니다."""
    user = User(name="테스트유저")
    db_session.add(user)
    db_session.commit()
    
    account = Account(user_id=user.id, name="테스트계좌", provider="KB증권")
    asset = Asset(ticker="KRW", name="원화예수금", major_category="현금", sub_category="원화예수금")
    db_session.add(account)
    db_session.add(asset)
    db_session.commit()
    
    # 입금 거래
    tx = Transaction(
        account_id=account.id,
        asset_id=asset.id,
        transaction_date=datetime.date.today(),
        type="DEPOSIT",
        quantity=1.0,
        price=1000000.0,
        total_amount=1000000.0,
        currency="KRW"
    )
    db_session.add(tx)
    db_session.commit()
    
    saved_tx = db_session.query(Transaction).first()
    assert saved_tx is not None
    assert saved_tx.type == "DEPOSIT"
    assert saved_tx.total_amount == 1000000.0

def test_create_snapshot(db_session):
    """계좌 스냅샷 생성을 테스트합니다."""
    user = User(name="테스트유저")
    db_session.add(user)
    db_session.commit()
    
    account = Account(user_id=user.id, name="테스트계좌", provider="KB증권")
    db_session.add(account)
    db_session.commit()
    
    snapshot = AccountSnapshot(
        account_id=account.id,
        snapshot_date=datetime.date.today(),
        period_deposit=1000000.0,
        total_valuation=1100000.0,
        total_profit=100000.0
    )
    db_session.add(snapshot)
    db_session.commit()
    
    saved_snapshot = db_session.query(AccountSnapshot).first()
    assert saved_snapshot is not None
    assert saved_snapshot.period_deposit == 1000000.0
    assert saved_snapshot.total_profit == 100000.0
