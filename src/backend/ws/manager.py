from typing import List
from fastapi import WebSocket

class ConnectionManager:
    """프론트엔드 웹소켓 연결 및 브로드캐스트 상태를 관리하는 매니저 클래스입니다."""
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
