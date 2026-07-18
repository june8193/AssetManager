# -*- coding: utf-8 -*-
"""관심종목, 시장 지수 및 개별 주식의 가격 조회/동기화를 위한 MCP 도구 함수 모음입니다.
"""

import datetime
import re
from typing import Optional

from src.backend.database import SessionLocal
from src.backend.models import Watchlist, Stock
from src.backend.services.price_service import price_service
from src.backend.services.benchmark_service import BenchmarkService

async def get_watchlist_prices(country: str = "KR") -> dict:
    """등록된 관심종목의 현재가 및 전일 대비 등락률 목록을 조회합니다.

    Args:
        country (str): 국가 구분 (KR 또는 US), 기본값 KR.

    Returns:
        dict: 관심종목 시세 목록
    """
    db = SessionLocal()
    try:
        upper_country = country.upper()
        items = db.query(Watchlist).filter(Watchlist.country == upper_country).all()
        if not items:
            return {"country": upper_country, "prices": []}

        codes = [item.stock_code for item in items]
        name_map = {item.stock_code: item.stock_name for item in items}

        if upper_country == "US":
            prices = await price_service.get_us_prices(codes)
        else:
            prices = await price_service.get_kr_prices(codes)

        result_prices = []
        for p in prices:
            code = getattr(p, "stock_code", None) or p.get("stock_code")
            curr_price = getattr(p, "current_price", None) or p.get("current_price")
            chg_rate = getattr(p, "change_rate", None) or p.get("change_rate")

            result_prices.append({
                "stock_name": name_map.get(code, ""),
                "stock_code": code,
                "current_price": curr_price,
                "change_rate": chg_rate
            })

        return {"country": upper_country, "prices": result_prices}
    except Exception as e:
        return {"error": f"관심종목 시세 조회 중 오류 발생: {str(e)}"}
    finally:
        db.close()

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
    db = SessionLocal()
    try:
        today = datetime.date.today()
        s_date = datetime.datetime.strptime(start_date, "%Y-%m-%d").date() if start_date else today - datetime.timedelta(days=30)
        e_date = datetime.datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else today

        ticker_list = [t.strip() for t in tickers.split(",") if t.strip()]
        if not ticker_list:
            return {"error": "유효한 티커가 입력되지 않았습니다."}

        benchmark_service = BenchmarkService(db)
        results = {}

        for ticker in ticker_list:
            db_prices = await benchmark_service.get_historical_prices(ticker, s_date, e_date)
            formatted = []
            for p in db_prices:
                formatted.append({
                    "date": p.price_date.strftime("%Y-%m-%d") if hasattr(p, "price_date") else p.get("price_date").strftime("%Y-%m-%d"),
                    "close_price": p.close_price if hasattr(p, "close_price") else p.get("close_price")
                })
            results[ticker] = formatted

        return results
    except ValueError:
        return {"error": "날짜 형식이 잘못되었습니다. YYYY-MM-DD 형식을 사용해 주세요."}
    except Exception as e:
        return {"error": f"지수 이력 조회 중 오류 발생: {str(e)}"}
    finally:
        db.close()

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
    db = SessionLocal()
    try:
        start_dt = datetime.datetime.strptime(start_date, "%Y-%m-%d").date()
        end_dt = datetime.datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else datetime.date.today()

        if start_dt > end_dt:
            return {"error": "시작일이 종료일보다 늦을 수 없습니다."}

        country = "US"
        if re.match(r"^\d{6}$", ticker):
            country = "KR"
        else:
            db_stock = db.query(Stock).filter(Stock.stock_code == ticker).first()
            if db_stock:
                country = "KR"

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
    except ValueError:
        return {"error": "날짜 형식이 잘못되었습니다. YYYY-MM-DD 형식을 사용해 주세요."}
    except Exception as e:
        return {"error": f"개별 주가 조회 중 오류 발생: {str(e)}"}
    finally:
        db.close()

async def refresh_market_prices() -> dict:
    """모든 시장 지수, 보유 자산 및 관심 종목의 시세 데이터를 수동으로 즉시 최신화합니다.

    Returns:
        dict: 시세 최신화 결과 메시지
    """
    try:
        await price_service.update_all_market_prices()
        return {
            "status": "success",
            "message": f"성공적으로 모든 시장 지수 및 자산의 주가를 최신 상태로 동기화했습니다. (동기화 완료: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')})"
        }
    except Exception as e:
        return {"status": "error", "message": f"수동 시세 최신화 중 오류 발생: {str(e)}"}
