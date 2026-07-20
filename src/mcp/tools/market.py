# -*- coding: utf-8 -*-
"""관심종목, 시장 지수 및 개별 주식의 가격 조회/동기화를 위한 MCP 도구 함수 모음입니다.
백엔드 API 서버를 호출하여 데이터를 가져옵니다.
"""

from typing import Optional
from src.mcp.client import api_client

async def get_watchlist_prices(country: str = "KR") -> dict:
    """등록된 관심종목의 현재가 및 전일 대비 등락률 목록을 조회합니다.

    Args:
        country (str): 국가 구분 (KR 또는 US), 기본값 KR.

    Returns:
        dict: 관심종목 시세 목록
    """
    try:
        upper_country = country.upper()
        # 1. 관심종목 기본 목록 조회 (이름 매핑용)
        items = await api_client.get("/api/watchlist", params={"country": upper_country})
        if isinstance(items, dict) and "error" in items:
            return items

        if not items:
            return {"country": upper_country, "prices": []}

        name_map = {item["stock_code"]: item["stock_name"] for item in items}

        # 2. 관심종목 시세 정보 조회
        prices = await api_client.get("/api/watchlist/prices", params={"country": upper_country})
        if isinstance(prices, dict) and "error" in prices:
            return prices

        result_prices = []
        for p in prices:
            code = p.get("stock_code")
            result_prices.append({
                "stock_name": name_map.get(code, ""),
                "stock_code": code,
                "current_price": p.get("current_price"),
                "change_rate": p.get("change_rate")
            })

        return {"country": upper_country, "prices": result_prices}
    except Exception as e:
        return {"error": f"관심종목 시세 조회 중 오류 발생: {str(e)}"}

async def get_market_history(
    tickers: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> dict:
    """KOSPI, KOSDAQ, S&P 500, NASDAQ 등 특정 시장 지수들의 역사적 시계열 가격을 조회합니다.

    Args:
        tickers (str): 조회하고자 하는 지수 티커 (콤마로 구분, 예: ^KS11,^GSPC)
        start_date (str, optional): 조회 시작일 (YYYY-MM-DD). 미입력 시 30일 전.
        end_date (str, optional): 조회 종료일 (YYYY-MM-DD). 미입력 시 오늘.

    Returns:
        dict: 티커별 일자별 지수 데이터 매핑 결과
    """
    try:
        params = {"tickers": tickers}
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date

        results = await api_client.get("/api/market/history", params=params)
        return results
    except Exception as e:
        return {"error": f"지수 이력 조회 중 오류 발생: {str(e)}"}

async def get_stock_history(
    ticker: str,
    start_date: str,
    end_date: Optional[str] = None
) -> dict:
    """특정 개별 주식(국내/미국)의 역사적 및 실시간 가격 이력을 조회합니다.

    Args:
        ticker (str): 종목코드(KR 6자리) 또는 티커(US)
        start_date (str): 조회 시작일 (YYYY-MM-DD)
        end_date (str, optional): 조회 종료일 (YYYY-MM-DD). 생략 시 오늘.

    Returns:
        dict: 일자 정렬된 주가 및 종목 정보
    """
    try:
        params = {"ticker": ticker, "start_date": start_date}
        if end_date:
            params["end_date"] = end_date

        result = await api_client.get("/api/stocks/prices", params=params)
        return result
    except Exception as e:
        return {"error": f"개별 주가 조회 중 오류 발생: {str(e)}"}

async def refresh_market_prices() -> dict:
    """모든 시장 지수, 보유 자산 및 관심 종목의 시세 데이터를 수동으로 즉시 최신화합니다.

    Returns:
        dict: 시세 최신화 결과 메시지
    """
    try:
        result = await api_client.post("/api/dashboard/refresh")
        return result
    except Exception as e:
        return {"status": "error", "message": f"수동 시세 최신화 중 오류 발생: {str(e)}"}

async def check_market_holiday(
    date: Optional[str] = None,
    country: str = "KR"
) -> dict:
    """특정 날짜의 특정 국가 시장 휴장일 여부를 조회합니다.

    Args:
        date (str, optional): 조회 대상 국가 기준의 현지 날짜 (YYYY-MM-DD), 미입력 시 오늘.
        country (str): 국가 코드 (KR 또는 US), 기본값 KR.

    Returns:
        dict: 시장 휴장일 판정 정보
    """
    try:
        params = {"country": country.upper()}
        if date:
            params["date"] = date
        result = await api_client.get("/api/market/holiday", params=params)
        return result
    except Exception as e:
        return {"error": f"휴장일 조회 중 오류 발생: {str(e)}"}

async def get_market_indices(country: str = "KR") -> dict:
    """KOSPI/KOSDAQ 또는 미국 지수들의 현재가 및 전일 대비 등락률을 조회합니다.

    Args:
        country (str): 국가 구분 (KR 또는 US), 기본값 KR.

    Returns:
        dict: 시장 지수 목록 정보
    """
    try:
        params = {"country": country.upper()}
        result = await api_client.get("/api/market/indices", params=params)
        return result
    except Exception as e:
        return {"error": f"시장 지수 조회 중 오류 발생: {str(e)}"}
