from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import datetime
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
    start_date: str = Field("1990-01-01", description="시뮬레이션 시작 날짜 (YYYY-MM-DD)")
    end_date: str = Field(None, description="시뮬레이션 종료 날짜 (YYYY-MM-DD)")

    @model_validator(mode="after")
    def validate_inputs(self):
        if self.min_cash_weight > self.max_cash_weight:
            raise ValueError("최소 현금 비중은 최대 현금 비중보다 클 수 없습니다.")
        if self.target_index not in ["KOSPI", "KOSDAQ", "S&P500", "NASDAQ"]:
            raise ValueError("지원하지 않는 대상 지수입니다. (KOSPI, KOSDAQ, S&P500, NASDAQ 중 선택)")
        if self.rebalancing_frequency not in ["매일", "매월 말", "매 분기 말"]:
            raise ValueError("지원하지 않는 리밸런싱 주기입니다. (매일, 매월 말, 매 분기 말 중 선택)")
        
        # 날짜 포맷 검증
        import datetime
        try:
            s_date = datetime.datetime.strptime(self.start_date, "%Y-%m-%d").date()
        except ValueError:
            raise ValueError("시작 날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식이어야 합니다.")
        
        if self.end_date:
            try:
                e_date = datetime.datetime.strptime(self.end_date, "%Y-%m-%d").date()
            except ValueError:
                raise ValueError("종료 날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식이어야 합니다.")
            if s_date > e_date:
                raise ValueError("시작 날짜는 종료 날짜보다 늦을 수 없습니다.")
        return self

class TodayRecommendationSchema(BaseModel):
    recommended_stock_weight: float
    recommended_cash_weight: float
    current_score: int
    score_breakdown: Dict[str, Any]

class BacktestResponseSchema(BaseModel):
    cagr: float
    mdd: float
    benchmark_cagr: float
    benchmark_mdd: float
    strategy_returns: List[float]
    benchmark_returns: List[float]
    dates: List[str]
    today_recommendation: TodayRecommendationSchema
    annual_returns: List[Dict[str, Any]]
    monthly_returns: List[Dict[str, Any]]

class AllocationSettingCreateSchema(BaseModel):
    name: str = Field(..., description="설정 이름")
    description: str = Field(None, description="설정 설명")
    target_index: str = Field("S&P500")
    lookback_period: int = Field(200)
    rebalancing_frequency: str = Field("매월 말")
    vix_threshold: float = Field(30.0)
    min_cash_weight: float = Field(10.0)
    max_cash_weight: float = Field(40.0)
    start_date: str = Field("1990-01-01")
    end_date: str = Field(None)
    simulation_result: str = Field(None, description="시뮬레이션 결과 JSON 문자열")

class AllocationSettingResponseSchema(BaseModel):
    id: int
    name: str
    description: str = None
    target_index: str
    lookback_period: int
    rebalancing_frequency: str
    vix_threshold: float
    min_cash_weight: float
    max_cash_weight: float
    start_date: str
    end_date: str = None
    is_favorite: bool
    simulation_result: str = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    class Config:
        from_attributes = True

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
            max_cash_weight=payload.max_cash_weight,
            start_date=payload.start_date,
            end_date=payload.end_date
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"시뮬레이션 실행 중 서버 에러 발생: {str(e)}")

@router.get("/settings", response_model=List[AllocationSettingResponseSchema])
def get_settings(db: Session = Depends(get_db)):
    """저장된 모든 자산배분 파라미터 설정을 조회합니다."""
    service = AllocationService(db)
    return service.get_settings()

@router.post("/settings", response_model=AllocationSettingResponseSchema)
def save_setting(payload: AllocationSettingCreateSchema, db: Session = Depends(get_db)):
    """자산배분 파라미터 설정을 신규 저장합니다."""
    service = AllocationService(db)
    try:
        return service.save_setting(payload.model_dump())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"설정 저장 중 에러 발생: {str(e)}")

@router.delete("/settings/{setting_id}")
def delete_setting(setting_id: int, db: Session = Depends(get_db)):
    """파라미터 설정을 삭제합니다."""
    service = AllocationService(db)
    success = service.delete_setting(setting_id)
    if not success:
        raise HTTPException(status_code=404, detail="해당 설정을 찾을 수 없습니다.")
    return {"status": "success", "message": "설정이 성공적으로 삭제되었습니다."}

@router.post("/settings/{setting_id}/favorite", response_model=AllocationSettingResponseSchema)
def toggle_favorite(setting_id: int, db: Session = Depends(get_db)):
    """특정 설정을 주로 참고할 설정으로 지정합니다."""
    service = AllocationService(db)
    setting = service.toggle_favorite(setting_id)
    if not setting:
        raise HTTPException(status_code=404, detail="해당 설정을 찾을 수 없습니다.")
    return setting


