import asyncio
import yfinance as yf
from typing import List, Dict, Any, Optional
from fastapi.concurrency import run_in_threadpool
import datetime
import pytz

from src.kiwoom.api import KiwoomAPI
from src.kiwoom.auth import KiwoomAuthManager

class PriceService:
    """국내 및 해외 주식의 실시간 시세를 조회하는 서비스 클래스입니다."""

    def __init__(self):
        self.kiwoom_api = KiwoomAPI()
        self.kiwoom_auth = KiwoomAuthManager()

    def is_us_market_open(self) -> bool:
        """현재 뉴욕 현지 시각을 기준으로 미국 주식 시장이 개장 중인지 판별합니다."""
        eastern_tz = pytz.timezone('US/Eastern')
        now_est = datetime.datetime.now(eastern_tz)
        if now_est.weekday() >= 5:
            return False
        market_open = now_est.replace(hour=9, minute=30, second=0, microsecond=0)
        market_close = now_est.replace(hour=16, minute=0, second=0, microsecond=0)
        return market_open <= now_est <= market_close

    def is_kr_market_open(self) -> bool:
        """현재 한국 시각을 기준으로 한국 주식 시장이 개장 중인지 판별합니다."""
        seoul_tz = pytz.timezone('Asia/Seoul')
        now_kst = datetime.datetime.now(seoul_tz)
        if now_kst.weekday() >= 5:
            return False
        market_open = now_kst.replace(hour=9, minute=0, second=0, microsecond=0)
        market_close = now_kst.replace(hour=15, minute=30, second=0, microsecond=0)
        return market_open <= now_kst <= market_close

    async def get_kr_prices(self, codes: List[str], force_update: bool = False) -> List[Dict[str, Any]]:
        """키움 REST API를 통해 국내 주식 시세를 조회합니다.
        
        Args:
            codes (List[str]): 종목 코드 리스트
            force_update (bool): 강제 갱신 여부
            
        Returns:
            List[Dict[str, Any]]: [{stock_code, current_price, change_rate}]
        """
        if not codes:
            return []
            
        results = []
        market_open = self.is_kr_market_open()
        codes_to_fetch = []

        from src.backend.database import SessionLocal
        from src.backend.models import HistoricalPrice

        # 1. 장외 시간이고 강제 업데이트가 아니며 DB에 최근 시세가 있는 경우 로컬 캐시 사용
        with SessionLocal() as db:
            for code in codes:
                db_price = None
                if not force_update and not market_open:
                    db_price = (
                        db.query(HistoricalPrice)
                        .filter(
                            HistoricalPrice.ticker == code,
                            HistoricalPrice.close_price > 0.0,
                            HistoricalPrice.price_date <= datetime.date.today()
                        )
                        .order_by(HistoricalPrice.price_date.desc())
                        .first()
                    )

                if db_price:
                    results.append({
                        "stock_code": code,
                        "current_price": db_price.close_price,
                        "change_rate": 0.0
                    })
                else:
                    codes_to_fetch.append(code)

        # 2. 캐시가 없거나 장중이거나 강제 갱신이 필요한 종목만 키움 API 조회
        if codes_to_fetch:
            try:
                token = await self.kiwoom_auth.get_valid_token()
                batch_size = 50
                with SessionLocal() as db:
                    from sqlalchemy.dialects.sqlite import insert as sqlite_insert
                    for i in range(0, len(codes_to_fetch), batch_size):
                        batch = codes_to_fetch[i:i + batch_size]
                        res = await run_in_threadpool(self.kiwoom_api.get_bulk_stock_info, token, batch)
                        
                        if res and res.get("return_code") == 0:
                            outputs = res.get("atn_stk_infr", [])
                            for out in outputs:
                                code = out.get("stk_cd")
                                price_str = out.get("cur_prc", "0").strip("+-")
                                rate_str = out.get("flu_rt", "0").strip("+-")
                                
                                price_val = float(price_str) if price_str else 0.0
                                change_rate = float(rate_str) if rate_str else 0.0

                                results.append({
                                    "stock_code": code,
                                    "current_price": price_val,
                                    "change_rate": change_rate
                                })

                                # 장외 시간(장마감 최종 종가)인 경우에만 DB 캐시에 저장
                                if not market_open and price_val > 0.0:
                                    today = datetime.date.today()
                                    stmt = sqlite_insert(HistoricalPrice).values(
                                        ticker=code,
                                        price_date=today,
                                        close_price=price_val
                                    )
                                    stmt = stmt.on_conflict_do_update(
                                        index_elements=['ticker', 'price_date'],
                                        set_={'close_price': price_val}
                                    )
                                    db.execute(stmt)
                            
                            if not market_open:
                                db.commit()
                        else:
                            error_msg = res.get("return_msg") if res else "응답 없음"
                            print(f"[WARNING] 키움 API Bulk 조회 실패: {error_msg}")
                            for code in batch:
                                if not any(r['stock_code'] == code for r in results):
                                    results.append({"stock_code": code, "current_price": 0.0, "change_rate": 0.0})
            except Exception as e:
                print(f"[WARNING] 국내 주식 시세 조회 중 예외 발생: {e}")
                for code in codes_to_fetch:
                    if not any(r['stock_code'] == code for r in results):
                        results.append({"stock_code": code, "current_price": 0.0, "change_rate": 0.0})
                        
        return results

    async def get_us_prices(self, symbols: List[str], force_update: bool = False) -> List[Dict[str, Any]]:
        """yfinance를 통해 미국 주식 시세를 조회합니다.
        
        Args:
            symbols (List[str]): 티커 리스트
            force_update (bool): 강제 갱신 여부
            
        Returns:
            List[Dict[str, Any]]: [{stock_code, current_price, change_rate}]
        """
        if not symbols:
            return []
            
        results = []
        market_open = self.is_us_market_open()
        symbols_to_fetch = []

        from src.backend.database import SessionLocal
        from src.backend.models import HistoricalPrice

        # 1. 장외 시간이고 강제 업데이트가 아니며 DB에 최근 시세가 있는 경우 로컬 캐시 사용
        with SessionLocal() as db:
            for symbol in symbols:
                db_price = None
                if not force_update and not market_open:
                    db_price = (
                        db.query(HistoricalPrice)
                        .filter(
                            HistoricalPrice.ticker == symbol,
                            HistoricalPrice.close_price > 0.0,
                            HistoricalPrice.price_date <= datetime.date.today()
                        )
                        .order_by(HistoricalPrice.price_date.desc())
                        .first()
                    )

                if db_price:
                    results.append({
                        "stock_code": symbol,
                        "current_price": db_price.close_price,
                        "change_rate": 0.0
                    })
                else:
                    symbols_to_fetch.append(symbol)

        # 2. 캐시가 없거나 장중이거나 강제 갱신이 필요한 종목만 yfinance 조회
        if symbols_to_fetch:
            try:
                tickers = await run_in_threadpool(yf.Tickers, " ".join(symbols_to_fetch))
                
                with SessionLocal() as db:
                    from sqlalchemy.dialects.sqlite import insert as sqlite_insert
                    for symbol in symbols_to_fetch:
                        try:
                            ticker = tickers.tickers[symbol]
                            info = ticker.fast_info
                            last_price = float(info.get('last_price', info.get('lastPrice', 0)))
                            prev_close = float(
                                info.get('previous_close', 
                                info.get('previousClose', 
                                info.get('regular_market_previous_close', 
                                info.get('regularMarketPreviousClose', 0))))
                            )
                            
                            change_rate = 0.0
                            if prev_close > 0:
                                change_rate = round(((last_price / prev_close) - 1) * 100, 2)
                            
                            results.append({
                                "stock_code": symbol,
                                "current_price": last_price,
                                "change_rate": change_rate
                            })

                            # 장외 시간(장마감 최종 종가)인 경우에만 DB 캐시에 저장
                            if not market_open:
                                today = datetime.date.today()
                                stmt = sqlite_insert(HistoricalPrice).values(
                                    ticker=symbol,
                                    price_date=today,
                                    close_price=last_price
                                )
                                stmt = stmt.on_conflict_do_update(
                                    index_elements=['ticker', 'price_date'],
                                    set_={'close_price': last_price}
                                )
                                db.execute(stmt)
                        except Exception:
                            results.append({"stock_code": symbol, "current_price": 0.0, "change_rate": 0.0})
                    
                    if not market_open:
                        db.commit()
            except Exception as e:
                print(f"[WARNING] 미국 주식 시세 조회 중 예외 발생: {e}")
                for symbol in symbols_to_fetch:
                    if not any(r['stock_code'] == symbol for r in results):
                        results.append({"stock_code": symbol, "current_price": 0.0, "change_rate": 0.0})
            
        return results

    async def get_kr_historical_price(self, code: str, qry_dt: str) -> float:
        """키움 REST API를 통해 특정 일자의 국내 주식 종가를 조회합니다.
        
        Args:
            code (str): 종목 코드
            qry_dt (str): 조회일자 (YYYYMMDD 또는 YYYY-MM-DD 형식)
            
        Returns:
            float: 종가 (조회 실패 시 0.0)
        """
        try:
            # YYYY-MM-DD 형식을 YYYYMMDD로 통일
            clean_dt = qry_dt.replace("-", "")
            token = await self.kiwoom_auth.get_valid_token()
            res = await run_in_threadpool(self.kiwoom_api.get_historical_stock_price, token, code, clean_dt)
            if res and res.get("return_code") == 0:
                daly_stkpc = res.get("daly_stkpc", [])
                if daly_stkpc:
                    for day_data in daly_stkpc:
                        resp_date = day_data.get("date", "").replace("-", "")
                        if resp_date == clean_dt:
                            price_str = day_data.get("close_pric", "0").strip("+- ")
                            return float(price_str) if price_str else 0.0
                    
                    # 일치하는 날짜가 없으면 첫 번째 데이터의 종가 사용
                    price_str = daly_stkpc[0].get("close_pric", "0").strip("+- ")
                    return float(price_str) if price_str else 0.0
            else:
                error_msg = res.get("return_msg") if res else "응답 없음"
                print(f"[WARNING] 키움 API 일별 주가 조회 실패: {error_msg}")
        except Exception as e:
            print(f"[WARNING] 국내 주식 일별 주가 조회 중 예외 발생: {e}")
        return 0.0

    async def get_us_historical_price(self, symbol: str, qry_dt: str) -> float:
        """yfinance를 통해 특정 일자의 미국 주식 종가를 조회합니다.
        
        Args:
            symbol (str): 티커
            qry_dt (str): 조회일자 (YYYYMMDD 또는 YYYY-MM-DD 형식)
            
        Returns:
            float: 종가 (조회 실패 시 0.0)
        """
        try:
            # yfinance 포맷에 맞게 YYYY-MM-DD로 변환
            clean_dt = qry_dt.replace("-", "")
            if len(clean_dt) == 8:
                formatted_date = f"{clean_dt[:4]}-{clean_dt[4:6]}-{clean_dt[6:]}"
            else:
                formatted_date = qry_dt
            
            import datetime
            dt = datetime.datetime.strptime(formatted_date, "%Y-%m-%d")
            # 조회일 기준 5일 전부터 조회일 당일(까지 포함되도록 +1일) 조회
            start_date = (dt - datetime.timedelta(days=5)).strftime("%Y-%m-%d")
            end_date = (dt + datetime.timedelta(days=1)).strftime("%Y-%m-%d")
            
            ticker = await run_in_threadpool(yf.Ticker, symbol)
            hist = await run_in_threadpool(ticker.history, start=start_date, end=end_date)
            if not hist.empty:
                return float(hist['Close'].iloc[-1])
        except Exception as e:
            print(f"[WARNING] 미국 주식 일별 주가 조회 중 예외 발생 ({symbol}): {e}")
        return 0.0

    async def get_stock_name(self, ticker: str, country: str) -> Optional[str]:
        """국가 및 티커를 기준으로 공식 종목명을 조회합니다.
        
        Args:
            ticker (str): 종목 코드 또는 티커
            country (str): 국가 ('KR' 또는 'US')
            
        Returns:
            Optional[str]: 종목명 (조회 실패 시 None)
        """
        if country == "KR":
            try:
                token = await self.kiwoom_auth.get_valid_token()
                res = await run_in_threadpool(self.kiwoom_api.get_stock_info, token, ticker)
                if res and res.get("return_code") == 0:
                    name = res.get("stk_nm") or res.get("nm") or res.get("name") or res.get("hname")
                    if name:
                        return name.strip()
            except Exception as e:
                print(f"[WARNING] 국내 종목명 조회 실패: {e}")
        elif country == "US":
            try:
                stock = await run_in_threadpool(yf.Ticker, ticker)
                info = await run_in_threadpool(getattr, stock, "info")
                name = info.get("longName") or info.get("shortName")
                if name:
                    return name.strip()
            except Exception as e:
                print(f"[WARNING] 미국 종목명 조회 실패 ({ticker}): {e}")
        return None



# 싱글톤 인스턴스
price_service = PriceService()
