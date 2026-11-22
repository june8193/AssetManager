# -*- coding: utf-8 -*-
"""KiwoomAuthManager 토큰 발급 타임아웃, 재시도(Retry) 및 예외 로깅 단위 테스트."""

import logging
from unittest.mock import AsyncMock, patch
import httpx
import pytest
from src.kiwoom.auth import KiwoomAuthManager


@pytest.fixture
def isolated_auth_manager(tmp_path, monkeypatch):
    """싱글톤 상태를 격리한 KiwoomAuthManager 테스트 인스턴스를 제공합니다."""
    settings_file = tmp_path / "settings.toml"
    settings_file.write_text(
        'base_url = "https://api.kiwoom.com"\n'
        "[[accounts]]\n"
        'account = "5526-9093"\n'
        'app_key = "test_app_key"\n'
        'secret_key = "test_secret_key"\n',
        encoding="utf-8",
    )
    monkeypatch.setenv("SETTINGS_PATH", str(settings_file))
    KiwoomAuthManager.reset()
    manager = KiwoomAuthManager()
    try:
        yield manager
    finally:
        KiwoomAuthManager.reset()


@pytest.mark.asyncio
async def test_refresh_token_uses_10s_timeout(isolated_auth_manager):
    """1차 시도 성공 시 10.0초 타임아웃으로 요청하고 토큰을 반환하는지 검증합니다."""
    ok_response = httpx.Response(
        status_code=200,
        json={"return_code": 0, "token": "mock_access_token", "expires_in": 3600},
        request=httpx.Request("POST", "https://api.kiwoom.com/oauth2/token"),
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = ok_response

        token = await isolated_auth_manager.get_valid_token("5526-9093")
        assert token == "mock_access_token"
        assert mock_post.call_count == 1
        _, kwargs = mock_post.call_args
        assert kwargs.get("timeout") == 10.0


@pytest.mark.asyncio
async def test_refresh_token_retries_on_timeout_then_succeeds(isolated_auth_manager):
    """1차 시도에서 빈 메시지의 ReadTimeout 발생 후 2차 시도에서 성공하는지 검증합니다."""
    ok_response = httpx.Response(
        status_code=200,
        json={"return_code": 0, "token": "recovered_token", "expires_in": 3600},
        request=httpx.Request("POST", "https://api.kiwoom.com/oauth2/token"),
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
         patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        mock_post.side_effect = [httpx.ReadTimeout(""), ok_response]

        token = await isolated_auth_manager.get_valid_token("5526-9093")
        assert token == "recovered_token"
        assert mock_post.call_count == 2
        mock_sleep.assert_awaited_once_with(1.0)


@pytest.mark.asyncio
async def test_refresh_token_exhausted_logs_exception_type(isolated_auth_manager, caplog):
    """3회 모두 빈 메시지의 ReadTimeout 발생 시 예외가 전파되고 로그에 예외 클래스명이 남는지 검증합니다."""
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
         patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep, \
         caplog.at_level(logging.ERROR, logger="KiwoomAuthManager"):
        mock_post.side_effect = [
            httpx.ReadTimeout(""),
            httpx.ReadTimeout(""),
            httpx.ReadTimeout(""),
        ]

        with pytest.raises(httpx.ReadTimeout):
            await isolated_auth_manager.get_valid_token("5526-9093")

        assert mock_post.call_count == 3
        assert mock_sleep.await_count == 2
        assert mock_sleep.await_args_list[0].args == (1.0,)
        assert mock_sleep.await_args_list[1].args == (2.0,)
        assert "ReadTimeout" in caplog.text


@pytest.mark.asyncio
async def test_refresh_token_no_retry_on_auth_error(isolated_auth_manager):
    """키움 API가 return_code != 0 인증 오류를 반환하면 재시도 없이 즉시 예외를 발생시키는지 검증합니다."""
    auth_error_response = httpx.Response(
        status_code=200,
        json={"return_code": -1, "return_msg": "유효하지 않은 appkey"},
        request=httpx.Request("POST", "https://api.kiwoom.com/oauth2/token"),
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
         patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        mock_post.return_value = auth_error_response

        with pytest.raises(Exception, match="Kiwoom Auth Error: 유효하지 않은 appkey"):
            await isolated_auth_manager.get_valid_token("5526-9093")

        assert mock_post.call_count == 1
        mock_sleep.assert_not_awaited()


@pytest.mark.asyncio
async def test_refresh_token_retries_on_5xx_then_succeeds(isolated_auth_manager):
    """5xx 서버 오류 발생 시 지수 백오프 후 재시도하여 성공하는지 검증합니다."""
    req = httpx.Request("POST", "https://api.kiwoom.com/oauth2/token")
    err_503 = httpx.Response(status_code=503, text="Service Unavailable", request=req)
    ok_response = httpx.Response(
        status_code=200,
        json={"return_code": 0, "token": "recovered_5xx_token", "expires_in": 3600},
        request=req,
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
         patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        mock_post.side_effect = [err_503, ok_response]

        token = await isolated_auth_manager.get_valid_token("5526-9093")
        assert token == "recovered_5xx_token"
        assert mock_post.call_count == 2
        mock_sleep.assert_awaited_once_with(1.0)


@pytest.mark.asyncio
async def test_refresh_token_no_retry_on_4xx_error(isolated_auth_manager):
    """4xx 클라이언트 오류 발생 시 재시도 없이 즉시 HTTPStatusError를 전파하는지 검증합니다."""
    req = httpx.Request("POST", "https://api.kiwoom.com/oauth2/token")
    err_401 = httpx.Response(status_code=401, text="Unauthorized", request=req)

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
         patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        mock_post.return_value = err_401

        with pytest.raises(httpx.HTTPStatusError):
            await isolated_auth_manager.get_valid_token("5526-9093")

        assert mock_post.call_count == 1
        mock_sleep.assert_not_awaited()
