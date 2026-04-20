from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime
from pydantic import BaseModel, Field

from ..database import get_db
from ..models import ExchangeRate

router = APIRouter(
    prefix="/api/exchange",
    tags=["exchange"]
)

class ExchangeRateSchema(BaseModel):
    """환율 정보 스키마입니다."""
    date: date
    currency: str = "USD"
    rate: float
    created_at: datetime
    
    class Config:
        from_attributes = True

class ExchangeRateCreate(BaseModel):
    """환율 생성 요청 스키마입니다."""
    date: date
    currency: str = "USD"
    rate: float = Field(..., gt=0, description="환율은 0보다 커야 합니다.")

@router.get("/rates", response_model=List[ExchangeRateSchema])
def get_exchange_rates(
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """최근 입력된 환율 목록을 가져옵니다."""
    return db.query(ExchangeRate).order_by(ExchangeRate.date.desc()).limit(limit).all()

@router.post("/rates", response_model=ExchangeRateSchema)
def add_exchange_rate(
    rate_data: ExchangeRateCreate,
    force: bool = Query(False, description="이미 존재하는 경우 덮어쓸지 여부"),
    db: Session = Depends(get_db)
):
    """새로운 환율을 입력합니다.
    
    이미 해당 날짜에 환율이 존재하고 force가 False이면 409 Conflict를 반환합니다.
    force가 True이면 기존 데이터를 업데이트합니다.
    """
    existing_rate = db.query(ExchangeRate).filter(
        ExchangeRate.date == rate_data.date,
        ExchangeRate.currency == rate_data.currency
    ).first()

    if existing_rate:
        if not force:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"{rate_data.date} 날짜의 {rate_data.currency} 환율이 이미 존재합니다."
            )
        else:
            # 기존 데이터 업데이트
            existing_rate.rate = rate_data.rate
            db.commit()
            db.refresh(existing_rate)
            return existing_rate

    # 신규 생성
    new_rate = ExchangeRate(
        date=rate_data.date,
        currency=rate_data.currency,
        rate=rate_data.rate
    )
    db.add(new_rate)
    db.commit()
    db.refresh(new_rate)
    return new_rate
