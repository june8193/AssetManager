# -*- coding: utf-8 -*-
"""키움 API 휴장일 조회 시 타임아웃 완화, 재시도(Retry) 및 상세 에러 리포팅 단위 테스트."""

import datetime
from unittest.mock import AsyncMock, patch
import httpx
import pytest
from src.backend.market.calendar import MarketCalendar


@pytest.mark.asyncio
async def test_query_kiwoom_holiday_api_success_first_try(monkeypatch):
    """1차 시도에서 정상 응답 시 즉시 결과를 반환하는지 검증합니다."""
    monkeypatch.setattr(
        "src.kiwoom.auth.KiwoomAuthManager.get_valid_token",
        AsyncMock(return_value="mock_token")
    )

    mock_response = httpx.Response(
        status_code=200,
        json={
            "return_code": 0,
            "return_msg": "정상",
            "stk_dt_pole_chart_qry": [{"dt": "20260827", "open_prc": "30000"}]
        },
        request=httpx.Request("POST", "https://api.kiwoom.com/api/dostk/chart")
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response

        # 2026-08-27 (영업일 -> latest_date == 20260827 -> is_holiday is False)
        result = await MarketCalendar.query_kiwoom_holiday_api(datetime.date(2026, 8, 27), country="KR")
        assert result is False
        assert mock_post.call_count == 1
        # 타임아웃이 10.0초로 설정되어 호출되었는지 검증
        _, kwargs = mock_post.call_args
        assert kwargs.get("timeout") == 10.0


@pytest.mark.asyncio
async def test_query_kiwoom_holiday_api_retry_on_timeout_success(monkeypatch):
    """1차 시도에서 타임아웃 발생 후 2차 시도에서 성공하는 경우 정상 처리되는지 검증합니다."""
    monkeypatch.setattr(
        "src.kiwoom.auth.KiwoomAuthManager.get_valid_token",
        AsyncMock(return_value="mock_token")
    )

    success_response = httpx.Response(
        status_code=200,
        json={
            "return_code": 0,
            "return_msg": "정상",
            "stk_dt_pole_chart_qry": [{"dt": "20260827", "open_prc": "30000"}]
        },
        request=httpx.Request("POST", "https://api.kiwoom.com/api/dostk/chart")
    )

    # 1회차: TimeoutException, 2회차: 정상 응답
    timeout_err = httpx.ReadTimeout("Request timed out (10.0s)")
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
         patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        mock_post.side_effect = [timeout_err, success_response]

        result = await MarketCalendar.query_kiwoom_holiday_api(datetime.date(2026, 8, 27), country="KR")
        assert result is False
        assert mock_post.call_count == 2
        mock_sleep.assert_called_once_with(1.0)  # 첫 재시도 전 1초 백오프


@pytest.mark.asyncio
async def test_query_kiwoom_holiday_api_retry_exhausted_raises_with_detail(monkeypatch):
    """최대 2회 재시도(총 3회 시도) 후에도 모두 실패할 경우, 상세 원인을 포함한 RuntimeError가 발생하는지 검증합니다."""
    monkeypatch.setattr(
        "src.kiwoom.auth.KiwoomAuthManager.get_valid_token",
        AsyncMock(return_value="mock_token")
    )

    timeout_err = httpx.ReadTimeout("Request timed out")
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
         patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        mock_post.side_effect = [timeout_err, timeout_err, timeout_err]

        with pytest.raises(RuntimeError) as exc_info:
            await MarketCalendar.query_kiwoom_holiday_api(datetime.date(2026, 8, 27), country="KR")

        assert "키움 API를 통한 휴장일 판단에 실패했습니다" in str(exc_info.value)
        assert "ReadTimeout" in str(exc_info.value) or "타임아웃" in str(exc_info.value) or "timeout" in str(exc_info.value).lower()
        assert mock_post.call_count == 3
        assert mock_sleep.call_count == 2


@pytest.mark.asyncio
async def test_query_kiwoom_holiday_api_return_code_error_detail(monkeypatch):
    """키움 API에서 return_code 에러 반환 시 상세 메시지가 예외에 포함되는지 검증합니다."""
    monkeypatch.setattr(
        "src.kiwoom.auth.KiwoomAuthManager.get_valid_token",
        AsyncMock(return_value="mock_token")
    )

    error_response = httpx.Response(
        status_code=200,
        json={
            "return_code": "E10001",
            "return_msg": "서비스 점검 중입니다."
        },
        request=httpx.Request("POST", "https://api.kiwoom.com/api/dostk/chart")
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
         patch("asyncio.sleep", new_callable=AsyncMock):
        mock_post.return_value = error_response

        with pytest.raises(RuntimeError) as exc_info:
            await MarketCalendar.query_kiwoom_holiday_api(datetime.date(2026, 8, 27), country="KR")

        assert "서비스 점검 중입니다" in str(exc_info.value) or "E10001" in str(exc_info.value)
        assert mock_post.call_count == 3


@pytest.mark.asyncio
async def test_get_market_holiday_info_with_api_us_success(monkeypatch):
    """미국(US) 시장에 대해 query_kiwoom_holiday_api 및 get_market_holiday_info_with_api 정상 동작 검증."""
    monkeypatch.setattr(
        "src.kiwoom.auth.KiwoomAuthManager.get_valid_token",
        AsyncMock(return_value="mock_token")
    )

    mock_response = httpx.Response(
        status_code=200,
        json={
            "return_code": 0,
            "return_msg": "정상",
            "result_list": [{"dt": "20260827", "close_prc": "550"}]
        },
        request=httpx.Request("POST", "https://api.kiwoom.com/api/us/chart")
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response

        holiday_reason = await MarketCalendar.get_market_holiday_info_with_api(
            datetime.date(2026, 8, 27), country="US", use_api=True
        )
        assert holiday_reason is None
        assert mock_post.call_count == 1
        _, kwargs = mock_post.call_args
        assert kwargs.get("timeout") == 10.0


@pytest.mark.asyncio
async def test_query_kiwoom_holiday_api_invalid_country(monkeypatch):
    """지원하지 않는 국가 코드 전달 시 ValueError가 발생하는지 검증합니다."""
    monkeypatch.setattr(
        "src.kiwoom.auth.KiwoomAuthManager.get_valid_token",
        AsyncMock(return_value="mock_token")
    )

    with pytest.raises(ValueError, match="지원하지 않는 국가 코드"):
        await MarketCalendar.query_kiwoom_holiday_api(datetime.date(2026, 8, 27), country="JP")


@pytest.mark.asyncio
async def test_query_kiwoom_holiday_api_token_failure(monkeypatch):
    """토큰 발급 실패 시 RuntimeError가 발생하는지 검증합니다."""
    monkeypatch.setattr(
        "src.kiwoom.auth.KiwoomAuthManager.get_valid_token",
        AsyncMock(side_effect=Exception("인증 서버 응답 없음"))
    )

    with pytest.raises(RuntimeError, match="키움 토큰 발급에 실패했습니다"):
        await MarketCalendar.query_kiwoom_holiday_api(datetime.date(2026, 8, 27), country="KR")
