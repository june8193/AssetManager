import pytest
import sys, os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import datetime

# 프로젝트 루트를 path에 추가
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.backend.database import Base
from src.backend.models import User, Account, Asset, Transaction, AccountSnapshot

@pytest.fixture(scope="function")
def db_session():
    # 테스트용 인메모리 DB 생성
    engine = create_engine("sqlite:///:memory:")
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    yield db
    db.close()

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
    
    account = Account(user_id=user.id, name="테스트계좌", type="주식")
    db_session.add(account)
    db_session.commit()
    
    saved_account = db_session.query(Account).filter_by(name="테스트계좌").first()
    assert saved_account is not None
    assert saved_account.user_id == user.id

def test_create_asset(db_session):
    """자산 마스터 생성을 테스트합니다."""
    asset = Asset(ticker="AAPL", name="애플", category="주식")
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
    
    account = Account(user_id=user.id, name="테스트계좌", type="주식")
    asset = Asset(ticker="KRW", name="원화예수금", category="현금")
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
    
    account = Account(user_id=user.id, name="테스트계좌", type="주식")
    db_session.add(account)
    db_session.commit()
    
    snapshot = AccountSnapshot(
        account_id=account.id,
        snapshot_date=datetime.date.today(),
        total_deposit=1000000.0,
        total_valuation=1100000.0,
        total_profit=100000.0
    )
    db_session.add(snapshot)
    db_session.commit()
    
    saved_snapshot = db_session.query(AccountSnapshot).first()
    assert saved_snapshot is not None
    assert saved_snapshot.total_profit == 100000.0
