"""스냅샷 다중 날짜 일괄 삭제 기능에 대한 TDD 단위 및 API 테스트 모듈."""

import pytest
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.backend.main import app
from src.backend.database import get_db
from src.backend.models import Account, AccountSnapshot, Asset, Transaction, User
from src.backend.services.snapshot_engine import SnapshotEngine


def setup_test_snapshots_and_adjustments(db: Session):
    """테스트용 계좌, 스냅샷, CASH_ADJUSTMENT 트랜잭션을 생성합니다."""
    user = User(name="testuser_batch_delete")
    db.add(user)
    db.commit()
    db.refresh(user)

    krw = Asset(ticker="KRW", name="원화", major_category="현금", sub_category="원화예수금", country="KR")
    db.add(krw)
    db.commit()
    db.refresh(krw)

    acc1 = Account(name="계좌1", provider="KB", account_type="BROKERAGE", is_active=True, user_id=user.id)
    acc2 = Account(name="계좌2", provider="신한", account_type="BANK", is_active=True, user_id=user.id)
    db.add_all([acc1, acc2])
    db.commit()
    db.refresh(acc1)
    db.refresh(acc2)

    # 3개 날짜(2026-05-01, 2026-05-02, 2026-05-03) 스냅샷 생성
    dates = [date(2026, 5, 1), date(2026, 5, 2), date(2026, 5, 3)]
    for d in dates:
        snap1 = AccountSnapshot(account_id=acc1.id, snapshot_date=d, period_deposit=0, total_valuation=10000, total_profit=500)
        snap2 = AccountSnapshot(account_id=acc2.id, snapshot_date=d, period_deposit=0, total_valuation=20000, total_profit=1000)
        # CASH_ADJUSTMENT 트랜잭션 추가
        tx1 = Transaction(
            account_id=acc1.id,
            asset_id=krw.id,
            transaction_date=d,
            type="CASH_ADJUSTMENT",
            quantity=0,
            price=0,
            total_amount=100,
            currency="KRW",
            memo=f"보정 {d}"
        )
        # 일반 DEPOSIT 트랜잭션 (삭제되면 안 됨)
        tx2 = Transaction(
            account_id=acc1.id,
            asset_id=krw.id,
            transaction_date=d,
            type="DEPOSIT",
            quantity=0,
            price=0,
            total_amount=500,
            currency="KRW",
            memo=f"입금 {d}"
        )
        db.add_all([snap1, snap2, tx1, tx2])
    db.commit()
    return acc1, acc2, dates


def test_delete_snapshots_batch_engine(db_session: Session):
    """SnapshotEngine.delete_snapshots_batch가 지정된 날짜들의 스냅샷 및 CASH_ADJUSTMENT만 정확히 삭제하는지 검증."""
    acc1, acc2, dates = setup_test_snapshots_and_adjustments(db_session)
    engine = SnapshotEngine(db_session)

    # 2026-05-01과 2026-05-02 2개 일자 삭제
    delete_dates = [date(2026, 5, 1), date(2026, 5, 2)]
    deleted_count = engine.delete_snapshots_batch(delete_dates)
    db_session.commit()

    assert deleted_count == 4  # 계좌 2개 x 2일자 = 4개 스냅샷

    # 삭제된 날짜 스냅샷 조회 -> 0건이어야 함
    remaining_snaps_deleted_dates = db_session.query(AccountSnapshot).filter(
        AccountSnapshot.snapshot_date.in_(delete_dates)
    ).all()
    assert len(remaining_snaps_deleted_dates) == 0

    # 2026-05-03 스냅샷은 여전히 2건 존재해야 함
    remaining_snaps_kept = db_session.query(AccountSnapshot).filter(
        AccountSnapshot.snapshot_date == date(2026, 5, 3)
    ).all()
    assert len(remaining_snaps_kept) == 2

    # CASH_ADJUSTMENT 삭제 확인
    deleted_adjustments = db_session.query(Transaction).filter(
        Transaction.transaction_date.in_(delete_dates),
        Transaction.type == "CASH_ADJUSTMENT"
    ).all()
    assert len(deleted_adjustments) == 0

    # 2026-05-03의 CASH_ADJUSTMENT는 남아있어야 함
    kept_adjustment = db_session.query(Transaction).filter(
        Transaction.transaction_date == date(2026, 5, 3),
        Transaction.type == "CASH_ADJUSTMENT"
    ).all()
    assert len(kept_adjustment) == 1

    # 일반 DEPOSIT 트랜잭션은 삭제된 날짜여도 절대 삭제되면 안 됨
    kept_deposits = db_session.query(Transaction).filter(
        Transaction.transaction_date.in_(delete_dates),
        Transaction.type == "DEPOSIT"
    ).all()
    assert len(kept_deposits) == 2


def test_delete_snapshots_batch_api(db_session: Session):
    """DELETE /api/db/snapshots/batch API 엔드포인트 동작 검증."""
    acc1, acc2, dates = setup_test_snapshots_and_adjustments(db_session)
    client = TestClient(app)

    # API 호출로 2026-05-01, 2026-05-02 삭제
    payload = {"dates": ["2026-05-01", "2026-05-02"]}
    response = client.request("DELETE", "/api/db/snapshots/batch", json=payload)

    assert response.status_code == 200
    res_data = response.json()
    assert "deleted_count" in res_data or "message" in res_data

    # DB에 반영되었는지 확인
    remaining_snaps = db_session.query(AccountSnapshot).all()
    assert len(remaining_snaps) == 2
    assert remaining_snaps[0].snapshot_date == date(2026, 5, 3)


def test_delete_snapshots_batch_empty_list(db_session: Session):
    """빈 날짜 목록으로 일괄 삭제 요청 시 정상 처리(0건 삭제) 검증."""
    acc1, acc2, dates = setup_test_snapshots_and_adjustments(db_session)
    client = TestClient(app)

    payload = {"dates": []}
    response = client.request("DELETE", "/api/db/snapshots/batch", json=payload)

    assert response.status_code == 200
    # 모든 스냅샷이 그대로 남아있어야 함
    assert db_session.query(AccountSnapshot).count() == 6
