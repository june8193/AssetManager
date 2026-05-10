import pytest
import os
import signal
import asyncio
from unittest.mock import patch, MagicMock
from src.backend.main import HeartbeatManager

@pytest.mark.asyncio
async def test_heartbeat_manager_logic():
    """HeartbeatManager의 핵심 로직을 직접 테스트합니다."""
    manager = HeartbeatManager()
    manager.shutdown_timeout = 0.1
    
    with patch("os.kill") as mock_kill:
        # 1. 연결 추가
        await manager.add_connection("conn1")
        assert len(manager.active_connections) == 1
        assert manager.shutdown_task is None
        
        # 2. 연결 제거 (타이머 시작)
        await manager.remove_connection("conn1")
        assert len(manager.active_connections) == 0
        assert manager.shutdown_task is not None
        
        # 3. 타이머 대기 후 종료 확인
        await asyncio.sleep(0.2)
        mock_kill.assert_called_once_with(os.getpid(), signal.SIGINT)

@pytest.mark.asyncio
async def test_heartbeat_manager_cancel_on_reconnect():
    """재연결 시 타이머가 취소되는지 확인합니다."""
    manager = HeartbeatManager()
    manager.shutdown_timeout = 0.3
    
    with patch("os.kill") as mock_kill:
        await manager.add_connection("conn1")
        await manager.remove_connection("conn1")
        assert manager.shutdown_task is not None
        
        await asyncio.sleep(0.1)
        # 재연결
        await manager.add_connection("conn2")
        assert manager.shutdown_task is None # 취소되어야 함
        
        await asyncio.sleep(0.3)
        mock_kill.assert_not_called()
        
        # 다시 제거
        await manager.remove_connection("conn2")
        await asyncio.sleep(0.4)
        mock_kill.assert_called_once_with(os.getpid(), signal.SIGINT)
