"""스냅샷 현금계좌 우선 처리 및 계좌 간 이체(TRANSFER) 연동 단위/통합 테스트."""

import pytest
from datetime import date
from sqlalchemy.orm import Session

from src.backend.models import User, Account, Asset, Transaction, AccountSnapshot, ExchangeRate
from src.backend.schemas import (
    TransactionSchema,
    BrokerageCalculateRequest,
    BrokerageSaveAccountRequest,
    BankCalculateRequest,
    BankSaveAccountRequest,
    UnifiedSaveRequest,
)
from src.backend.services.snapshot_engine import SnapshotEngine
from src.backend.services.ledger_engine import LedgerEngine


@pytest.fixture
def seed_transfer_data(db_session: Session):
    """테스트용 사용자, 계좌, 자산, 초기 스냅샷/거래 시딩."""
    user = User(id=10, name="이체테스터")
    acc_bank = Account(id=20, user_id=10, name="국민은행", provider="KB국민", account_type="BANK", is_active=True)
    acc_brokerage = Account(id=21, user_id=10, name="키움증권", provider="키움", account_type="BROKERAGE", is_active=True)

    asset_krw = Asset(id=30, ticker="KRW", name="원화현금", major_category="현금", sub_category="원화예수금", country="KR")
    asset_usd = Asset(id=31, ticker="USD", name="달러현금", major_category="현금", sub_category="달러예수금", country="US")
    rate = ExchangeRate(date=date(2026, 8, 1), currency="USD", rate=1350.0)

    db_session.add_all([user, acc_bank, acc_brokerage, asset_krw, asset_usd, rate])
    db_session.commit()

    # 2026-07-01 초기 잔액
    tx_bank_init = Transaction(
        account_id=20,
        asset_id=30,
        transaction_date=date(2026, 7, 1),
        type="INITIAL_BALANCE",
        quantity=1000000.0,
        price=1.0,
        total_amount=1000000.0,
        currency="KRW",
    )
    tx_brokerage_init = Transaction(
        account_id=21,
        asset_id=30,
        transaction_date=date(2026, 7, 1),
        type="INITIAL_BALANCE",
        quantity=500000.0,
        price=1.0,
        total_amount=500000.0,
        currency="KRW",
    )
    snap_bank = AccountSnapshot(
        account_id=20,
        snapshot_date=date(2026, 7, 1),
        period_deposit=1000000.0,
        total_valuation=1000000.0,
        total_profit=0.0,
    )
    snap_brokerage = AccountSnapshot(
        account_id=21,
        snapshot_date=date(2026, 7, 1),
        period_deposit=500000.0,
        total_valuation=500000.0,
        total_profit=0.0,
    )

    db_session.add_all([tx_bank_init, tx_brokerage_init, snap_bank, snap_brokerage])
    db_session.commit()

    return {
        "acc_bank": acc_bank,
        "acc_brokerage": acc_brokerage,
        "asset_krw": asset_krw,
        "asset_usd": asset_usd,
    }


def test_transaction_schema_target_account_id(db_session, seed_transfer_data):
    """TransactionSchema에 target_account_id 필드가 추가되고 ORM 생성 시 안전하게 제외되는지 검증."""
    tx_schema = TransactionSchema(
        account_id=20,
        asset_id=30,
        target_account_id=21,
        transaction_date=date(2026, 8, 1),
        type="TRANSFER",
        quantity=100000.0,
        price=1.0,
        total_amount=100000.0,
        currency="KRW",
    )
    assert tx_schema.target_account_id == 21

    engine = SnapshotEngine(db_session)
    tx_model = engine._create_transaction_from_schema(tx_schema, asset_id=30)
    assert isinstance(tx_model, Transaction)
    assert not hasattr(tx_model, "target_account_id") or not "target_account_id" in tx_model.__table__.columns


def test_ledger_engine_replay_transfer():
    """LedgerEngine.replay 및 calculate_net_deposits에서 TRANSFER가 출금과 동일하게 계산되는지 검증."""
    krw_asset = Asset(id=30, ticker="KRW", name="원화현금", major_category="현금", sub_category="원화예수금", country="KR")
    tx_init = Transaction(
        account_id=20,
        asset_id=30,
        asset=krw_asset,
        transaction_date=date(2026, 7, 1),
        type="INITIAL_BALANCE",
        quantity=1000000.0,
        price=1.0,
        total_amount=1000000.0,
        currency="KRW",
    )
    tx_transfer = Transaction(
        account_id=20,
        asset_id=30,
        asset=krw_asset,
        transaction_date=date(2026, 7, 15),
        type="TRANSFER",
        quantity=200000.0,
        price=1.0,
        total_amount=200000.0,
        currency="KRW",
    )

    state = LedgerEngine.replay([tx_init, tx_transfer])
    assert state.cash_krw == 800000.0
    assert state.accumulated_withdrawals_krw == 200000.0

    net_dep = LedgerEngine.calculate_net_deposits([tx_init, tx_transfer], start_date=date(2026, 7, 1))
    assert net_dep == -200000.0


@pytest.mark.asyncio
async def test_snapshot_engine_calculate_bank_transfer(db_session, seed_transfer_data):
    """SnapshotEngine.calculate_bank에서 신규 TRANSFER 거래가 total_withdraw 가산 및 period_deposit 차감으로 산출되는지 검증."""
    engine = SnapshotEngine(db_session)
    new_tx = TransactionSchema(
        account_id=20,
        asset_id=30,
        target_account_id=21,
        transaction_date=date(2026, 8, 1),
        type="TRANSFER",
        quantity=150000.0,
        price=1.0,
        total_amount=150000.0,
        currency="KRW",
    )

    req = BankCalculateRequest(
        account_id=20,
        snapshot_date=date(2026, 8, 1),
        new_transactions=[new_tx],
    )
    res = await engine.calculate_bank(req)

    assert res.total_withdraw == 150000.0
    assert res.period_deposit == -150000.0
    assert res.theoretical_krw == 850000.0


@pytest.mark.asyncio
async def test_snapshot_engine_calculate_brokerage_transfer(db_session, seed_transfer_data):
    """SnapshotEngine.calculate_brokerage에서 신규 TRANSFER 거래가 period_deposit 차감 및 이론 잔액 차감으로 산출되는지 검증."""
    engine = SnapshotEngine(db_session)
    new_tx = TransactionSchema(
        account_id=21,
        asset_id=30,
        target_account_id=20,
        transaction_date=date(2026, 8, 1),
        type="TRANSFER",
        quantity=100000.0,
        price=1.0,
        total_amount=100000.0,
        currency="KRW",
    )

    req = BrokerageCalculateRequest(
        account_id=21,
        snapshot_date=date(2026, 8, 1),
        new_transactions=[new_tx],
        current_krw=400000.0,
        current_usd=0.0,
        exchange_rate=1350.0,
    )
    res = await engine.calculate_brokerage(req)

    assert res.theoretical_krw == 400000.0
    assert res.period_deposit == -100000.0
    assert res.diff_krw == 0.0


def test_process_accounts_transfer_validation_and_pair_creation(db_session, seed_transfer_data):
    """_process_bank_accounts 및 _process_brokerage_accounts에서 TRANSFER 거래의 유효성 검증과 원자적 쌍 생성을 검증."""
    engine = SnapshotEngine(db_session)

    # 1. target_account_id 누락 시 ValueError 검증
    tx_missing_target = TransactionSchema(
        account_id=20,
        asset_id=30,
        target_account_id=None,
        transaction_date=date(2026, 8, 1),
        type="TRANSFER",
        total_amount=100000.0,
        currency="KRW",
    )
    bank_req_invalid1 = BankSaveAccountRequest(account_id=20, new_transactions=[tx_missing_target])
    with pytest.raises(ValueError, match="도착 계좌.*필수"):
        engine._process_bank_accounts([bank_req_invalid1], krw_asset_id=30)

    # 2. 동일 계좌 이체 시 ValueError 검증
    tx_same_account = TransactionSchema(
        account_id=20,
        asset_id=30,
        target_account_id=20,
        transaction_date=date(2026, 8, 1),
        type="TRANSFER",
        total_amount=100000.0,
        currency="KRW",
    )
    bank_req_invalid2 = BankSaveAccountRequest(account_id=20, new_transactions=[tx_same_account])
    with pytest.raises(ValueError, match="동일"):
        engine._process_bank_accounts([bank_req_invalid2], krw_asset_id=30)

    # 3. 정상 이체 시 WITHDRAW + DEPOSIT 쌍 생성 및 동일 transfer_pair_id 공유 검증
    tx_valid_transfer = TransactionSchema(
        account_id=20,
        asset_id=30,
        target_account_id=21,
        transaction_date=date(2026, 8, 1),
        type="TRANSFER",
        total_amount=250000.0,
        currency="KRW",
        memo="적금 불입",
    )
    bank_req_valid = BankSaveAccountRequest(account_id=20, new_transactions=[tx_valid_transfer])
    engine._process_bank_accounts([bank_req_valid], krw_asset_id=30)
    db_session.flush()

    pair_txs = (
        db_session.query(Transaction)
        .filter(Transaction.transaction_date == date(2026, 8, 1))
        .all()
    )
    assert len(pair_txs) == 2
    src_tx = next(t for t in pair_txs if t.account_id == 20)
    tgt_tx = next(t for t in pair_txs if t.account_id == 21)

    assert src_tx.type == "WITHDRAW"
    assert src_tx.total_amount == 250000.0
    assert src_tx.transfer_pair_id is not None

    assert tgt_tx.type == "DEPOSIT"
    assert tgt_tx.total_amount == 250000.0
    assert tgt_tx.transfer_pair_id == src_tx.transfer_pair_id
    assert tgt_tx.memo == "적금 불입"


@pytest.mark.asyncio
async def test_save_unified_bank_first_and_transfer_integration(db_session, seed_transfer_data):
    """save_unified에서 은행 계좌 TRANSFER가 은행 출금 및 증권 입금으로 반영되고 당일 스냅샷에 정확히 반영되는지 검증."""
    engine = SnapshotEngine(db_session)

    # 은행 계좌(20)에서 증권 계좌(21)로 300,000원 이체
    tx_bank_transfer = TransactionSchema(
        account_id=20,
        asset_id=30,
        target_account_id=21,
        transaction_date=date(2026, 8, 1),
        type="TRANSFER",
        total_amount=300000.0,
        currency="KRW",
        memo="예수금 이체",
    )
    bank_req = BankSaveAccountRequest(
        account_id=20,
        total_valuation=700000.0,
        new_transactions=[tx_bank_transfer],
    )

    brokerage_req = BrokerageSaveAccountRequest(
        account_id=21,
        diff_krw=0.0,
        diff_usd=0.0,
        new_transactions=[],
    )

    save_req = UnifiedSaveRequest(
        snapshot_date=date(2026, 8, 1),
        exchange_rate=1350.0,
        bank_accounts=[bank_req],
        brokerage_accounts=[brokerage_req],
    )

    saved_snapshots = await engine.save_unified(save_req)
    assert len(saved_snapshots) >= 2

    # 오늘 날짜 스냅샷 조회
    bank_snap = next(s for s in saved_snapshots if s.account_id == 20 and s.snapshot_date == date(2026, 8, 1))
    brokerage_snap = next(s for s in saved_snapshots if s.account_id == 21 and s.snapshot_date == date(2026, 8, 1))

    # 은행 계좌: 100만 -> 70만 (-30만 입금, 평가액 70만, 손익 0)
    assert bank_snap.period_deposit == -300000.0
    assert bank_snap.total_valuation == 700000.0
    assert bank_snap.total_profit == 0.0

    # 증권 계좌: 이전 50만 + 이체입금 30만 = 80만 예수금 잔액 및 총 평가액 반영
    # period_deposit = +300000.0, total_valuation = 800000.0, total_profit = 0.0
    assert brokerage_snap.period_deposit == 300000.0
    assert brokerage_snap.total_valuation == 800000.0
    assert brokerage_snap.total_profit == 0.0
