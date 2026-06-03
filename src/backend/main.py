from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .database import engine, Base, SessionLocal
from .models import Watchlist
from .routers import watchlist, stocks, exchange, dashboard, db_manage, connection, ratios, benchmark, sector
from .services.kiwoom_service import KiwoomStockService
from .services.backup_service import BackupService
import datetime
import os
import signal
import asyncio

@asynccontextmanager
async def lifespan(app: FastAPI):
    """서버 생명주기 관리: 시작 시 DB 로드 및 초기화"""
    # DB 테이블 생성 (처음 실행 시 SQLite 파일(assets.db)과 테이블이 생성됨)
    Base.metadata.create_all(bind=engine)
    
    # ADJUSTMENT -> CASH_ADJUSTMENT 데이터 마이그레이션 실행
    try:
        from .migration_v3 import run_migration
        run_migration()
    except Exception as e:
        print(f"⚠️ 데이터 마이그레이션 중 오류 발생 (무시하고 서버 기동): {e}")
    
    # Startup: DB 백업 체크 및 수행
    try:
        BackupService().check_and_backup()
    except Exception as e:
        print(f"⚠️ DB 백업 중 오류 발생 (무시하고 서버 기동): {e}")

    # DB에서 초기 관심종목 목록 가져오기 및 초기화
    db = SessionLocal()
    try:
        # 주식 종목 리스트 동기화 체크 (오늘 수행한 기록이 없거나 데이터가 없으면 실행)
        stock_service = KiwoomStockService()
        last_sync = stock_service.get_last_sync_date(db)
        
        # 오늘 동기화 기록이 없으면 동기화 수행
        if last_sync != datetime.date.today():
            try:
                await stock_service.sync_all_stocks(db)
            except Exception as e:
                print(f"⚠️ 초기 종목 동기화 중 오류 발생 (무시하고 서버 기동): {e}")
            
    finally:
        db.close()
    
    yield
    # Shutdown logic (none needed for now)

app = FastAPI(title="AssetManager Backend API", lifespan=lifespan)

# CORS 활성화 (Vite 개발 서버의 로컬 접속을 허용)
frontend_port = os.environ.get("ASSET_MANAGER_FRONTEND_PORT", "5173")
allow_origins = [
    f"http://localhost:{frontend_port}",
    f"http://127.0.0.1:{frontend_port}"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
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
app.include_router(connection.router)
app.include_router(ratios.router)
app.include_router(benchmark.router)
app.include_router(sector.router)

# 개발 모드 하트비트 및 자동 종료 로직
class HeartbeatManager:
    def __init__(self):
        self.active_connections = set()
        self.shutdown_timeout = 10
        self.shutdown_task = None

    async def add_connection(self, connection_id):
        self.active_connections.add(connection_id)
        if self.shutdown_task:
            self.shutdown_task.cancel()
            self.shutdown_task = None
        print(f"WebSocket connected. Active connections: {len(self.active_connections)}")

    async def remove_connection(self, connection_id):
        if connection_id in self.active_connections:
            self.active_connections.remove(connection_id)
        print(f"WebSocket disconnected. Active connections: {len(self.active_connections)}")
        
        if len(self.active_connections) == 0:
            self.shutdown_task = asyncio.create_task(self._delayed_shutdown())

    async def _delayed_shutdown(self):
        try:
            print(f"Starting shutdown timer ({self.shutdown_timeout}s)...")
            await asyncio.sleep(self.shutdown_timeout)
            if len(self.active_connections) == 0:
                print("No active connections. Shutting down server...")
                os.kill(os.getpid(), signal.SIGINT)
        except asyncio.CancelledError:
            print("Shutdown timer cancelled.")

heartbeat_manager = HeartbeatManager()

if os.environ.get("DEBUG") == "true":
    @app.websocket("/ws/dev/heartbeat")
    async def dev_heartbeat(websocket: WebSocket):
        await websocket.accept()
        client_id = id(websocket)
        await heartbeat_manager.add_connection(client_id)
        
        try:
            while True:
                # 클라이언트로부터 데이터를 기다림 (연결 유지 확인용)
                await websocket.receive_text()
        except WebSocketDisconnect:
            await heartbeat_manager.remove_connection(client_id)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("ASSET_MANAGER_BACKEND_PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
