import datetime
from typing import List, Dict, Any, Tuple
import pandas as pd
from sqlalchemy.orm import Session
from src.backend.services.benchmark_service import BenchmarkService

class AllocationService:
    """동적 자산배분 모델 스코어링 및 백테스트 시뮬레이션을 수행하는 서비스 클래스입니다."""

    INDEX_TICKERS = {
        "KOSPI": "^KS11",
        "KOSDAQ": "^KQ11",
        "S&P500": "^GSPC",
        "NASDAQ": "^IXIC"
    }

    def __init__(self, db: Session):
        """AllocationService를 초기화합니다.

        Args:
            db (Session): 데이터베이스 세션 객체
        """
        self.db = db
        self.benchmark_service = BenchmarkService(db) if db else None

    def calculate_allocation_score(self, price_today: float, ma_val: float, price_past: float, vix_today: float, vix_threshold: float) -> int:
        """3점 만점 하이브리드 스코어를 계산합니다.

        스코어링 규칙:
        1. 추세 점수 (+1점): 현재 지수의 가격이 이동평균선 위에 있으면 +1점
        2. 모멘텀 점수 (+1점): 현재 지수의 가격이 lookback 기간 전 가격보다 높으면 +1점
        3. 심리 공포 점수 (+1점): VIX 지수가 임계값 미만(안정)이면 +1점

        Args:
            price_today (float): 오늘 지수 종가
            ma_val (float): 이동평균선 값
            price_past (float): lookback 전 과거 지수 가격
            vix_today (float): 오늘 VIX 종가
            vix_threshold (float): VIX 임계값

        Returns:
            int: 0 ~ 3점 사이의 점수
        """
        score = 0
        if price_today > ma_val:
            score += 1
        if price_today > price_past:
            score += 1
        if vix_today < vix_threshold:
            score += 1
        return score

    def adjust_weights(self, score: int, min_cash_weight: float, max_cash_weight: float) -> Tuple[float, float]:
        """점수별 기본 비중에 제약 조건을 적용하여 최종 주식 및 현금 비중을 결정합니다.

        점수별 기본 현금 비율:
        - 3점: 현금 0% / 주식 100%
        - 2점: 현금 35% / 주식 65%
        - 1점: 현금 65% / 주식 35%
        - 0점: 현금 100% / 주식 0%

        공식:
        최종 현금 비중 = min(max(계산된 현금 비중, 최소 현금 비중), 최대 현금 비중)
        최종 주식 비중 = 100% - 최종 현금 비중

        Args:
            score (int): 0 ~ 3점 스코어
            min_cash_weight (float): 최소 현금 비중 (%)
            max_cash_weight (float): 최대 현금 비중 (%)

        Returns:
            Tuple[float, float]: (최종 주식 비중, 최종 현금 비중)
        """
        base_cash_weights = {
            3: 0.0,
            2: 35.0,
            1: 65.0,
            0: 100.0
        }
        raw_cash_w = base_cash_weights.get(score, 100.0)
        
        # Clamping
        final_cash_w = min(max(raw_cash_w, min_cash_weight), max_cash_weight)
        final_stock_w = 100.0 - final_cash_w
        
        return final_stock_w, final_cash_w

    def run_backtest(
        self,
        target_index: str,
        lookback_period: int = 200,
        rebalancing_frequency: str = "매월 말",
        vix_threshold: float = 30.0,
        min_cash_weight: float = 10.0,
        max_cash_weight: float = 40.0,
        start_date: str = "1990-01-01",
        end_date: str = None
    ) -> Dict[str, Any]:
        """과거 데이터를 수집하여 동적 자산배분 백테스트를 수행합니다.

        Args:
            target_index (str): KOSPI, KOSDAQ, S&P500, NASDAQ 중 택1
            lookback_period (int): 과거 룩백 기간 (기본 200일)
            rebalancing_frequency (str): 매일, 매월 말, 매 분기 말
            vix_threshold (float): VIX 지수 공포 임계값 (기본 30)
            min_cash_weight (float): 최소 현금 비중 (%)
            max_cash_weight (float): 최대 현금 비중 (%)
            start_date (str): 시작 날짜 (YYYY-MM-DD)
            end_date (str): 종료 날짜 (YYYY-MM-DD)

        Returns:
            Dict[str, Any]: 백테스트 성과 지표 및 차트 데이터 시계열
        """
        # 1. 티커 변환 및 날짜 설정
        index_ticker = self.INDEX_TICKERS.get(target_index)
        if not index_ticker:
            raise ValueError(f"지원하지 않는 지수입니다: {target_index}")
        
        vix_ticker = "^VIX"
        
        # 날짜 파싱
        try:
            start_date_parsed = datetime.datetime.strptime(start_date, "%Y-%m-%d").date()
        except ValueError:
            start_date_parsed = datetime.date(1990, 1, 1)
            
        if end_date:
            try:
                end_date_parsed = datetime.datetime.strptime(end_date, "%Y-%m-%d").date()
            except ValueError:
                end_date_parsed = datetime.date.today()
        else:
            end_date_parsed = datetime.date.today()
        
        # lookback 데이터 연산을 위해 시작일을 사용자가 지정한 날짜보다 여유있게 (룩백 기간의 약 1.5배) 더 전으로 잡음
        db_lookback_days = int(lookback_period * 1.5 + 30)
        db_start_date = start_date_parsed - datetime.timedelta(days=db_lookback_days)
        
        # 2. 가격 데이터 수집 (db 캐싱 지원)
        if self.benchmark_service:
            import asyncio
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
            if loop.is_running():
                prices_index = loop.run_until_complete(self.benchmark_service.get_historical_prices(index_ticker, db_start_date, end_date_parsed))
                prices_vix = loop.run_until_complete(self.benchmark_service.get_historical_prices(vix_ticker, db_start_date, end_date_parsed))
            else:
                prices_index = asyncio.run(self.benchmark_service.get_historical_prices(index_ticker, db_start_date, end_date_parsed))
                prices_vix = asyncio.run(self.benchmark_service.get_historical_prices(vix_ticker, db_start_date, end_date_parsed))
        else:
            prices_index = []
            prices_vix = []

        # 3. Pandas DataFrame으로 가격 데이터 정렬 및 결합
        df_index = pd.DataFrame([{"date": p.price_date, "close": p.close_price} for p in prices_index if p.close_price > 0])
        df_vix = pd.DataFrame([{"date": p.price_date, "vix": p.close_price} for p in prices_vix if p.close_price > 0])

        if df_index.empty or df_vix.empty:
            return {
                "cagr": 0.0,
                "mdd": 0.0,
                "strategy_returns": [],
                "benchmark_returns": [],
                "dates": [],
                "today_recommendation": {
                    "recommended_stock_weight": 0.0,
                    "recommended_cash_weight": 0.0,
                    "current_score": 0,
                    "score_breakdown": {}
                }
            }

        df_index.set_index("date", inplace=True)
        df_vix.set_index("date", inplace=True)
        
        # 날짜 오름차순 정렬 및 결합
        df = df_index.join(df_vix, how="inner").sort_index()

        # 4. 이동평균 및 모멘텀 계산
        df["ma"] = df["close"].rolling(window=lookback_period).mean()
        df["past_close"] = df["close"].shift(lookback_period)

        # lookback 기간 동안은 지표 계산이 불가능하므로 dropna
        df.dropna(subset=["ma", "past_close"], inplace=True)

        # 실제 시뮬레이션 기간으로 필터링
        df = df[(df.index >= start_date_parsed) & (df.index <= end_date_parsed)]

        if df.empty:
            return {
                "cagr": 0.0,
                "mdd": 0.0,
                "strategy_returns": [],
                "benchmark_returns": [],
                "dates": [],
                "today_recommendation": {
                    "recommended_stock_weight": 0.0,
                    "recommended_cash_weight": 0.0,
                    "current_score": 0,
                    "score_breakdown": {}
                }
            }

        # 5. 리밸런싱 일자 정의
        df["rebalance"] = False
        if rebalancing_frequency == "매일":
            df["rebalance"] = True
        elif rebalancing_frequency == "매월 말":
            # 매월 말 영업일 찾기 (Group by year-month and get max index)
            ym = df.index.to_series().apply(lambda d: f"{d.year}-{d.month:02d}")
            last_days = df.groupby(ym).apply(lambda g: g.index.max())
            df.loc[last_days, "rebalance"] = True
        elif rebalancing_frequency == "매 분기 말":
            # 3, 6, 9, 12월의 마지막 영업일 찾기
            ym = df.index.to_series().apply(lambda d: f"{d.year}-{d.month:02d}")
            quarter_months = [3, 6, 9, 12]
            df_q = df[df.index.to_series().apply(lambda d: d.month in quarter_months)]
            if not df_q.empty:
                ym_q = df_q.index.to_series().apply(lambda d: f"{d.year}-{d.month:02d}")
                last_days = df_q.groupby(ym_q).apply(lambda g: g.index.max())
                df.loc[last_days, "rebalance"] = True
        else:
            # 기본값 매월 말
            ym = df.index.to_series().apply(lambda d: f"{d.year}-{d.month:02d}")
            last_days = df.groupby(ym).apply(lambda g: g.index.max())
            df.loc[last_days, "rebalance"] = True


        # 6. 시뮬레이션 루프 수행
        # 초기화
        portfolio_value = 100.0
        initial_value = 100.0
        
        # 첫 번째 거래일 정보로 비중 초기화
        first_row = df.iloc[0]
        score = self.calculate_allocation_score(
            price_today=first_row["close"],
            ma_val=first_row["ma"],
            price_past=first_row["past_close"],
            vix_today=first_row["vix"],
            vix_threshold=vix_threshold
        )
        stock_w, cash_w = self.adjust_weights(score, min_cash_weight, max_cash_weight)
        
        strategy_history = []
        benchmark_history = []
        
        # 첫 번째 날 가치 저장
        strategy_history.append(portfolio_value)
        benchmark_history.append(100.0)
        
        base_index_price = first_row["close"]
        
        # 두 번째 날부터 시뮬레이션
        for i in range(1, len(df)):
            date = df.index[i]
            row = df.iloc[i]
            prev_row = df.iloc[i-1]
            
            # 주식 수익률 계산
            stock_return = (row["close"] / prev_row["close"]) - 1.0
            
            # 오늘의 포트폴리오 가치 = 어제 가치 * (1 + 주식비중 * 주식수익률)
            # 비중이 % 단위(0~100)이므로 100으로 나눔
            portfolio_value = portfolio_value * (1.0 + (stock_w / 100.0) * stock_return)
            
            # 리밸런싱 일자라면 비중을 재조정 (오늘 종가 기준으로 계산하여 내일 수익률부터 반영)
            if row["rebalance"]:
                score = self.calculate_allocation_score(
                    price_today=row["close"],
                    ma_val=row["ma"],
                    price_past=row["past_close"],
                    vix_today=row["vix"],
                    vix_threshold=vix_threshold
                )
                stock_w, cash_w = self.adjust_weights(score, min_cash_weight, max_cash_weight)
                
            strategy_history.append(portfolio_value)
            
            # 벤치마크 (Buy & Hold) 가치 = (오늘 지수 가격 / 시작일 지수 가격) * 100
            benchmark_val = (row["close"] / base_index_price) * 100.0
            benchmark_history.append(benchmark_val)

        # 7. 성과 지표 계산 (CAGR, MDD)
        start_date_sim = df.index[0]
        end_date_sim = df.index[-1]
        years = (end_date_sim - start_date_sim).days / 365.25
        
        cagr = 0.0
        if years > 0 and portfolio_value > 0:
            cagr = ((portfolio_value / initial_value) ** (1.0 / years) - 1.0) * 100.0
            cagr = round(cagr, 2)
            
        # MDD 계산
        strategy_series = pd.Series(strategy_history)
        peaks = strategy_series.cummax()
        drawdowns = (strategy_series - peaks) / peaks * 100.0
        mdd = abs(drawdowns.min())
        mdd = round(mdd, 2)

        # 벤치마크 지수의 CAGR 및 MDD 계산
        benchmark_cagr = 0.0
        if years > 0 and benchmark_history[-1] > 0:
            benchmark_cagr = ((benchmark_history[-1] / 100.0) ** (1.0 / years) - 1.0) * 100.0
            benchmark_cagr = round(benchmark_cagr, 2)
            
        benchmark_series = pd.Series(benchmark_history)
        bench_peaks = benchmark_series.cummax()
        bench_drawdowns = (benchmark_series - bench_peaks) / bench_peaks * 100.0
        benchmark_mdd = abs(bench_drawdowns.min())
        benchmark_mdd = round(benchmark_mdd, 2)

        # 연간/월간 수익률 계산을 위해 데이터프레임에 임시 가치 매핑
        df["strategy_val"] = strategy_history
        df["benchmark_val"] = benchmark_history

        annual_returns = self._calculate_annual_returns(df)
        monthly_returns = self._calculate_monthly_returns(df)
        
        # 오늘 자 추천 비중 계산 (최종일 데이터 기준)
        last_row = df.iloc[-1]
        last_score = self.calculate_allocation_score(
            price_today=last_row["close"],
            ma_val=last_row["ma"],
            price_past=last_row["past_close"],
            vix_today=last_row["vix"],
            vix_threshold=vix_threshold
        )
        rec_stock_w, rec_cash_w = self.adjust_weights(last_score, min_cash_weight, max_cash_weight)
        
        today_recommendation = {
            "recommended_stock_weight": rec_stock_w,
            "recommended_cash_weight": rec_cash_w,
            "current_score": last_score,
            "score_breakdown": {
                "trend_pass": bool(last_row["close"] > last_row["ma"]),
                "momentum_pass": bool(last_row["close"] > last_row["past_close"]),
                "vix_stable": bool(last_row["vix"] < vix_threshold),
                "trend_val": float(last_row["close"]),
                "ma_val": float(last_row["ma"]),
                "past_val": float(last_row["past_close"]),
                "vix_val": float(last_row["vix"])
            }
        }

        # 8. 최종 결과 취합
        # 수익률 곡선 (0% 기준 누적 수익률로 변환)
        strategy_returns = [round(v - 100.0, 2) for v in strategy_history]
        benchmark_returns = [round(v - 100.0, 2) for v in benchmark_history]
        dates_list = [d.isoformat() for d in df.index]

        return {
            "cagr": cagr,
            "mdd": mdd,
            "benchmark_cagr": benchmark_cagr,
            "benchmark_mdd": benchmark_mdd,
            "strategy_returns": strategy_returns,
            "benchmark_returns": benchmark_returns,
            "dates": dates_list,
            "today_recommendation": today_recommendation,
            "annual_returns": annual_returns,
            "monthly_returns": monthly_returns
        }

    def _calculate_annual_returns(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """시뮬레이션 기간 동안 연간 수익률을 전략과 지수로 나누어 계산합니다."""
        if df.empty:
            return []
        df_temp = df.copy()
        df_temp["year"] = df_temp.index.map(lambda d: d.year)
        
        # 연도별 마지막 영업일
        year_ends = df_temp.groupby("year").apply(lambda g: g.index.max())
        
        annual_data = []
        prev_strategy = 100.0
        prev_benchmark = 100.0
        
        for y in sorted(year_ends.index):
            date_idx = year_ends[y]
            row = df_temp.loc[date_idx]
            strat_val = row["strategy_val"]
            bench_val = row["benchmark_val"]
            
            strat_ret = (strat_val / prev_strategy - 1.0) * 100.0
            bench_ret = (bench_val / prev_benchmark - 1.0) * 100.0
            
            annual_data.append({
                "year": int(y),
                "strategy": round(strat_ret, 2),
                "benchmark": round(bench_ret, 2)
            })
            
            prev_strategy = strat_val
            prev_benchmark = bench_val
            
        return annual_data

    def _calculate_monthly_returns(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """시뮬레이션 기간 동안 월간 수익률을 전략과 지수로 나누어 계산합니다."""
        if df.empty:
            return []
        df_temp = df.copy()
        df_temp["year"] = df_temp.index.map(lambda d: d.year)
        df_temp["month"] = df_temp.index.map(lambda d: d.month)
        df_temp["ym"] = df_temp.index.map(lambda d: f"{d.year}-{d.month:02d}")
        
        month_ends = df_temp.groupby("ym").apply(lambda g: g.index.max())
        
        monthly_data = []
        prev_strategy = 100.0
        prev_benchmark = 100.0
        
        for ym in sorted(month_ends.index):
            date_idx = month_ends[ym]
            row = df_temp.loc[date_idx]
            strat_val = row["strategy_val"]
            bench_val = row["benchmark_val"]
            
            strat_ret = (strat_val / prev_strategy - 1.0) * 100.0
            bench_ret = (bench_val / prev_benchmark - 1.0) * 100.0
            
            year, month = map(int, ym.split("-"))
            monthly_data.append({
                "year": year,
                "month": month,
                "strategy": round(strat_ret, 2),
                "benchmark": round(bench_ret, 2)
            })
            
            prev_strategy = strat_val
            prev_benchmark = bench_val
            
        return monthly_data

    def save_setting(self, data: Dict[str, Any]) -> Any:
        """자산배분 파라미터 설정을 DB에 저장합니다."""
        from src.backend.models import AllocationSetting
        
        is_favorite = data.get("is_favorite", False)
        
        # 만약 저장하려는 설정이 즐겨찾기로 지정되었다면 다른 설정의 즐겨찾기는 해제합니다.
        if is_favorite:
            self.db.query(AllocationSetting).update({AllocationSetting.is_favorite: False})
        
        setting = AllocationSetting(
            name=data["name"],
            description=data.get("description"),
            target_index=data["target_index"],
            lookback_period=data["lookback_period"],
            rebalancing_frequency=data["rebalancing_frequency"],
            vix_threshold=data["vix_threshold"],
            min_cash_weight=data["min_cash_weight"],
            max_cash_weight=data["max_cash_weight"],
            start_date=data["start_date"],
            end_date=data.get("end_date"),
            is_favorite=is_favorite,
            simulation_result=data.get("simulation_result")
        )
        self.db.add(setting)
        self.db.commit()
        self.db.refresh(setting)
        return setting

    def get_settings(self) -> List[Any]:
        """저장된 모든 파라미터 설정을 조회합니다."""
        from src.backend.models import AllocationSetting
        return self.db.query(AllocationSetting).order_by(AllocationSetting.created_at.desc()).all()

    def delete_setting(self, setting_id: int) -> bool:
        """파라미터 설정을 삭제합니다."""
        from src.backend.models import AllocationSetting
        setting = self.db.query(AllocationSetting).filter(AllocationSetting.id == setting_id).first()
        if setting:
            self.db.delete(setting)
            self.db.commit()
            return True
        return False

    def toggle_favorite(self, setting_id: int) -> Any:
        """특정 설정을 주로 참고할 설정(즐겨찾기)으로 지정하고 나머지는 해제합니다."""
        from src.backend.models import AllocationSetting
        
        # 다른 모든 설정의 즐겨찾기 플래그를 해제
        self.db.query(AllocationSetting).update({AllocationSetting.is_favorite: False})
        
        setting = self.db.query(AllocationSetting).filter(AllocationSetting.id == setting_id).first()
        if setting:
            setting.is_favorite = True
            self.db.commit()
            self.db.refresh(setting)
            return setting
        return None

