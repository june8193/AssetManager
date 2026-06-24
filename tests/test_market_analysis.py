# -*- coding: utf-8 -*-
"""지표분석 서비스 및 API 엔드포인트에 대한 TDD 테스트 모듈입니다."""

import datetime
import pytest
import pandas as pd
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.backend.main import app
from src.backend.models import HistoricalPrice
from src.backend.services.market_analysis_service import MarketAnalysisService

client = TestClient(app)

def create_dummy_prices(db: Session, ticker: str, start_date: datetime.date, end_date: datetime.date, base_price: float, daily_change: float = 0.0):
    """테스트용 더미 지수 데이터를 생성합니다."""
    curr_date = start_date
    curr_price = base_price
    prices = []
    
    # 0.0보다 큰 가격을 시뮬레이션
    while curr_date <= end_date:
        # 주말 제외
        if curr_date.weekday() < 5:
            # daily_change 비율로 변동
            curr_price = curr_price * (1 + daily_change)
            p = HistoricalPrice(
                ticker=ticker,
                price_date=curr_date,
                close_price=round(curr_price, 2)
            )
            db.add(p)
            prices.append(p)
        curr_date += datetime.timedelta(days=1)
    db.commit()
    return prices

@pytest.mark.asyncio
@patch('yfinance.download')
async def test_market_analysis_service_historical_data_sampling(mock_download, db_session: Session):
    """3년 이하와 3년 초과 조회 시 각각 일별 및 주간 다운샘플링이 적절히 적용되는지 검증합니다."""
    mock_download.return_value = pd.DataFrame()
    service = MarketAnalysisService(db_session)
    ticker = "^GSPC"
    
    # 1. 2년치 데이터 생성 (3년 이하)
    start_2yr = datetime.date(2024, 1, 1)
    end_2yr = datetime.date(2025, 12, 31)
    create_dummy_prices(db_session, ticker, start_2yr, end_2yr, 1000.0, daily_change=0.0005)
    
    # 조회
    res_2yr = await service.get_historical_data(ticker, start_2yr, end_2yr)
    
    # 3년 이하이므로 일별 데이터 그대로 제공 (단, 비영업일 제외)
    # 영업일만 반환되었는지 확인
    assert len(res_2yr["labels"]) > 0
    assert len(res_2yr["prices"]) == len(res_2yr["labels"])
    assert len(res_2yr["mdd"]) == len(res_2yr["labels"])
    
    # MDD가 계산되었는지 확인 (최대 낙폭이므로 0 이하)
    for m in res_2yr["mdd"]:
        assert m <= 0.0

    # DB 초기화
    db_session.query(HistoricalPrice).delete()
    db_session.commit()

    # 2. 4년치 데이터 생성 (3년 초과)
    start_4yr = datetime.date(2022, 1, 1)
    end_4yr = datetime.date(2025, 12, 31)
    create_dummy_prices(db_session, ticker, start_4yr, end_4yr, 1000.0, daily_change=0.0005)
    
    res_4yr = await service.get_historical_data(ticker, start_4yr, end_4yr)
    
    # 3년 초과이므로 주간(금요일 또는 해당 주 마지막 영업일) 단위로 다운샘플링되었는지 확인
    # 대략 4년 = 208주 정도의 데이터가 와야 함
    assert len(res_4yr["labels"]) < 300
    assert len(res_4yr["labels"]) > 180

@pytest.mark.asyncio
@patch('yfinance.download')
async def test_market_analysis_service_monthly_yearly_stats(mock_download, db_session: Session):
    """지수의 연도별 및 월별 상세 성과 통계가 독립 계산식 기준을 충족하는지 검증합니다.
    - 수익률: 기말 종가 / 전기(전월/전년) 기말 종가 - 1
    - MDD: 당기 내에서의 최대 낙폭
    """
    mock_download.return_value = pd.DataFrame()
    service = MarketAnalysisService(db_session)
    ticker = "^KS11"
    
    # 1월 데이터
    create_dummy_prices(db_session, ticker, datetime.date(2025, 1, 1), datetime.date(2025, 1, 31), 1000.0, daily_change=0.005) # 약 1100
    # 2월 데이터
    create_dummy_prices(db_session, ticker, datetime.date(2025, 2, 1), datetime.date(2025, 2, 28), 1100.0, daily_change=-0.005) # 약 1000
    
    # 3월 데이터는 수동 생성하여 변동 시뮬레이션
    dates_3m = [
        datetime.date(2025, 3, 3), # 1000
        datetime.date(2025, 3, 10), # 1200 (고점)
        datetime.date(2025, 3, 17), # 900 (저점)
        datetime.date(2025, 3, 24), # 1020
        datetime.date(2025, 3, 31)  # 1050 (종가)
    ]
    prices_3m = [1000.0, 1200.0, 900.0, 1020.0, 1050.0]
    for d, p in zip(dates_3m, prices_3m):
        db_session.add(HistoricalPrice(ticker=ticker, price_date=d, close_price=p))
    db_session.commit()
    
    stats = await service.get_monthly_and_yearly_stats(ticker, datetime.date(2025, 1, 1), datetime.date(2025, 12, 31))
    
    yearly = stats["yearly"]
    monthly = stats["monthly"]
    
    # 1. 2025년 연도별 통계 검증
    assert len(yearly) == 1
    y_2025 = yearly[0]
    assert y_2025["year"] == 2025
    assert y_2025["close_price"] == 1050.0
    assert y_2025["mdd"] <= -25.0
    
    # 2. 월별 통계 검증 (최신 월이 앞에 옴: 3월 -> 2월 -> 1월)
    assert len(monthly) == 3
    
    m_3 = monthly[0]
    assert m_3["month"] == 3
    assert m_3["close_price"] == 1050.0
    assert m_3["mdd"] == -25.0
    assert m_3["return_rate"] > 0

@pytest.mark.asyncio
@patch('yfinance.download')
async def test_market_analysis_service_comparison_table(mock_download, db_session: Session):
    """4대 지수의 연도별 수익률 비교 테이블 가공이 정상적으로 가동되는지 확인합니다."""
    mock_download.return_value = pd.DataFrame()
    service = MarketAnalysisService(db_session)
    
    tickers = ["^KS11", "^KQ11", "^GSPC", "^IXIC"]
    for t in tickers:
        create_dummy_prices(db_session, t, datetime.date(2024, 1, 1), datetime.date(2024, 12, 31), 1000.0, daily_change=0.0001)
        create_dummy_prices(db_session, t, datetime.date(2025, 1, 1), datetime.date(2025, 12, 31), 1050.0, daily_change=0.0002)
        
    comp_table = await service.get_index_comparison_table()
    
    # 연도별 내림차순 정렬 (2025 -> 2024)
    assert len(comp_table) >= 2
    assert comp_table[0]["year"] == datetime.date.today().year
    
    # 2025년 행이 존재하는지 확인
    row_2025 = next((r for r in comp_table if r["year"] == 2025), None)
    assert row_2025 is not None
    for t_name in ["kospi", "kosdaq", "sp500", "nasdaq"]:
        assert t_name in row_2025
        assert isinstance(row_2025[t_name], float)

@pytest.mark.asyncio
@patch('yfinance.download')
async def test_market_analysis_endpoints(mock_download, db_session: Session):
    """지표분석 라우터 엔드포인트들이 성공적으로 응답을 반환하는지 통합 테스트합니다."""
    mock_download.return_value = pd.DataFrame()
    ticker = "^GSPC"
    start_date = datetime.date(2025, 1, 1)
    end_date = datetime.date(2025, 3, 31)
    
    create_dummy_prices(db_session, ticker, start_date, end_date, 1000.0)
    create_dummy_prices(db_session, "^KS11", start_date, end_date, 2000.0)
    create_dummy_prices(db_session, "^KQ11", start_date, end_date, 800.0)
    create_dummy_prices(db_session, "^IXIC", start_date, end_date, 1500.0)
    
    # 1. Historical API
    response = client.get(f"/api/market/analysis/historical?ticker={ticker}&start_date=2025-01-01&end_date=2025-03-31")
    assert response.status_code == 200
    data = response.json()
    assert "labels" in data
    assert "prices" in data
    assert "mdd" in data
    
    # 2. Stats API
    response = client.get(f"/api/market/analysis/stats?ticker={ticker}&start_date=2025-01-01&end_date=2025-03-31")
    assert response.status_code == 200
    data = response.json()
    assert "yearly" in data
    assert "monthly" in data
    
    # 3. Comparison API
    response = client.get("/api/market/analysis/comparison")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert "year" in data[0]
    assert "kospi" in data[0]
    assert "sp500" in data[0]
