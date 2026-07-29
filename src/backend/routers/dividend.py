# -*- coding: utf-8 -*-
"""배당 분석 데이터를 조회하는 REST API 라우터 모듈입니다."""

from typing import Dict, List, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..services.dividend_service import DividendService

router = APIRouter(
    prefix="/api/dividend",
    tags=["Dividend Analysis"]
)

@router.get("/summary", response_model=Dict[str, Any])
def get_dividend_summary(db: Session = Depends(get_db)):
    """총 누적 배당금, YTD 배당금, 평균 배당률 및 월별/누적 시계열 데이터를 반환합니다."""
    service = DividendService(db)
    return service.get_dividend_summary()

@router.get("/stocks", response_model=List[Dict[str, Any]])
def get_stock_dividend_analysis(db: Session = Depends(get_db)):
    """종목별 평가액, 수령 실적, 추정 연배당금, 고유 통화 시가 배당률을 반환합니다."""
    service = DividendService(db)
    return service.get_stock_dividend_analysis()
