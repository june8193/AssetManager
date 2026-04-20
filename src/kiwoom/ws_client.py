import json
import asyncio
import logging
import websockets
from websockets import State
from typing import List, Optional, Dict
from .auth import KiwoomAuthManager
from src.backend.ws.manager import manager as broadcast_manager

class KiwoomWebSocketClient:
    """키움증권 실시간 웹소켓 클라이언트입니다."""
    
    def __init__(self):
        self.auth_manager = KiwoomAuthManager()
        self.ws_url = self.auth_manager.ws_url
        self.logger = logging.getLogger("KiwoomWebSocketClient")
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)
            
        self.subscribed_codes: List[str] = []
        self._ws: Optional[websockets.WebSocketClientProtocol] = None
        self._stop_event = asyncio.Event()
        self._login_event = asyncio.Event()
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
                
                self.logger.info(f"키움 웹소켓 접속 시도 중... (URL: {self.ws_url})")
                async with websockets.connect(
                    self.ws_url, 
                    open_timeout=30,
                    ping_interval=20,
                    ping_timeout=20
                ) as ws:
                    self._ws = ws
                    self.logger.info("키움 웹소켓 서버 연결 성공. 로그인 요청 중...")
                    self._reconnect_delay = 1.0
                    
                    # 로그인 패킷 전송 (응답은 _handle_message에서 처리)
                    login_msg = {
                        "trnm": "LOGIN",
                        "token": token
                    }
                    await ws.send(json.dumps(login_msg))
                    
                    async for message in ws:
                        if self._stop_event.is_set():
                            break
                        await self._handle_message(message)
                        
            except websockets.exceptions.ConnectionClosed as e:
                self._ws = None
                if not self._stop_event.is_set():
                    self.logger.error(f"웹소켓 연결 종료 (Code: {e.code}, Reason: {e.reason}). {self._reconnect_delay}초 후 재연결 시도...")
                    await asyncio.sleep(self._reconnect_delay)
                    self._reconnect_delay = min(self._reconnect_delay * 2, 60.0)
                else:
                    self.logger.info("웹소켓 연결 중지됨")
            except Exception as e:
                self._ws = None
                if not self._stop_event.is_set():
                    self.logger.error(f"웹소켓 일반 오류: {str(e)}. {self._reconnect_delay}초 후 재연결 시도...")
                    await asyncio.sleep(self._reconnect_delay)
                    self._reconnect_delay = min(self._reconnect_delay * 2, 60.0)
                else:
                    self.logger.info("웹소켓 연결 중지됨")

    async def _handle_message(self, message: str):
        """수신된 메시지를 처리하고 브로드캐스트합니다."""
        try:
            self.logger.debug(f"수신 메시지: {message}")
            data = json.loads(message)
            trnm = data.get("trnm")
            
            if trnm == "REAL":
                parsed = self._parse_real_data(data)
                if parsed:
                    await broadcast_manager.broadcast(json.dumps({
                        "type": "price_update",
                        "data": [parsed]
                    }))
            elif trnm == "LOGIN":
                if data.get("return_code") == 0:
                    self.logger.info("키움 웹소켓 로그인 성공")
                    # 로그인 성공 후 기존에 보관된 구독 종목이 있다면 재구독 진행
                    if self.subscribed_codes:
                        await self.subscribe(self.subscribed_codes)
                else:
                    self.logger.error(f"키움 웹소켓 로그인 실패: {data.get('return_msg')}")
            elif trnm == "PING":
                # PING 수신 시 받은 메시지 그대로 응답 (Echo)
                await self._ws.send(message)
                self.logger.debug("PING 수신 및 응답 전송")
                
        except Exception as e:
            self.logger.error(f"메시지 처리 중 오류: {str(e)}")

    def _parse_real_data(self, raw_data: Dict) -> Optional[Dict]:
        """키움 REAL 데이터를 앱 규격으로 파싱합니다."""
        data_list = raw_data.get("data")
        if not data_list or not isinstance(data_list, list) or len(data_list) == 0:
            return None
            
        try:
            # data는 리스트 형태이며 첫 번째 요소에 실제 데이터가 담겨 있음
            item_data = data_list[0]
            values = item_data.get("values", item_data)
            
            # 가격 정보 등 (+/-) 기호가 포함되어 올 수 있으므로 처리
            current_price_str = values.get("10", "0").replace("+", "").replace("-", "")
            
            return {
                "stock_code": item_data.get("item") or item_data.get("code"),
                "current_price": int(current_price_str or 0),
                "change_rate": float(values.get("12", "0.00") or 0.0)
            }
        except (TypeError, ValueError, IndexError) as e:
            self.logger.error(f"데이터 파싱 중 예외 발생: {str(e)}")
            return None

    def _create_reg_message(self, codes: List[str], is_reg: bool = True) -> Dict:
        """구독(REG) 또는 해지(REMOVE) 전문을 생성합니다."""
        return {
            "trnm": "REG" if is_reg else "REMOVE",
            "grp_no": "1",
            "refresh": "1" if is_reg else "0",
            "data": [
                {
                    "item": codes,
                    "type": ["0B"]  # 0B: 주식체결
                }
            ]
        }

    async def subscribe(self, codes: List[str]):
        """종목 코드를 구독합니다."""
        if not codes:
            return
            
        msg = self._create_reg_message(codes, is_reg=True)
        if self._ws and self._ws.state == State.OPEN:
            msg_str = json.dumps(msg)
            await self._ws.send(msg_str)
            self.subscribed_codes = list(set(self.subscribed_codes + codes))
            self.logger.info(f"구독 요청 전송: {msg_str}")
        else:
            self.subscribed_codes = list(set(self.subscribed_codes + codes))
            self.logger.warning("웹소켓이 연결되지 않아 구독 목록만 갱신합니다.")

    async def unsubscribe(self, codes: List[str]):
        """종목 코드 구독을 해지합니다."""
        if not codes:
            return
            
        msg = self._create_reg_message(codes, is_reg=False)
        
        if self._ws and self._ws.state == State.OPEN:
            msg_str = json.dumps(msg)
            await self._ws.send(msg_str)
            self.subscribed_codes = [c for c in self.subscribed_codes if c not in codes]
            self.logger.info(f"구독 해지 요청 전송: {msg_str}")
        else:
            self.subscribed_codes = [c for c in self.subscribed_codes if c not in codes]
            self.logger.warning("웹소켓이 연결되지 않아 구독 목록에서만 제거합니다.")

# 싱글톤 인스턴스
kiwoom_ws_client = KiwoomWebSocketClient()

