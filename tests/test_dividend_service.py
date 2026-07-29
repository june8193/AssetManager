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
    samsung = Asset(name="삼성전자우", ticker="005935", major_category="배당주", sub_category="국내배당주", country="KR")
    schd = Asset(name="SCHD", ticker="SCHD", major_category="배당주", sub_category="해외배당주", country="US")
    new_stock = Asset(name="신규배당주", ticker="999999", major_category="배당주", sub_category="국내배당주", country="KR")
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

    session.add_all([tx_sam_1, tx_sam_2, tx_sam_old, tx_schd_1])
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

def test_get_stock_dividend_analysis(db_session):
    """종목별 연환산 추정 배당금 및 고유 통화 기준 배당률 산출 검증"""
    service = DividendService(db_session)
    stocks = service.get_stock_dividend_analysis()

    sam = next(s for s in stocks if s["ticker"] == "005935")
    current_month = datetime.date.today().month
    
    # 삼성전자우: 올해 수령액 140,000원 -> 추정 연배당금 = (140000 / current_month) * 12
    expected_annual = (140000.0 / current_month) * 12
    assert pytest.approx(sam["annual_estimate"], 0.1) == expected_annual
    # 삼성전자우 현재가 58,000원 대비 시가 배당률 = (expected_annual / 58000) * 100
    expected_yield = (expected_annual / 58000.0) * 100
    assert pytest.approx(sam["yield_current"], 0.1) == expected_yield

    assert sam["major_category"] == "배당주"
    assert sam["sub_category"] == "국내배당주"

    # SCHD: 올해 수령액 $100 -> 추정 연배당금 = ($100 / current_month) * 12 (달러 기준)
    schd_stock = next(s for s in stocks if s["ticker"] == "SCHD")
    assert schd_stock["major_category"] == "배당주"
    assert schd_stock["sub_category"] == "해외배당주"
    expected_schd_annual = (100.0 / current_month) * 12
    assert pytest.approx(schd_stock["annual_estimate"], 0.1) == expected_schd_annual
    # SCHD 현재가 $28.0 대비 시가 배당률 = (expected_schd_annual / 28.0) * 100
    expected_schd_yield = (expected_schd_annual / 28.0) * 100
    assert pytest.approx(schd_stock["yield_current"], 0.1) == expected_schd_yield

    # 신규배당주: 수령 실적 0원 -> 추정 0원, 배당률 0.0
    new_st = next(s for s in stocks if s["ticker"] == "999999")
    assert new_st["major_category"] == "배당주"
    assert new_st["sub_category"] == "국내배당주"
    assert new_st["annual_estimate"] == 0.0
    assert new_st["yield_current"] == 0.0
