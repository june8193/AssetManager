from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any

from ..database import get_db
from ..models import Watchlist
from ..services.price_service import price_service

router = APIRouter(
    prefix="/api/watchlist",
    tags=["watchlist"]
)

# --- Pydantic Schema --- #
class WatchlistCreate(BaseModel):
    stock_code: str
    stock_name: str
    country: str = "KR"

class WatchlistResponse(BaseModel):
    id: int
    stock_code: str
    stock_name: str
    country: str

    class Config:
        from_attributes = True

class PriceResponse(BaseModel):
    stock_code: str
    current_price: float
    change_rate: float

# --- API Endpoints --- #
@router.get("", response_model=List[WatchlistResponse])
def get_watchlist(country: str = "KR", db: Session = Depends(get_db)):
    """저장된 국가별 관심종목 목록을 반환합니다."""
    return db.query(Watchlist).filter(Watchlist.country == country.upper()).all()

@router.get("/prices", response_model=List[PriceResponse])
async def get_watchlist_prices(country: str = "KR", db: Session = Depends(get_db)):
    """관심종목의 실시간 시세(현재가, 등락률)를 조회하여 반환합니다."""
    items = db.query(Watchlist).filter(Watchlist.country == country.upper()).all()
    if not items:
        return []
    
    codes = [item.stock_code for item in items]
    
    if country.upper() == "US":
        return await price_service.get_us_prices(codes)
    else:
        return await price_service.get_kr_prices(codes)

@router.post("", response_model=WatchlistResponse, status_code=status.HTTP_201_CREATED)
async def add_to_watchlist(item: WatchlistCreate, db: Session = Depends(get_db)):
    """관심종목을 추가합니다."""
    db_item = db.query(Watchlist).filter(Watchlist.stock_code == item.stock_code).first()
    if db_item:
        raise HTTPException(
            status_code=400,
            detail="이미 관심종목에 등록된 종목코드입니다."
        )
    
    new_item = Watchlist(
        stock_code=item.stock_code, 
        stock_name=item.stock_name,
        country=item.country.upper()
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    
    return new_item

@router.delete("/{stock_code}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_watchlist(stock_code: str, db: Session = Depends(get_db)):
    """지정된 종목코드를 가진 관심종목을 삭제합니다."""
    db_item = db.query(Watchlist).filter(Watchlist.stock_code == stock_code).first()
    if not db_item:
        raise HTTPException(
            status_code=404,
            detail="해당 종목을 찾을 수 없습니다."
        )
    
    db.delete(db_item)
    db.commit()
    return
