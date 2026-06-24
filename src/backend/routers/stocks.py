from fastapi import APIRouter, Query, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Dict
from ..database import get_db
from ..models import Stock
from ..services.kiwoom_service import KiwoomStockService
from ..services.price_service import price_service

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

@router.get("/prices")
async def get_stock_prices(
    ticker: str = Query(..., description="종목코드 또는 티커"),
    start_date: str = Query(..., description="조회 시작일 (YYYY-MM-DD)"),
    end_date: str = Query(None, description="조회 종료일 (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """
    특정 종목의 현재 및 과거 주가 데이터를 조회하고 반환합니다.
    조회 기간 중 DB에 없는 날짜의 데이터는 외부 API(yfinance, 키움 API)로 조회하여 DB에 캐싱합니다.
    """
    import datetime
    import re
    
    # 날짜 검증 및 파싱
    try:
        start_dt = datetime.datetime.strptime(start_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="start_date 형식이 올바르지 않습니다 (YYYY-MM-DD).")
        
    if end_date:
        try:
            end_dt = datetime.datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="end_date 형식이 올바르지 않습니다 (YYYY-MM-DD).")
    else:
        end_dt = datetime.date.today()
        
    if start_dt > end_dt:
        raise HTTPException(status_code=400, detail="start_date가 end_date보다 늦을 수 없습니다.")

    # 국가 자동 판별
    country = "US"
    # 숫자 6자리면 KR로 간주
    if re.match(r"^\d{6}$", ticker):
        country = "KR"
    else:
        # DB에 존재하는 종목이면 KR로 판별
        db_stock = db.query(Stock).filter(Stock.stock_code == ticker).first()
        if db_stock:
            country = "KR"

    # 종목 정보 획득
    stock_name = ticker
    market = "US" if country == "US" else "KR"
    
    if country == "KR":
        db_stock = db.query(Stock).filter(Stock.stock_code == ticker).first()
        if db_stock:
            stock_name = db_stock.stock_name
            market = db_stock.market
        else:
            fetched_name = await price_service.get_stock_name(ticker, "KR")
            if fetched_name:
                stock_name = fetched_name
                db.add(Stock(stock_code=ticker, stock_name=fetched_name, market="KOSPI"))
                db.commit()
                market = "KOSPI"
    else:
        fetched_name = await price_service.get_stock_name(ticker, "US")
        if fetched_name:
            stock_name = fetched_name
            market = "US"

    # 주가 조회 (캐싱 포함)
    prices_list = await price_service.get_historical_prices_with_cache(
        db=db,
        ticker=ticker,
        start_date=start_dt,
        end_date=end_dt,
        country=country
    )

    formatted_prices = [
        {
            "date": p["price_date"].strftime("%Y-%m-%d"),
            "close_price": p["close_price"]
        } for p in prices_list
    ]

    return {
        "ticker": ticker,
        "name": stock_name,
        "market": market,
        "prices": formatted_prices
    }

