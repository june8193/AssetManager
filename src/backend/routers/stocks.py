from fastapi import APIRouter, Query, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Dict
from ..database import get_db
from ..models import Stock
from ..services.kiwoom_service import KiwoomStockService

router = APIRouter(
    prefix="/api/stocks",
    tags=["stocks"]
)

@router.get("/search", response_model=List[Dict[str, str]])
def search_stocks(
    q: str = Query(..., min_length=1, description="검색할 종목명 또는 종목코드"),
    db: Session = Depends(get_db)
):
    """
    데이터베이스에서 이름 또는 코드가 검색어와 일치하는 종목 리스트를 반환합니다.
    """
    # 대소문자 무시 검색 (LIKE %query%)
    query = f"%{q}%"
    
    # SQLAlchemy의 case-insensitive ilike 사용 (SQLite는 기본적으로 case-insensitive)
    results = db.query(Stock).filter(
        or_(
            Stock.stock_code.ilike(query),
            Stock.stock_name.ilike(query)
        )
    ).limit(20).all()
    
    # 응답 형식에 맞춰 변환
    return [
        {
            "stock_code": s.stock_code,
            "stock_name": s.stock_name,
            "market": s.market
        } for s in results
    ]

@router.post("/sync")
async def sync_stocks(db: Session = Depends(get_db)):
    """
    키움 REST API를 통해 주식 종목 리스트를 수동으로 동기화합니다.
    """
    service = KiwoomStockService()
    try:
        count = await service.sync_all_stocks(db)
        return {
            "status": "success",
            "message": f"성공적으로 {count}개의 종목을 동기화했습니다.",
            "count": count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
