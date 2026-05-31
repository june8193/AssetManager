import datetime
import asyncio
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.dialects.sqlite import insert
import yfinance as yf
from fastapi.concurrency import run_in_threadpool
import pandas as pd

from src.backend.models import HistoricalPrice, AccountSnapshot, Asset, Stock


class BenchmarkService:
    """포트폴리오 수익률과 시장 주요 지수 및 관심 종목의 성과를 비교 분석하는 서비스 클래스입니다."""

    def __init__(self, db: Session):
        """BenchmarkService를 초기화합니다.

        Args:
            db (Session): 데이터베이스 세션 객체
        """
        self.db = db

    async def get_historical_prices(self, ticker: str, start_date: datetime.date, end_date: datetime.date) -> List[HistoricalPrice]:
        """지정된 기간 동안의 티커 가격 데이터를 가져옵니다.

        로컬 DB 캐시에 데이터가 없거나 오래된 경우 yfinance에서 가져와 캐싱합니다.

        Args:
            ticker (str): 자산 티커 (예: '^KS11', 'AAPL')
            start_date (date): 시작일
            end_date (date): 종료일

        Returns:
            List[HistoricalPrice]: 역사적 가격 객체 리스트
        """
        # 1. DB에서 먼저 조회
        db_prices = (
            self.db.query(HistoricalPrice)
            .filter(
                HistoricalPrice.ticker == ticker,
                HistoricalPrice.price_date >= start_date,
                HistoricalPrice.price_date <= end_date
            )
            .order_by(HistoricalPrice.price_date.asc())
            .all()
        )

        # 2. 캐시 보완 여부 판단
        needs_fetch = False
        if not db_prices:
            needs_fetch = True
        else:
            latest_date = db_prices[-1].price_date
            today = datetime.date.today()
            effective_end = min(end_date, today)
            
            # 마지막 저장 날짜가 요청 종료일보다 3일 이상 전이면 fetch (주말/휴장 고려)
            if latest_date < effective_end - datetime.timedelta(days=3):
                needs_fetch = True
            
            # 최초 저장 날짜가 요청 시작일보다 늦되, 그 차이가 7일을 초과하는 경우에만 fetch 필요 (휴장/주말 고려)
            first_date = db_prices[0].price_date
            if first_date - start_date > datetime.timedelta(days=7):
                needs_fetch = True

        if needs_fetch:
            await self._fetch_and_cache(ticker, start_date, end_date)
            # 캐싱 후 DB에서 재조회
            db_prices = (
                self.db.query(HistoricalPrice)
                .filter(
                    HistoricalPrice.ticker == ticker,
                    HistoricalPrice.price_date >= start_date,
                    HistoricalPrice.price_date <= end_date
                )
                .order_by(HistoricalPrice.price_date.asc())
                .all()
            )

        return db_prices

    async def _fetch_and_cache(self, ticker: str, start_date: datetime.date, end_date: datetime.date):
        """yfinance에서 데이터를 다운로드하여 DB에 적재합니다.

        비영업일(주말, 공휴일)은 직전 영업일의 종가를 그대로 사용하는 Forward Fill 방식으로 채웁니다.

        Args:
            ticker (str): 자산 티커
            start_date (date): 시작일
            end_date (date): 종료일
        """
        yf_ticker = ticker
        
        # 1. 국내 주식 티커 변환 처리 (6자리 숫자)
        if ticker.isdigit() and len(ticker) == 6:
            # 주식 마스터(stocks) 테이블에서 KOSDAQ인지 KOSPI인지 판단
            stock = self.db.query(Stock).filter(Stock.stock_code == ticker).first()
            if stock and "KOSDAQ" in stock.market:
                yf_ticker = f"{ticker}.KQ"
            else:
                yf_ticker = f"{ticker}.KS"

        # yfinance download는 블로킹이므로 threadpool에서 실행
        try:
            # yfinance는 시작일의 가격 변화를 제대로 계산하기 위해 며칠 앞당겨 조회
            delta_start = start_date - datetime.timedelta(days=10)
            delta_end = end_date + datetime.timedelta(days=2)
            query_start = delta_start.strftime("%Y-%m-%d")
            query_end = delta_end.strftime("%Y-%m-%d")
            
            df = await run_in_threadpool(
                yf.download, 
                yf_ticker, 
                start=query_start, 
                end=query_end, 
                progress=False
            )
            
            if df.empty:
                return

            # MultiIndex 컬럼 대응 (yf.download 결과 대응)
            close_col = 'Close'
            if isinstance(df.columns, pd.MultiIndex):
                if 'Close' in df.columns.levels[0]:
                    close_col = ('Close', yf_ticker)

            # 다운로드된 데이터의 날짜별 맵핑 작성
            price_map = {}
            for date_stamp, row in df.iterrows():
                p_date = date_stamp.date()
                try:
                    val = float(row[close_col])
                    if not pd.isna(val):
                        price_map[p_date] = val
                except (KeyError, ValueError):
                    continue

            # query_start부터 query_end까지 하루씩 증가하며 데이터 저장 (오늘 이전인 경우만 저장하며, 비영업일은 0.0으로 저장)
            curr_date = delta_start
            today = datetime.date.today()
            while curr_date <= delta_end:
                val_to_save = 0.0
                if curr_date in price_map:
                    val_to_save = price_map[curr_date]

                if curr_date <= today:
                    # sqlite insert ignore 구현
                    stmt = insert(HistoricalPrice).values(
                        ticker=ticker,
                        price_date=curr_date,
                        close_price=val_to_save
                    )
                    stmt = stmt.on_conflict_do_nothing(index_elements=['ticker', 'price_date'])
                    self.db.execute(stmt)

                curr_date += datetime.timedelta(days=1)
            
            self.db.commit()
        except Exception as e:
            print(f"⚠️ yfinance 데이터 수집 실패 ({ticker} -> {yf_ticker}): {e}")

    async def calculate_cumulative_returns(self, start_date: datetime.date, end_date: datetime.date, tickers: List[str]) -> Dict[str, Any]:
        """포트폴리오와 시장 지수들의 정규화된 일별 누적 수익률(%) 및 초과수익률을 계산합니다.

        Args:
            start_date (date): 분석 시작일
            end_date (date): 분석 종료일
            tickers (List[str]): 지수 티커 리스트

        Returns:
            Dict[str, Any]: 차트 및 테이블 렌더링용 요약 데이터
        """
        # 1. 지수 데이터 수집 및 캐싱 보장
        tasks = [self.get_historical_prices(t, start_date, end_date) for t in tickers]
        prices_by_ticker = {}
        results = await asyncio.gather(*tasks)
        for t, prices in zip(tickers, results):
            prices_by_ticker[t] = prices

        # 2. X축 날짜(영업일 labels) 생성
        # 지수 데이터가 존재하는 영업일(가격 > 0.0) 날짜들의 합집합을 구한 뒤 정렬합니다.
        dates_set = set()
        for prices in prices_by_ticker.values():
            for p in prices:
                if p.close_price > 0.0:  # 휴장일(0.0)은 영업일 판단에서 제외
                    dates_set.add(p.price_date)
        
        # 시작~종료 범위 내 영업일 필터링 및 정렬
        sorted_dates = sorted([d for d in dates_set if start_date <= d <= end_date])
        if not sorted_dates:
            return {"labels": [], "datasets": [], "alpha_summaries": []}

        # 날짜 문자열 변환
        labels = [d.isoformat() for d in sorted_dates]

        # 3. 포트폴리오 일자별 평가액 및 입출금액 계산
        # 전체 계좌 스냅샷 조회
        snapshots = (
            self.db.query(AccountSnapshot)
            .filter(AccountSnapshot.snapshot_date >= start_date, AccountSnapshot.snapshot_date <= end_date)
            .order_by(AccountSnapshot.snapshot_date.asc())
            .all()
        )

        # 분석 기간 내의 모든 일자(비영업일 포함) 생성
        all_dates = []
        curr = start_date
        while curr <= end_date:
            all_dates.append(curr)
            curr += datetime.timedelta(days=1)

        # 날짜별 포트폴리오 총 평가액 및 입금액 계산
        snapshot_vals = {}
        snapshot_deposits = {}
        for s in snapshots:
            d = s.snapshot_date
            snapshot_vals[d] = snapshot_vals.get(d, 0.0) + s.total_valuation
            snapshot_deposits[d] = snapshot_deposits.get(d, 0.0) + s.period_deposit

        # 시작 영업일 직전의 초기 자산 찾기
        last_known_val = 0.0
        prev_snap = (
            self.db.query(AccountSnapshot)
            .filter(AccountSnapshot.snapshot_date < sorted_dates[0])
            .order_by(AccountSnapshot.snapshot_date.desc())
            .first()
        )
        if prev_snap:
            prev_date = prev_snap.snapshot_date
            last_known_val = sum(
                snap.total_valuation for snap in self.db.query(AccountSnapshot).filter_by(snapshot_date=prev_date).all()
            )

        daily_vals = {}
        daily_deposits = {}
        for d in all_dates:
            if d in snapshot_vals:
                last_known_val = snapshot_vals[d]
            daily_vals[d] = last_known_val
            daily_deposits[d] = snapshot_deposits.get(d, 0.0)

        # 일자별 누적 입금액 사전 빌드
        cumulative_deposits_map = {}
        running_dep = 0.0
        for d in all_dates:
            running_dep += daily_deposits[d]
            cumulative_deposits_map[d] = running_dep

        # 시작 영업일 직전까지의 누적 입금액 기준값 구하기
        cum_dep_start = 0.0
        prev_day = sorted_dates[0] - datetime.timedelta(days=1)
        if prev_day in cumulative_deposits_map:
            cum_dep_start = cumulative_deposits_map[prev_day]
        elif sorted_dates[0] in cumulative_deposits_map:
            cum_dep_start = cumulative_deposits_map[sorted_dates[0]] - daily_deposits[sorted_dates[0]]

        # 각 영업일별 누적 입금액(순입금액) 계산
        portfolio_history = []
        portfolio_net_deposits = []
        portfolio_has_snapshot = []

        for d in sorted_dates:
            net_dep = cumulative_deposits_map.get(d, 0.0) - cum_dep_start
            portfolio_history.append(daily_vals[d])
            portfolio_net_deposits.append(net_dep)
            portfolio_has_snapshot.append(d in snapshot_vals)

        # 4. 포트폴리오 누적 수익률 정규화 계산
        portfolio_returns = []
        base_val = portfolio_history[0]

        for i, val in enumerate(portfolio_history):
            if i == 0:
                portfolio_returns.append(0.0)
            else:
                # 해당 날짜에 스냅샷 데이터가 없으면 None을 채워 차트에서 연결선이 수평 평탄화되지 않도록 함
                if not portfolio_has_snapshot[i]:
                    portfolio_returns.append(None)
                    continue

                net_deposit = portfolio_net_deposits[i]
                denominator = base_val + net_deposit
                if denominator != 0:
                    roi = ((val - net_deposit - base_val) / denominator) * 100
                else:
                    roi = 0.0
                portfolio_returns.append(round(roi, 2))


        datasets = [
            {
                "label": "내 포트폴리오",
                "data": portfolio_returns,
                "borderColor": "#38bdf8",
                "backgroundColor": "rgba(56, 189, 248, 0.05)",
                "borderWidth": 3.5,
                "pointRadius": 3,
                "pointBackgroundColor": "#38bdf8",
                "tension": 0.15,
                "fill": True
            }
        ]

        # 5. 각 지수별 누적 수익률 정규화 계산
        index_colors = {
            "^KS11": "#fb7185", # KOSPI (Rose Red)
            "^KQ11": "#f472b6", # KOSDAQ (Pink)
            "^GSPC": "#34d399", # S&P 500 (Emerald)
            "^IXIC": "#a78bfa"  # NASDAQ (Violet)
        }
        index_names = {
            "^KS11": "KOSPI",
            "^KQ11": "KOSDAQ",
            "^GSPC": "S&P 500",
            "^IXIC": "NASDAQ"
        }

        alpha_summaries = []

        for ticker in tickers:
            prices = prices_by_ticker.get(ticker, [])
            price_map = {p.price_date: p.close_price for p in prices}
            
            # X축 영업일에 매칭하여 가격 리스트 구축 및 보간(Forward fill)
            ticker_prices = []
            last_price = 0.0
            
            # 시작일 직전의 가격 찾기
            if sorted_dates[0] in price_map and price_map[sorted_dates[0]] > 0.0:
                last_price = price_map[sorted_dates[0]]
            else:
                prev_price = (
                    self.db.query(HistoricalPrice)
                    .filter(
                        HistoricalPrice.ticker == ticker,
                        HistoricalPrice.price_date < sorted_dates[0],
                        HistoricalPrice.close_price > 0.0
                    )
                    .order_by(HistoricalPrice.price_date.desc())
                    .first()
                )
                if prev_price:
                    last_price = prev_price.close_price

            for d in sorted_dates:
                if d in price_map and price_map[d] > 0.0:
                    last_price = price_map[d]
                ticker_prices.append(last_price)

            # 누적 수익률 정규화 계산
            index_returns = []
            base_price = ticker_prices[0] if ticker_prices else 0.0

            for price in ticker_prices:
                if base_price != 0:
                    ret = ((price - base_price) / base_price) * 100
                else:
                    ret = 0.0
                index_returns.append(round(ret, 2))

            name = index_names.get(ticker, ticker)
            datasets.append({
                "label": name,
                "data": index_returns,
                "borderColor": index_colors.get(ticker, "#94a3b8"),
                "borderWidth": 1.5,
                "pointRadius": 0,
                "tension": 0.15
            })

            # 초과수익률 요약 정보 계산 (최종일 기준)
            # 최종일에 포트폴리오 스냅샷이 누락된 경우를 고려하여 가장 최근의 유효한(None이 아닌) 수익률을 사용합니다.
            p_final = 0.0
            if portfolio_returns:
                for val in reversed(portfolio_returns):
                    if val is not None:
                        p_final = val
                        break
            i_final = index_returns[-1] if index_returns else 0.0
            alpha = round(p_final - i_final, 2)
            judgment = "시장 상회" if alpha >= 0 else "시장 하회"

            alpha_summaries.append({
                "benchmark": name,
                "ticker": ticker,
                "benchmark_return": i_final,
                "portfolio_return": p_final,
                "alpha": alpha,
                "judgment": judgment
            })

        portfolio_final_valuation = portfolio_history[-1] if portfolio_history else 0.0
        return {
            "labels": labels,
            "datasets": datasets,
            "alpha_summaries": alpha_summaries,
            "portfolio_final_valuation": portfolio_final_valuation
        }

    async def get_watchlist_returns(self, ticker: str, start_date: datetime.date, end_date: datetime.date) -> Dict[str, Any]:
        """관심 종목의 과거 시계열 데이터를 조회하여 시작일 기준 정규화된 누적 수익률(%)을 반환합니다.

        Args:
            ticker (str): 관심 종목 코드/티커
            start_date (date): 시작일
            end_date (date): 종료일

        Returns:
            Dict[str, Any]: 정규화된 날짜(labels) 및 수익률(data) 딕셔너리
        """
        # 1. 시세 캐싱 및 조회
        prices = await self.get_historical_prices(ticker, start_date, end_date)
        price_map = {p.price_date: p.close_price for p in prices}

        # 2. 영업일 기준 날짜 정합 (KOSPI 영업일 기준 등으로 처리하기 위해 KOSPI 데이터를 가져옴)
        # 지수의 영업일 리스트를 X축 기준으로 삼습니다.
        kospi_prices = await self.get_historical_prices("^KS11", start_date, end_date)
        sorted_dates = sorted(list(set(p.price_date for p in kospi_prices if p.close_price > 0.0)))
        if not sorted_dates:
            sorted_dates = sorted(list(k for k, v in price_map.items() if v > 0.0))

        # 범위 필터링
        sorted_dates = [d for d in sorted_dates if start_date <= d <= end_date]
        if not sorted_dates:
            return {"ticker": ticker, "labels": [], "data": []}

        # 3. 영업일 기준 보간 및 수익률 계산
        returns = []
        ticker_prices = []
        last_price = 0.0

        if sorted_dates[0] in price_map and price_map[sorted_dates[0]] > 0.0:
            last_price = price_map[sorted_dates[0]]
        else:
            prev_price = (
                self.db.query(HistoricalPrice)
                .filter(
                    HistoricalPrice.ticker == ticker,
                    HistoricalPrice.price_date < sorted_dates[0],
                    HistoricalPrice.close_price > 0.0
                )
                .order_by(HistoricalPrice.price_date.desc())
                .first()
            )
            if prev_price:
                last_price = prev_price.close_price

        for d in sorted_dates:
            if d in price_map and price_map[d] > 0.0:
                last_price = price_map[d]
            ticker_prices.append(last_price)

        base_price = ticker_prices[0] if ticker_prices else 0.0

        for price in ticker_prices:
            if base_price != 0:
                ret = ((price - base_price) / base_price) * 100
            else:
                ret = 0.0
            returns.append(round(ret, 2))

        return {
            "ticker": ticker,
            "labels": [d.isoformat() for d in sorted_dates],
            "data": returns
        }

    async def get_ytd_return(self, ticker: str) -> float:
        """올해 1월 1일부터 오늘까지의 YTD 수익률(%)을 계산합니다.

        Args:
            ticker (str): 자산 티커

        Returns:
            float: YTD 수익률 (%)
        """
        return await self.get_period_return(ticker, "YTD")

    async def get_period_return(self, ticker: str, period: str) -> float:
        """지정된 기간 동안의 수익률(%)을 계산합니다.

        Args:
            ticker (str): 자산 티커
            period (str): 기간 ('YTD', '1M', '3M', '1Y')

        Returns:
            float: 기간별 수익률 (%)
        """
        today = datetime.date.today()
        if period == "YTD":
            start_date = datetime.date(today.year, 1, 1)
        elif period == "1M":
            start_date = today - datetime.timedelta(days=30)
        elif period == "3M":
            start_date = today - datetime.timedelta(days=90)
        elif period == "1Y":
            start_date = today - datetime.timedelta(days=365)
        else:
            start_date = datetime.date(today.year, 1, 1)

        prices = await self.get_historical_prices(ticker, start_date, today)
        # 휴장일(0.0)이 아닌 실질 영업일 시세만 필터링합니다.
        valid_prices = [p for p in prices if p.close_price > 0.0]
        if len(valid_prices) >= 2:
            base_price = valid_prices[0].close_price
            last_price = valid_prices[-1].close_price
            if base_price != 0:
                return round(((last_price - base_price) / base_price) * 100, 2)
        return 0.0


    async def get_comparison_tables(self) -> Dict[str, Any]:
        """포트폴리오와 4대 시장 지수의 연간 및 일간 수익률 비교 데이터를 계산합니다.

        대시보드와 동일한 표 구성을 지원하기 위해 포트폴리오의 연간/일간 성과 통계를 기반으로
        지수의 수익률을 매핑합니다.

        Returns:
            Dict[str, Any]: 연간 및 일간 비교 테이블 데이터
                - yearly (List[Dict]): 연간 비교 리스트 (최신 연도 순)
                - daily (List[Dict]): 일간 비교 리스트 (최신 일자 순)
        """
        from .dashboard_service import DashboardService
        dash_svc = DashboardService(self.db)
        
        # 1. 포트폴리오의 연도별, 일자별 데이터 로딩 (내림차순 정렬되어 반환됨)
        yearly_stats = dash_svc.get_yearly_stats()
        daily_stats = dash_svc.get_daily_stats()
        
        tickers = ["^KS11", "^KQ11", "^GSPC", "^IXIC"]
        ticker_names = {
            "^KS11": "kospi",
            "^KQ11": "kosdaq",
            "^GSPC": "sp500",
            "^IXIC": "nasdaq"
        }
        
        # 2. 일간 수익률 비교 계산
        daily_comparison = []
        if daily_stats:
            # 날짜 정렬 (오름차순)
            sorted_daily = sorted(daily_stats, key=lambda x: x["date"])
            sorted_dates = [item["date"] for item in sorted_daily]
            
            min_date = sorted_dates[0]
            max_date = sorted_dates[-1]
            
            # 4대 지수 전체 구간 시세 일괄 수집/캐싱 보장
            for ticker in tickers:
                await self.get_historical_prices(ticker, min_date, max_date)
                
            # DB 쿼리 부하 최소화를 위해 메모리에 가격 리스트 로드
            prices_cache = {}
            for ticker in tickers:
                # 시작일 이전 보간을 고려하여 여유있게 조회
                db_prices = (
                    self.db.query(HistoricalPrice)
                    .filter(
                        HistoricalPrice.ticker == ticker,
                        HistoricalPrice.price_date >= min_date - datetime.timedelta(days=10),
                        HistoricalPrice.price_date <= max_date,
                        HistoricalPrice.close_price > 0.0
                    )
                    .order_by(HistoricalPrice.price_date.asc())
                    .all()
                )
                prices_cache[ticker] = db_prices

            # 특정 날짜 이하의 가장 최근 유효 종가를 구하는 헬퍼 함수
            def get_cached_price_at_date(ticker: str, target_date: datetime.date) -> float:
                plist = prices_cache.get(ticker, [])
                last_val = 0.0
                for p in plist:
                    if p.price_date <= target_date:
                        last_val = p.close_price
                    else:
                        break
                return last_val

            # 일간 비교 데이터 매핑
            for i, item in enumerate(sorted_daily):
                curr_date = item["date"]
                row = {
                    "date": curr_date.isoformat(),
                    "assets": item["assets"],
                    "roi": item["roi"],
                    "kospi": 0.0,
                    "kosdaq": 0.0,
                    "sp500": 0.0,
                    "nasdaq": 0.0
                }
                
                if i > 0:
                    prev_date = sorted_dates[i-1]
                    for ticker in tickers:
                        p_prev = get_cached_price_at_date(ticker, prev_date)
                        p_curr = get_cached_price_at_date(ticker, curr_date)
                        name = ticker_names[ticker]
                        
                        if p_prev > 0.0:
                            ret = ((p_curr - p_prev) / p_prev) * 100
                            row[name] = round(ret, 2)
                        else:
                            row[name] = 0.0
                else:
                    # 최초 날짜는 변동률 0.0
                    for ticker in tickers:
                        name = ticker_names[ticker]
                        row[name] = 0.0
                        
                daily_comparison.append(row)
                
            # 최신순(내림차순) 정렬
            daily_comparison.reverse()

        # 3. 연간 수익률 비교 계산 (달력 기준)
        yearly_comparison = []
        if yearly_stats:
            # 연도별 정렬 (오름차순)
            sorted_yearly = sorted(yearly_stats, key=lambda x: x["year"])
            
            for item in sorted_yearly:
                year = item["year"]
                start_date = datetime.date(year, 1, 1)
                
                today = datetime.date.today()
                if year == today.year:
                    end_date = today
                else:
                    end_date = datetime.date(year, 12, 31)
                    
                row = {
                    "year": year,
                    "assets": item["assets"],
                    "roi": item["roi"],
                    "kospi": 0.0,
                    "kosdaq": 0.0,
                    "sp500": 0.0,
                    "nasdaq": 0.0
                }
                
                for ticker in tickers:
                    # 지수 가격 수집 및 로컬 캐시 갱신 보장
                    prices = await self.get_historical_prices(ticker, start_date, end_date)
                    valid_prices = [p for p in prices if p.close_price > 0.0]
                    name = ticker_names[ticker]
                    
                    if len(valid_prices) >= 2:
                        base_price = valid_prices[0].close_price
                        last_price = valid_prices[-1].close_price
                        if base_price > 0.0:
                            ret = ((last_price - base_price) / base_price) * 100
                            row[name] = round(ret, 2)
                    else:
                        row[name] = 0.0
                        
                yearly_comparison.append(row)
                
            # 최신순(내림차순) 정렬
            yearly_comparison.reverse()
            
        return {
            "yearly": yearly_comparison,
            "daily": daily_comparison
        }


