import pytest
import datetime
from src.backend.models import User, Account, AccountSnapshot
from src.backend.services.dashboard_service import DashboardService

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
    data = service.get_snapshots(all_data=True)

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


def test_get_snapshots_twr_index_calculation(db_session):
    """입출금(period_deposit)을 제외한 시간가중수익률(TWR) 연쇄 지수 산출 및 get_daily_stats 일별 roi 일치 여부를 검증합니다."""
    user = User(name="Test User")
    db_session.add(user)
    db_session.commit()

    acc1 = Account(user_id=user.id, name="Account 1", provider="Bank A")
    acc2 = Account(user_id=user.id, name="Account 2", provider="Bank B")
    db_session.add_all([acc1, acc2])
    db_session.commit()

    # Day 1 (2024-01-01): 최초 스냅샷 기준일 -> index = 1000.0, change = 0.0, cum = 0.0
    # 총자산: 3000 (1000 + 2000), 입금: 3000 (1000 + 2000)
    db_session.add_all([
        AccountSnapshot(
            account_id=acc1.id,
            snapshot_date=datetime.date(2024, 1, 1),
            period_deposit=1000.0,
            total_valuation=1000.0,
        ),
        AccountSnapshot(
            account_id=acc2.id,
            snapshot_date=datetime.date(2024, 1, 1),
            period_deposit=2000.0,
            total_valuation=2000.0,
        ),
    ])

    # Day 2 (2024-01-02): 대규모 추가 입금 +500 및 투자 수익 +500 발생
    # 총자산: 4000 (1500 + 2500), 입금: 500 (0 + 500)
    # increase = 4000 - 3000 = 1000, profit = 1000 - 500 = 500
    # base = 3000 + 500 = 3500
    # r_1 = 500 / 3500 = 0.142857142857... -> index_change_pct = 14.29
    # raw_index_1 = 1000.0 * (1 + 500/3500) = 1142.857142857... -> index = 1142.86, cum = 14.29
    db_session.add_all([
        AccountSnapshot(
            account_id=acc1.id,
            snapshot_date=datetime.date(2024, 1, 2),
            period_deposit=0.0,
            total_valuation=1500.0,
        ),
        AccountSnapshot(
            account_id=acc2.id,
            snapshot_date=datetime.date(2024, 1, 2),
            period_deposit=500.0,
            total_valuation=2500.0,
        ),
    ])

    # Day 3 (2024-01-03): 출금 -500 및 투자 손실 -350 발생
    # 총자산: 3150 (1400 + 1750), 입금: -500 (0 + -500)
    # increase = 3150 - 4000 = -850, profit = -850 - (-500) = -350
    # base = 4000 + (-500) = 3500
    # r_2 = -350 / 3500 = -0.10 -> index_change_pct = -10.0
    # raw_index_2 = 1142.857142857... * (1 - 0.10) = 1028.57142857... -> index = 1028.57, cum = 2.86
    db_session.add_all([
        AccountSnapshot(
            account_id=acc1.id,
            snapshot_date=datetime.date(2024, 1, 3),
            period_deposit=0.0,
            total_valuation=1400.0,
        ),
        AccountSnapshot(
            account_id=acc2.id,
            snapshot_date=datetime.date(2024, 1, 3),
            period_deposit=-500.0,
            total_valuation=1750.0,
        ),
    ])
    db_session.commit()

    service = DashboardService(db_session)
    snap_data = service.get_snapshots(all_data=True)
    daily_stats = service.get_daily_stats(all_data=True)
    daily_by_date = {s["date"].isoformat(): s for s in daily_stats}

    history = snap_data["history"]
    assert len(history) == 3

    # Day 1 검증
    d1 = history[0]
    assert d1["date"] == "2024-01-01"
    assert d1["total"] == 3000.0
    assert d1["period_deposit"] == 3000.0
    assert d1["index"] == 1000.0
    assert d1["index_change_pct"] == 0.0
    assert d1["index_cum_return_pct"] == 0.0

    # Day 2 검증
    d2 = history[1]
    assert d2["date"] == "2024-01-02"
    assert d2["total"] == 4000.0
    assert d2["period_deposit"] == 500.0
    assert d2["index"] == 1142.86
    assert d2["index_change_pct"] == 14.29
    assert d2["index_cum_return_pct"] == 14.29
    assert d2["index_change_pct"] == daily_by_date["2024-01-02"]["roi"]

    # Day 3 검증 (부동소수점 원본 연쇄 곱셈 확인)
    d3 = history[2]
    assert d3["date"] == "2024-01-03"
    assert d3["total"] == 3150.0
    assert d3["period_deposit"] == -500.0
    assert d3["index"] == 1028.57
    assert d3["index_change_pct"] == -10.0
    assert d3["index_cum_return_pct"] == 2.86
    assert d3["index_change_pct"] == daily_by_date["2024-01-03"]["roi"]
