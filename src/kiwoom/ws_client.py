import json
import asyncio
import logging
import websockets
from typing import List, Optional, Dict
from .auth import KiwoomAuthManager
from src.backend.ws.manager import manager as broadcast_manager

class KiwoomWebSocketClient:
    """키움증권 실시간 웹소켓 클라이언트입니다."""
    
    def __init__(self):
        self.auth_manager = KiwoomAuthManager()
        self.ws_url = self.auth_manager.ws_url
        self.logger = logging.getLogger("KiwoomWebSocketClient")
        self.subscribed_codes: List[str] = []
        self._ws: Optional[websockets.WebSocketClientProtocol] = None
        self._stop_event = asyncio.Event()
        self._reconnect_delay = 1.0  # 초기 재연결 지연 시간 (초)

    async def start(self, initial_codes: List[str] = None):
        """웹소켓 연결 및 수신 루프를 시작합니다."""
        if initial_codes:
            self.subscribed_codes = list(set(self.subscribed_codes + initial_codes))
            
        self._stop_event.clear()
        asyncio.create_task(self._run_loop())

    async def stop(self):
        """웹소켓 연결을 종료합니다."""
        self._stop_event.set()
        if self._ws:
            await self._ws.close()

    async def _run_loop(self):
        """재연결 로직이 포함된 메인 수신 루프입니다."""
        while not self._stop_event.is_set():
            try:
                token = await self.auth_manager.get_valid_token()
                headers = {
                    "authorization": f"Bearer {token}"
                }
                
                async with websockets.connect(self.ws_url, extra_headers=headers) as ws:
                    self._ws = ws
                    self.logger.info("키움 웹소켓 서버 연결 성공")
                    self._reconnect_delay = 1.0  # 연결 성공 시 지연 시간 초기화
                    
                    # 기존 구독 종목 재구독
                    if self.subscribed_codes:
                        await self.subscribe(self.subscribed_codes)
                    
                    async for message in ws:
                        if self._stop_event.is_set():
                            break
                        await self._handle_message(message)
                        
            except (websockets.exceptions.ConnectionClosed, Exception) as e:
                self._ws = None
                if not self._stop_event.is_set():
                    self.logger.error(f"웹소켓 연결 오류: {str(e)}. {self._reconnect_delay}초 후 재연결 시도...")
                    await asyncio.sleep(self._reconnect_delay)
                    # 지수 백오프 적용 (최대 60초)
                    self._reconnect_delay = min(self._reconnect_delay * 2, 60.0)
                else:
                    self.logger.info("웹소켓 연결 중지됨")

    async def _handle_message(self, message: str):
        """수신된 메시지를 처리하고 브로드캐스트합니다."""
        try:
            data = json.loads(message)
            trnm = data.get("trnm")
            
            if trnm == "REAL":
                parsed = self._parse_real_data(data)
                if parsed:
                    # ConnectionManager를 통해 모든 프론트엔드 클라이언트에 전송
                    await broadcast_manager.broadcast(json.dumps({
                        "type": "price_update",
                        "data": [parsed]
                    }))
            elif trnm == "PING":
                # PING 응답 (필요 시)
                await self._ws.send(json.dumps({"trnm": "PONG"}))
                
        except Exception as e:
            self.logger.error(f"메시지 처리 중 오류: {str(e)}")

    def _parse_real_data(self, raw_data: Dict) -> Optional[Dict]:
        """키움 REAL 데이터를 앱 규격으로 파싱합니다."""
        data_body = raw_data.get("data")
        if not data_body:
            return None
            
        try:
            return {
                "stock_code": data_body.get("item"),
                "current_price": int(data_body.get("10", 0)),
                "change_rate": data_body.get("12", "0.00")
            }
        except (TypeError, ValueError):
            return None

    def _create_reg_message(self, codes: List[str]) -> Dict:
        """구독(REG) 전문을 생성합니다."""
        return {
            "trnm": "REG",
            "data": {
                "bcode": "0B",  # 주식체결
                "codes": codes
            }
        }

    async def subscribe(self, codes: List[str]):
        """종목 코드를 구독합니다."""
        if not codes:
            return
            
        new_codes = [c for c in codes if c not in self.subscribed_codes]
        # 이미 모두 구독 중이면 중단 (하지만 새로 연결되었을 때를 위해 실제 전송은 수행)
        
        msg = self._create_reg_message(codes)
        if self._ws and self._ws.open:
            await self._ws.send(json.dumps(msg))
            self.subscribed_codes = list(set(self.subscribed_codes + codes))
            self.logger.info(f"구독 요청 전송: {codes}")
        else:
            self.subscribed_codes = list(set(self.subscribed_codes + codes))
            self.logger.warning("웹소켓이 연결되지 않아 구독 목록만 갱신합니다.")

    async def unsubscribe(self, codes: List[str]):
        """종목 코드 구독을 해지합니다."""
        if not codes:
            return
            
        msg = {
            "trnm": "REMOVE",
            "data": {
                "bcode": "0B",
                "codes": codes
            }
        }
        
        if self._ws and self._ws.open:
            await self._ws.send(json.dumps(msg))
            self.subscribed_codes = [c for c in self.subscribed_codes if c not in codes]
            self.logger.info(f"구독 해지 요청 전송: {codes}")
        else:
            self.subscribed_codes = [c for c in self.subscribed_codes if c not in codes]
            self.logger.warning("웹소켓이 연결되지 않아 구독 목록에서만 제거합니다.")

# 싱글톤 인스턴스
kiwoom_ws_client = KiwoomWebSocketClient()

