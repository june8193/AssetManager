import asyncio
import yfinance as yf
from typing import List, Dict, Any
from fastapi.concurrency import run_in_threadpool

from src.kiwoom.api import KiwoomAPI
from src.kiwoom.auth import KiwoomAuthManager

class PriceService:
    """국내 및 해외 주식의 실시간 시세를 조회하는 서비스 클래스입니다."""

    def __init__(self):
        self.kiwoom_api = KiwoomAPI()
        self.kiwoom_auth = KiwoomAuthManager()

    async def get_kr_prices(self, codes: List[str]) -> List[Dict[str, Any]]:
        """키움 REST API를 통해 국내 주식 시세를 조회합니다.
        
        Args:
            codes (List[str]): 종목 코드 리스트
            
        Returns:
            List[Dict[str, Any]]: [{stock_code, current_price, change_rate}]
        """
        if not codes:
            return []
            
        results = []
        try:
            token = await self.kiwoom_auth.get_valid_token()
            
            # 50개 단위로 끊어서 요청 (키움 API 제한 고려)
            batch_size = 50
            for i in range(0, len(codes), batch_size):
                batch = codes[i:i + batch_size]
                # requests 기반의 동기 함수이므로 threadpool에서 실행
                res = await run_in_threadpool(self.kiwoom_api.get_bulk_stock_info, token, batch)
                
                if res and res.get("return_code") == 0:
                    outputs = res.get("atn_stk_infr", [])
                    for out in outputs:
                        code = out.get("stk_cd")
                        price_str = out.get("cur_prc", "0").strip("+-")
                        rate_str = out.get("flu_rt", "0").strip("+-")
                        
                        results.append({
                            "stock_code": code,
                            "current_price": float(price_str) if price_str else 0.0,
                            "change_rate": float(rate_str) if rate_str else 0.0
                        })
                else:
                    error_msg = res.get("return_msg") if res else "응답 없음"
                    print(f"⚠️ 키움 API Bulk 조회 실패: {error_msg}")
                    # 실패한 종목들은 0.0으로 채움
                    for code in batch:
                        if not any(r['stock_code'] == code for r in results):
                            results.append({"stock_code": code, "current_price": 0.0, "change_rate": 0.0})
                            
        except Exception as e:
            print(f"⚠️ 국내 주식 시세 조회 중 예외 발생: {e}")
            return [{"stock_code": c, "current_price": 0.0, "change_rate": 0.0} for c in codes]
            
        return results

    async def get_us_prices(self, symbols: List[str]) -> List[Dict[str, Any]]:
        """yfinance를 통해 미국 주식 시세를 조회합니다.
        
        Args:
            symbols (List[str]): 티커 리스트
            
        Returns:
            List[Dict[str, Any]]: [{stock_code, current_price, change_rate}]
        """
        if not symbols:
            return []
            
        results = []
        try:
            # yfinance 호출도 블로킹일 수 있으므로 threadpool 사용
            tickers = await run_in_threadpool(yf.Tickers, " ".join(symbols))
            
            for symbol in symbols:
                try:
                    ticker = tickers.tickers[symbol]
                    info = ticker.fast_info
                    last_price = float(info.get('last_price', info.get('lastPrice', 0)))
                    prev_close = float(info.get('previous_close', info.get('regular_market_previous_close', 0)))
                    
                    change_rate = 0.0
                    if prev_close > 0:
                        change_rate = round(((last_price / prev_close) - 1) * 100, 2)
                    
                    results.append({
                        "stock_code": symbol,
                        "current_price": last_price,
                        "change_rate": change_rate
                    })
                except Exception:
                    results.append({"stock_code": symbol, "current_price": 0.0, "change_rate": 0.0})
        except Exception as e:
            print(f"⚠️ 미국 주식 시세 조회 중 예외 발생: {e}")
            return [{"stock_code": s, "current_price": 0.0, "change_rate": 0.0} for s in symbols]
            
        return results

# 싱글톤 인스턴스
price_service = PriceService()
