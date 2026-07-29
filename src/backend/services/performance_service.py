import math
import numpy as np
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import SystemSetting, HistoricalPrice, AccountSnapshot, Account


class PerformanceService:
    """위험조정 성과 지표 (Sharpe, Sortino, MDD) 및 무위험 수익률 관리 서비스"""

    def __init__(self, db: Session):
        self.db = db

    def get_risk_free_rate(self) -> float:
        """DB에서 연율 무위험 수익률(%)을 조회합니다. 기본값 3.5%

        Returns:
            float: 연율 무위험 수익률 (%)
        """
        setting = self.db.query(SystemSetting).filter(SystemSetting.key == "risk_free_rate").first()
        if setting and setting.value:
            try:
                return float(setting.value)
            except ValueError:
                pass
        return 3.5

    def set_risk_free_rate(self, rate: float) -> float:
        """DB에 연율 무위험 수익률(%)을 저장/업데이트합니다.

        Args:
            rate (float): 설정할 연율 무위험 수익률 (%)

        Returns:
            float: 업데이트된 무위험 수익률 (%)
        """
        setting = self.db.query(SystemSetting).filter(SystemSetting.key == "risk_free_rate").first()
        if not setting:
            setting = SystemSetting(key="risk_free_rate", value=str(rate))
            self.db.add(setting)
        else:
            setting.value = str(rate)
        self.db.commit()
        self.db.refresh(setting)
        return float(setting.value)

    def _filter_by_period(self, dates: List[date], period: str) -> int:
        """선택 기간(1M, 3M, 6M, 1Y, YTD, Max)에 따른 시작 인덱스 반환

        Args:
            dates (List[date]): 날짜 시계열
            period (str): 기간 식별자

        Returns:
            int: 필터링 시작 인덱스
        """
        if not dates:
            return 0
        last_date = dates[-1]
        
        if period == "1M":
            start_date = last_date - timedelta(days=30)
        elif period == "3M":
            start_date = last_date - timedelta(days=90)
        elif period == "6M":
            start_date = last_date - timedelta(days=180)
        elif period == "1Y":
            start_date = last_date - timedelta(days=365)
        elif period == "YTD":
            start_date = date(last_date.year, 1, 1)
        else:  # "Max" or default
            return 0
            
        for idx, d in enumerate(dates):
            if d >= start_date:
                return idx
        return 0

    def _compute_metrics(
        self,
        returns: List[float],
        dates: List[date],
        prices_or_index: List[float],
        rf_annual: float,
    ) -> Dict:
        """수익률 및 지수 시계열로부터 공통 성과 지표(Sharpe, Sortino, MDD)를 계산합니다."""
        if not returns or len(returns) == 0:
            return {
                "sharpe_ratio": 0.0,
                "sortino_ratio": 0.0,
                "mdd": 0.0,
                "max_mdd": 0.0,
                "annualized_return": 0.0,
                "annualized_volatility": 0.0,
                "drawdown_series": [],
            }

        rf_daily = rf_annual / 252.0
        returns_arr = np.array(returns)
        mean_daily = np.mean(returns_arr)
        annualized_return = mean_daily * 252.0

        std_daily = np.std(returns_arr, ddof=1) if len(returns_arr) > 1 else np.std(returns_arr)
        annualized_volatility = std_daily * math.sqrt(252.0)

        # Sharpe Ratio
        if annualized_volatility > 0:
            sharpe_ratio = (annualized_return - rf_annual) / annualized_volatility
        else:
            sharpe_ratio = 0.0

        # Downside Volatility & Sortino Ratio
        downside_diffs = np.minimum(0.0, returns_arr - rf_daily)
        downside_var = np.mean(downside_diffs ** 2)
        downside_std_daily = math.sqrt(downside_var)
        annualized_downside_volatility = downside_std_daily * math.sqrt(252.0)

        if annualized_downside_volatility > 0:
            sortino_ratio = (annualized_return - rf_annual) / annualized_downside_volatility
        else:
            sortino_ratio = 0.0

        # MDD 및 Drawdown 시계열 연산
        peak = prices_or_index[0] if prices_or_index else 100.0
        drawdown_series = []
        max_mdd = 0.0

        for d, p in zip(dates, prices_or_index):
            if p > peak:
                peak = p
            dd = ((p - peak) / peak) * 100.0 if peak > 0 else 0.0
            if dd < max_mdd:
                max_mdd = dd
            drawdown_series.append({"date": d.strftime("%Y-%m-%d"), "drawdown": round(dd, 2)})

        current_mdd = drawdown_series[-1]["drawdown"] if drawdown_series else 0.0

        return {
            "sharpe_ratio": round(float(sharpe_ratio), 2),
            "sortino_ratio": round(float(sortino_ratio), 2),
            "mdd": round(float(current_mdd), 2),
            "max_mdd": round(float(max_mdd), 2),
            "annualized_return": round(float(annualized_return * 100.0), 2),
            "annualized_volatility": round(float(annualized_volatility * 100.0), 2),
            "drawdown_series": drawdown_series,
        }

    def calculate_asset_performance(self, ticker: str, period: str = "1Y") -> Dict:
        """개별 지수/종목 수정종가 시계열 기반 위험조정지표 계산

        Args:
            ticker (str): 종목/지수 코드 (예: '^KS11', '005930')
            period (str): 조회 기간 (1M, 3M, 6M, 1Y, YTD, Max)

        Returns:
            Dict: 개별 종목 성과 지표 딕셔너리
        """
        rf_annual = self.get_risk_free_rate() / 100.0

        records = (
            self.db.query(HistoricalPrice)
            .filter(HistoricalPrice.ticker == ticker)
            .order_by(HistoricalPrice.price_date.asc())
            .all()
        )

        if len(records) < 2:
            res = self._compute_metrics([], [], [], rf_annual)
            res.update({"ticker": ticker, "period": period})
            return res

        dates = [r.price_date for r in records]
        prices = [r.close_price for r in records]

        start_idx = self._filter_by_period(dates, period)
        if start_idx > 0 and (len(dates) - start_idx) >= 2:
            dates = dates[start_idx:]
            prices = prices[start_idx:]

        returns = []
        for i in range(1, len(prices)):
            if prices[i - 1] > 0:
                ret = (prices[i] - prices[i - 1]) / prices[i - 1]
                returns.append(ret)

        res = self._compute_metrics(returns, dates, prices, rf_annual)
        res.update({"ticker": ticker, "period": period})
        return res

    def calculate_portfolio_performance(self, period: str = "1Y") -> Dict:
        """입출금 차감 TWR 시계열 및 불규칙 스냅샷 보간 기반 총 자산 성과 지표 계산

        Args:
            period (str): 조회 기간 (1M, 3M, 6M, 1Y, YTD, Max)

        Returns:
            Dict: 포트폴리오 총 자산 성과 지표 딕셔너리
        """
        rf_annual = self.get_risk_free_rate() / 100.0

        rows = (
            self.db.query(
                AccountSnapshot.snapshot_date,
                func.sum(AccountSnapshot.total_valuation).label("total_val"),
                func.sum(AccountSnapshot.period_deposit).label("period_dep"),
            )
            .group_by(AccountSnapshot.snapshot_date)
            .order_by(AccountSnapshot.snapshot_date.asc())
            .all()
        )

        if len(rows) < 2:
            res = self._compute_metrics([], [], [], rf_annual)
            res.update({"period": period})
            return res

        daily_dates: List[date] = []
        daily_returns: List[float] = []

        for i in range(1, len(rows)):
            prev_date, prev_val, _ = rows[i - 1]
            curr_date, curr_val, curr_dep = rows[i]

            prev_val = float(prev_val or 0.0)
            curr_val = float(curr_val or 0.0)
            curr_dep = float(curr_dep or 0.0)

            if prev_val <= 0:
                continue

            r_k = (curr_val - curr_dep - prev_val) / prev_val
            delta_t = (curr_date - prev_date).days

            if delta_t <= 0:
                continue

            if 1 + r_k > 0:
                r_daily_k = math.pow(1 + r_k, 1.0 / delta_t) - 1.0
            else:
                r_daily_k = -1.0 / delta_t

            for day_offset in range(1, delta_t + 1):
                cur_d = prev_date + timedelta(days=day_offset)
                daily_dates.append(cur_d)
                daily_returns.append(r_daily_k)

        if not daily_returns:
            res = self._compute_metrics([], [], [], rf_annual)
            res.update({"period": period})
            return res

        start_idx = self._filter_by_period(daily_dates, period)
        if start_idx > 0 and (len(daily_dates) - start_idx) >= 2:
            daily_dates = daily_dates[start_idx:]
            daily_returns = daily_returns[start_idx:]

        # TWR 누적 지수 시계열 구축
        twr_series = []
        cur_index = 100.0
        for r in daily_returns:
            cur_index = cur_index * (1.0 + r)
            twr_series.append(cur_index)

        res = self._compute_metrics(daily_returns, daily_dates, twr_series, rf_annual)
        res.update({"period": period})
        return res
