# -*- coding: utf-8 -*-
"""텔레그램 /restart 커맨드 및 재시작 알림 기능에 대한 단위 테스트 모듈입니다."""

import os
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from src.backend.config import TelegramConfig
from src.backend.telegram.bot import TelegramBot
from src.backend.telegram.commands import CLICommandHandler, RESTART_FLAG_FILENAME
from src.backend.telegram.commands.help import HELP_MESSAGE
from src.backend.telegram.commands.restart import handle_restart


@pytest.fixture
def mock_client() -> AsyncMock:
    """모의 TelegramClient를 생성합니다."""
    client = AsyncMock()
    client.send_message = AsyncMock(return_value=123)
    client.set_my_commands = AsyncMock(return_value=True)
    return client


@pytest.fixture
def temp_storage(tmp_path: os.PathLike) -> str:
    """임시 스토리지 디렉터리 경로를 제공합니다."""
    storage_dir = str(tmp_path / "storage")
    os.makedirs(storage_dir, exist_ok=True)
    return storage_dir


@pytest.fixture
def telegram_config(temp_storage: str) -> TelegramConfig:
    """임시 스토리지 경로를 사용하는 TelegramConfig를 생성합니다."""
    return TelegramConfig(
        bot_token="TEST_BOT_TOKEN",
        allowed_user_ids=[111, 222],
        enabled=True,
        storage_dir=temp_storage,
    )


@pytest.mark.asyncio
async def test_handle_restart_creates_flag_and_sends_message(
    mock_client: AsyncMock,
    telegram_config: TelegramConfig,
    temp_storage: str,
) -> None:
    """/restart 호출 시 플래그 파일이 생성되고 재시작 안내 메시지가 전송되어야 합니다."""
    mock_exit = MagicMock()
    flag_path = os.path.join(temp_storage, RESTART_FLAG_FILENAME)

    # 플래그 파일이 없음을 확인
    assert not os.path.exists(flag_path)

    await handle_restart(
        client=mock_client,
        chat_id=111,
        text="/restart",
        config=telegram_config,
        exit_func=mock_exit,
    )

    # 1. 플래그 파일 생성 확인
    assert os.path.exists(flag_path)
    with open(flag_path, "r", encoding="utf-8") as f:
        assert "restart_pending" in f.read()

    # 2. 안내 메시지 전송 확인
    mock_client.send_message.assert_awaited_once_with(
        111, "🔄 서버를 재시작합니다. 약 5~8초 정도 소요됩니다..."
    )

    # 3. 종료 함수 호출 확인
    mock_exit.assert_called_once()


@pytest.mark.asyncio
async def test_handle_restart_default_exit_func_calls_sys_exit(
    mock_client: AsyncMock,
    telegram_config: TelegramConfig,
) -> None:
    """exit_func 미지정 시 기본적으로 sys.exit(0)을 호출해야 합니다 (sys.exit 모킹 검증)."""
    with patch("sys.exit") as mock_sys_exit:
        await handle_restart(
            client=mock_client,
            chat_id=111,
            text="/restart",
            config=telegram_config,
        )
        mock_sys_exit.assert_called_once_with(0)


@pytest.mark.asyncio
async def test_cli_command_handler_routes_restart(
    mock_client: AsyncMock,
    telegram_config: TelegramConfig,
    temp_storage: str,
) -> None:
    """CLICommandHandler를 통해 /restart 입력 시 플래그가 생성되고 종료 루틴이 호출되어야 합니다."""
    mock_exit = MagicMock()
    handler = CLICommandHandler(client=mock_client, config=telegram_config)

    with patch(
        "src.backend.telegram.commands.restart.default_exit_system",
        mock_exit,
    ):
        await handler.process_cli_command(111, "/restart")

    flag_path = os.path.join(temp_storage, RESTART_FLAG_FILENAME)
    assert os.path.exists(flag_path)
    mock_client.send_message.assert_awaited_once()
    mock_exit.assert_called_once()


@pytest.mark.asyncio
async def test_check_restart_flag_when_flag_exists(
    mock_client: AsyncMock,
    telegram_config: TelegramConfig,
    temp_storage: str,
) -> None:
    """재시작 플래그 파일이 존재할 경우 모든 허가 사용자에게 알림을 보내고 플래그 파일을 삭제해야 합니다."""
    flag_path = os.path.join(temp_storage, RESTART_FLAG_FILENAME)
    with open(flag_path, "w", encoding="utf-8") as f:
        f.write("restart_pending")

    bot = TelegramBot(config=telegram_config, client=mock_client)
    await bot.check_restart_flag()

    # 1. 플래그 파일 삭제 확인
    assert not os.path.exists(flag_path)

    # 2. 허가된 모든 사용자에게 알림 발송 확인
    assert mock_client.send_message.await_count == 2
    mock_client.send_message.assert_any_await(111, "🔄 AssetManager 서버 재시작이 완료되었습니다.")
    mock_client.send_message.assert_any_await(222, "🔄 AssetManager 서버 재시작이 완료되었습니다.")


@pytest.mark.asyncio
async def test_check_restart_flag_when_flag_absent(
    mock_client: AsyncMock,
    telegram_config: TelegramConfig,
    temp_storage: str,
) -> None:
    """재시작 플래그 파일이 존재하지 않을 경우 어떠한 메시지도 전송하지 않아야 합니다."""
    flag_path = os.path.join(temp_storage, RESTART_FLAG_FILENAME)
    assert not os.path.exists(flag_path)

    bot = TelegramBot(config=telegram_config, client=mock_client)
    await bot.check_restart_flag()

    assert mock_client.send_message.await_count == 0


def test_help_message_contains_restart() -> None:
    """HELP_MESSAGE에 /restart 안내가 포함되어 있어야 합니다."""
    assert "/restart" in HELP_MESSAGE
    assert "PM2" in HELP_MESSAGE


@pytest.mark.asyncio
async def test_register_bot_commands_includes_restart(
    mock_client: AsyncMock,
    telegram_config: TelegramConfig,
) -> None:
    """register_bot_commands 호출 시 텔레그램 커맨드 목록에 restart가 등록되어야 합니다."""
    bot = TelegramBot(config=telegram_config, client=mock_client)
    await bot.register_bot_commands()

    mock_client.set_my_commands.assert_awaited_once()
    commands = mock_client.set_my_commands.call_args[0][0]
    restart_cmds = [cmd for cmd in commands if cmd.get("command") == "restart"]
    assert len(restart_cmds) == 1
    assert "재시작" in restart_cmds[0]["description"]


@pytest.mark.asyncio
async def test_start_polling_invokes_check_restart_flag(
    mock_client: AsyncMock,
    telegram_config: TelegramConfig,
) -> None:
    """start_polling 시작 시 check_restart_flag가 반드시 호출되어야 합니다."""
    import asyncio

    bot = TelegramBot(config=telegram_config, client=mock_client)
    stop_event = asyncio.Event()
    stop_event.set()

    with patch.object(bot, "check_restart_flag", new_callable=AsyncMock) as mock_check:
        with patch.object(bot, "register_bot_commands", new_callable=AsyncMock):
            await bot.start_polling(stop_event=stop_event)
            mock_check.assert_awaited_once()
