import pytest
import datetime
from unittest.mock import patch, MagicMock
import pandas as pd

from src.backend.models import AccountSnapshot, HistoricalPrice, Watchlist
from src.backend.services.benchmark_service import BenchmarkService


@pytest.fixture
def benchmark_service(db_session):
    """테스트용 BenchmarkService 인스턴스를 제공합니다."""
    return BenchmarkService(db_session)


@pytest.mark.asyncio
async def test_calculate_cumulative_returns_normal(benchmark_service, db_session):
    """포트폴리오 평가액과 지수 종가 시계열을 바탕으로 한 누적 수익률 정규화 계산 테스트"""
    # 1. 테스트용 포트폴리오 스냅샷 생성
    # 2026-05-01 ~ 2026-05-05 일자별 평가액
    dates = [
        datetime.date(2026, 5, 1),
        datetime.date(2026, 5, 2), # 주말(토)
        datetime.date(2026, 5, 3), # 주말(일)
        datetime.date(2026, 5, 4),
        datetime.date(2026, 5, 5),
    ]
    # 영업일 기준 정규화 처리에 의해 주말 데이터는 직전 영업일 혹은 제외되는 방식을 검증
    # account_snapshots 데이터 주입
    for i, d in enumerate(dates):
        # 100만 원부터 시작하여 102만, 102만(주말), 105만, 107만
        val = 1000000 + i * 20000 if i < 3 else (1050000 if i == 3 else 1070000)
        snapshot = AccountSnapshot(
            account_id=2, # 키움증권 일반계좌
            snapshot_date=d,
            period_deposit=0.0,
            total_valuation=val,
            total_profit=0.0
        )
        db_session.add(snapshot)
    
    # 2. 지수 가격 데이터 주입
    # KOSPI (^KS11) 일별 가격 (영업일 기준: 5/1, 5/4, 5/5)
    kospi_prices = [
        (datetime.date(2026, 5, 1), 2500.0),
        (datetime.date(2026, 5, 4), 2550.0),
        (datetime.date(2026, 5, 5), 2600.0),
    ]
    for d, price in kospi_prices:
        p = HistoricalPrice(
            ticker="^KS11",
            price_date=d,
            close_price=price
        )
        db_session.add(p)
    
    db_session.commit()

    # 3. 비즈니스 로직 호출
    # 시작일: 2026-05-01, 종료일: 2026-05-05
    # 영업일(5/1, 5/4, 5/5) 기준 계산
    result = await benchmark_service.calculate_cumulative_returns(
        start_date=datetime.date(2026, 5, 1),
        end_date=datetime.date(2026, 5, 5),
        tickers=["^KS11"]
    )

    # 4. 검증
    # labels는 영업일인 5/1, 5/4, 5/5만 존재해야 함
    assert result["labels"] == ["2026-05-01", "2026-05-04", "2026-05-05"]
    
    # 내 포트폴리오 수익률:
    # 5/1: (1000000/1000000 - 1) * 100 = 0.0%
    # 5/4: (1050000/1000000 - 1) * 100 = 5.0%
    # 5/5: (1070000/1000000 - 1) * 100 = 7.0%
    portfolio_dataset = next(ds for ds in result["datasets"] if ds["label"] == "내 포트폴리오")
    assert portfolio_dataset["data"] == [0.0, 5.0, 7.0]

    # KOSPI 수익률:
    # 5/1: (2500.0/2500.0 - 1) * 100 = 0.0%
    # 5/4: (2550.0/2500.0 - 1) * 100 = 2.0%
    # 5/5: (2600.0/2500.0 - 1) * 100 = 4.0%
    kospi_dataset = next(ds for ds in result["datasets"] if ds["label"] == "KOSPI")
    assert kospi_dataset["data"] == [0.0, 2.0, 4.0]

    # 5. 초과수익률(Alpha) 검증
    # KOSPI에 대한 초과수익률: 내 수익률(7.0%) - KOSPI 수익률(4.0%) = 3.0%p
    alpha_kospi = next(summary for summary in result["alpha_summaries"] if summary["benchmark"] == "KOSPI")
    assert alpha_kospi["benchmark_return"] == 4.0
    assert alpha_kospi["portfolio_return"] == 7.0
    assert alpha_kospi["alpha"] == 3.0
    assert alpha_kospi["judgment"] == "시장 상회"


@pytest.mark.asyncio
@patch('yfinance.download')
async def test_sync_historical_prices_lazy(mock_download, benchmark_service, db_session):
    """yfinance 연동 및 지연 캐싱(Lazy Caching) 검증"""
    # 1. yfinance download 모킹 데이터 설정
    # 2026-05-01 ~ 2026-05-03 기간 KOSPI 가격 (5/1 금, 5/2 토, 5/3 일)
    mock_df = pd.DataFrame(
        data={"Close": [2500.0]},
        index=pd.DatetimeIndex([datetime.datetime(2026, 5, 1)])
    )
    mock_df.index.name = "Date"
    mock_download.return_value = mock_df

    # 2. 로컬 DB에 데이터가 없어서 동적으로 가져와서 저장하는 동작 검증
    ticker = "^KS11"
    start_date = datetime.date(2026, 5, 1)
    end_date = datetime.date(2026, 5, 1)

    prices = await benchmark_service.get_historical_prices(ticker, start_date, end_date)
    
    # yfinance가 정상 호출되었는지 검증
    mock_download.assert_called_once()
    
    # 반환 데이터 확인
    assert len(prices) == 1
    assert prices[0].close_price == 2500.0
    assert prices[0].price_date == datetime.date(2026, 5, 1)

    # DB에 적재되었는지 확인 (4/21 ~ 5/3 총 13일의 데이터가 Forward Fill로 빈틈없이 캐싱됨)
    cached = db_session.query(HistoricalPrice).filter_by(ticker=ticker).order_by(HistoricalPrice.price_date.asc()).all()
    assert len(cached) == 13
    
    # 주말(토요일 5/2, 일요일 5/3)에는 비영업일 마커인 0.0이 채워져 있는지 확인
    sat_price = next(p for p in cached if p.price_date == datetime.date(2026, 5, 2))
    sun_price = next(p for p in cached if p.price_date == datetime.date(2026, 5, 3))
    assert sat_price.close_price == 0.0
    assert sun_price.close_price == 0.0

    # 3. 두 번째 호출 시에는 yfinance가 호출되지 않고 로컬 캐시를 사용하는지 검증 (캐시 히트)
    mock_download.reset_mock()
    prices_cached = await benchmark_service.get_historical_prices(ticker, start_date, end_date)
    mock_download.assert_not_called()
    assert len(prices_cached) == 1
    assert prices_cached[0].close_price == 2500.0


@pytest.mark.asyncio
@patch('yfinance.download')
async def test_get_watchlist_historical_returns(mock_download, benchmark_service, db_session):
    """관심 종목의 과거 시계열 데이터 조회 및 정규화 리턴 검증 (Lazy Loading)"""
    # yfinance download 모킹
    def mock_download_side_effect(ticker, *args, **kwargs):
        if "^KS11" in ticker:
            df = pd.DataFrame(
                data={"Close": [2500.0, 2550.0, 2600.0]},
                index=pd.DatetimeIndex([
                    datetime.datetime(2026, 5, 1),
                    datetime.datetime(2026, 5, 4),
                    datetime.datetime(2026, 5, 5),
                ])
            )
            df.index.name = "Date"
            return df
        elif "AAPL" in ticker:
            df = pd.DataFrame(
                data={"Close": [100.0, 105.0, 110.0]},
                index=pd.DatetimeIndex([
                    datetime.datetime(2026, 5, 1),
                    datetime.datetime(2026, 5, 4),
                    datetime.datetime(2026, 5, 5),
                ])
            )
            df.index.name = "Date"
            return df
        return pd.DataFrame()

    mock_download.side_effect = mock_download_side_effect

    # 관심 종목 추가
    watchlist_item = Watchlist(
        stock_code="AAPL",
        stock_name="Apple",
        country="US"
    )
    db_session.add(watchlist_item)
    db_session.commit()

    # AAPL 데이터 조회
    result = await benchmark_service.get_watchlist_returns(
        ticker="AAPL",
        start_date=datetime.date(2026, 5, 1),
        end_date=datetime.date(2026, 5, 5)
    )

    # 검증
    # 5/1: (100/100-1)*100 = 0%
    # 5/4: (105/100-1)*100 = 5%
    # 5/5: (110/100-1)*100 = 10%
    assert result["ticker"] == "AAPL"
    assert result["labels"] == ["2026-05-01", "2026-05-04", "2026-05-05"]
    assert result["data"] == [0.0, 5.0, 10.0]

    # DB 캐싱 확인 (4/21 ~ 5/7 까지 총 17일 분량의 데이터가 0.0을 포함하여 캐싱됨)
    cached = db_session.query(HistoricalPrice).filter_by(ticker="AAPL").all()
    assert len(cached) == 17



