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

            # query_start부터 query_end까지 하루씩 증가하며 데이터 저장 (비영업일은 0.0으로 저장)
            curr_date = delta_start
            while curr_date <= delta_end:
                val_to_save = 0.0
                if curr_date in price_map:
                    val_to_save = price_map[curr_date]

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

        # 날짜별 포트폴리오 총 평가액 및 입금액 계산
        portfolio_vals = {}
        portfolio_deposits = {}
        for s in snapshots:
            d = s.snapshot_date
            portfolio_vals[d] = portfolio_vals.get(d, 0.0) + s.total_valuation
            portfolio_deposits[d] = portfolio_deposits.get(d, 0.0) + s.period_deposit

        # 영업일 기준 포트폴리오 가격 보간(Forward fill)
        # 스냅샷 기록이 비어있는 영업일은 직전 일자의 평가액을 채워넣습니다.
        portfolio_history = []
        portfolio_deposits_history = []
        
        # 초기값 검색 (시작 영업일 직전의 스냅샷 찾기)
        last_known_val = 0.0
        if sorted_dates[0] in portfolio_vals:
            last_known_val = portfolio_vals[sorted_dates[0]]
        else:
            prev_snap = (
                self.db.query(AccountSnapshot)
                .filter(AccountSnapshot.snapshot_date < sorted_dates[0])
                .order_by(AccountSnapshot.snapshot_date.desc())
                .first()
            )
            if prev_snap:
                # 시작일 직전 날짜의 모든 계좌 평가액 합산
                prev_date = prev_snap.snapshot_date
                last_known_val = sum(
                    snap.total_valuation for snap in self.db.query(AccountSnapshot).filter_by(snapshot_date=prev_date).all()
                )

        for d in sorted_dates:
            if d in portfolio_vals:
                last_known_val = portfolio_vals[d]
            portfolio_history.append(last_known_val)
            portfolio_deposits_history.append(portfolio_deposits.get(d, 0.0))

        # 4. 포트폴리오 누적 수익률 정규화 계산
        # 순입출금액 변동에 대한 ROI 계산
        portfolio_returns = []
        base_val = portfolio_history[0]
        net_deposit = 0.0

        for i, val in enumerate(portfolio_history):
            if i == 0:
                portfolio_returns.append(0.0)
            else:
                # 시작일 이후 발생한 추가 입금액 누적
                net_deposit += portfolio_deposits_history[i]
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
            if sorted_dates[0] in price_map:
                last_price = price_map[sorted_dates[0]]
            else:
                prev_price = (
                    self.db.query(HistoricalPrice)
                    .filter(HistoricalPrice.ticker == ticker, HistoricalPrice.price_date < sorted_dates[0])
                    .order_by(HistoricalPrice.price_date.desc())
                    .first()
                )
                if prev_price:
                    last_price = prev_price.close_price

            for d in sorted_dates:
                if d in price_map:
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
            p_final = portfolio_returns[-1] if portfolio_returns else 0.0
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

        return {
            "labels": labels,
            "datasets": datasets,
            "alpha_summaries": alpha_summaries
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

        if sorted_dates[0] in price_map:
            last_price = price_map[sorted_dates[0]]
        else:
            prev_price = (
                self.db.query(HistoricalPrice)
                .filter(HistoricalPrice.ticker == ticker, HistoricalPrice.price_date < sorted_dates[0])
                .order_by(HistoricalPrice.price_date.desc())
                .first()
            )
            if prev_price:
                last_price = prev_price.close_price

        for d in sorted_dates:
            if d in price_map:
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
        today = datetime.date.today()
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

