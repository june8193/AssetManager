from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any
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
