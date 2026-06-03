import datetime
import asyncio
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session, joinedload
from fastapi.concurrency import run_in_threadpool

from src.backend.models import SectorETF, CustomSector, CustomSectorStock, HistoricalPrice, Watchlist
from src.backend.services.price_service import price_service
from src.backend.services.benchmark_service import BenchmarkService

class SectorService:
    """대표 ETF 및 커스텀 섹터를 관리하고 수익률 및 성과 비교 데이터를 연산하는 서비스 클래스입니다."""

    def __init__(self, db: Session):
        """SectorService를 초기화합니다.
        
        Args:
            db (Session): 데이터베이스 세션 객체
        """
        self.db = db
        self.benchmark_svc = BenchmarkService(db)

    # --- 대표 ETF 관리 기능 ---

    async def add_sector_etf(self, ticker: str, name: Optional[str] = None, country: str = "KR") -> SectorETF:
        """새로운 대표 ETF를 등록합니다.
        
        Args:
            ticker (str): ETF 종목코드 또는 티커
            name (str, optional): ETF 이름. 누락 시 API를 통해 조회.
            country (str): 국가 구분 ('KR' 또는 'US')
            
        Returns:
            SectorETF: 등록된 ETF 객체
        """
        # 중복 체크
        exists = self.db.query(SectorETF).filter(SectorETF.ticker == ticker).first()
        if exists:
            return exists

        # 이름 자동 조회
        if not name:
            fetched_name = await price_service.get_stock_name(ticker, country)
            name = fetched_name if fetched_name else f"ETF ({ticker})"

        etf = SectorETF(ticker=ticker, name=name, country=country)
        self.db.add(etf)
        self.db.commit()
        self.db.refresh(etf)
        return etf

    async def get_sector_etfs(self, country: str = "KR") -> List[SectorETF]:
        """해당 국가의 모든 대표 ETF 목록을 조회합니다.
        
        Args:
            country (str): 국가 구분 ('KR' 또는 'US')
            
        Returns:
            List[SectorETF]: ETF 목록
        """
        return self.db.query(SectorETF).filter(SectorETF.country == country).all()

    async def delete_sector_etf(self, ticker: str) -> bool:
        """등록된 대표 ETF를 삭제합니다.
        
        Args:
            ticker (str): 삭제할 ETF의 티커/종목코드
            
        Returns:
            bool: 삭제 성공 여부
        """
        etf = self.db.query(SectorETF).filter(SectorETF.ticker == ticker).first()
        if etf:
            self.db.delete(etf)
            self.db.commit()
            return True
        return False

    # --- 커스텀 섹터 관리 기능 ---

    async def create_custom_sector(self, name: str, country: str = "KR") -> CustomSector:
        """새로운 커스텀 섹터를 생성합니다.
        
        Args:
            name (str): 섹터 명
            country (str): 국가 구분 ('KR' 또는 'US')
            
        Returns:
            CustomSector: 생성된 커스텀 섹터 객체
        """
        sector = CustomSector(name=name, country=country)
        self.db.add(sector)
        self.db.commit()
        self.db.refresh(sector)
        return sector

    async def get_custom_sectors(self, country: str = "KR") -> List[CustomSector]:
        """해당 국가의 커스텀 섹터 목록을 하위 소속 종목 정보와 함께 조회합니다.
        
        Args:
            country (str): 국가 구분 ('KR' 또는 'US')
            
        Returns:
            List[CustomSector]: 커스텀 섹터 목록
        """
        return (
            self.db.query(CustomSector)
            .filter(CustomSector.country == country)
            .options(joinedload(CustomSector.stocks))
            .all()
        )

    async def delete_custom_sector(self, sector_id: int) -> bool:
        """커스텀 섹터를 삭제합니다. (하위 소속 종목은 CASCADE 삭제됨)
        
        Args:
            sector_id (int): 삭제할 섹터 ID
            
        Returns:
            bool: 삭제 성공 여부
        """
        sector = self.db.query(CustomSector).filter(CustomSector.id == sector_id).first()
        if sector:
            self.db.delete(sector)
            self.db.commit()
            return True
        return False

    async def update_custom_sector(self, sector_id: int, name: str) -> Optional[CustomSector]:
        """커스텀 섹터의 이름을 변경합니다.
        
        Args:
            sector_id (int): 변경할 섹터 ID
            name (str): 변경할 새 이름
            
        Returns:
            Optional[CustomSector]: 수정된 커스텀 섹터 객체 (없을 경우 None)
        """
        sector = self.db.query(CustomSector).filter(CustomSector.id == sector_id).first()
        if sector:
            sector.name = name
            self.db.commit()
            self.db.refresh(sector)
            return sector
        return None

    # --- 커스텀 섹터 소속 종목 관리 기능 ---

    async def fetch_shares_outstanding(self, ticker: str, country: str) -> float:
        """종목코드 및 국가를 기준으로 발행주식수를 비동기로 수집합니다.
        
        Args:
            ticker (str): 종목코드 / 티커
            country (str): 국가 구분 ('KR' 또는 'US')
            
        Returns:
            float: 발행주식수 (실패 시 0.0)
        """
        if country == "KR":
            try:
                from src.kiwoom.api import KiwoomAPI
                from src.kiwoom.auth import KiwoomAuthManager
                api = KiwoomAPI()
                auth = KiwoomAuthManager()
                token = await auth.get_valid_token()
                res = await run_in_threadpool(api.get_stock_info, token, ticker)
                if res and res.get("return_code") == 0:
                    flo_stk = float(res.get("flo_stk", "0"))
                    return flo_stk * 10.0
            except Exception as e:
                print(f"[WARNING] 국내 주식 발행주식수 조회 실패 ({ticker}): {e}")
            return 0.0
        else:  # US
            try:
                import yfinance as yf
                ticker_obj = await run_in_threadpool(yf.Ticker, ticker)
                info = await run_in_threadpool(getattr, ticker_obj, "info")
                return float(info.get("sharesOutstanding", 0.0))
            except Exception as e:
                print(f"[WARNING] 미국 주식 발행주식수 조회 실패 ({ticker}): {e}")
            return 0.0

    async def add_stock_to_sector(
        self, 
        sector_id: int, 
        stock_code: str, 
        stock_name: Optional[str] = None, 
        shares_outstanding: Optional[float] = None
    ) -> CustomSectorStock:
        """커스텀 섹터에 종목을 추가합니다.
        
        Args:
            sector_id (int): 대상 섹터 ID
            stock_code (str): 추가할 종목코드 / 티커
            stock_name (str, optional): 종목명. 누락 시 API 자동 조회.
            shares_outstanding (float, optional): 발행주식수. 누락 시 API 자동 조회.
            
        Returns:
            CustomSectorStock: 추가된 종목 객체
        """
        # 섹터 존재 및 국가 확인
        sector = self.db.query(CustomSector).filter(CustomSector.id == sector_id).first()
        if not sector:
            raise ValueError(f"존재하지 않는 섹터 ID 입니다: {sector_id}")

        # 중복 체크
        exists = (
            self.db.query(CustomSectorStock)
            .filter(
                CustomSectorStock.sector_id == sector_id,
                CustomSectorStock.stock_code == stock_code
            )
            .first()
        )
        if exists:
            return exists

        # 이름 및 발행주식수 자동 수집
        if not stock_name:
            fetched_name = await price_service.get_stock_name(stock_code, sector.country)
            stock_name = fetched_name if fetched_name else f"Stock ({stock_code})"
            
        if shares_outstanding is None:
            shares_outstanding = await self.fetch_shares_outstanding(stock_code, sector.country)

        stock = CustomSectorStock(
            sector_id=sector_id,
            stock_code=stock_code,
            stock_name=stock_name,
            shares_outstanding=shares_outstanding
        )
        self.db.add(stock)
        self.db.commit()
        self.db.refresh(stock)
        return stock

    async def delete_stock_from_sector(self, sector_id: int, stock_code: str) -> bool:
        """섹터 내의 종목을 제거합니다.
        
        Args:
            sector_id (int): 대상 섹터 ID
            stock_code (str): 제거할 종목코드
            
        Returns:
            bool: 제거 성공 여부
        """
        stock = (
            self.db.query(CustomSectorStock)
            .filter(
                CustomSectorStock.sector_id == sector_id,
                CustomSectorStock.stock_code == stock_code
            )
            .first()
        )
        if stock:
            self.db.delete(stock)
            self.db.commit()
            return True
        return False

    # --- 수익률 및 대시보드 연산 기능 ---

    def _get_date_range(self, period: str, start_date: Optional[datetime.date] = None, end_date: Optional[datetime.date] = None) -> tuple[datetime.date, datetime.date]:
        """선택된 조회 기간에 맞는 실제 시작일과 종료일(오늘)을 계산합니다.
        
        Args:
            period (str): 기간 ('YTD', '1W', '1M', '3M', '6M', 'Custom')
            start_date (date, optional): Custom 시 시작일
            end_date (date, optional): Custom 시 종료일
            
        Returns:
            tuple[date, date]: (시작일, 종료일)
        """
        today = datetime.date.today()
        if period == "Custom":
            if not start_date or not end_date:
                raise ValueError("사용자 지정(Custom) 기간 선택 시 시작일과 종료일은 필수입니다.")
            return start_date, end_date
            
        if period == "YTD":
            s_date = datetime.date(today.year, 1, 1)
        elif period == "1W":
            s_date = today - datetime.timedelta(days=7)
        elif period == "1M":
            s_date = today - datetime.timedelta(days=30)
        elif period == "3M":
            s_date = today - datetime.timedelta(days=90)
        elif period == "6M":
            s_date = today - datetime.timedelta(days=180)
        else:
            s_date = datetime.date(today.year, 1, 1)
            
        return s_date, today

    async def get_sector_dashboard_data(
        self, 
        country: str, 
        period: str, 
        compare_index: str,
        start_date: Optional[datetime.date] = None,
        end_date: Optional[datetime.date] = None
    ) -> Dict[str, Any]:
        """주어진 파라미터에 부합하는 섹터 분석 대시보드 통합 데이터를 산출합니다.
        
        Args:
            country (str): 국가 구분 ('KR' 또는 'US')
            period (str): 조회 기간
            compare_index (str): 비교 대상 주요 지수 티커
            start_date (date, optional): 사용자 지정 시작일
            end_date (date, optional): 사용자 지정 종료일
            
        Returns:
            Dict[str, Any]: 주요 지수, 대표 ETF, 커스텀 섹터의 성과 정보 맵
        """
        start, end = self._get_date_range(period, start_date, end_date)
        
        # 1. 탭별 주요 지수 및 비교 지수 설정
        if country == "KR":
            indices = ["^KS11", "^KQ11"]
        else:  # US
            indices = ["^GSPC", "^IXIC"]
            
        if compare_index not in indices:
            # 기본 지수로 보정
            compare_index = indices[0]

        # 2. 주요 지수 시세 수집 및 수익률 계산
        index_returns = {}
        for ticker in indices:
            prices = await self.benchmark_svc.get_historical_prices(ticker, start, end)
            valid = [p for p in prices if p.close_price > 0.0]
            if len(valid) >= 2:
                base = valid[0].close_price
                last = valid[-1].close_price
                ret = ((last - base) / base) * 100
                index_returns[ticker] = {
                    "current": last,
                    "return_rate": round(ret, 2)
                }
            elif len(valid) == 1:
                index_returns[ticker] = {
                    "current": valid[0].close_price,
                    "return_rate": 0.0
                }
            else:
                index_returns[ticker] = {
                    "current": 0.0,
                    "return_rate": 0.0
                }
                
        # 비교 기준 지수 수익률 획득
        ref_return = index_returns.get(compare_index, {}).get("return_rate", 0.0)

        # 3. 대표 ETF 수익률 및 랭킹 연산
        etfs = await self.get_sector_etfs(country)
        etf_results = []
        
        for etf in etfs:
            prices = await self.benchmark_svc.get_historical_prices(etf.ticker, start, end)
            valid = [p for p in prices if p.close_price > 0.0]
            
            ret_rate = 0.0
            current_price = 0.0
            if len(valid) >= 2:
                base = valid[0].close_price
                current_price = valid[-1].close_price
                ret_rate = round(((current_price - base) / base) * 100, 2)
            elif len(valid) == 1:
                current_price = valid[0].close_price
                
            alpha = round(ret_rate - ref_return, 2)
            judgment = "시장 상회" if alpha >= 0 else "시장 하회"
            
            etf_results.append({
                "ticker": etf.ticker,
                "name": etf.name,
                "current_price": current_price,
                "return_rate": ret_rate,
                "alpha": alpha,
                "judgment": judgment
            })
            
        # 수익률 내림차순 정렬 및 랭킹 부여
        etf_results.sort(key=lambda x: x["return_rate"], reverse=True)
        for i, item in enumerate(etf_results, 1):
            item["rank"] = i

        # 4. 커스텀 섹터 시가총액 가중 수익률 및 랭킹 연산
        sectors = await self.get_custom_sectors(country)
        sector_results = []
        
        for sec in sectors:
            if not sec.stocks:
                sector_results.append({
                    "id": sec.id,
                    "name": sec.name,
                    "stock_count": 0,
                    "return_rate": 0.0,
                    "alpha": round(0.0 - ref_return, 2),
                    "judgment": "시장 상회" if (0.0 - ref_return) >= 0 else "시장 하회",
                    "stocks": []
                })
                continue
                
            # 섹터에 소속된 모든 종목의 시세 데이터 조회
            stock_prices_map = {}
            all_dates = set()
            
            for stock in sec.stocks:
                # yfinance/키움 가격 동기화 보장
                prices = await self.benchmark_svc.get_historical_prices(stock.stock_code, start, end)
                valid_prices = {p.price_date: p.close_price for p in prices if p.close_price > 0.0}
                stock_prices_map[stock.stock_code] = valid_prices
                all_dates.update(valid_prices.keys())
                
            # 영업일 정렬
            sorted_dates = sorted(list(all_dates))
            
            ret_rate = 0.0
            sec_stocks_data = []
            if len(sorted_dates) >= 2:
                # 시작일과 종료일의 합산 시가총액 계산
                d_start = sorted_dates[0]
                d_end = sorted_dates[-1]
                
                cap_start = 0.0
                cap_end = 0.0
                
                # 각 종목별로 시작일/종료일의 가격을 가져와 시가총액을 합산
                # (Forward Fill로 결측값 보완)
                for stock in sec.stocks:
                    shares = stock.shares_outstanding
                    prices_dict = stock_prices_map.get(stock.stock_code, {})
                    
                    # 시작가
                    p_start = prices_dict.get(d_start, 0.0)
                    if p_start <= 0.0:
                        # 이전 가장 최근 가격 조회
                        prev_p = (
                            self.db.query(HistoricalPrice)
                            .filter(
                                HistoricalPrice.ticker == stock.stock_code,
                                HistoricalPrice.price_date < d_start,
                                HistoricalPrice.close_price > 0.0
                            )
                            .order_by(HistoricalPrice.price_date.desc())
                            .first()
                        )
                        p_start = prev_p.close_price if prev_p else 0.0
                        
                    # 종료가
                    p_end = prices_dict.get(d_end, 0.0)
                    if p_end <= 0.0:
                        # 이전 가장 최근 가격 조회
                        prev_p = (
                            self.db.query(HistoricalPrice)
                            .filter(
                                HistoricalPrice.ticker == stock.stock_code,
                                HistoricalPrice.price_date < d_end,
                                HistoricalPrice.close_price > 0.0
                            )
                            .order_by(HistoricalPrice.price_date.desc())
                            .first()
                        )
                        p_end = prev_p.close_price if prev_p else 0.0
                        
                    cap_start += p_start * shares
                    cap_end += p_end * shares

                    # 개별 종목 수익률 및 알파 계산
                    stk_return = 0.0
                    if p_start > 0.0:
                        stk_return = round(((p_end - p_start) / p_start) * 100, 2)
                    stk_alpha = round(stk_return - ref_return, 2)

                    sec_stocks_data.append({
                        "stock_code": stock.stock_code,
                        "stock_name": stock.stock_name,
                        "shares_outstanding": stock.shares_outstanding,
                        "return_rate": stk_return,
                        "alpha": stk_alpha
                    })
                    
                if cap_start > 0.0:
                    ret_rate = round(((cap_end - cap_start) / cap_start) * 100, 2)
            else:
                # 영업일이 부족하여 연산 불가 시 기본값 처리
                for stock in sec.stocks:
                    sec_stocks_data.append({
                        "stock_code": stock.stock_code,
                        "stock_name": stock.stock_name,
                        "shares_outstanding": stock.shares_outstanding,
                        "return_rate": 0.0,
                        "alpha": round(0.0 - ref_return, 2)
                    })
            
            alpha = round(ret_rate - ref_return, 2)
            judgment = "시장 상회" if alpha >= 0 else "시장 하회"

            
            sector_results.append({
                "id": sec.id,
                "name": sec.name,
                "stock_count": len(sec.stocks),
                "return_rate": ret_rate,
                "alpha": alpha,
                "judgment": judgment,
                "stocks": sec_stocks_data
            })
            
        # 수익률 내림차순 정렬 및 랭킹 부여
        sector_results.sort(key=lambda x: x["return_rate"], reverse=True)
        for i, item in enumerate(sector_results, 1):
            item["rank"] = i

        # 5. 관심종목 단순 종가 수익률 및 랭킹 연산
        watchlist_items = self.db.query(Watchlist).filter(Watchlist.country == country).all()
        watchlist_results = []
        
        for item in watchlist_items:
            prices = await self.benchmark_svc.get_historical_prices(item.stock_code, start, end)
            valid = [p for p in prices if p.close_price > 0.0]
            
            ret_rate = 0.0
            current_price = 0.0
            if len(valid) >= 2:
                base = valid[0].close_price
                current_price = valid[-1].close_price
                ret_rate = round(((current_price - base) / base) * 100, 2)
            elif len(valid) == 1:
                current_price = valid[0].close_price
                
            alpha = round(ret_rate - ref_return, 2)
            judgment = "시장 상회" if alpha >= 0 else "시장 하회"
            
            watchlist_results.append({
                "ticker": item.stock_code,
                "name": item.stock_name,
                "current_price": current_price,
                "return_rate": ret_rate,
                "alpha": alpha,
                "judgment": judgment
            })
            
        # 수익률 내림차순 정렬 및 랭킹 부여
        watchlist_results.sort(key=lambda x: x["return_rate"], reverse=True)
        for i, item in enumerate(watchlist_results, 1):
            item["rank"] = i

        return {
            "period": period,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "compare_index": compare_index,
            "index_returns": index_returns,
            "etfs": etf_results,
            "custom_sectors": sector_results,
            "watchlist": watchlist_results
        }
