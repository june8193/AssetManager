# -*- coding: utf-8 -*-
import datetime
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.backend.models import Base, Account, Asset, Transaction, ExchangeRate, User, HistoricalPrice
from src.backend.services.dividend_service import DividendService

@pytest.fixture
def db_session():
    """테스트용 인메모리 SQLite DB 세션 피스처"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    # 테스트 기초 데이터 생성
    # 0. 사용자 생성
    user = User(name="테스트유저")
    session.add(user)
    session.commit()

    # 1. 계좌
    acc_kr = Account(user_id=user.id, name="111-222", provider="키움증권", alias="한국증권", is_active=True)
    acc_us = Account(user_id=user.id, name="333-444", provider="키움증권", alias="미국증권", is_active=True)
    session.add_all([acc_kr, acc_us])
    session.commit()

    # 2. 환율 (USD/KRW = 1350원)
    rate = ExchangeRate(currency="USD", rate=1350.0, date=datetime.date.today())
    session.add(rate)

    # 3. 자산 마스터 (삼성전자우, SCHD, 신규배당주)
    samsung = Asset(name="삼성전자우", ticker="005935", major_category="주식", sub_category="배당주", country="KR")
    schd = Asset(name="SCHD", ticker="SCHD", major_category="주식", sub_category="배당주", country="US")
    new_stock = Asset(name="신규배당주", ticker="999999", major_category="주식", sub_category="배당주", country="KR")
    session.add_all([samsung, schd, new_stock])
    session.commit()

    # 4. 종가 데이터 (HistoricalPrice)
    today = datetime.date.today()
    hp_sam = HistoricalPrice(ticker="005935", price_date=today, close_price=58000.0)
    hp_schd = HistoricalPrice(ticker="SCHD", price_date=today, close_price=28.0)
    session.add_all([hp_sam, hp_schd])
    session.commit()

    # 4. 배당 거래 내역 (INTEREST)
    current_year = datetime.date.today().year
    
    # 삼성전자우 올해 배당금 수령
    tx_sam_1 = Transaction(
        account_id=acc_kr.id, asset_id=samsung.id,
        transaction_date=datetime.date(current_year, 3, 15),
        type="INTEREST", quantity=0, price=70000.0, total_amount=70000.0,
        currency="KRW", memo="키움 자동저장 (배당금)"
    )
    tx_sam_2 = Transaction(
        account_id=acc_kr.id, asset_id=samsung.id,
        transaction_date=datetime.date(current_year, 6, 15),
        type="INTEREST", quantity=0, price=70000.0, total_amount=70000.0,
        currency="KRW", memo="키움 자동저장 (배당금)"
    )
    # 작년 배당금 내역
    tx_sam_old = Transaction(
        account_id=acc_kr.id, asset_id=samsung.id,
        transaction_date=datetime.date(current_year - 1, 12, 15),
        type="INTEREST", quantity=0, price=60000.0, total_amount=60000.0,
        currency="KRW", memo="작년 배당금"
    )

    # SCHD 올해 배당금 수령 (USD)
    tx_schd_1 = Transaction(
        account_id=acc_us.id, asset_id=schd.id,
        transaction_date=datetime.date(current_year, 4, 10),
        type="INTEREST", quantity=0, price=100.0, total_amount=100.0,
        currency="USD", memo="SCHD dividend"
    )

    # BUY 거래 추가 (삼성전자우 100주 @ 50,000원, SCHD 50주 @ $25.0)
    tx_sam_buy = Transaction(
        account_id=acc_kr.id, asset_id=samsung.id,
        transaction_date=datetime.date(current_year - 1, 1, 10),
        type="BUY", quantity=100.0, price=50000.0, total_amount=5000000.0,
        currency="KRW", memo="삼성전자우 매수"
    )
    tx_schd_buy = Transaction(
        account_id=acc_us.id, asset_id=schd.id,
        transaction_date=datetime.date(current_year - 1, 1, 10),
        type="BUY", quantity=50.0, price=25.0, total_amount=1250.0,
        currency="USD", memo="SCHD 매수"
    )

    session.add_all([tx_sam_1, tx_sam_2, tx_sam_old, tx_schd_1, tx_sam_buy, tx_schd_buy])
    session.commit()

    yield session

    session.close()

def test_get_dividend_summary(db_session):
    """배당 요약 및 시계열 추이 산출 로직 검증"""
    service = DividendService(db_session)
    summary = service.get_dividend_summary()

    # 요약 카드 검증
    # 삼성전자우 올해 14만원, SCHD 올해 $100 (* 1350 = 135,000원) => 올해 총 275,000원
    assert summary["ytd_krw"] == 275000.0
    # 작년 삼성 6만원 포함 총 누적 = 275,000 + 60,000 = 335,000원
    assert summary["total_krw"] == 335000.0
    assert "monthly_data" in summary
    assert "avg_yield" in summary
    assert 0 < summary["avg_yield"] < 100.0

def test_get_stock_dividend_analysis_ttm(db_session):
    """종목별 최근 12개월(TTM) 실수령 배당금 및 수량 기반 배당률 산출 검증"""
    service = DividendService(db_session)
    stocks = service.get_stock_dividend_analysis()

    sam = next(s for s in stocks if s["ticker"] == "005935")
    # 삼성전자우: 최근 1년(TTM) 수령액 = 올해 140,000원 (+ 작년 12월 60,000원은 오늘 기준 1년 이내면 포함)
    assert sam["quantity"] == 100.0
    assert sam["buy_price"] == 50000.0
    assert sam["current_price"] == 58000.0
    assert sam["ytd_amount"] == 140000.0
    assert "ttm_amount" in sam
    assert sam["ttm_amount"] >= 140000.0

    # 시가 배당률: (ttm_amount / (58,000 * 100)) * 100 -> 현실적인 2~5% 범위여야 함 (100% 미만)
    assert sam["yield_ttm_current"] < 100.0
    expected_yield = (sam["ttm_amount"] / (58000.0 * 100.0)) * 100
    assert pytest.approx(sam["yield_ttm_current"], 0.01) == round(expected_yield, 2)

    # 매수가 대비 배당률 (YoC): (ttm_amount / (50,000 * 100)) * 100
    expected_yoc = (sam["ttm_amount"] / (50000.0 * 100.0)) * 100
    assert pytest.approx(sam["yield_ttm_cost"], 0.01) == round(expected_yoc, 2)

    # SCHD (달러 자산):
    schd_stock = next(s for s in stocks if s["ticker"] == "SCHD")
    assert schd_stock["quantity"] == 50.0
    assert schd_stock["buy_price"] == 25.0
    assert schd_stock["current_price"] == 28.0
    assert schd_stock["ytd_amount"] == 100.0
    assert schd_stock["ttm_amount"] == 100.0
    # 시가 배당률: (100 / (28.0 * 50)) * 100 = 7.14%
    assert pytest.approx(schd_stock["yield_ttm_current"], 0.01) == 7.14
    # 매수가 배당률: (100 / (25.0 * 50)) * 100 = 8.00%
    assert pytest.approx(schd_stock["yield_ttm_cost"], 0.01) == 8.00

    # 신규배당주 (미보유, 배당실적 0):
    new_st = next(s for s in stocks if s["ticker"] == "999999")
    assert new_st["quantity"] == 0.0
    assert new_st["ttm_amount"] == 0.0
    assert new_st["yield_ttm_current"] == 0.0
    assert new_st["yield_ttm_cost"] == 0.0


def test_get_dividend_summary_with_tax(db_session):
    """배당세(TAX)가 존재할 때 세후 배당금 차감 집계를 검증합니다."""
    # SCHD에 대한 세금 13,500원 (USD 환율 1350 기준 10달러) 차감 적재
    current_year = datetime.date.today().year
    schd = db_session.query(Asset).filter(Asset.ticker == "SCHD").first()
    acc_us = db_session.query(Account).filter(Account.alias == "미국증권").first()

    tax_tx = Transaction(
        account_id=acc_us.id, asset_id=schd.id,
        transaction_date=datetime.date(current_year, 4, 10),
        type="TAX", quantity=0.0, price=0.0, total_amount=13500.0,
        currency="KRW", memo="SCHD 해외배당세출금"
    )
    db_session.add(tax_tx)
    db_session.commit()

    service = DividendService(db_session)
    summary = service.get_dividend_summary()

    # 세전 YTD = 275,000원, 세금 TAX = 13,500원 => 세후 YTD = 261,500원
    assert summary["ytd_krw"] == 261500.0
    # 세전 총 누적 = 335,000원, 세금 TAX = 13,500원 => 세후 총 누적 = 321,500원
    assert summary["total_krw"] == 321500.0

def test_get_dividend_summary_ignores_cash_tax_and_interest(db_session):
    """현금 예수금(KRW, USD)에 부과된 일반 양도소득세 출금(TAX) 및 단순 예수금 이자는 배당 분석에서 제외됨을 검증합니다."""
    current_year = datetime.date.today().year
    krw_cash = Asset(name="원화예수금", ticker="KRW", major_category="현금", sub_category="원화예수금", country="KR")
    usd_cash = Asset(name="달러예수금", ticker="USD", major_category="현금", sub_category="달러예수금", country="US")
    db_session.add_all([krw_cash, usd_cash])
    db_session.commit()

    acc_kr = db_session.query(Account).filter(Account.alias == "한국증권").first()

    # 거액의 양도소득세 납부 내역 (예: 3,437,460원)
    cash_tax_tx = Transaction(
        account_id=acc_kr.id, asset_id=krw_cash.id,
        transaction_date=datetime.date(current_year, 5, 10),
        type="TAX", quantity=1.0, price=3437460.0, total_amount=3437460.0,
        currency="KRW", memo="양도소득세 출금"
    )
    # 예수금 단순 이자 (예: 66원)
    cash_interest_tx = Transaction(
        account_id=acc_kr.id, asset_id=krw_cash.id,
        transaction_date=datetime.date(current_year, 4, 25),
        type="INTEREST", quantity=1.0, price=66.0, total_amount=66.0,
        currency="KRW", memo="예탁금 이용료 이자"
    )
    db_session.add_all([cash_tax_tx, cash_interest_tx])
    db_session.commit()

    service = DividendService(db_session)
    summary = service.get_dividend_summary()

    # 현금 예수금 세금 343만원이 차감되어 음수가 되지 않고, 투자 자산 배당금(275,000원)만 집계되어야 함
    assert summary["ytd_krw"] == 275000.0
    assert summary["total_krw"] == 335000.0

    # 종목별 배당 분석 목록에도 현금(KRW, USD)은 포함되지 않아야 함
    stocks = service.get_stock_dividend_analysis()
    tickers = [s["ticker"] for s in stocks]
    assert "KRW" not in tickers
    assert "USD" not in tickers


