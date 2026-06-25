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
