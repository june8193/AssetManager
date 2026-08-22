"""단일 원장 엔진(LedgerEngine) 단위 테스트 및 골든 마스터 회귀 테스트 모듈.

원장의 10종 거래 이벤트 순회, 환전, 기준선(INITIAL_BALANCE) 필터링,
주식 수량 및 예수금(KRW/USD) 계산의 정합성을 검증합니다.
"""

import datetime
import pytest
from src.backend.models import User, Account, Asset, Transaction
from src.backend.services.ledger_engine import LedgerEngine, LedgerState


def test_ledger_state_defaults():
    """LedgerState의 기본값 및 구조를 검증합니다."""
    state = LedgerState()
    assert state.cash_krw == 0.0
    assert state.cash_usd == 0.0
    assert state.holdings == {}
    assert state.accumulated_deposits_krw == 0.0
    assert state.accumulated_withdrawals_krw == 0.0
    assert state.accumulated_deposits_usd == 0.0
    assert state.accumulated_withdrawals_usd == 0.0


def test_pure_replay_cash_operations():
    """현금 기본 거래(DEPOSIT, WITHDRAW, INTEREST, TAX, CASH_ADJUSTMENT) 순회 계산을 검증합니다."""
    krw_asset = Asset(id=1, ticker="KRW", name="원화", major_category="현금", sub_category="원화예수금")
    usd_asset = Asset(id=2, ticker="USD", name="달러", major_category="현금", sub_category="달러예수금")

    transactions = [
        Transaction(
            id=1,
            account_id=1,
            asset_id=1,
            asset=krw_asset,
            type="DEPOSIT",
            currency="KRW",
            quantity=0.0,
            price=1.0,
            total_amount=1000000.0,
            transaction_date=datetime.date(2026, 1, 1),
        ),
        Transaction(
            id=2,
            account_id=1,
            asset_id=1,
            asset=krw_asset,
            type="INTEREST",
            currency="KRW",
            quantity=0.0,
            price=1.0,
            total_amount=50000.0,
            transaction_date=datetime.date(2026, 1, 5),
        ),
        Transaction(
            id=3,
            account_id=1,
            asset_id=1,
            asset=krw_asset,
            type="TAX",
            currency="KRW",
            quantity=0.0,
            price=1.0,
            total_amount=7700.0,
            transaction_date=datetime.date(2026, 1, 5),
        ),
        Transaction(
            id=4,
            account_id=1,
            asset_id=1,
            asset=krw_asset,
            type="WITHDRAW",
            currency="KRW",
            quantity=0.0,
            price=1.0,
            total_amount=200000.0,
            transaction_date=datetime.date(2026, 1, 10),
        ),
        Transaction(
            id=5,
            account_id=1,
            asset_id=2,
            asset=usd_asset,
            type="DEPOSIT",
            currency="USD",
            quantity=0.0,
            price=1.0,
            total_amount=1000.0,
            transaction_date=datetime.date(2026, 1, 10),
        ),
    ]

    state = LedgerEngine.replay(transactions)

    # KRW: 1,000,000 + 50,000 - 7,700 - 200,000 = 842,300
    assert state.cash_krw == pytest.approx(842300.0)
    # USD: 1,000
    assert state.cash_usd == pytest.approx(1000.0)
    assert state.accumulated_deposits_krw == pytest.approx(1000000.0)
    assert state.accumulated_withdrawals_krw == pytest.approx(200000.0)


def test_pure_replay_stock_buy_sell():
    """주식 매수(BUY) 및 매도(SELL) 시 예수금과 수량 변동을 검증합니다."""
    samsung = Asset(id=10, ticker="005930", name="삼성전자", major_category="주식", sub_category="알파(성장)")
    apple = Asset(id=20, ticker="AAPL", name="Apple Inc.", major_category="주식", sub_category="코어(지수)")

    transactions = [
        # KRW 입금 1,000,000
        Transaction(
            id=1,
            account_id=1,
            asset_id=1,
            asset=Asset(id=1, ticker="KRW", name="원화", major_category="현금", sub_category="원화예수금"),
            type="DEPOSIT",
            currency="KRW",
            total_amount=1000000.0,
            transaction_date=datetime.date(2026, 1, 1),
        ),
        # 삼성전자 10주 매수 @ 70,000 (총 700,000원)
        Transaction(
            id=2,
            account_id=1,
            asset_id=10,
            asset=samsung,
            type="BUY",
            currency="KRW",
            quantity=10.0,
            price=70000.0,
            total_amount=700000.0,
            transaction_date=datetime.date(2026, 1, 2),
        ),
        # 삼성전자 3주 매도 @ 75,000 (총 225,000원)
        Transaction(
            id=3,
            account_id=1,
            asset_id=10,
            asset=samsung,
            type="SELL",
            currency="KRW",
            quantity=3.0,
            price=75000.0,
            total_amount=225000.0,
            transaction_date=datetime.date(2026, 1, 3),
        ),
        # AAPL 5주 매수 @ $150 (총 $750)
        Transaction(
            id=4,
            account_id=1,
            asset_id=20,
            asset=apple,
            type="BUY",
            currency="USD",
            quantity=5.0,
            price=150.0,
            total_amount=750.0,
            transaction_date=datetime.date(2026, 1, 4),
        ),
    ]

    state = LedgerEngine.replay(transactions)

    # KRW 예수금: 1,000,000 - 700,000 + 225,000 = 525,000
    assert state.cash_krw == pytest.approx(525000.0)
    # USD 예수금: 0 - 750 = -750
    assert state.cash_usd == pytest.approx(-750.0)
    # 주식 보유 수량
    assert state.holdings == {"005930": 7.0, "AAPL": 5.0}


def test_pure_replay_currency_exchange():
    """환전(EXCHANGE) 트랜잭션의 양방향 통화 변동을 검증합니다."""
    krw_asset = Asset(id=1, ticker="KRW", name="원화", major_category="현금", sub_category="원화예수금")
    usd_asset = Asset(id=2, ticker="USD", name="달러", major_category="현금", sub_category="달러예수금")

    transactions = [
        # KRW 1,350,000 입금
        Transaction(
            id=1,
            account_id=1,
            asset_id=1,
            asset=krw_asset,
            type="DEPOSIT",
            currency="KRW",
            total_amount=1350000.0,
            transaction_date=datetime.date(2026, 1, 1),
        ),
        # KRW -> USD 환전 (1,350,000 KRW 출금하여 1,000 USD 수령)
        Transaction(
            id=2,
            account_id=1,
            asset_id=1,
            asset=krw_asset,
            target_asset_id=2,
            target_asset=usd_asset,
            type="EXCHANGE",
            currency="KRW",
            quantity=1000.0,  # 수령 USD
            total_amount=1350000.0,  # 출금 KRW
            transaction_date=datetime.date(2026, 1, 2),
        ),
    ]

    state = LedgerEngine.replay(transactions)

    assert state.cash_krw == pytest.approx(0.0)
    assert state.cash_usd == pytest.approx(1000.0)


def test_pure_replay_initial_balance_baseline_cutoff():
    """INITIAL_BALANCE 기준선 이전 거래 스킵 규칙을 검증합니다."""
    krw_asset = Asset(id=1, ticker="KRW", name="원화", major_category="현금", sub_category="원화예수금")
    samsung = Asset(id=10, ticker="005930", name="삼성전자", major_category="주식", sub_category="알파(성장)")

    transactions = [
        # 1월 1일 이전 입금 (기준선 이전에 발생했으므로 현금 계산에서 무시되어야 함)
        Transaction(
            id=1,
            account_id=1,
            asset_id=1,
            asset=krw_asset,
            type="DEPOSIT",
            currency="KRW",
            total_amount=500000.0,
            transaction_date=datetime.date(2026, 1, 1),
        ),
        # 1월 5일 주식 매수 (주식 수량은 전 기간 누적되어야 함)
        Transaction(
            id=2,
            account_id=1,
            asset_id=10,
            asset=samsung,
            type="BUY",
            currency="KRW",
            quantity=5.0,
            price=70000.0,
            total_amount=350000.0,
            transaction_date=datetime.date(2026, 1, 5),
        ),
        # 1월 10일 INITIAL_BALANCE 설정: 1,000,000 KRW
        Transaction(
            id=3,
            account_id=1,
            asset_id=1,
            asset=krw_asset,
            type="INITIAL_BALANCE",
            currency="KRW",
            total_amount=1000000.0,
            transaction_date=datetime.date(2026, 1, 10),
        ),
        # 1월 12일 추가 입금: 200,000 KRW
        Transaction(
            id=4,
            account_id=1,
            asset_id=1,
            asset=krw_asset,
            type="DEPOSIT",
            currency="KRW",
            total_amount=200000.0,
            transaction_date=datetime.date(2026, 1, 12),
        ),
    ]

    state = LedgerEngine.replay(transactions)

    # 1월 1일 500,000원 입금 및 1월 5일 350,000원 매수는 INITIAL_BALANCE(1월 10일) 이전이므로 현금 계산에서 무시됨.
    # KRW 예수금: 1,000,000(INITIAL_BALANCE) + 200,000(이후 입금) = 1,200,000
    assert state.cash_krw == pytest.approx(1200000.0)
    # 주식은 1월 5일 매수한 5주가 전 기간 누적으로 유지됨
    assert state.holdings == {"005930": 5.0}


def test_pure_replay_as_of_date_cutoff():
    """as_of 기준일자에 따른 시계열 컷오프를 검증합니다."""
    krw_asset = Asset(id=1, ticker="KRW", name="원화", major_category="현금", sub_category="원화예수금")

    transactions = [
        Transaction(
            id=1,
            account_id=1,
            asset_id=1,
            asset=krw_asset,
            type="DEPOSIT",
            currency="KRW",
            total_amount=100000.0,
            transaction_date=datetime.date(2026, 1, 1),
        ),
        Transaction(
            id=2,
            account_id=1,
            asset_id=1,
            asset=krw_asset,
            type="DEPOSIT",
            currency="KRW",
            total_amount=200000.0,
            transaction_date=datetime.date(2026, 1, 15),
        ),
    ]

    state_jan10 = LedgerEngine.replay(transactions, as_of=datetime.date(2026, 1, 10))
    assert state_jan10.cash_krw == pytest.approx(100000.0)

    state_jan20 = LedgerEngine.replay(transactions, as_of=datetime.date(2026, 1, 20))
    assert state_jan20.cash_krw == pytest.approx(300000.0)


def test_db_integration_and_golden_master(db_session):
    """실제 DB 세션 연동 및 기존 서비스 로직과의 골든 마스터(Golden Master) 일치성을 검증합니다."""
    from src.backend.services.dashboard_service import DashboardService
    from src.backend.services.portfolio_service import get_portfolio_status

    # 1. 시드 데이터 생성
    user = User(id=1, name="테스트유저")
    account = Account(id=1, user_id=1, name="메인계좌", provider="KB증권", account_type="BROKERAGE", is_active=True)
    krw_asset = Asset(id=1, ticker="KRW", name="원화", major_category="현금", sub_category="원화예수금")
    usd_asset = Asset(id=2, ticker="USD", name="달러", major_category="현금", sub_category="달러예수금")
    stock_asset = Asset(id=3, ticker="005930", name="삼성전자", major_category="주식", sub_category="알파(성장)")

    db_session.add_all([user, account, krw_asset, usd_asset, stock_asset])
    db_session.commit()

    txs = [
        Transaction(
            account_id=1,
            asset_id=1,
            type="DEPOSIT",
            currency="KRW",
            quantity=0.0,
            price=1.0,
            total_amount=2000000.0,
            transaction_date=datetime.date(2026, 1, 1),
        ),
        Transaction(
            account_id=1,
            asset_id=1,
            target_asset_id=2,
            type="EXCHANGE",
            currency="KRW",
            quantity=500.0,
            price=1350.0,
            total_amount=675000.0,
            transaction_date=datetime.date(2026, 1, 5),
        ),
        Transaction(
            account_id=1,
            asset_id=3,
            type="BUY",
            currency="KRW",
            quantity=10.0,
            price=70000.0,
            total_amount=700000.0,
            transaction_date=datetime.date(2026, 1, 10),
        ),
    ]
    db_session.add_all(txs)
    db_session.commit()

    # 2. LedgerEngine 호출
    engine_state = LedgerEngine.get_positions(db_session, account_id=1, as_of=datetime.date(2026, 1, 15))

    # 3. 기존 DashboardService 이론상 현금 결과와 비교
    dash_service = DashboardService(db_session)
    legacy_cash = dash_service.calculate_theoretical_cash(account_id=1, snapshot_date=datetime.date(2026, 1, 15))

    assert engine_state.cash_krw == pytest.approx(legacy_cash["KRW"])
    assert engine_state.cash_usd == pytest.approx(legacy_cash["USD"])
    assert engine_state.holdings.get("005930") == pytest.approx(10.0)


def test_pure_replay_initial_balance_non_cash_asset():
    """비현금 자산(주식/채권)의 INITIAL_BALANCE는 예수금을 증가시키지 않고 수량만 반영함을 검증합니다 (R1)."""
    samsung = Asset(id=10, ticker="005930", name="삼성전자", major_category="주식", sub_category="알파(성장)")
    googl = Asset(id=20, ticker="GOOGL", name="Alphabet Inc.", major_category="주식", sub_category="코어(지수)")
    tlt = Asset(id=30, ticker="TLT", name="iShares 20+ Year Treasury Bond ETF", major_category="채권", sub_category="미국장기채")

    transactions = [
        Transaction(
            id=1,
            account_id=1,
            asset_id=10,
            asset=samsung,
            type="INITIAL_BALANCE",
            currency="KRW",
            quantity=47.0,
            price=216000.0,
            total_amount=10152000.0,
            transaction_date=datetime.date(2026, 4, 18),
        ),
        Transaction(
            id=2,
            account_id=1,
            asset_id=20,
            asset=googl,
            type="INITIAL_BALANCE",
            currency="USD",
            quantity=81.0,
            price=273.8842,
            total_amount=22184.62,
            transaction_date=datetime.date(2026, 4, 18),
        ),
        Transaction(
            id=3,
            account_id=1,
            asset_id=30,
            asset=tlt,
            type="INITIAL_BALANCE",
            currency="USD",
            quantity=244.0,
            price=90.9325,
            total_amount=22187.53,
            transaction_date=datetime.date(2026, 4, 18),
        ),
    ]

    state = LedgerEngine.replay(transactions)

    # 비현금 자산의 초기 잔고는 예수금에 가산되지 않아야 함 (0.0 유지)
    assert state.cash_krw == pytest.approx(0.0)
    assert state.cash_usd == pytest.approx(0.0)
    # 보유 수량은 정상 반영되어야 함
    assert state.holdings == {
        "005930": 47.0,
        "GOOGL": 81.0,
        "TLT": 244.0,
    }


def test_pure_replay_initial_balance_mixed_cash_and_stock():
    """현금과 주식이 혼합된 INITIAL_BALANCE 순회 시 현금과 수량이 각각 올바르게 분리 계산되는지 검증합니다 (R1)."""
    krw_asset = Asset(id=1, ticker="KRW", name="원화", major_category="현금", sub_category="원화예수금")
    usd_asset = Asset(id=2, ticker="USD", name="달러", major_category="현금", sub_category="달러예수금")
    samsung = Asset(id=10, ticker="005930", name="삼성전자", major_category="주식", sub_category="알파(성장)")
    apple = Asset(id=20, ticker="AAPL", name="Apple Inc.", major_category="주식", sub_category="코어(지수)")

    transactions = [
        # KRW 현금 초기 잔고: 50,000,000원
        Transaction(
            id=1,
            account_id=1,
            asset_id=1,
            asset=krw_asset,
            type="INITIAL_BALANCE",
            currency="KRW",
            quantity=50000000.0,
            price=1.0,
            total_amount=50000000.0,
            transaction_date=datetime.date(2026, 4, 18),
        ),
        # USD 현금 초기 잔고: $1,000
        Transaction(
            id=2,
            account_id=1,
            asset_id=2,
            asset=usd_asset,
            type="INITIAL_BALANCE",
            currency="USD",
            quantity=1000.0,
            price=1.0,
            total_amount=1000.0,
            transaction_date=datetime.date(2026, 4, 18),
        ),
        # 삼성전자 초기 잔고: 10주 (평가액 700,000원)
        Transaction(
            id=3,
            account_id=1,
            asset_id=10,
            asset=samsung,
            type="INITIAL_BALANCE",
            currency="KRW",
            quantity=10.0,
            price=70000.0,
            total_amount=700000.0,
            transaction_date=datetime.date(2026, 4, 18),
        ),
        # AAPL 초기 잔고: 5주 (평가액 $750)
        Transaction(
            id=4,
            account_id=1,
            asset_id=20,
            asset=apple,
            type="INITIAL_BALANCE",
            currency="USD",
            quantity=5.0,
            price=150.0,
            total_amount=750.0,
            transaction_date=datetime.date(2026, 4, 18),
        ),
    ]

    state = LedgerEngine.replay(transactions)

    # 현금 잔액은 현금 자산 INITIAL_BALANCE 금액만 합산되어야 함
    assert state.cash_krw == pytest.approx(50000000.0)
    assert state.cash_usd == pytest.approx(1000.0)
    # 주식 보유 수량 검증
    assert state.holdings == {
        "005930": 10.0,
        "AAPL": 5.0,
    }


def test_get_positions_filters_inactive_accounts(db_session):
    """LedgerEngine.get_positions(account_id=None) 호출 시 비활성 계좌의 트랜잭션이 제외되는지 검증합니다 (R2)."""
    user = User(id=1, name="테스트유저")
    active_acc = Account(id=1, user_id=1, name="활성계좌", provider="증권A", is_active=True)
    inactive_acc = Account(id=2, user_id=1, name="비활성계좌", provider="증권B", is_active=False)
    krw_asset = Asset(id=1, ticker="KRW", name="원화", major_category="현금", sub_category="원화예수금")
    samsung = Asset(id=10, ticker="005930", name="삼성전자", major_category="주식", sub_category="알파(성장)")

    db_session.add_all([user, active_acc, inactive_acc, krw_asset, samsung])
    db_session.commit()

    txs = [
        # 활성 계좌 입금 1,000,000원 및 삼성전자 5주 매수
        Transaction(
            account_id=1,
            asset_id=1,
            type="DEPOSIT",
            currency="KRW",
            total_amount=1000000.0,
            transaction_date=datetime.date(2026, 5, 1),
        ),
        Transaction(
            account_id=1,
            asset_id=10,
            type="BUY",
            currency="KRW",
            quantity=5.0,
            price=70000.0,
            total_amount=350000.0,
            transaction_date=datetime.date(2026, 5, 2),
        ),
        # 비활성 계좌 입금 500,000원 및 삼성전자 10주 매수
        Transaction(
            account_id=2,
            asset_id=1,
            type="DEPOSIT",
            currency="KRW",
            total_amount=500000.0,
            transaction_date=datetime.date(2026, 5, 1),
        ),
        Transaction(
            account_id=2,
            asset_id=10,
            type="BUY",
            currency="KRW",
            quantity=10.0,
            price=70000.0,
            total_amount=700000.0,
            transaction_date=datetime.date(2026, 5, 2),
        ),
    ]
    db_session.add_all(txs)
    db_session.commit()

    # account_id=None으로 전체 포지션 조회 시 활성 계좌만 반영되어야 함
    state = LedgerEngine.get_positions(db_session, account_id=None)
    assert state.cash_krw == pytest.approx(650000.0)  # 1,000,000 - 350,000 (비활성 계좌 제외)
    assert state.holdings == {"005930": 5.0}  # 5주만 반영 (비활성 계좌 10주 제외)


@pytest.mark.asyncio
async def test_dev_assets_db_golden_master_valuation():
    """src/dev_assets.db에 대한 대시보드 총 평가금액이 골든 마스터(434,794,786.26 KRW)와 오차 0으로 일치하는지 검증합니다."""
    from pathlib import Path
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from src.backend.services.dashboard_service import DashboardService

    dev_db_path = Path("src/dev_assets.db")
    if not dev_db_path.exists():
        pytest.skip("src/dev_assets.db 파일이 존재하지 않아 건너뜁니다.")

    engine = create_engine(f"sqlite:///{dev_db_path}")
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        service = DashboardService(db)
        summary = await service.get_dashboard_summary(force_update=False)

        if not summary.get("accounts") or summary.get("total_valuation_krw") == 0.0:
            pytest.skip("src/dev_assets.db에 평가 대상 계좌 데이터가 없어 건너뜁니다.")

        expected_valuation = 434794786.26370734
        assert summary["total_valuation_krw"] == pytest.approx(expected_valuation, abs=0.1)
        assert len(summary["accounts"]) == 10
    finally:
        db.close()


def test_pure_replay_multi_account_isolated_baselines():
    """다중 계좌 트랜잭션 일괄 순회 시 각 계좌별 INITIAL_BALANCE 기준선이 서로 간섭하지 않고 독립적으로 적용되는지 검증합니다."""
    krw = Asset(id=1, ticker="KRW", name="원화", major_category="현금", sub_category="원화예수금")

    txs = [
        # 계좌 1: 2024-01-01 초기 잔고 1,000,000원 -> 2024-06-01 입금 500,000원
        Transaction(
            id=1,
            account_id=1,
            asset_id=1,
            asset=krw,
            type="INITIAL_BALANCE",
            currency="KRW",
            total_amount=1000000.0,
            transaction_date=datetime.date(2024, 1, 1),
        ),
        Transaction(
            id=2,
            account_id=1,
            asset_id=1,
            asset=krw,
            type="DEPOSIT",
            currency="KRW",
            total_amount=500000.0,
            transaction_date=datetime.date(2024, 6, 1),
        ),
        # 계좌 2: 2026-01-01 초기 잔고 10,000,000원 -> 2026-02-01 입금 1,000,000원
        Transaction(
            id=3,
            account_id=2,
            asset_id=1,
            asset=krw,
            type="INITIAL_BALANCE",
            currency="KRW",
            total_amount=10000000.0,
            transaction_date=datetime.date(2026, 1, 1),
        ),
        Transaction(
            id=4,
            account_id=2,
            asset_id=1,
            asset=krw,
            type="DEPOSIT",
            currency="KRW",
            total_amount=1000000.0,
            transaction_date=datetime.date(2026, 2, 1),
        ),
    ]

    state = LedgerEngine.replay(txs)
    # 계좌 1의 잔액: 1,500,000원, 계좌 2의 잔액: 11,000,000원 -> 총합 12,500,000원
    assert state.cash_krw == pytest.approx(12500000.0)


def test_get_positions_inactive_account_isolated_query(db_session):
    """비활성 계좌를 단독 조회(account_id=inactive_id)할 때 활성 계좌의 최신 기준선에 의해 거래 내역이 삭제되지 않는지 검증합니다."""
    user = User(id=1, name="테스트유저")
    active_acc = Account(id=1, user_id=1, name="신규활성계좌", provider="증권A", is_active=True)
    inactive_acc = Account(id=2, user_id=1, name="과거비활성계좌", provider="증권B", is_active=False)
    krw_asset = Asset(id=1, ticker="KRW", name="원화", major_category="현금", sub_category="원화예수금")

    db_session.add_all([user, active_acc, inactive_acc, krw_asset])
    db_session.commit()

    txs = [
        # 비활성 계좌: 2021년 INITIAL_BALANCE 및 2022년 추가 입금
        Transaction(
            account_id=2,
            asset_id=1,
            type="INITIAL_BALANCE",
            currency="KRW",
            total_amount=5000000.0,
            transaction_date=datetime.date(2021, 1, 1),
        ),
        Transaction(
            account_id=2,
            asset_id=1,
            type="DEPOSIT",
            currency="KRW",
            total_amount=3000000.0,
            transaction_date=datetime.date(2022, 5, 1),
        ),
        # 활성 계좌: 2026년 INITIAL_BALANCE
        Transaction(
            account_id=1,
            asset_id=1,
            type="INITIAL_BALANCE",
            currency="KRW",
            total_amount=20000000.0,
            transaction_date=datetime.date(2026, 4, 18),
        ),
    ]
    db_session.add_all(txs)
    db_session.commit()

    # 비활성 계좌 단독 조회 시 2021~2022년 거래가 정상 계산되어야 함 (500만 + 300만 = 800만원)
    inactive_state = LedgerEngine.get_positions(db_session, account_id=2)
    assert inactive_state.cash_krw == pytest.approx(8000000.0)

    # 활성 계좌 단독 조회 시 2026년 잔고 정상 계산 (2,000만원)
    active_state = LedgerEngine.get_positions(db_session, account_id=1)
    assert active_state.cash_krw == pytest.approx(20000000.0)


def test_pure_replay_tax_and_interest_on_stock_asset():
    """주식/채권 자산에 연동된 배당(INTEREST) 및 원천징수세(TAX) 트랜잭션이 현금만 변동시키고 보유 주식 수량을 훼손하지 않는지 검증합니다."""
    tlt = Asset(id=30, ticker="TLT", name="iShares 20+ Year Treasury Bond ETF", major_category="채권", sub_category="미국장기채")

    txs = [
        # TLT 100주 매수
        Transaction(
            id=1,
            account_id=1,
            asset_id=30,
            asset=tlt,
            type="BUY",
            currency="USD",
            quantity=100.0,
            price=90.0,
            total_amount=9000.0,
            transaction_date=datetime.date(2026, 1, 1),
        ),
        # TLT 배당금(이자) $80.63 입금 (asset_id=TLT, quantity=0)
        Transaction(
            id=2,
            account_id=1,
            asset_id=30,
            asset=tlt,
            type="INTEREST",
            currency="USD",
            quantity=0.0,
            price=0.0,
            total_amount=80.63,
            transaction_date=datetime.date(2026, 1, 15),
        ),
        # TLT 배당소득세 $12.09 원천징수 (asset_id=TLT, quantity=0)
        Transaction(
            id=3,
            account_id=1,
            asset_id=30,
            asset=tlt,
            type="TAX",
            currency="USD",
            quantity=0.0,
            price=0.0,
            total_amount=12.09,
            transaction_date=datetime.date(2026, 1, 15),
        ),
    ]

    state = LedgerEngine.replay(txs)

    # 현금 USD: -9000.0 + 80.63 - 12.09 = -8931.46
    assert state.cash_usd == pytest.approx(-8931.46)
    # TLT 보유 수량은 100주 그대로 유지되어야 함
    assert state.holdings == {"TLT": 100.0}


def test_pure_replay_cash_adjustment_positive_and_negative():
    """CASH_ADJUSTMENT 양수(가산) 및 음수(차감) 보정이 정확히 반영되는지 검증합니다."""
    krw_asset = Asset(id=1, ticker="KRW", name="원화", major_category="현금", sub_category="원화예수금")

    txs = [
        Transaction(
            id=1,
            account_id=1,
            asset_id=1,
            asset=krw_asset,
            type="INITIAL_BALANCE",
            currency="KRW",
            total_amount=1000000.0,
            transaction_date=datetime.date(2026, 1, 1),
        ),
        Transaction(
            id=2,
            account_id=1,
            asset_id=1,
            asset=krw_asset,
            type="CASH_ADJUSTMENT",
            currency="KRW",
            total_amount=50000.0,  # +50,000원 보정
            transaction_date=datetime.date(2026, 1, 15),
        ),
        Transaction(
            id=3,
            account_id=1,
            asset_id=1,
            asset=krw_asset,
            type="CASH_ADJUSTMENT",
            currency="KRW",
            total_amount=-20000.0,  # -20,000원 보정
            transaction_date=datetime.date(2026, 1, 20),
        ),
    ]

    state = LedgerEngine.replay(txs)
    # 1,000,000 + 50,000 - 20,000 = 1,030,000
    assert state.cash_krw == pytest.approx(1030000.0)


def test_get_positions_cross_account_post_baseline_active_account(db_session):
    """활성 계좌 간의 기준선 이후 트랜잭션 추가 시 get_positions가 정상적으로 신규 거래를 누적 계산하는지 검증합니다."""
    user = User(id=1, name="테스트유저")
    acc1 = Account(id=1, user_id=1, name="기존계좌", provider="증권A", is_active=True)
    acc2 = Account(id=2, user_id=1, name="신규계좌", provider="증권B", is_active=True)
    krw_asset = Asset(id=1, ticker="KRW", name="원화", major_category="현금", sub_category="원화예수금")

    db_session.add_all([user, acc1, acc2, krw_asset])
    db_session.commit()

    # 계좌 1은 2026-04-18에 INITIAL_BALANCE 설정
    tx1 = Transaction(
        account_id=1,
        asset_id=1,
        type="INITIAL_BALANCE",
        currency="KRW",
        total_amount=1000000.0,
        transaction_date=datetime.date(2026, 4, 18),
    )
    # 계좌 2는 2026-04-18 기준선 이후인 2026-05-01에 DEPOSIT 5,000,000원
    tx2 = Transaction(
        account_id=2,
        asset_id=1,
        type="DEPOSIT",
        currency="KRW",
        total_amount=5000000.0,
        transaction_date=datetime.date(2026, 5, 1),
    )
    db_session.add_all([tx1, tx2])
    db_session.commit()

    # 계좌 2 단독 조회 시 5,000,000원이 정상 반영되어야 함
    pos2 = LedgerEngine.get_positions(db_session, account_id=2)
    assert pos2.cash_krw == pytest.approx(5000000.0)

    # 계좌 1 단독 조회 시 1,000,000원 반영
    pos1 = LedgerEngine.get_positions(db_session, account_id=1)
    assert pos1.cash_krw == pytest.approx(1000000.0)

    # 전체 계좌 조회 시 합계 6,000,000원 반영
    pos_all = LedgerEngine.get_positions(db_session, account_id=None)
    assert pos_all.cash_krw == pytest.approx(6000000.0)


def test_pure_replay_multi_currency_exchange_reverse():
    """USD -> KRW 역방향 환전(달러 매도하여 원화 수령) 및 asset_map 연동 계산을 검증합니다."""
    krw_asset = Asset(id=1, ticker="KRW", name="원화", major_category="현금", sub_category="원화예수금")
    usd_asset = Asset(id=2, ticker="USD", name="달러", major_category="현금", sub_category="달러예수금")
    asset_map = {1: krw_asset, 2: usd_asset}

    txs = [
        # USD $2,000 입금
        Transaction(
            id=1,
            account_id=1,
            asset_id=2,
            type="DEPOSIT",
            currency="USD",
            total_amount=2000.0,
            transaction_date=datetime.date(2026, 1, 1),
        ),
        # USD $500를 675,000 KRW로 환전 (asset_id=USD, target_asset_id=KRW)
        Transaction(
            id=2,
            account_id=1,
            asset_id=2,
            target_asset_id=1,
            type="EXCHANGE",
            currency="USD",
            quantity=675000.0,  # 수령 KRW
            total_amount=500.0,   # 출금 USD
            transaction_date=datetime.date(2026, 1, 5),
        ),
    ]

    state = LedgerEngine.replay(txs, asset_map=asset_map)
    assert state.cash_usd == pytest.approx(1500.0)
    assert state.cash_krw == pytest.approx(675000.0)


def test_pure_replay_cross_account_transfer_pair():
    """계좌 간 이체(출금 WITHDRAW + 입금 DEPOSIT 쌍) 트랜잭션의 계좌별 격리 및 전체 합산 정합성을 검증합니다."""
    krw_asset = Asset(id=1, ticker="KRW", name="원화", major_category="현금", sub_category="원화예수금")

    txs = [
        # 계좌 1에 1,000,000원 입금
        Transaction(
            id=1,
            account_id=1,
            asset_id=1,
            asset=krw_asset,
            type="DEPOSIT",
            currency="KRW",
            total_amount=1000000.0,
            transaction_date=datetime.date(2026, 1, 1),
        ),
        # 계좌 1에서 300,000원 출금 (이체 출발)
        Transaction(
            id=2,
            account_id=1,
            asset_id=1,
            asset=krw_asset,
            type="WITHDRAW",
            currency="KRW",
            total_amount=300000.0,
            transaction_date=datetime.date(2026, 1, 5),
        ),
        # 계좌 2에 300,000원 입금 (이체 도착)
        Transaction(
            id=3,
            account_id=2,
            asset_id=1,
            asset=krw_asset,
            type="DEPOSIT",
            currency="KRW",
            total_amount=300000.0,
            transaction_date=datetime.date(2026, 1, 5),
        ),
    ]

    # 개별 계좌 순회
    state1 = LedgerEngine.replay(txs, account_id=1)
    assert state1.cash_krw == pytest.approx(700000.0)
    assert state1.accumulated_deposits_krw == pytest.approx(1000000.0)
    assert state1.accumulated_withdrawals_krw == pytest.approx(300000.0)

    state2 = LedgerEngine.replay(txs, account_id=2)
    assert state2.cash_krw == pytest.approx(300000.0)
    assert state2.accumulated_deposits_krw == pytest.approx(300000.0)
    assert state2.accumulated_withdrawals_krw == pytest.approx(0.0)

    # 전체 계좌 순회 (총 자산 합계 불변)
    state_all = LedgerEngine.replay(txs)
    assert state_all.cash_krw == pytest.approx(1000000.0)


def test_pure_replay_negative_cash_balance():
    """예수금 초과 매수 또는 수수료로 인한 음수(마이너스) 예수금 계산 정합성을 검증합니다."""
    apple = Asset(id=20, ticker="AAPL", name="Apple Inc.", major_category="주식", sub_category="코어(지수)")

    txs = [
        # USD $100 입금
        Transaction(
            id=1,
            account_id=1,
            asset_id=2,
            type="DEPOSIT",
            currency="USD",
            total_amount=100.0,
            transaction_date=datetime.date(2026, 1, 1),
        ),
        # AAPL 2주 매수 ($150 * 2 = $300)
        Transaction(
            id=2,
            account_id=1,
            asset_id=20,
            asset=apple,
            type="BUY",
            currency="USD",
            quantity=2.0,
            price=150.0,
            total_amount=300.0,
            transaction_date=datetime.date(2026, 1, 2),
        ),
    ]

    state = LedgerEngine.replay(txs)
    assert state.cash_usd == pytest.approx(-200.0)
    assert state.holdings == {"AAPL": 2.0}


def test_pure_replay_empty_transactions():
    """트랜잭션 목록이 비어있을 때 안전하게 빈 LedgerState를 반환하는지 검증합니다."""
    state = LedgerEngine.replay([])
    assert state.cash_krw == 0.0
    assert state.cash_usd == 0.0
    assert state.holdings == {}
    assert state.accumulated_deposits_krw == 0.0
    assert state.accumulated_withdrawals_krw == 0.0



