# -*- coding: utf-8 -*-
"""BackgroundTaskManager 상태 관리 및 /api/v1/system/tasks/status 라우터 단위 테스트입니다."""

import pytest
import datetime
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient

from src.backend.tasks import BackgroundTaskManager, task_manager_instance
from src.backend.services.price_service import price_service
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
    assert "exchange_rate_update" in status
    assert status["exchange_rate_update"]["status"] == "pending"


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


@pytest.mark.asyncio
async def test_exchange_rate_update_records_status_on_fetch(db_session):
    """환율 수집 성공 및 실패 시 BackgroundTaskManager에 상태가 기록되는지 검증합니다."""
    today = datetime.date(2026, 7, 20)
    now_kst_930am = datetime.datetime(2026, 7, 20, 9, 30, 0)

    # 1. 환율 수집 성공 시
    with patch.object(price_service, "fetch_and_save_exchange_rate", new_callable=AsyncMock, return_value=1380.0), \
         patch.object(price_service, "is_market_holiday", new_callable=AsyncMock, return_value=False), \
         patch.object(price_service, "_get_now", return_value=now_kst_930am), \
         patch.object(price_service, "_get_today", return_value=today), \
         patch("src.backend.tasks.task_manager_instance.update_task_success") as mock_success:

        await price_service.update_all_market_prices(is_manual=False)
        mock_success.assert_called_with("exchange_rate_update")

    # 2. 환율 수집 실패(None) 시 -> 재시도 없이 수집 중단 및 error 상태 기록
    with patch.object(price_service, "fetch_and_save_exchange_rate", new_callable=AsyncMock, return_value=None), \
         patch.object(price_service, "is_market_holiday", new_callable=AsyncMock, return_value=False), \
         patch.object(price_service, "_get_now", return_value=now_kst_930am), \
         patch.object(price_service, "_get_today", return_value=today), \
         patch("src.backend.tasks.task_manager_instance.update_task_error") as mock_error:

        await price_service.update_all_market_prices(is_manual=False)
        mock_error.assert_called_once()
        assert "exchange_rate_update" in mock_error.call_args[0][0]


def test_task_status_api_endpoint():
    """GET /api/v1/system/tasks/status 엔드포인트가 200 OK와 상태 정보를 반환하는지 검증합니다."""
    client = TestClient(app)
    response = client.get("/api/v1/system/tasks/status")
    assert response.status_code == 200
    data = response.json()
    assert "price_update" in data
    assert "db_backup" in data
    assert "stock_sync" in data
    assert "exchange_rate_update" in data

