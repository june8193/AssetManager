
import pytest
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.backend.models import Base, User, Account, Asset, Transaction, AccountSnapshot
from src.backend.services.dashboard_service import DashboardService

# 테스트용 인메모리 DB 설정
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture
def db():
    """테스트용 데이터베이스 세션을 제공합니다."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        # 기본 데이터 생성
        user = User(name="테스트유저")
        db.add(user)
        db.flush()

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
        db.add_all([active_acc, inactive_acc])
        db.flush()

        # 테스트용 자산 (현금)
        cash_asset = Asset(
            ticker="KRW",
            name="원화예수금",
            major_category="현금",
            sub_category="원화예수금",
            country="KR"
        )
        db.add(cash_asset)
        db.flush()

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
        db.add_all([tx1, tx2])
        db.flush()

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
        db.add_all([s1, s2])
        db.commit()

        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

def test_get_holdings_filters_inactive_accounts(db):
    """get_holdings 호출 시 비활성 계좌의 자산이 제외되는지 테스트합니다."""
    service = DashboardService(db)
    holdings = service.get_holdings()

    # 검증: 활성 계좌의 데이터(100,000)만 포함되어야 함
    # 현재 로직에서는 get_holdings 내부에서 Account 조회 시 is_active=True 필터가 있으므로
    # 비활성 계좌의 트랜잭션은 결과 리스트에 포함되지 않을 것임.
    # 하지만 트랜잭션 전체를 조회한 후 루프를 돌기 때문에 비효율적인 상태임.
    
    assert len(holdings) == 1
    assert holdings[0]["account"].name == "활성계좌"
    assert holdings[0]["quantity"] == 100000.0

def test_get_yearly_stats_includes_inactive_accounts(db):
    """get_yearly_stats 호출 시 비활성 계좌의 데이터가 포함되는지 테스트합니다."""
    service = DashboardService(db)
    stats = service.get_yearly_stats()

    # 검증: 활성 계좌(100,000)와 비활성 계좌(50,000)의 데이터가 모두 반영되어야 함 (총 150,000)
    assert len(stats) > 0
    current_year_stat = stats[0]
    
    # 비활성 계좌의 데이터가 포함되어야 하므로 기여도(contribution)와 자산(assets)은 150,000이어야 함
    assert current_year_stat["contribution"] == 150000.0
    assert current_year_stat["assets"] == 150000.0

@pytest.mark.asyncio
async def test_get_dashboard_summary_filters_inactive_accounts(db):
    """get_dashboard_summary 호출 시 비활성 계좌의 데이터가 총계 및 목록에서 제외되는지 테스트합니다."""
    service = DashboardService(db)
    
    # get_dashboard_summary는 내부적으로 get_current_prices를 호출하는데, 
    # 여기서는 KRW 자산만 사용하므로 외부 API 호출 없이 1.0으로 계산됨.
    summary = await service.get_dashboard_summary()

    # 검증: 활성 계좌 1개만 포함되어야 함
    assert len(summary["accounts"]) == 1
    assert summary["accounts"][0]["name"] == "활성계좌"
    
    # 검증: 총 평가액이 활성 계좌의 것(100,000)만 반영되어야 함
    # 현재 get_holdings에서 이미 필터링을 하고 있으므로 이 값은 100,000으로 나올 수도 있음.
    # 하지만 만약 get_holdings 로직이 변경되거나 오동작한다면 여기서 잡아낼 수 있음.
    assert summary["total_valuation_krw"] == 100000.0
