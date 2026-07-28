# -*- coding: utf-8 -*-
"""BackgroundTaskManager 상태 관리 및 /api/v1/system/tasks/status 라우터 단위 테스트입니다."""

import pytest
import datetime
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient

from src.backend.tasks import BackgroundTaskManager, task_manager_instance
from src.backend.main import app


@pytest.fixture
def manager():
    return BackgroundTaskManager()


def test_task_manager_initial_status(manager):
    """기본 초기 상태가 정상적으로 구성되어 있는지 검증합니다."""
    status = manager.get_task_status()
    assert "price_update" in status
    assert "db_backup" in status
    assert "stock_sync" in status
    assert status["price_update"]["status"] == "pending"


@pytest.mark.asyncio
async def test_price_update_loop_records_success(manager):
    """시세 업데이트 성공 시 상태 레지스트리에 성공 상태가 기록되는지 검증합니다."""
    with patch("src.backend.services.price_service.price_service.update_all_market_prices", new_callable=AsyncMock):
        manager._running = True
        sleep_calls = 0

        async def mock_sleep(seconds):
            nonlocal sleep_calls
            sleep_calls += 1
            if sleep_calls >= 2:
                manager._running = False

        with patch("asyncio.sleep", side_effect=mock_sleep):
            await manager._price_update_loop()

    status = manager.get_task_status()
    assert status["price_update"]["status"] == "success"
    assert status["price_update"]["last_success"] is not None
    assert status["price_update"]["last_error"] is None


@pytest.mark.asyncio
async def test_price_update_loop_records_error(manager):
    """시세 업데이트 중 예외 발생 시 상태 레지스트리에 에러가 기록되는지 검증합니다."""
    with patch("src.backend.services.price_service.price_service.update_all_market_prices", side_effect=ValueError("시세 업데이트 실패")):
        manager._running = True
        sleep_calls = 0

        async def mock_sleep(seconds):
            nonlocal sleep_calls
            sleep_calls += 1
            if sleep_calls >= 2:
                manager._running = False

        with patch("asyncio.sleep", side_effect=mock_sleep):
            await manager._price_update_loop()

    status = manager.get_task_status()
    assert status["price_update"]["status"] == "failed"
    assert status["price_update"]["last_error"] == "시세 업데이트 실패"
    assert status["price_update"]["last_error_time"] is not None


def test_task_status_api_endpoint():
    """GET /api/v1/system/tasks/status 엔드포인트가 200 OK와 상태 정보를 반환하는지 검증합니다."""
    client = TestClient(app)
    response = client.get("/api/v1/system/tasks/status")
    assert response.status_code == 200
    data = response.json()
    assert "price_update" in data
    assert "db_backup" in data
    assert "stock_sync" in data
