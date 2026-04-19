from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio

from .database import engine, Base
from .routers import watchlist
from .ws.manager import manager, mock_kiwoom_data_generator

# DB 테이블 생성 (처음 실행 시 SQLite 파일(assets.db)과 테이블이 생성됨)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AssetManager Backend API")

# CORS 활성화 (Vite 개발 서버의 로컬 접속을 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 모듈화된 라우터 연결
app.include_router(watchlist.router)

@app.on_event("startup")
async def startup_event():
    """서버 시작 시 Mock 데이터 브로드캐스트 백그라운드 태스크를 실행합니다."""
    # Python 3.7+의 경우 asyncio.create_task로 백그라운드 태스크 예약
    asyncio.create_task(mock_kiwoom_data_generator())

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """클라이언트 웹소켓을 수락하고 메시지를 대기합니다."""
    await manager.connect(websocket)
    try:
        while True:
            # 현재 클라이언트로부터의 메시지 수신은 별도 처리가 필요 없으므로 단순 대기 유지
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
