from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from contextlib import asynccontextmanager

from .database import engine, Base, SessionLocal
from .models import Watchlist
from .routers import watchlist, stocks, exchange, dashboard, db_manage
from .ws.manager import manager
from src.kiwoom.ws_client import kiwoom_ws_client
from .services.kiwoom_service import KiwoomStockService
from .services.us_stock_service import us_stock_service
from .services.backup_service import BackupService
import datetime

# DB 테이블 생성 (처음 실행 시 SQLite 파일(assets.db)과 테이블이 생성됨)
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """서버 생명주기 관리: 시작 시 DB 로드 및 WS 시작, 종료 시 WS 중지"""
    # Startup: DB 백업 체크 및 수행
    try:
        BackupService().check_and_backup()
    except Exception as e:
        print(f"⚠️ DB 백업 중 오류 발생 (무시하고 서버 기동): {e}")

    # DB에서 초기 관심종목 목록 가져오기 및 키움 웹소켓 시작
    db = SessionLocal()
    try:
        # 주식 종목 리스트 동기화 체크 (오늘 수행한 기록이 없거나 데이터가 없으면 실행)
        stock_service = KiwoomStockService()
        last_sync = stock_service.get_last_sync_date(db)
        
        # 오늘 동기화 기록이 없으면 동기화 수행
        if last_sync != datetime.date.today():
            try:
                # 첫 동기화이거나 사용자의 초기화 요청이 있는 경우를 고려하여 로직 수행
                # 여기서는 단순히 일자가 다를 경우 최적화된 동기화 수행
                await stock_service.sync_all_stocks(db)
            except Exception as e:
                print(f"⚠️ 초기 종목 동기화 중 오류 발생 (무시하고 서버 기동): {e}")
            
        items = db.query(Watchlist).all()
        
        # 국내 주식 구독 시작
        kr_codes = [item.stock_code for item in items if item.country == "KR"]
        await kiwoom_ws_client.start(initial_codes=kr_codes)
        
        # 미국 주식 구독 시작
        us_codes = [item.stock_code for item in items if item.country == "US"]
        await us_stock_service.start(initial_symbols=us_codes)
    finally:
        db.close()
    
    yield
    
    # Shutdown: 웹소켓 및 폴링 서비스 안전 정지
    await kiwoom_ws_client.stop()
    await us_stock_service.stop()

app = FastAPI(title="AssetManager Backend API", lifespan=lifespan)

# CORS 활성화 (Vite 개발 서버의 로컬 접속을 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:5174", "http://127.0.0.1:5174"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 모듈화된 라우터 연결
app.include_router(watchlist.router)
app.include_router(stocks.router)
app.include_router(exchange.router)
app.include_router(dashboard.router)
app.include_router(db_manage.router)

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
