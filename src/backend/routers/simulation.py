from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any

from ..database import get_db
from ..services.simulation_service import SimulationService

router = APIRouter(
    prefix="/api/simulation",
    tags=["simulation"]
)


class AllocationItem(BaseModel):
    name: str
    stock_ratio: float


class SimulationRequest(BaseModel):
    allocations: List[AllocationItem]
    period: str
    rebalancing: str


@router.post("/run")
async def run_backtest_simulation(
    request: SimulationRequest,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """주식/현금 비중 및 리밸런싱 설정에 따른 과거 시뮬레이션을 실행하여 결과를 반환합니다."""
    # 유효성 검사
    if not request.allocations:
        raise HTTPException(status_code=400, detail="최소 하나 이상의 비중 조합이 필요합니다.")
        
    for alloc in request.allocations:
        if alloc.stock_ratio < 0 or alloc.stock_ratio > 100:
            raise HTTPException(status_code=400, detail="주식 비중은 0%에서 100% 사이여야 합니다.")

    if request.period not in ["5Y", "10Y", "20Y", "30Y", "ALL"]:
        raise HTTPException(status_code=400, detail="유효하지 않은 기간 설정입니다.")

    if request.rebalancing not in ["monthly", "yearly", "none"]:
        raise HTTPException(status_code=400, detail="유효하지 않은 리밸런싱 주기 설정입니다.")

    # 서비스 실행
    service = SimulationService(db)
    try:
        allocations_list = [{"name": item.name, "stock_ratio": item.stock_ratio} for item in request.allocations]
        result = await service.run_simulation(
            allocations=allocations_list,
            period=request.period,
            rebalancing=request.rebalancing
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"시뮬레이션 수행 중 오류가 발생했습니다: {str(e)}")


@router.get("/compound/snapshot-stats")
async def get_compound_snapshot_stats(
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """사용자의 과거 스냅샷 통계를 기반으로 연평균 수익률 및 연평균 추가금을 계산합니다."""
    service = SimulationService(db)
    try:
        result = await service.get_compound_snapshot_stats()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"스냅샷 통계 계산 중 오류가 발생했습니다: {str(e)}")
