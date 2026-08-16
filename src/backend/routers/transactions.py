"""거래 내역 CRUD 및 이체 등록 전용 API 라우터 모듈입니다."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date

from ..database import get_db
from ..schemas import TransactionSchema, TransferTransactionRequest
from ..services.transaction_service import TransactionService

router = APIRouter(
    prefix="/api/db",
    tags=["transactions"]
)


@router.get("/transactions", response_model=List[TransactionSchema])
def get_transactions(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """전체 또는 기간 필터링된 거래 내역 목록을 조회합니다.
    
    Args:
        start_date (Optional[date]): 시작 일자.
        end_date (Optional[date]): 종료 일자.
        db (Session): 데이터베이스 세션.
        
    Returns:
        List[TransactionSchema]: 거래 내역 목록.
    """
    return TransactionService(db).get_transactions(start_date, end_date)


@router.post("/transactions", response_model=TransactionSchema)
def create_transaction(transaction: TransactionSchema, db: Session = Depends(get_db)):
    """새로운 거래 내역을 생성합니다.
    
    Args:
        transaction (TransactionSchema): 생성할 거래 정보.
        db (Session): 데이터베이스 세션.
        
    Returns:
        TransactionSchema: 생성된 거래 정보.
        
    Raises:
        HTTPException: 유효성 검증 실패 시 422.
    """
    try:
        return TransactionService(db).create_transaction(transaction)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/transactions/transfer", response_model=List[TransactionSchema])
def create_transfer_transaction(req: TransferTransactionRequest, db: Session = Depends(get_db)):
    """계좌 간 자금 이체 트랜잭션(출금 + 입금 쌍)을 원자적으로 생성합니다.
    
    Args:
        req (TransferTransactionRequest): 이체 요청 정보.
        db (Session): 데이터베이스 세션.
        
    Returns:
        List[TransactionSchema]: 생성된 출금/입금 거래 쌍 목록.
        
    Raises:
        HTTPException: 동일 계좌 이체 시 400, 계좌/자산 미존재 시 404, 기타 검증 오류 시 422.
    """
    try:
        return TransactionService(db).create_transfer_pair(req)
    except ValueError as e:
        err_msg = str(e)
        if "동일할 수 없습니다" in err_msg:
            raise HTTPException(status_code=400, detail=err_msg)
        if "찾을 수 없습니다" in err_msg:
            raise HTTPException(status_code=404, detail=err_msg)
        raise HTTPException(status_code=422, detail=err_msg)


@router.put("/transactions/{transaction_id}", response_model=TransactionSchema)
def update_transaction(transaction_id: int, transaction: TransactionSchema, db: Session = Depends(get_db)):
    """기존 거래 내역 정보를 수정합니다.
    
    Args:
        transaction_id (int): 수정할 거래 식별자.
        transaction (TransactionSchema): 수정할 거래 정보.
        db (Session): 데이터베이스 세션.
        
    Returns:
        TransactionSchema: 수정된 거래 정보.
        
    Raises:
        HTTPException: 미존재 시 404, 검증 실패 시 422.
    """
    try:
        return TransactionService(db).update_transaction(transaction_id, transaction)
    except ValueError as e:
        raise HTTPException(status_code=404 if "찾을 수 없습니다" in str(e) else 422, detail=str(e))


@router.delete("/transactions/{transaction_id}")
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    """거래 내역을 삭제합니다. (이체 쌍인 경우 상대 거래도 함께 삭제)
    
    Args:
        transaction_id (int): 삭제할 거래 식별자.
        db (Session): 데이터베이스 세션.
        
    Returns:
        dict: 삭제 완료 메시지.
        
    Raises:
        HTTPException: 거래가 존재하지 않는 경우 404.
    """
    try:
        TransactionService(db).delete_transaction(transaction_id)
        return {"message": "삭제되었습니다."}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/accounts/{account_id}/transactions/period", response_model=List[TransactionSchema])
def get_period_transactions(
    account_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """특정 계좌의 특정 기간 내 기존 거래 내역을 조회합니다.
    
    Args:
        account_id (int): 계좌 식별자.
        start_date (Optional[date]): 시작 일자.
        end_date (Optional[date]): 종료 일자.
        db (Session): 데이터베이스 세션.
        
    Returns:
        List[TransactionSchema]: 기간 내 거래 내역 목록.
    """
    return TransactionService(db).get_period_transactions(account_id, start_date, end_date)
