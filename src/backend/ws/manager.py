import asyncio
import json
import random
from typing import List
from fastapi import WebSocket
from ..database import SessionLocal
from ..models import Watchlist

class ConnectionManager:
    """웹소켓 연결 및 브로드캐스트 상태를 관리하는 매니저 클래스입니다."""
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """클라이언트의 연결 요청을 수락하고 목록에 추가합니다."""
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        """클라이언트를 연결 목록에서 제거합니다."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        """모든 연결된 클라이언트에게 메시지를 전송합니다."""
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                # 연결이 끊겼거나 오류가 발생한 경우 무시
                pass

manager = ConnectionManager()

async def mock_kiwoom_data_generator():
    """1초마다 Watchlist에 등록된 종목의 임의 가격 데이터를 생성하여 클라이언트에 브로드캐스트합니다."""
    # (Mock 데이터 기준 가격 설정 - 실제로는 Kiwoom 등에서 받아야 함)
    base_prices = {}
    
    while True:
        await asyncio.sleep(1.0)
        
        # 연결된 클라이언트가 없으면 굳이 계산하지 않고 대기
        if not manager.active_connections:
            continue
            
        db = SessionLocal()
        try:
            watchlist = db.query(Watchlist).all()
            if not watchlist:
                continue
                
            updates = []
            for item in watchlist:
                code = item.stock_code
                if code not in base_prices:
                    # 초기 임의 기준가 설정 (10,000 ~ 100,000원 사이)
                    base_prices[code] = random.randint(10000, 100000)
                
                # -5% ~ +5% 변동 임의 발생
                change_percent = random.uniform(-0.05, 0.05)
                current_price = int(base_prices[code] * (1 + change_percent))
                base_prices[code] = current_price
                
                # 등락률 계산 (-5.0% ~ +5.0% 문자열 포맷)
                change_rate_str = f"{change_percent * 100:.2f}"
                
                updates.append({
                    "stock_code": code,
                    "current_price": current_price,
                    "change_rate": change_rate_str
                })
            
            # 클라이언트에게 JSON 포맷으로 브로드캐스트
            await manager.broadcast(json.dumps({"type": "price_update", "data": updates}))
            
        except Exception as e:
            print(f"Mock Data Generator Error: {e}")
        finally:
            db.close()
