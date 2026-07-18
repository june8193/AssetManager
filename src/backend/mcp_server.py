# -*- coding: utf-8 -*-
"""AssetManager 백엔드 서비스와 통신하는 독립형 MCP(Model Context Protocol) Stdio 서버입니다.

이 서버는 FastAPI 서버 기동 여부와 관계없이 로컬 데이터베이스 및 내부 서비스를 직접 활용하여
AI 에이전트(Asset-jun-bot)에게 실시간 자산 데이터를 구조화된 JSON 형태로 제공합니다.
"""

import asyncio
import datetime
import re
from typing import Optional, List, Dict, Any

from fastmcp import FastMCP
from sqlalchemy.orm import joinedload

# 데이터베이스 및 서비스 모델 임포트
from src.backend.database import SessionLocal
from src.backend.models import Watchlist, Transaction, Stock
from src.backend.services.dashboard_service import DashboardService
from src.backend.services.ratio_service import RatioService
from src.backend.services.portfolio_service import get_portfolio_status as get_portfolio_status_service
from src.backend.services.price_service import price_service
from src.backend.services.benchmark_service import BenchmarkService

# MCP 서버 객체 생성
mcp = FastMCP("AssetManager")

@mcp.tool()
async def get_asset_summary() -> dict:
    """총자산 요약 정보(총 평가자산, 원금, 수익, 누적 수익률 등)를 조회합니다.

    Returns:
        dict: 자산 요약 결과 데이터
    """
    db = SessionLocal()
    try:
        service = DashboardService(db)
        # force_update=False를 적용하여 빠르게 캐시 데이터에서 가져옴 (A안)
        summary = await service.get_dashboard_summary(force_update=False)
        return summary
    except Exception as e:
        return {"error": f"자산 요약 조회 중 오류 발생: {str(e)}"}
    finally:
        db.close()

@mcp.tool()
async def get_asset_ratios() -> dict:
    """자산 대분류 및 소분류별 비중 현황과 리밸런싱 가이드 정보를 조회합니다.

    Returns:
        dict: 자산 비중 비율 및 투자 계산 가이드 데이터
    """
    db = SessionLocal()
    try:
        service = RatioService(db)
        # 기본 추가 투자금은 0원으로 하여 비중 계산
        result = await service.calculate_rebalancing(additional_cash=0.0)
        return result
    except Exception as e:
        return {"error": f"자산 비중 조회 중 오류 발생: {str(e)}"}
    finally:
        db.close()

@mcp.tool()
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
            # p가 Pydantic 모델인 경우와 딕셔너리인 경우 모두 대응
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

@mcp.tool()
async def get_portfolio_status(date: Optional[str] = None) -> dict:
    """보유하고 있는 계좌별 주식 종목 리스트, 보유 수량, 평가 금액 및 현금 잔고를 조회합니다.

    Args:
        date (str, optional): 조회 기준일 (Format: YYYY-MM-DD), 생략 시 현재일 기준.

    Returns:
        dict: 포트폴리오 상태 보고서 데이터
    """
    db = SessionLocal()
    try:
        if date:
            try:
                datetime.date.fromisoformat(date)
            except ValueError:
                return {"error": "날짜 형식이 잘못되었습니다. YYYY-MM-DD 형식을 사용해 주세요."}

        status = await get_portfolio_status_service(db, date)
        return status
    except Exception as e:
        return {"error": f"포트폴리오 상태 조회 중 오류 발생: {str(e)}"}
    finally:
        db.close()

@mcp.tool()
async def get_yearly_stats() -> dict:
    """연도별 순 투자 원금 추가액, 투자 수익, 연말 자산 평가액 및 연간 수익률 통계를 조회합니다.

    Returns:
        dict: 연도별 투자 수익률 통계 목록
    """
    db = SessionLocal()
    try:
        service = DashboardService(db)
        stats = service.get_yearly_stats()
        return {"stats": stats}
    except Exception as e:
        return {"error": f"연도별 통계 조회 중 오류 발생: {str(e)}"}
    finally:
        db.close()

@mcp.tool()
async def get_daily_stats(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    all_data: bool = False
) -> dict:
    """일자별 순 원금 증감, 일일 투자 수익 및 자산 총액 변동 추이 목록을 조회합니다.

    Args:
        start_date (str, optional): 조회 시작일 (YYYY-MM-DD)
        end_date (str, optional): 조회 종료일 (YYYY-MM-DD)
        all_data (bool): 전체 데이터를 가져올지 여부 (기본값 False)

    Returns:
        dict: 일자별 자산 및 수익률 흐름 통계
    """
    db = SessionLocal()
    try:
        s_date = datetime.date.fromisoformat(start_date) if start_date else None
        e_date = datetime.date.fromisoformat(end_date) if end_date else None

        service = DashboardService(db)
        stats = service.get_daily_stats(start_date=s_date, end_date=e_date, all_data=all_data)
        return {"stats": stats}
    except ValueError:
        return {"error": "날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식을 이용해 주세요."}
    except Exception as e:
        return {"error": f"일자별 통계 조회 중 오류 발생: {str(e)}"}
    finally:
        db.close()

@mcp.tool()
async def get_snapshots(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    all_data: bool = False
) -> dict:
    """계좌별 자산 잔액 기록 스냅샷 데이터 이력을 조회합니다.

    Args:
        start_date (str, optional): 조회 시작일 (YYYY-MM-DD)
        end_date (str, optional): 조회 종료일 (YYYY-MM-DD)
        all_data (bool): 전체 스냅샷 이력을 가져올지 여부 (기본값 False)

    Returns:
        dict: 계좌 스냅샷 이력
    """
    db = SessionLocal()
    try:
        s_date = datetime.date.fromisoformat(start_date) if start_date else None
        e_date = datetime.date.fromisoformat(end_date) if end_date else None

        service = DashboardService(db)
        data = service.get_snapshots(start_date=s_date, end_date=e_date, all_data=all_data)
        return data
    except ValueError:
        return {"error": "날짜 형식이 잘못되었습니다. YYYY-MM-DD 형식을 사용해주세요."}
    except Exception as e:
        return {"error": f"스냅샷 이력 조회 중 오류 발생: {str(e)}"}
    finally:
        db.close()

@mcp.tool()
async def get_transactions(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> dict:
    """전체 거래 및 리밸런싱 관련 매수/매도 거래 내역 목록을 조회합니다.

    Args:
        start_date (str, optional): 조회 시작일 (YYYY-MM-DD)
        end_date (str, optional): 조회 종료일 (YYYY-MM-DD)

    Returns:
        dict: 일자 정렬된 상세 거래 내역 목록
    """
    db = SessionLocal()
    try:
        query = db.query(Transaction).options(joinedload(Transaction.asset))
        if start_date:
            query = query.filter(Transaction.transaction_date >= datetime.date.fromisoformat(start_date))
        if end_date:
            query = query.filter(Transaction.transaction_date <= datetime.date.fromisoformat(end_date))

        transactions = query.order_by(Transaction.transaction_date.desc()).all()

        formatted = []
        for t in transactions:
            formatted.append({
                "id": t.id,
                "account_id": t.account_id,
                "asset_id": t.asset_id,
                "transaction_date": t.transaction_date.strftime("%Y-%m-%d"),
                "type": t.type,
                "quantity": t.quantity,
                "price": t.price,
                "total_amount": t.total_amount,
                "currency": t.currency,
                "exchange_rate": t.exchange_rate,
                "memo": t.memo,
                "asset_name": t.asset.name if t.asset else None,
                "asset_ticker": t.asset.ticker if t.asset else None,
            })

        return {"transactions": formatted}
    except ValueError:
        return {"error": "날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식을 활용해 주세요."}
    except Exception as e:
        return {"error": f"거래 내역 조회 중 오류 발생: {str(e)}"}
    finally:
        db.close()

@mcp.tool()
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

@mcp.tool()
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

@mcp.tool()
async def refresh_market_prices() -> dict:
    """모든 시장 지수, 보유 자산 및 관심 종목의 시세 데이터를 수동으로 즉시 최신화합니다.

    Returns:
        dict: 시세 최신화 결과 메시지
    """
    try:
        # 백그라운드 시세 업데이트 실행
        await price_service.update_all_market_prices()
        return {
            "status": "success",
            "message": f"성공적으로 모든 시장 지수 및 자산의 주가를 최신 상태로 동기화했습니다. (동기화 완료: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')})"
        }
    except Exception as e:
        return {"status": "error", "message": f"수동 시세 최신화 중 오류 발생: {str(e)}"}

if __name__ == "__main__":
    mcp.run()
