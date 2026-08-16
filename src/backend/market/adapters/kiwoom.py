# -*- coding: utf-8 -*-
"""키움증권 REST API 마켓 데이터 어댑터 (KiwoomAdapter) 모듈.

키움증권 Open API를 통해 국내 주식 실시간 현재가, 일별 종가 시계열,
종목명, 외화 환율을 비동기 논블로킹 방식으로 조회하고 정규화합니다.
"""

import datetime
import logging
from typing import Any, Dict, List, Optional
from starlette.concurrency import run_in_threadpool

from .base import MarketAdapterBase

logger = logging.getLogger(__name__)


class KiwoomAdapter(MarketAdapterBase):
    """키움증권 Open API(REST) 기반의 마켓 데이터 어댑터 클래스입니다."""

    def __init__(
        self,
        auth_manager: Optional[Any] = None,
        api: Optional[Any] = None,
    ) -> None:
        """KiwoomAdapter 초기화.

        Args:
            auth_manager (Optional[Any]): 키움 인증 관리자 인스턴스 (미지정 시 KiwoomAuthManager 기본 인스턴스 사용)
            api (Optional[Any]): 키움 API 통신 인스턴스 (미지정 시 KiwoomAPI 기본 인스턴스 사용)
        """
        self._auth_manager = auth_manager
        self._api = api

    def _get_auth_manager(self) -> Any:
        """인증 관리자 인스턴스를 지연 로드(Lazy load)하여 반환합니다."""
        if self._auth_manager is None:
            from src.kiwoom.auth import KiwoomAuthManager
            self._auth_manager = KiwoomAuthManager()
        return self._auth_manager

    def _get_api(self) -> Any:
        """키움 API 인스턴스를 지연 로드(Lazy load)하여 반환합니다."""
        if self._api is None:
            from src.kiwoom.api import KiwoomAPI
            self._api = KiwoomAPI()
        return self._api

    async def _get_token(self) -> Optional[str]:
        """유효한 접근 토큰을 획득합니다. 실패 시 None을 반환합니다."""
        try:
            auth = self._get_auth_manager()
            return await auth.get_valid_token()
        except Exception as e:
            logger.warning("키움 토큰 발급 중 예외 발생: %s", e)
            return None

    @staticmethod
    def _clean_price(val: Any) -> float:
        """문자열 등 원시 시세 데이터를 정제하여 float 가격으로 변환합니다."""
        if val is None:
            return 0.0
        raw = str(val).replace(",", "").strip("+- ")
        try:
            return float(raw) if raw else 0.0
        except ValueError:
            return 0.0

    @staticmethod
    def _clean_rate(val: Any) -> float:
        """문자열 등 원시 등락률 데이터를 정제하여 float 등락률로 변환합니다."""
        if val is None:
            return 0.0
        raw = str(val).replace(",", "").replace("+", "").strip()
        try:
            return float(raw) if raw else 0.0
        except ValueError:
            return 0.0

    async def get_current_prices(self, tickers: List[str]) -> List[Dict[str, Any]]:
        """복수 종목의 실시간 현재가 및 등락률을 조회합니다.

        Args:
            tickers (List[str]): 종목 코드 리스트 (예: ['005930', '000660'])

        Returns:
            List[Dict[str, Any]]: [
                {
                    "stock_code": str,
                    "current_price": float,
                    "change_rate": float
                },
                ...
            ]
        """
        if not tickers:
            return []

        results: List[Dict[str, Any]] = []
        token = await self._get_token()
        if not token:
            return [{"stock_code": t, "current_price": 0.0, "change_rate": 0.0} for t in tickers]

        api = self._get_api()
        batch_size = 50

        try:
            for i in range(0, len(tickers), batch_size):
                batch = tickers[i:i + batch_size]
                try:
                    res = await run_in_threadpool(api.get_bulk_stock_info, token, batch)
                    batch_handled = set()

                    if res and res.get("return_code") == 0:
                        outputs = res.get("atn_stk_infr", [])
                        for out in outputs:
                            code = out.get("stk_cd")
                            if not code:
                                continue

                            price_val = self._clean_price(out.get("cur_prc"))
                            change_rate = self._clean_rate(out.get("flu_rt"))

                            results.append({
                                "stock_code": code,
                                "current_price": price_val,
                                "change_rate": change_rate,
                            })
                            batch_handled.add(code)

                    # Bulk 응답에 포함되지 않은 종목 개별 Fallback 처리
                    for code in batch:
                        if code not in batch_handled:
                            single_info = await self._fetch_single_price_fallback(token, code)
                            results.append(single_info)
                except Exception as batch_err:
                    logger.warning("키움 Bulk 시세 배치 조회 중 오류 (%s): %s", batch, batch_err)
                    for code in batch:
                        results.append({"stock_code": code, "current_price": 0.0, "change_rate": 0.0})

        except Exception as e:
            logger.warning("키움 주식 현재가 조회 중 전체 예외 발생: %s", e)
            for code in tickers:
                if not any(r["stock_code"] == code for r in results):
                    results.append({"stock_code": code, "current_price": 0.0, "change_rate": 0.0})

        return results

    async def _fetch_single_price_fallback(self, token: str, ticker: str) -> Dict[str, Any]:
        """단일 종목 Fallback 시세 조회."""
        try:
            api = self._get_api()
            res = await run_in_threadpool(api.get_stock_info, token, ticker)
            if res and res.get("return_code") == 0:
                price_val = self._clean_price(res.get("cur_prc") or res.get("now_pric"))
                change_rate = self._clean_rate(res.get("flu_rt") or res.get("fluc_rt"))
                return {
                    "stock_code": ticker,
                    "current_price": price_val,
                    "change_rate": change_rate,
                }
        except Exception as e:
            logger.debug("단일 종목 Fallback 조회 실패 (%s): %s", ticker, e)

        return {"stock_code": ticker, "current_price": 0.0, "change_rate": 0.0}

    async def get_historical_prices(
        self,
        ticker: str,
        start_date: datetime.date,
        end_date: datetime.date
    ) -> List[Dict[str, Any]]:
        """지정된 기간 동안의 일별 종가 시계열 데이터를 조회합니다.

        Args:
            ticker (str): 종목 코드 (예: '005930')
            start_date (datetime.date): 조회 시작일
            end_date (datetime.date): 조회 종료일

        Returns:
            List[Dict[str, Any]]: [
                {
                    "price_date": datetime.date,
                    "close_price": float
                },
                ...
            ] (날짜 오름차순)
        """
        token = await self._get_token()
        if not token:
            return []

        try:
            clean_dt = end_date.strftime("%Y%m%d")
            api = self._get_api()
            res = await run_in_threadpool(api.get_historical_stock_price, token, ticker, clean_dt)

            if not res or res.get("return_code") != 0:
                error_msg = res.get("return_msg") if res else "응답 없음"
                logger.warning("키움 일별 주가 조회 실패 (%s): %s", ticker, error_msg)
                return []

            daly_stkpc = res.get("daly_stkpc", [])
            results: List[Dict[str, Any]] = []

            for day_data in daly_stkpc:
                raw_date = day_data.get("date", "").replace("-", "").strip()
                if len(raw_date) != 8:
                    continue

                try:
                    p_date = datetime.datetime.strptime(raw_date, "%Y%m%d").date()
                except ValueError:
                    continue

                if start_date <= p_date <= end_date:
                    close_p = self._clean_price(day_data.get("close_pric"))
                    if close_p > 0:
                        results.append({
                            "price_date": p_date,
                            "close_price": close_p,
                        })

            # 날짜 오름차순 정렬
            results.sort(key=lambda x: x["price_date"])
            return results

        except Exception as e:
            logger.warning("키움 일별 주가 조회 중 예외 발생 (%s): %s", ticker, e)
            return []

    async def get_stock_name(self, ticker: str) -> Optional[str]:
        """종목 코드에 해당하는 공식 종목명을 조회합니다.

        Args:
            ticker (str): 종목 코드 (예: '005930')

        Returns:
            Optional[str]: 종목명 (조회 실패 시 None)
        """
        token = await self._get_token()
        if not token:
            return None

        try:
            api = self._get_api()
            res = await run_in_threadpool(api.get_stock_info, token, ticker)
            if res and res.get("return_code") == 0:
                name = res.get("stk_nm") or res.get("nm") or res.get("name") or res.get("hname")
                if name:
                    return str(name).strip()
        except Exception as e:
            logger.warning("키움 종목명 조회 중 예외 발생 (%s): %s", ticker, e)

        return None

    async def get_exchange_rate(
        self,
        sell_currency: str = "USD",
        buy_currency: str = "KRW",
        target_date: Optional[datetime.date] = None,
    ) -> Optional[float]:
        """환율을 조회합니다.

        Args:
            sell_currency (str): 매도 통화 (기본값: 'USD')
            buy_currency (str): 매수 통화 (기본값: 'KRW')
            target_date (Optional[datetime.date]): 조회 기준 일자

        Returns:
            Optional[float]: 환율 값 (조회 실패 시 None)
        """
        sell = sell_currency.upper()
        buy = buy_currency.upper()

        if sell == buy:
            return 1.0

        token = await self._get_token()
        if not token:
            return None

        try:
            api = self._get_api()
            res = await run_in_threadpool(api.get_exchange_rate, token, sell, buy, "2")
            if res and res.get("return_code") == 0:
                raw_rate = res.get("sell_aplc_exrt") or res.get("aplc_exrt") or res.get("buy_aplc_exrt") or "0"
                rate = self._clean_price(raw_rate)
                if rate > 0.0:
                    return rate
        except Exception as e:
            logger.warning("키움 환율 조회 중 예외 발생 (%s/%s): %s", sell, buy, e)

        return None

    async def get_market_indices(self, country: str = "KR") -> List[Dict[str, Any]]:
        """국가별 주요 시장 지수 목록을 조회합니다.

        Args:
            country (str): 국가 코드 (기본값: 'KR')

        Returns:
            List[Dict[str, Any]]: 지수 목록
        """
        if country.upper() == "KR":
            return [
                {"index_name": "KOSPI", "current_price": 0.0, "change_rate": 0.0},
                {"index_name": "KOSDAQ", "current_price": 0.0, "change_rate": 0.0},
            ]
        return []
