from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from ..database import get_db
from ..models import Watchlist
from src.kiwoom.ws_client import kiwoom_ws_client
from ..services.us_stock_service import us_stock_service

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

# --- API Endpoints --- #
@router.get("", response_model=List[WatchlistResponse])
def get_watchlist(country: str = "KR", db: Session = Depends(get_db)):
    """저장된 국가별 관심종목 목록을 반환합니다."""
    return db.query(Watchlist).filter(Watchlist.country == country).all()

@router.post("", response_model=WatchlistResponse, status_code=status.HTTP_201_CREATED)
async def add_to_watchlist(item: WatchlistCreate, db: Session = Depends(get_db)):
    """관심종목을 추가하고 실시간 시세 구독을 시작합니다."""
    db_item = db.query(Watchlist).filter(Watchlist.stock_code == item.stock_code).first()
    if db_item:
        raise HTTPException(
            status_code=400,
            detail="이미 관심종목에 등록된 종목코드입니다."
        )
    
    new_item = Watchlist(
        stock_code=item.stock_code, 
        stock_name=item.stock_name,
        country=item.country
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    
    # 국가별 시세 구독 서비스 호출
    if item.country == "US":
        us_stock_service.subscribe([item.stock_code])
    else:
        await kiwoom_ws_client.subscribe([item.stock_code])
    
    return new_item

@router.delete("/{stock_code}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_watchlist(stock_code: str, db: Session = Depends(get_db)):
    """지정된 종목코드를 가진 관심종목을 삭제하고 시세 구독을 해지합니다."""
    db_item = db.query(Watchlist).filter(Watchlist.stock_code == stock_code).first()
    if not db_item:
        raise HTTPException(
            status_code=404,
            detail="해당 종목을 찾을 수 없습니다."
        )
    
    # 국가별 시세 구독 해지
    if db_item.country == "US":
        us_stock_service.unsubscribe([stock_code])
    else:
        await kiwoom_ws_client.unsubscribe([stock_code])
    
    db.delete(db_item)
    db.commit()
    return
