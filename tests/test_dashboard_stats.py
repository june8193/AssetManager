import pytest
import datetime
import asyncio
from src.backend.models import User, Account, AccountSnapshot, Transaction, Asset
from src.backend.services.dashboard_service import DashboardService

def test_get_yearly_stats_duplication_issue(db_session):
    """2024년 데이터 중복 합산 문제를 재현하는 테스트입니다.
    
    시나리오:
    - 계좌 1 (Legacy): 2024-10-24에 마지막 스냅샷 (100만원)
    - 계좌 2 (New): 2024-12-29에 마지막 스냅샷 (50만원)
    
    기존 로직: 100 + 50 = 150만원 반환 (실패 대상)
    개선 로직: 12-29일 기준인 50만원만 반환 (성공 대상)
    """
    # 1. 기본 데이터 설정
    user = User(name="Test User")
    db_session.add(user)
    db_session.commit()

    acc_legacy = Account(user_id=user.id, name="Legacy Account", provider="Old Bank")
    acc_new = Account(user_id=user.id, name="New Account", provider="New Bank")
    db_session.add_all([acc_legacy, acc_new])
    db_session.commit()

    # 2. 스냅샷 데이터 생성
    # Legacy 계좌는 10월에 기록이 멈춤
    snap_legacy = AccountSnapshot(
        account_id=acc_legacy.id,
        snapshot_date=datetime.date(2024, 10, 24),
        total_valuation=1000000.0,
        period_deposit=1000000.0
    )
    # New 계좌는 12월 말에 기록됨
    snap_new = AccountSnapshot(
        account_id=acc_new.id,
        snapshot_date=datetime.date(2024, 12, 29),
        total_valuation=500000.0,
        period_deposit=500000.0
    )
    db_session.add_all([snap_legacy, snap_new])
    db_session.commit()

    # 3. 서비스 호출 및 검증
    service = DashboardService(db_session)
    stats = service.get_yearly_stats()

    # 2024년 통계 확인
    stat_2024 = next((s for s in stats if s["year"] == 2024), None)
    
    assert stat_2024 is not None
    # 현재 로직에서는 1500000.0이 나옴. 목표는 500000.0
    assert stat_2024["assets"] == 500000.0

def test_get_yearly_stats_contribution_logic(db_session):
    """스냅샷 기반의 연도별 추가액 및 수익 계산 로직을 검증합니다."""
    # 1. 기본 데이터 설정
    user = User(name="Test User")
    db_session.add(user)
    db_session.commit()

    acc = Account(user_id=user.id, name="Test Account", provider="Test Bank")
    db_session.add(acc)
    db_session.commit()

    # 2. 연도별 스냅샷 생성
    # 2021년 말: 원금 1000, 평가액 1100 (수익 100)
    db_session.add(AccountSnapshot(
        account_id=acc.id,
        snapshot_date=datetime.date(2021, 12, 31),
        period_deposit=1000.0,
        total_valuation=1100.0,
        total_profit=100.0
    ))
    
    # 2022년 말: 원금 1500 (500 추가), 평가액 1800 (수익 300 - 전년도수익 100 = 당해수익 200)
    # 계산: 추가액=500, 자산증가=700, 수익=700-500=200
    db_session.add(AccountSnapshot(
        account_id=acc.id,
        snapshot_date=datetime.date(2022, 12, 31),
        period_deposit=500.0,
        total_valuation=1800.0,
        total_profit=300.0
    ))
    
    # 2023년 말: 원금 2000 (500 추가), 평가액 2200 (당해수익 -100)
    # 계산: 추가액=500, 자산증가=400, 수익=400-500=-100
    db_session.add(AccountSnapshot(
        account_id=acc.id,
        snapshot_date=datetime.date(2023, 12, 31),
        period_deposit=500.0,
        total_valuation=2200.0,
        total_profit=200.0
    ))
    
    # 3. 왜곡을 유도하는 트랜잭션 추가 (2024년에 몰려있는 초기잔고 트랜잭션 가정)
    # 현재 로직은 이 트랜잭션을 무시해야 함
    asset = Asset(ticker="TEST", name="Test Asset", major_category="일반주식", sub_category="국내주식")
    db_session.add(asset)
    db_session.commit()
    
    db_session.add(Transaction(
        account_id=acc.id,
        asset_id=asset.id,
        transaction_date=datetime.date(2024, 1, 1),
        type="INITIAL_BALANCE",
        total_amount=9999999.0, # 매우 큰 금액
        currency="KRW"
    ))
    db_session.commit()

    # 4. 검증
    service = DashboardService(db_session)
    stats = service.get_yearly_stats()
    
    # 2021년 검증
    s21 = next(s for s in stats if s["year"] == 2021)
    assert s21["contribution"] == 1000.0
    assert s21["assets"] == 1100.0
    assert s21["profit"] == 100.0
    
    # 2022년 검증
    s22 = next(s for s in stats if s["year"] == 2022)
    assert s22["contribution"] == 500.0
    assert s22["assets"] == 1800.0
    assert s22["profit"] == 200.0
    
    # 2023년 검증
    s23 = next(s for s in stats if s["year"] == 2023)
    assert s23["contribution"] == 500.0
    assert s23["assets"] == 2200.0
    assert s23["profit"] == -100.0
    
    # 2024년은 스냅샷이 없으므로 통계에 포함되지 않아야 함 (현재 snapshots 기반이므로)
    # 만약 트랜잭션 기반이었다면 2024년이 포함되었을 것임
    assert not any(s["year"] == 2024 for s in stats)

def test_get_yearly_stats_order(db_session):
    """연도별 통계가 내림차순(최신 연도부터)으로 정렬되는지 확인합니다."""
    user = User(name="Test User")
    db_session.add(user)
    db_session.commit()
    acc = Account(user_id=user.id, name="Test Account", provider="Test Bank")
    db_session.add(acc)
    db_session.commit()

    # 2021, 2022, 2023 데이터 추가
    for year in [2021, 2022, 2023]:
        db_session.add(AccountSnapshot(
            account_id=acc.id,
            snapshot_date=datetime.date(year, 12, 31),
            period_deposit=1000.0,
            total_valuation=1100.0
        ))
    db_session.commit()

    service = DashboardService(db_session)
    stats = service.get_yearly_stats()

    assert len(stats) == 3
    assert stats[0]["year"] == 2023
    assert stats[1]["year"] == 2022
    assert stats[2]["year"] == 2021

def test_get_daily_stats(db_session):
    """일자별 자산 통계 및 수익률 계산 로직을 검증합니다."""
    user = User(name="Test User")
    db_session.add(user)
    db_session.commit()
    
    acc1 = Account(user_id=user.id, name="Account 1", provider="Bank A")
    acc2 = Account(user_id=user.id, name="Account 2", provider="Bank B")
    db_session.add_all([acc1, acc2])
    db_session.commit()

    # 2024-01-01: 기초 설정 (최초일자)
    # 계좌1: 추가액 1000, 평가액 1000
    # 계좌2: 추가액 2000, 평가액 2000
    # 총자산: 3000, 총추가액: 3000 -> 기초자산: 0, 증가액: 3000, 수익: 0, 수익률: 0.0%
    db_session.add(AccountSnapshot(
        account_id=acc1.id,
        snapshot_date=datetime.date(2024, 1, 1),
        period_deposit=1000.0,
        total_valuation=1000.0,
        total_profit=0.0
    ))
    db_session.add(AccountSnapshot(
        account_id=acc2.id,
        snapshot_date=datetime.date(2024, 1, 1),
        period_deposit=2000.0,
        total_valuation=2000.0,
        total_profit=0.0
    ))

    # 2024-01-02: 수익 및 추가액 발생
    # 계좌1: 추가액 0, 평가액 1500
    # 계좌2: 추가액 500, 평가액 2500
    # 총자산: 4000, 총추가액: 500 -> 기초자산: 3000, 증가액: 1000, 수익: 500, 수익률: (500 / 3500) * 100 = 14.29%
    db_session.add(AccountSnapshot(
        account_id=acc1.id,
        snapshot_date=datetime.date(2024, 1, 2),
        period_deposit=0.0,
        total_valuation=1500.0,
        total_profit=500.0
    ))
    db_session.add(AccountSnapshot(
        account_id=acc2.id,
        snapshot_date=datetime.date(2024, 1, 2),
        period_deposit=500.0,
        total_valuation=2500.0,
        total_profit=0.0
    ))

    # 2024-01-03: 손실 발생
    # 계좌1: 추가액 0, 평가액 1400
    # 계좌2: 추가액 0, 평가액 2300
    # 총자산: 3700, 총추가액: 0 -> 기초자산: 4000, 증가액: -300, 수익: -300, 수익률: (-300 / 4000) * 100 = -7.50%
    db_session.add(AccountSnapshot(
        account_id=acc1.id,
        snapshot_date=datetime.date(2024, 1, 3),
        period_deposit=0.0,
        total_valuation=1400.0,
        total_profit=400.0
    ))
    db_session.add(AccountSnapshot(
        account_id=acc2.id,
        snapshot_date=datetime.date(2024, 1, 3),
        period_deposit=0.0,
        total_valuation=2300.0,
        total_profit=-200.0
    ))

    db_session.commit()

    service = DashboardService(db_session)
    stats = service.get_daily_stats(all_data=True)

    # 최신 날짜가 가장 먼저 오도록 정렬되었는지 확인
    assert len(stats) == 3
    assert stats[0]["date"] == datetime.date(2024, 1, 3)
    assert stats[1]["date"] == datetime.date(2024, 1, 2)
    assert stats[2]["date"] == datetime.date(2024, 1, 1)

    # 2024-01-03 검증 (최신)
    s03 = stats[0]
    assert s03["assets"] == 3700.0
    assert s03["contribution"] == 0.0
    assert s03["increase"] == -300.0
    assert s03["profit"] == -300.0
    assert s03["roi"] == -7.50

    # 2024-01-02 검증
    s02 = stats[1]
    assert s02["assets"] == 4000.0
    assert s02["contribution"] == 500.0
    assert s02["increase"] == 1000.0
    assert s02["profit"] == 500.0
    assert s02["roi"] == 14.29

    # 2024-01-01 검증 (최초)
    s01 = stats[2]
    assert s01["assets"] == 3000.0
    assert s01["contribution"] == 3000.0
    assert s01["increase"] == 3000.0
    assert s01["profit"] == 0.0
    assert s01["roi"] == 0.0


def test_get_dashboard_summary_cumulative_stats(db_session, monkeypatch):
    """대시보드 요약 정보 조회 시 실시간 누적 성과 통계가 올바르게 계산되는지 검증합니다."""
    # 1. 기본 데이터 설정
    user = User(name="Test User")
    db_session.add(user)
    db_session.commit()

    acc = Account(user_id=user.id, name="Test Account", provider="Test Bank", is_active=True)
    db_session.add(acc)
    db_session.commit()

    # 2. 연도별 스냅샷 생성 (과거 원금 및 기초자산 수립 목적)
    # 2021년 1월 1일: 원금 1000, 평가액 1100 (최초 기초자산 = 1100 - 1000 = 100)
    db_session.add(AccountSnapshot(
        account_id=acc.id,
        snapshot_date=datetime.date(2021, 1, 1),
        period_deposit=1000.0,
        total_valuation=1100.0,
        total_profit=100.0
    ))
    # 2021년 12월 31일: 추가 원금 0, 평가액 1200
    db_session.add(AccountSnapshot(
        account_id=acc.id,
        snapshot_date=datetime.date(2021, 12, 31),
        period_deposit=0.0,
        total_valuation=1200.0,
        total_profit=200.0
    ))
    # 2022년 말: 추가 원금 500, 평가액 1800 (당해수익 = 100)
    db_session.add(AccountSnapshot(
        account_id=acc.id,
        snapshot_date=datetime.date(2022, 12, 31),
        period_deposit=500.0,
        total_valuation=1800.0,
        total_profit=300.0
    ))
    db_session.commit()

    # 3. 실시간 주가 조회를 가상화 (2000 KRW 평가액을 만들도록 설정)
    # 자산 및 트랜잭션 추가하여 실시간 평가 자산을 2000.0으로 만듦
    asset = Asset(ticker="TEST", name="Test Asset", country="KR", major_category="일반주식", sub_category="국내주식")
    db_session.add(asset)
    db_session.commit()

    # TEST 주식 10주 매수 (평가액 2000 KRW을 만들기 위해 1주당 200 KRW으로 가정)
    db_session.add(Transaction(
        account_id=acc.id,
        asset_id=asset.id,
        transaction_date=datetime.date(2023, 1, 1),
        type="BUY",
        quantity=10.0,
        total_amount=2000.0,
        currency="KRW"
    ))
    # 현금 잔고를 맞추기 위해 입금 2000.0 추가
    cash_asset = db_session.query(Asset).filter(Asset.ticker == "KRW").first()
    if not cash_asset:
        cash_asset = Asset(ticker="KRW", name="Won", country="KR", major_category="현금", sub_category="원화예수금")
        db_session.add(cash_asset)
        db_session.commit()

    db_session.add(Transaction(
        account_id=acc.id,
        asset_id=cash_asset.id,
        transaction_date=datetime.date(2023, 1, 1),
        type="DEPOSIT",
        quantity=2000.0,
        total_amount=2000.0,
        currency="KRW"
    ))
    db_session.commit()

    service = DashboardService(db_session)

    # get_current_prices 모킹하여 TEST 주식 단가를 200.0으로 설정 -> 평가액 2000.0
    async def mock_get_current_prices(self, tickers, *args, **kwargs):
        return {"TEST": 200.0, "KRW": 1.0}
    
    monkeypatch.setattr(DashboardService, "get_current_prices", mock_get_current_prices)

    # 4. 검증
    summary = asyncio.run(service.get_dashboard_summary())

    # 실시간 총 자산 (주식 10 * 200 = 2000원, 현금 2000 - BUY(2000) = 0원 => 총 2000원)
    assert summary["total_valuation_krw"] == 2000.0

    # 총 추가액 (1000 + 500 = 1500)
    assert summary["total_contribution"] == 1500.0
    
    # 최초 기초 자산 (1100 - 1000 = 100)
    assert summary["initial_base_asset"] == 100.0

    # 누적 수익금 (2000 - 1500 - 100 = 400)
    assert summary["total_profit"] == 400.0

    # 누적 수익률 (400 / 1600 * 100 = 25.0)
    assert summary["cumulative_roi"] == 25.0

    # 원금 비율 (1600 / 2000 * 100 = 80.0)
    assert summary["contribution_ratio"] == 80.0

    # 수익 비율 (400 / 2000 * 100 = 20.0)
    assert summary["profit_ratio"] == 20.0


def test_get_dashboard_summary_latest_price_date(db_session, monkeypatch):
    """대시보드 요약 정보 조회 시 가장 최신의 주가 기준일이 포함되는지 테스트합니다."""
    from src.backend.models import HistoricalPrice

    # 1. 테스트용 최신 가격 기록 추가
    db_session.add(HistoricalPrice(ticker="AAPL", price_date=datetime.date(2026, 6, 6), close_price=150.0, updated_at=datetime.datetime(2026, 6, 6, 15, 30)))
    db_session.add(HistoricalPrice(ticker="MSFT", price_date=datetime.date(2026, 6, 5), close_price=250.0, updated_at=datetime.datetime(2026, 6, 5, 15, 30)))
    db_session.commit()

    # 2. 기본 계좌 및 자산 설정 (평가액 계산을 위함)
    user = User(name="Test User")
    db_session.add(user)
    db_session.commit()
    acc = Account(user_id=user.id, name="Test Account", provider="Test Bank", is_active=True)
    db_session.add(acc)
    db_session.commit()

    service = DashboardService(db_session)

    # get_current_prices 및 get_holdings 등을 적절히 빈값으로 모킹
    async def mock_get_current_prices(self, tickers, *args, **kwargs):
        return {}
    monkeypatch.setattr(DashboardService, "get_current_prices", mock_get_current_prices)

    # 3. 검증: get_dashboard_summary()의 결과에 latest_price_date가 있어야 함
    summary = asyncio.run(service.get_dashboard_summary())
    assert "latest_price_date" in summary
    assert summary["latest_price_date"].startswith("2026-06-06")



