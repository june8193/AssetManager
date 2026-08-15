from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.performance_service import PerformanceService

router = APIRouter(prefix="/api/v1/performance", tags=["performance"])


class RiskFreeRateRequest(BaseModel):
    rate: float = Field(..., description="연율 무위험 수익률 (%)", json_schema_extra={"example": 3.5})


class RiskFreeRateResponse(BaseModel):
    rate: float = Field(..., description="연율 무위험 수익률 (%)", json_schema_extra={"example": 3.5})


@router.get("/settings/risk-free-rate", response_model=RiskFreeRateResponse)
def get_risk_free_rate(db: Session = Depends(get_db)):
    """현재 설정된 연율 무위험 수익률(%)을 조회합니다."""
    service = PerformanceService(db)
    return {"rate": service.get_risk_free_rate()}


@router.put("/settings/risk-free-rate", response_model=RiskFreeRateResponse)
def set_risk_free_rate(payload: RiskFreeRateRequest, db: Session = Depends(get_db)):
    """연율 무위험 수익률(%)을 변경 및 저장합니다."""
    if payload.rate < 0 or payload.rate > 100:
        raise HTTPException(status_code=400, detail="무위험 수익률은 0% 이상 100% 이하이어야 합니다.")
    service = PerformanceService(db)
    new_rate = service.set_risk_free_rate(payload.rate)
    return {"rate": new_rate}


@router.get("/assets/batch")
def get_assets_batch_performance(
    period: str = Query("1Y", description="기간 (1M, 3M, 6M, 1Y, YTD, Max)"),
    db: Session = Depends(get_db),
):
    """보유 종목 및 대표 지수의 위험조정 성과 지표(Sharpe, Sortino, MDD)를 일괄 조회합니다."""
    service = PerformanceService(db)
    return service.calculate_assets_batch_performance(period=period)


@router.get("/asset/{ticker}")
def get_asset_performance(
    ticker: str,
    period: str = Query("1Y", description="기간 (1M, 3M, 6M, 1Y, YTD, Max)"),
    db: Session = Depends(get_db),
):
    """특정 지수/종목의 Sharpe, Sortino 및 MDD 성과 지표를 조회합니다."""
    service = PerformanceService(db)
    return service.calculate_asset_performance(ticker, period=period)


@router.get("/portfolio")
def get_portfolio_performance(
    period: str = Query("1Y", description="기간 (1M, 3M, 6M, 1Y, YTD, Max)"),
    db: Session = Depends(get_db),
):
    """총 자산(TWR) 기반 포트폴리오 Sharpe, Sortino 및 MDD 성과 지표를 조회합니다."""
    service = PerformanceService(db)
    return service.calculate_portfolio_performance(period=period)

