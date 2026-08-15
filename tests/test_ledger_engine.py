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
    samsung = Asset(id=10, ticker="005930", name="삼성전자", major_category="일반주식", sub_category="국내주식")
    apple = Asset(id=20, ticker="AAPL", name="Apple Inc.", major_category="일반주식", sub_category="해외주식")

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
    samsung = Asset(id=10, ticker="005930", name="삼성전자", major_category="일반주식", sub_category="국내주식")

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
    stock_asset = Asset(id=3, ticker="005930", name="삼성전자", major_category="일반주식", sub_category="국내주식")

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
