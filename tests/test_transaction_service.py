import pytest
from datetime import date
from src.backend.models import User, Account, Asset, Transaction
from src.backend.services.transaction_service import TransactionService
from src.backend.schemas import TransactionSchema, TransferTransactionRequest


@pytest.fixture
def tx_setup(db_session):
    """트랜잭션 테스트용 데이터를 세팅합니다."""
    user = User(name="테스트유저")
    db_session.add(user)
    db_session.commit()

    acc1 = Account(user_id=user.id, name="출발계좌", provider="키움증권", account_type="BROKERAGE", is_active=True)
    acc2 = Account(user_id=user.id, name="도착계좌", provider="신한은행", account_type="BANK", is_active=True)
    db_session.add_all([acc1, acc2])

    asset_krw = Asset(ticker="KRW_TX", name="원화현금", major_category="현금", sub_category="원화예수금", country="KR")
    asset_usd = Asset(ticker="USD_TX", name="달러현금", major_category="현금", sub_category="달러예수금", country="US")
    asset_stock = Asset(ticker="AAPL_TX", name="애플", major_category="주식", sub_category="코어(지수)", country="US")
    db_session.add_all([asset_krw, asset_usd, asset_stock])

    db_session.commit()

    return acc1, acc2, asset_krw, asset_usd, asset_stock


def test_create_transaction(db_session, tx_setup):
    """단일 거래 내역 생성 로직을 검증합니다."""
    acc1, acc2, asset_krw, asset_usd, asset_stock = tx_setup
    service = TransactionService(db_session)

    tx_schema = TransactionSchema(
        account_id=acc1.id,
        asset_id=asset_krw.id,
        transaction_date=date(2026, 1, 15),
        type="DEPOSIT",
        quantity=500000.0,
        price=1.0,
        total_amount=500000.0,
        currency="KRW",
        memo="입금 테스트"
    )

    created_tx = service.create_transaction(tx_schema)
    assert created_tx.id is not None
    assert created_tx.account_id == acc1.id
    assert created_tx.total_amount == 500000.0


def test_create_transfer_pair(db_session, tx_setup):
    """계좌 이체 트랜잭션 (WITHDRAW + DEPOSIT 쌍) 원자적 생성을 검증합니다."""
    acc1, acc2, asset_krw, asset_usd, asset_stock = tx_setup
    service = TransactionService(db_session)

    req = TransferTransactionRequest(
        source_account_id=acc1.id,
        target_account_id=acc2.id,
        asset_id=asset_krw.id,
        amount=100000.0,
        transaction_date=date(2026, 1, 20),
        memo="이체 테스트"
    )

    txs = service.create_transfer_pair(req)
    assert len(txs) == 2
    withdraw_tx = next(t for t in txs if t.type == "WITHDRAW")
    deposit_tx = next(t for t in txs if t.type == "DEPOSIT")

    assert withdraw_tx.account_id == acc1.id
    assert deposit_tx.account_id == acc2.id
    assert withdraw_tx.transfer_pair_id == deposit_tx.transfer_pair_id
    assert withdraw_tx.transfer_pair_id is not None


def test_create_transfer_pair_same_account_error(db_session, tx_setup):
    """동일 계좌 간 이체 시 ValueError 예외 발생을 검증합니다."""
    acc1, acc2, asset_krw, asset_usd, asset_stock = tx_setup
    service = TransactionService(db_session)

    req = TransferTransactionRequest(
        source_account_id=acc1.id,
        target_account_id=acc1.id,
        asset_id=asset_krw.id,
        amount=100000.0,
        transaction_date=date(2026, 1, 20)
    )

    with pytest.raises(ValueError, match="동일할 수 없습니다"):
        service.create_transfer_pair(req)


def test_delete_transaction_with_pair(db_session, tx_setup):
    """이체 쌍 트랜잭션 삭제 시 연동된 거래까지 함께 삭제되는지 검증합니다."""
    acc1, acc2, asset_krw, asset_usd, asset_stock = tx_setup
    service = TransactionService(db_session)

    req = TransferTransactionRequest(
        source_account_id=acc1.id,
        target_account_id=acc2.id,
        asset_id=asset_krw.id,
        amount=50000.0,
        transaction_date=date(2026, 1, 21)
    )
    txs = service.create_transfer_pair(req)
    withdraw_id = txs[0].id

    deleted = service.delete_transaction(withdraw_id)
    assert deleted is True

    # 해당 이체 쌍 삭제 후 생성한 이체 거래들이 남아있지 않아야 함
    remaining_pair = db_session.query(Transaction).filter_by(transfer_pair_id=txs[0].transfer_pair_id).all()
    assert len(remaining_pair) == 0


def test_past_transaction_warning(db_session, tx_setup):
    """최신 스냅샷 기준일 이전 거래 생성/수정 시 경고 메시지 반환을 검증합니다."""
    from src.backend.models import AccountSnapshot
    acc1, acc2, asset_krw, asset_usd, asset_stock = tx_setup
    service = TransactionService(db_session)

    # 2026-02-01 기준 스냅샷 추가
    snapshot = AccountSnapshot(
        account_id=acc1.id,
        snapshot_date=date(2026, 2, 1),
        total_valuation=1000000.0
    )

    db_session.add(snapshot)
    db_session.commit()

    # 1. 스냅샷 이전 날짜(2026-01-15) 거래 생성 -> warning 포함
    past_tx_schema = TransactionSchema(
        account_id=acc1.id,
        asset_id=asset_krw.id,
        transaction_date=date(2026, 1, 15),
        type="DEPOSIT",
        quantity=100000.0,
        price=1.0,
        total_amount=100000.0,
        currency="KRW"
    )
    created_past_tx = service.create_transaction(past_tx_schema)
    assert created_past_tx.warning is not None
    assert "스냅샷" in created_past_tx.warning

    # 2. 스냅샷 이후 날짜(2026-02-15) 거래 생성 -> warning 없음
    future_tx_schema = TransactionSchema(
        account_id=acc1.id,
        asset_id=asset_krw.id,
        transaction_date=date(2026, 2, 15),
        type="DEPOSIT",
        quantity=50000.0,
        price=1.0,
        total_amount=50000.0,
        currency="KRW"
    )
    created_future_tx = service.create_transaction(future_tx_schema)
    assert created_future_tx.warning is None

