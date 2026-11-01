# -*- coding: utf-8 -*-
"""웹 서버 재시작 API(POST /api/v1/system/restart) 및 개발 서버 자동 재기동 연동 테스트 모듈입니다."""

import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from src.backend.config import Settings, TelegramConfig
from src.backend.main import app, lifespan
from src.backend.services.restart_service import (
    DEFAULT_RESTART_DELAY_SECONDS,
    RESTART_FLAG_FILENAME,
    get_restart_flag_paths,
    is_restart_pending,
    create_restart_flag,
    cleanup_restart_flag,
    trigger_server_restart,
)
from src.backend.telegram.bot import TelegramBot
from scripts.dev import check_and_clear_restart_flag, start_backend_process


@pytest.fixture
def temp_storage_and_root(tmp_path: Path):
    """테스트를 위한 임시 스토리지 디렉터리와 임시 루트 디렉터리를 생성하고 설정을 패치합니다."""
    storage_dir = tmp_path / "storage"
    storage_dir.mkdir(parents=True, exist_ok=True)
    root_dir = tmp_path / "app_root"
    root_dir.mkdir(parents=True, exist_ok=True)

    test_settings = Settings()
    test_settings.telegram = TelegramConfig(
        bot_token="TEST_BOT_TOKEN",
        allowed_user_ids=[123456],
        enabled=True,
        storage_dir=str(storage_dir),
    )

    with patch("src.backend.services.restart_service.get_settings", return_value=test_settings), \
         patch("src.backend.services.restart_service.PROJECT_ROOT", root_dir):
        yield {
            "storage_dir": storage_dir,
            "root_dir": root_dir,
            "settings": test_settings,
        }


def test_restart_flag_paths_and_creation(temp_storage_and_root):
    """플래그 파일 경로 반환, 생성, 확인, 정리 기능이 올바르게 동작해야 합니다."""
    storage_dir = temp_storage_and_root["storage_dir"]
    root_dir = temp_storage_and_root["root_dir"]

    paths = get_restart_flag_paths()
    expected_storage_flag = storage_dir / RESTART_FLAG_FILENAME
    expected_root_flag = root_dir / RESTART_FLAG_FILENAME
    assert expected_storage_flag in paths
    assert expected_root_flag in paths

    # 초기에는 플래그가 없어야 함
    assert not is_restart_pending()

    # 플래그 생성
    created = create_restart_flag()
    assert is_restart_pending()
    for p in created:
        assert p.exists()
        assert p.read_text(encoding="utf-8") == "restart_pending"

    # 플래그 삭제
    cleanup_restart_flag()
    assert not is_restart_pending()
    for p in created:
        assert not p.exists()


def test_post_system_restart_success(temp_storage_and_root):
    """POST /api/v1/system/restart 호출 시 200 반환, 플래그 생성, 비동기 지연 종료 호출 확인."""
    mock_exit = MagicMock()
    storage_dir = temp_storage_and_root["storage_dir"]
    root_dir = temp_storage_and_root["root_dir"]
    flag_file = storage_dir / RESTART_FLAG_FILENAME
    root_flag_file = root_dir / RESTART_FLAG_FILENAME

    assert not is_restart_pending()

    with patch("src.backend.services.restart_service.default_exit_system", mock_exit):
        client = TestClient(app)
        response = client.post("/api/v1/system/restart")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "restarting"
        assert "서버를 재시작합니다" in data["message"]

        # 플래그 파일이 생성되었는지 확인
        assert flag_file.exists()
        assert root_flag_file.exists()
        assert is_restart_pending()


def test_post_system_restart_duplicate_returns_409(temp_storage_and_root):
    """이미 재시작 플래그가 존재하는 경우 409 Conflict 에러를 반환해야 합니다."""
    mock_exit = MagicMock()
    create_restart_flag()
    assert is_restart_pending()

    with patch("src.backend.services.restart_service.default_exit_system", mock_exit):
        client = TestClient(app)
        response = client.post("/api/v1/system/restart")

        assert response.status_code == 409
        data = response.json()
        assert "이미 서버 재시작이 진행 중입니다" in data["detail"]
        mock_exit.assert_not_called()


@pytest.mark.asyncio
async def test_trigger_server_restart_delayed_exit(temp_storage_and_root):
    """trigger_server_restart가 지연 시간 후 정상적으로 exit_func를 비동기 호출해야 합니다."""
    mock_exit = MagicMock()

    # 짧은 지연 시간(0.05초)으로 호출
    res = await trigger_server_restart(delay=0.05, exit_func=mock_exit)
    assert res.status == "restarting"
    assert is_restart_pending()

    # 아직 지연 시간 전이므로 exit_func가 즉시 호출되지는 않았어야 함
    assert mock_exit.call_count == 0

    # 지연 시간 경과 대기
    await asyncio.sleep(0.1)
    mock_exit.assert_called_once()


def test_dev_supervisor_check_and_clear_restart_flag(temp_storage_and_root):
    """scripts/dev.py의 check_and_clear_restart_flag가 플래그를 감지하고 삭제해야 합니다."""
    root_dir = temp_storage_and_root["root_dir"]

    # 플래그가 없을 때
    assert not check_and_clear_restart_flag(root_dir)

    # 플래그 생성 후
    create_restart_flag()
    assert is_restart_pending()

    # dev supervisor가 감지하고 삭제
    detected = check_and_clear_restart_flag(root_dir)
    assert detected is True
    assert not is_restart_pending()


def test_dev_supervisor_start_backend_process():
    """scripts/dev.py의 start_backend_process 헬퍼가 subprocess.Popen을 호출하는지 검증합니다."""
    with patch("subprocess.Popen") as mock_popen:
        mock_proc = MagicMock()
        mock_popen.return_value = mock_proc

        proc = start_backend_process("test_root", {"ENV_KEY": "ENV_VAL"})
        assert proc == mock_proc
        mock_popen.assert_called_once_with(
            ["uv", "run", "python", "-m", "src.backend.main"],
            cwd="test_root",
            env={"ENV_KEY": "ENV_VAL"},
            text=True,
        )


@pytest.mark.asyncio
async def test_telegram_bot_compat_with_web_restart_flag(temp_storage_and_root):
    """웹 API로 생성된 재시작 플래그를 텔레그램 봇 check_restart_flag가 감지하여 알림 전송 및 모든 플래그를 삭제하는지 검증."""
    storage_dir = temp_storage_and_root["storage_dir"]
    root_dir = temp_storage_and_root["root_dir"]
    test_settings = temp_storage_and_root["settings"]

    create_restart_flag()
    assert is_restart_pending()
    assert (storage_dir / RESTART_FLAG_FILENAME).exists()
    assert (root_dir / RESTART_FLAG_FILENAME).exists()

    mock_client = AsyncMock()
    mock_client.send_message = AsyncMock()

    bot = TelegramBot(client=mock_client, config=test_settings.telegram)
    await bot.check_restart_flag()

    # 모든 플래그 파일이 삭제되었는지 확인 (storage_dir 및 root_dir)
    assert not (storage_dir / RESTART_FLAG_FILENAME).exists()
    assert not (root_dir / RESTART_FLAG_FILENAME).exists()
    assert not is_restart_pending()

    # 텔레그램 메시지가 전송되었는지 확인
    mock_client.send_message.assert_awaited_once_with(
        123456, "🔄 AssetManager 서버 재시작이 완료되었습니다."
    )


@pytest.mark.asyncio
async def test_lifespan_cleans_residual_restart_flag_when_telegram_disabled(temp_storage_and_root):
    """텔레그램 미사용 환경에서 서버가 기동(lifespan)될 때 잔여 플래그가 자동 정리되는지 검증."""
    storage_dir = temp_storage_and_root["storage_dir"]
    root_dir = temp_storage_and_root["root_dir"]

    # 잔여 플래그 생성
    create_restart_flag()
    assert is_restart_pending()

    # is_testing=False 환경을 시뮬레이션하여 lifespan 시작 시 정리 확인
    with patch("src.backend.main.is_in_testing_environment", return_value=False), \
         patch("src.backend.main.should_start_telegram", return_value=False), \
         patch("src.backend.migrations.run_migrations"):
        async with lifespan(app):
            # lifespan 블록 내(서버 기동 완료 후)에서 플래그가 자동 정리되어 있어야 함
            assert not is_restart_pending()
            assert not (storage_dir / RESTART_FLAG_FILENAME).exists()
            assert not (root_dir / RESTART_FLAG_FILENAME).exists()
