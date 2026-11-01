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



def test_update_standalone_to_transfer(db_session, tx_setup):
    """단독 거래를 이체(TRANSFER)로 수정 시 WITHDRAW + DEPOSIT 쌍이 생성되는지 검증합니다."""
    acc1, acc2, asset_krw, _, _ = tx_setup
    service = TransactionService(db_session)

    # 1. 단독 WITHDRAW 거래 생성
    init_tx = service.create_transaction(TransactionSchema(
        account_id=acc1.id,
        asset_id=asset_krw.id,
        transaction_date=date(2026, 3, 1),
        type="WITHDRAW",
        quantity=50000.0,
        price=1.0,
        total_amount=50000.0,
        currency="KRW",
        memo="단독 출금"
    ))
    assert init_tx.transfer_pair_id is None

    # 2. TRANSFER로 수정
    update_schema = TransactionSchema(
        account_id=acc1.id,
        target_account_id=acc2.id,
        asset_id=asset_krw.id,
        transaction_date=date(2026, 3, 2),
        type="TRANSFER",
        quantity=80000.0,
        price=1.0,
        total_amount=80000.0,
        currency="KRW",
        memo="이체로 변경"
    )
    updated_tx = service.update_transaction(init_tx.id, update_schema)

    assert updated_tx.type == "WITHDRAW"
    assert updated_tx.account_id == acc1.id
    assert updated_tx.total_amount == 80000.0
    assert updated_tx.quantity == 80000.0
    assert updated_tx.price == 1.0
    assert updated_tx.transfer_pair_id is not None

    # 상대 DEPOSIT 행 검증
    pairs = db_session.query(Transaction).filter(
        Transaction.transfer_pair_id == updated_tx.transfer_pair_id
    ).all()
    assert len(pairs) == 2

    deposit_tx = next(t for t in pairs if t.id != updated_tx.id)
    assert deposit_tx.type == "DEPOSIT"
    assert deposit_tx.account_id == acc2.id
    assert deposit_tx.total_amount == 80000.0
    assert deposit_tx.quantity == 80000.0
    assert deposit_tx.price == 1.0
    assert deposit_tx.memo == "이체로 변경"
    assert deposit_tx.transaction_date == date(2026, 3, 2)


def test_update_legacy_transfer_without_pair_to_transfer(db_session, tx_setup):
    """transfer_pair_id가 없는 기존 TRANSFER 단일 거래 수정 시 이체 쌍으로 보완 생성되는지 검증합니다."""
    acc1, acc2, asset_krw, _, _ = tx_setup
    service = TransactionService(db_session)

    single_tx = Transaction(
        account_id=acc1.id,
        asset_id=asset_krw.id,
        transaction_date=date(2026, 3, 5),
        type="TRANSFER",
        quantity=30000.0,
        price=1.0,
        total_amount=30000.0,
        currency="KRW",
        transfer_pair_id=None
    )
    db_session.add(single_tx)
    db_session.commit()
    db_session.refresh(single_tx)

    update_schema = TransactionSchema(
        account_id=acc1.id,
        target_account_id=acc2.id,
        asset_id=asset_krw.id,
        transaction_date=date(2026, 3, 6),
        type="TRANSFER",
        quantity=35000.0,
        price=1.0,
        total_amount=35000.0,
        currency="KRW"
    )
    updated_tx = service.update_transaction(single_tx.id, update_schema)

    assert updated_tx.type == "WITHDRAW"
    assert updated_tx.transfer_pair_id is not None

    pairs = db_session.query(Transaction).filter(
        Transaction.transfer_pair_id == updated_tx.transfer_pair_id
    ).all()
    assert len(pairs) == 2
    deposit_tx = next(t for t in pairs if t.id != updated_tx.id)
    assert deposit_tx.type == "DEPOSIT"
    assert deposit_tx.account_id == acc2.id
    assert deposit_tx.total_amount == 35000.0


def test_update_transfer_pair_sync_accounts_and_data(db_session, tx_setup):
    """기존 이체 쌍 수정 시 출발/도착 계좌 및 금액, 일자, 메모가 동기화되는지 검증합니다."""
    acc1, acc2, asset_krw, _, _ = tx_setup
    service = TransactionService(db_session)

    acc3 = Account(user_id=acc1.user_id, name="제3계좌", provider="카카오뱅크", account_type="BANK", is_active=True)
    db_session.add(acc3)
    db_session.commit()

    txs = service.create_transfer_pair(TransferTransactionRequest(
        source_account_id=acc1.id,
        target_account_id=acc2.id,
        asset_id=asset_krw.id,
        amount=100000.0,
        transaction_date=date(2026, 3, 10),
        memo="원래 이체"
    ))
    withdraw_tx = next(t for t in txs if t.type == "WITHDRAW")
    deposit_tx = next(t for t in txs if t.type == "DEPOSIT")

    update_schema = TransactionSchema(
        account_id=acc1.id,
        target_account_id=acc3.id,
        asset_id=asset_krw.id,
        transaction_date=date(2026, 3, 11),
        type="TRANSFER",
        quantity=120000.0,
        price=1.0,
        total_amount=120000.0,
        currency="KRW",
        memo="도착계좌 변경됨"
    )
    updated_tx = service.update_transaction(withdraw_tx.id, update_schema)

    db_session.refresh(deposit_tx)
    assert updated_tx.account_id == acc1.id
    assert updated_tx.type == "WITHDRAW"
    assert updated_tx.total_amount == 120000.0
    assert updated_tx.quantity == 120000.0

    assert deposit_tx.account_id == acc3.id
    assert deposit_tx.type == "DEPOSIT"
    assert deposit_tx.total_amount == 120000.0
    assert deposit_tx.quantity == 120000.0
    assert deposit_tx.transaction_date == date(2026, 3, 11)
    assert deposit_tx.memo == "도착계좌 변경됨"


def test_update_transfer_from_deposit_row(db_session, tx_setup):
    """DEPOSIT 행에서 수정을 호출해도 출발/도착 계좌가 올바르게 매핑되는지 검증합니다."""
    acc1, acc2, asset_krw, _, _ = tx_setup
    service = TransactionService(db_session)

    acc3 = Account(user_id=acc1.user_id, name="제3계좌", provider="카카오뱅크", account_type="BANK", is_active=True)
    db_session.add(acc3)
    db_session.commit()

    txs = service.create_transfer_pair(TransferTransactionRequest(
        source_account_id=acc1.id,
        target_account_id=acc2.id,
        asset_id=asset_krw.id,
        amount=50000.0,
        transaction_date=date(2026, 3, 10),
        memo="원래 이체"
    ))
    withdraw_tx = next(t for t in txs if t.type == "WITHDRAW")
    deposit_tx = next(t for t in txs if t.type == "DEPOSIT")

    update_schema = TransactionSchema(
        account_id=acc3.id,
        target_account_id=acc2.id,
        asset_id=asset_krw.id,
        transaction_date=date(2026, 3, 12),
        type="TRANSFER",
        quantity=60000.0,
        price=1.0,
        total_amount=60000.0,
        currency="KRW",
        memo="출발계좌 변경됨"
    )
    service.update_transaction(deposit_tx.id, update_schema)

    db_session.refresh(withdraw_tx)
    db_session.refresh(deposit_tx)

    assert withdraw_tx.account_id == acc3.id
    assert withdraw_tx.type == "WITHDRAW"
    assert withdraw_tx.total_amount == 60000.0

    assert deposit_tx.account_id == acc2.id
    assert deposit_tx.type == "DEPOSIT"
    assert deposit_tx.total_amount == 60000.0


def test_update_transfer_to_regular_transaction_deletes_pair(db_session, tx_setup):
    """기존 이체 쌍을 일반 거래로 수정 시 상대 거래가 삭제되고 transfer_pair_id가 해제되는지 검증합니다."""
    acc1, acc2, asset_krw, _, _ = tx_setup
    service = TransactionService(db_session)

    txs = service.create_transfer_pair(TransferTransactionRequest(
        source_account_id=acc1.id,
        target_account_id=acc2.id,
        asset_id=asset_krw.id,
        amount=70000.0,
        transaction_date=date(2026, 3, 10)
    ))
    withdraw_tx = next(t for t in txs if t.type == "WITHDRAW")
    deposit_tx = next(t for t in txs if t.type == "DEPOSIT")
    deposit_id = deposit_tx.id

    update_schema = TransactionSchema(
        account_id=acc1.id,
        asset_id=asset_krw.id,
        transaction_date=date(2026, 3, 15),
        type="WITHDRAW",
        quantity=70000.0,
        price=1.0,
        total_amount=70000.0,
        currency="KRW",
        memo="일반 출금으로 전환"
    )
    updated_tx = service.update_transaction(withdraw_tx.id, update_schema)

    assert updated_tx.transfer_pair_id is None
    assert updated_tx.type == "WITHDRAW"

    deleted_row = db_session.query(Transaction).filter(Transaction.id == deposit_id).first()
    assert deleted_row is None


def test_update_transfer_validation_errors(db_session, tx_setup):
    """이체 수정 시 target_account_id 누락 및 동일 계좌 지정 시 예외가 발생하는지 검증합니다."""
    acc1, acc2, asset_krw, _, _ = tx_setup
    service = TransactionService(db_session)

    init_tx = service.create_transaction(TransactionSchema(
        account_id=acc1.id,
        asset_id=asset_krw.id,
        transaction_date=date(2026, 3, 1),
        type="WITHDRAW",
        quantity=10000.0,
        price=1.0,
        total_amount=10000.0,
        currency="KRW"
    ))

    # 1. target_account_id 누락 시
    missing_target_schema = TransactionSchema(
        account_id=acc1.id,
        target_account_id=None,
        asset_id=asset_krw.id,
        transaction_date=date(2026, 3, 1),
        type="TRANSFER",
        quantity=10000.0,
        price=1.0,
        total_amount=10000.0,
        currency="KRW"
    )
    with pytest.raises(ValueError, match="도착 계좌"):
        service.update_transaction(init_tx.id, missing_target_schema)

    # 2. 출발 계좌와 도착 계좌 동일 시
    same_account_schema = TransactionSchema(
        account_id=acc1.id,
        target_account_id=acc1.id,
        asset_id=asset_krw.id,
        transaction_date=date(2026, 3, 1),
        type="TRANSFER",
        quantity=10000.0,
        price=1.0,
        total_amount=10000.0,
        currency="KRW"
    )
    with pytest.raises(ValueError, match="동일할 수 없습니다"):
        service.update_transaction(init_tx.id, same_account_schema)
