"""은행 스냅샷 손익 정렬 마이그레이션 스크립트 단위 테스트."""

import pytest
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.backend.models import Base, Account, Asset, Transaction, AccountSnapshot
from scripts.migrate_bank_snapshots import run_migration


@pytest.fixture
def migration_test_db(tmp_path):
    """임시 SQLite DB 및 세션을 생성합니다."""
    db_file = tmp_path / "test_migration.db"
    db_url = f"sqlite:///{db_file}"
    engine = create_engine(db_url)
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    db = TestingSessionLocal()
    
    # 1. 원화 자산 생성
    krw = Asset(id=1, ticker="KRW", name="원화", major_category="현금", sub_category="원화예수금", country="KR")
    # 2. 은행 계좌 2개 생성 (1번: 마이그레이션 대상, 2번: 타 계좌)
    acc1 = Account(id=10, user_id=1, name="카카오뱅크", provider="카카오", account_type="BANK", is_active=True)
    acc2 = Account(id=20, user_id=1, name="토스뱅크", provider="토스", account_type="BANK", is_active=True)
    
    db.add_all([krw, acc1, acc2])
    db.commit()
    
    # 3. acc1 거래 및 스냅샷 생성
    # 2026-07-01: 초기 잔액 1,000만, 이자 5만
    tx1_init = Transaction(account_id=10, asset_id=1, transaction_date=datetime.date(2026, 7, 1), type="INITIAL_BALANCE", quantity=10000000.0, price=1.0, total_amount=10000000.0, currency="KRW")
    tx1_int = Transaction(account_id=10, asset_id=1, transaction_date=datetime.date(2026, 7, 1), type="INTEREST", quantity=50000.0, price=1.0, total_amount=50000.0, currency="KRW")
    
    # 2026-07-01 스냅샷 1: 구버전 로직에 의해 period_deposit이 0으로 잘못 저장되어 있고 total_profit은 50,000원
    snap1 = AccountSnapshot(id=101, account_id=10, snapshot_date=datetime.date(2026, 7, 1), period_deposit=0.0, total_valuation=10050000.0, total_profit=50000.0)
    
    # 2026-07-15 ~ 2026-08-01: 입금 100만, 출금 50만, 이자 2만, 세금 3천
    tx2_dep = Transaction(account_id=10, asset_id=1, transaction_date=datetime.date(2026, 7, 15), type="DEPOSIT", quantity=1000000.0, price=1.0, total_amount=1000000.0, currency="KRW")
    tx2_wd = Transaction(account_id=10, asset_id=1, transaction_date=datetime.date(2026, 7, 20), type="WITHDRAW", quantity=500000.0, price=1.0, total_amount=500000.0, currency="KRW")
    tx2_int = Transaction(account_id=10, asset_id=1, transaction_date=datetime.date(2026, 7, 25), type="INTEREST", quantity=20000.0, price=1.0, total_amount=20000.0, currency="KRW")
    tx2_tax = Transaction(account_id=10, asset_id=1, transaction_date=datetime.date(2026, 7, 25), type="TAX", quantity=3000.0, price=1.0, total_amount=3000.0, currency="KRW")
    
    # 2026-08-01 스냅샷 2: 잔액 = 10,050,000 + 500,000 + 17,000 = 10,567,000원
    # 구버전 버그로 total_profit이 과거 누적 손익인 67,000원으로 기록됨
    snap2 = AccountSnapshot(id=102, account_id=10, snapshot_date=datetime.date(2026, 8, 1), period_deposit=0.0, total_valuation=10567000.0, total_profit=67000.0)
    
    # 2026-08-15 ~ 2026-09-01: 단순 입출금만 발생 (입금 20만, 출금 20만), 손익 0원
    # 잔액 = 10,567,000원 그대로 유지
    # 구버전 버그로 total_profit이 여전히 과거 누적치인 67,000원으로 고정 저장됨
    snap3 = AccountSnapshot(id=103, account_id=10, snapshot_date=datetime.date(2026, 9, 1), period_deposit=0.0, total_valuation=10567000.0, total_profit=67000.0)
    
    db.add_all([tx1_init, tx1_int, snap1, tx2_dep, tx2_wd, tx2_int, tx2_tax, snap2, snap3])
    db.commit()
    db.close()
    
    return db_file


def test_migration_dry_run(migration_test_db):
    """--dry-run 시 DB를 실제로 변경하지 않고 계산 결과만 정상 산출하는지 검증."""
    results = run_migration(
        db_path=str(migration_test_db),
        dry_run=True,
        no_backup=True
    )
    
    assert len(results) == 3
    
    # snap1 검증
    r1 = next(r for r in results if r["snapshot_id"] == 101)
    assert r1["new_period_deposit"] == 10000000.0
    assert r1["new_period_profit"] == 50000.0
    
    # snap2 검증 (입금 100만 - 출금 50만 = 순입금 50만, 이자 2만 - 세금 3천 = 손익 1.7만)
    r2 = next(r for r in results if r["snapshot_id"] == 102)
    assert r2["new_period_deposit"] == 500000.0
    assert r2["new_period_profit"] == 17000.0
    
    # snap3 검증 (추가 손익 없으므로 기간 손익은 0원이어야 함)
    r3 = next(r for r in results if r["snapshot_id"] == 103)
    assert r3["new_period_deposit"] == 0.0
    assert r3["new_period_profit"] == 0.0
    
    # DB 조회하여 실제로 변경되지 않았는지 확인 (dry-run)
    engine = create_engine(f"sqlite:///{migration_test_db}")
    Session = sessionmaker(bind=engine)
    session = Session()
    s2 = session.query(AccountSnapshot).filter(AccountSnapshot.id == 102).first()
    assert s2.period_deposit == 0.0
    assert s2.total_profit == 67000.0
    session.close()


def test_migration_actual_run(migration_test_db):
    """실제 마이그레이션 실행 시 DB 레코드가 올바르게 업데이트되는지 검증."""
    results = run_migration(
        db_path=str(migration_test_db),
        dry_run=False,
        no_backup=True
    )
    
    assert len(results) == 3
    
    engine = create_engine(f"sqlite:///{migration_test_db}")
    Session = sessionmaker(bind=engine)
    session = Session()
    
    s1 = session.query(AccountSnapshot).filter(AccountSnapshot.id == 101).first()
    assert s1.period_deposit == 10000000.0
    assert s1.total_profit == 50000.0
    
    s2 = session.query(AccountSnapshot).filter(AccountSnapshot.id == 102).first()
    assert s2.period_deposit == 500000.0
    assert s2.total_profit == 17000.0
    
    s3 = session.query(AccountSnapshot).filter(AccountSnapshot.id == 103).first()
    assert s3.period_deposit == 0.0
    assert s3.total_profit == 0.0
    
    session.close()
