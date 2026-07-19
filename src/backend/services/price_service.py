import asyncio
import yfinance as yf
from typing import List, Dict, Any, Optional
from fastapi.concurrency import run_in_threadpool
import datetime
import pytz
import holidays

from src.kiwoom.api import KiwoomAPI
from src.kiwoom.auth import KiwoomAuthManager

class PriceService:
    """국내 및 해외 주식의 실시간 시세를 조회하는 서비스 클래스입니다."""

    def __init__(self):
        self.kiwoom_api = KiwoomAPI()
        self.kiwoom_auth = KiwoomAuthManager()
        self.last_manual_refresh_time: Optional[datetime.datetime] = None


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
                # yfinance의 index(Timestamp)를 YYYYMMDD 문자열로 변환하여 요청일과 비교
                last_trade_date = hist.index[-1].strftime("%Y%m%d")
                if last_trade_date == clean_dt:
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

    async def get_historical_prices_with_cache(
        self,
        db,
        ticker: str,
        start_date: datetime.date,
        end_date: datetime.date,
        country: str
    ) -> List[Dict[str, Any]]:
        """DB 캐시를 활용하여 특정 기간의 주가(종가) 리스트를 조회합니다.

        Args:
            db (Session): SQLAlchemy 데이터베이스 세션
            ticker (str): 종목 코드 혹은 티커
            start_date (datetime.date): 조회 시작일
            end_date (datetime.date): 조회 종료일
            country (str): 국가 구분 ('KR' 또는 'US')

        Returns:
            List[Dict[str, Any]]: [{price_date: datetime.date, close_price: float}] 형식의 리스트 (날짜 오름차순)
        """
        from src.backend.models import HistoricalPrice
        from sqlalchemy.dialects.sqlite import insert as sqlite_insert

        # 1. DB에서 캐싱된 데이터를 먼저 조회
        db_prices = (
            db.query(HistoricalPrice)
            .filter(
                HistoricalPrice.ticker == ticker,
                HistoricalPrice.price_date >= start_date,
                HistoricalPrice.price_date <= end_date
            )
            .order_by(HistoricalPrice.price_date.asc())
            .all()
        )

        # 2. 조회 기간 내 영업일(평일) 생성
        current = start_date
        weekdays = []
        while current <= end_date:
            if current.weekday() < 5:  # 월 ~ 금
                weekdays.append(current)
            current += datetime.timedelta(days=1)

        # 캐싱된 날짜 집합
        cached_dates = {p.price_date for p in db_prices}

        # 오늘 날짜
        today = datetime.date.today()

        # 오늘이 평일이고 조회 범위에 포함되어 있으며, 장중인 경우 오늘 날짜는 캐시 미적용 대상
        is_market_open = False
        if country == "KR":
            is_market_open = self.is_kr_market_open()
        elif country == "US":
            is_market_open = self.is_us_market_open()

        # 장중인 오늘의 날짜는 누락된 날짜 판별 시 캐시 누락으로 취급하여 실시간 조회하도록 함
        # 단, 과거 데이터 중 누락된 날짜만 찾기 위해 오늘을 제외한 누락 영업일을 계산
        missing_dates = []
        for d in weekdays:
            if d == today and is_market_open:
                continue
            if d not in cached_dates:
                missing_dates.append(d)

        # 3. 과거 데이터 중 누락된 날짜가 있다면 외부 API로부터 일괄 조회 후 캐싱
        if missing_dates:
            try:
                if country == "US":
                    # yfinance로 조회
                    yf_start = start_date.strftime("%Y-%m-%d")
                    yf_end = (end_date + datetime.timedelta(days=1)).strftime("%Y-%m-%d")
                    ticker_obj = await run_in_threadpool(yf.Ticker, ticker)
                    hist = await run_in_threadpool(ticker_obj.history, start=yf_start, end=yf_end)

                    if not hist.empty:
                        for idx, row in hist.iterrows():
                            p_date = idx.date()
                            close_p = float(row["Close"])
                            if close_p > 0:
                                # 오늘 날짜이고 장중인 경우에는 DB 캐싱 건너뜀
                                if p_date == today and is_market_open:
                                    continue
                                stmt = sqlite_insert(HistoricalPrice).values(
                                    ticker=ticker,
                                    price_date=p_date,
                                    close_price=close_p
                                )
                                stmt = stmt.on_conflict_do_update(
                                    index_elements=["ticker", "price_date"],
                                    set_={"close_price": close_p}
                                )
                                db.execute(stmt)
                        db.commit()
                elif country == "KR":
                    # 키움 API로 조회
                    token = await self.kiwoom_auth.get_valid_token()
                    clean_dt = end_date.strftime("%Y%m%d")
                    res = await run_in_threadpool(self.kiwoom_api.get_historical_stock_price, token, ticker, clean_dt)

                    if res and res.get("return_code") == 0:
                        daly_stkpc = res.get("daly_stkpc", [])
                        for day_data in daly_stkpc:
                            date_str = day_data.get("date", "").replace("-", "")
                            if len(date_str) == 8:
                                p_date = datetime.datetime.strptime(date_str, "%Y%m%d").date()
                                # 조회 기간 내의 데이터만 캐싱
                                if start_date <= p_date <= end_date:
                                    price_str = day_data.get("close_pric", "0").strip("+- ")
                                    close_p = float(price_str) if price_str else 0.0
                                    if close_p > 0:
                                        if p_date == today and is_market_open:
                                            continue
                                        stmt = sqlite_insert(HistoricalPrice).values(
                                            ticker=ticker,
                                            price_date=p_date,
                                            close_price=close_p
                                        )
                                        stmt = stmt.on_conflict_do_update(
                                            index_elements=["ticker", "price_date"],
                                            set_={"close_price": close_p}
                                        )
                                        db.execute(stmt)
                        db.commit()
            except Exception as e:
                print(f"[WARNING] {country} 주식 과거 데이터 조회 및 캐싱 중 예외 발생: {e}")

        # 4. 장중이고 조회 기간에 오늘이 포함된 경우 실시간 가격 추가 반영
        today_price_info = None
        if today in weekdays and is_market_open:
            try:
                if country == "KR":
                    real_prices = await self.get_kr_prices([ticker], force_update=True)
                    if real_prices and real_prices[0]["current_price"] > 0:
                        today_price_info = {
                            "price_date": today,
                            "close_price": real_prices[0]["current_price"]
                        }
                elif country == "US":
                    real_prices = await self.get_us_prices([ticker], force_update=True)
                    if real_prices and real_prices[0]["current_price"] > 0:
                        today_price_info = {
                            "price_date": today,
                            "close_price": real_prices[0]["current_price"]
                        }
            except Exception as e:
                print(f"[WARNING] 장중 실시간 주가 조회 실패: {e}")

        # 5. 최종 결과 조회 및 포맷팅
        db_prices = (
            db.query(HistoricalPrice)
            .filter(
                HistoricalPrice.ticker == ticker,
                HistoricalPrice.price_date >= start_date,
                HistoricalPrice.price_date <= end_date
            )
            .order_by(HistoricalPrice.price_date.asc())
            .all()
        )

        results = []
        for p in db_prices:
            # 장중 오늘 가격은 캐시 대신 실시간 조회된 값으로 덮어씀
            if p.price_date == today and today_price_info:
                results.append({
                    "price_date": p.price_date,
                    "close_price": today_price_info["close_price"]
                })
                today_price_info = None  # 중복 추가 방지
            else:
                results.append({
                    "price_date": p.price_date,
                    "close_price": p.close_price
                })

        # 만약 장중 오늘 가격이 DB에 아직 없어서 위 루프에서 추가되지 않았다면 맨 뒤에 추가
        if today_price_info:
            results.append({
                "price_date": today_price_info["price_date"],
                "close_price": today_price_info["close_price"]
            })

        # 날짜 순 정렬
        results.sort(key=lambda x: x["price_date"])

        return results

    def get_market_holiday_info(self, target_date: datetime.date, country: str) -> Optional[str]:
        """지정된 날짜가 해당 국가 주식 시장의 휴장일(주말 또는 공휴일)인 경우 휴장 사유를 반환합니다.
        
        영업일인 경우 None을 반환합니다.
        
        Args:
            target_date (datetime.date): 판별 대상 날짜
            country (str): 국가 코드 ('KR' 또는 'US')
            
        Returns:
            Optional[str]: 휴장 사유 또는 None
        """
        import holidays
        country_upper = country.upper()

        # 1. 주말 판정 (토요일: 5, 일요일: 6)
        if target_date.weekday() >= 5:
            return "주말"

        # 2. 국가별 공휴일 판정
        if country_upper == "KR":
            # 한국거래소 연말 휴장일 판정용 로컬 헬퍼
            def is_krx_year_end_holiday(d: datetime.date) -> bool:
                if d.month != 12:
                    return False
                dec31 = datetime.date(d.year, 12, 31)
                dec31_weekday = dec31.weekday()
                if dec31_weekday < 5:
                    target_date = dec31
                elif dec31_weekday == 5:
                    target_date = datetime.date(d.year, 12, 30)
                else:
                    target_date = datetime.date(d.year, 12, 29)
                return d == target_date

            kr_holidays = holidays.SouthKorea(years=target_date.year)
            
            # 근로자의 날
            if target_date.month == 5 and target_date.day == 1:
                return "근로자의 날"
                
            # 연말 휴장일
            if is_krx_year_end_holiday(target_date):
                return "연말 휴장일"

            # 일반 공휴일 여부
            if target_date in kr_holidays:
                holiday_name = kr_holidays.get(target_date)
                # 제헌절인 경우 영업함
                if holiday_name in ["제헌절", "Constitution Day"]:
                    return None
                
                # market.py의 HOLIDAY_NAME_MAP에 해당하는 변환
                holiday_name_map = {
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
                }
                return holiday_name_map.get(holiday_name, holiday_name)

        elif country_upper == "US":
            nyse_holidays = holidays.NYSE(years=target_date.year)
            if target_date in nyse_holidays:
                holiday_name = nyse_holidays.get(target_date)
                holiday_name_map = {
                    "New Year's Day": "신정",
                    "Alternative holiday for New Year's Day": "신정 대체공휴일",
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
                    "Christmas Day": "성탄절",
                    "Alternative holiday for Christmas Day": "성탄절 대체공휴일",
                }
                return holiday_name_map.get(holiday_name, holiday_name)

        return None

    def _get_today(self) -> datetime.date:
        """오늘 날짜를 반환합니다. 테스트 시 모킹 편의성을 위해 분리되었습니다."""
        return datetime.date.today()

    def is_market_holiday(self, target_date: datetime.date, country: str) -> bool:
        """지정된 날짜가 해당 국가 주식 시장의 휴장일(주말 또는 공휴일)인지 판별합니다.
        
        Args:
            target_date (datetime.date): 판별 대상 날짜
            country (str): 국가 코드 ('KR' 또는 'US')
            
        Returns:
            bool: 휴장일인 경우 True, 그렇지 않으면 False
        """
        return self.get_market_holiday_info(target_date, country) is not None

    async def update_all_market_prices(self):
        """1시간마다 지수, 보유 자산, 관심 종목의 시세를 외부 API로부터 조회하여 DB를 업데이트합니다."""
        from src.backend.database import SessionLocal
        from src.backend.models import Asset, Watchlist, HistoricalPrice
        from sqlalchemy.dialects.sqlite import insert as sqlite_insert

        today = self._get_today()
        is_kr_holiday = self.is_market_holiday(today, "KR")
        is_us_holiday = self.is_market_holiday(today, "US")

        # 둘 다 휴장일이면 전체 건너뜀
        if is_kr_holiday and is_us_holiday:
            print(f"[INFO] {today} 날짜는 한국과 미국 모두 휴장일입니다. 백그라운드 시세 업데이트를 생략합니다.")
            return

        with SessionLocal() as db:
            # 1. 4대 지수 목록
            # 한국 지수: KOSPI(^KS11), KOSDAQ(^KQ11)
            # 미국 지수: S&P 500(^GSPC), NASDAQ(^IXIC)
            kr_indices = ["^KS11", "^KQ11"]
            us_indices = ["^GSPC", "^IXIC"]

            # 2. 보유 자산 중 현금이 아닌 주식/ETF 등의 티커 조회
            # major_category != '현금'
            db_assets = db.query(Asset).filter(Asset.major_category != "현금").all()
            
            # 3. 관심종목 조회
            db_watchlist = db.query(Watchlist).all()

        # 국가 및 휴장 여부에 따라 업데이트 대상 코드 분류
        kr_codes = set()
        us_symbols = set()

        # 한국 지수 추가 (한국 휴장일이 아닐 때만)
        if not is_kr_holiday:
            for ticker in kr_indices:
                us_symbols.add(ticker)  # 지수는 yfinance(get_us_prices)로 조회하므로 us_symbols에 포함시킴

        # 미국 지수 추가 (미국 휴장일이 아닐 때만)
        if not is_us_holiday:
            for ticker in us_indices:
                us_symbols.add(ticker)

        # 보유 자산 분류
        for asset in db_assets:
            if asset.country == "KR":
                if not is_kr_holiday:
                    kr_codes.add(asset.ticker)
            elif asset.country == "US":
                if not is_us_holiday:
                    us_symbols.add(asset.ticker)

        # 관심종목 분류
        for item in db_watchlist:
            if item.country == "KR":
                if not is_kr_holiday:
                    kr_codes.add(item.stock_code)
            elif item.country == "US":
                if not is_us_holiday:
                    us_symbols.add(item.stock_code)

        # 한국 주식 시세 업데이트
        kr_codes_list = list(kr_codes)
        if kr_codes_list:
            try:
                print(f"[INFO] 한국 주식 시세 조회 중... (대상 개수: {len(kr_codes_list)})")
                # force_update=True로 실시간 시세를 획득
                kr_prices = await self.get_kr_prices(kr_codes_list, force_update=True)
                
                # 강제로 오늘 날짜의 HistoricalPrice에 저장
                with SessionLocal() as db:
                    for p in kr_prices:
                        code = p["stock_code"]
                        price_val = p["current_price"]
                        if price_val > 0.0:
                            stmt = sqlite_insert(HistoricalPrice).values(
                                ticker=code,
                                price_date=today,
                                close_price=price_val,
                                updated_at=datetime.datetime.now()
                            )
                            stmt = stmt.on_conflict_do_update(
                                index_elements=['ticker', 'price_date'],
                                set_={
                                    'close_price': price_val,
                                    'updated_at': datetime.datetime.now()
                                }
                            )
                            db.execute(stmt)
                    db.commit()
            except Exception as e:
                print(f"[ERROR] 한국 주식 백그라운드 시세 업데이트 실패: {e}")

        # 미국 주식 및 지수 시세 업데이트
        us_symbols_list = list(us_symbols)
        if us_symbols_list:
            try:
                print(f"[INFO] 미국 주식 및 지수 시세 조회 중... (대상 개수: {len(us_symbols_list)})")
                us_prices = await self.get_us_prices(us_symbols_list, force_update=True)
                
                with SessionLocal() as db:
                    for p in us_prices:
                        symbol = p["stock_code"]
                        price_val = p["current_price"]
                        if price_val > 0.0:
                            stmt = sqlite_insert(HistoricalPrice).values(
                                ticker=symbol,
                                price_date=today,
                                close_price=price_val,
                                updated_at=datetime.datetime.now()
                            )
                            stmt = stmt.on_conflict_do_update(
                                index_elements=['ticker', 'price_date'],
                                set_={
                                    'close_price': price_val,
                                    'updated_at': datetime.datetime.now()
                                }
                            )
                            db.execute(stmt)
                    db.commit()
            except Exception as e:
                print(f"[ERROR] 미국 주식/지수 백그라운드 시세 업데이트 실패: {e}")


# 싱글톤 인스턴스
price_service = PriceService()

