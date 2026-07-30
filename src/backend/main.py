from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .database import engine, Base
from .routers import watchlist, stocks, exchange, dashboard, db_manage, connection, ratios, benchmark, sector, market, simulation, portfolio, kiwoom, system, dividend, performance
import os
import sys
import asyncio

# 전역 태스크 매니저 선언 (종료 시 접근하기 위함)
task_manager = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """서버 생명주기 관리: 시작 시 DB 초기화 및 백그라운드 태스크 기동"""
    # DB 테이블 생성 (처음 실행 시 SQLite 파일(assets.db)과 테이블이 생성됨)
    Base.metadata.create_all(bind=engine)
    
    # SQLite 마이그레이션 체크
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            # historical_prices 마이그레이션
            result = conn.execute(text("PRAGMA table_info(historical_prices)")).fetchall()
            columns = [row[1] for row in result]
            if "updated_at" not in columns:
                print("[INFO] historical_prices 테이블에 updated_at 컬럼을 추가합니다.")
                conn.execute(text("ALTER TABLE historical_prices ADD COLUMN updated_at DATETIME"))
                conn.execute(text("UPDATE historical_prices SET updated_at = datetime('now', 'localtime')"))
                conn.commit()

            # transactions 마이그레이션 (source, external_id 추가 및 소급 보정)
            tx_result = conn.execute(text("PRAGMA table_info(transactions)")).fetchall()
            tx_columns = [row[1] for row in tx_result]
            if "source" not in tx_columns:
                print("[INFO] transactions 테이블에 source 컬럼을 추가합니다.")
                conn.execute(text("ALTER TABLE transactions ADD COLUMN source VARCHAR DEFAULT 'MANUAL'"))
                conn.execute(text("UPDATE transactions SET source = 'AUTO_KIWOOM' WHERE memo LIKE '%키움 자동저장%'"))
                conn.commit()
            if "external_id" not in tx_columns:
                print("[INFO] transactions 테이블에 external_id 컬럼을 추가합니다.")
                conn.execute(text("ALTER TABLE transactions ADD COLUMN external_id VARCHAR"))
                conn.commit()
    except Exception as e:
        print(f"⚠️ 마이그레이션 오류 (무시하고 진행): {e}")

    # 백그라운드 주기적 태스크 매니저 가동 (테스트 환경인 경우 기동 생략)
    is_testing = "pytest" in sys.modules or os.environ.get("PYTEST_CURRENT_TEST") is not None
    global task_manager
    if not is_testing:
        from .tasks import BackgroundTaskManager
        task_manager = BackgroundTaskManager()
        task_manager.start()

    yield

    # Shutdown: 백그라운드 태스크 정지
    if not is_testing and task_manager is not None:
        await task_manager.stop()

app = FastAPI(title="AssetManager Backend API", lifespan=lifespan)

# CORS 활성화 (Vite 개발 서버 및 사설 IP 대역 접속을 유연하게 허용)
allow_origin_regex = r"https?://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?"

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=allow_origin_regex,
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
app.include_router(market.router)
app.include_router(simulation.router)
app.include_router(portfolio.router)
app.include_router(kiwoom.router)
app.include_router(system.router)
app.include_router(dividend.router)
app.include_router(performance.router)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("ASSET_MANAGER_BACKEND_PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
