# -*- coding: utf-8 -*-
"""시장 지수 정보 및 거래소 휴장일 판정을 처리하는 라우터 모듈입니다.

코스피(KOSPI), 코스닥(KOSDAQ)의 현재 지수와 전일 대비 등락률을 조회하고,
한국거래소(KRX) 및 미국 뉴욕증시(NYSE)의 특정 일자 휴장일 여부를 판정합니다.
"""

import datetime
from typing import List, Optional
import yfinance as yf
import holidays
from fastapi import APIRouter, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/market", tags=["market"])

class MarketIndexItem(BaseModel):
    """시장 지수 정보를 나타내는 Pydantic 모델입니다.

    Attributes:
        index_name: 지수 명칭 (KOSPI 또는 KOSDAQ)
        current_price: 현재 지수 값
        change_rate: 전일 대비 등락률 (%)
    """
    index_name: str = Field(..., description="지수 명칭 (KOSPI 또는 KOSDAQ)")
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

# 공휴일 명칭의 한글 변환을 위한 매핑 딕셔너리
HOLIDAY_NAME_MAP = {
    # 한국 공휴일
    "New Year's Day": "신정",
    "Alternative holiday for New Year's Day": "신정 대체공휴일",
    "Lunar New Year's Day": "설날 연휴",
    "Alternative holiday for Lunar New Year's Day": "설날 대체공휴일",
    "Independence Movement Day": "삼일절",
    "Alternative holiday for Independence Movement Day": "삼일절 대체공휴일",
    "Labor Day": "근로자의 날",
    "Children's Day": "어린이날",
    "Alternative holiday for Children's Day": "어린이날 대체공휴일",
    "Buddha's Birthday": "부처님오신날",
    "Alternative holiday for Buddha's Birthday": "부처님오신날 대체공휴일",
    "Memorial Day": "현충일",
    "Constitution Day": "제헌절",  # 한국 주식시장은 제헌절에 휴장하지 않지만 holidays 라이브러리에 의해 체크될 수 있으므로 보정
    "Liberation Day": "광복절",
    "Alternative holiday for Liberation Day": "광복절 대체공휴일",
    "Chuseok": "추석 연휴",
    "Alternative holiday for Chuseok": "추석 대체공휴일",
    "National Foundation Day": "개천절",
    "Alternative holiday for National Foundation Day": "개천절 대체공휴일",
    "Hangeul Day": "한글날",
    "Alternative holiday for Hangeul Day": "한글날 대체공휴일",
    "Christmas Day": "성탄절",
    "Alternative holiday for Christmas Day": "성탄절 대체공휴일",
    
    # 미국 공휴일 (NYSE)
    "Martin Luther King Jr. Day": "마틴 루터 킹 주니어 추모일",
    "Martin Luther King, Jr. Day": "마틴 루터 킹 주니어 추모일",
    "Washington's Birthday": "대통령의 날",
    "Presidents' Day": "대통령의 날",
    "Good Friday": "성금요일",
    "Juneteenth National Independence Day": "준틴스 독립기념일",
    "Juneteenth": "준틴스 독립기념일",
    "Independence Day": "독립기념일",
    "Independence Day (observed)": "독립기념일 대체휴일",
    "Thanksgiving": "추수감사절",
    "Thanksgiving Day": "추수감사절",
}

def is_krx_year_end_holiday(d: datetime.date) -> bool:
    """한국 거래소(KRX)의 연말 휴장일 여부를 판별합니다.

    한국 거래소의 연말 휴장일은 12월의 마지막 평일(영업일)입니다.

    Args:
        d (datetime.date): 검증 대상 날짜

    Returns:
        bool: 연말 휴장일인 경우 True, 그렇지 않으면 False
    """
    if d.month != 12:
        return False
        
    # 12월 31일의 요일 확인 (0: 월, 6: 일)
    dec31 = datetime.date(d.year, 12, 31)
    dec31_weekday = dec31.weekday()
    
    if dec31_weekday < 5:  # 월~금
        target_date = dec31
    elif dec31_weekday == 5:  # 토요일
        target_date = datetime.date(d.year, 12, 30)
    else:  # 일요일
        target_date = datetime.date(d.year, 12, 29)
        
    return d == target_date

@router.get("/indices", response_model=List[MarketIndexItem])
async def get_market_indices():
    """코스피(KOSPI) 및 코스닥(KOSDAQ)의 현재 지수와 전일 대비 등락률을 조회합니다.

    Returns:
        List[MarketIndexItem]: 코스피, 코스닥 지수 데이터 리스트
    """
    try:
        # yfinance 호출은 스레드풀에서 수행하여 비동기 블로킹 방지
        tickers = await run_in_threadpool(yf.Tickers, "^KS11 ^KQ11")
        
        results = []
        for name, ticker_symbol in [("KOSPI", "^KS11"), ("KOSDAQ", "^KQ11")]:
            try:
                ticker = tickers.tickers[ticker_symbol]
                info = ticker.fast_info
                
                last_price = float(info.get('last_price', info.get('lastPrice', 0.0)))
                prev_close = float(
                    info.get('previous_close', 
                    info.get('previousClose', 
                    info.get('regular_market_previous_close', 
                    info.get('regularMarketPreviousClose', 0.0))))
                )
                
                change_rate = 0.0
                if prev_close > 0.0:
                    change_rate = round(((last_price / prev_close) - 1) * 100, 2)
                    
                results.append(MarketIndexItem(
                    index_name=name,
                    current_price=last_price,
                    change_rate=change_rate
                ))
            except Exception as e:
                print(f"[WARNING] {name} 지수 상세 파싱 실패: {e}")
                results.append(MarketIndexItem(
                    index_name=name,
                    current_price=0.0,
                    change_rate=0.0
                ))
        return results
    except Exception as e:
        print(f"[ERROR] 지수 데이터 가져오기 실패: {e}")
        # 오류 발생 시 기본값 반환
        return [
            MarketIndexItem(index_name="KOSPI", current_price=0.0, change_rate=0.0),
            MarketIndexItem(index_name="KOSDAQ", current_price=0.0, change_rate=0.0)
        ]

@router.get("/holiday", response_model=MarketHolidayResponse)
async def check_market_holiday(
    date: Optional[str] = Query(None, description="조회 대상 날짜 (YYYY-MM-DD)"),
    country: str = Query("KR", description="국가 코드 (KR 또는 US)")
):
    """특정 날짜의 주식 시장 휴장일 여부를 판정합니다.

    한국거래소(KRX) 또는 뉴욕증시(NYSE)의 휴장일 기준을 따릅니다.

    Args:
        date (str, optional): 조회할 날짜 (형식: YYYY-MM-DD). 지정하지 않으면 오늘 날짜 기준.
        country (str): 국가 코드 ('KR' 또는 'US', 대소문자 구분 없음).

    Returns:
        MarketHolidayResponse: 휴장 여부 및 사유 정보
    """
    # 1. 날짜 결정 및 파싱
    if not date:
        target_date = datetime.date.today()
    else:
        try:
            target_date = datetime.datetime.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="날짜 형식이 잘못되었습니다. YYYY-MM-DD 형식을 사용해 주세요."
            )
            
    # 2. 국가 코드 정규화 및 검증
    country_upper = country.upper()
    if country_upper not in ["KR", "US"]:
        raise HTTPException(
            status_code=400,
            detail="지원하지 않는 국가 코드입니다. KR 또는 US를 입력해 주세요."
        )

    # 3. 주말 판정 (토요일: 5, 일요일: 6)
    if target_date.weekday() >= 5:
        return MarketHolidayResponse(
            date=target_date.strftime("%Y-%m-%d"),
            country=country_upper,
            is_holiday=True,
            description="주말"
        )

    # 4. 국가별 거래소 공휴일 판정
    if country_upper == "KR":
        # 제헌절은 2008년부터 관공서 공휴일에서 제외되었으며 주식시장도 정상 영업하므로 제외
        # holidays 라이브러리에서 제헌절(Constitution Day)이 잡히는 경우 무시해야 함
        kr_holidays = holidays.SouthKorea(years=target_date.year)
        
        # 한국거래소 특수 휴장일 체크
        if target_date.month == 5 and target_date.day == 1:
            return MarketHolidayResponse(
                date=target_date.strftime("%Y-%m-%d"),
                country=country_upper,
                is_holiday=True,
                description="근로자의 날"
            )
            
        if is_krx_year_end_holiday(target_date):
            return MarketHolidayResponse(
                date=target_date.strftime("%Y-%m-%d"),
                country=country_upper,
                is_holiday=True,
                description="연말 휴장일"
            )

        # 일반 공휴일 여부 체크
        if target_date in kr_holidays:
            holiday_name = kr_holidays.get(target_date)
            # 제헌절인 경우 영업일로 판정
            if holiday_name in ["제헌절", "Constitution Day"]:
                return MarketHolidayResponse(
                    date=target_date.strftime("%Y-%m-%d"),
                    country=country_upper,
                    is_holiday=False,
                    description="영업일"
                )
            
            description = HOLIDAY_NAME_MAP.get(holiday_name, holiday_name)
            return MarketHolidayResponse(
                date=target_date.strftime("%Y-%m-%d"),
                country=country_upper,
                is_holiday=True,
                description=description
            )
            
    elif country_upper == "US":
        # 뉴욕 증시(NYSE) 휴장일 전용 객체 생성
        nyse_holidays = holidays.NYSE(years=target_date.year)
        
        if target_date in nyse_holidays:
            holiday_name = nyse_holidays.get(target_date)
            description = HOLIDAY_NAME_MAP.get(holiday_name, holiday_name)
            return MarketHolidayResponse(
                date=target_date.strftime("%Y-%m-%d"),
                country=country_upper,
                is_holiday=True,
                description=description
            )

    # 5. 영업일 반환
    return MarketHolidayResponse(
        date=target_date.strftime("%Y-%m-%d"),
        country=country_upper,
        is_holiday=False,
        description="영업일"
    )
