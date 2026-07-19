# -*- coding: utf-8 -*-
"""키움증권 거래내역 동기화를 처리하는 API 라우터 모듈입니다."""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..services.kiwoom_sync_service import KiwoomTransactionService

router = APIRouter(
    prefix="/api/kiwoom",
    tags=["kiwoom"]
)

logger = logging.getLogger("KiwoomRouter")

@router.post("/sync-transactions")
async def sync_kiwoom_transactions(
    days: int = Query(7, description="조회할 과거 거래내역 기간 범위 (일)"),
    db: Session = Depends(get_db)
):
    """키움증권 Open API를 통해 거래내역 및 당일 체결 내역을 동기화하고 DB에 저장합니다.

    Args:
        days (int): 조회할 기간 (일 수). 기본값 7일.
        db (Session): 데이터베이스 세션.

    Returns:
        dict: 동기화 작업 결과 요약 및 누락 목록.
    """
    if days < 1:
        raise HTTPException(status_code=400, detail="조회 일수는 1 이상이어야 합니다.")

    service = KiwoomTransactionService()
    try:
        result = await service.sync_transactions(db, days=days)
        if result.get("status") == "error":
            raise HTTPException(status_code=500, detail=result.get("message"))
        return result
    except Exception as e:
        logger.error(f"거래내역 동기화 API 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"동기화 중 오류 발생: {str(e)}")
