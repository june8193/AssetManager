from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from ..database import get_db
from ..services.ratio_service import RatioService

router = APIRouter(prefix="/api/ratios", tags=["ratios"])

class TargetRatioSchema(BaseModel):
    """목표 비중 설정 스키마입니다.

    Attributes:
        category_name (str): 자산 분류명
        category_type (str): 분류 유형 ('major', 'sub')
        target_percentage (float): 목표 비중 (%)
        parent_category (Optional[str]): 상위 분류명
        mode (Optional[str]): 비중 모드 ('absolute', 'relative')
    """
    model_config = ConfigDict(from_attributes=True)

    category_name: str
    category_type: str # 'major', 'sub'
    target_percentage: float
    parent_category: Optional[str] = None
    mode: Optional[str] = 'absolute' # 'absolute', 'relative'

class RebalancingResultSchema(BaseModel):
    """리밸런싱 계산 결과 스키마입니다.

    Attributes:
        total_valuation (float): 총 평가액
        total_target (float): 목표 총액
        additional_cash (float): 추가 투자금
        major_results (List[dict]): 대분류 리밸런싱 결과 목록
        sub_results (List[dict]): 중분류 리밸런싱 결과 목록
    """
    total_valuation: float
    total_target: float
    additional_cash: float
    major_results: List[dict]
    sub_results: List[dict]

@router.get("/rebalancing", response_model=RebalancingResultSchema)
async def get_rebalancing(additional_cash: float = 0.0, db: Session = Depends(get_db)):
    """리밸런싱 계산 결과를 가져옵니다."""
    service = RatioService(db)
    return await service.calculate_rebalancing(additional_cash)

@router.get("/hierarchy")
async def get_hierarchy(db: Session = Depends(get_db)):
    """계층형 자산 구조 데이터를 가져옵니다."""
    service = RatioService(db)
    return await service.get_hierarchy()

@router.get("/targets", response_model=List[TargetRatioSchema])
def get_target_ratios(db: Session = Depends(get_db)):
    """설정된 목표 비중 목록을 가져옵니다."""
    from ..models import TargetRatio
    return db.query(TargetRatio).all()

@router.post("/targets")
def update_target_ratios(ratios: List[TargetRatioSchema], db: Session = Depends(get_db)):
    """목표 비중 설정을 업데이트합니다."""
    service = RatioService(db)
    service.update_target_ratios([r.model_dump() for r in ratios])
    return {"message": "Successfully updated target ratios"}
