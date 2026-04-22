import pytest
import datetime
import sys, os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# 프로젝트 루트를 path에 추가
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.backend.models import Base, User, Account, AccountSnapshot
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

def test_get_snapshots(db_session):
    """시계열 자산 추이 데이터 조회 기능을 검증합니다."""
    # 1. 기본 데이터 설정
    user = User(name="Test User")
    db_session.add(user)
    db_session.commit()

    acc1 = Account(user_id=user.id, name="Account 1", provider="Bank A")
    acc2 = Account(user_id=user.id, name="Account 2", provider="Bank B")
    db_session.add_all([acc1, acc2])
    db_session.commit()

    # 2. 스냅샷 데이터 생성
    # 2024-01-01
    db_session.add(AccountSnapshot(
        account_id=acc1.id,
        snapshot_date=datetime.date(2024, 1, 1),
        total_valuation=1000.0
    ))
    db_session.add(AccountSnapshot(
        account_id=acc2.id,
        snapshot_date=datetime.date(2024, 1, 1),
        total_valuation=2000.0
    ))
    
    # 2024-01-02
    db_session.add(AccountSnapshot(
        account_id=acc1.id,
        snapshot_date=datetime.date(2024, 1, 2),
        total_valuation=1100.0
    ))
    db_session.add(AccountSnapshot(
        account_id=acc2.id,
        snapshot_date=datetime.date(2024, 1, 2),
        total_valuation=2100.0
    ))
    
    db_session.commit()

    # 3. 서비스 호출 및 검증
    service = DashboardService(db_session)
    data = service.get_snapshots()

    assert "history" in data
    assert "accounts" in data
    assert len(data["history"]) == 2
    assert len(data["accounts"]) == 2

    # 2024-01-01 데이터 검증
    h1 = data["history"][0]
    assert h1["date"] == "2024-01-01"
    assert h1["total"] == 3000.0
    assert h1[f"acc_{acc1.id}"] == 1000.0
    assert h1[f"acc_{acc2.id}"] == 2000.0

    # 2024-01-02 데이터 검증
    h2 = data["history"][1]
    assert h2["date"] == "2024-01-02"
    assert h2["total"] == 3200.0
    assert h2[f"acc_{acc1.id}"] == 1100.0
    assert h2[f"acc_{acc2.id}"] == 2100.0
