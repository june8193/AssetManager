import pytest
import datetime
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from src.backend.main import app
from src.backend.models import User, Account, AccountSnapshot
from src.backend.services.dashboard_service import DashboardService

client = TestClient(app)

@pytest.fixture
def sample_data(db_session: Session):
    """테스트를 위한 과거 스냅샷 데이터를 준비합니다.
    - 45일 전 스냅샷: 100만원
    - 15일 전 스냅샷: 150만원
    - 오늘 스냅샷: 200만원
    """
    user = User(name="TDD User")
    db_session.add(user)
    db_session.commit()

    acc = Account(user_id=user.id, name="TDD Account", provider="TDD Bank", is_active=True)
    db_session.add(acc)
    db_session.commit()

    today = datetime.date.today()
    date_45_days_ago = today - datetime.timedelta(days=45)
    date_15_days_ago = today - datetime.timedelta(days=15)

    # 45일 전 스냅샷
    db_session.add(AccountSnapshot(
        account_id=acc.id,
        snapshot_date=date_45_days_ago,
        period_deposit=1000000.0,
        total_valuation=1000000.0,
        total_profit=0.0
    ))
    
    # 15일 전 스냅샷
    db_session.add(AccountSnapshot(
        account_id=acc.id,
        snapshot_date=date_15_days_ago,
        period_deposit=0.0,
        total_valuation=1500000.0,
        total_profit=500000.0
    ))

    # 오늘 스냅샷
    db_session.add(AccountSnapshot(
        account_id=acc.id,
        snapshot_date=today,
        period_deposit=0.0,
        total_valuation=2000000.0,
        total_profit=1000000.0
    ))

    db_session.commit()
    return {
        "user": user,
        "account": acc,
        "dates": {
            "d45": date_45_days_ago,
            "d15": date_15_days_ago,
            "today": today
        }
    }

def test_service_snapshots_period_filter(db_session: Session, sample_data):
    """DashboardService.get_snapshots의 기간 필터 및 기본 30일 필터를 검증합니다."""
    service = DashboardService(db_session)

    # 1. 기본값 (파라미터 없음, all_data=False) -> 최근 30일 데이터만 조회되어야 함 (오늘, 15일 전)
    res_default = service.get_snapshots()
    history_default = res_default["history"]
    # 45일 전 데이터는 제외되어야 하므로 총 2개
    assert len(history_default) == 2
    dates = [h["date"] for h in history_default]
    assert sample_data["dates"]["d15"].isoformat() in dates
    assert sample_data["dates"]["today"].isoformat() in dates
    assert sample_data["dates"]["d45"].isoformat() not in dates

    # 2. all_data=True -> 전체 조회되어야 함 (오늘, 15일 전, 45일 전)
    res_all = service.get_snapshots(all_data=True)
    history_all = res_all["history"]
    assert len(history_all) == 3
    dates_all = [h["date"] for h in history_all]
    assert sample_data["dates"]["d45"].isoformat() in dates_all

    # 3. start_date, end_date 지정 -> 해당 기간 데이터만 조회되어야 함
    # 20일 전부터 10일 전까지 지정 -> 15일 전 스냅샷만 나와야 함
    start = datetime.date.today() - datetime.timedelta(days=20)
    end = datetime.date.today() - datetime.timedelta(days=10)
    res_range = service.get_snapshots(start_date=start, end_date=end)
    history_range = res_range["history"]
    assert len(history_range) == 1
    assert history_range[0]["date"] == sample_data["dates"]["d15"].isoformat()


def test_service_daily_stats_period_filter(db_session: Session, sample_data):
    """DashboardService.get_daily_stats의 기간 필터 및 기본 30일 필터를 검증합니다."""
    service = DashboardService(db_session)

    # 1. 기본값 (최근 30일) -> 오늘, 15일 전 데이터 총 2개
    res_default = service.get_daily_stats()
    assert len(res_default) == 2
    dates = [item["date"] for item in res_default]
    assert sample_data["dates"]["d15"] in dates
    assert sample_data["dates"]["today"] in dates
    assert sample_data["dates"]["d45"] not in dates

    # 2. all_data=True -> 전체 조회 (3개)
    res_all = service.get_daily_stats(all_data=True)
    assert len(res_all) == 3
    dates_all = [item["date"] for item in res_all]
    assert sample_data["dates"]["d45"] in dates_all

    # 3. start_date, end_date 지정 -> 15일 전만 조회
    start = datetime.date.today() - datetime.timedelta(days=20)
    end = datetime.date.today() - datetime.timedelta(days=10)
    res_range = service.get_daily_stats(start_date=start, end_date=end)
    assert len(res_range) == 1
    assert res_range[0]["date"] == sample_data["dates"]["d15"]


def test_api_dashboard_endpoints_period_filter(db_session: Session, sample_data):
    """대시보드 API 엔드포인트(/snapshots, /daily)의 쿼리 파라미터 작동을 테스트합니다."""
    # TestClient는 애플리케이션의 의존성을 활용하므로, 
    # db_session 피스처에 의해 데이터가 커밋된 상태에서 요청을 전달받게 됨.
    
    # 1. /api/dashboard/snapshots 기본값 (최근 30일)
    response = client.get("/api/dashboard/snapshots")
    assert response.status_code == 200
    data = response.json()
    assert len(data["history"]) == 2

    # 2. /api/dashboard/snapshots?all=true (전체 데이터)
    response = client.get("/api/dashboard/snapshots?all=true")
    assert response.status_code == 200
    data = response.json()
    assert len(data["history"]) == 3

    # 3. /api/dashboard/snapshots?start_date=...&end_date=...
    start_str = (datetime.date.today() - datetime.timedelta(days=20)).isoformat()
    end_str = (datetime.date.today() - datetime.timedelta(days=10)).isoformat()
    response = client.get(f"/api/dashboard/snapshots?start_date={start_str}&end_date={end_str}")
    assert response.status_code == 200
    data = response.json()
    assert len(data["history"]) == 1
    assert data["history"][0]["date"] == sample_data["dates"]["d15"].isoformat()

    # 4. /api/dashboard/daily 기본값 (최근 30일)
    response = client.get("/api/dashboard/daily")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2

    # 5. /api/dashboard/daily?all=true (전체 데이터)
    response = client.get("/api/dashboard/daily?all=true")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
