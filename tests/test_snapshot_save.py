import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import date, timedelta
from unittest.mock import patch, AsyncMock

from src.backend.database import Base, get_db
from src.backend.main import app
from src.backend.models import Account, Asset, Transaction, AccountSnapshot, User

# 테스트용 DB 설정
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_snapshot.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()

def test_snapshot_preview_and_save_detailed(client, db_session):
    # 1. 기초 데이터 생성
    user = User(name="Test User")
    db_session.add(user)
    db_session.commit()
    
    # 계좌 생성
    acc1 = Account(user_id=user.id, name="KR Account", provider="Bank A", is_active=True)
    acc2 = Account(user_id=user.id, name="US Account", provider="Broker B", is_active=True)
    db_session.add_all([acc1, acc2])
    db_session.commit()
    
    # 자산 생성
    kr_stock = Asset(ticker="005930", name="Samsung", major_category="Stock", sub_category="KR Stock", country="KR")
    us_stock = Asset(ticker="AAPL", name="Apple", major_category="Stock", sub_category="US Stock", country="US")
    cash_krw = Asset(ticker="KRW", name="Cash KRW", major_category="Cash", sub_category="Cash", country="KR")
    cash_usd = Asset(ticker="USD", name="Cash USD", major_category="Cash", sub_category="Cash", country="US")
    db_session.add_all([kr_stock, us_stock, cash_krw, cash_usd])
    db_session.commit()
    
    # 거래 내역 생성
    # KR 계좌: 기초 자산 1,000,000원 + 삼성전자 10주 매수 (수량: 1,000,000원 현금 차감은 별도로 입력하지 않음. get_holdings()는 모든 입금/매수를 합산함)
    # get_holdings() 로직: 
    #   현금(KRW): +1,000,000 (INITIAL_BALANCE) -> 1,000,000개
    #   삼성전자: +10 (BUY) -> 10개
    #   총 평가액 = (1,000,000 * 1.0) + (10 * 60,000) = 1,600,000원
    #   Net Deposit = 1,000,000 (INITIAL_BALANCE)
    #   Profit = 1,600,000 - 1,000,000 = 600,000원
    
    db_session.add(Transaction(
        account_id=acc1.id, asset_id=cash_krw.id, transaction_date=date.today() - timedelta(days=20),
        type="INITIAL_BALANCE", quantity=1000000.0, price=1.0, total_amount=1000000.0, currency="KRW"
    ))
    db_session.add(Transaction(
        account_id=acc1.id, asset_id=kr_stock.id, transaction_date=date.today() - timedelta(days=10),
        type="BUY", quantity=10.0, price=50000.0, total_amount=500000.0, currency="KRW"
    ))
    
    # US 계좌: 입금 1,000 USD + 애플 5주 매수
    # get_holdings() 로직:
    #   현금(USD): +1,000 (DEPOSIT) -> 1,000개
    #   애플: +5 (BUY) -> 5개
    #   총 Valuation (USD) = (1,000 * 1.0) + (5 * 1.0) = 1,005? 아님. 애플 가격은 170.
    #   Valuation (USD) = (1,000 * 1.0) + (5 * 170.0) = 1,000 + 850 = 1,850 USD
    #   Valuation (KRW) = 1,850 * 1,400 = 2,590,000원
    #   Net Deposit (KRW) = 1,000 USD * 1,300(당시환율) = 1,300,000원
    #   Profit = 2,590,000 - 1,300,000 = 1,290,000원
    
    db_session.add(Transaction(
        account_id=acc2.id, asset_id=cash_usd.id, transaction_date=date.today() - timedelta(days=20),
        type="DEPOSIT", quantity=1000.0, price=1.0, total_amount=1000.0, currency="USD", exchange_rate=1300.0
    ))
    db_session.add(Transaction(
        account_id=acc2.id, asset_id=us_stock.id, transaction_date=date.today() - timedelta(days=10),
        type="BUY", quantity=5.0, price=150.0, total_amount=750.0, currency="USD", exchange_rate=1300.0
    ))
    db_session.commit()
    
    # DashboardService.get_current_prices 모킹
    mock_prices = {
        "005930": 60000.0,
        "AAPL": 170.0,
        "KRW": 1.0,
        "USD": 1.0
    }
    
    with patch("src.backend.routers.db_manage.DashboardService.get_current_prices", new_callable=AsyncMock) as mock_get_prices:
        mock_get_prices.return_value = mock_prices
        
        # 2. 미리보기 요청 (입력 환율 1,400원)
        response = client.post("/api/db/snapshots/preview", json={
            "snapshot_date": str(date.today()),
            "exchange_rate": 1400.0
        })
        
        assert response.status_code == 200
        previews = response.json()
        
        # KR 계좌 검증
        kr_preview = next(p for p in previews if p["account_name"] == "KR Account")
        assert kr_preview["total_valuation"] == 1600000.0
        assert kr_preview["total_profit"] == 600000.0
        
        # US 계좌 검증
        us_preview = next(p for p in previews if p["account_name"] == "US Account")
        assert us_preview["total_valuation"] == 2590000.0
        assert us_preview["total_profit"] == 1290000.0
        
        # 3. 최종 저장 요청
        save_response = client.post("/api/db/snapshots/save", json=previews)
        assert save_response.status_code == 200
        
        # DB 저장 확인
        snaps = db_session.query(AccountSnapshot).filter(AccountSnapshot.snapshot_date == date.today()).all()
        assert len(snaps) == 2
