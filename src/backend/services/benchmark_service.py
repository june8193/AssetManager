# -*- coding: utf-8 -*-
"""포트폴리오 수익률과 시장 주요 지수 및 관심 종목의 성과를 비교 분석하는 서비스 모듈입니다.

시세 수집 및 캐싱을 통합 마켓 데이터 프로바이더(MarketDataProvider)로 위임하여 처리합니다.
"""

import datetime
import asyncio
import bisect
from typing import List, Dict, Any, Optional, TypedDict, Union
from sqlalchemy.orm import Session

from src.backend.models import HistoricalPrice, AccountSnapshot, Asset, ExchangeRate, Account, Transaction
from src.backend.market import MarketDataProvider
from src.backend.services.ledger_engine import LedgerEngine


class MappedSnapshot(TypedDict):
    """영업일 매핑 스냅샷 정보를 정의하는 타입입니다."""
    total_valuation: float
    period_deposit: float
    actual_latest_date: datetime.date
    has_snapshot: bool


class BenchmarkService:
    """포트폴리오 수익률과 시장 주요 지수 및 관심 종목의 성과를 비교 분석하는 서비스 클래스입니다."""

    BENCHMARK_TICKERS = ["^KS11", "^KQ11", "^GSPC", "^IXIC"]
    TICKER_NAMES = {
        "^KS11": "kospi",
        "^KQ11": "kosdaq",
        "^GSPC": "sp500",
        "^IXIC": "nasdaq"
    }
    DEFAULT_USD_KRW_RATE: float = 1350.0

    def __init__(self, db: Session, provider: Optional[MarketDataProvider] = None) -> None:
        """BenchmarkService를 초기화합니다.

        Args:
            db (Session): 데이터베이스 세션 객체
            provider (Optional[MarketDataProvider]): 마켓 데이터 프로바이더 인스턴스
        """
        self.db = db
        if provider is not None:
            self.provider = provider
        else:
            from src.backend.market.adapters.kiwoom import KiwoomAdapter
            from src.backend.market.adapters.yfinance import YahooFinanceAdapter
            self.provider = MarketDataProvider(
                db=db,
                kr_adapter=KiwoomAdapter(),
                us_adapter=YahooFinanceAdapter(),
            )

    async def get_historical_prices(
        self,
        ticker: str,
        start_date: datetime.date,
        end_date: datetime.date
    ) -> List[HistoricalPrice]:
        """지정된 기간 동안의 티커 가격 데이터를 가져옵니다.

        MarketDataProvider를 통해 누락된 구간을 자동으로 수집/캐싱한 후 DB 모델 리스트를 반환합니다.

        Args:
            ticker (str): 자산 티커 (예: '^KS11', 'AAPL')
            start_date (date): 시작일
            end_date (date): 종료일

        Returns:
            List[HistoricalPrice]: 역사적 가격 객체 리스트 (날짜 오름차순)
        """
        # Provider를 통해 캐시 확인 및 필요한 외부 시세 동기화 (결측치 보정 없이 원본 적재 데이터 쿼리)
        await self.provider.get_historical_prices(
            ticker=ticker,
            start_date=start_date,
            end_date=end_date,
            fill_missing=False
        )

        # DB에서 캐싱된 모델 객체 목록 조회 및 반환
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

    @staticmethod
    def _map_snapshots_to_trading_dates(
        sorted_dates: List[datetime.date],
        snapshots: List[AccountSnapshot]
    ) -> Dict[datetime.date, MappedSnapshot]:
        """휴장일(주말/공휴일) 스냅샷을 직전 유효 영업일로 매핑 및 집계합니다.

        규칙:
        1. 각 스냅샷 날짜 d에 대해, sorted_dates 중 d 이하인 가장 최근 영업일(target_td)을 찾습니다.
        2. 동일 target_td 슬롯에 복수 스냅샷이 매핑되는 경우:
           - total_valuation: 가장 최신 스냅샷 날짜의 평가액으로 채택합니다 (최종 잔고).
           - period_deposit: 해당 슬롯에 매핑된 모든 스냅샷의 입금액을 누적 합산합니다.
           - actual_latest_date: 실제 스냅샷 날짜 중 가장 최신 날짜를 기록합니다.

        Args:
            sorted_dates (List[datetime.date]): 오름차순 정렬된 유효 영업일 목록
            snapshots (List[AccountSnapshot]): DB에서 조회된 스냅샷 레코드 목록

        Returns:
            Dict[datetime.date, MappedSnapshot]: 영업일별 집계 데이터 매핑
        """
        if not sorted_dates or not snapshots:
            return {}

        # 1. 날짜별 계좌 합산 (원본 날짜 기준)
        date_vals: Dict[datetime.date, float] = {}
        date_deps: Dict[datetime.date, float] = {}
        for s in snapshots:
            d = s.snapshot_date
            date_vals[d] = date_vals.get(d, 0.0) + (s.total_valuation or 0.0)
            date_deps[d] = date_deps.get(d, 0.0) + (s.period_deposit or 0.0)

        mapped: Dict[datetime.date, MappedSnapshot] = {}

        # 2. 날짜 오름차순 정렬 후 직전 영업일 매핑 (bisect_right 활용)
        for d in sorted(date_vals.keys()):
            idx = bisect.bisect_right(sorted_dates, d)
            if idx == 0:
                continue
            target_td = sorted_dates[idx - 1]

            if target_td not in mapped:
                mapped[target_td] = {
                    "total_valuation": date_vals[d],
                    "period_deposit": date_deps[d],
                    "actual_latest_date": d,
                    "has_snapshot": True
                }
            else:
                mapped[target_td]["total_valuation"] = date_vals[d]
                mapped[target_td]["period_deposit"] += date_deps[d]
                mapped[target_td]["actual_latest_date"] = d
                mapped[target_td]["has_snapshot"] = True

        return mapped

    async def calculate_cumulative_returns(
        self,
        start_date: datetime.date,
        end_date: datetime.date,
        tickers: List[str]
    ) -> Dict[str, Any]:
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

        # 3. 포트폴리오 일자별 평가액 및 입출금액 계산 (휴장일 스냅샷 영업일 매핑 포함)
        snapshots = (
            self.db.query(AccountSnapshot)
            .filter(AccountSnapshot.snapshot_date >= start_date, AccountSnapshot.snapshot_date <= end_date)
            .order_by(AccountSnapshot.snapshot_date.asc())
            .all()
        )

        mapped_snapshots = self._map_snapshots_to_trading_dates(sorted_dates, snapshots)

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
            base_val = last_known_val
        else:
            first_snap = mapped_snapshots.get(sorted_dates[0])
            if first_snap:
                base_val = max(0.0, first_snap["total_valuation"] - first_snap["period_deposit"])
                last_known_val = first_snap["total_valuation"]
            else:
                base_val = 0.0

        portfolio_history = []
        portfolio_net_deposits = []
        portfolio_has_snapshot = []
        running_dep = 0.0

        for d in sorted_dates:
            if d in mapped_snapshots:
                last_known_val = mapped_snapshots[d]["total_valuation"]
                running_dep += mapped_snapshots[d]["period_deposit"]
                has_snap = True
            else:
                has_snap = False

            portfolio_history.append(last_known_val)
            portfolio_net_deposits.append(running_dep)
            portfolio_has_snapshot.append(has_snap)

        # 4. 포트폴리오 누적 수익률 정규화 계산
        portfolio_returns = []

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
                "judgment": judgment,
                "current_price": ticker_prices[-1] if ticker_prices else 0.0
            })

        portfolio_final_valuation = portfolio_history[-1] if portfolio_history else 0.0
        portfolio_latest_snapshot_date = None
        if mapped_snapshots:
            latest_td = max(mapped_snapshots.keys())
            actual_d = mapped_snapshots[latest_td].get("actual_latest_date")
            if actual_d:
                portfolio_latest_snapshot_date = actual_d.isoformat()

        return {
            "labels": labels,
            "datasets": datasets,
            "alpha_summaries": alpha_summaries,
            "portfolio_final_valuation": portfolio_final_valuation,
            "portfolio_latest_snapshot_date": portfolio_latest_snapshot_date,
            "index_latest_values": {item["ticker"]: item["current_price"] for item in alpha_summaries}
        }

    async def get_watchlist_returns(
        self,
        ticker: str,
        start_date: datetime.date,
        end_date: datetime.date
    ) -> Dict[str, Any]:
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

        # 2. 영업일 기준 날짜 정합 (지수의 영업일 리스트를 X축 기준으로 삼음)
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
        valid_prices = [p for p in prices if p.close_price > 0.0]
        if len(valid_prices) >= 2:
            base_price = valid_prices[0].close_price
            last_price = valid_prices[-1].close_price
            if base_price != 0:
                return round(((last_price - base_price) / base_price) * 100, 2)
        return 0.0

    async def get_comparison_tables(self) -> Dict[str, Any]:
        """포트폴리오와 4대 시장 지수의 연간, 월간 및 일간 수익률 비교 데이터를 계산합니다.

        Returns:
            Dict[str, Any]: 연간, 월간 및 일간 비교 테이블 데이터
                - yearly (List[Dict]): 연간 비교 리스트 (최신 연도 순)
                - monthly (List[Dict]): 월간 비교 리스트 (최신 연월 순)
                - daily (List[Dict]): 일간 비교 리스트 (최신 일자 순)
        """
        import calendar
        from .dashboard_service import DashboardService
        dash_svc = DashboardService(self.db)

        # 1. 포트폴리오의 연도별, 월별, 일자별 데이터 로딩
        yearly_stats = dash_svc.get_yearly_stats()
        monthly_stats = dash_svc.get_monthly_stats()
        daily_stats = dash_svc.get_daily_stats(all_data=True)

        tickers = self.BENCHMARK_TICKERS
        ticker_names = self.TICKER_NAMES

        # 2. 일간, 월간 및 연간 수익률 비교 계산을 위한 전체 날짜 범위 계산
        daily_comparison = []
        monthly_comparison = []
        yearly_comparison = []

        all_dates = []
        if daily_stats:
            all_dates.extend([item["date"] for item in daily_stats])
        if monthly_stats:
            for item in monthly_stats:
                year, month = map(int, item["month"].split("-"))
                all_dates.append(datetime.date(year, month, 1))
                last_day = calendar.monthrange(year, month)[1]
                all_dates.append(datetime.date(year, month, last_day))
        if yearly_stats:
            for item in yearly_stats:
                all_dates.append(datetime.date(item["year"], 1, 1))
                all_dates.append(datetime.date(item["year"], 12, 31))

        if not all_dates:
            return {"yearly": [], "monthly": [], "daily": []}

        min_date = min(all_dates)
        max_date = max(all_dates)
        today = datetime.date.today()
        if max_date > today:
            max_date = today

        # 4대 지수 전체 구간 시세를 비동기 병렬(asyncio.gather)로 일괄 수집/캐싱 보장
        await asyncio.gather(*(
            self.get_historical_prices(ticker, min_date, max_date)
            for ticker in tickers
        ))

        # DB 캐시에서 전체 지수 데이터 일괄 로드
        prices_cache = {}
        for ticker in tickers:
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

        def get_cached_price_at_date(ticker: str, target_date: datetime.date) -> float:
            plist = prices_cache.get(ticker, [])
            last_val = 0.0
            for p in plist:
                if p.price_date <= target_date:
                    last_val = p.close_price
                else:
                    break
            return last_val

        # 3. 일간 수익률 비교 계산 (인메모리 캐시 활용)
        if daily_stats:
            sorted_daily = sorted(daily_stats, key=lambda x: x["date"])
            sorted_dates = [item["date"] for item in sorted_daily]

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
                    for ticker in tickers:
                        name = ticker_names[ticker]
                        row[name] = 0.0

                daily_comparison.append(row)

            daily_comparison.reverse()

        # 4. 월간 수익률 비교 계산 (인메모리 캐시 활용)
        if monthly_stats:
            sorted_monthly = sorted(monthly_stats, key=lambda x: x["month"])

            for item in sorted_monthly:
                month_str = item["month"]
                year, month = map(int, month_str.split("-"))
                start_date = datetime.date(year, month, 1)
                last_day = calendar.monthrange(year, month)[1]
                end_date = today if (year == today.year and month == today.month) else datetime.date(year, month, last_day)

                row = {
                    "month": month_str,
                    "assets": item["assets"],
                    "roi": item["roi"],
                    "kospi": 0.0,
                    "kosdaq": 0.0,
                    "sp500": 0.0,
                    "nasdaq": 0.0
                }

                for ticker in tickers:
                    plist = prices_cache.get(ticker, [])
                    valid_prices = [p for p in plist if start_date <= p.price_date <= end_date and p.close_price > 0.0]
                    name = ticker_names[ticker]

                    if len(valid_prices) >= 2:
                        base_price = valid_prices[0].close_price
                        last_price = valid_prices[-1].close_price
                        if base_price > 0.0:
                            ret = ((last_price - base_price) / base_price) * 100
                            row[name] = round(ret, 2)
                    else:
                        row[name] = 0.0

                monthly_comparison.append(row)

            monthly_comparison.reverse()

        # 5. 연간 수익률 비교 계산 (인메모리 캐시 활용으로 N+1 I/O 제거)
        if yearly_stats:
            sorted_yearly = sorted(yearly_stats, key=lambda x: x["year"])

            for item in sorted_yearly:
                year = item["year"]
                start_date = datetime.date(year, 1, 1)
                end_date = today if year == today.year else datetime.date(year, 12, 31)

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
                    plist = prices_cache.get(ticker, [])
                    valid_prices = [p for p in plist if start_date <= p.price_date <= end_date and p.close_price > 0.0]
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

            yearly_comparison.reverse()

        return {
            "yearly": yearly_comparison,
            "monthly": monthly_comparison,
            "daily": daily_comparison
        }

    @staticmethod
    def _extract_attribution_ranking(
        items: List[Dict[str, Any]],
        period_key: str,
        reverse: bool = True,
        limit: int = 3
    ) -> List[Dict[str, Any]]:
        """기간별 기여도 기준으로 정렬하여 상위 또는 하위 랭킹 목록을 추출합니다.

        노이즈 필터링:
        해당 기간에 실제 보유했거나(기초/기말 수량 > 0), 거래가 발생했거나, 손익(total_pnl != 0) 또는
        기여도(contribution != 0)가 존재하는 종목을 후보로 합니다.
        Top Contributors(reverse=True)는 기여도 내림차순,
        Top Detractors(reverse=False)는 기여도 오름차순으로 정렬합니다.

        Args:
            items (List[Dict[str, Any]]): 종목별 기여도 데이터 목록
            period_key (str): 기간 키 ('YTD', '1M', '3M', '1Y')
            reverse (bool): True이면 내림차순(Top Contributors), False이면 오름차순(Top Detractors)
            limit (int): 추출할 종목 수 (기본값: 3)

        Returns:
            List[Dict[str, Any]]: 랭킹 종목 목록
        """
        eligible_items = []
        for h in items:
            c = h.get("contributions", {}).get(period_key, 0.0)
            tot_pnl = h.get("total_pnl", {}).get(period_key, 0.0)
            status = h.get("status")
            if status == "HOLDING" or c != 0.0 or tot_pnl != 0.0:
                eligible_items.append(h)

        if not eligible_items:
            eligible_items = items

        sorted_items = sorted(
            eligible_items,
            key=lambda x: (x["contributions"].get(period_key, 0.0), x["ticker"]),
            reverse=reverse
        )
        return [
            {
                "ticker": h["ticker"],
                "name": h["name"],
                "major_category": h.get("major_category", ""),
                "sub_category": h.get("sub_category", ""),
                "currency": h.get("currency", "KRW"),
                "status": h.get("status", "HOLDING"),
                "weight": h["weight"],
                "capital_pnl": h["capital_pnl"].get(period_key, 0.0),
                "dividend_pnl": h["dividend_pnl"].get(period_key, 0.0),
                "total_pnl": h["total_pnl"].get(period_key, 0.0),
                "total_pnl_krw": h["total_pnl_krw"].get(period_key, 0),
                "capital_return": h["capital_returns"].get(period_key, 0.0),
                "return": h["returns"].get(period_key, 0.0),
                "price_return": h["price_returns"].get(period_key, 0.0),
                "capital_contribution": h["capital_contributions"].get(period_key, 0.0),
                "dividend_contribution": h["dividend_contributions"].get(period_key, 0.0),
                "contribution": h["contributions"].get(period_key, 0.0),
            }
            for h in sorted_items[:limit]
        ]

    def _calculate_base_caps_by_period(
        self,
        period_ranges: Dict[str, datetime.date],
        as_of: datetime.date,
        exchange_rate: float,
        positions_at_start: Dict[str, Any],
        asset_map: Dict[str, Asset],
        prices_by_ticker: Dict[str, List[HistoricalPrice]],
        period_txs: List[Transaction],
        total_valuation_krw: float,
    ) -> Dict[str, float]:
        """4대 분석 기간별 포트폴리오 기준자본(BaseCap)을 일괄 산출합니다.

        우선순위 1로 AccountSnapshot 기반(기초 평가액 + 기간 내 순입금)을 적용하여
        포트폴리오 기간 누적수익률과 분모를 일치시키고, 스냅샷 부재 시 원장(Ledger) 기반으로 폴백합니다.

        Args:
            period_ranges (Dict[str, datetime.date]): 기간별 시작일 맵
            as_of (datetime.date): 기준일자
            exchange_rate (float): 기준일 단일 환율
            positions_at_start (Dict[str, Any]): 기간 시작일별 포지션 상태
            asset_map (Dict[str, Asset]): 자산 티커 -> Asset 객체 맵
            prices_by_ticker (Dict[str, List[HistoricalPrice]]): 티커별 시세 목록
            period_txs (List[Transaction]): 기간 내 트랜잭션 목록
            total_valuation_krw (float): 기말 포트폴리오 총평가액

        Returns:
            Dict[str, float]: 기간 키별 기준자본(KRW) 맵
        """
        earliest_start_date = min(period_ranges.values())
        # N+1 쿼리 방지: 분석 구간 내 전체 스냅샷을 1회 일괄 조회하여 메모리 매핑
        all_snapshots = (
            self.db.query(AccountSnapshot)
            .filter(AccountSnapshot.snapshot_date <= as_of)
            .order_by(AccountSnapshot.snapshot_date.asc())
            .all()
        )
        snapshots_by_date: Dict[datetime.date, List[AccountSnapshot]] = {}
        for s in all_snapshots:
            snapshots_by_date.setdefault(s.snapshot_date, []).append(s)

        sorted_snap_dates = sorted(snapshots_by_date.keys())

        def get_price_record_at_or_before(p_list: List[HistoricalPrice], target_date: datetime.date) -> Optional[HistoricalPrice]:
            if not p_list:
                return None
            dates = [item.price_date for item in p_list]
            idx = bisect.bisect_right(dates, target_date)
            if idx > 0:
                return p_list[idx - 1]
            return p_list[0]

        base_cap_by_period: Dict[str, float] = {}
        for p_key, start_d in period_ranges.items():
            # start_d 이하인 가장 최신 스냅샷 일자 탐색
            idx = bisect.bisect_right(sorted_snap_dates, start_d)
            if idx > 0:
                prev_date = sorted_snap_dates[idx - 1]
                base_val = sum(s.total_valuation or 0.0 for s in snapshots_by_date[prev_date])
                # start_d < date <= as_of 기간의 순입금액 합산
                net_deposit = sum(
                    s.period_deposit or 0.0
                    for d in sorted_snap_dates[idx:]
                    if d <= as_of
                    for s in snapshots_by_date[d]
                )
                base_cap = base_val + net_deposit
            else:
                # 스냅샷 부재 시 원장 기반 계산
                st_state = positions_at_start[p_key]
                st_cash = st_state.cash_krw + (st_state.cash_usd * exchange_rate)
                st_holdings = 0.0
                for t, q in st_state.holdings.items():
                    ast = asset_map.get(t)
                    p_rec = get_price_record_at_or_before(prices_by_ticker.get(t, []), start_d)
                    p_val = p_rec.close_price if p_rec else 0.0
                    fx = exchange_rate if ast and ast.country == "US" else 1.0
                    st_holdings += q * p_val * fx
                base_val = st_cash + st_holdings
                net_deposit = LedgerEngine.calculate_net_deposits(
                    period_txs, start_date=start_d, end_date=as_of, usd_rate=exchange_rate
                )
                # 기간 내 INITIAL_BALANCE 입금액 가산
                init_bal_krw = 0.0
                for tx in period_txs:
                    if tx.transaction_date > start_d and tx.transaction_date <= as_of and tx.type == "INITIAL_BALANCE":
                        amt = float(tx.total_amount or 0.0)
                        if amt == 0.0 and tx.quantity:
                            amt = float(tx.quantity) * float(tx.price or 0.0)
                        if tx.currency == "USD":
                            amt *= exchange_rate
                        init_bal_krw += amt
                base_cap = base_val + net_deposit + init_bal_krw

            if base_cap <= 0:
                base_cap = total_valuation_krw if total_valuation_krw > 0 else 1.0
            base_cap_by_period[p_key] = base_cap

        return base_cap_by_period

    def _calculate_single_holding_attribution(
        self,
        asset: Asset,
        as_of: datetime.date,
        period_ranges: Dict[str, datetime.date],
        state_end: Any,
        positions_at_start: Dict[str, Any],
        prices_by_ticker: Dict[str, List[HistoricalPrice]],
        txs_by_asset_id: Dict[int, List[Transaction]],
        base_cap_by_period: Dict[str, float],
        total_valuation_krw: float,
        exchange_rate: float,
    ) -> Dict[str, Any]:
        """단일 비현금 상장 자산의 4대 기간 실제 발생 손익, 3종 수익률 및 3종 기여도를 산출합니다.

        Args:
            asset (Asset): 분석 대상 자산 인스턴스
            as_of (datetime.date): 기준일자
            period_ranges (Dict[str, datetime.date]): 기간별 시작일
            state_end (Any): 기준일 시점 원장 포지션 상태
            positions_at_start (Dict[str, Any]): 기간 시작일별 포지션 상태
            prices_by_ticker (Dict[str, List[HistoricalPrice]]): 티커별 시세 목록
            txs_by_asset_id (Dict[int, List[Transaction]]): 자산 ID별 트랜잭션 맵
            base_cap_by_period (Dict[str, float]): 기간별 기준자본(KRW)
            total_valuation_krw (float): 기말 포트폴리오 총평가액(KRW)
            exchange_rate (float): 기준일 단일 환율

        Returns:
            Dict[str, Any]: holdings_attribution 규격의 단일 종목 성과 딕셔너리
        """
        ticker = asset.ticker
        currency = "USD" if asset.country == "US" else "KRW"
        fx = exchange_rate if currency == "USD" else 1.0

        price_history = prices_by_ticker.get(ticker, [])

        def get_price_record_at_or_before(p_list: List[HistoricalPrice], target_date: datetime.date) -> Optional[HistoricalPrice]:
            if not p_list:
                return None
            dates = [item.price_date for item in p_list]
            idx = bisect.bisect_right(dates, target_date)
            if idx > 0:
                return p_list[idx - 1]
            return p_list[0]

        p_end_rec = get_price_record_at_or_before(price_history, as_of)
        p_end = p_end_rec.close_price if p_end_rec else 0.0

        q_end = state_end.holdings.get(ticker, 0.0)
        status = "HOLDING" if q_end > 0.000001 else "CLOSED"
        val = q_end * p_end
        val_krw = round(val * fx) if currency == "USD" else round(val)

        weight = (
            round((val_krw / total_valuation_krw) * 100.0, 2)
            if (status == "HOLDING" and total_valuation_krw > 0)
            else 0.0
        )

        capital_pnl: Dict[str, float] = {}
        dividend_pnl: Dict[str, float] = {}
        total_pnl: Dict[str, float] = {}
        capital_pnl_krw: Dict[str, int] = {}
        dividend_pnl_krw: Dict[str, int] = {}
        total_pnl_krw: Dict[str, int] = {}

        capital_returns: Dict[str, float] = {}
        returns: Dict[str, float] = {}
        price_returns: Dict[str, float] = {}

        capital_contributions: Dict[str, float] = {}
        dividend_contributions: Dict[str, float] = {}
        contributions: Dict[str, float] = {}

        asset_txs = txs_by_asset_id.get(asset.id, [])

        for p_key, start_d in period_ranges.items():
            q_start = positions_at_start[p_key].holdings.get(ticker, 0.0)
            p_start_rec = get_price_record_at_or_before(price_history, start_d)
            p_start = p_start_rec.close_price if p_start_rec else 0.0

            v_start = q_start * p_start if q_start > 0.000001 else 0.0
            v_end_period = q_end * p_end if q_end > 0.000001 else 0.0

            # 기간 내 트랜잭션 집계 (종목 통화 기준)
            buy_cost = 0.0
            sell_proceeds = 0.0
            dividend_gross = 0.0
            dividend_tax = 0.0

            for tx in asset_txs:
                if tx.transaction_date <= start_d or tx.transaction_date > as_of:
                    continue

                raw_amt = tx.total_amount
                if tx.type == "INITIAL_BALANCE" and (raw_amt is None or raw_amt == 0.0):
                    raw_amt = float(tx.quantity or 0.0) * float(tx.price or p_start or p_end or 0.0)
                amt = float(raw_amt or 0.0)

                # 통화 환산 (타 통화인 경우 기준일 환율 적용)
                if tx.currency != currency:
                    if currency == "USD":
                        amt = amt / exchange_rate
                    else:
                        amt = amt * exchange_rate

                if tx.type in ["BUY", "INITIAL_BALANCE"]:
                    buy_cost += amt
                elif tx.type == "SELL":
                    sell_proceeds += amt
                elif tx.type == "INTEREST":
                    dividend_gross += amt
                elif tx.type == "TAX":
                    dividend_tax += amt

            # 손익 산출
            c_pnl = v_end_period - v_start - (buy_cost - sell_proceeds)
            d_pnl = dividend_gross - dividend_tax
            t_pnl = c_pnl + d_pnl

            if currency == "USD":
                c_pnl_krw = round(c_pnl * exchange_rate)
                d_pnl_krw = round(d_pnl * exchange_rate)
                t_pnl_krw = round(t_pnl * exchange_rate)
            else:
                c_pnl_krw = round(c_pnl)
                d_pnl_krw = round(d_pnl)
                t_pnl_krw = round(t_pnl)

            capital_pnl[p_key] = round(c_pnl, 2)
            dividend_pnl[p_key] = round(d_pnl, 2)
            total_pnl[p_key] = round(t_pnl, 2)
            capital_pnl_krw[p_key] = c_pnl_krw
            dividend_pnl_krw[p_key] = d_pnl_krw
            total_pnl_krw[p_key] = t_pnl_krw

            # 수익률 산출
            invested_capital = v_start + buy_cost
            if invested_capital > 0.000001:
                c_ret = round((c_pnl / invested_capital) * 100.0, 2)
                t_ret = round((t_pnl / invested_capital) * 100.0, 2)
            else:
                c_ret = 0.0
                t_ret = 0.0

            if p_start > 0.0 and p_end > 0.0:
                p_ret = round(((p_end - p_start) / p_start) * 100.0, 2)
            else:
                p_ret = 0.0

            capital_returns[p_key] = c_ret
            returns[p_key] = t_ret
            price_returns[p_key] = p_ret

            # 기여도 산출
            b_cap = base_cap_by_period[p_key]
            if b_cap > 0:
                c_contrib = round((c_pnl_krw / b_cap) * 100.0, 2)
                d_contrib = round((d_pnl_krw / b_cap) * 100.0, 2)
                t_contrib = round((t_pnl_krw / b_cap) * 100.0, 2)
            else:
                c_contrib = 0.0
                d_contrib = 0.0
                t_contrib = 0.0

            capital_contributions[p_key] = c_contrib
            dividend_contributions[p_key] = d_contrib
            contributions[p_key] = t_contrib

        return {
            "ticker": ticker,
            "name": asset.name,
            "major_category": asset.major_category or "주식",
            "sub_category": asset.sub_category or "",
            "currency": currency,
            "status": status,
            "quantity": q_end,
            "weight": weight,
            "valuation": round(val, 2),
            "valuation_krw": val_krw,
            "capital_pnl": capital_pnl,
            "dividend_pnl": dividend_pnl,
            "total_pnl": total_pnl,
            "capital_pnl_krw": capital_pnl_krw,
            "dividend_pnl_krw": dividend_pnl_krw,
            "total_pnl_krw": total_pnl_krw,
            "capital_returns": capital_returns,
            "returns": returns,
            "price_returns": price_returns,
            "capital_contributions": capital_contributions,
            "dividend_contributions": dividend_contributions,
            "contributions": contributions,
        }

    async def get_attribution_summary(
        self,
        as_of_date: Optional[Union[str, datetime.date]] = None
    ) -> Dict[str, Any]:
        """기준일 기준 4개 기간 벤치마크 성과, Alpha 및 종목별 실제 발생 손익(Actual P&L) 기반 기여도(Attribution) 요약을 일괄 산출합니다.

        단일 원장 엔진(LedgerEngine)의 실제 거래 이력과 시세(HistoricalPrice)를 결합하여,
        중도 매매, 전량 매도(CLOSED), 자본/배당 분리 및 미국 종목 통화 정합성을 완결합니다.

        Args:
            as_of_date (Optional[Union[str, datetime.date]]): 분석 기준일자. 기본값은 오늘.

        Returns:
            Dict[str, Any]: 벤치마크 성과 및 종목별 손익 기여도 요약 딕셔너리
                - as_of_date (str): 기준일 (YYYY-MM-DD)
                - benchmarks (Dict[str, Dict]): 기간별(1M, 3M, 1Y, YTD) 포트폴리오 및 지수 수익률, Alpha
                - top_contributors_ytd (List[Dict]): YTD 상위 기여 종목 (최대 3개)
                - top_detractors_ytd (List[Dict]): YTD 부진 종목 (최대 3개)
                - top_contributors_1m (List[Dict]): 1M 상위 기여 종목 (최대 3개)
                - top_detractors_1m (List[Dict]): 1M 부진 종목 (최대 3개)
                - holdings_attribution (List[Dict]): 전체 대상 종목별 성과 및 기여도 내역
        """
        # 1. 기준일자 확정
        if as_of_date is None:
            as_of = datetime.date.today()
        elif isinstance(as_of_date, str):
            as_of = datetime.date.fromisoformat(as_of_date)
        elif isinstance(as_of_date, datetime.datetime):
            as_of = as_of_date.date()
        else:
            as_of = as_of_date

        # 2. 4대 기간 시작일 정의
        period_ranges: Dict[str, datetime.date] = {
            "1M": as_of - datetime.timedelta(days=30),
            "3M": as_of - datetime.timedelta(days=90),
            "1Y": as_of - datetime.timedelta(days=365),
            "YTD": datetime.date(as_of.year, 1, 1),
        }
        earliest_start_date = min(period_ranges.values())

        # 3. 4대 기간 벤치마크 누적 수익률 비동기 병렬 계산
        benchmark_tickers = ["^GSPC", "^IXIC", "^KS11"]
        benchmark_tasks = [
            self.calculate_cumulative_returns(start_d, as_of, benchmark_tickers)
            for start_d in period_ranges.values()
        ]
        benchmark_results = await asyncio.gather(*benchmark_tasks)

        benchmarks: Dict[str, Dict[str, float]] = {}
        for period_key, chart_data in zip(period_ranges.keys(), benchmark_results):
            portfolio_ret = 0.0
            if chart_data.get("datasets") and len(chart_data["datasets"]) > 0:
                p_returns = chart_data["datasets"][0].get("data", [])
                for val in reversed(p_returns):
                    if val is not None:
                        portfolio_ret = val
                        break

            index_returns = {"sp500": 0.0, "nasdaq": 0.0, "kospi": 0.0}
            for item in chart_data.get("alpha_summaries", []):
                t = item.get("ticker")
                name_key = self.TICKER_NAMES.get(t)
                if name_key and name_key in index_returns:
                    index_returns[name_key] = item.get("benchmark_return", 0.0)

            alpha_vs_sp500 = round(portfolio_ret - index_returns["sp500"], 2)
            benchmarks[period_key] = {
                "portfolio": portfolio_ret,
                "sp500": index_returns["sp500"],
                "nasdaq": index_returns["nasdaq"],
                "kospi": index_returns["kospi"],
                "alpha_vs_sp500": alpha_vs_sp500,
            }

        # 4. 기준일 기준 환율 조회 (0 이하 값 방어)
        rate_record = (
            self.db.query(ExchangeRate)
            .filter(ExchangeRate.date <= as_of)
            .order_by(ExchangeRate.date.desc(), ExchangeRate.id.desc())
            .first()
        )
        raw_rate = rate_record.rate if rate_record else self.DEFAULT_USD_KRW_RATE
        exchange_rate = raw_rate if (raw_rate and raw_rate > 0) else self.DEFAULT_USD_KRW_RATE

        # 5. 활성 계좌 및 포지션 상태 산출
        active_accounts = self.db.query(Account).filter(Account.is_active == True).all()
        active_acc_ids = {a.id for a in active_accounts}

        state_end = LedgerEngine.get_positions(self.db, as_of=as_of)

        positions_at_start: Dict[str, Any] = {}
        for p_key, start_d in period_ranges.items():
            positions_at_start[p_key] = LedgerEngine.get_positions(self.db, as_of=start_d)

        # 6. 기간 내(earliest_start_date < tx <= as_of) 활성 계좌 트랜잭션 일괄 조회
        period_txs: List[Transaction] = []
        if active_acc_ids:
            period_txs = (
                self.db.query(Transaction)
                .filter(
                    Transaction.account_id.in_(active_acc_ids),
                    Transaction.transaction_date > earliest_start_date,
                    Transaction.transaction_date <= as_of,
                )
                .order_by(Transaction.transaction_date.asc(), Transaction.id.asc())
                .all()
            )

        # 7. 비현금 상장 분석 대상 종목(주식, 채권 ETF) 후보군 수집
        candidate_tickers = set(state_end.holdings.keys())
        for p_key in period_ranges.keys():
            candidate_tickers.update(positions_at_start[p_key].holdings.keys())

        candidate_asset_ids = set()
        for tx in period_txs:
            if tx.asset_id:
                candidate_asset_ids.add(tx.asset_id)

        all_candidate_assets = (
            self.db.query(Asset)
            .filter(
                (Asset.ticker.in_(candidate_tickers)) | (Asset.id.in_(candidate_asset_ids))
            )
            .all()
        )

        target_assets = [
            a for a in all_candidate_assets
            if (a.ticker not in ["KRW", "USD"]) and (getattr(a, "major_category", None) != "현금")
        ]

        if not target_assets and not state_end.holdings:
            return {
                "as_of_date": as_of.isoformat(),
                "benchmarks": benchmarks,
                "top_contributors_ytd": [],
                "top_detractors_ytd": [],
                "top_contributors_1m": [],
                "top_detractors_1m": [],
                "holdings_attribution": [],
            }

        target_tickers = [a.ticker for a in target_assets]
        asset_map = {a.ticker: a for a in target_assets}

        # 8. 시세 데이터 일괄 조회 (N+1 쿼리 방지)
        earliest_price_date = earliest_start_date - datetime.timedelta(days=10)
        price_records = (
            self.db.query(HistoricalPrice)
            .filter(
                HistoricalPrice.ticker.in_(target_tickers),
                HistoricalPrice.price_date <= as_of,
                HistoricalPrice.price_date >= earliest_price_date,
                HistoricalPrice.close_price > 0.0
            )
            .order_by(HistoricalPrice.ticker, HistoricalPrice.price_date.asc())
            .all()
        )

        prices_by_ticker: Dict[str, List[HistoricalPrice]] = {}
        for p in price_records:
            prices_by_ticker.setdefault(p.ticker, []).append(p)

        def get_price_record_at_or_before(p_list: List[HistoricalPrice], target_date: datetime.date) -> Optional[HistoricalPrice]:
            if not p_list:
                return None
            dates = [item.price_date for item in p_list]
            idx = bisect.bisect_right(dates, target_date)
            if idx > 0:
                return p_list[idx - 1]
            return p_list[0]

        # 9. 기말 포트폴리오 총평가액 계산 (기말 비중 산출용)
        evaluated_holdings_end = []
        for ticker, qty in state_end.holdings.items():
            asset = asset_map.get(ticker)
            if not asset:
                continue

            price_history = prices_by_ticker.get(ticker, [])
            p_end_rec = get_price_record_at_or_before(price_history, as_of)
            current_price = p_end_rec.close_price if p_end_rec else 0.0

            val = qty * current_price
            val_krw = val * exchange_rate if asset.country == "US" else val
            evaluated_holdings_end.append(val_krw)

        cash_balances = state_end.cash_balances
        total_valuation_krw = (
            cash_balances.get("KRW", 0.0)
            + (cash_balances.get("USD", 0.0) * exchange_rate)
            + sum(evaluated_holdings_end)
        )

        # 10. 기간별 포트폴리오 기준자본(BaseCap) 계산 (모듈화 헬퍼 위임)
        base_cap_by_period = self._calculate_base_caps_by_period(
            period_ranges=period_ranges,
            as_of=as_of,
            exchange_rate=exchange_rate,
            positions_at_start=positions_at_start,
            asset_map=asset_map,
            prices_by_ticker=prices_by_ticker,
            period_txs=period_txs,
            total_valuation_krw=total_valuation_krw,
        )

        # 11. 트랜잭션 종목별 맵 구성
        txs_by_asset_id: Dict[int, List[Transaction]] = {}
        for tx in period_txs:
            if tx.asset_id:
                txs_by_asset_id.setdefault(tx.asset_id, []).append(tx)

        # 12. 종목별 실제 발생 손익(Actual P&L) 및 3종 수익률 / 3종 기여도 산출 (모듈화 헬퍼 위임)
        holdings_attribution = [
            self._calculate_single_holding_attribution(
                asset=asset,
                as_of=as_of,
                period_ranges=period_ranges,
                state_end=state_end,
                positions_at_start=positions_at_start,
                prices_by_ticker=prices_by_ticker,
                txs_by_asset_id=txs_by_asset_id,
                base_cap_by_period=base_cap_by_period,
                total_valuation_krw=total_valuation_krw,
                exchange_rate=exchange_rate,
            )
            for asset in target_assets
        ]

        # 비중(weight) 내림차순 및 보유/손익 우선 정렬
        holdings_attribution.sort(
            key=lambda x: (x["status"] == "HOLDING", x["weight"], abs(x["total_pnl_krw"].get("YTD", 0))),
            reverse=True
        )

        # 13. YTD 및 1M 기준 Top 3 기여 종목 / Bottom 3 부진 종목 랭킹 추출
        top_contributors_ytd = self._extract_attribution_ranking(holdings_attribution, "YTD", reverse=True, limit=3)
        top_detractors_ytd = self._extract_attribution_ranking(holdings_attribution, "YTD", reverse=False, limit=3)
        top_contributors_1m = self._extract_attribution_ranking(holdings_attribution, "1M", reverse=True, limit=3)
        top_detractors_1m = self._extract_attribution_ranking(holdings_attribution, "1M", reverse=False, limit=3)

        return {
            "as_of_date": as_of.isoformat(),
            "benchmarks": benchmarks,
            "top_contributors_ytd": top_contributors_ytd,
            "top_detractors_ytd": top_detractors_ytd,
            "top_contributors_1m": top_contributors_1m,
            "top_detractors_1m": top_detractors_1m,
            "holdings_attribution": holdings_attribution,
        }




