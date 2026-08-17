# -*- coding: utf-8 -*-
"""백그라운드 태스크 관리자 및 싱글톤 수명주기 단위 테스트입니다."""

import pytest
import asyncio
import datetime
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient

from src.backend.tasks import BackgroundTaskManager, task_manager_instance
from src.backend.main import app


def test_task_manager_singleton_consistency():
    """FastAPI 라우터와 tasks 모듈에서 동일한 task_manager_instance 싱글톤 객체를 참조하는지 검증합니다."""
    from src.backend.routers.system import task_manager_instance as router_instance
    from src.backend.tasks import task_manager_instance as tasks_module_instance

    assert router_instance is tasks_module_instance
    assert isinstance(task_manager_instance, BackgroundTaskManager)


@pytest.mark.asyncio
async def test_daily_maintenance_loop_handles_stock_sync_error():
    """유지보수 루프에서 주식 동기화 실패 시 update_task_error가 정상 호출되고 예외로 크래시되지 않는지 검증합니다."""
    manager = BackgroundTaskManager()
    manager._running = True

    # DB 백업 성공 모킹
    mock_backup = MagicMock()
    
    # 주식 동기화 실패 모킹
    mock_stock_service = MagicMock()
    mock_stock_service.get_last_sync_date.return_value = datetime.date(2000, 1, 1)
    mock_stock_service.sync_all_stocks = AsyncMock(side_effect=RuntimeError("키움 동기화 실패"))

    sleep_count = 0
    async def mock_sleep(seconds):
        nonlocal sleep_count
        sleep_count += 1
        # 한 번 루프 돌고 정지
        if sleep_count >= 1:
            manager._running = False

    with patch("src.backend.tasks.BackupService", return_value=mock_backup), \
         patch("src.backend.tasks.SessionLocal"), \
         patch("src.backend.tasks.KiwoomStockService", return_value=mock_stock_service), \
         patch("asyncio.sleep", side_effect=mock_sleep):

        await manager._daily_maintenance_loop()

    status = manager.get_task_status()
    assert status["db_backup"]["status"] == "success"
    assert status["stock_sync"]["status"] == "failed"
    assert "키움 동기화 실패" in status["stock_sync"]["last_error"]
    assert status["stock_sync"]["last_error_time"] is not None


@pytest.mark.asyncio
async def test_daily_maintenance_loop_handles_backup_error():
    """유지보수 루프에서 DB 백업 실패 시 에러가 기록되고 루프가 중단되지 않고 지속되는지 검증합니다."""
    manager = BackgroundTaskManager()
    manager._running = True

    mock_backup = MagicMock()
    mock_backup.check_and_backup.side_effect = IOError("백업 디스크 용량 부족")

    mock_stock_service = MagicMock()
    mock_stock_service.get_last_sync_date.return_value = datetime.date.today()

    sleep_count = 0
    async def mock_sleep(seconds):
        nonlocal sleep_count
        sleep_count += 1
        if sleep_count >= 1:
            manager._running = False

    with patch("src.backend.tasks.BackupService", return_value=mock_backup), \
         patch("src.backend.tasks.SessionLocal"), \
         patch("src.backend.tasks.KiwoomStockService", return_value=mock_stock_service), \
         patch("asyncio.sleep", side_effect=mock_sleep):

        await manager._daily_maintenance_loop()

    status = manager.get_task_status()
    assert status["db_backup"]["status"] == "failed"
    assert "백업 디스크 용량 부족" in status["db_backup"]["last_error"]
    assert status["db_backup"]["last_error_time"] is not None
