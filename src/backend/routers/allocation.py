from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from pydantic import BaseModel, Field, model_validator
from ..database import get_db
from ..services.allocation_service import AllocationService

router = APIRouter(prefix="/api/allocation", tags=["allocation"])

class BacktestRequestSchema(BaseModel):
    target_index: str = Field(..., description="대상 지수 (KOSPI, KOSDAQ, S&P500, NASDAQ)")
    lookback_period: int = Field(200, ge=10, le=500, description="기준 기간 (이동평균/모멘텀)")
    rebalancing_frequency: str = Field("매월 말", description="리밸런싱 주기 (매일, 매월 말, 매 분기 말)")
    vix_threshold: float = Field(30.0, ge=0.0, le=100.0, description="VIX 임계값")
    min_cash_weight: float = Field(10.0, ge=0.0, le=100.0, description="최소 현금 비중 (%)")
    max_cash_weight: float = Field(40.0, ge=0.0, le=100.0, description="최대 현금 비중 (%)")

    @model_validator(mode="after")
    def validate_weights(self):
        if self.min_cash_weight > self.max_cash_weight:
            raise ValueError("최소 현금 비중은 최대 현금 비중보다 클 수 없습니다.")
        if self.target_index not in ["KOSPI", "KOSDAQ", "S&P500", "NASDAQ"]:
            raise ValueError("지원하지 않는 대상 지수입니다. (KOSPI, KOSDAQ, S&P500, NASDAQ 중 선택)")
        if self.rebalancing_frequency not in ["매일", "매월 말", "매 분기 말"]:
            raise ValueError("지원하지 않는 리밸런싱 주기입니다. (매일, 매월 말, 매 분기 말 중 선택)")
        return self

class TodayRecommendationSchema(BaseModel):
    recommended_stock_weight: float
    recommended_cash_weight: float
    current_score: int
    score_breakdown: Dict[str, Any]

class BacktestResponseSchema(BaseModel):
    cagr: float
    mdd: float
    strategy_returns: List[float]
    benchmark_returns: List[float]
    dates: List[str]
    today_recommendation: TodayRecommendationSchema

@router.post("/backtest", response_model=BacktestResponseSchema)
def run_backtest(payload: BacktestRequestSchema, db: Session = Depends(get_db)):
    """자산배분 전략에 대한 과거 데이터 백테스트 시뮬레이션을 구동합니다."""
    service = AllocationService(db)
    try:
        result = service.run_backtest(
            target_index=payload.target_index,
            lookback_period=payload.lookback_period,
            rebalancing_frequency=payload.rebalancing_frequency,
            vix_threshold=payload.vix_threshold,
            min_cash_weight=payload.min_cash_weight,
            max_cash_weight=payload.max_cash_weight
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"시뮬레이션 실행 중 서버 에러 발생: {str(e)}")
