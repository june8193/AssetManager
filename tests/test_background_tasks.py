import pytest
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock
from src.backend.tasks import BackgroundTaskManager

@pytest.mark.asyncio
async def test_task_manager_start_stop():
    """BackgroundTaskManager가 정상적으로 기동하고 정지되는지 검증합니다."""
    manager = BackgroundTaskManager()
    
    # 루프 함수 자체를 Mock 처리하여 즉시 종료되도록 모킹
    with patch.object(manager, "_price_update_loop", new_callable=AsyncMock) as mock_price_loop, \
         patch.object(manager, "_daily_maintenance_loop", new_callable=AsyncMock) as mock_maintenance_loop:
        
        manager.start()
        assert manager._running is True
        assert len(manager._tasks) == 2
        
        await manager.stop()
        assert manager._running is False
        assert len(manager._tasks) == 0
        
        mock_price_loop.assert_called_once()
        mock_maintenance_loop.assert_called_once()
