# -*- coding: utf-8 -*-
"""주요 시장 지수의 역사적 가격 데이터, 통계 및 수익률 비교를 처리하는 서비스 모듈입니다."""

import datetime
from typing import List, Dict, Any
import pandas as pd
from sqlalchemy.orm import Session

from src.backend.models import HistoricalPrice
from src.backend.services.benchmark_service import BenchmarkService


class MarketAnalysisService:
    """주요 시장 지수(^GSPC, ^IXIC, ^KS11, ^KQ11)의 데이터 분석 서비스를 제공합니다."""

    def __init__(self, db: Session):
        """MarketAnalysisService를 초기화합니다.

        Args:
            db (Session): 데이터베이스 세션 객체
        """
        self.db = db
        self.benchmark_service = BenchmarkService(db)

    async def get_historical_data(
        self, ticker: str, start_date: datetime.date, end_date: datetime.date
    ) -> Dict[str, Any]:
        """특정 지수의 역사적 시계열 데이터와 계산된 MDD 추이 데이터를 반환합니다.

        3년(1095일) 초과 기간을 조회하는 경우 차트 성능 최적화를 위해 주간 종가 단위로 다운샘플링합니다.

        Args:
            ticker (str): 지수 티커
            start_date (date): 시작일
            end_date (date): 종료일

        Returns:
            Dict[str, Any]: 날짜 라벨, 지수 값, MDD 리스트를 포함한 딕셔너리
        """
        # 1. 역사적 가격 데이터 로드 (캐시 갱신 포함)
        prices = await self.benchmark_service.get_historical_prices(ticker, start_date, end_date)
        valid_prices = [p for p in prices if p.close_price > 0.0]

        if not valid_prices:
            return {"labels": [], "prices": [], "mdd": []}

        # 2. 조회 기간 일수 계산
        total_days = (end_date - start_date).days
        
        # 3. 3년(1095일) 초과인 경우 주간 다운샘플링 적용 (pandas 활용)
        if total_days > 1095 and len(valid_prices) > 200:
            df = pd.DataFrame([
                {"date": p.price_date, "price": p.close_price}
                for p in valid_prices
            ])
            df["date"] = pd.to_datetime(df["date"])
            df.set_index("date", inplace=True)
            
            # 주간(W-FRI: 금요일 기준 또는 그 주의 마지막 유효일) 단위로 리샘플링하여 종가 추출
            # 'W'는 일요일 기준 주간 리샘플링이며, 영업일이 있는 주만 남김
            df_resampled = df.resample("W").last().dropna()
            
            labels = [idx.date().isoformat() for idx in df_resampled.index]
            prices_list = [float(val) for val in df_resampled["price"]]
        else:
            # 3년 이하일 경우 일별 데이터 그대로 사용
            labels = [p.price_date.isoformat() for p in valid_prices]
            prices_list = [p.close_price for p in valid_prices]

        # 4. MDD 추이 계산 (고점 대비 낙폭)
        mdd_series = []
        peak = 0.0
        for price in prices_list:
            if price > peak:
                peak = price
            if peak > 0.0:
                dd = ((price - peak) / peak) * 100
            else:
                dd = 0.0
            mdd_series.append(round(dd, 2))

        return {
            "labels": labels,
            "prices": prices_list,
            "mdd": mdd_series
        }

    async def get_monthly_and_yearly_stats(
        self, ticker: str, start_date: datetime.date, end_date: datetime.date
    ) -> Dict[str, Any]:
        """특정 지수의 연도별 및 월별 상세 성과 통계(수익률, 기말 지수, MDD)를 반환합니다.

        Args:
            ticker (str): 지수 티커
            start_date (date): 시작일
            end_date (date): 종료일

        Returns:
            Dict[str, Any]: 연도별 통계 리스트 및 월별 통계 리스트
        """
        # 통계 산출을 위해 시작일을 약 10일 전부터 넓게 잡아 이전 기말 종가(전월/전년 말 종가)를 확보합니다.
        extended_start = start_date - datetime.timedelta(days=10)
        prices = await self.benchmark_service.get_historical_prices(ticker, extended_start, end_date)
        valid_prices = [p for p in prices if p.close_price > 0.0]

        if not valid_prices:
            return {"yearly": [], "monthly": []}

        # 날짜순 정렬
        valid_prices.sort(key=lambda x: x.price_date)

        # 1. 연도별 및 월별 데이터 그룹화
        yearly_groups: Dict[int, List[HistoricalPrice]] = {}
        monthly_groups: Dict[tuple[int, int], List[HistoricalPrice]] = {}

        for p in valid_prices:
            dt = p.price_date
            # 요청한 기간 내의 데이터만 그룹에 추가 (이전 데이터는 기준가 탐색용으로만 활용)
            if dt >= start_date:
                yearly_groups.setdefault(dt.year, []).append(p)
                monthly_groups.setdefault((dt.year, dt.month), []).append(p)

        # 2. 연도별 통계 계산
        yearly_stats = []
        sorted_years = sorted(yearly_groups.keys())
        for year in sorted_years:
            year_data = yearly_groups[year]
            if not year_data:
                continue
            year_end_val = year_data[-1].close_price

            # 직전 연도 마지막 영업일 종가 찾기
            prev_year_end_val = None
            # 전체 valid_prices 중 해당 연도 시작 직전의 종가 탐색
            for p in reversed(valid_prices):
                if p.price_date < year_data[0].price_date:
                    prev_year_end_val = p.close_price
                    break
            
            # 이전 데이터가 없다면 해당 연도의 첫 영업일 종가를 기준가로 삼음
            base_val = prev_year_end_val if prev_year_end_val is not None else year_data[0].close_price
            
            # 연간 수익률
            return_rate = 0.0
            if base_val > 0.0:
                return_rate = ((year_end_val - base_val) / base_val) * 100

            # 연간 MDD 계산 (당해 연도 고점 대비 낙폭)
            y_peak = 0.0
            y_mdd = 0.0
            for p in year_data:
                val = p.close_price
                if val > y_peak:
                    y_peak = val
                if y_peak > 0.0:
                    dd = ((val - y_peak) / y_peak) * 100
                    if dd < y_mdd:
                        y_mdd = dd

            yearly_stats.append({
                "year": year,
                "close_price": round(year_end_val, 2),
                "return_rate": round(return_rate, 2),
                "mdd": round(y_mdd, 2)
            })

        # 3. 월별 통계 계산
        monthly_stats = []
        sorted_months = sorted(monthly_groups.keys())
        for year, month in sorted_months:
            month_data = monthly_groups[(year, month)]
            if not month_data:
                continue
            month_end_val = month_data[-1].close_price

            # 직전 월 마지막 영업일 종가 찾기
            prev_month_end_val = None
            for p in reversed(valid_prices):
                if p.price_date < month_data[0].price_date:
                    prev_month_end_val = p.close_price
                    break

            base_val = prev_month_end_val if prev_month_end_val is not None else month_data[0].close_price

            # 월간 수익률
            return_rate = 0.0
            if base_val > 0.0:
                return_rate = ((month_end_val - base_val) / base_val) * 100

            # 월간 MDD 계산 (해당 월 고점 대비 낙폭)
            m_peak = 0.0
            m_mdd = 0.0
            for p in month_data:
                val = p.close_price
                if val > m_peak:
                    m_peak = val
                if m_peak > 0.0:
                    dd = ((val - m_peak) / m_peak) * 100
                    if dd < m_mdd:
                        m_mdd = dd

            monthly_stats.append({
                "year": year,
                "month": month,
                "close_price": round(month_end_val, 2),
                "return_rate": round(return_rate, 2),
                "mdd": round(m_mdd, 2)
            })

        # 최신순(내림차순) 정렬하여 반환
        yearly_stats.reverse()
        monthly_stats.reverse()

        return {
            "yearly": yearly_stats,
            "monthly": monthly_stats
        }

    async def get_index_comparison_table(self) -> List[Dict[str, Any]]:
        """4대 주요 지수의 연도별 수익률 비교 데이터를 제공합니다.

        Returns:
            List[Dict[str, Any]]: 연도별 4대 지수 수익률을 매핑한 리스트
        """
        # 4대 지수 정의
        ticker_mapping = {
            "^KS11": "kospi",
            "^KQ11": "kosdaq",
            "^GSPC": "sp500",
            "^IXIC": "nasdaq"
        }
        tickers = list(ticker_mapping.keys())
        today = datetime.date.today()

        # 4대 지수 각각의 데이터가 존재하는 최초의 날짜(최소 날짜)를 DB에서 동적으로 조회합니다.
        # 4대 지수 모두 데이터가 준비되어 있는 첫 해부터 비교할 수 있도록 시작 연도를 결정합니다.
        from sqlalchemy import func
        min_dates_query = (
            self.db.query(HistoricalPrice.ticker, func.min(HistoricalPrice.price_date))
            .filter(HistoricalPrice.ticker.in_(tickers), HistoricalPrice.close_price > 0.0)
            .group_by(HistoricalPrice.ticker)
            .all()
        )
        
        min_years = [date_val.year for _, date_val in min_dates_query if date_val]
        
        # 각 지수의 시작 연도 중 가장 최신(최대) 연도를 시작 연도로 삼습니다.
        # 조회된 데이터가 없을 경우 기본값으로 2020년을 사용합니다.
        start_year = max(min_years) if min_years else 2020
        end_year = today.year
        start_date = datetime.date(start_year, 1, 1)

        # 4대 지수 시세 일괄 조회 및 캐싱 보장
        for ticker in tickers:
            await self.benchmark_service.get_historical_prices(ticker, start_date, today)

        comparison_table = []

        # 각 연도별로 수익률 계산
        for year in range(start_year, end_year + 1):
            row = {"year": year}
            year_start = datetime.date(year, 1, 1)
            year_end = today if year == end_year else datetime.date(year, 12, 31)

            for ticker, name in ticker_mapping.items():
                # 통계 계산 기준과 동일하게 직전 기말 종가를 찾기 위해 시작일 전 10일 여유를 두고 조회
                prices = await self.benchmark_service.get_historical_prices(
                    ticker, year_start - datetime.timedelta(days=10), year_end
                )
                valid_prices = [p for p in prices if p.close_price > 0.0]
                
                # 해당 연도에 속하는 시세 필터링
                curr_year_prices = [p for p in valid_prices if p.price_date.year == year]
                
                if not curr_year_prices:
                    row[name] = 0.0
                    continue

                curr_year_prices.sort(key=lambda x: x.price_date)
                year_end_val = curr_year_prices[-1].close_price

                # 직전 영업일 종가 찾기
                prev_year_end_val = None
                for p in reversed(valid_prices):
                    if p.price_date < curr_year_prices[0].price_date:
                        prev_year_end_val = p.close_price
                        break

                base_val = prev_year_end_val if prev_year_end_val is not None else curr_year_prices[0].close_price
                
                return_rate = 0.0
                if base_val > 0.0:
                    return_rate = ((year_end_val - base_val) / base_val) * 100
                
                row[name] = round(return_rate, 2)

            comparison_table.append(row)

        # 최신 연도순(내림차순) 정렬
        comparison_table.reverse()
        return comparison_table
