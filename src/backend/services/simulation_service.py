import datetime
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
