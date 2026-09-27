import datetime
import math
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from src.backend.models import HistoricalPrice



class SimulationService:
    """S&P500 지수와 현금을 활용한 자산배분 백테스트 시뮬레이션 서비스입니다.
    
    모든 연산은 금액 단위를 배제하고 비율(%) 및 지수화된 수익률을 기준으로 수행합니다.
    """

    def __init__(self, db: Session):
        """SimulationService를 초기화합니다.

        Args:
            db (Session): 데이터베이스 세션 객체
        """
        self.db = db

    async def get_date_range(self, period: str) -> tuple[datetime.date, datetime.date]:
        """선택한 프리셋 기간에 따라 백테스트 시작일과 종료일을 계산합니다.

        Args:
            period (str): '5Y', '10Y', '20Y', '30Y', 'ALL'

        Returns:
            tuple[datetime.date, datetime.date]: (시작일, 종료일)
        """
        # S&P500 (^GSPC) 데이터 중 가장 최근 날짜와 가장 과거 날짜 조회
        max_date_row = (
            self.db.query(func.max(HistoricalPrice.price_date))
            .filter(HistoricalPrice.ticker == "^GSPC")
            .first()
        )
        min_date_row = (
            self.db.query(func.min(HistoricalPrice.price_date))
            .filter(HistoricalPrice.ticker == "^GSPC")
            .first()
        )

        end_date = max_date_row[0] if max_date_row and max_date_row[0] else datetime.date.today()
        min_date = min_date_row[0] if min_date_row and min_date_row[0] else datetime.date(1989, 1, 26)

        if period == "5Y":
            start_date = end_date - datetime.timedelta(days=5 * 365)
        elif period == "10Y":
            start_date = end_date - datetime.timedelta(days=10 * 365)
        elif period == "20Y":
            start_date = end_date - datetime.timedelta(days=20 * 365)
        elif period == "30Y":
            start_date = end_date - datetime.timedelta(days=30 * 365)
        else:  # ALL
            start_date = min_date

        # 시작 날짜가 DB의 최소 날짜보다 이전이면 최소 날짜로 조정
        if start_date < min_date:
            start_date = min_date

        return start_date, end_date

    async def run_simulation(
        self,
        allocations: List[Dict[str, Any]],
        period: str,
        rebalancing: str
    ) -> Dict[str, Any]:
        """주어진 자산 배분 비중 조합과 설정으로 백테스트 시뮬레이션을 수행합니다.

        Args:
            allocations (List[Dict]): 각 비중 조합 [{"name": "60/40", "stock_ratio": 60}]
            period (str): '5Y', '10Y', '20Y', '30Y', 'ALL'
            rebalancing (str): 'monthly', 'yearly', 'none'

        Returns:
            Dict[str, Any]: 차트, 요약 카드 및 연도별/월별 현황 데이터
        """
        start_date, end_date = await self.get_date_range(period)

        # 1. S&P500 일별 가격 데이터 가져오기
        prices = (
            self.db.query(HistoricalPrice)
            .filter(
                HistoricalPrice.ticker == "^GSPC",
                HistoricalPrice.price_date >= start_date,
                HistoricalPrice.price_date <= end_date,
                HistoricalPrice.close_price > 0.0
            )
            .order_by(HistoricalPrice.price_date.asc())
            .all()
        )

        if not prices:
            return {
                "chart": {"labels": [], "datasets": []},
                "summaries": [],
                "yearly_stats": {},
                "monthly_stats": {}
            }

        # 1.5. 차트 렌더링 다운샘플링 필터링
        # 데이터 포인트가 과도하게 많아 브라우저 렌더링 스레드가 마비되는 현상을 막기 위해,
        # 5Y 이하는 주별(Weekly) 샘플링, 10Y 이상은 월별(Monthly) 샘플링을 수행합니다.
        chart_indices = []
        for t in range(len(prices)):
            curr_p = prices[t]
            is_sample_point = False
            
            if t == 0 or t == len(prices) - 1:
                # 첫 영업일과 마지막 영업일은 차트 시작/끝 조정을 위해 무조건 포함
                is_sample_point = True
            else:
                next_p = prices[t + 1]
                if period == "5Y":
                    # 주(week) 단위로 끊어 일요일/월요일 경계 영업일만 샘플링
                    curr_week = curr_p.price_date.isocalendar()[1]
                    next_week = next_p.price_date.isocalendar()[1]
                    if curr_week != next_week:
                        is_sample_point = True
                else:
                    # 10Y, 20Y, 30Y, ALL 기간은 월(month) 단위 영업일만 샘플링
                    if curr_p.price_date.month != next_p.price_date.month:
                        is_sample_point = True
            
            if is_sample_point:
                chart_indices.append(t)

        chart_indices = sorted(list(set(chart_indices)))
        chart_labels = [prices[idx].price_date.isoformat() for idx in chart_indices]

        # 2. 결과 저장을 위한 데이터 구조 정의
        datasets = []
        summaries = []
        yearly_stats_by_alloc = {}
        monthly_stats_by_alloc = {}

        # 3. 비중 조합별 백테스트 실행
        for alloc in allocations:
            name = alloc.get("name")
            stock_ratio = float(alloc.get("stock_ratio", 100))
            w_s = stock_ratio / 100.0
            w_c = (100.0 - stock_ratio) / 100.0

            # 시뮬레이션 상태 변수 초기화
            portfolio_values = []
            portfolio_dates = []

            # t = 0 초기화 (100에서 시작)
            p_val = 100.0
            qty = (p_val * w_s) / prices[0].close_price
            cash = p_val * w_c

            portfolio_values.append(p_val)
            portfolio_dates.append(prices[0].price_date)

            # 리밸런싱 일자 판단을 위한 일별 루프
            for t in range(1, len(prices)):
                curr_p = prices[t]
                
                # 주가 변동에 따른 평가액 반영 (리밸런싱 전)
                stock_val = qty * curr_p.close_price
                p_val = stock_val + cash
                
                # 오늘이 리밸런싱일인지 판정
                is_rebal_day = False
                if t < len(prices) - 1:
                    next_p = prices[t + 1]
                    if rebalancing == "monthly" and curr_p.price_date.month != next_p.price_date.month:
                        is_rebal_day = True
                    elif rebalancing == "yearly" and curr_p.price_date.year != next_p.price_date.year:
                        is_rebal_day = True

                # 리밸런싱 수행
                if is_rebal_day:
                    stock_val = p_val * w_s
                    cash = p_val * w_c
                    qty = stock_val / curr_p.close_price

                portfolio_values.append(p_val)
                portfolio_dates.append(curr_p.price_date)

            # 4. 누적 수익률 리스트 생성 (시작 100을 0% 기준으로 변환)
            returns = [round(((v - 100.0) / 100.0) * 100, 2) for v in portfolio_values]

            # 5. 요약 통계 계산 (CAGR, MDD 등)
            final_val = portfolio_values[-1]
            final_return = round(((final_val - 100.0) / 100.0) * 100, 2)

            # CAGR 계산 (기하 연평균 수익률)
            total_days = (portfolio_dates[-1] - portfolio_dates[0]).days
            if total_days > 0 and final_val > 0:
                cagr = ((final_val / 100.0) ** (365.25 / total_days) - 1.0) * 100
                cagr = round(cagr, 2)
            else:
                cagr = 0.0

            # MDD 계산 (최대 낙폭)
            mdd = 0.0
            peak = 0.0
            for v in portfolio_values:
                if v > peak:
                    peak = v
                if peak > 0:
                    dd = (v - peak) / peak * 100
                    if dd < mdd:
                        mdd = dd
            mdd = round(mdd, 2)

            summaries.append({
                "name": name,
                "stock_ratio": stock_ratio,
                "cagr": cagr,
                "mdd": mdd,
                "final_return": final_return
            })

            # 차트 데이터셋 추가 (다운샘플링된 인덱스의 누적 수익률만 전송)
            chart_returns = [returns[idx] for idx in chart_indices]
            datasets.append({
                "label": name,
                "data": chart_returns
            })

            # 6. 연도별 통계 계산
            yearly_stats = []
            yearly_groups: Dict[int, List[tuple[datetime.date, float]]] = {}
            for dt, val in zip(portfolio_dates, portfolio_values):
                yearly_groups.setdefault(dt.year, []).append((dt, val))

            sorted_years = sorted(yearly_groups.keys())
            for idx, year in enumerate(sorted_years):
                year_data = yearly_groups[year]
                year_end_val = year_data[-1][1]
                
                # 연초(해당 연도 직전 연말 혹은 시작일) 가치 구하기
                if idx > 0:
                    prev_year = sorted_years[idx - 1]
                    year_start_val = yearly_groups[prev_year][-1][1]
                else:
                    year_start_val = 100.0

                # 연간 수익률
                year_return = ((year_end_val - year_start_val) / year_start_val) * 100
                # 누적 수익률
                cum_return = ((year_end_val - 100.0) / 100.0) * 100

                # 연간 MDD 계산 (해당 연도 내부의 고점 대비 최대 낙폭)
                y_mdd = 0.0
                y_peak = 0.0
                for _, v in year_data:
                    if v > y_peak:
                        y_peak = v
                    if y_peak > 0:
                        dd = (v - y_peak) / y_peak * 100
                        if dd < y_mdd:
                            y_mdd = dd

                yearly_stats.append({
                    "year": year,
                    "year_return": round(year_return, 2),
                    "cumulative_return": round(cum_return, 2),
                    "mdd": round(y_mdd, 2)
                })

            yearly_stats.reverse()
            yearly_stats_by_alloc[name] = yearly_stats

            # 7. 월별 통계 계산
            monthly_stats = []
            monthly_groups: Dict[tuple[int, int], List[tuple[datetime.date, float]]] = {}
            for dt, val in zip(portfolio_dates, portfolio_values):
                monthly_groups.setdefault((dt.year, dt.month), []).append((dt, val))

            sorted_months = sorted(monthly_groups.keys())
            for idx, (year, month) in enumerate(sorted_months):
                month_data = monthly_groups[(year, month)]
                month_end_val = month_data[-1][1]

                # 월초(직전 월말 혹은 시작일) 가치 구하기
                if idx > 0:
                    prev_ym = sorted_months[idx - 1]
                    month_start_val = monthly_groups[prev_ym][-1][1]
                else:
                    month_start_val = 100.0

                # 월간 수익률
                month_return = ((month_end_val - month_start_val) / month_start_val) * 100
                # 누적 수익률
                cum_return = ((month_end_val - 100.0) / 100.0) * 100

                # 월간 MDD 계산
                m_mdd = 0.0
                m_peak = 0.0
                for _, v in month_data:
                    if v > m_peak:
                        m_peak = v
                    if m_peak > 0:
                        dd = (v - m_peak) / m_peak * 100
                        if dd < m_mdd:
                            m_mdd = dd

                monthly_stats.append({
                    "year": year,
                    "month": month,
                    "month_return": round(month_return, 2),
                    "cumulative_return": round(cum_return, 2),
                    "mdd": round(m_mdd, 2)
                })

            monthly_stats.reverse()
            monthly_stats_by_alloc[name] = monthly_stats

        return {
            "chart": {
                "labels": chart_labels,
                "datasets": datasets
            },
            "summaries": summaries,
            "yearly_stats": yearly_stats_by_alloc,
            "monthly_stats": monthly_stats_by_alloc
        }

    async def get_compound_snapshot_stats(self) -> Dict[str, Any]:
        """과거 스냅샷 기록을 분석하여 연평균 수익률(기하평균), 연평균 추가금, 최신 자산 합계를 반환합니다."""
        from src.backend.models import AccountSnapshot
        
        snapshots = (
            self.db.query(AccountSnapshot)
            .order_by(AccountSnapshot.snapshot_date.asc())
            .all()
        )
        
        if not snapshots:
            return {
                "has_enough_data": False,
                "annual_deposit_avg": 0.0,
                "annual_roi_avg": 0.0,
                "latest_total_valuation": 0.0
            }
            
        # 2. 기간 계산
        min_date = snapshots[0].snapshot_date
        max_date = snapshots[-1].snapshot_date
        total_days = (max_date - min_date).days
        
        # 1년 미만인 경우 충분한 데이터가 없다고 판단
        if total_days < 365:
            return {
                "has_enough_data": False,
                "annual_deposit_avg": 0.0,
                "annual_roi_avg": 0.0,
                "latest_total_valuation": 0.0
            }
            
        total_years = total_days / 365.25
        
        # 3. 연평균 추가금 계산
        total_deposit = sum(snap.period_deposit for snap in snapshots)
        annual_deposit_avg = round(total_deposit / total_years, 2)
        
        # 4. 연평균 수익률 계산 (기하 평균)
        from src.backend.services.dashboard_service import DashboardService
        dashboard_service = DashboardService(self.db)
        yearly_stats = dashboard_service.get_yearly_stats()
        
        rois = [item["roi"] for item in yearly_stats if "roi" in item]
        
        if not rois:
            annual_roi_avg = 0.0
        else:
            prod = 1.0
            for r in rois:
                # -100% 이하가 있을 경우 최소값(-99.9%)으로 보정하여 에러 방지
                r_val = max(r, -99.9) / 100.0
                prod *= (1.0 + r_val)
            
            n = len(rois)
            if prod > 0:
                geo_mean = (prod ** (1.0 / n)) - 1.0
                annual_roi_avg = round(geo_mean * 100.0, 2)
            else:
                annual_roi_avg = -100.0
                
        # 5. 최신 자산 총합 계산 (최신 스냅샷 날짜의 valuation 합계)
        latest_date = max_date
        latest_valuation_sum = sum(
            snap.total_valuation 
            for snap in snapshots 
            if snap.snapshot_date == latest_date
        )
        
        return {
            "has_enough_data": True,
            "annual_deposit_avg": annual_deposit_avg,
            "annual_roi_avg": annual_roi_avg,
            "latest_total_valuation": latest_valuation_sum
        }

    async def run_recurring_simulation(
        self,
        allocations: List[Dict[str, Any]],
        period: str,
        rebalancing: str,
        annual_deposit: float
    ) -> Dict[str, Any]:
        """주어진 자산 배분 비중 조합과 설정으로 적립식 백테스트 시뮬레이션을 수행합니다.

        Args:
            allocations (List[Dict]): 각 비중 조합 [{"name": "60/40", "stock_ratio": 60}]
            period (str): '5Y', '10Y', '20Y', '30Y', 'ALL'
            rebalancing (str): 'monthly', 'yearly', 'none'
            annual_deposit (float): 매년 추가 적립금

        Returns:
            Dict[str, Any]: 차트, 요약 카드 및 연도별/월별 현황 데이터
        """
        start_date, end_date = await self.get_date_range(period)

        # 1. S&P500 일별 가격 데이터 가져오기
        prices = (
            self.db.query(HistoricalPrice)
            .filter(
                HistoricalPrice.ticker == "^GSPC",
                HistoricalPrice.price_date >= start_date,
                HistoricalPrice.price_date <= end_date,
                HistoricalPrice.close_price > 0.0
            )
            .order_by(HistoricalPrice.price_date.asc())
            .all()
        )

        if not prices:
            return {
                "chart": {"labels": [], "datasets": []},
                "summaries": [],
                "yearly_stats": {},
                "monthly_stats": {}
            }

        # 1.5. 차트 렌더링 다운샘플링 필터링
        chart_indices = []
        for t in range(len(prices)):
            curr_p = prices[t]
            is_sample_point = False
            
            if t == 0 or t == len(prices) - 1:
                is_sample_point = True
            else:
                next_p = prices[t + 1]
                if period == "5Y":
                    curr_week = curr_p.price_date.isocalendar()[1]
                    next_week = next_p.price_date.isocalendar()[1]
                    if curr_week != next_week:
                        is_sample_point = True
                else:
                    if curr_p.price_date.month != next_p.price_date.month:
                        is_sample_point = True
            
            if is_sample_point:
                chart_indices.append(t)

        chart_indices = sorted(list(set(chart_indices)))
        chart_labels = [prices[idx].price_date.isoformat() for idx in chart_indices]

        # 2. 결과 저장을 위한 데이터 구조 정의
        datasets = []
        summaries = []
        yearly_stats_by_alloc = {}
        monthly_stats_by_alloc = {}

        # 3. 비중 조합별 백테스트 실행
        for alloc in allocations:
            name = alloc.get("name")
            stock_ratio = float(alloc.get("stock_ratio", 100))
            w_s = stock_ratio / 100.0
            w_c = (100.0 - stock_ratio) / 100.0

            # 시뮬레이션 상태 변수 초기화
            portfolio_values = []
            invested_values = []
            portfolio_dates = []

            p_val = 0.0
            invested = 0.0
            qty = 0.0
            cash = 0.0

            # 리밸런싱 및 추가금 일자 판단을 위한 일별 루프
            for t in range(len(prices)):
                curr_p = prices[t]
                
                # 매년 초(연도 변경) 또는 시작일(t=0)에 추가금 주입
                is_deposit_day = False
                if t == 0:
                    is_deposit_day = True
                else:
                    prev_p = prices[t - 1]
                    if curr_p.price_date.year != prev_p.price_date.year:
                        is_deposit_day = True

                if is_deposit_day:
                    p_val += annual_deposit
                    invested += annual_deposit
                    # 비중에 맞게 재조정
                    stock_val = p_val * w_s
                    cash = p_val * w_c
                    qty = stock_val / curr_p.close_price
                else:
                    # 주가 변동에 따른 평가액 반영 (추가금 안 들어오는 날)
                    stock_val = qty * curr_p.close_price
                    p_val = stock_val + cash
                
                # 오늘이 리밸런싱일인지 판정
                is_rebal_day = False
                if t < len(prices) - 1:
                    next_p = prices[t + 1]
                    if rebalancing == "monthly" and curr_p.price_date.month != next_p.price_date.month:
                        is_rebal_day = True
                    elif rebalancing == "yearly" and curr_p.price_date.year != next_p.price_date.year:
                        is_rebal_day = True

                # 리밸런싱 수행
                if is_rebal_day:
                    stock_val = p_val * w_s
                    cash = p_val * w_c
                    qty = stock_val / curr_p.close_price

                portfolio_values.append(p_val)
                invested_values.append(invested)
                portfolio_dates.append(curr_p.price_date)

            # 요약 통계 계산
            final_val = portfolio_values[-1]
            total_invested = invested_values[-1]
            total_interest = final_val - total_invested
            final_return = round(((final_val - total_invested) / total_invested) * 100, 2) if total_invested > 0 else 0.0

            # 포트폴리오 자체의 거치식 CAGR 계산 (기하 연평균 수익률)
            # CAGR은 자산배분 자체의 성장률 지표이므로 거치식 성과를 임시 계산
            lump_p_val = 100.0
            lump_qty = (lump_p_val * w_s) / prices[0].close_price
            lump_cash = lump_p_val * w_c
            for t in range(1, len(prices)):
                curr_p = prices[t]
                lump_stock_val = lump_qty * curr_p.close_price
                lump_p_val = lump_stock_val + lump_cash
                
                is_rebal_day = False
                if t < len(prices) - 1:
                    next_p = prices[t + 1]
                    if rebalancing == "monthly" and curr_p.price_date.month != next_p.price_date.month:
                        is_rebal_day = True
                    elif rebalancing == "yearly" and curr_p.price_date.year != next_p.price_date.year:
                        is_rebal_day = True
                if is_rebal_day:
                    lump_stock_val = lump_p_val * w_s
                    lump_cash = lump_p_val * w_c
                    lump_qty = lump_stock_val / curr_p.close_price

            total_days = (portfolio_dates[-1] - portfolio_dates[0]).days
            if total_days > 0 and lump_p_val > 0:
                cagr = ((lump_p_val / 100.0) ** (365.25 / total_days) - 1.0) * 100
                cagr = round(cagr, 2)
            else:
                cagr = 0.0

            # MDD 계산
            mdd = 0.0
            peak = 0.0
            for v in portfolio_values:
                if v > peak:
                    peak = v
                if peak > 0:
                    dd = (v - peak) / peak * 100
                    if dd < mdd:
                        mdd = dd
            mdd = round(mdd, 2)

            summaries.append({
                "name": name,
                "stock_ratio": stock_ratio,
                "cagr": cagr,
                "mdd": mdd,
                "final_return": final_return,
                "final_valuation": round(final_val, 2),
                "total_invested": round(total_invested, 2),
                "total_interest": round(total_interest, 2)
            })

            # 차트 데이터셋 추가 (금액 기준으로 전송)
            chart_valuations = [round(portfolio_values[idx], 2) for idx in chart_indices]
            datasets.append({
                "label": name,
                "data": chart_valuations
            })

            # 6. 연도별 통계 계산
            yearly_stats = []
            yearly_groups = {}
            for dt, val, inv in zip(portfolio_dates, portfolio_values, invested_values):
                yearly_groups.setdefault(dt.year, []).append((dt, val, inv))

            sorted_years = sorted(yearly_groups.keys())
            for idx, year in enumerate(sorted_years):
                year_data = yearly_groups[year]
                year_end_val = year_data[-1][1]
                year_end_inv = year_data[-1][2]
                
                if idx > 0:
                    prev_year = sorted_years[idx - 1]
                    year_start_val = yearly_groups[prev_year][-1][1]
                    year_start_inv = yearly_groups[prev_year][-1][2]
                else:
                    year_start_val = 0.0
                    year_start_inv = 0.0

                year_deposit = year_end_inv - year_start_inv
                year_interest = year_end_val - year_start_val - year_deposit
                denominator = year_start_val + year_deposit
                year_return = ((year_end_val - denominator) / denominator) * 100 if denominator > 0 else 0.0
                
                cum_interest = year_end_val - year_end_inv
                cum_return = (cum_interest / year_end_inv) * 100 if year_end_inv > 0 else 0.0

                y_mdd = 0.0
                y_peak = 0.0
                for _, v, _ in year_data:
                    if v > y_peak:
                        y_peak = v
                    if y_peak > 0:
                        dd = (v - y_peak) / y_peak * 100
                        if dd < y_mdd:
                            y_mdd = dd

                yearly_stats.append({
                    "year": year,
                    "year_return": round(year_return, 2),
                    "cumulative_return": round(cum_return, 2),
                    "mdd": round(y_mdd, 2),
                    "valuation": round(year_end_val, 2),
                    "invested": round(year_end_inv, 2),
                    "interest": round(cum_interest, 2),
                    "annual_interest": round(year_interest, 2)
                })

            yearly_stats.reverse()
            yearly_stats_by_alloc[name] = yearly_stats

            # 7. 월별 통계 계산
            monthly_stats = []
            monthly_groups = {}
            for dt, val, inv in zip(portfolio_dates, portfolio_values, invested_values):
                monthly_groups.setdefault((dt.year, dt.month), []).append((dt, val, inv))

            sorted_months = sorted(monthly_groups.keys())
            for idx, (year, month) in enumerate(sorted_months):
                month_data = monthly_groups[(year, month)]
                month_end_val = month_data[-1][1]
                month_end_inv = month_data[-1][2]

                if idx > 0:
                    prev_ym = sorted_months[idx - 1]
                    month_start_val = monthly_groups[prev_ym][-1][1]
                    month_start_inv = monthly_groups[prev_ym][-1][2]
                else:
                    month_start_val = 0.0
                    month_start_inv = 0.0

                month_deposit = month_end_inv - month_start_inv
                month_interest = month_end_val - month_start_val - month_deposit
                denominator = month_start_val + month_deposit
                month_return = ((month_end_val - denominator) / denominator) * 100 if denominator > 0 else 0.0
                
                cum_interest = month_end_val - month_end_inv
                cum_return = (cum_interest / month_end_inv) * 100 if month_end_inv > 0 else 0.0

                m_mdd = 0.0
                m_peak = 0.0
                for _, v, _ in month_data:
                    if v > m_peak:
                        m_peak = v
                    if m_peak > 0:
                        dd = (v - m_peak) / m_peak * 100
                        if dd < m_mdd:
                            m_mdd = dd

                monthly_stats.append({
                    "year": year,
                    "month": month,
                    "month_return": round(month_return, 2),
                    "cumulative_return": round(cum_return, 2),
                    "mdd": round(m_mdd, 2),
                    "valuation": round(month_end_val, 2),
                    "invested": round(month_end_inv, 2),
                    "interest": round(cum_interest, 2),
                    "annual_interest": round(month_interest, 2)
                })

            monthly_stats.reverse()
            monthly_stats_by_alloc[name] = monthly_stats

        return {
            "chart": {
                "labels": chart_labels,
                "datasets": datasets
            },
            "summaries": summaries,
            "yearly_stats": yearly_stats_by_alloc,
            "monthly_stats": monthly_stats_by_alloc
        }

    @staticmethod
    def _filter_chart_indices(prices: List[HistoricalPrice], period: str) -> List[int]:
        """차트 렌더링 성능을 위해 기간별로 샘플링 인덱스를 추출합니다."""
        chart_indices = []
        for t in range(len(prices)):
            curr_p = prices[t]
            is_sample_point = False
            if t == 0 or t == len(prices) - 1:
                is_sample_point = True
            else:
                next_p = prices[t + 1]
                if period == "5Y":
                    curr_week = curr_p.price_date.isocalendar()[1]
                    next_week = next_p.price_date.isocalendar()[1]
                    if curr_week != next_week:
                        is_sample_point = True
                else:
                    if curr_p.price_date.month != next_p.price_date.month:
                        is_sample_point = True

            if is_sample_point:
                chart_indices.append(t)

        return sorted(list(set(chart_indices)))

    @staticmethod
    def _calculate_period_stats(
        portfolio_dates: List[datetime.date],
        portfolio_values: List[float],
        invested_values: List[float],
        is_recurring: bool
    ) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """연도별 및 월별 성과 및 MDD 통계를 계산합니다."""
        # 연도별 통계
        yearly_stats = []
        yearly_groups: Dict[int, List[tuple[datetime.date, float, float]]] = {}
        for dt, val, inv in zip(portfolio_dates, portfolio_values, invested_values):
            yearly_groups.setdefault(dt.year, []).append((dt, val, inv))

        sorted_years = sorted(yearly_groups.keys())
        for idx, year in enumerate(sorted_years):
            year_data = yearly_groups[year]
            year_end_val = year_data[-1][1]
            year_end_inv = year_data[-1][2]

            if idx > 0:
                prev_year = sorted_years[idx - 1]
                year_start_val = yearly_groups[prev_year][-1][1]
                year_start_inv = yearly_groups[prev_year][-1][2]
            else:
                year_start_val = 0.0 if is_recurring else 100.0
                year_start_inv = 0.0 if is_recurring else 100.0

            if is_recurring:
                year_deposit = year_end_inv - year_start_inv
                year_interest = year_end_val - year_start_val - year_deposit
                denominator = year_start_val + year_deposit
                year_return = ((year_end_val - denominator) / denominator) * 100 if denominator > 0 else 0.0
                cum_interest = year_end_val - year_end_inv
                cum_return = (cum_interest / year_end_inv) * 100 if year_end_inv > 0 else 0.0
            else:
                year_deposit = 0.0
                year_interest = year_end_val - year_start_val
                year_return = ((year_end_val - year_start_val) / year_start_val) * 100.0 if year_start_val > 0 else 0.0
                cum_interest = year_end_val - 100.0
                cum_return = ((year_end_val - 100.0) / 100.0) * 100.0

            y_mdd = 0.0
            y_peak = 0.0
            for _, v, _ in year_data:
                if v > y_peak:
                    y_peak = v
                if y_peak > 0:
                    dd = (v - y_peak) / y_peak * 100.0
                    if dd < y_mdd:
                        y_mdd = dd

            yearly_stats.append({
                "year": year,
                "year_return": round(year_return, 2),
                "cumulative_return": round(cum_return, 2),
                "mdd": round(y_mdd, 2),
                "valuation": round(year_end_val, 2),
                "invested": round(year_end_inv, 2),
                "interest": round(cum_interest, 2),
                "annual_interest": round(year_interest, 2),
            })

        yearly_stats.reverse()

        # 월별 통계
        monthly_stats = []
        monthly_groups: Dict[tuple[int, int], List[tuple[datetime.date, float, float]]] = {}
        for dt, val, inv in zip(portfolio_dates, portfolio_values, invested_values):
            monthly_groups.setdefault((dt.year, dt.month), []).append((dt, val, inv))

        sorted_months = sorted(monthly_groups.keys())
        for idx, (year, month) in enumerate(sorted_months):
            month_data = monthly_groups[(year, month)]
            month_end_val = month_data[-1][1]
            month_end_inv = month_data[-1][2]

            if idx > 0:
                prev_ym = sorted_months[idx - 1]
                month_start_val = monthly_groups[prev_ym][-1][1]
                month_start_inv = monthly_groups[prev_ym][-1][2]
            else:
                month_start_val = 0.0 if is_recurring else 100.0
                month_start_inv = 0.0 if is_recurring else 100.0

            if is_recurring:
                month_deposit = month_end_inv - month_start_inv
                month_interest = month_end_val - month_start_val - month_deposit
                denominator = month_start_val + month_deposit
                month_return = ((month_end_val - denominator) / denominator) * 100 if denominator > 0 else 0.0
                cum_interest = month_end_val - month_end_inv
                cum_return = (cum_interest / month_end_inv) * 100 if month_end_inv > 0 else 0.0
            else:
                month_deposit = 0.0
                month_interest = month_end_val - month_start_val
                month_return = ((month_end_val - month_start_val) / month_start_val) * 100.0 if month_start_val > 0 else 0.0
                cum_interest = month_end_val - 100.0
                cum_return = ((month_end_val - 100.0) / 100.0) * 100.0

            m_mdd = 0.0
            m_peak = 0.0
            for _, v, _ in month_data:
                if v > m_peak:
                    m_peak = v
                if m_peak > 0:
                    dd = (v - m_peak) / m_peak * 100.0
                    if dd < m_mdd:
                        m_mdd = dd

            monthly_stats.append({
                "year": year,
                "month": month,
                "month_return": round(month_return, 2),
                "cumulative_return": round(cum_return, 2),
                "mdd": round(m_mdd, 2),
                "valuation": round(month_end_val, 2),
                "invested": round(month_end_inv, 2),
                "interest": round(cum_interest, 2),
                "annual_interest": round(month_interest, 2),
            })

        monthly_stats.reverse()
        return yearly_stats, monthly_stats

    async def run_dynamic_simulation(
        self,
        base_stock_ratio: float = 60.0,
        period: str = "5Y",
        rebalancing: str = "monthly",
        mode: str = "recurring",
        annual_deposit: float = 20000000.0,
        tiers: List[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """S&P500 낙폭(Drawdown)과 VIX 지수의 AND 결합 공포 단계에 따른 동적 리밸런싱 백테스트를 수행합니다."""
        if not tiers:
            tiers = [
                {"tier": 1, "dd_threshold": -10.0, "vix_threshold": 25.0, "target_stock_ratio": 75.0},
                {"tier": 2, "dd_threshold": -20.0, "vix_threshold": 30.0, "target_stock_ratio": 90.0},
                {"tier": 3, "dd_threshold": -30.0, "vix_threshold": 40.0, "target_stock_ratio": 100.0},
            ]

        start_date, end_date = await self.get_date_range(period)

        # S&P500 (^GSPC) 일별 가격 조회
        prices_sp = (
            self.db.query(HistoricalPrice)
            .filter(
                HistoricalPrice.ticker == "^GSPC",
                HistoricalPrice.price_date >= start_date,
                HistoricalPrice.price_date <= end_date,
                HistoricalPrice.close_price > 0.0,
            )
            .order_by(HistoricalPrice.price_date.asc())
            .all()
        )

        if not prices_sp:
            return {
                "chart": {"labels": [], "datasets": []},
                "summaries": [],
                "yearly_stats": {},
                "monthly_stats": {},
                "rebalancing_events": [],
            }

        # VIX (^VIX) 일별 가격 조회
        prices_vix = (
            self.db.query(HistoricalPrice)
            .filter(
                HistoricalPrice.ticker == "^VIX",
                HistoricalPrice.price_date >= start_date,
                HistoricalPrice.price_date <= end_date,
                HistoricalPrice.close_price > 0.0,
            )
            .all()
        )
        vix_dict = {p.price_date: p.close_price for p in prices_vix}

        # 차트 다운샘플링 필터링 (헬퍼 메서드 활용)
        chart_indices = self._filter_chart_indices(prices_sp, period)
        chart_labels = [prices_sp[idx].price_date.isoformat() for idx in chart_indices]

        # S&P500 시작일 이전의 역사적 최고가(ATH) 조회하여 초기 peak_sp로 설정
        ath_row = (
            self.db.query(func.max(HistoricalPrice.close_price))
            .filter(
                HistoricalPrice.ticker == "^GSPC",
                HistoricalPrice.price_date <= start_date,
                HistoricalPrice.close_price > 0.0,
            )
            .first()
        )
        peak_sp = float(ath_row[0]) if ath_row and ath_row[0] else 0.0

        sp_drawdowns = []
        sp_vix_list = []
        for p in prices_sp:
            if p.close_price > peak_sp:
                peak_sp = p.close_price
            dd = ((p.close_price - peak_sp) / peak_sp) * 100.0 if peak_sp > 0 else 0.0
            sp_drawdowns.append(dd)
            sp_vix_list.append(vix_dict.get(p.price_date, 20.0))

        # 공포 강도 내림차순(target_stock_ratio 역순)으로 티어 정렬
        sorted_tiers = sorted(tiers, key=lambda x: x.get("target_stock_ratio", 0.0), reverse=True)

        def get_matching_tier(dd: float, vix: float):
            for tier in sorted_tiers:
                if dd <= tier.get("dd_threshold", 0.0) and vix >= tier.get("vix_threshold", 0.0):
                    return tier
            return None

        # 3가지 시뮬레이션 설정 정의
        strategies = [
            {"type": "dynamic", "name": "동적 리밸런싱 전략"},
            {"type": "regular", "name": "일반 정기 리밸런싱"},
            {"type": "buy_and_hold", "name": "S&P 500 단순 보유"},
        ]

        datasets = []
        summaries = []
        yearly_stats_by_alloc = {}
        monthly_stats_by_alloc = {}
        rebalancing_events = []

        is_recurring = (mode == "recurring")

        for strat in strategies:
            strat_type = strat["type"]
            name = strat["name"]

            portfolio_values = []
            invested_values = []
            portfolio_dates = []

            p_val = 0.0
            invested = 0.0
            qty = 0.0
            cash = 0.0

            curr_target_ratio = 100.0 if strat_type == "buy_and_hold" else base_stock_ratio

            for t in range(len(prices_sp)):
                curr_p = prices_sp[t]
                curr_dd = sp_drawdowns[t]
                curr_vix = sp_vix_list[t]

                # 1. 추가금 주입일 판정
                is_deposit_day = False
                if is_recurring:
                    if t == 0:
                        is_deposit_day = True
                    else:
                        prev_p = prices_sp[t - 1]
                        if curr_p.price_date.year != prev_p.price_date.year:
                            is_deposit_day = True
                else:
                    if t == 0:
                        is_deposit_day = True

                if is_deposit_day:
                    dep_amount = annual_deposit if is_recurring else 100.0
                    p_val += dep_amount
                    invested += dep_amount

                    stock_val = p_val * (curr_target_ratio / 100.0)
                    cash = p_val - stock_val
                    qty = stock_val / curr_p.close_price
                else:
                    stock_val = qty * curr_p.close_price
                    p_val = stock_val + cash

                # 2. 정기 점검일 여부 판정
                is_scheduled_rebal = False
                if t < len(prices_sp) - 1:
                    next_p = prices_sp[t + 1]
                    if rebalancing == "monthly" and curr_p.price_date.month != next_p.price_date.month:
                        is_scheduled_rebal = True
                    elif rebalancing == "yearly" and curr_p.price_date.year != next_p.price_date.year:
                        is_scheduled_rebal = True
                else:
                    is_month_end = (curr_p.price_date + datetime.timedelta(days=1)).month != curr_p.price_date.month
                    is_year_end = (curr_p.price_date + datetime.timedelta(days=1)).year != curr_p.price_date.year
                    is_friday = (curr_p.price_date.weekday() == 4)
                    next_mon = curr_p.price_date + datetime.timedelta(days=3)
                    if rebalancing == "monthly" and (is_month_end or (is_friday and next_mon.month != curr_p.price_date.month)):
                        is_scheduled_rebal = True
                    elif rebalancing == "yearly" and (is_year_end or (is_friday and next_mon.year != curr_p.price_date.year)):
                        is_scheduled_rebal = True

                # 3. 전략별 비중 조정 로직
                if strat_type == "dynamic":
                    matching_tier = get_matching_tier(curr_dd, curr_vix)

                    if matching_tier is not None:
                        tier_target = float(matching_tier.get("target_stock_ratio", curr_target_ratio))
                        if tier_target > curr_target_ratio:
                            old_ratio = (stock_val / p_val * 100.0) if p_val > 0 else curr_target_ratio
                            curr_target_ratio = tier_target
                            stock_val = p_val * (curr_target_ratio / 100.0)
                            cash = p_val - stock_val
                            qty = stock_val / curr_p.close_price

                            tier_num = matching_tier.get("tier", 1)
                            rebalancing_events.append({
                                "date": curr_p.price_date.isoformat(),
                                "event_type": f"공포 단계 발동 (티어 {tier_num})",
                                "event_code": "PANIC_BUY",
                                "tier": tier_num,
                                "sp500_price": round(curr_p.close_price, 2),
                                "drawdown": round(curr_dd, 2),
                                "vix": round(curr_vix, 2),
                                "old_stock_ratio": round(old_ratio, 1),
                                "new_stock_ratio": round(curr_target_ratio, 1),
                            })
                        elif is_scheduled_rebal:
                            stock_val = p_val * (curr_target_ratio / 100.0)
                            cash = p_val - stock_val
                            qty = stock_val / curr_p.close_price

                    else:
                        if is_scheduled_rebal:
                            old_ratio = (stock_val / p_val * 100.0) if p_val > 0 else curr_target_ratio
                            had_expanded = (curr_target_ratio != base_stock_ratio)
                            curr_target_ratio = base_stock_ratio
                            stock_val = p_val * (curr_target_ratio / 100.0)
                            cash = p_val - stock_val
                            qty = stock_val / curr_p.close_price

                            if had_expanded:
                                rebalancing_events.append({
                                    "date": curr_p.price_date.isoformat(),
                                    "event_type": "정기 복귀",
                                    "event_code": "RECOVERY",
                                    "tier": None,
                                    "sp500_price": round(curr_p.close_price, 2),
                                    "drawdown": round(curr_dd, 2),
                                    "vix": round(curr_vix, 2),
                                    "old_stock_ratio": round(old_ratio, 1),
                                    "new_stock_ratio": round(curr_target_ratio, 1),
                                })

                elif strat_type == "regular":
                    if is_scheduled_rebal:
                        stock_val = p_val * (base_stock_ratio / 100.0)
                        cash = p_val - stock_val
                        qty = stock_val / curr_p.close_price

                elif strat_type == "buy_and_hold":
                    pass

                portfolio_values.append(p_val)
                invested_values.append(invested)
                portfolio_dates.append(curr_p.price_date)

            # 지표 계산
            final_val = portfolio_values[-1]
            total_invested = invested_values[-1]
            total_interest = final_val - total_invested
            final_return = round(((final_val - total_invested) / total_invested) * 100, 2) if total_invested > 0 else 0.0

            # CAGR 계산
            total_days = (portfolio_dates[-1] - portfolio_dates[0]).days
            if is_recurring:
                lump_val = 100.0
                lump_w = base_stock_ratio / 100.0 if strat_type != "buy_and_hold" else 1.0
                lump_qty = (lump_val * lump_w) / prices_sp[0].close_price
                lump_cash = lump_val * (1.0 - lump_w)
                lump_target_w = lump_w

                for t in range(1, len(prices_sp)):
                    curr_p = prices_sp[t]
                    curr_dd = sp_drawdowns[t]
                    curr_vix = sp_vix_list[t]
                    lump_s = lump_qty * curr_p.close_price
                    lump_val = lump_s + lump_cash

                    is_rebal = False
                    if t < len(prices_sp) - 1:
                        next_p = prices_sp[t + 1]
                        if rebalancing == "monthly" and curr_p.price_date.month != next_p.price_date.month:
                            is_rebal = True
                        elif rebalancing == "yearly" and curr_p.price_date.year != next_p.price_date.year:
                            is_rebal = True

                    if strat_type == "dynamic":
                        m_tier = get_matching_tier(curr_dd, curr_vix)
                        if m_tier is not None:
                            t_ratio = float(m_tier.get("target_stock_ratio", lump_target_w * 100.0)) / 100.0
                            if t_ratio > lump_target_w:
                                lump_target_w = t_ratio
                                lump_s = lump_val * lump_target_w
                                lump_cash = lump_val - lump_s
                                lump_qty = lump_s / curr_p.close_price
                            elif is_rebal:
                                lump_s = lump_val * lump_target_w
                                lump_cash = lump_val - lump_s
                                lump_qty = lump_s / curr_p.close_price
                        else:
                            if is_rebal:
                                lump_target_w = base_stock_ratio / 100.0
                                lump_s = lump_val * lump_target_w
                                lump_cash = lump_val - lump_s
                                lump_qty = lump_s / curr_p.close_price
                    elif strat_type == "regular":
                        if is_rebal:
                            lump_s = lump_val * (base_stock_ratio / 100.0)
                            lump_cash = lump_val - lump_s
                            lump_qty = lump_s / curr_p.close_price

                cagr = round(((lump_val / 100.0) ** (365.25 / total_days) - 1.0) * 100, 2) if total_days > 0 and lump_val > 0 else 0.0
            else:
                cagr = round(((final_val / 100.0) ** (365.25 / total_days) - 1.0) * 100, 2) if total_days > 0 and final_val > 0 else 0.0

            # MDD 계산
            mdd = 0.0
            peak = 0.0
            for v in portfolio_values:
                if v > peak:
                    peak = v
                if peak > 0:
                    dd = (v - peak) / peak * 100.0
                    if dd < mdd:
                        mdd = dd
            mdd = round(mdd, 2)

            # 일별 수익률 기반 연율화 변동성(Volatility) 계산
            daily_returns = []
            for i in range(1, len(portfolio_values)):
                prev_v = portfolio_values[i - 1]
                curr_v = portfolio_values[i]
                if prev_v > 0:
                    dep = (invested_values[i] - invested_values[i - 1]) if is_recurring else 0.0
                    ret = (curr_v - prev_v - dep) / prev_v
                    daily_returns.append(ret)
            if len(daily_returns) > 1:
                mean_r = sum(daily_returns) / len(daily_returns)
                var_r = sum((r - mean_r) ** 2 for r in daily_returns) / (len(daily_returns) - 1)
                volatility = round(math.sqrt(var_r * 252) * 100.0, 2)
            else:
                volatility = 0.0

            summaries.append({
                "name": name,
                "stock_ratio": base_stock_ratio if strat_type != "buy_and_hold" else 100.0,
                "cagr": cagr,
                "mdd": mdd,
                "volatility": volatility,
                "final_return": final_return,
                "final_valuation": round(final_val, 2),
                "total_invested": round(total_invested, 2),
                "total_interest": round(total_interest, 2),
            })

            # 차트 데이터셋 추가
            if is_recurring:
                chart_data = [portfolio_values[idx] for idx in chart_indices]
            else:
                chart_data = [
                    round(((portfolio_values[idx] - 100.0) / 100.0) * 100.0, 2)
                    for idx in chart_indices
                ]

            datasets.append({
                "label": name,
                "data": chart_data,
            })

            # 연도별 및 월별 통계 계산 (헬퍼 메서드 활용)
            y_stats, m_stats = self._calculate_period_stats(
                portfolio_dates, portfolio_values, invested_values, is_recurring
            )
            yearly_stats_by_alloc[name] = y_stats
            monthly_stats_by_alloc[name] = m_stats

        return {
            "chart": {
                "labels": chart_labels,
                "datasets": datasets,
            },
            "summaries": summaries,
            "yearly_stats": yearly_stats_by_alloc,
            "monthly_stats": monthly_stats_by_alloc,
            "rebalancing_events": rebalancing_events,
        }

