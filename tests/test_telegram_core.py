# -*- coding: utf-8 -*-
"""텔레그램 코어 모듈(설정, 클라이언트, 보안 가드 및 /help 디스패치) 단위 테스트입니다."""

import os
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import httpx

from src.backend.config import TelegramConfig, NaverConfig, Settings, get_settings
from src.backend.telegram.client import TelegramClient
from src.backend.telegram.bot import TelegramBot
from src.backend.telegram.commands.help import handle_help


# ============================================================================
# 1. 설정 로드 및 환경변수 오버라이드 테스트
# ============================================================================

def test_telegram_config_defaults():
    """TelegramConfig 및 NaverConfig 기본값이 올바르게 설정되는지 검증합니다."""
    tg_cfg = TelegramConfig()
    assert tg_cfg.bot_token == ""
    assert tg_cfg.allowed_user_ids == []
    assert tg_cfg.enabled is False
    assert tg_cfg.storage_dir == "./storage"
    assert tg_cfg.is_user_allowed(12345) is False

    naver_cfg = NaverConfig()
    assert naver_cfg.client_id == ""
    assert naver_cfg.client_secret == ""


def test_telegram_config_from_toml(tmp_path):
    """toml 파일로부터 [telegram] 및 [naver] 섹션을 올바르게 로드하는지 검증합니다."""
    toml_file = tmp_path / "settings.toml"
    toml_file.write_text(
        """
[telegram]
bot_token = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
allowed_user_ids = [10001, 10002]
enabled = true
storage_dir = "./custom_storage"

[naver]
client_id = "naver_client_id_test"
client_secret = "naver_secret_test"
""",
        encoding="utf-8",
    )

    with patch.dict(os.environ, {}, clear=True):
        settings = Settings.load_from_toml(str(toml_file))
        assert settings.telegram.bot_token == "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
        assert settings.telegram.allowed_user_ids == [10001, 10002]
        assert settings.telegram.enabled is True
        assert settings.telegram.storage_dir == "./custom_storage"
        assert settings.telegram.is_user_allowed(10001) is True
        assert settings.telegram.is_user_allowed(99999) is False

        assert settings.naver.client_id == "naver_client_id_test"
        assert settings.naver.client_secret == "naver_secret_test"


def test_telegram_config_env_override(tmp_path):
    """환경 변수가 toml 설정값을 올바르게 오버라이드하는지 검증합니다."""
    toml_file = tmp_path / "settings.toml"
    toml_file.write_text(
        """
[telegram]
bot_token = "old_token"
allowed_user_ids = [10001]
enabled = false
storage_dir = "./storage"

[naver]
client_id = "old_id"
client_secret = "old_secret"
""",
        encoding="utf-8",
    )

    env_vars = {
        "TELEGRAM_BOT_TOKEN": "env_new_token",
        "TELEGRAM_ALLOWED_USER_IDS": "20001, 20002, 20003",
        "TELEGRAM_ENABLED": "true",
        "STORAGE_DIR": "./env_storage",
        "NAVER_CLIENT_ID": "env_naver_id",
        "NAVER_CLIENT_SECRET": "env_naver_secret",
    }

    with patch.dict(os.environ, env_vars, clear=True):
        settings = Settings.load_from_toml(str(toml_file))
        assert settings.telegram.bot_token == "env_new_token"
        assert settings.telegram.allowed_user_ids == [20001, 20002, 20003]
        assert settings.telegram.enabled is True
        assert settings.telegram.storage_dir == "./env_storage"
        assert settings.telegram.is_user_allowed(20002) is True
        assert settings.telegram.is_user_allowed(10001) is False

        assert settings.naver.client_id == "env_naver_id"
        assert settings.naver.client_secret == "env_naver_secret"


# ============================================================================
# 2. 텔레그램 비동기 클라이언트 (TelegramClient) 테스트
# ============================================================================

@pytest.mark.asyncio
async def test_client_send_message_success():
    """TelegramClient.send_message 정상 호출 시 메시지 ID를 반환하는지 검증합니다."""
    client = TelegramClient(bot_token="test_token")

    mock_resp = httpx.Response(
        status_code=200,
        json={"ok": True, "result": {"message_id": 777}},
        request=httpx.Request("POST", "https://api.telegram.org/bottest_token/sendMessage"),
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        msg_id = await client.send_message(chat_id=12345, text="안녕하세요")

        assert msg_id == 777
        assert mock_post.await_count == 1
        args, kwargs = mock_post.await_args
        assert kwargs["json"]["chat_id"] == 12345
        assert kwargs["json"]["parse_mode"] == "HTML"


@pytest.mark.asyncio
async def test_client_send_message_fallback_on_parse_error():
    """HTML 파싱 오류 발생 시 평문 텍스트로 fallback 재전송을 수행하는지 검증합니다."""
    client = TelegramClient(bot_token="test_token")

    fail_resp = httpx.Response(
        status_code=400,
        json={"ok": False, "description": "Bad Request: can't parse entities"},
        request=httpx.Request("POST", "https://api.telegram.org/bottest_token/sendMessage"),
    )
    ok_resp = httpx.Response(
        status_code=200,
        json={"ok": True, "result": {"message_id": 888}},
        request=httpx.Request("POST", "https://api.telegram.org/bottest_token/sendMessage"),
    )

    # 1차 호출은 HTTPStatusError 발생, 2차 호출은 성공
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.side_effect = [
            httpx.HTTPStatusError("Bad Request", request=fail_resp.request, response=fail_resp),
            ok_resp,
        ]

        msg_id = await client.send_message(chat_id=12345, text="**잘못된 <b>태그**")

        assert msg_id == 888
        assert mock_post.await_count == 2
        # 두 번째 호출은 parse_mode=None (평문)이어야 함
        second_kwargs = mock_post.await_args_list[1][1]
        assert second_kwargs["json"]["parse_mode"] is None
        assert "⚠️ 메시지 전송 중 오류가 발생했습니다." in second_kwargs["json"]["text"]


@pytest.mark.asyncio
async def test_client_get_updates():
    """TelegramClient.get_updates 호출 시 전달된 파라미터 및 응답 결과를 검증합니다."""
    client = TelegramClient(bot_token="test_token")

    mock_resp = httpx.Response(
        status_code=200,
        json={
            "ok": True,
            "result": [
                {
                    "update_id": 1001,
                    "message": {
                        "message_id": 1,
                        "from": {"id": 12345, "first_name": "Test"},
                        "chat": {"id": 12345},
                        "text": "/help",
                    },
                }
            ],
        },
        request=httpx.Request("GET", "https://api.telegram.org/bottest_token/getUpdates"),
    )

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        updates = await client.get_updates(offset=1000, timeout=20)

        assert len(updates) == 1
        assert updates[0]["update_id"] == 1001
        _, kwargs = mock_get.await_args
        assert kwargs["params"]["offset"] == 1000
        assert kwargs["params"]["timeout"] == 20


@pytest.mark.asyncio
async def test_client_set_my_commands():
    """TelegramClient.set_my_commands 호출 시 올바른 페이로드를 전달하는지 검증합니다."""
    client = TelegramClient(bot_token="test_token")

    mock_resp = httpx.Response(
        status_code=200,
        json={"ok": True, "result": True},
        request=httpx.Request("POST", "https://api.telegram.org/bottest_token/setMyCommands"),
    )

    commands = [
        {"command": "help", "description": "도움말 확인"},
        {"command": "asset", "description": "자산 현황 조회"},
    ]

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        success = await client.set_my_commands(commands)

        assert success is True
        _, kwargs = mock_post.await_args
        assert kwargs["json"]["commands"] == commands


# ============================================================================
# 3. 텔레그램 봇 보안 가드 및 /help 디스패치 테스트
# ============================================================================

@pytest.mark.asyncio
async def test_bot_unauthorized_user_blocked():
    """허용 목록에 없는 사용자가 메시지를 보낼 경우 차단 경고를 전송하고 명령어를 실행하지 않는지 검증합니다."""
    tg_config = TelegramConfig(
        bot_token="test_token",
        allowed_user_ids=[12345],
        enabled=True,
    )
    mock_client = MagicMock(spec=TelegramClient)
    mock_client.send_message = AsyncMock(return_value=1)
    mock_client.get_updates = AsyncMock(
        return_value=[
            {
                "update_id": 100,
                "message": {
                    "message_id": 50,
                    "from": {"id": 99999, "first_name": "Hacker"},
                    "chat": {"id": 99999},
                    "text": "/help",
                },
            }
        ]
    )

    bot = TelegramBot(config=tg_config, client=mock_client)
    next_offset = await bot.poll_once(offset=None)

    assert next_offset == 101
    mock_client.send_message.assert_awaited_once_with(
        99999,
        "⚠️ 접근 권한이 없습니다. 관리자에게 문의하세요. (User ID: 99999)",
    )


@pytest.mark.asyncio
async def test_bot_authorized_user_help_command():
    """인가된 사용자가 /help 입력 시 전체 명령어 안내 메시지를 응답하는지 검증합니다."""
    tg_config = TelegramConfig(
        bot_token="test_token",
        allowed_user_ids=[12345],
        enabled=True,
    )
    mock_client = MagicMock(spec=TelegramClient)
    mock_client.send_message = AsyncMock(return_value=2)
    mock_client.get_updates = AsyncMock(
        return_value=[
            {
                "update_id": 200,
                "message": {
                    "message_id": 51,
                    "from": {"id": 12345, "first_name": "Owner"},
                    "chat": {"id": 12345},
                    "text": "/help",
                },
            }
        ]
    )

    bot = TelegramBot(config=tg_config, client=mock_client)
    next_offset = await bot.poll_once(offset=200)

    assert next_offset == 201
    mock_client.send_message.assert_awaited_once()
    sent_chat_id, sent_text = mock_client.send_message.await_args[0]
    assert sent_chat_id == 12345
    assert "명령어 안내" in sent_text
    assert "/help" in sent_text
    assert "/asset" in sent_text
    assert "/ratio" in sent_text
    assert "/tx" in sent_text
    assert "/yearly" in sent_text
    assert "/daily" in sent_text
    assert "/sync" in sent_text


@pytest.mark.asyncio
async def test_bot_authorized_user_plain_text():
    """인가된 사용자가 일반 텍스트 전송 시 자연어 미지원 안내 메시지를 반환하는지 검증합니다."""
    tg_config = TelegramConfig(
        bot_token="test_token",
        allowed_user_ids=[12345],
        enabled=True,
    )
    mock_client = MagicMock(spec=TelegramClient)
    mock_client.send_message = AsyncMock(return_value=3)
    mock_client.get_updates = AsyncMock(
        return_value=[
            {
                "update_id": 300,
                "message": {
                    "message_id": 52,
                    "from": {"id": 12345, "first_name": "Owner"},
                    "chat": {"id": 12345},
                    "text": "오늘 날씨 어때?",
                },
            }
        ]
    )

    bot = TelegramBot(config=tg_config, client=mock_client)
    next_offset = await bot.poll_once(offset=300)

    assert next_offset == 301
    mock_client.send_message.assert_awaited_once()
    sent_chat_id, sent_text = mock_client.send_message.await_args[0]
    assert sent_chat_id == 12345
    assert "자연어 대화 기능은 지원하지 않습니다" in sent_text
    assert "/help" in sent_text


@pytest.mark.asyncio
async def test_bot_authorized_user_unknown_command():
    """인가된 사용자가 알 수 없는 슬래시 명령어를 전송할 경우 안내 메시지를 반환하는지 검증합니다."""
    tg_config = TelegramConfig(
        bot_token="test_token",
        allowed_user_ids=[12345],
        enabled=True,
    )
    mock_client = MagicMock(spec=TelegramClient)
    mock_client.send_message = AsyncMock(return_value=4)
    mock_client.get_updates = AsyncMock(
        return_value=[
            {
                "update_id": 400,
                "message": {
                    "message_id": 53,
                    "from": {"id": 12345, "first_name": "Owner"},
                    "chat": {"id": 12345},
                    "text": "/unknown_foo",
                },
            }
        ]
    )

    bot = TelegramBot(config=tg_config, client=mock_client)
    next_offset = await bot.poll_once(offset=400)

    assert next_offset == 401
    mock_client.send_message.assert_awaited_once()
    sent_chat_id, sent_text = mock_client.send_message.await_args[0]
    assert sent_chat_id == 12345
    assert "알 수 없는 명령어입니다" in sent_text
    assert "/unknown_foo" in sent_text


def test_telegram_config_user_allowed_type_flexibility():
    """is_user_allowed가 int 및 str 타입의 user_id를 유연하고 안전하게 처리하는지 검증합니다."""
    tg_config = TelegramConfig(
        bot_token="test_token",
        allowed_user_ids=[12345, "67890"],
    )
    # 정규화 검증
    assert 67890 in tg_config.allowed_user_ids

    # int 및 str 입력 모두 허용 검증
    assert tg_config.is_user_allowed(12345) is True
    assert tg_config.is_user_allowed("12345") is True
    assert tg_config.is_user_allowed(67890) is True
    assert tg_config.is_user_allowed("67890") is True

    # 잘못된 타입이나 미등록 ID 검증
    assert tg_config.is_user_allowed("not_a_number") is False
    assert tg_config.is_user_allowed(None) is False
    assert tg_config.is_user_allowed(99999) is False


@pytest.mark.asyncio
async def test_bot_authorized_user_non_text_message():
    """인가된 사용자가 사진, 스티커 등 텍스트가 없는 메시지를 보냈을 때 안내 메시지를 응답하는지 검증합니다."""
    tg_config = TelegramConfig(
        bot_token="test_token",
        allowed_user_ids=[12345],
        enabled=True,
    )
    mock_client = MagicMock(spec=TelegramClient)
    mock_client.send_message = AsyncMock(return_value=5)
    mock_client.get_updates = AsyncMock(
        return_value=[
            {
                "update_id": 500,
                "message": {
                    "message_id": 54,
                    "from": {"id": 12345, "first_name": "Owner"},
                    "chat": {"id": 12345},
                    # text 필드가 없음 (예: 사진 업로드)
                    "photo": [{"file_id": "photo_123"}],
                },
            }
        ]
    )

    bot = TelegramBot(config=tg_config, client=mock_client)
    next_offset = await bot.poll_once(offset=500)

    assert next_offset == 501
    mock_client.send_message.assert_awaited_once()
    sent_chat_id, sent_text = mock_client.send_message.await_args[0]
    assert sent_chat_id == 12345
    assert "명령어 텍스트만 처리할 수 있습니다" in sent_text


@pytest.mark.asyncio
async def test_client_context_manager_and_aclose():
    """TelegramClient의 비동기 컨텍스트 매니저와 aclose 수명주기 동작을 검증합니다."""
    client = TelegramClient(bot_token="test_token")
    mock_http = MagicMock(spec=httpx.AsyncClient)
    mock_http.is_closed = False
    mock_http.aclose = AsyncMock()
    client._http_client = mock_http

    await client.aclose()
    mock_http.aclose.assert_awaited_once()
    assert client._http_client is None

