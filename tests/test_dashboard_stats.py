import pytest
import datetime
import sys, os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# 프로젝트 루트를 path에 추가
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.backend.models import Base, User, Account, AccountSnapshot, Transaction, Asset
from src.backend.services.dashboard_service import DashboardService

@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

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
    asset = Asset(ticker="TEST", name="Test Asset", major_category="주식", sub_category="국내주식")
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

