# -*- coding: utf-8 -*-
"""포트폴리오 수익률과 시장 주요 지수 및 관심 종목의 성과를 비교 분석하는 서비스 모듈입니다.

시세 수집 및 캐싱을 통합 마켓 데이터 프로바이더(MarketDataProvider)로 위임하여 처리합니다.
"""

import datetime
import asyncio
import bisect
from typing import List, Dict, Any, Optional, TypedDict, Union
from sqlalchemy.orm import Session

from src.backend.models import HistoricalPrice, AccountSnapshot, Asset, ExchangeRate
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

        Args:
            items (List[Dict[str, Any]]): 보유 종목별 기여도 데이터 목록
            period_key (str): 기간 키 ('YTD', '1M', '3M', '1Y')
            reverse (bool): True이면 내림차순(Top Contributors), False이면 오름차순(Top Detractors)
            limit (int): 추출할 종목 수 (기본값: 3)

        Returns:
            List[Dict[str, Any]]: 랭킹 종목 목록
        """
        sorted_items = sorted(
            items,
            key=lambda x: (x["contributions"].get(period_key, 0.0), x["ticker"]),
            reverse=reverse
        )
        return [
            {
                "ticker": h["ticker"],
                "name": h["name"],
                "weight": h["weight"],
                "return": h["returns"].get(period_key, 0.0),
                "contribution": h["contributions"].get(period_key, 0.0),
            }
            for h in sorted_items[:limit]
        ]

    async def get_attribution_summary(
        self,
        as_of_date: Optional[Union[str, datetime.date]] = None
    ) -> Dict[str, Any]:
        """기준일 기준 4개 기간 벤치마크 성과, Alpha 및 종목별 손익 기여도(Attribution) 요약을 일괄 산출합니다.

        기존 캐시된 시세와 계좌 스냅샷, 트랜잭션 원장을 활용하여 외부 API 지연 없이 고속으로 계산합니다.

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
                - holdings_attribution (List[Dict]): 전체 보유 종목별 성과 및 기여도 내역
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

        # 4. 기준일 기준 보유 종목 및 비중 산출
        state = LedgerEngine.get_positions(self.db, as_of=as_of)
        active_holdings = state.holdings
        cash_balances = state.cash_balances

        # 환율 조회
        rate_record = (
            self.db.query(ExchangeRate)
            .filter(ExchangeRate.date <= as_of)
            .order_by(ExchangeRate.date.desc(), ExchangeRate.id.desc())
            .first()
        )
        exchange_rate = rate_record.rate if rate_record else self.DEFAULT_USD_KRW_RATE

        if not active_holdings:
            return {
                "as_of_date": as_of.isoformat(),
                "benchmarks": benchmarks,
                "top_contributors_ytd": [],
                "top_detractors_ytd": [],
                "top_contributors_1m": [],
                "top_detractors_1m": [],
                "holdings_attribution": [],
            }

        # 종목 마스터 정보 일괄 조회
        holding_tickers = list(active_holdings.keys())
        assets = (
            self.db.query(Asset)
            .filter(Asset.ticker.in_(holding_tickers))
            .all()
        )
        asset_map = {a.ticker: a for a in assets}

        # 시세 데이터 일괄 조회 (1Y 이전 여유분 포함, N+1 쿼리 방지)
        earliest_date = period_ranges["1Y"] - datetime.timedelta(days=10)
        price_records = (
            self.db.query(HistoricalPrice)
            .filter(
                HistoricalPrice.ticker.in_(holding_tickers),
                HistoricalPrice.price_date <= as_of,
                HistoricalPrice.price_date >= earliest_date,
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

        # 5. 종목별 현재가 및 평가액 계산
        evaluated_holdings = []
        for ticker, qty in active_holdings.items():
            asset = asset_map.get(ticker)
            if not asset:
                continue

            price_history = prices_by_ticker.get(ticker, [])
            p_curr_rec = get_price_record_at_or_before(price_history, as_of)
            current_price = p_curr_rec.close_price if p_curr_rec else 0.0

            valuation = qty * current_price
            valuation_krw = valuation * exchange_rate if asset.country == "US" else valuation

            evaluated_holdings.append({
                "ticker": ticker,
                "name": asset.name,
                "country": asset.country,
                "quantity": qty,
                "current_price": current_price,
                "valuation": valuation,
                "valuation_krw": valuation_krw,
                "price_history": price_history,
            })

        # 총 평가액 및 종목별 비중 계산
        total_valuation_krw = (
            cash_balances.get("KRW", 0.0)
            + (cash_balances.get("USD", 0.0) * exchange_rate)
            + sum(item["valuation_krw"] for item in evaluated_holdings)
        )

        # 6. 각 종목의 기간별 수익률 및 가중 손익 기여도(Attribution) 산출
        holdings_attribution = []
        for item in evaluated_holdings:
            ticker = item["ticker"]
            val_krw = item["valuation_krw"]
            weight = round((val_krw / total_valuation_krw) * 100.0, 2) if total_valuation_krw > 0 else 0.0

            price_history = item["price_history"]
            p_end_rec = get_price_record_at_or_before(price_history, as_of)
            end_price = p_end_rec.close_price if p_end_rec else 0.0
            end_date = p_end_rec.price_date if p_end_rec else None

            returns_by_period: Dict[str, float] = {}
            contributions_by_period: Dict[str, float] = {}

            for p_key, start_d in period_ranges.items():
                p_start_rec = get_price_record_at_or_before(price_history, start_d)
                if (
                    p_start_rec
                    and end_date
                    and p_start_rec.price_date < end_date
                    and p_start_rec.close_price > 0.0
                    and end_price > 0.0
                ):
                    ret = round(((end_price - p_start_rec.close_price) / p_start_rec.close_price) * 100.0, 2)
                else:
                    ret = 0.0

                contrib = round(weight * ret / 100.0, 2)
                returns_by_period[p_key] = ret
                contributions_by_period[p_key] = contrib

            holdings_attribution.append({
                "ticker": ticker,
                "name": item["name"],
                "weight": weight,
                "valuation_krw": round(val_krw),
                "returns": returns_by_period,
                "contributions": contributions_by_period,
            })

        # 비중(weight) 내림차순 정렬
        holdings_attribution.sort(key=lambda x: (x["weight"], x["ticker"]), reverse=True)

        # 7. YTD 및 1M 기준 Top 3 기여 종목 / Bottom 3 부진 종목 랭킹 추출
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


