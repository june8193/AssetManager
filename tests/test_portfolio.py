import pytest
import datetime
from fastapi.testclient import TestClient
from src.backend.models import User, Account, Asset, Transaction, ExchangeRate, HistoricalPrice
from src.backend.services.portfolio_service import get_portfolio_status
from src.backend.main import app

client = TestClient(app)

@pytest.fixture
def setup_portfolio_data(db_session):
    """테스트용 사용자, 계좌, 자산 마스터 및 초기 예수금 데이터를 셋업합니다."""
    # 1. 사용자 및 계좌 생성
    user = User(name="Test Owner")
    db_session.add(user)
    db_session.commit()

    account = Account(user_id=user.id, name="Test Brokerage", provider="KB증권", is_active=True)
    db_session.add(account)
    db_session.commit()

    # 2. 자산 마스터 데이터 생성
    krw_cash = Asset(ticker="KRW", name="원화예수금", major_category="현금", sub_category="원화예수금", country="KR")
    usd_cash = Asset(ticker="USD", name="달러예수금", major_category="현금", sub_category="달러예수금", country="US")
    aapl = Asset(ticker="AAPL", name="애플", major_category="주식", sub_category="코어(지수)", country="US")
    samsung = Asset(ticker="005930", name="삼성전자", major_category="주식", sub_category="알파(성장)", country="KR")
    db_session.add_all([krw_cash, usd_cash, aapl, samsung])
    db_session.commit()

    # 3. 환율 정보 셋업 (2026-06-20: 1350원, 2026-06-23: 1360원)
    rate1 = ExchangeRate(date=datetime.date(2026, 6, 20), currency="USD", rate=1350.0)
    rate2 = ExchangeRate(date=datetime.date(2026, 6, 23), currency="USD", rate=1360.0)
    db_session.add_all([rate1, rate2])
    db_session.commit()

    # 4. 주가 정보 셋업 (테스트 일자에 해당하는 주가들을 미리 로컬 DB 캐시에 준비)
    price_aapl_1 = HistoricalPrice(ticker="AAPL", price_date=datetime.date(2026, 6, 20), close_price=180.0)
    price_aapl_2 = HistoricalPrice(ticker="AAPL", price_date=datetime.date(2026, 6, 22), close_price=185.0)
    price_aapl_3 = HistoricalPrice(ticker="AAPL", price_date=datetime.date(2026, 6, 23), close_price=186.0)
    
    price_sam_1 = HistoricalPrice(ticker="005930", price_date=datetime.date(2026, 6, 20), close_price=70000.0)
    price_sam_2 = HistoricalPrice(ticker="005930", price_date=datetime.date(2026, 6, 22), close_price=71000.0)
    price_sam_3 = HistoricalPrice(ticker="005930", price_date=datetime.date(2026, 6, 23), close_price=71500.0)
    
    db_session.add_all([price_aapl_1, price_aapl_2, price_aapl_3, price_sam_1, price_sam_2, price_sam_3])
    db_session.commit()

    # 5. 거래 내역 삽입
    # 2026-06-20: KRW 1,000,000 입금 및 USD 1,000 입금
    tx_dep_krw = Transaction(
        account_id=account.id, asset_id=krw_cash.id,
        transaction_date=datetime.date(2026, 6, 20), type="DEPOSIT",
        quantity=1000000.0, price=1.0, total_amount=1000000.0, currency="KRW"
    )
    tx_dep_usd = Transaction(
        account_id=account.id, asset_id=usd_cash.id,
        transaction_date=datetime.date(2026, 6, 20), type="DEPOSIT",
        quantity=1000.0, price=1.0, total_amount=1000.0, currency="USD"
    )
    db_session.add_all([tx_dep_krw, tx_dep_usd])
    db_session.commit()

    # 2026-06-21: 삼성전자 10주 매수 (단가 70,000원) -> KRW 700,000 차감
    tx_buy_sam = Transaction(
        account_id=account.id, asset_id=samsung.id,
        transaction_date=datetime.date(2026, 6, 21), type="BUY",
        quantity=10.0, price=70000.0, total_amount=700000.0, currency="KRW"
    )
    # 2026-06-21: AAPL 5주 매수 (단가 180$) -> USD 900 차감
    tx_buy_aapl = Transaction(
        account_id=account.id, asset_id=aapl.id,
        transaction_date=datetime.date(2026, 6, 21), type="BUY",
        quantity=5.0, price=180.0, total_amount=900.0, currency="USD"
    )
    db_session.add_all([tx_buy_sam, tx_buy_aapl])
    db_session.commit()

    # 2026-06-23: 삼성전자 3주 매도 (단가 71,000원) -> KRW 213,000 가산
    tx_sell_sam = Transaction(
        account_id=account.id, asset_id=samsung.id,
        transaction_date=datetime.date(2026, 6, 23), type="SELL",
        quantity=3.0, price=71000.0, total_amount=213000.0, currency="KRW"
    )
    db_session.add(tx_sell_sam)
    db_session.commit()

    return {
        "account": account,
        "krw_cash": krw_cash,
        "usd_cash": usd_cash,
        "aapl": aapl,
        "samsung": samsung
    }

@pytest.mark.asyncio
async def test_get_portfolio_status_by_date(db_session, setup_portfolio_data):
    """특정 과거 일자에 맞추어 주식 수량 및 예수금 잔고가 정확히 조회되는지 확인합니다."""
    # 1. 2026-06-20 기준 (입금만 완료된 상태)
    status_20 = await get_portfolio_status(db_session, "2026-06-20")
    assert status_20["cash_balances"]["KRW"] == 1000000.0
    assert status_20["cash_balances"]["USD"] == 1000.0
    assert len(status_20["holdings"]) == 0  # 주식 매수 전

    # 2. 2026-06-22 기준 (삼성전자 10주, AAPL 5주 매수한 상태)
    # 예수금: KRW 300,000 (100만 - 70만), USD 100 (1000 - 900)
    status_22 = await get_portfolio_status(db_session, "2026-06-22")
    assert status_22["cash_balances"]["KRW"] == 300000.0
    assert status_22["cash_balances"]["USD"] == 100.0
    
    # 보유 종목 검증
    holdings = {h["ticker"]: h for h in status_22["holdings"]}
    assert len(holdings) == 2
    assert holdings["AAPL"]["quantity"] == 5.0
    assert holdings["AAPL"]["current_price"] == 185.0  # 22일 주가 반영
    assert holdings["AAPL"]["valuation"] == 5.0 * 185.0
    
    assert holdings["005930"]["quantity"] == 10.0
    assert holdings["005930"]["current_price"] == 71000.0  # 22일 주가 반영

    # 3. 2026-06-23 기준 (삼성전자 3주 매도한 상태)
    # 예수금: KRW 513,000 (30만 + 21.3만)
    # 삼성전자 수량: 7주
    status_23 = await get_portfolio_status(db_session, "2026-06-23")
    assert status_23["cash_balances"]["KRW"] == 513000.0
    holdings_23 = {h["ticker"]: h for h in status_23["holdings"]}
    assert holdings_23["005930"]["quantity"] == 7.0

@pytest.mark.asyncio
async def test_get_portfolio_status_exchange_rate_fallback(db_session, setup_portfolio_data):
    """과거 환율이 등록되어 있지 않은 주말/공휴일 조회 시 직전 영업일의 최근 환율을 사용하는지 검증합니다."""
    # 2026-06-21 (일요일) 조회
    # DB에는 2026-06-20 환율(1350.0)만 있으므로 이를 사용해야 함 (23일 환율은 미래이므로 배제)
    status_21 = await get_portfolio_status(db_session, "2026-06-21")
    assert status_21["exchange_rate"] == 1350.0

    # 2026-06-23 (화요일) 조회 -> 당일 환율(1360.0)이 있으므로 그것을 사용해야 함
    status_23 = await get_portfolio_status(db_session, "2026-06-23")
    assert status_23["exchange_rate"] == 1360.0

def test_portfolio_status_api_endpoint(db_session, setup_portfolio_data):
    """TestClient를 통해 REST API 엔드포인트의 구조와 응답을 검증합니다."""
    # 실제 애플리케이션의 DB 의존성을 테스트 세션 DB로 재정의
    from src.backend.database import get_db
    app.dependency_overrides[get_db] = lambda: db_session

    try:
        response = client.get("/api/portfolio/status?date=2026-06-22")
        assert response.status_code == 200
        data = response.json()

        assert "total_valuation_krw" in data
        assert "cash_balances" in data
        assert "exchange_rate" in data
        assert "holdings" in data

        assert data["cash_balances"]["KRW"] == 300000.0
        assert len(data["holdings"]) == 2
    finally:
        # 의존성 재정의 해제
        app.dependency_overrides.clear()
