import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from ..database import get_db
from ..services.sector_service import SectorService

router = APIRouter(
    prefix="/api/sector",
    tags=["sector"]
)

# --- Pydantic Schemas --- #

class ETFCreate(BaseModel):
    ticker: str
    name: Optional[str] = None
    country: str = "KR"

class ETFResponse(BaseModel):
    id: int
    ticker: str
    name: str
    country: str

    class Config:
        from_attributes = True

class SectorCreate(BaseModel):
    name: str
    country: str = "KR"

class SectorStockCreate(BaseModel):
    stock_code: str
    stock_name: Optional[str] = None
    shares_outstanding: Optional[float] = None

class SectorStockResponse(BaseModel):
    stock_code: str
    stock_name: str
    shares_outstanding: float

    class Config:
        from_attributes = True

class SectorResponse(BaseModel):
    id: int
    name: str
    country: str
    stocks: List[SectorStockResponse]

    class Config:
        from_attributes = True

# --- API Endpoints --- #

@router.get("/etf", response_model=List[ETFResponse])
async def get_etf_list(country: str = "KR", db: Session = Depends(get_db)):
    """해당 국가의 대표 ETF 목록을 반환합니다.
    
    Args:
        country (str): 국가 구분 ('KR' 또는 'US')
        db (Session): 데이터베이스 세션
        
    Returns:
        List[ETFResponse]: 대표 ETF 리스트
    """
    svc = SectorService(db)
    return await svc.get_sector_etfs(country=country.upper())

@router.post("/etf", response_model=ETFResponse, status_code=status.HTTP_201_CREATED)
async def add_etf(item: ETFCreate, db: Session = Depends(get_db)):
    """새로운 대표 ETF를 등록합니다.
    
    Args:
        item (ETFCreate): 추가할 ETF 스키마
        db (Session): 데이터베이스 세션
        
    Returns:
        ETFResponse: 추가된 ETF 정보
    """
    svc = SectorService(db)
    try:
        new_etf = await svc.add_sector_etf(
            ticker=item.ticker.strip(),
            name=item.name.strip() if item.name else None,
            country=item.country.upper()
        )
        return new_etf
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"ETF 등록에 실패했습니다: {e}"
        )

@router.delete("/etf/{ticker}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_etf(ticker: str, db: Session = Depends(get_db)):
    """등록된 대표 ETF를 삭제합니다.
    
    Args:
        ticker (str): 삭제할 ETF의 티커
        db (Session): 데이터베이스 세션
    """
    svc = SectorService(db)
    success = await svc.delete_sector_etf(ticker=ticker)
    if not success:
        raise HTTPException(
            status_code=404,
            detail="해당 ETF를 찾을 수 없습니다."
        )
    return

@router.get("/custom", response_model=List[SectorResponse])
async def get_custom_sector_list(country: str = "KR", db: Session = Depends(get_db)):
    """해당 국가의 커스텀 섹터 목록(구성 종목 포함)을 반환합니다.
    
    Args:
        country (str): 국가 구분 ('KR' 또는 'US')
        db (Session): 데이터베이스 세션
        
    Returns:
        List[SectorResponse]: 커스텀 섹터 리스트
    """
    svc = SectorService(db)
    return await svc.get_custom_sectors(country=country.upper())

@router.post("/custom", response_model=SectorResponse, status_code=status.HTTP_201_CREATED)
async def create_sector(item: SectorCreate, db: Session = Depends(get_db)):
    """새로운 커스텀 섹터 마스터를 추가합니다.
    
    Args:
        item (SectorCreate): 추가할 섹터 마스터 정보
        db (Session): 데이터베이스 세션
        
    Returns:
        SectorResponse: 생성된 커스텀 섹터
    """
    svc = SectorService(db)
    try:
        new_sector = await svc.create_custom_sector(
            name=item.name.strip(),
            country=item.country.upper()
        )
        return new_sector
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"커스텀 섹터 생성에 실패했습니다: {e}"
        )

@router.delete("/custom/{sector_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_sector(sector_id: int, db: Session = Depends(get_db)):
    """커스텀 섹터를 삭제합니다. (소속 종목 일괄 자동 삭제)
    
    Args:
        sector_id (int): 삭제할 섹터 ID
        db (Session): 데이터베이스 세션
    """
    svc = SectorService(db)
    success = await svc.delete_custom_sector(sector_id=sector_id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail="해당 커스텀 섹터를 찾을 수 없습니다."
        )
    return

@router.post("/custom/{sector_id}/stock", response_model=SectorStockResponse, status_code=status.HTTP_201_CREATED)
async def add_stock_to_sector(sector_id: int, item: SectorStockCreate, db: Session = Depends(get_db)):
    """커스텀 섹터 내에 종목을 추가합니다.
    
    Args:
        sector_id (int): 대상 섹터 ID
        item (SectorStockCreate): 종목 추가 스키마
        db (Session): 데이터베이스 세션
        
    Returns:
        SectorStockResponse: 추가된 종목 상세
    """
    svc = SectorService(db)
    try:
        stock = await svc.add_stock_to_sector(
            sector_id=sector_id,
            stock_code=item.stock_code.strip(),
            stock_name=item.stock_name.strip() if item.stock_name else None,
            shares_outstanding=item.shares_outstanding
        )
        return stock
    except ValueError as ve:
        raise HTTPException(
            status_code=404,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"섹터 종목 등록에 실패했습니다: {e}"
        )

@router.delete("/custom/{sector_id}/stock/{stock_code}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_stock_from_sector(sector_id: int, stock_code: str, db: Session = Depends(get_db)):
    """섹터 내 소속 종목을 삭제합니다.
    
    Args:
        sector_id (int): 대상 섹터 ID
        stock_code (str): 삭제할 종목 코드 / 티커
        db (Session): 데이터베이스 세션
    """
    svc = SectorService(db)
    success = await svc.delete_stock_from_sector(sector_id=sector_id, stock_code=stock_code)
    if not success:
        raise HTTPException(
            status_code=404,
            detail="해당 섹터 종목을 찾을 수 없습니다."
        )
    return

@router.get("/dashboard")
async def get_sector_dashboard(
    country: str = Query("KR", pattern="^(KR|US)$"),
    period: str = Query("YTD", pattern="^(YTD|1W|1M|3M|6M|Custom)$"),
    compare_index: str = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """국가, 기간, 비교지수를 설정하여 섹터 분석 수익률 대시보드 데이터를 조회합니다.
    
    Args:
        country (str): 국가 구분 ('KR' 또는 'US')
        period (str): 조회 기간
        compare_index (str, optional): 비교 지수
        start_date (str, optional): Custom 시 시작일 (YYYY-MM-DD)
        end_date (str, optional): Custom 시 종료일 (YYYY-MM-DD)
        db (Session): 데이터베이스 세션
        
    Returns:
        Dict[str, Any]: 랭킹 및 변동률 데이터를 포함한 딕셔너리
    """
    # 기본 비교 지수 설정
    if not compare_index:
        compare_index = "^KS11" if country.upper() == "KR" else "^GSPC"

    # 날짜 파싱
    s_date = None
    e_date = None
    if period == "Custom":
        try:
            if start_date:
                s_date = datetime.datetime.strptime(start_date, "%Y-%m-%d").date()
            if end_date:
                e_date = datetime.datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식을 사용해 주세요."
            )
            
    svc = SectorService(db)
    try:
        data = await svc.get_sector_dashboard_data(
            country=country.upper(),
            period=period,
            compare_index=compare_index,
            start_date=s_date,
            end_date=e_date
        )
        return data
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"대시보드 데이터를 가져오는 데 실패했습니다: {e}"
        )
