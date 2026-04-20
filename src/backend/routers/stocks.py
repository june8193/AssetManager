from fastapi import APIRouter, Query
from typing import List, Dict
import FinanceDataReader as fdr

router = APIRouter(
    prefix="/api/stocks",
    tags=["stocks"]
)

# 메모리 캐시 목적으로 전역 변수로 관리
_stock_list_cache = []

def get_cached_stocks():
    global _stock_list_cache
    if not _stock_list_cache:
        # 코스피, 코스닥 종목을 불러옴 (DataFrame)
        df_krx = fdr.StockListing('KRX')
        # 필요한 필드만 추출하여 딕셔너리 리스트로 변환
        for _, row in df_krx.iterrows():
            _stock_list_cache.append({
                "stock_code": str(row['Code']),
                "stock_name": str(row['Name'])
            })
    return _stock_list_cache

@router.get("/search", response_model=List[Dict[str, str]])
def search_stocks(q: str = Query(..., min_length=1, description="검색할 종목명 또는 종목코드")):
    """
    주어진 검색어가 포함된 주식 종목 리스트를 반환합니다.
    """
    stocks = get_cached_stocks()
    # 대소문자 무시를 위해 소문자로 변환
    query = q.lower()
    
    results = []
    for stock in stocks:
        # 종목코드 또는 종목명에 쿼리가 포함되는지 검사
        if query in stock["stock_code"].lower() or query in stock["stock_name"].lower():
            results.append(stock)
            # 최대 20개의 결과만 반환하도록 제한
            if len(results) >= 20:
                break
                
    return results
