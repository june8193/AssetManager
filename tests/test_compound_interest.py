import datetime
import math
import pytest
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from src.backend.main import app
from src.backend.models import User, Account, AccountSnapshot

def test_compound_stats_no_data(db_session: Session):
    """스냅샷 데이터가 아예 없을 때 API가 has_enough_data=False를 반환하는지 테스트합니다."""
    client = TestClient(app)
    response = client.get("/api/simulation/compound/snapshot-stats")
    assert response.status_code == 200
    data = response.json()
    assert data["has_enough_data"] is False
    assert data["annual_deposit_avg"] == 0.0
    assert data["annual_roi_avg"] == 0.0
    assert data["latest_total_valuation"] == 0.0

def test_compound_stats_insufficient_period(db_session: Session):
    """스냅샷 기간이 1년 미만일 때 has_enough_data=False를 반환하는지 테스트합니다."""
    # 유저 및 계좌 추가
    user = User(name="Test User")
    db_session.add(user)
    db_session.commit()

    account = Account(
        user_id=user.id,
        name="Test Account",
        provider="Test Bank",
        account_type="BANK",
        is_active=True
    )
    db_session.add(account)
    db_session.commit()

    # 180일 차이나는 스냅샷 생성
    snap1 = AccountSnapshot(
        account_id=account.id,
        snapshot_date=datetime.date(2025, 1, 1),
        period_deposit=5000000.0,
        total_valuation=5000000.0,
        total_profit=0.0
    )
    snap2 = AccountSnapshot(
        account_id=account.id,
        snapshot_date=datetime.date(2025, 6, 30),
        period_deposit=1000000.0,
        total_valuation=6500000.0,
        total_profit=500000.0
    )
    db_session.add_all([snap1, snap2])
    db_session.commit()

    client = TestClient(app)
    response = client.get("/api/simulation/compound/snapshot-stats")
    assert response.status_code == 200
    data = response.json()
    assert data["has_enough_data"] is False

def test_compound_stats_sufficient_data(db_session: Session):
    """스냅샷 기간이 1년 이상이고 데이터가 충분할 때, 
    기하평균 연평균 수익률 및 연평균 추가금이 올바르게 산출되는지 테스트합니다.
    """
    # 유저 및 계좌 추가
    user = User(name="Test User")
    db_session.add(user)
    db_session.commit()

    account = Account(
        user_id=user.id,
        name="Test Account",
        provider="Test Bank",
        account_type="BANK",
        is_active=True
    )
    db_session.add(account)
    db_session.commit()

    # 2년(730일)에 걸친 스냅샷 생성
    # 2024-01-01: 초기 평가액 10,000,000원, 초기 추가액 10,000,000원 -> 기초 자산 0원
    snap1 = AccountSnapshot(
        account_id=account.id,
        snapshot_date=datetime.date(2024, 1, 1),
        period_deposit=10000000.0,
        total_valuation=10000000.0,
        total_profit=0.0
    )
    # 2025-01-01 (1년 후 기말): 평가액 15,000,000원, 2024년 내 총 추가금 = 10,000,000 + 2,000,000 = 12,000,000원
    # 기초 자산(0) + 추가금(12M) = 12M -> 순수익 = 15M - 12M = 3M -> ROI = 3M / 12M = 25% (0.25)
    snap2 = AccountSnapshot(
        account_id=account.id,
        snapshot_date=datetime.date(2025, 1, 1),
        period_deposit=2000000.0,
        total_valuation=15000000.0,
        total_profit=3000000.0
    )
    # 2026-01-01 (2년 후 기말): 평가액 18,000,000원, 2025년 내 총 추가금 = 3,000,000원
    # 기초 자산(15M) + 추가금(3M) = 18M -> 순수익 = 18M - 18M = 0M -> ROI = 0% (0.0)
    # 2025년 ROI는 0%
    # 2024년 ROI = 25%, 2025년 ROI = 0%
    # 기하평균 = sqrt((1 + 0.25) * (1 + 0.0)) - 1 = sqrt(1.25) - 1 ≈ 11.80% (0.11803)
    snap3 = AccountSnapshot(
        account_id=account.id,
        snapshot_date=datetime.date(2026, 1, 1),
        period_deposit=3000000.0,
        total_valuation=18000000.0,
        total_profit=0.0
    )
    
    db_session.add_all([snap1, snap2, snap3])
    db_session.commit()

    client = TestClient(app)
    response = client.get("/api/simulation/compound/snapshot-stats")
    assert response.status_code == 200
    data = response.json()
    
    assert data["has_enough_data"] is True
    
    # 1. 최신 자산 평가액 검증
    assert data["latest_total_valuation"] == 18000000.0
    
    # 2. 연평균 추가금 검증
    # 전체 period_deposit 합계 = 10M + 2M + 3M = 15,000,000원
    # 전체 기간 = 2026-01-01 - 2024-01-01 = 731일 (윤년 포함하여 약 2.00137년)
    # 연평균 추가금 = 15,000,000 / (731 / 365.25) ≈ 7,494,870원
    expected_days = (datetime.date(2026, 1, 1) - datetime.date(2024, 1, 1)).days
    expected_years = expected_days / 365.25
    expected_annual_deposit = 15000000.0 / expected_years
    assert math.isclose(data["annual_deposit_avg"], expected_annual_deposit, rel_tol=1e-2)
    
    # 3. 연평균 수익률 검증 (기하평균)
    # 2024년 ROI = 0% (0.0), 2025년 ROI = 25% (0.25), 2026년 ROI = 0% (0.0)
    # 기하평균 = ((1.0 * 1.25 * 1.0) ** (1/3)) - 1 = 1.077217 - 1 ≈ 7.72%
    assert math.isclose(data["annual_roi_avg"], 7.72, abs_tol=0.1)
