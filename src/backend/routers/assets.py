"""자산 마스터 CRUD 및 카테고리 검증 전용 API 라우터 모듈입니다."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import Asset, VALID_CATEGORIES
from ..schemas import AssetSchema
from ..services.price_service import price_service

router = APIRouter(
    prefix="/api/db",
    tags=["assets"]
)


@router.get("/assets", response_model=List[AssetSchema])
def get_assets(db: Session = Depends(get_db)):
    """전체 자산 마스터 목록을 조회합니다.
    
    Args:
        db (Session): 데이터베이스 세션.
        
    Returns:
        List[AssetSchema]: 자산 마스터 목록.
    """
    return db.query(Asset).order_by(Asset.id.desc()).all()


@router.get("/assets/categories")
def get_categories():
    """자산 대분류 및 중분류 목록을 조회합니다.
    
    Returns:
        dict: 대분류별 중분류 허용 목록 매핑.
    """
    return VALID_CATEGORIES


CASH_TICKER_NAMES = {
    "KRW": "원화예수금",
    "USD": "달러예수금",
}


@router.get("/assets/verify")
async def verify_asset(ticker: str, country: str, major_category: str, db: Session = Depends(get_db)):
    """티커와 국가를 기반으로 종목의 실시간 존재 여부를 검증하고 공식 자산명을 반환합니다.
    
    Args:
        ticker (str): 자산 티커.
        country (str): 국가 코드 (KR, US).
        major_category (str): 대분류 카테고리.
        db (Session): 데이터베이스 세션.
        
    Returns:
        dict: 공식 자산명.
        
    Raises:
        HTTPException: 이미 등록된 자산이거나 종목을 찾을 수 없는 경우.
    """
    existing = db.query(Asset).filter(Asset.ticker == ticker).first()
    if existing:
        raise HTTPException(status_code=400, detail="이미 등록된 자산(티커)입니다.")

    if major_category == "현금":
        if ticker in CASH_TICKER_NAMES:
            return {"name": CASH_TICKER_NAMES[ticker]}
        raise HTTPException(status_code=400, detail="지원하지 않는 현금 티커입니다.")
            
    name = await price_service.get_stock_name(ticker, country)
    if not name:
        raise HTTPException(status_code=404, detail="해당 국가의 주식시장에서 종목을 찾을 수 없습니다.")
        
    return {"name": name}


@router.post("/assets", response_model=AssetSchema)
def create_asset(asset: AssetSchema, db: Session = Depends(get_db)):
    """새로운 자산 마스터를 생성합니다.
    
    Args:
        asset (AssetSchema): 생성할 자산 정보.
        db (Session): 데이터베이스 세션.
        
    Returns:
        AssetSchema: 생성된 자산 정보.
        
    Raises:
        HTTPException: 중복 티커인 경우 400.
    """
    existing = db.query(Asset).filter(Asset.ticker == asset.ticker).first()
    if existing:
        raise HTTPException(status_code=400, detail="이미 등록된 자산(티커)입니다.")

    data = asset.model_dump(exclude={"id"})
    db_asset = Asset(**data)
    db.add(db_asset)
    db.commit()
    db.refresh(db_asset)
    return db_asset


@router.put("/assets/{asset_id}", response_model=AssetSchema)
def update_asset(asset_id: int, asset: AssetSchema, db: Session = Depends(get_db)):
    """기존 자산 마스터 정보를 수정합니다.
    
    Args:
        asset_id (int): 수정할 자산 식별자.
        asset (AssetSchema): 수정할 자산 정보.
        db (Session): 데이터베이스 세션.
        
    Returns:
        AssetSchema: 수정된 자산 정보.
        
    Raises:
        HTTPException: 자산이 존재하지 않는 경우 404.
    """
    db_asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not db_asset:
        raise HTTPException(status_code=404, detail="자산을 찾을 수 없습니다.")
    data = asset.model_dump(exclude={"id"})
    for key, value in data.items():
        setattr(db_asset, key, value)
    db.commit()
    db.refresh(db_asset)
    return db_asset


@router.delete("/assets/{asset_id}")
def delete_asset(asset_id: int, db: Session = Depends(get_db)):
    """자산 마스터를 삭제합니다.
    
    Args:
        asset_id (int): 삭제할 자산 식별자.
        db (Session): 데이터베이스 세션.
        
    Returns:
        dict: 삭제 완료 메시지.
        
    Raises:
        HTTPException: 자산이 존재하지 않는 경우 404.
    """
    db_asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not db_asset:
        raise HTTPException(status_code=404, detail="자산을 찾을 수 없습니다.")
    db.delete(db_asset)
    db.commit()
    return {"message": "삭제되었습니다."}
