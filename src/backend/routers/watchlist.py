from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from ..database import get_db
from ..models import Watchlist

router = APIRouter(
    prefix="/api/watchlist",
    tags=["watchlist"]
)

# --- Pydantic Schema --- #
class WatchlistCreate(BaseModel):
    stock_code: str
    stock_name: str

class WatchlistResponse(BaseModel):
    id: int
    stock_code: str
    stock_name: str

    class Config:
        from_attributes = True

# --- API Endpoints --- #
@router.get("", response_model=List[WatchlistResponse])
def get_watchlist(db: Session = Depends(get_db)):
    """저장된 전체 관심종목 목록을 반환합니다."""
    return db.query(Watchlist).all()

@router.post("", response_model=WatchlistResponse, status_code=status.HTTP_201_CREATED)
def add_to_watchlist(item: WatchlistCreate, db: Session = Depends(get_db)):
    """관심종목을 추가합니다. 이미 존재하는 종목코드는 추가할 수 없습니다."""
    db_item = db.query(Watchlist).filter(Watchlist.stock_code == item.stock_code).first()
    if db_item:
        raise HTTPException(
            status_code=400,
            detail="이미 관심종목에 등록된 종목코드입니다."
        )
    
    new_item = Watchlist(stock_code=item.stock_code, stock_name=item.stock_name)
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item

@router.delete("/{stock_code}", status_code=status.HTTP_204_NO_CONTENT)
def remove_from_watchlist(stock_code: str, db: Session = Depends(get_db)):
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
