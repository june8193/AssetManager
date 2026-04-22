from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from ..database import get_db
from ..services.dashboard_service import DashboardService

router = APIRouter(
    prefix="/api/dashboard",
    tags=["dashboard"]
)

@router.get("/summary", response_model=Dict[str, Any])
async def get_dashboard_summary(db: Session = Depends(get_db)):
    """대시보드 요약 정보를 조회합니다."""
    try:
        service = DashboardService(db)
        summary = await service.get_dashboard_summary()
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

@router.get("/snapshots", response_model=Dict[str, Any])
async def get_snapshots(db: Session = Depends(get_db)):
    """자산 추이 스냅샷 데이터를 조회합니다."""
    try:
        service = DashboardService(db)
        data = service.get_snapshots()
        return data
    except Exception as e:
        print(f"스냅샷 조회 중 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))
