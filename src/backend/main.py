# -*- coding: utf-8 -*-
"""AssetManager 백엔드 FastAPI 애플리케이션 진입점 및 생명주기 관리 모듈입니다."""

from contextlib import asynccontextmanager
import asyncio
import os
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base
from .config import TelegramConfig, get_settings
from .telegram import (
    TelegramBot,
    TelegramClient,
    MarketCloseScheduler,
    FailureAlertScheduler,
)
from .routers import (
    accounts,
    assets,
    transactions,
    snapshots,
    watchlist,
    stocks,
    exchange,
    dashboard,
    connection,
    ratios,
    benchmark,
    sector,
    market,
    simulation,
    portfolio,
    kiwoom,
    system,
    dividend,
    performance,
    expenses,
)



def is_in_testing_environment() -> bool:
    """현재 실행 환경이 테스트 환경(pytest 등)인지 확인합니다.

    Returns:
        테스트 환경이면 True, 아니면 False
    """
    return "pytest" in sys.modules or os.environ.get("PYTEST_CURRENT_TEST") is not None


def should_start_telegram(telegram_config: TelegramConfig | None = None) -> bool:
    """텔레그램 봇 및 스케줄러 기동 여부를 환경 가드와 설정을 기반으로 검사합니다.

    격리 가드 규칙:
    1. 테스트 환경(pytest 실행 중 또는 PYTEST_CURRENT_TEST 환경변수 존재)인 경우 절대 기동하지 않습니다.
    2. 개발 환경(APP_ENV=development)인 경우 절대 기동하지 않습니다 (409 Conflict 원천 방지).
    3. 봇 토큰이 비어있는 경우 기동하지 않습니다.
    4. telegram_config.enabled가 True이거나 APP_ENV가 'production'인 경우 기동합니다.

    Args:
        telegram_config: 텔레그램 설정 객체 (생략 시 get_settings().telegram 사용)

    Returns:
        기동 조건 충족 시 True, 그 외 False
    """
    if is_in_testing_environment():
        return False

    app_env = os.environ.get("APP_ENV", "").lower()
    if app_env == "development":
        return False

    if telegram_config is None:
        telegram_config = get_settings().telegram

    if not telegram_config.bot_token:
        return False

    is_production = app_env == "production"
    return telegram_config.enabled or is_production


@asynccontextmanager
async def lifespan(app: FastAPI):
    """서버 생명주기 관리: 시작 시 DB 초기화, 백그라운드 태스크 및 텔레그램 서비스 기동"""
    # 1. DB 테이블 생성 (처음 실행 시 SQLite 파일과 테이블 생성)
    Base.metadata.create_all(bind=engine)

    # 2. SQLite 마이그레이션 체크
    from .migrations import run_migrations
    run_migrations(engine)

    # 3. 백그라운드 주기적 태스크 매니저 가동 (테스트 환경인 경우 기동 생략)
    is_testing = is_in_testing_environment()
    if not is_testing:
        from .tasks import task_manager_instance
        task_manager_instance.start()

    # 4. 텔레그램 봇 및 스케줄러 서비스 기동 (환경 격리 가드 통과 시)
    telegram_bot = None
    market_scheduler = None
    failure_scheduler = None
    telegram_client = None
    telegram_tasks: list[asyncio.Task] = []

    telegram_config = get_settings().telegram
    if should_start_telegram(telegram_config):
        telegram_client = TelegramClient(bot_token=telegram_config.bot_token)
        telegram_bot = TelegramBot(config=telegram_config, client=telegram_client)
        market_scheduler = MarketCloseScheduler(
            client=telegram_client,
            config=telegram_config,
        )
        failure_scheduler = FailureAlertScheduler(
            client=telegram_client,
            config=telegram_config,
        )

        # 비동기 백그라운드 태스크로 봇 및 스케줄러 기동
        bot_task = asyncio.create_task(telegram_bot.start_polling())
        telegram_tasks.append(bot_task)

        market_task = market_scheduler.start()
        if market_task:
            telegram_tasks.append(market_task)

        failure_task = failure_scheduler.start()
        if failure_task:
            telegram_tasks.append(failure_task)

    yield

    # 5. Shutdown: 텔레그램 서비스 안전한 리소스 정리 (Graceful Shutdown)
    if market_scheduler:
        market_scheduler.stop()
    if failure_scheduler:
        failure_scheduler.stop()

    for task in telegram_tasks:
        if not task.done():
            task.cancel()

    if telegram_bot:
        try:
            await telegram_bot.aclose()
        except Exception:
            pass
    elif telegram_client:
        try:
            await telegram_client.aclose()
        except Exception:
            pass

    # 6. Shutdown: 백그라운드 주기적 태스크 매니저 정지
    if not is_testing:
        from .tasks import task_manager_instance
        await task_manager_instance.stop()


app = FastAPI(title="AssetManager Backend API", lifespan=lifespan)

# CORS 활성화 (Vite 개발 서버 및 사설 IP 대역 접속을 유연하게 허용)
allow_origin_regex = (
    r"https?://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|"
    r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?"
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 모듈화된 라우터 연결
app.include_router(accounts.router)
app.include_router(assets.router)
app.include_router(transactions.router)
app.include_router(snapshots.router)
app.include_router(watchlist.router)
app.include_router(stocks.router)
app.include_router(exchange.router)
app.include_router(dashboard.router)
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
app.include_router(expenses.router)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("ASSET_MANAGER_BACKEND_PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
