import pytest
from datetime import date
from src.backend.models import User, Account, Asset, Transaction, AccountSnapshot
from src.backend.services.snapshot_service import SnapshotService
from src.backend.schemas import SnapshotPreviewSchema, SaveSnapshotRequest


@pytest.fixture
def snapshot_setup(db_session):
    """스냅샷 테스트용 유저, 계좌, 자산 및 기본 거래 데이터를 세팅합니다."""
    user = User(name="테스트유저")
    db_session.add(user)
    db_session.commit()

    acc1 = Account(user_id=user.id, name="증권계좌", provider="키움증권", account_type="BROKERAGE", is_active=True)
    acc2 = Account(user_id=user.id, name="은행계좌", provider="신한은행", account_type="BANK", is_active=True)
    db_session.add_all([acc1, acc2])

    asset_krw = Asset(ticker="KRW_TEST", name="원화현금", major_category="현금", sub_category="원화예수금", country="KR")
    asset_stock = Asset(ticker="005930_TEST", name="삼성전자", major_category="주식", sub_category="알파(성장)", country="KR")
    db_session.add_all([asset_krw, asset_stock])

    db_session.commit()

    tx1 = Transaction(account_id=acc1.id, asset_id=asset_krw.id, transaction_date=date(2026, 1, 1), type="DEPOSIT", quantity=100000.0, price=1.0, total_amount=100000.0, currency="KRW")
    tx2 = Transaction(account_id=acc1.id, asset_id=asset_stock.id, transaction_date=date(2026, 1, 2), type="BUY", quantity=10.0, price=5000.0, total_amount=50000.0, currency="KRW")
    db_session.add_all([tx1, tx2])
    db_session.commit()

    return acc1, acc2, asset_krw, asset_stock


def test_save_snapshots_logic(db_session, snapshot_setup):
    """스냅샷 저장 및 기존 날짜 중복 삭제 로직을 검증합니다."""
    acc1, acc2, asset_krw, asset_stock = snapshot_setup
    service = SnapshotService(db_session)

    preview = SnapshotPreviewSchema(
        account_id=acc1.id,
        account_name="증권계좌",
        snapshot_date=date(2026, 1, 31),
        period_deposit=100000.0,
        total_valuation=110000.0,
        total_profit=10000.0,
        period_profit=10000.0,
        calculated_return_rate=10.0,
        current_cash=50000.0
    )

    saved = service.save_snapshots([preview])
    assert len(saved) == 1
    assert saved[0].account_id == acc1.id
    assert saved[0].total_valuation == 110000.0

    # 동일 일자 스냅샷 재저장 시 기존 데이터 삭제 후 갱신 확인
    preview_updated = SnapshotPreviewSchema(
        account_id=acc1.id,
        account_name="증권계좌",
        snapshot_date=date(2026, 1, 31),
        period_deposit=100000.0,
        total_valuation=120000.0,
        total_profit=20000.0,
        period_profit=20000.0,
        calculated_return_rate=20.0,
        current_cash=50000.0
    )
    saved_updated = service.save_snapshots([preview_updated])
    assert len(saved_updated) == 1

    snapshots_in_db = db_session.query(AccountSnapshot).filter_by(account_id=acc1.id, snapshot_date=date(2026, 1, 31)).all()
    assert len(snapshots_in_db) == 1
    assert snapshots_in_db[0].total_valuation == 120000.0


def test_delete_snapshot(db_session, snapshot_setup):
    """특정 일자의 스냅샷 삭제 기능을 검증합니다."""
    acc1, acc2, asset_krw, asset_stock = snapshot_setup
    service = SnapshotService(db_session)

    preview = SnapshotPreviewSchema(
        account_id=acc1.id,
        account_name="증권계좌",
        snapshot_date=date(2026, 1, 31),
        period_deposit=100000.0,
        total_valuation=110000.0,
        total_profit=10000.0
    )
    service.save_snapshots([preview])

    deleted_count = service.delete_snapshot(date(2026, 1, 31))
    assert deleted_count == 1

    snapshots_in_db = db_session.query(AccountSnapshot).filter_by(snapshot_date=date(2026, 1, 31)).all()
    assert len(snapshots_in_db) == 0
