import asyncio
import logging
import json
import yfinance as yf
from typing import List, Set, Optional
from ..ws.manager import manager as broadcast_manager

class USStockService:
    """미국 주식 실시간 시세를 폴링하여 브로드캐스트하는 서비스입니다.
    
    yfinance는 공식적인 웹소켓을 지원하지 않으므로, 백엔드에서 일정 주기로 
    데이터를 폴링하여 연결된 클라이언트들에게 전송합니다.
    """
    
    def __init__(self, interval: int = 5):
        self.interval = interval
        self.subscribed_symbols: Set[str] = set()
        self._stop_event = asyncio.Event()
        self._task: Optional[asyncio.Task] = None
        self.logger = logging.getLogger("USStockService")
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)

    async def start(self, initial_symbols: List[str] = None):
        """서비스를 시작합니다."""
        if initial_symbols:
            self.subscribed_symbols.update(initial_symbols)
            self.logger.info(f"초기 구독 종목 설정: {initial_symbols}")
            
        self._stop_event.clear()
        self._task = asyncio.create_task(self._run_polling_loop())
        self.logger.info("미국 주식 시세 폴링 서비스 시작됨")

    async def stop(self):
        """서비스를 중지합니다."""
        self._stop_event.set()
        if self._task:
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self.logger.info("미국 주식 시세 폴링 서비스 중지됨")

    def subscribe(self, symbols: List[str]):
        """새로운 종목을 구독 목록에 추가합니다."""
        added = [s for s in symbols if s not in self.subscribed_symbols]
        if added:
            self.subscribed_symbols.update(added)
            self.logger.info(f"미국 주식 구독 추가: {added}")

    def unsubscribe(self, symbols: List[str]):
        """종목을 구독 목록에서 제거합니다."""
        removed = [s for s in symbols if s in self.subscribed_symbols]
        if removed:
            for s in removed:
                self.subscribed_symbols.discard(s)
            self.logger.info(f"미국 주식 구독 해지: {removed}")

    async def _run_polling_loop(self):
        """설정된 주기마다 시세를 확인하고 브로드캐스트하는 루프입니다."""
        while not self._stop_event.is_set():
            if self.subscribed_symbols:
                try:
                    symbols_list = list(self.subscribed_symbols)
                    # 여러 종목을 한 번에 조회하여 네트워크 비용 최적화
                    tickers = yf.Tickers(" ".join(symbols_list))
                    
                    updates = []
                    for symbol in symbols_list:
                        try:
                            # Tickers 객체에서 개별 Ticker 추출
                            ticker = tickers.tickers[symbol]
                            info = ticker.fast_info
                            
                            last_price = float(info.get('last_price', info.get('lastPrice', 0)))
                            prev_close = float(info.get('previous_close', info.get('regular_market_previous_close', 0)))
                            
                            if prev_close > 0:
                                change_rate = ((last_price / prev_close) - 1) * 100
                            else:
                                change_rate = 0.0
                                
                            updates.append({
                                "stock_code": symbol,
                                "current_price": last_price,
                                "change_rate": round(change_rate, 2),
                                "country": "US"
                            })
                        except Exception as e:
                            self.logger.error(f"종목 {symbol} 정보 획득 실패: {e}")
                    
                    if updates:
                        await broadcast_manager.broadcast(json.dumps({
                            "type": "price_update",
                            "data": updates
                        }))
                        
                except Exception as e:
                    self.logger.error(f"미국 주식 폴링 중 오류 발생: {e}")
            
            # 다음 폴링까지 대기
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self.interval)
            except asyncio.TimeoutError:
                # 타임아웃은 정상적인 대기 완료를 의미함
                pass

# 싱글톤 인스턴스
us_stock_service = USStockService(interval=5)
