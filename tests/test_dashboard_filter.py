import pytest
import datetime
from src.backend.models import User, Account, Asset, Transaction, AccountSnapshot
from src.backend.services.dashboard_service import DashboardService

@pytest.fixture
def setup_dashboard_data(db_session):
    """테스트용 기본 데이터를 생성합니다."""
    user = User(name="테스트유저")
    db_session.add(user)
    db_session.flush()

    # 활성 계좌
    active_acc = Account(
        user_id=user.id,
        name="활성계좌",
        provider="테스트증권",
        is_active=True
    )
    # 비활성 계좌
    inactive_acc = Account(
        user_id=user.id,
        name="비활성계좌",
        provider="테스트증권",
        is_active=False
    )
    db_session.add_all([active_acc, inactive_acc])
    db_session.flush()

    # 테스트용 자산 (현금)
    cash_asset = Asset(
        ticker="KRW",
        name="원화예수금",
        major_category="현금",
        sub_category="원화예수금",
        country="KR"
    )
    db_session.add(cash_asset)
    db_session.flush()

    # 트랜잭션 추가 (활성 계좌: 100,000원 입금 / 비활성 계좌: 50,000원 입금)
    today = datetime.date.today()
    tx1 = Transaction(
        account_id=active_acc.id,
        asset_id=cash_asset.id,
        transaction_date=today,
        type="DEPOSIT",
        quantity=100000.0,
        total_amount=100000.0,
        currency="KRW"
    )
    tx2 = Transaction(
        account_id=inactive_acc.id,
        asset_id=cash_asset.id,
        transaction_date=today,
        type="DEPOSIT",
        quantity=50000.0,
        total_amount=50000.0,
        currency="KRW"
    )
    db_session.add_all([tx1, tx2])
    db_session.flush()

    # 스냅샷 추가 (활성 계좌: 100,000원 / 비활성 계좌: 50,000원)
    s1 = AccountSnapshot(
        account_id=active_acc.id,
        snapshot_date=today,
        period_deposit=100000.0,
        total_valuation=100000.0,
        total_profit=0.0
    )
    s2 = AccountSnapshot(
        account_id=inactive_acc.id,
        snapshot_date=today,
        period_deposit=50000.0,
        total_valuation=50000.0,
        total_profit=0.0
    )
    db_session.add_all([s1, s2])
    db_session.commit()
    
    return {
        "user": user,
        "active_acc": active_acc,
        "inactive_acc": inactive_acc,
        "cash_asset": cash_asset
    }

def test_get_holdings_filters_inactive_accounts(db_session, setup_dashboard_data):
    """get_holdings 호출 시 비활성 계좌의 자산이 제외되는지 테스트합니다."""
    service = DashboardService(db_session)
    holdings = service.get_holdings()

    assert len(holdings) == 1
    assert holdings[0]["account"].name == "활성계좌"
    assert holdings[0]["quantity"] == 100000.0

def test_get_yearly_stats_includes_inactive_accounts(db_session, setup_dashboard_data):
    """get_yearly_stats 호출 시 비활성 계좌의 데이터가 포함되는지 테스트합니다."""
    service = DashboardService(db_session)
    stats = service.get_yearly_stats()

    assert len(stats) > 0
    current_year_stat = stats[0]
    
    assert current_year_stat["contribution"] == 150000.0
    assert current_year_stat["assets"] == 150000.0

@pytest.mark.asyncio
async def test_get_dashboard_summary_filters_inactive_accounts(db_session, setup_dashboard_data):
    """get_dashboard_summary 호출 시 비활성 계좌의 데이터가 총계 및 목록에서 제외되는지 테스트합니다."""
    service = DashboardService(db_session)
    summary = await service.get_dashboard_summary()

    assert len(summary["accounts"]) == 1
    assert summary["accounts"][0]["name"] == "활성계좌"
    assert summary["total_valuation_krw"] == 100000.0
