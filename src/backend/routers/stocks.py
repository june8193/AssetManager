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
    country: str = Query("KR", description="국가 구분 (KR, US)"),
    db: Session = Depends(get_db)
):
    """
    데이터베이스에서 이름 또는 코드가 검색어와 일치하는 종목 리스트를 반환합니다.
    미국 주식(US)의 경우 현재는 Mock 데이터를 반환합니다.
    """
    if country == "US":
        # yfinance를 이용한 미국 주식 검색
        try:
            import yfinance as yf
            search = yf.Search(q, max_results=20)
            
            # 허용할 시장 코드 (Yahoo Finance 기준)
            # NYQ: NYSE, NMS/NGM/NCM: NASDAQ
            allowed_exchanges = ["NYQ", "NMS", "NGM", "NCM"]
            
            results = []
            for quote in search.quotes:
                exchange = quote.get("exchange")
                if exchange in allowed_exchanges:
                    results.append({
                        "stock_code": quote.get("symbol"),
                        "stock_name": quote.get("shortname") or quote.get("longname") or quote.get("symbol"),
                        "market": "NYSE" if exchange == "NYQ" else "NASDAQ"
                    })
            return results
        except Exception as e:
            print(f"yfinance search error: {e}")
            return []

    # 국내 주식 검색 (기존 로직)
    query = f"%{q}%"
    results = db.query(Stock).filter(
        or_(
            Stock.stock_code.ilike(query),
            Stock.stock_name.ilike(query)
        )
    ).limit(20).all()
    
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
