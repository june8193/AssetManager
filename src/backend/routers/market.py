# -*- coding: utf-8 -*-
"""시장 지수 정보 및 거래소 휴장일 판정을 처리하는 라우터 모듈입니다.

코스피(KOSPI), 코스닥(KOSDAQ)의 현재 지수와 전일 대비 등락률을 조회하고,
한국거래소(KRX) 및 미국 뉴욕증시(NYSE)의 특정 일자 휴장일 여부를 판정합니다.
"""

import datetime
import zoneinfo
from typing import List, Optional, Dict
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from ..database import get_db
from ..services.market_analysis_service import MarketAnalysisService
from ..services.benchmark_service import BenchmarkService
from ..services.price_service import price_service

router = APIRouter(prefix="/api/market", tags=["market"])

class MarketHistoryItem(BaseModel):
    """시장 지수 일자별 가격 정보를 나타내는 Pydantic 모델입니다.

    Attributes:
        date: 날짜 (YYYY-MM-DD)
        close_price: 종가 또는 실시간 현재가
    """
    date: str = Field(..., description="날짜 (YYYY-MM-DD)")
    close_price: float = Field(..., description="종가 또는 실시간 현재가")

class MarketIndexItem(BaseModel):
    """시장 지수 정보를 나타내는 Pydantic 모델입니다.

    Attributes:
        index_name: 지수 명칭 (KOSPI, KOSDAQ, S&P 500, NASDAQ, DOW JONES 등)
        current_price: 현재 지수 값
        change_rate: 전일 대비 등락률 (%)
    """
    index_name: str = Field(..., description="지수 명칭 (KOSPI, KOSDAQ, S&P 500, NASDAQ, DOW JONES 등)")
    current_price: float = Field(..., description="현재 지수 값")
    change_rate: float = Field(..., description="전일 대비 등락률 (%)")

class MarketHolidayResponse(BaseModel):
    """시장 휴장일 여부 응답 정보를 나타내는 Pydantic 모델입니다.

    Attributes:
        date: 검증 대상 날짜 (YYYY-MM-DD)
        country: 국가 코드 (KR 또는 US)
        is_holiday: 휴장일 여부 (True인 경우 휴장일)
        description: 휴장 사유 또는 영업일 표시
    """
    date: str = Field(..., description="검증 대상 날짜 (YYYY-MM-DD)")
    country: str = Field(..., description="국가 코드 (KR 또는 US)")
    is_holiday: bool = Field(..., description="휴장일 여부")
    description: str = Field(..., description="휴장 사유 또는 영업일")

from ..market import MarketCalendar

# 국가별 시장 기준 시간대 및 공휴일 매핑 (MarketCalendar 참조)
COUNTRY_TIMEZONES = MarketCalendar.COUNTRY_TIMEZONES
HOLIDAY_NAME_MAP = MarketCalendar.HOLIDAY_NAME_MAP


@router.get("/indices", response_model=List[MarketIndexItem])
async def get_market_indices(
    country: str = Query("KR", description="국가 코드 (KR 또는 US)")
):
    """지정된 국가의 주요 시장 지수와 전일 대비 등락률을 조회합니다.

    Args:
        country (str): 국가 코드 ('KR' 또는 'US', 대소문자 구분 없음).

    Returns:
        List[MarketIndexItem]: 시장 지수 데이터 리스트
    """
    # 1. 국가 코드 정규화 및 검증
    country_upper = country.upper()
    if country_upper not in ["KR", "US"]:
        raise HTTPException(
            status_code=400,
            detail="지원하지 않는 국가 코드입니다. KR 또는 US를 입력해 주세요."
        )

    try:
        raw_indices = await price_service.get_market_indices(country=country_upper)
        return [
            MarketIndexItem(
                index_name=item.get("index_name", ""),
                current_price=float(item.get("current_price", 0.0)),
                change_rate=float(item.get("change_rate", 0.0)),
            )
            for item in raw_indices
        ]
    except Exception as e:
        print(f"[ERROR] 지수 데이터 가져오기 실패: {e}")
        if country_upper == "KR":
            default_names = ["KOSPI", "KOSDAQ"]
        else:
            default_names = ["S&P 500", "NASDAQ", "DOW JONES"]
        return [
            MarketIndexItem(index_name=name, current_price=0.0, change_rate=0.0)
            for name in default_names
        ]

@router.get("/holiday", response_model=MarketHolidayResponse)
async def check_market_holiday(
    date: Optional[str] = Query(None, description="조회 대상 날짜 (YYYY-MM-DD, 조회 대상 국가 기준의 현지 날짜)"),
    country: str = Query("KR", description="국가 코드 (KR 또는 US)")
):
    """특정 날짜의 주식 시장 휴장일 여부를 판정합니다.

    한국거래소(KRX) 또는 뉴욕증시(NYSE)의 휴장일 기준을 따릅니다.

    Args:
        date (str, optional): 조회할 날짜 (형식: YYYY-MM-DD, 조회 대상 국가 기준의 현지 날짜를 의미). 지정하지 않으면 오늘 날짜 기준.
        country (str): 국가 코드 ('KR' 또는 'US', 대소문자 구분 없음).

    Returns:
        MarketHolidayResponse: 휴장 여부 및 사유 정보
    """
    # 1. 국가 코드 정규화 및 검증
    country_upper = country.upper()
    if country_upper not in ["KR", "US"]:
        raise HTTPException(
            status_code=400,
            detail="지원하지 않는 국가 코드입니다. KR 또는 US를 입력해 주세요."
        )

    # 2. 날짜 결정 및 파싱
    if not date:
        tz_name = COUNTRY_TIMEZONES.get(country_upper, "Asia/Seoul")
        try:
            local_tz = zoneinfo.ZoneInfo(tz_name)
        except Exception:
            local_tz = zoneinfo.ZoneInfo("Asia/Seoul")
        local_now = datetime.datetime.now(local_tz)
        target_date = local_now.date()
    else:
        try:
            target_date = datetime.datetime.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="날짜 형식이 잘못되었습니다. YYYY-MM-DD 형식을 사용해 주세요."
            )

    # 3. 공통 헬퍼 함수를 통한 휴장일 판정
    holiday_reason = await price_service.get_market_holiday_info(target_date, country_upper)
    if holiday_reason:
        return MarketHolidayResponse(
            date=target_date.strftime("%Y-%m-%d"),
            country=country_upper,
            is_holiday=True,
            description=holiday_reason
        )

    return MarketHolidayResponse(
        date=target_date.strftime("%Y-%m-%d"),
        country=country_upper,
        is_holiday=False,
        description="영업일"
    )


@router.get("/analysis/historical")
async def get_market_analysis_historical(
    ticker: str = Query(..., description="조회할 지수 티커"),
    start_date: Optional[str] = Query(None, description="시작일 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="종료일 (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """특정 지수의 역사적 시계열 데이터 및 MDD 추이를 조회합니다."""
    try:
        today = datetime.date.today()
        s_date = datetime.datetime.strptime(start_date, "%Y-%m-%d").date() if start_date else datetime.date(2020, 1, 1)
        e_date = datetime.datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else today
        
        service = MarketAnalysisService(db)
        return await service.get_historical_data(ticker, s_date, e_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="날짜 형식이 잘못되었습니다. YYYY-MM-DD 형식을 사용해 주세요.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터 조회 중 오류가 발생했습니다: {str(e)}")


@router.get("/analysis/stats")
async def get_market_analysis_stats(
    ticker: str = Query(..., description="조회할 지수 티커"),
    start_date: Optional[str] = Query(None, description="시작일 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="종료일 (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """특정 지수의 연도별/월별 성과 통계(수익률, 지수, MDD)를 조회합니다."""
    try:
        today = datetime.date.today()
        s_date = datetime.datetime.strptime(start_date, "%Y-%m-%d").date() if start_date else datetime.date(2020, 1, 1)
        e_date = datetime.datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else today
        
        service = MarketAnalysisService(db)
        return await service.get_monthly_and_yearly_stats(ticker, s_date, e_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="날짜 형식이 잘못되었습니다. YYYY-MM-DD 형식을 사용해 주세요.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"통계 조회 중 오류가 발생했습니다: {str(e)}")


@router.get("/analysis/comparison")
async def get_market_analysis_comparison(
    db: Session = Depends(get_db)
):
    """4대 지수의 연도별 수익률 비교 데이터를 조회합니다."""
    try:
        service = MarketAnalysisService(db)
        return await service.get_index_comparison_table()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"지수 비교 테이블 조회 중 오류가 발생했습니다: {str(e)}")


@router.get("/history", response_model=Dict[str, List[MarketHistoryItem]])
async def get_market_history(
    tickers: str = Query(..., description="조회할 지수 티커 (콤마로 구분, 예: ^KS11,^GSPC)"),
    start_date: Optional[str] = Query(None, description="시작일 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="종료일 (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """지정된 지수 티커들의 기간별 역사적 가격 및 실시간 현재가를 통합하여 조회합니다.

    Args:
        tickers (str): 콤마로 구분된 티커 목록.
        start_date (str, optional): 조회 시작일 (YYYY-MM-DD). 지정하지 않으면 30일 전.
        end_date (str, optional): 조회 종료일 (YYYY-MM-DD). 지정하지 않으면 오늘.
        db (Session): 데이터베이스 세션.

    Returns:
        Dict[str, List[MarketHistoryItem]]: 티커별 일자별 지수 데이터 매핑.
    """
    # 1. 날짜 범위 처리
    today = datetime.date.today()
    try:
        s_date = datetime.datetime.strptime(start_date, "%Y-%m-%d").date() if start_date else today - datetime.timedelta(days=30)
        e_date = datetime.datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else today
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="날짜 형식이 잘못되었습니다. YYYY-MM-DD 형식을 사용해 주세요."
        )

    # 2. 티커 리스트 파싱
    ticker_list = [t.strip() for t in tickers.split(",") if t.strip()]
    if not ticker_list:
        raise HTTPException(status_code=400, detail="유효한 티커가 입력되지 않았습니다.")

    benchmark_service = BenchmarkService(db)
    results = {}

    # 3. 각 티커별 데이터 조회 및 병합
    for ticker in ticker_list:
        # DB 캐시 데이터 로드 (필요시 yfinance fetch)
        db_prices = await benchmark_service.get_historical_prices(ticker, s_date, e_date)
        
        # 유효 종가만 필터링 (> 0.0)
        valid_prices = [p for p in db_prices if p.close_price > 0.0]
        
        # Response 형태로 변환
        history_items = [
            MarketHistoryItem(date=p.price_date.strftime("%Y-%m-%d"), close_price=p.close_price)
            for p in valid_prices
        ]

        # 4. 실시간 병합 처리
        # 오늘 날짜가 조회 기간 내에 있고, 오늘 날짜의 데이터가 DB에 없거나 종가가 0인 경우 실시간 시세 조회
        has_today_data = any(p.price_date == today for p in valid_prices)
        if s_date <= today <= e_date and not has_today_data:
            try:
                live_price_data = await benchmark_service.provider.get_current_price(ticker, force_update=True)
                last_price = float(live_price_data.get("current_price", 0.0))
                if last_price > 0.0:
                    history_items.append(MarketHistoryItem(
                        date=today.strftime("%Y-%m-%d"),
                        close_price=last_price
                    ))
            except Exception as e:
                print(f"[WARNING] {ticker} 실시간 가격 조회 실패: {e}")

        results[ticker] = history_items

    return results
