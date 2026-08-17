"""스냅샷 조회, 미리보기, 증권/은행 정산 및 통합 저장 전용 API 라우터 모듈입니다."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import date

from ..database import get_db
from ..schemas import (
    SnapshotSchema,
    SnapshotPreviewSchema,
    SaveSnapshotRequest,
    LatestSnapshotDateResponse,
    BrokerageCalculateRequest,
    BrokerageCalculateResponse,
    BrokerageSaveRequest,
    BankCalculateRequest,
    BankCalculateResponse,
    BankSaveRequest,
    UnifiedSaveRequest,
    SnapshotRecalculateRequest,
    SnapshotRecalculateResponse,
)
from ..services.snapshot_engine import SnapshotEngine


router = APIRouter(
    prefix="/api/db",
    tags=["snapshots"]
)


@router.get("/snapshots", response_model=List[SnapshotSchema])
def get_snapshots(db: Session = Depends(get_db)):
    """전체 자산 상태 스냅샷 목록을 최신순으로 조회합니다.
    
    Args:
        db (Session): 데이터베이스 세션.
        
    Returns:
        List[SnapshotSchema]: 자산 상태 스냅샷 객체 리스트.
    """
    return SnapshotEngine(db).get_snapshots()


@router.get("/snapshots/latest", response_model=LatestSnapshotDateResponse)
def get_latest_snapshot_date(db: Session = Depends(get_db)):
    """가장 최근에 기록된 스냅샷의 날짜를 조회합니다.
    
    Args:
        db (Session): 데이터베이스 세션.
        
    Returns:
        LatestSnapshotDateResponse: 최근 스냅샷 날짜 응답 객체.
    """
    latest_date = SnapshotEngine(db).get_latest_snapshot_date()
    return LatestSnapshotDateResponse(latest_date=latest_date)


@router.delete("/snapshots/{snapshot_date}")
def delete_snapshots_by_date(snapshot_date: date, db: Session = Depends(get_db)):
    """지정된 날짜의 모든 계좌 스냅샷 데이터 및 관련 보정 거래를 삭제합니다.
    
    Args:
        snapshot_date (date): 삭제할 스냅샷 기준 일자.
        db (Session): 데이터베이스 세션.
        
    Returns:
        dict: 삭제 완료 메시지.
        
    Raises:
        HTTPException: 해당 날짜의 스냅샷이 존재하지 않는 경우 404.
    """
    success = SnapshotEngine(db).delete_snapshots_by_date(snapshot_date)
    if not success:
        raise HTTPException(status_code=404, detail="해당 날짜의 스냅샷을 찾을 수 없습니다.")
    db.commit()
    return {"message": f"Deleted snapshots and adjustments for {snapshot_date}"}


@router.post("/snapshots/preview", response_model=List[SnapshotPreviewSchema])
async def preview_snapshots(req: SaveSnapshotRequest, db: Session = Depends(get_db)):
    """입력받은 환율을 적용하여 저장될 스냅샷 데이터를 미리 계산합니다.
    
    Args:
        req (SaveSnapshotRequest): 미리보기 요청 정보.
        db (Session): 데이터베이스 세션.
        
    Returns:
        List[SnapshotPreviewSchema]: 계좌별 미리보기 리스트.
    """
    return await SnapshotEngine(db).preview(req.snapshot_date, req.exchange_rate)


@router.post("/snapshots/save", response_model=List[SnapshotSchema])
async def save_snapshots(previews: List[SnapshotPreviewSchema], db: Session = Depends(get_db)):
    """확인된 미리보기 데이터를 바탕으로 스냅샷을 실제 DB에 저장합니다.
    
    Args:
        previews (List[SnapshotPreviewSchema]): 스냅샷 미리보기 리스트.
        db (Session): 데이터베이스 세션.
        
    Returns:
        List[SnapshotSchema]: 생성된 최종 스냅샷 목록.
    """
    return SnapshotEngine(db).save_snapshots(previews, commit=True)


@router.post("/snapshots/brokerage/calculate", response_model=BrokerageCalculateResponse)
async def calculate_brokerage_snapshot(req: BrokerageCalculateRequest, db: Session = Depends(get_db)):
    """증권계좌의 이론상 현금 잔액을 계산하고 입력값과의 차액(배당금 등)을 산출합니다.
    
    Args:
        req (BrokerageCalculateRequest): 증권 계좌 정산 요청 데이터.
        db (Session): 데이터베이스 세션.
        
    Returns:
        BrokerageCalculateResponse: 이론적 잔액 및 실제 잔액과의 차액 결과.
    """
    return await SnapshotEngine(db).calculate_brokerage(req)


def _handle_save_error(e: Exception, context_name: str):
    """스냅샷 저장 시 발생하는 예외를 적절한 HTTPException으로 변환합니다."""
    if isinstance(e, HTTPException):
        raise e
    if isinstance(e, ValueError):
        raise HTTPException(status_code=500, detail=str(e))
    raise HTTPException(status_code=500, detail=f"{context_name} 중 오류 발생: {str(e)}")


@router.post("/snapshots/brokerage/save", response_model=List[SnapshotSchema])
async def save_brokerage_snapshots(req: BrokerageSaveRequest, db: Session = Depends(get_db)):
    """증권계좌의 입출금, 차액(배당/수수료)을 저장하고 최종 스냅샷을 생성합니다.
    
    Args:
        req (BrokerageSaveRequest): 증권 스냅샷 저장 요청 데이터.
        db (Session): 데이터베이스 세션.
        
    Returns:
        List[SnapshotSchema]: 생성된 최종 스냅샷 목록.
        
    Raises:
        HTTPException: 저장 중 오류 발생 시 500.
    """
    try:
        return await SnapshotEngine(db).save_brokerage(req)
    except Exception as e:
        _handle_save_error(e, "증권 스냅샷 저장")


@router.post("/snapshots/bank/calculate", response_model=BankCalculateResponse)
async def calculate_bank_snapshot(req: BankCalculateRequest, db: Session = Depends(get_db)):
    """은행계좌의 예상 잔액 및 거래 유형별 합계를 계산합니다.
    
    Args:
        req (BankCalculateRequest): 은행 계산 요청 데이터.
        db (Session): 데이터베이스 세션.
        
    Returns:
        BankCalculateResponse: 계산된 최종 잔액 및 유형별 합계.
    """
    return await SnapshotEngine(db).calculate_bank(req)


@router.post("/snapshots/bank/save", response_model=List[SnapshotSchema])
async def save_bank_snapshots(req: BankSaveRequest, db: Session = Depends(get_db)):
    """은행 계좌의 입출금, 이자, 세금을 저장하고 최종 스냅샷을 생성합니다.
    
    Args:
        req (BankSaveRequest): 은행 스냅샷 저장 요청 데이터.
        db (Session): 데이터베이스 세션.
        
    Returns:
        List[SnapshotSchema]: 생성된 최종 스냅샷 목록.
        
    Raises:
        HTTPException: 저장 중 오류 발생 시 500.
    """
    try:
        return await SnapshotEngine(db).save_bank(req)
    except Exception as e:
        _handle_save_error(e, "은행 스냅샷 저장")


@router.post("/snapshots/unified/save", response_model=List[SnapshotSchema])
async def save_unified_snapshots(req: UnifiedSaveRequest, db: Session = Depends(get_db)):
    """증권계좌와 은행계좌의 데이터를 통합하여 단일 트랜잭션으로 저장하고 최종 스냅샷을 생성합니다.
    
    Args:
        req (UnifiedSaveRequest): 통합 저장 요청 데이터.
        db (Session): 데이터베이스 세션.
        
    Returns:
        List[SnapshotSchema]: 생성된 최종 스냅샷 목록.
        
    Raises:
        HTTPException: 저장 중 오류 발생 시 500.
    """
    try:
        return await SnapshotEngine(db).save_unified(req)
    except Exception as e:
        _handle_save_error(e, "통합 스냅샷 저장")


@router.post("/snapshots/recalculate", response_model=SnapshotRecalculateResponse)
async def recalculate_snapshots(req: SnapshotRecalculateRequest, db: Session = Depends(get_db)):
    """원장 거래 내역을 기반으로 과거 스냅샷의 입출금 및 기간 수익을 일괄 재산출합니다.
    
    Args:
        req (SnapshotRecalculateRequest): 재계산 요청 데이터.
        db (Session): 데이터베이스 세션.
        
    Returns:
        SnapshotRecalculateResponse: 재계산 결과 및 차액 diff 리스트.
        
    Raises:
        HTTPException: 재계산 처리 중 오류 발생 시 500.
    """
    try:
        return await SnapshotEngine(db).recalculate(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"스냅샷 재계산 오류 발생: {str(e)}")

