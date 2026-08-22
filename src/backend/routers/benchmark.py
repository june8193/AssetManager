import datetime
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Dict, Any

from ..database import get_db
from ..models import Watchlist, AccountSnapshot
from ..services.benchmark_service import BenchmarkService

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
    period: str = Query("YTD", pattern="^(YTD|1M|3M|1Y)$"),
    force_update: bool = Query(False, description="캐시 무시 및 강제 갱신 여부"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """벤치마크 비교 대시보드 조회를 위한 통합 데이터를 반환합니다.

    Args:
        period (str): 조회 기간
        force_update (bool): 캐시 무시 및 강제 갱신 여부
        db (Session): 데이터베이스 세션

    Returns:
        Dict[str, Any]: 차트 시계열, 요약 카드 및 관심 종목 목록을 포함한 데이터
    """
    start_date, end_date = get_date_range(period)
    
    # 1. 벤치마크 및 포트폴리오 누적 수익률 계산
    benchmark_svc = BenchmarkService(db)
    tickers = BenchmarkService.BENCHMARK_TICKERS
    chart_data = await benchmark_svc.calculate_cumulative_returns(start_date, end_date, tickers)

    # 2. 내 포트폴리오 평가자산 추출 (차트 시계열 기준)
    total_valuation_krw = chart_data.get("portfolio_final_valuation")

    # 3. 상단 지수 카드 정보 가공
    # 1단계 누적 수익률 계산 시 함께 추출된 지수별 최종 수익률 및 현재가를 재활용하여 중복 조회를 제거합니다.
    index_card_data = {}
    for item in chart_data.get("alpha_summaries", []):
        ticker = item["ticker"]
        index_card_data[ticker] = {
            "name": item["benchmark"],
            "return": item["benchmark_return"],
            "alpha": item["alpha"],
            "judgment": item["judgment"],
            "value": item.get("current_price", 0.0)
        }

    # 4. 관심 종목 테이블 기본 정보 (화면 미사용에 따른 외부 API 호출 제거)
    watchlist_items = db.query(Watchlist).all()
    watchlist_data = [
        {
            "id": item.id,
            "stock_code": item.stock_code,
            "stock_name": item.stock_name,
            "country": item.country,
            "current_price": 0.0,
            "ytd_return": 0.0,
            "period_return": 0.0
        }
        for item in watchlist_items
    ]

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

    # 실제 사용자의 DB상 가장 최신 스냅샷 조회
    latest_db_snapshot = (
        db.query(AccountSnapshot)
        .order_by(AccountSnapshot.snapshot_date.desc())
        .first()
    )
    actual_latest_date = latest_db_snapshot.snapshot_date if latest_db_snapshot else None
    actual_latest_valuation = 0.0
    if actual_latest_date:
        actual_latest_valuation = sum(
            snap.total_valuation 
            for snap in db.query(AccountSnapshot).filter_by(snapshot_date=actual_latest_date).all()
        )

    # 6. 비교 테이블 데이터 연산 및 응답에 병합
    comparison_tables = await benchmark_svc.get_comparison_tables()

    return {
        "portfolio": {
            "total_valuation": total_valuation_krw,
            "actual_latest_valuation": actual_latest_valuation,
            "actual_latest_date": actual_latest_date.isoformat() if actual_latest_date else None,
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
    period: str = Query("YTD", pattern="^(YTD|1M|3M|1Y)$"),
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
