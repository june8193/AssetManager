import datetime
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from ..database import get_db
from ..models import Watchlist
from ..services.benchmark_service import BenchmarkService
from ..services.dashboard_service import DashboardService
from ..services.price_service import price_service

router = APIRouter(
    prefix="/api/benchmark",
    tags=["benchmark"]
)


def get_date_range(period: str) -> tuple[datetime.date, datetime.date]:
    """선택된 기간 문자열에 따라 시작일과 종료일(오늘)을 계산합니다.

    Args:
        period (str): 기간 ('YTD', '1M', '3M', '1Y')

    Returns:
        tuple[date, date]: (시작일, 종료일)
    """
    today = datetime.date.today()
    if period == "YTD":
        start_date = datetime.date(today.year, 1, 1)
    elif period == "1M":
        start_date = today - datetime.timedelta(days=30)
    elif period == "3M":
        start_date = today - datetime.timedelta(days=90)
    elif period == "1Y":
        start_date = today - datetime.timedelta(days=365)
    else:
        start_date = datetime.date(today.year, 1, 1)
    return start_date, today


@router.get("")
async def get_benchmark_dashboard(
    period: str = Query("YTD", regex="^(YTD|1M|3M|1Y)$"),
    force_update: bool = Query(False),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """벤치마크 비교 대시보드 조회를 위한 통합 데이터를 반환합니다.

    Args:
        period (str): 조회 기간
        db (Session): 데이터베이스 세션

    Returns:
        Dict[str, Any]: 차트 시계열, 요약 카드 및 관심 종목 목록을 포함한 데이터
    """
    start_date, end_date = get_date_range(period)
    
    # 1. 벤치마크 및 포트폴리오 누적 수익률 계산
    benchmark_svc = BenchmarkService(db)
    tickers = ["^KS11", "^KQ11", "^GSPC", "^IXIC"]
    chart_data = await benchmark_svc.calculate_cumulative_returns(start_date, end_date, tickers)

    # 2. 내 포트폴리오 실시간 요약 (평가자산 및 누적 ROI)
    dashboard_svc = DashboardService(db)
    summary = await dashboard_svc.get_dashboard_summary(force_update=force_update)
    
    # 성과비교 수익률과 일치하도록 최신 스냅샷 자산액을 우선 적용합니다.
    total_valuation_krw = chart_data.get("portfolio_final_valuation")
    if total_valuation_krw is None or total_valuation_krw <= 0.0:
        total_valuation_krw = summary.get("total_valuation_krw", 0.0)
        
    portfolio_roi = summary.get("cumulative_roi", 0.0)

    # 3. 상단 지수 카드 정보 가공
    # yfinance 캐시를 기반으로 각 지수의 최종 누적 수익률(YTD 등) 및 현재 지수를 구합니다.
    # chart_data["alpha_summaries"]에서 지수별 최종 수익률을 추출합니다.
    index_card_data = {}
    for item in chart_data.get("alpha_summaries", []):
        ticker = item["ticker"]
        index_card_data[ticker] = {
            "name": item["benchmark"],
            "return": item["benchmark_return"],
            "alpha": item["alpha"],
            "judgment": item["judgment"]
        }

    # 지수 현재가 조회 (최근 저장된 캐시 정보 활용)
    # asyncio.gather를 사용하여 각 지수의 가격 정보를 비동기 병렬로 가져옵니다.
    prices_list = await asyncio.gather(*(
        benchmark_svc.get_historical_prices(ticker, start_date, end_date)
        for ticker in tickers
    ))
    for ticker, prices in zip(tickers, prices_list):
        # 0.0이 아닌 실질 유효 가격 중 가장 최근 가격을 현재가로 사용합니다.
        valid_prices = [p for p in prices if p.close_price > 0.0]
        current_val = valid_prices[-1].close_price if valid_prices else 0.0
        if ticker in index_card_data:
            index_card_data[ticker]["value"] = current_val

    # 4. 관심 종목 테이블 정보 가공 (Lazy Loading 대기 상태 목록)
    # 관심 종목 목록을 조회하고 실시간 현재가 및 YTD 수익률을 연산합니다.
    watchlist_items = db.query(Watchlist).all()
    watchlist_data = []

    if watchlist_items:
        # 실시간 가격 조회를 위해 국가별 티커 분류
        kr_codes = [item.stock_code for item in watchlist_items if item.country == "KR"]
        us_codes = [item.stock_code for item in watchlist_items if item.country == "US"]

        # 실시간 현재가 구하기
        current_prices = {}
        if kr_codes:
            kr_res = await price_service.get_kr_prices(kr_codes, force_update=force_update)
            for p in kr_res:
                current_prices[p["stock_code"]] = p["current_price"]
        if us_codes:
            us_res = await price_service.get_us_prices(us_codes, force_update=force_update)
            for p in us_res:
                current_prices[p["stock_code"]] = p["current_price"]

        # asyncio.gather를 사용하여 모든 관심 종목의 기간별 수익률 조회를 비동기 병렬로 처리합니다.
        period_returns = await asyncio.gather(*(
            benchmark_svc.get_period_return(item.stock_code, period)
            for item in watchlist_items
        ))

        # 하위 호환성을 위해 YTD 수익률도 병렬 조회합니다.
        ytd_returns = await asyncio.gather(*(
            benchmark_svc.get_ytd_return(item.stock_code)
            for item in watchlist_items
        ))

        for item, period_ret, ytd_ret in zip(watchlist_items, period_returns, ytd_returns):
            curr_price = current_prices.get(item.stock_code, 0.0)

            watchlist_data.append({
                "id": item.id,
                "stock_code": item.stock_code,
                "stock_name": item.stock_name,
                "country": item.country,
                "current_price": curr_price,
                "ytd_return": ytd_ret,
                "period_return": period_ret
            })

    # 5. 응답 데이터 구성
    # portfolio.ytd_return 에는 전체 역사적 누적 ROI 대신 선택한 기간의 최종일 정규화 누적 수익률을 전달합니다.
    portfolio_period_return = 0.0
    if chart_data.get("datasets") and len(chart_data["datasets"]) > 0:
        portfolio_returns = chart_data["datasets"][0]["data"]
        if portfolio_returns:
            # 최종일에 포트폴리오 스냅샷이 없어 None일 수 있으므로, 역순 순회하여 최근 유효값을 찾음
            for val in reversed(portfolio_returns):
                if val is not None:
                    portfolio_period_return = val
                    break

    # 5. 비교 테이블 데이터 연산 및 응답에 병합
    comparison_tables = await benchmark_svc.get_comparison_tables()

    return {
        "portfolio": {
            "total_valuation": total_valuation_krw,
            "ytd_return": portfolio_period_return
        },
        "indices": index_card_data,
        "chart": {
            "labels": chart_data.get("labels", []),
            "datasets": chart_data.get("datasets", [])
        },
        "alpha_analysis": chart_data.get("alpha_summaries", []),
        "watchlist": watchlist_data,
        "yearly_comparison": comparison_tables["yearly"],
        "daily_comparison": comparison_tables["daily"]
    }


@router.get("/historical")
async def get_watchlist_historical(
    ticker: str = Query(..., description="조회할 주식/지수 티커"),
    period: str = Query("YTD", regex="^(YTD|1M|3M|1Y)$"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """특정 관심 종목의 기간별 정규화된 수익률 시계열을 반환합니다. (차트 비교용 Lazy Loading)

    Args:
        ticker (str): 자산 티커
        period (str): 조회 기간
        db (Session): 데이터베이스 세션

    Returns:
        Dict[str, Any]: labels 및 정규화 수익률 data
    """
    start_date, end_date = get_date_range(period)
    benchmark_svc = BenchmarkService(db)
    
    # 해당 종목의 정규화 수익률 조회
    try:
        result = await benchmark_svc.get_watchlist_returns(ticker, start_date, end_date)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"관심 종목의 과거 데이터를 가져오는 데 실패했습니다: {e}"
        )
