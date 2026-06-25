from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Dict, List, Any, Optional
from pydantic import BaseModel, ConfigDict

from ..database import get_db
from ..services.portfolio_service import get_portfolio_status

router = APIRouter(
    prefix="/api/portfolio",
    tags=["portfolio"]
)

class HoldingSchema(BaseModel):
    ticker: str
    name: str
    major_category: str
    sub_category: str
    country: str
    quantity: float
    current_price: float
    valuation: float
    valuation_krw: float

    model_config = ConfigDict(from_attributes=True)

class PortfolioStatusResponse(BaseModel):
    total_valuation_krw: float
    cash_balances: Dict[str, float]
    exchange_rate: float
    holdings: List[HoldingSchema]

    model_config = ConfigDict(from_attributes=True)

@router.get("/status", response_model=PortfolioStatusResponse)
async def get_portfolio_status_api(
    date: Optional[str] = Query(None, description="조회 기준일 (Format: YYYY-MM-DD), 생략 시 오늘"),
    db: Session = Depends(get_db)
):
    """지정된 일자(생략 시 오늘)의 포트폴리오 자산 구성 및 보유 종목 정보를 반환합니다."""
    try:
        if date:
            # 날짜 형식 검증
            import datetime
            try:
                datetime.date.fromisoformat(date)
            except ValueError:
                raise HTTPException(status_code=400, detail="올바르지 않은 날짜 형식입니다. YYYY-MM-DD 형식으로 요청해 주세요.")
        
        status = await get_portfolio_status(db, date)
        return status
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"[ERROR] 포트폴리오 상태 조회 중 오류 발생: {e}")
        raise HTTPException(status_code=500, detail=f"포트폴리오 상태 조회에 실패했습니다: {str(e)}")
