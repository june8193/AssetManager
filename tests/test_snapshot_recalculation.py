"""스냅샷 일괄 재계산 엔진 및 API 정합성 검증 테스트 모듈입니다."""

import pytest
from datetime import date
from src.backend.models import User, Account, Asset, Transaction, AccountSnapshot
from src.backend.services.snapshot_engine import SnapshotEngine
from src.backend.schemas.snapshot import SnapshotRecalculateRequest


@pytest.fixture
def snapshot_recalc_setup(db_session):
    """재계산 테스트를 위한 사용자, 계좌, 자산, 초기 스냅샷 및 거래 내역을 구성합니다."""
    user = User(name="재계산테스터")
    db_session.add(user)
    db_session.commit()

    bank_acc = Account(user_id=user.id, name="카카오뱅크", provider="카카오뱅크", account_type="BANK", is_active=True)
    brok_acc = Account(user_id=user.id, name="키움증권", provider="키움증권", account_type="BROKERAGE", is_active=True)
    db_session.add_all([bank_acc, brok_acc])
    db_session.commit()

    krw_asset = Asset(ticker="KRW", name="원화현금", major_category="현금", sub_category="원화예수금", country="KR")
    usd_asset = Asset(ticker="USD", name="달러현금", major_category="현금", sub_category="달러예수금", country="US")
    stock_asset = Asset(ticker="005930", name="삼성전자", major_category="일반주식", sub_category="국내주식", country="KR")
    db_session.add_all([krw_asset, usd_asset, stock_asset])
    db_session.commit()

    # 1. 1월 1일 스냅샷 생성
    snap1_bank = AccountSnapshot(
        account_id=bank_acc.id,
        snapshot_date=date(2026, 1, 1),
        period_deposit=1000000.0,
        total_valuation=1000000.0,
        total_profit=0.0
    )
    snap1_brok = AccountSnapshot(
        account_id=brok_acc.id,
        snapshot_date=date(2026, 1, 1),
        period_deposit=5000000.0,
        total_valuation=5000000.0,
        total_profit=0.0
    )
    db_session.add_all([snap1_bank, snap1_brok])

    # 2. 2월 1일 스냅샷 생성 (하지만 이 시점에는 거래 내역이 아직 없거나 잘못 계산된 상태)
    snap2_bank = AccountSnapshot(
        account_id=bank_acc.id,
        snapshot_date=date(2026, 2, 1),
        period_deposit=0.0,
        total_valuation=1200000.0,
        total_profit=0.0 # 잘못 기재된 상태
    )
    snap2_brok = AccountSnapshot(
        account_id=brok_acc.id,
        snapshot_date=date(2026, 2, 1),
        period_deposit=0.0,
        total_valuation=5500000.0,
        total_profit=0.0 # 잘못 기재된 상태
    )
    db_session.add_all([snap2_bank, snap2_brok])
    db_session.commit()

    # 3. 1월 중 발생한 실제 원장 거래 내역 추가
    # 은행 계좌: 1월 15일 입금 200,000원, 1월 20일 이자 5,000원, 세금 700원
    tx1 = Transaction(account_id=bank_acc.id, asset_id=krw_asset.id, transaction_date=date(2026, 1, 15), type="DEPOSIT", quantity=200000.0, price=1.0, total_amount=200000.0, currency="KRW")
    tx2 = Transaction(account_id=bank_acc.id, asset_id=krw_asset.id, transaction_date=date(2026, 1, 20), type="INTEREST", quantity=5000.0, price=1.0, total_amount=5000.0, currency="KRW")
    tx3 = Transaction(account_id=bank_acc.id, asset_id=krw_asset.id, transaction_date=date(2026, 1, 20), type="TAX", quantity=700.0, price=1.0, total_amount=700.0, currency="KRW")

    # 증권 계좌: 1월 10일 추가 입금 300,000원
    tx4 = Transaction(account_id=brok_acc.id, asset_id=krw_asset.id, transaction_date=date(2026, 1, 10), type="DEPOSIT", quantity=300000.0, price=1.0, total_amount=300000.0, currency="KRW")

    db_session.add_all([tx1, tx2, tx3, tx4])
    db_session.commit()

    return bank_acc, brok_acc, krw_asset, usd_asset, stock_asset


@pytest.mark.asyncio
async def test_snapshot_recalculation_dry_run(db_session, snapshot_recalc_setup):
    """dry_run=True 시 DB 변경 없이 정확한 diff를 산출하는지 검증합니다."""
    bank_acc, brok_acc, krw_asset, usd_asset, stock_asset = snapshot_recalc_setup
    engine = SnapshotEngine(db_session)

    req = SnapshotRecalculateRequest(from_date=date(2026, 1, 2), dry_run=True)
    result = await engine.recalculate(req)

    assert result.dry_run is True
    assert result.total_snapshots_evaluated == 2 # 2월 1일 스냅샷 2건 (은행 1건, 증권 1건)
    assert result.total_snapshots_updated == 2 # 둘 다 변경 대상

    # 은행 diff 검증: 1월 15일 입금(200,000) -> period_deposit = 200,000, 이자(5000)-세금(700) -> period_profit = 4300
    bank_diff = next(d for d in result.diffs if d.account_id == bank_acc.id)
    assert bank_diff.new_period_deposit == 200000.0
    assert bank_diff.new_period_profit == 4300.0

    # 증권 diff 검증: 1월 10일 입금(300,000) -> period_deposit = 300,000
    # 평가액 5,500,000 - (직전 5,000,000 + 입금 300,000) = 수익 200,000
    brok_diff = next(d for d in result.diffs if d.account_id == brok_acc.id)
    assert brok_diff.new_period_deposit == 300000.0
    assert brok_diff.new_period_profit == 200000.0

    # dry_run 이므로 실제 DB에는 변경사항이 반영되지 않아야 함
    db_snap_bank = db_session.query(AccountSnapshot).filter_by(account_id=bank_acc.id, snapshot_date=date(2026, 2, 1)).first()
    assert db_snap_bank.period_deposit == 0.0


@pytest.mark.asyncio
async def test_snapshot_recalculation_execute(db_session, snapshot_recalc_setup):
    """dry_run=False 시 실제 DB 레코드가 원자적으로 갱신되는지 검증합니다."""
    bank_acc, brok_acc, krw_asset, usd_asset, stock_asset = snapshot_recalc_setup
    engine = SnapshotEngine(db_session)

    req = SnapshotRecalculateRequest(from_date=date(2026, 1, 1), dry_run=False)
    result = await engine.recalculate(req)

    assert result.dry_run is False
    assert result.total_snapshots_updated >= 2

    # DB 실제 레코드 갱신 확인
    db_snap_bank = db_session.query(AccountSnapshot).filter_by(account_id=bank_acc.id, snapshot_date=date(2026, 2, 1)).first()
    assert db_snap_bank.period_deposit == 200000.0
    assert db_snap_bank.total_profit == 4300.0

    db_snap_brok = db_session.query(AccountSnapshot).filter_by(account_id=brok_acc.id, snapshot_date=date(2026, 2, 1)).first()
    assert db_snap_brok.period_deposit == 300000.0
    assert db_snap_brok.total_profit == 200000.0


@pytest.mark.asyncio
async def test_snapshot_recalculation_api(db_session, snapshot_recalc_setup):
    """POST /api/db/snapshots/recalculate 엔드포인트 호출을 검증합니다."""
    from src.backend.routers.snapshots import recalculate_snapshots
    bank_acc, brok_acc, krw_asset, usd_asset, stock_asset = snapshot_recalc_setup

    req = SnapshotRecalculateRequest(from_date=date(2026, 1, 2), dry_run=False)
    response = await recalculate_snapshots(req, db_session)

    assert response.total_snapshots_evaluated == 2
    assert response.total_snapshots_updated == 2
    assert response.dry_run is False
    assert len(response.diffs) == 2
    assert "2개 스냅샷 갱신 완료" in response.summary_message


@pytest.mark.asyncio
async def test_multi_period_consecutive_snapshot_recalculation(db_session):
    """3개 이상 연속 스냅샷에서 각 기간별 수익 및 입출금이 독립적이고 정확하게 재산출되는지 검증합니다."""
    user = User(name="연속테스터")
    db_session.add(user)
    db_session.commit()

    acc = Account(user_id=user.id, name="테스트은행", provider="국민은행", account_type="BANK", is_active=True)
    db_session.add(acc)
    db_session.commit()

    krw = Asset(ticker="KRW_MULTI", name="원화", major_category="현금", sub_category="원화예수금", country="KR")
    db_session.add(krw)

    db_session.commit()

    # 1월 1일 (초기 잔고 1,000,000)
    snap1 = AccountSnapshot(account_id=acc.id, snapshot_date=date(2026, 1, 1), period_deposit=1000000.0, total_valuation=1000000.0, total_profit=0.0)
    # 2월 1일 (오염된 데이터: period_deposit=0, total_profit=0)
    snap2 = AccountSnapshot(account_id=acc.id, snapshot_date=date(2026, 2, 1), period_deposit=0.0, total_valuation=1500000.0, total_profit=0.0)
    # 3월 1일 (오염된 데이터: period_deposit=0, total_profit=0)
    snap3 = AccountSnapshot(account_id=acc.id, snapshot_date=date(2026, 3, 1), period_deposit=0.0, total_valuation=1800000.0, total_profit=0.0)
    db_session.add_all([snap1, snap2, snap3])
    db_session.commit()

    # 1월 중 거래: 1/15 입금 500,000, 1/25 이자 1,000
    tx1 = Transaction(account_id=acc.id, asset_id=krw.id, transaction_date=date(2026, 1, 15), type="DEPOSIT", quantity=500000.0, price=1.0, total_amount=500000.0, currency="KRW")
    tx2 = Transaction(account_id=acc.id, asset_id=krw.id, transaction_date=date(2026, 1, 25), type="INTEREST", quantity=1000.0, price=1.0, total_amount=1000.0, currency="KRW")
    # 2월 중 거래: 2/10 출금 200,000, 2/20 이자 2,000
    tx3 = Transaction(account_id=acc.id, asset_id=krw.id, transaction_date=date(2026, 2, 10), type="WITHDRAW", quantity=200000.0, price=1.0, total_amount=200000.0, currency="KRW")
    tx4 = Transaction(account_id=acc.id, asset_id=krw.id, transaction_date=date(2026, 2, 20), type="INTEREST", quantity=2000.0, price=1.0, total_amount=2000.0, currency="KRW")
    db_session.add_all([tx1, tx2, tx3, tx4])
    db_session.commit()

    engine = SnapshotEngine(db_session)
    req = SnapshotRecalculateRequest(from_date=date(2026, 1, 2), dry_run=False)
    res = await engine.recalculate(req)

    assert res.total_snapshots_updated == 2

    # 2월 1일 스냅샷: 입금 500,000, 이자 1,000
    db_session.refresh(snap2)
    assert snap2.period_deposit == 500000.0
    assert snap2.total_profit == 1000.0

    # 3월 1일 스냅샷: 출금 200,000 (period_deposit = -200,000), 이자 2,000 (total_profit = 2,000)
    db_session.refresh(snap3)
    assert snap3.period_deposit == -200000.0
    assert snap3.total_profit == 2000.0


