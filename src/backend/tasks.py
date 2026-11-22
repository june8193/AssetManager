# -*- coding: utf-8 -*-
"""백그라운드 주기적 태스크 관리를 위한 모듈입니다.

시세 업데이트, 데이터베이스 자동 백업, 주식 종목 동기화 등의
백그라운드 주기적 작업을 통합하여 관리하고 상태를 추적합니다.
"""

import asyncio
import logging
import datetime
import sys
import os
from sqlalchemy.orm import Session
from .database import SessionLocal
from .services.price_service import price_service
from .services.backup_service import BackupService
from .services.kiwoom_service import KiwoomStockService

logger = logging.getLogger("BackgroundTaskManager")


class BackgroundTaskManager:
    """백그라운드 주기적 태스크들의 생명주기와 실행 상태를 관리하는 클래스입니다."""

    def __init__(self):
        """BackgroundTaskManager를 초기화합니다."""
        self._tasks = []
        self._running = False
        self._task_status = {
            "price_update": {
                "last_run": None,
                "status": "pending",
                "last_success": None,
                "last_error": None,
                "last_error_time": None,
            },
            "db_backup": {
                "last_run": None,
                "status": "pending",
                "last_success": None,
                "last_error": None,
                "last_error_time": None,
            },
            "stock_sync": {
                "last_run": None,
                "status": "pending",
                "last_success": None,
                "last_error": None,
                "last_error_time": None,
            },
            "exchange_rate_update": {
                "last_run": None,
                "status": "pending",
                "last_success": None,
                "last_error": None,
                "last_error_time": None,
            },
            "market_indicator_sync": {
                "last_run": None,
                "status": "pending",
                "last_success": None,
                "last_error": None,
                "last_error_time": None,
            },
        }
        self._last_indicator_sync_date: datetime.date | None = None

    def get_task_status(self) -> dict:
        """현재 태스크별 상태 레지스트리 복사본을 반환합니다."""
        return self._task_status.copy()

    def update_task_success(self, task_name: str):
        """특정 태스크 성공 기록을 업데이트합니다."""
        now_str = datetime.datetime.now().isoformat()
        if task_name in self._task_status:
            self._task_status[task_name]["last_run"] = now_str
            self._task_status[task_name]["status"] = "success"
            self._task_status[task_name]["last_success"] = now_str
            self._task_status[task_name]["last_error"] = None

    def update_task_error(self, task_name: str, error_msg: str):
        """특정 태스크 에러 기록을 업데이트합니다."""
        now_str = datetime.datetime.now().isoformat()
        if task_name in self._task_status:
            self._task_status[task_name]["last_run"] = now_str
            self._task_status[task_name]["status"] = "failed"
            self._task_status[task_name]["last_error"] = error_msg
            self._task_status[task_name]["last_error_time"] = now_str

    def start(self):
        """백그라운드 태스크 루프를 가동합니다.

        FastAPI lifespan startup 단계에서 호출됩니다.
        """
        self._running = True
        self._tasks.append(asyncio.create_task(self._price_update_loop()))
        self._tasks.append(asyncio.create_task(self._daily_maintenance_loop()))
        logger.info("백그라운드 주기적 태스크 매니저가 기동되었습니다.")

    async def stop(self):
        """백그라운드 태스크 루프를 안전하게 종료합니다.

        FastAPI lifespan shutdown 단계에서 호출됩니다.
        """
        self._running = False
        if not self._tasks:
            return

        logger.info("백그라운드 주기적 태스크들을 정지하는 중...")
        for task in self._tasks:
            task.cancel()

        # 모든 태스크가 완전히 취소될 때까지 대기
        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()
        logger.info("모든 백그라운드 태스크가 안전하게 종료되었습니다.")

    async def _price_update_loop(self):
        """1시간마다 지수, 보유 자산, 관심 종목의 시세를 업데이트하는 루프입니다."""
        # 서버 기동 직후 API 및 DB 초기화 안정을 위해 최초 5초 대기
        await asyncio.sleep(5)
        while self._running:
            try:
                logger.info("백그라운드 시세 업데이트 태스크 시작")
                await price_service.update_all_market_prices()
                self.update_task_success("price_update")
                logger.info("백그라운드 시세 업데이트 완료")
            except asyncio.CancelledError:
                logger.info("시세 업데이트 루프가 취소되었습니다.")
                break
            except Exception as e:
                error_msg = str(e)
                self.update_task_error("price_update", error_msg)
                logger.error(f"백그라운드 시세 업데이트 중 예외 발생: {e}")

            # 1시간(3600초) 대기
            await asyncio.sleep(3600)

    async def sync_market_indicators(
        self,
        db: Session,
        today: datetime.date | None = None,
    ) -> bool:
        """1일 1회 주요 시장 지표(^VIX, DX-Y.NYB)의 일봉 데이터를 동기화하여 DB에 적재합니다.

        Args:
            db (Session): 데이터베이스 세션
            today (datetime.date | None): 기준 일자 (생략 시 오늘 날짜)

        Returns:
            bool: 동기화 수행 여부 (당일 이미 완료되어 스킵되면 False)
        """
        target_today = today or datetime.date.today()
        if self._last_indicator_sync_date == target_today:
            logger.info("오늘(%s) 이미 시장 지표 동기화가 완료되었습니다. 작업을 건너뜁니다.", target_today)
            return False

        from sqlalchemy import func
        from .models import HistoricalPrice
        from .services.benchmark_service import BenchmarkService

        try:
            service = BenchmarkService(db)
            for ticker in ("^VIX", "DX-Y.NYB"):
                row = (
                    db.query(
                        func.count(HistoricalPrice.id),
                        func.max(HistoricalPrice.price_date),
                    )
                    .filter(
                        HistoricalPrice.ticker == ticker,
                        HistoricalPrice.close_price > 0.0,
                    )
                    .first()
                )
                count = int(row[0] or 0) if row else 0
                max_date = row[1] if row else None

                if count < 100 or max_date is None:
                    start_date = target_today - datetime.timedelta(days=365 * 20)
                else:
                    start_date = max_date - datetime.timedelta(days=5)

                await service.get_historical_prices(ticker, start_date, target_today)

            self._last_indicator_sync_date = target_today
            self.update_task_success("market_indicator_sync")
            logger.info("시장 지표(^VIX, DX-Y.NYB) 일일 동기화 완료 (%s)", target_today)
            return True
        except Exception as e:
            error_msg = str(e)
            self.update_task_error("market_indicator_sync", error_msg)
            logger.error("시장 지표 동기화 중 예외 발생: %s", error_msg)
            return False

    async def _daily_maintenance_loop(self):
        """24시간 주기로 실행되어야 하는 유지보수 작업(DB 백업, 종목 동기화)을 관리하는 루프입니다."""
        while self._running:
            try:
                # 1. DB 자동 백업 수행
                logger.info("데이터베이스 자동 백업 조건 확인 중...")
                await asyncio.to_thread(BackupService().check_and_backup)
                self.update_task_success("db_backup")
            except asyncio.CancelledError:
                logger.info("유지보수 루프가 취소되었습니다.")
                break
            except Exception as e:
                error_msg = str(e)
                self.update_task_error("db_backup", error_msg)
                logger.error(f"유지보수 루프 - DB 백업 중 예외 발생: {e}")

            try:
                # 2. 국내 주식 종목 정보 동기화
                logger.info("국내 주식 종목 동기화 조건 확인 중...")
                db = SessionLocal()
                try:
                    stock_service = KiwoomStockService()
                    last_sync = stock_service.get_last_sync_date(db)

                    if last_sync != datetime.date.today():
                        logger.info("오늘 수행된 주식 종목 동기화 기록이 없어 동기화를 실행합니다.")
                        await stock_service.sync_all_stocks(db)
                        self.update_task_success("stock_sync")
                    else:
                        logger.info("오늘 이미 주식 종목 동기화가 완료되었습니다. 작업을 건너뜁니다.")
                finally:
                    db.close()
            except asyncio.CancelledError:
                logger.info("유지보수 루프가 취소되었습니다.")
                break
            except Exception as e:
                error_msg = str(e)
                self.update_task_error("stock_sync", error_msg)
                logger.error(f"유지보수 루프 - 주식 종목 동기화 중 예외 발생: {e}")

            try:
                # 3. 주요 시장 지표(^VIX, DX-Y.NYB) 1일 1회 동기화
                logger.info("시장 지표(^VIX, DX-Y.NYB) 일일 동기화 조건 확인 중...")
                db = SessionLocal()
                try:
                    await self.sync_market_indicators(db)
                finally:
                    db.close()
            except asyncio.CancelledError:
                logger.info("유지보수 루프가 취소되었습니다.")
                break
            except Exception as e:
                error_msg = str(e)
                self.update_task_error("market_indicator_sync", error_msg)
                logger.error(f"유지보수 루프 - 시장 지표 동기화 중 예외 발생: {e}")

            try:
                # 1시간(3600초) 후에 다시 체크
                await asyncio.sleep(3600)
            except asyncio.CancelledError:
                logger.info("유지보수 루프가 취소되었습니다.")
                break


# 모듈 전역에서 공유하는 BackgroundTaskManager 싱글톤 인스턴스
task_manager_instance = BackgroundTaskManager()
