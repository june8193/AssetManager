import pytest
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
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
        total_deposit=1000000.0
    )
    # New 계좌는 12월 말에 기록됨
    snap_new = AccountSnapshot(
        account_id=acc_new.id,
        snapshot_date=datetime.date(2024, 12, 29),
        total_valuation=500000.0,
        total_deposit=500000.0
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
