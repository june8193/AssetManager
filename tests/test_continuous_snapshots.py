"""연속 스냅샷 자동 산출(Continuous Snapshot Backfill) 단위 및 통합 테스트."""

import pytest
from datetime import date, timedelta
from sqlalchemy.orm import Session

from src.backend.models import User, Account, Asset, Transaction, AccountSnapshot, ExchangeRate, HistoricalPrice
from src.backend.schemas import (
    TransactionSchema,
    BrokerageSaveAccountRequest,
    BankSaveAccountRequest,
    UnifiedSaveRequest,
    SnapshotPreviewSchema,
)
from src.backend.services.snapshot_engine import SnapshotEngine


@pytest.fixture
def continuous_snapshot_fixture(db_session: Session):
    """연속 스냅샷 테스트를 위한 사용자, 계좌, 자산, 초기 스냅샷 데이터 설정."""
    user = User(id=301, name="연속스냅샷테스터")
    acc_brokerage = Account(id=401, user_id=301, name="테스트증권", provider="키움", account_type="BROKERAGE", is_active=True)
    acc_bank = Account(id=402, user_id=301, name="테스트은행", provider="국민", account_type="BANK", is_active=True)

    asset_krw = Asset(id=501, ticker="KRW", name="원화예수금", major_category="현금", sub_category="원화예수금", country="KR")
    asset_usd = Asset(id=502, ticker="USD", name="달러예수금", major_category="현금", sub_category="달러예수금", country="US")
    asset_stock = Asset(id=503, ticker="005930", name="삼성전자", major_category="주식", sub_category="알파(성장)", country="KR")

    db_session.add_all([user, acc_brokerage, acc_bank, asset_krw, asset_usd, asset_stock])
    db_session.commit()

    # 1. 2026-08-01 기준 초기 거래 및 환율/시세
    db_session.add(ExchangeRate(date=date(2026, 8, 1), currency="USD", rate=1300.0))
    db_session.add(HistoricalPrice(ticker="005930", price_date=date(2026, 8, 1), close_price=50000.0))

    # 계좌 401 초기 예수금 1,000,000원 + 삼성전자 10주 매수 (500,000원 매수 -> 예수금 500,000원, 주식 10주)
    tx_init_brokerage = Transaction(
        account_id=401,
        asset_id=501,
        transaction_date=date(2026, 8, 1),
        type="INITIAL_BALANCE",
        quantity=1000000.0,
        price=1.0,
        total_amount=1000000.0,
        currency="KRW"
    )
    tx_buy_stock = Transaction(
        account_id=401,
        asset_id=503,
        transaction_date=date(2026, 8, 1),
        type="BUY",
        quantity=10.0,
        price=50000.0,
        total_amount=500000.0,
        currency="KRW"
    )
    # 계좌 402 은행 초기 잔고 500,000원
    tx_init_bank = Transaction(
        account_id=402,
        asset_id=501,
        transaction_date=date(2026, 8, 1),
        type="INITIAL_BALANCE",
        quantity=500000.0,
        price=1.0,
        total_amount=500000.0,
        currency="KRW"
    )
    db_session.add_all([tx_init_brokerage, tx_buy_stock, tx_init_bank])
    db_session.commit()

    # 2. 2026-08-01 직전 스냅샷 생성
    snap_brokerage_801 = AccountSnapshot(
        account_id=401,
        snapshot_date=date(2026, 8, 1),
        period_deposit=1000000.0,
        total_valuation=1000000.0,  # 50만 현금 + 10주 * 5만 = 100만원
        total_profit=0.0
    )
    snap_bank_801 = AccountSnapshot(
        account_id=402,
        snapshot_date=date(2026, 8, 1),
        period_deposit=500000.0,
        total_valuation=500000.0,
        total_profit=0.0
    )
    db_session.add_all([snap_brokerage_801, snap_bank_801])
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
async def test_continuous_snapshot_backfill_all_calendar_days(db_session, continuous_snapshot_fixture):
    """직전 스냅샷(8/1) 이후 8/5에 스냅샷 저장 시 중간 8/2, 8/3, 8/4 스냅샷이 모두 자동 생성되는지 검증."""
    engine = SnapshotEngine(db_session)

    # 8/3에 추가 원장 거래 발생: 100,000원 입금
    tx_deposit = Transaction(
        account_id=401,
        asset_id=501,
        transaction_date=date(2026, 8, 3),
        type="DEPOSIT",
        quantity=100000.0,
        price=1.0,
        total_amount=100000.0,
        currency="KRW"
    )
    db_session.add(tx_deposit)

    # 8/4에 삼성전자 종가 상승 (50,000 -> 55,000)
    db_session.add(HistoricalPrice(ticker="005930", price_date=date(2026, 8, 4), close_price=55000.0))
    db_session.commit()

    # 8/5 스냅샷 저장 요청 (8/5 당일에 20,000원 예수금 보정 차액 발생)
    req = UnifiedSaveRequest(
        snapshot_date=date(2026, 8, 5),
        exchange_rate=1320.0,
        brokerage_accounts=[
            BrokerageSaveAccountRequest(
                account_id=401,
                new_transactions=[],
                diff_krw=20000.0,  # 8/5에만 반영되어야 하는 CASH_ADJUSTMENT
                diff_usd=0.0
            )
        ],
        bank_accounts=[
            BankSaveAccountRequest(
                account_id=402,
                new_transactions=[],
                total_valuation=500000.0
            )
        ]
    )

    saved_snapshots = await engine.save_unified(req)

    # 8/2, 8/3, 8/4, 8/5 총 4일치 스냅샷이 DB에 저장되어야 함 (계좌 2개 x 4일 = 8개)
    all_snapshots = db_session.query(AccountSnapshot).order_by(AccountSnapshot.snapshot_date.asc(), AccountSnapshot.account_id.asc()).all()
    # 8/1(2개) + 8/2(2개) + 8/3(2개) + 8/4(2개) + 8/5(2개) = 10개
    assert len(all_snapshots) == 10

    # 날짜별 스냅샷 검증
    dates = {s.snapshot_date for s in all_snapshots}
    assert dates == {
        date(2026, 8, 1),
        date(2026, 8, 2),
        date(2026, 8, 3),
        date(2026, 8, 4),
        date(2026, 8, 5),
    }

    # 계좌 401의 일별 평가액 및 손익 세부 검증:
    snaps_401 = {s.snapshot_date: s for s in all_snapshots if s.account_id == 401}

    # 8/2: 거래 없음, 주가 8/1 종가(50,000) Forward-fill -> 평가액 1,000,000원, 손익 0
    assert snaps_401[date(2026, 8, 2)].total_valuation == 1000000.0
    assert snaps_401[date(2026, 8, 2)].period_deposit == 0.0
    assert snaps_401[date(2026, 8, 2)].total_profit == 0.0

    # 8/3: 100,000원 입금 발생, 주가 50,000 Forward-fill -> 평가액 1,100,000원, period_deposit=100,000, 손익 0
    assert snaps_401[date(2026, 8, 3)].total_valuation == 1100000.0
    assert snaps_401[date(2026, 8, 3)].period_deposit == 100000.0
    assert snaps_401[date(2026, 8, 3)].total_profit == 0.0

    # 8/4: 거래 없음, 주가 55,000원(+5,000원 x 10주 = +50,000원) -> 평가액 1,150,000원, period_deposit=0, 손익 50,000
    assert snaps_401[date(2026, 8, 4)].total_valuation == 1150000.0
    assert snaps_401[date(2026, 8, 4)].period_deposit == 0.0
    assert snaps_401[date(2026, 8, 4)].total_profit == 50000.0

    # 8/5: 오늘 날짜 CASH_ADJUSTMENT 20,000원 반영 -> 평가액 1,170,000원, 손익 20,000원 (8/4 대비)
    assert snaps_401[date(2026, 8, 5)].total_valuation == 1170000.0


@pytest.mark.asyncio
async def test_continuous_snapshot_cash_adjustment_isolation(db_session, continuous_snapshot_fixture):
    """오늘 날짜(T_today)에 생성된 CASH_ADJUSTMENT가 과거 중간 날짜(T_intermediate)에 영향을 주지 않는지 검증."""
    engine = SnapshotEngine(db_session)

    # 8/4 스냅샷 저장 (8/2, 8/3 중간 생성)
    # 오늘 8/4에 CASH_ADJUSTMENT 500,000원 대폭 추가
    req = UnifiedSaveRequest(
        snapshot_date=date(2026, 8, 4),
        exchange_rate=1300.0,
        brokerage_accounts=[
            BrokerageSaveAccountRequest(
                account_id=401,
                new_transactions=[],
                diff_krw=500000.0,
                diff_usd=0.0
            )
        ],
        bank_accounts=[
            BankSaveAccountRequest(
                account_id=402,
                new_transactions=[],
                total_valuation=500000.0
            )
        ]
    )

    await engine.save_unified(req)

    # 8/2, 8/3 스냅샷의 평가액은 여전히 1,000,000원이어야 함 (500,000원이 과거에 섞여 들어가지 않음)
    snap_802 = db_session.query(AccountSnapshot).filter(AccountSnapshot.account_id == 401, AccountSnapshot.snapshot_date == date(2026, 8, 2)).first()
    snap_803 = db_session.query(AccountSnapshot).filter(AccountSnapshot.account_id == 401, AccountSnapshot.snapshot_date == date(2026, 8, 3)).first()
    snap_804 = db_session.query(AccountSnapshot).filter(AccountSnapshot.account_id == 401, AccountSnapshot.snapshot_date == date(2026, 8, 4)).first()

    assert snap_802.total_valuation == 1000000.0
    assert snap_803.total_valuation == 1000000.0
    assert snap_804.total_valuation == 1500000.0


@pytest.mark.asyncio
async def test_continuous_snapshot_atomic_rollback(db_session, continuous_snapshot_fixture, monkeypatch):
    """중간 스냅샷 또는 오늘 스냅샷 저장 중 예외 발생 시 전체 트랜잭션이 롤백되는지 검증."""
    engine = SnapshotEngine(db_session)

    # 저장 도중 고의로 예외 유발
    def mock_preview_error(*args, **kwargs):
        raise RuntimeError("강제 시뮬레이션 에러")

    monkeypatch.setattr(engine, "preview", mock_preview_error)

    req = UnifiedSaveRequest(
        snapshot_date=date(2026, 8, 4),
        exchange_rate=1300.0,
        brokerage_accounts=[
            BrokerageSaveAccountRequest(account_id=401, new_transactions=[], diff_krw=10000.0, diff_usd=0.0)
        ],
        bank_accounts=[]
    )

    with pytest.raises(RuntimeError):
        await engine.save_unified(req)

    # 롤백되었으므로 8/2, 8/3, 8/4 스냅샷이 생성되지 않아야 하고, CASH_ADJUSTMENT도 없어야 함
    snapshots = db_session.query(AccountSnapshot).filter(AccountSnapshot.snapshot_date > date(2026, 8, 1)).all()
    assert len(snapshots) == 0

    adj_txs = db_session.query(Transaction).filter(Transaction.type == "CASH_ADJUSTMENT").all()
    assert len(adj_txs) == 0


@pytest.mark.asyncio
async def test_continuous_snapshot_foreign_asset_and_forward_fill_exchange_rate(db_session, continuous_snapshot_fixture):
    """외화(USD) 자산 및 시세/환율 Forward-fill이 적용되어 중간 스냅샷이 정확히 계산되는지 검증."""
    engine = SnapshotEngine(db_session)

    # 미국 주식(AAPL) 자산 추가
    asset_us_stock = Asset(id=504, ticker="AAPL", name="애플", major_category="주식", sub_category="알파(성장)", country="US")
    db_session.add(asset_us_stock)
    db_session.commit()

    # 8/1: USD 환율 1,300원, AAPL 종가 $200
    db_session.add(HistoricalPrice(ticker="AAPL", price_date=date(2026, 8, 1), close_price=200.0))
    # 8/1: 계좌 401에 USD 2,000 입금 후 AAPL 10주 매수 (달러 결제 $2,000)
    tx_deposit_usd = Transaction(
        account_id=401,
        asset_id=502,
        transaction_date=date(2026, 8, 1),
        type="DEPOSIT",
        quantity=2000.0,
        price=1.0,
        total_amount=2000.0,
        currency="USD"
    )
    tx_buy_aapl = Transaction(
        account_id=401,
        asset_id=504,
        transaction_date=date(2026, 8, 1),
        type="BUY",
        quantity=10.0,
        price=200.0,
        total_amount=2000.0,
        currency="USD"
    )
    db_session.add_all([tx_deposit_usd, tx_buy_aapl])
    db_session.commit()

    # 8/3: 새로운 환율 기록 (1,300 -> 1,350원). 8/2와 8/3의 AAPL 시세는 별도 기록 없으므로 8/1 종가($200)로 Forward-fill 됨.
    db_session.add(ExchangeRate(date=date(2026, 8, 3), currency="USD", rate=1350.0))
    db_session.commit()

    # 8/4 스냅샷 저장
    req = UnifiedSaveRequest(
        snapshot_date=date(2026, 8, 4),
        exchange_rate=1350.0,
        brokerage_accounts=[BrokerageSaveAccountRequest(account_id=401, new_transactions=[], diff_krw=0.0, diff_usd=0.0)],
        bank_accounts=[BankSaveAccountRequest(account_id=402, new_transactions=[], total_valuation=500000.0)]
    )
    await engine.save_unified(req)

    # 8/2: 환율 1,300원(8/1 환율), AAPL 10주 * $200 * 1300원 = 2,600,000원 + 삼성전자 10주*50000원 + KRW예수금
    # 8/3: 환율 1,350원(8/3 환율), AAPL 10주 * $200 * 1350원 = 2,700,000원 -> 환율 상승으로 평가액 100,000원 증가
    snap_802 = db_session.query(AccountSnapshot).filter(AccountSnapshot.account_id == 401, AccountSnapshot.snapshot_date == date(2026, 8, 2)).first()
    snap_803 = db_session.query(AccountSnapshot).filter(AccountSnapshot.account_id == 401, AccountSnapshot.snapshot_date == date(2026, 8, 3)).first()

    assert snap_802 is not None
    assert snap_803 is not None
    assert snap_803.total_valuation - snap_802.total_valuation == pytest.approx(100000.0)


@pytest.mark.asyncio
async def test_continuous_snapshot_consecutive_days_no_gap(db_session, continuous_snapshot_fixture):
    """직전 스냅샷(8/1) 바로 다음 날인 8/2에 스냅샷 저장 시 중간 날짜 생성 없이 정상 저장되는지 검증."""
    engine = SnapshotEngine(db_session)

    req = UnifiedSaveRequest(
        snapshot_date=date(2026, 8, 2),
        exchange_rate=1300.0,
        brokerage_accounts=[BrokerageSaveAccountRequest(account_id=401, new_transactions=[], diff_krw=0.0, diff_usd=0.0)],
        bank_accounts=[BankSaveAccountRequest(account_id=402, new_transactions=[], total_valuation=500000.0)]
    )
    saved = await engine.save_unified(req)

    # 8/2 스냅샷 2개만 반환되어야 함 (중간 날짜 생성 없음)
    assert len(saved) == 2
    assert all(s.snapshot_date == date(2026, 8, 2) for s in saved)

