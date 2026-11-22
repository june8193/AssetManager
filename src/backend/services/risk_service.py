# -*- coding: utf-8 -*-
"""포트폴리오 내재 변동성, 공분산 행렬, 오일러 위험 기여도 및 낙폭 방어력 산출 서비스 모듈입니다."""

import datetime
import logging
import math
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from sqlalchemy.orm import Session

from src.backend.market import MarketDataProvider
from src.backend.models import Asset, ExchangeRate, HistoricalPrice, Stock, Watchlist
from src.backend.services.ledger_engine import LedgerEngine

logger = logging.getLogger(__name__)

PERIOD_DAYS_MAP: Dict[str, int] = {
    "1M": 30,
    "3M": 90,
    "1Y": 365,
}

BENCHMARK_DEFINITIONS: Dict[str, Dict[str, str]] = {
    "sp500": {"ticker": "^GSPC", "name": "S&P 500", "country": "US"},
    "nasdaq": {"ticker": "^IXIC", "name": "NASDAQ", "country": "US"},
    "kospi": {"ticker": "^KS11", "name": "KOSPI", "country": "KR"},
}

TRADING_DAYS_PER_YEAR: float = 252.0
DEFAULT_USD_KRW_RATE: float = 1350.0


def _compute_daily_returns(prices: List[Dict[str, Any]]) -> Dict[datetime.date, float]:
    """유효 종가(close_price > 0) 시계열로부터 현지 통화 기준 일별 단순 수익률을 계산합니다.

    Args:
        prices: ``[{'price_date': date, 'close_price': float}]`` 형태의 시계열 목록.

    Returns:
        날짜별 일별 단순 수익률 딕셔너리 (소수, 예: 0.015는 +1.5%).
    """
    valid_by_date: Dict[datetime.date, float] = {}
    for row in prices:
        close_price = float(row.get("close_price") or 0.0)
        price_date = row.get("price_date")
        if price_date is not None and close_price > 0.0:
            valid_by_date[price_date] = close_price

    sorted_dates = sorted(valid_by_date.keys())
    returns: Dict[datetime.date, float] = {}
    for idx in range(1, len(sorted_dates)):
        prev_date = sorted_dates[idx - 1]
        curr_date = sorted_dates[idx]
        prev_price = valid_by_date[prev_date]
        curr_price = valid_by_date[curr_date]
        if prev_price > 0.0:
            returns[curr_date] = (curr_price - prev_price) / prev_price
    return returns


def _compute_drawdown_series(
    dates: List[datetime.date],
    return_series: List[float],
) -> List[float]:
    """일별 수익률 배열로부터 누적 낙폭(Drawdown, %) 시계열을 계산합니다.

    Args:
        dates: 정렬된 영업일 날짜 목록.
        return_series: ``dates``와 길이가 같은 일별 단순 수익률(소수) 목록.

    Returns:
        각 날짜의 누적 낙폭(%) 목록 (0.0 이하).
    """
    if not dates:
        return []

    index_value = 100.0
    peak_value = 100.0
    drawdowns: List[float] = []
    for ret in return_series:
        index_value = index_value * (1.0 + ret)
        if index_value > peak_value:
            peak_value = index_value
        dd_pct = ((index_value / peak_value) - 1.0) * 100.0 if peak_value > 0.0 else 0.0
        drawdowns.append(round(dd_pct, 2))
    return drawdowns


def _project_to_psd(matrix: np.ndarray, cash_index: Optional[int] = 0) -> np.ndarray:
    """비동기 영업일 결측으로 인한 비양의 준정부호(non-PSD) 왜곡을 고유값 클리핑으로 보정합니다.

    Args:
        matrix: 대칭 공분산 행렬 (N x N).
        cash_index: 현금 버킷 인덱스 (존재 시 해당 행/열을 0.0으로 고정).

    Returns:
        양의 준정부호(PSD)가 보장된 대칭 공분산 행렬.
    """
    if matrix.size == 0:
        return matrix

    sym = 0.5 * (matrix + matrix.T)
    eigenvalues, eigenvectors = np.linalg.eigh(sym)
    clipped_eigenvalues = np.maximum(eigenvalues, 0.0)
    psd = (eigenvectors * clipped_eigenvalues) @ eigenvectors.T
    psd = 0.5 * (psd + psd.T)

    if cash_index is not None and 0 <= cash_index < psd.shape[0]:
        psd[cash_index, :] = 0.0
        psd[:, cash_index] = 0.0
    return psd


class RiskService:
    """포트폴리오 내재 변동성 및 위험 기여도 산출 서비스 클래스입니다."""

    def __init__(self, db: Session, provider: MarketDataProvider) -> None:
        """RiskService 인스턴스를 초기화합니다.

        Args:
            db: SQLAlchemy 데이터베이스 세션.
            provider: 마켓 데이터 프로바이더 인스턴스.
        """
        self.db = db
        self.provider = provider

    async def _resolve_exchange_rate(self, target_date: datetime.date) -> float:
        """USD/KRW 기준 환율을 조회합니다.

        Args:
            target_date: 환율 조회 기준일.

        Returns:
            원화 대비 달러 환율 (조회 실패 시 기본값 반환).
        """
        db_rate = (
            self.db.query(ExchangeRate)
            .filter(ExchangeRate.currency == "USD", ExchangeRate.date <= target_date)
            .order_by(ExchangeRate.date.desc(), ExchangeRate.id.desc())
            .first()
        )
        if db_rate and db_rate.rate > 0:
            return float(db_rate.rate)

        try:
            fetched = await self.provider.get_exchange_rate("USD", "KRW", target_date=target_date)
            if fetched and fetched > 0:
                return float(fetched)
        except Exception as exc:
            logger.warning("기준 환율 조회 실패로 기본값(%s) 사용: %s", DEFAULT_USD_KRW_RATE, exc)
        return DEFAULT_USD_KRW_RATE

    async def _resolve_current_price(self, ticker: str, country: str) -> float:
        """현재가 또는 최근 유효 종가(close_price > 0)를 조회합니다.

        Args:
            ticker: 종목 코드 또는 티커.
            country: 국가 코드 (``KR`` 또는 ``US``).

        Returns:
            유효 현재가 또는 최근 종가 (미존재 시 0.0).
        """
        try:
            price_info = await self.provider.get_current_price(ticker, country=country)
            current = float(price_info.get("current_price") or 0.0)
            if current > 0.0:
                return current
        except Exception as exc:
            logger.warning("현재가 조회 실패(%s), DB 종가로 폴백합니다: %s", ticker, exc)

        fallback = (
            self.db.query(HistoricalPrice)
            .filter(HistoricalPrice.ticker == ticker, HistoricalPrice.close_price > 0.0)
            .order_by(HistoricalPrice.price_date.desc())
            .first()
        )
        return float(fallback.close_price) if fallback else 0.0

    async def _resolve_extra_asset_meta(
        self,
        ticker: str,
        asset_map: Dict[str, Asset],
        watchlist_map: Dict[str, Watchlist],
        stock_map: Dict[str, Stock],
    ) -> Tuple[str, str, str]:
        """시뮬레이션 추가 종목(extra_tickers)의 이름, 카테고리 라벨, 국가 코드를 해석합니다.

        Args:
            ticker: 추가 편입 티커.
            asset_map: 자산 마스터 맵.
            watchlist_map: 관심종목 맵.
            stock_map: 국내 주식 마스터 맵.

        Returns:
            ``(종목명, 카테고리_라벨, 국가코드)`` 튜플.
        """
        if ticker in asset_map:
            asset = asset_map[ticker]
            return asset.name, asset.sub_category or asset.major_category, asset.country

        if ticker in watchlist_map:
            wl = watchlist_map[ticker]
            return wl.stock_name, "관심종목", wl.country

        if ticker in stock_map:
            st = stock_map[ticker]
            return st.stock_name, st.market or "국내주식", "KR"

        country = self.provider.resolve_country(ticker)
        name = ticker
        try:
            fetched_name = await self.provider.get_stock_name(ticker, country=country)
            if fetched_name:
                name = fetched_name
        except Exception as exc:
            logger.warning("추가 종목명 조회 실패(%s): %s", ticker, exc)
        category_label = "해외주식" if country == "US" else "국내주식"
        return name, category_label, country

    async def _fetch_returns_map(
        self,
        ticker: str,
        start_date: datetime.date,
        end_date: datetime.date,
        country: str,
    ) -> Dict[datetime.date, float]:
        """지정 기간의 유효 종가를 동기화하고 일별 수익률 딕셔너리를 반환합니다.

        Args:
            ticker: 종목 코드 또는 지수 심볼.
            start_date: 조회 시작일.
            end_date: 조회 종료일.
            country: 국가 코드.

        Returns:
            날짜별 일별 단순 수익률 딕셔너리.
        """
        try:
            prices = await self.provider.get_historical_prices(
                ticker=ticker,
                start_date=start_date,
                end_date=end_date,
                country=country,
                fill_missing=False,
            )
            return _compute_daily_returns(prices)
        except Exception as exc:
            logger.warning("과거 시세 조회 실패(%s): %s", ticker, exc)
            return {}

    async def _build_asset_entries(
        self,
        today: datetime.date,
        usd_krw_rate: float,
        extra_tickers: Optional[List[str]],
    ) -> List[Dict[str, Any]]:
        """원장 보유 종목, 현금 버킷, 추가 편입 종목의 기본 메타데이터 목록을 구성합니다.

        Args:
            today: 기준 일자.
            usd_krw_rate: USD/KRW 환율.
            extra_tickers: 시뮬레이션 편입 테스트 티커 목록.

        Returns:
            현금(인덱스 0) + 보유 종목 + 추가 편입 종목 딕셔너리 리스트.
        """
        ledger_state = LedgerEngine.get_positions(self.db, as_of=today)
        cash_total_krw = max(
            0.0,
            float(ledger_state.cash_krw) + float(ledger_state.cash_usd) * usd_krw_rate,
        )

        asset_map: Dict[str, Asset] = {a.ticker: a for a in self.db.query(Asset).all()}
        entries: List[Dict[str, Any]] = [
            {
                "ticker": "CASH",
                "name": "현금 (원화·달러 예수금)",
                "category_label": "현금",
                "country": "KR",
                "is_cash": True,
                "is_added": False,
                "qty": 0.0,
                "valuation_krw": cash_total_krw,
            }
        ]

        holding_tickers = sorted(t for t, qty in ledger_state.holdings.items() if qty > 0)
        for ticker in holding_tickers:
            asset_obj = asset_map.get(ticker)
            if asset_obj is None:
                continue
            entries.append(
                {
                    "ticker": ticker,
                    "name": asset_obj.name,
                    "category_label": asset_obj.sub_category or asset_obj.major_category,
                    "country": asset_obj.country or self.provider.resolve_country(ticker),
                    "is_cash": False,
                    "is_added": False,
                    "qty": float(ledger_state.holdings[ticker]),
                    "valuation_krw": 0.0,
                }
            )

        existing_tickers = {e["ticker"] for e in entries}
        cleaned_extras = list(
            dict.fromkeys(
                t.strip() for t in (extra_tickers or []) if t.strip() and t.strip() not in existing_tickers
            )
        )
        if cleaned_extras:
            watchlist_map = {w.stock_code: w for w in self.db.query(Watchlist).all()}
            stock_map = {s.stock_code: s for s in self.db.query(Stock).all()}
            for ticker in cleaned_extras:
                name, cat_label, country = await self._resolve_extra_asset_meta(
                    ticker, asset_map, watchlist_map, stock_map
                )
                entries.append(
                    {
                        "ticker": ticker,
                        "name": name,
                        "category_label": cat_label,
                        "country": country,
                        "is_cash": False,
                        "is_added": True,
                        "qty": 0.0,
                        "valuation_krw": 0.0,
                    }
                )
        return entries

    @staticmethod
    def _compute_covariance_matrix(
        asset_entries: List[Dict[str, Any]],
        asset_returns_by_ticker: Dict[str, Dict[datetime.date, float]],
    ) -> np.ndarray:
        """유효 일별 수익률 시계열로부터 PSD 보정된 연율화 공분산 행렬(%^2)을 계산합니다.

        Args:
            asset_entries: 자산 메타데이터 목록 (인덱스 0은 현금 버킷).
            asset_returns_by_ticker: 티커별 일별 수익률 딕셔너리.

        Returns:
            PSD 보정된 (N x N) 공분산 행렬.
        """
        n_assets = len(asset_entries)
        raw_cov = np.zeros((n_assets, n_assets), dtype=float)
        annual_scale = TRADING_DAYS_PER_YEAR * (100.0 ** 2)

        for i in range(n_assets):
            if asset_entries[i]["is_cash"]:
                continue
            rets_i = asset_returns_by_ticker[asset_entries[i]["ticker"]]
            if len(rets_i) >= 2:
                arr_i = np.array(list(rets_i.values()), dtype=float)
                raw_cov[i, i] = float(np.var(arr_i, ddof=1) * annual_scale)

            for j in range(i + 1, n_assets):
                if asset_entries[j]["is_cash"]:
                    continue
                rets_j = asset_returns_by_ticker[asset_entries[j]["ticker"]]
                common_dates = sorted(set(rets_i.keys()) & set(rets_j.keys()))
                if len(common_dates) >= 2:
                    vec_i = np.array([rets_i[d] for d in common_dates], dtype=float)
                    vec_j = np.array([rets_j[d] for d in common_dates], dtype=float)
                    cov_ij = float(np.cov(vec_i, vec_j, ddof=1)[0, 1] * annual_scale)
                    raw_cov[i, j] = cov_ij
                    raw_cov[j, i] = cov_ij

        return _project_to_psd(raw_cov, cash_index=0)

    @staticmethod
    def _build_benchmarks_and_drawdown(
        asset_entries: List[Dict[str, Any]],
        weights: np.ndarray,
        asset_returns_by_ticker: Dict[str, Dict[datetime.date, float]],
        benchmark_returns_by_key: Dict[str, Dict[datetime.date, float]],
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """3대 벤치마크 통계 및 낙폭(MDD) 비교 시계열을 생성합니다.

        Args:
            asset_entries: 자산 메타데이터 목록.
            weights: 자산별 포트폴리오 비중 벡터(합계 1.0).
            asset_returns_by_ticker: 자산별 일별 수익률 딕셔너리.
            benchmark_returns_by_key: 벤치마크별 일별 수익률 딕셔너리.

        Returns:
            ``(benchmarks_payload, drawdown_comparison_payload)`` 튜플.
        """
        all_bench_dates = sorted(
            {d for rets in benchmark_returns_by_key.values() for d in rets.keys()}
        )
        benchmarks_payload: Dict[str, Any] = {}
        bench_drawdowns: Dict[str, List[float]] = {}

        for key, meta in BENCHMARK_DEFINITIONS.items():
            rets_map = benchmark_returns_by_key[key]
            if len(rets_map) >= 2:
                arr = np.array(list(rets_map.values()), dtype=float)
                bench_vol = float(np.std(arr, ddof=1) * math.sqrt(TRADING_DAYS_PER_YEAR) * 100.0)
            else:
                bench_vol = 0.0

            own_dates = sorted(rets_map.keys())
            own_dd = _compute_drawdown_series(own_dates, [rets_map[d] for d in own_dates])
            benchmarks_payload[key] = {
                "ticker": meta["ticker"],
                "name": meta["name"],
                "annualized_volatility": round(bench_vol, 2),
                "max_mdd": round(min(own_dd) if own_dd else 0.0, 2),
            }
            bench_drawdowns[key] = _compute_drawdown_series(
                all_bench_dates, [rets_map.get(d, 0.0) for d in all_bench_dates]
            )

        asset_daily_returns: Dict[str, List[float]] = {}
        for entry in asset_entries:
            ticker = entry["ticker"]
            rets_map = asset_returns_by_ticker[ticker]
            asset_daily_returns[ticker] = [
                round(rets_map.get(d, 0.0), 6) for d in all_bench_dates
            ]

        n_assets = len(asset_entries)
        portfolio_daily_returns = [
            sum(
                float(weights[idx]) * asset_daily_returns[asset_entries[idx]["ticker"]][d_idx]
                for idx in range(n_assets)
            )
            for d_idx in range(len(all_bench_dates))
        ]
        drawdown_payload = {
            "dates": [d.isoformat() for d in all_bench_dates],
            "benchmarks": bench_drawdowns,
            "portfolio_current": _compute_drawdown_series(all_bench_dates, portfolio_daily_returns),
            "asset_daily_returns": asset_daily_returns,
        }
        return benchmarks_payload, drawdown_payload

    async def get_volatility_diagnosis(
        self,
        period: str = "1Y",
        extra_tickers: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """포트폴리오 내재 변동성, 공분산 행렬, 오일러 기여도 및 낙폭 비교 시계열을 산출합니다.

        Args:
            period: 조회 기준 기간 (``1M``, ``3M``, ``1Y``).
            extra_tickers: 시뮬레이션 편입 테스트를 위해 추가할 미보유 티커 목록.

        Returns:
            스펙에 정의된 JSON 계약 구조의 딕셔너리.
        """
        today = datetime.date.today()
        start_date = today - datetime.timedelta(days=PERIOD_DAYS_MAP.get(period, 365))
        usd_krw_rate = await self._resolve_exchange_rate(today)
        asset_entries = await self._build_asset_entries(today, usd_krw_rate, extra_tickers)

        # 현재가 조회가 휴일 날짜로 HistoricalPrice를 덮어쓰는 부작용을 막기 위해 시계열을 먼저 동기화
        asset_returns_by_ticker: Dict[str, Dict[datetime.date, float]] = {"CASH": {}}
        for entry in asset_entries:
            if entry["is_cash"]:
                continue
            ticker = entry["ticker"]
            asset_returns_by_ticker[ticker] = await self._fetch_returns_map(
                ticker=ticker, start_date=start_date, end_date=today, country=entry["country"]
            )
            if not entry["is_added"] and entry["qty"] > 0:
                price = await self._resolve_current_price(ticker, country=entry["country"])
                entry["valuation_krw"] = float(
                    entry["qty"] * price * (usd_krw_rate if entry["country"] == "US" else 1.0)
                )

        benchmark_returns_by_key: Dict[str, Dict[datetime.date, float]] = {
            key: await self._fetch_returns_map(
                ticker=meta["ticker"], start_date=start_date, end_date=today, country=meta["country"]
            )
            for key, meta in BENCHMARK_DEFINITIONS.items()
        }

        cov_psd = self._compute_covariance_matrix(asset_entries, asset_returns_by_ticker)
        total_valuation_krw = sum(entry["valuation_krw"] for entry in asset_entries)
        n_assets = len(asset_entries)
        weights = (
            np.array([entry["valuation_krw"] / total_valuation_krw for entry in asset_entries], dtype=float)
            if total_valuation_krw > 0.0
            else np.zeros(n_assets, dtype=float)
        )

        portfolio_vol = math.sqrt(float(max(0.0, weights @ cov_psd @ weights)))
        daily_vol_pct = portfolio_vol / math.sqrt(TRADING_DAYS_PER_YEAR)
        daily_vol_krw = total_valuation_krw * (daily_vol_pct / 100.0)
        sigma_w = cov_psd @ weights

        assets_payload: List[Dict[str, Any]] = []
        for idx, entry in enumerate(asset_entries):
            ind_vol = 0.0 if entry["is_cash"] else math.sqrt(max(0.0, float(cov_psd[idx, idx])))
            if portfolio_vol > 0.0 and not entry["is_cash"]:
                comp_vol = float(weights[idx] * sigma_w[idx] / portfolio_vol)
                vol_share = (comp_vol / portfolio_vol) * 100.0
            else:
                comp_vol = 0.0
                vol_share = 0.0

            assets_payload.append(
                {
                    "ticker": entry["ticker"],
                    "name": entry["name"],
                    "category_label": entry["category_label"],
                    "is_cash": entry["is_cash"],
                    "is_added": entry["is_added"],
                    "valuation_krw": round(entry["valuation_krw"], 2),
                    "weight": round(float(weights[idx] * 100.0), 2),
                    "annualized_volatility": round(ind_vol, 2),
                    "component_volatility": round(comp_vol, 4),
                    "volatility_share": round(vol_share, 2),
                }
            )

        benchmarks_payload, drawdown_payload = self._build_benchmarks_and_drawdown(
            asset_entries, weights, asset_returns_by_ticker, benchmark_returns_by_key
        )

        def _safe_ratio(bench_key: str) -> float:
            b_vol = benchmarks_payload[bench_key]["annualized_volatility"]
            return round(portfolio_vol / b_vol, 2) if b_vol > 0.0 else 0.0

        return {
            "period": period,
            "as_of_date": today.isoformat(),
            "total_valuation_krw": round(total_valuation_krw, 2),
            "portfolio": {
                "annualized_volatility": round(portfolio_vol, 2),
                "daily_volatility_pct": round(daily_vol_pct, 2),
                "daily_volatility_krw": round(daily_vol_krw, 2),
                "sp500_ratio": _safe_ratio("sp500"),
                "nasdaq_ratio": _safe_ratio("nasdaq"),
                "kospi_ratio": _safe_ratio("kospi"),
            },
            "benchmarks": benchmarks_payload,
            "assets": assets_payload,
            "covariance_matrix": [[round(float(v), 6) for v in row] for row in cov_psd.tolist()],
            "drawdown_comparison": drawdown_payload,
        }
