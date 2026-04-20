from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio

from .database import engine, Base, SessionLocal
from .models import Watchlist
from .routers import watchlist
from .ws.manager import manager
from ..kiwoom.ws_client import kiwoom_ws_client

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
    """서버 시작 시 키움 웹소켓 클라이트를 초기화하고 자동 구독을 시작합니다."""
    # DB에서 초기 관심종목 목록 가져오기
    db = SessionLocal()
    try:
        items = db.query(Watchlist).all()
        stock_codes = [item.stock_code for item in items]
        
        # 키움 웹소켓 클라이언트 시작
        await kiwoom_ws_client.start(initial_codes=stock_codes)
    finally:
        db.close()

@app.on_event("shutdown")
async def shutdown_event():
    """서버 종료 시 웹소켓 클라이언트를 안전하게 정지합니다."""
    await kiwoom_ws_client.stop()

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
