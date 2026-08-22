"""SnapshotEngine 단위 및 원자성 검증 테스트."""

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
    SaveSnapshotRequest,
    UnifiedSaveRequest,
)
from src.backend.services.snapshot_engine import SnapshotEngine


@pytest.fixture
def seed_snapshot_data(db_session: Session):
    """테스트용 기본 데이터(사용자, 계좌, 자산, 초기 거래) 시딩."""
    user = User(id=101, name="엔진테스터")
    acc_brokerage = Account(id=201, user_id=101, name="증권계좌1", provider="키움", account_type="BROKERAGE", is_active=True)
    acc_bank = Account(id=202, user_id=101, name="은행계좌1", provider="국민", account_type="BANK", is_active=True)
    
    asset_krw = Asset(id=301, ticker="KRW", name="원화예수금", major_category="현금", sub_category="원화예수금", country="KR")
    asset_usd = Asset(id=302, ticker="USD", name="달러예수금", major_category="현금", sub_category="달러예수금", country="US")
    asset_stock = Asset(id=303, ticker="005930", name="삼성전자", major_category="주식", sub_category="알파(성장)", country="KR")

    db_session.add_all([user, acc_brokerage, acc_bank, asset_krw, asset_usd, asset_stock])
    db_session.commit()

    # 초기 거래 기록
    tx_init_brokerage = Transaction(
        account_id=201,
        asset_id=301,
        transaction_date=date(2026, 7, 1),
        type="INITIAL_BALANCE",
        quantity=1000000.0,
        price=1.0,
        total_amount=1000000.0,
        currency="KRW"
    )
    tx_init_bank = Transaction(
        account_id=202,
        asset_id=301,
        transaction_date=date(2026, 7, 1),
        type="INITIAL_BALANCE",
        quantity=500000.0,
        price=1.0,
        total_amount=500000.0,
        currency="KRW"
    )
    db_session.add_all([tx_init_brokerage, tx_init_bank])
    db_session.commit()

    return {
        "user": user,
        "acc_brokerage": acc_brokerage,
        "acc_bank": acc_bank,
        "asset_krw": asset_krw,
        "asset_usd": asset_usd,
        "asset_stock": asset_stock,
    }


@pytest.mark.asyncio
async def test_snapshot_engine_preview(db_session, seed_snapshot_data):
    """SnapshotEngine.preview()를 통한 계좌별 평가액 및 예수금 산출 검증."""
    engine = SnapshotEngine(db_session)
    previews = await engine.preview(snapshot_date=date(2026, 8, 1), exchange_rate=1350.0)

    assert len(previews) >= 2
    brokerage_preview = next(p for p in previews if p.account_id == 201)
    bank_preview = next(p for p in previews if p.account_id == 202)

    assert brokerage_preview.total_valuation == 1000000.0
    assert bank_preview.total_valuation == 500000.0


@pytest.mark.asyncio
async def test_snapshot_engine_calculate_brokerage_diff(db_session, seed_snapshot_data):
    """SnapshotEngine.calculate_brokerage()를 통한 증권 계좌 차액 산출 검증."""
    engine = SnapshotEngine(db_session)
    
    # 신규 배당 입금 거래가 없는 상태에서 실제 잔액이 1,050,000원(50,000원 차액 발생)일 때
    req = BrokerageCalculateRequest(
        account_id=201,
        snapshot_date=date(2026, 8, 1),
        new_transactions=[],
        current_krw=1050000.0,
        current_usd=0.0,
        exchange_rate=1350.0
    )
    res = await engine.calculate_brokerage(req)
    
    assert res.theoretical_krw == 1000000.0
    assert res.diff_krw == 50000.0
    assert res.diff_usd == 0.0


@pytest.mark.asyncio
async def test_snapshot_engine_calculate_bank(db_session, seed_snapshot_data):
    """SnapshotEngine.calculate_bank()를 통한 은행 계좌 잔액 및 항목별 집계 검증."""
    engine = SnapshotEngine(db_session)
    
    new_tx = TransactionSchema(
        account_id=202,
        asset_id=301,
        transaction_date=date(2026, 7, 15),
        type="INTEREST",
        quantity=15000.0,
        price=1.0,
        total_amount=15000.0,
        currency="KRW"
    )
    req = BankCalculateRequest(
        account_id=202,
        snapshot_date=date(2026, 8, 1),
        new_transactions=[new_tx]
    )
    res = await engine.calculate_bank(req)

    assert res.theoretical_krw == 515000.0
    assert res.total_interest == 15000.0


@pytest.mark.asyncio
async def test_snapshot_engine_save_unified_atomicity(db_session, seed_snapshot_data):
    """SnapshotEngine.save_unified()의 원자적 저장 무결성(환율+보정거래+스냅샷) 검증."""
    engine = SnapshotEngine(db_session)

    brokerage_acc_req = BrokerageSaveAccountRequest(
        account_id=201,
        new_transactions=[],
        diff_krw=30000.0,  # 3만원 차액 보정
        diff_usd=0.0
    )
    bank_acc_req = BankSaveAccountRequest(
        account_id=202,
        new_transactions=[
            TransactionSchema(
                account_id=202,
                asset_id=301,
                transaction_date=date(2026, 8, 1),
                type="DEPOSIT",
                quantity=100000.0,
                price=1.0,
                total_amount=100000.0,
                currency="KRW"
            )
        ],
        total_valuation=600000.0
    )
    req = UnifiedSaveRequest(
        snapshot_date=date(2026, 8, 1),
        exchange_rate=1350.0,
        brokerage_accounts=[brokerage_acc_req],
        bank_accounts=[bank_acc_req]
    )

    saved_snapshots = await engine.save_unified(req)
    assert len(saved_snapshots) == 2

    # 1. 환율 저장 확인
    rate_record = db_session.query(ExchangeRate).filter(ExchangeRate.date == date(2026, 8, 1)).first()
    assert rate_record is not None
    assert rate_record.rate == 1350.0

    # 2. CASH_ADJUSTMENT 보정 거래 생성 확인
    adj_tx = db_session.query(Transaction).filter(
        Transaction.account_id == 201,
        Transaction.type == "CASH_ADJUSTMENT",
        Transaction.transaction_date == date(2026, 8, 1)
    ).first()
    assert adj_tx is not None
    assert adj_tx.total_amount == 30000.0

    # 3. 스냅샷 캐시 영속화 확인
    snaps = db_session.query(AccountSnapshot).filter(AccountSnapshot.snapshot_date == date(2026, 8, 1)).all()
    assert len(snaps) == 2


def test_snapshot_engine_delete_and_latest(db_session, seed_snapshot_data):
    """SnapshotEngine의 최신 날짜 조회 및 삭제 동작 검증."""
    engine = SnapshotEngine(db_session)

    # 스냅샷 생성
    snap = AccountSnapshot(
        account_id=201,
        snapshot_date=date(2026, 8, 1),
        period_deposit=0.0,
        total_valuation=1030000.0,
        total_profit=30000.0
    )
    db_session.add(snap)
    db_session.commit()

    # 최신 날짜 조회
    latest = engine.get_latest_snapshot_date()
    assert latest == date(2026, 8, 1)

    # 삭제
    engine.delete_snapshots_by_date(date(2026, 8, 1))
    db_session.commit()

    assert engine.get_latest_snapshot_date() is None


@pytest.mark.asyncio
async def test_snapshot_engine_integrity_warnings(db_session, seed_snapshot_data):
    """SnapshotEngine의 정합성 경고(차액 발생, 은행 계좌 비정상 수익) 생성 검증."""
    engine = SnapshotEngine(db_session)

    # 1. 증권 계좌 차액 발생 시 경고 검증
    req_brokerage = BrokerageCalculateRequest(
        account_id=201,
        snapshot_date=date(2026, 8, 1),
        new_transactions=[],
        current_krw=1050000.0,
        current_usd=10.0,
        exchange_rate=1350.0
    )
    res_brokerage = await engine.calculate_brokerage(req_brokerage)
    assert len(res_brokerage.integrity_warnings) >= 2
    assert any("원화 차액" in w for w in res_brokerage.integrity_warnings)
    assert any("달러 차액" in w for w in res_brokerage.integrity_warnings)

    # 2. 은행 계좌 비정상 수익 발생 시 경고 검증 (초기 50만원 계좌인데 추가 거래 없이 잔고가 60만원으로 변동되어 기간수익 10만원 발생 시)
    # 거래 없이 잔고가 변한 경우 (신규 트랜잭션 없이 이전 스냅샷 대비 잔고 차이)
    snap_bank_prev = AccountSnapshot(
        account_id=202,
        snapshot_date=date(2026, 7, 1),
        period_deposit=500000.0,
        total_valuation=500000.0,
        total_profit=0.0
    )
    db_session.add(snap_bank_prev)
    db_session.commit()

    # 신규 거래로 10만원 입금이 아니라 이체나 다른 유형으로 처리되어 period_profit이 발생하는 경우 테스트
    # 혹은 calculate_bank에서 period_profit != 0 일 때 경고 발생
    req_bank = BankCalculateRequest(
        account_id=202,
        snapshot_date=date(2026, 8, 1),
        new_transactions=[
            TransactionSchema(
                account_id=202,
                asset_id=301,
                transaction_date=date(2026, 7, 20),
                type="CASH_ADJUSTMENT",
                quantity=50000.0,
                price=1.0,
                total_amount=50000.0,
                currency="KRW"
            )
        ]
    )
    res_bank = await engine.calculate_bank(req_bank)
    assert res_bank.period_profit == 50000.0
    assert len(res_bank.integrity_warnings) >= 1
    assert any("기간 수익" in w for w in res_bank.integrity_warnings)

