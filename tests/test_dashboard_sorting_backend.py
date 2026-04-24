import pytest
import datetime
import asyncio
from unittest.mock import MagicMock, AsyncMock, patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.backend.models import Base, User, Account, Asset, Transaction, ExchangeRate
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

@pytest.mark.asyncio
async def test_get_dashboard_summary_includes_category_info(db_session):
    """대시보드 요약 API 응답에 자산의 카테고리 정보가 포함되는지 검증합니다."""
    # 1. 테스트 데이터 설정
    user = User(name="Test User")
    db_session.add(user)
    db_session.commit()

    account = Account(user_id=user.id, name="Test Account", provider="Test Broker", is_active=True)
    db_session.add(account)
    db_session.commit()

    asset = Asset(
        ticker="AAPL", 
        name="애플", 
        major_category="일반주식", 
        sub_category="해외주식", 
        country="US"
    )
    db_session.add(asset)
    db_session.commit()

    # 트랜잭션 추가 (보유량 생성)
    tx = Transaction(
        account_id=account.id,
        asset_id=asset.id,
        transaction_date=datetime.date.today(),
        type="BUY",
        quantity=10.0,
        price=150.0,
        total_amount=1500.0,
        currency="USD"
    )
    db_session.add(tx)
    
    # 환율 정보 추가
    ex_rate = ExchangeRate(
        date=datetime.date.today(),
        currency="USD",
        rate=1300.0
    )
    db_session.add(ex_rate)
    db_session.commit()

    # 2. 서비스 호출 (가격을 170.0으로 모킹)
    with patch("src.backend.services.dashboard_service.KiwoomAPI"), \
         patch("src.backend.services.dashboard_service.KiwoomAuthManager"):
        
        service = DashboardService(db_session)
        
        # get_current_prices 모킹
        service.get_current_prices = AsyncMock(return_value={"AAPL": 170.0})
        
        summary = await service.get_dashboard_summary()
        
        # 3. 검증
        assert "accounts" in summary
        assert len(summary["accounts"]) > 0
        
        acc_summary = summary["accounts"][0]
        assert "assets" in acc_summary
        assert len(acc_summary["assets"]) > 0
        
        asset_info = acc_summary["assets"][0]
        assert asset_info["ticker"] == "AAPL"
        assert asset_info["category"] == "일반주식"
        assert asset_info["sub_category"] == "해외주식"
        assert asset_info["valuation_krw"] == 10.0 * 170.0 * 1300.0
