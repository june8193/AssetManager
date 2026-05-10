import os
import signal
import asyncio
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
import time

# 테스트를 위해 DEBUG 환경 변수를 설정하고 src.backend.main을 임포트합니다.
@pytest.fixture
def client():
    with patch.dict(os.environ, {"DEBUG": "true"}):
        # 로직이 임포트 시점에 결정될 수 있으므로 reload 고려
        import importlib
        import src.backend.main
        importlib.reload(src.backend.main)
        from src.backend.main import app
        yield TestClient(app)

def test_heartbeat_websocket_endpoint_exists(client):
    """WebSocket 엔드포인트 /ws/dev/heartbeat가 존재하는지 확인"""
    try:
        with client.websocket_connect("/ws/dev/heartbeat") as websocket:
            # 연결이 성공하면 성공
            pass
    except Exception as e:
        pytest.fail(f"WebSocket connection failed: {e}")

@pytest.mark.asyncio
async def test_heartbeat_shutdown_after_timeout(client):
    """연결이 끊기고 10초(테스트에서는 짧게 조정 가능해야 함) 후에 os.kill이 호출되는지 확인"""
    import src.backend.main as main_mod
    
    # 테스트를 위해 타임아웃을 1초로 단축 (구현 시 이 변수를 사용할 수 있게 해야 함)
    if hasattr(main_mod, "HEARTBEAT_SHUTDOWN_TIMEOUT"):
        original_timeout = main_mod.HEARTBEAT_SHUTDOWN_TIMEOUT
        main_mod.HEARTBEAT_SHUTDOWN_TIMEOUT = 1
    else:
        # 아직 구현 전이므로 속성 없을 수 있음
        pass

    with patch("os.kill") as mock_kill:
        with client.websocket_connect("/ws/dev/heartbeat") as websocket:
            # 연결 유지 중에는 종료되지 않아야 함
            await asyncio.sleep(0.5)
            mock_kill.assert_not_called()
        
        # 연결 끊김 -> 타이머 시작
        # 1.5초 대기 (타임아웃 1초 초과)
        await asyncio.sleep(2.0)
        
        # os.kill(os.getpid(), signal.SIGINT)가 호출되었는지 확인
        mock_kill.assert_called_once_with(os.getpid(), signal.SIGINT)

    # 타임아웃 복구 (다른 테스트에 영향 주지 않게)
    if hasattr(main_mod, "HEARTBEAT_SHUTDOWN_TIMEOUT"):
        main_mod.HEARTBEAT_SHUTDOWN_TIMEOUT = original_timeout

def test_heartbeat_no_shutdown_when_reconnected(client):
    """연결이 끊겼다가 타임아웃 전에 다시 연결되면 종료되지 않아야 함"""
    import src.backend.main as main_mod
    if hasattr(main_mod, "HEARTBEAT_SHUTDOWN_TIMEOUT"):
        main_mod.HEARTBEAT_SHUTDOWN_TIMEOUT = 1

    with patch("os.kill") as mock_kill:
        with client.websocket_connect("/ws/dev/heartbeat") as websocket:
            pass
        
        # 연결 끊김, 0.5초 후 재연결
        time.sleep(0.5)
        with client.websocket_connect("/ws/dev/heartbeat") as websocket:
            time.sleep(1.0) # 총 1.5초 지남, 하지만 재연결 상태
            mock_kill.assert_not_called()

def test_heartbeat_disabled_when_debug_false():
    """DEBUG=false 일 때는 WebSocket 엔드포인트가 동작하지 않거나 종료 로직이 없어야 함"""
    with patch.dict(os.environ, {"DEBUG": "false"}):
        import importlib
        import src.backend.main
        importlib.reload(src.backend.main)
        from src.backend.main import app
        client = TestClient(app)
        
        # 구현 방식에 따라 엔드포인트 자체가 없을 수도 있고, 로직만 안 탈 수도 있음.
        # 여기서는 연결은 되더라도 종료 로직이 작동하지 않는 것을 확인하는 방향으로 작성 가능.
        # 또는 404를 기대할 수도 있음.
        with patch("os.kill") as mock_kill:
            try:
                with client.websocket_connect("/ws/dev/heartbeat") as websocket:
                    pass
                time.sleep(1.5) # 타임아웃 대기
                mock_kill.assert_not_called()
            except:
                # 404 등으로 연결 실패하는 것도 허용 (엔드포인트를 DEBUG 일 때만 추가할 경우)
                pass
