from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import datetime
from ..database import get_db
from ..services.dashboard_service import DashboardService

router = APIRouter(
    prefix="/api/dashboard",
    tags=["dashboard"]
)

@router.get("/summary", response_model=Dict[str, Any])
async def get_dashboard_summary(force_update: bool = False, db: Session = Depends(get_db)):
    """대시보드 요약 정보를 조회합니다."""
    try:
        service = DashboardService(db)
        summary = await service.get_dashboard_summary(force_update=force_update)
        return summary
    except Exception as e:
        print(f"대시보드 요약 조회 중 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/yearly", response_model=List[Dict[str, Any]])
async def get_yearly_stats(db: Session = Depends(get_db)):
    """연도별 자산 현황 통계를 조회합니다."""
    try:
        service = DashboardService(db)
        stats = service.get_yearly_stats()
        return stats
    except Exception as e:
        print(f"연도별 통계 조회 중 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/daily", response_model=List[Dict[str, Any]])
async def get_daily_stats(
    start_date: Optional[datetime.date] = Query(None, description="조회 시작일 (YYYY-MM-DD)"),
    end_date: Optional[datetime.date] = Query(None, description="조회 종료일 (YYYY-MM-DD)"),
    all: bool = Query(False, description="전체 데이터 조회 여부"),
    db: Session = Depends(get_db)
):
    """일자별 자산 현황 통계를 조회합니다."""
    try:
        service = DashboardService(db)
        stats = service.get_daily_stats(start_date=start_date, end_date=end_date, all_data=all)
        return stats
    except Exception as e:
        print(f"일자별 통계 조회 중 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/snapshots", response_model=Dict[str, Any])
async def get_snapshots(
    start_date: Optional[datetime.date] = Query(None, description="조회 시작일 (YYYY-MM-DD)"),
    end_date: Optional[datetime.date] = Query(None, description="조회 종료일 (YYYY-MM-DD)"),
    all: bool = Query(False, description="전체 데이터 조회 여부"),
    db: Session = Depends(get_db)
):
    """자산 추이 스냅샷 데이터를 조회합니다."""
    try:
        service = DashboardService(db)
        data = service.get_snapshots(start_date=start_date, end_date=end_date, all_data=all)
        return data
    except Exception as e:
        print(f"스냅샷 조회 중 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/refresh", response_model=Dict[str, Any])
async def refresh_dashboard_prices(db: Session = Depends(get_db)):
    """대시보드 시세 정보를 즉시 외부 API로부터 조회하여 DB를 업데이트합니다. (1분 Rate Limit 적용)"""
    try:
        from ..services.price_service import price_service
        now = datetime.datetime.now()
        last_refresh = price_service.last_manual_refresh_time
        
        # 1분 이내에 재요청한 경우, 업데이트를 스킵하고 기존 데이터 유지
        if last_refresh and (now - last_refresh) < datetime.timedelta(minutes=1):
            return {
                "status": "skipped",
                "message": "최근 1분 이내에 시세를 업데이트했습니다. 잠시 후 다시 시도해 주세요."
            }
            
        await price_service.update_all_market_prices(is_manual=True)
        price_service.last_manual_refresh_time = now
        
        return {
            "status": "success",
            "message": "모든 지수, 보유 자산, 관심 종목의 시세가 최신화되었습니다."
        }
    except Exception as e:
        print(f"대시보드 시세 최신화 중 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

