# -*- coding: utf-8 -*-
"""텔레그램 자산 및 비중 조회(/asset, /ratio) E2E 슬라이스 단위 테스트입니다.

asset_client REST API 통신, MessageRenderer 마크다운 서식화,
CLI 명령어 핸들러의 Typing 액션 및 에러 처리를 검증합니다.
"""

import httpx
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.backend.telegram.asset_client.client import AssetApiClient
from src.backend.telegram.asset_client.models import (
    AssetClientError,
    AssetRatioItem,
    AssetRatiosResponse,
    AssetSummaryResponse,
)
from src.backend.telegram.asset_client.asset_api import (
    get_asset_ratios,
    get_asset_summary,
)
from src.backend.telegram.renderer import (
    MessageRenderer,
    render_asset_ratios,
    render_asset_summary,
)
from src.backend.telegram.commands.asset import handle_asset
from src.backend.telegram.commands.ratio import handle_ratio
from src.backend.telegram.commands import CLICommandHandler
from src.backend.telegram.client import TelegramClient
from src.backend.telegram.bot import TelegramBot
from src.backend.config import TelegramConfig


# ============================================================================
# 1. asset_client 단위 테스트
# ============================================================================

@pytest.mark.asyncio
async def test_asset_client_get_asset_summary_success():
    """get_asset_summary가 백엔드 API 응답을 올바른 Pydantic 모델로 변환하는지 검증합니다."""
    mock_payload = {
        "total_valuation_krw": 150000000.0,
        "total_contribution": 30000000.0,
        "initial_base_asset": 70000000.0,
        "total_profit": 50000000.0,
        "cumulative_roi": 50.0,
        "contribution_ratio": 66.7,
        "profit_ratio": 33.3,
        "exchange_rate": {"rate": 1350.5, "date": "2026-09-11"},
        "latest_price_date": "2026-09-11",
    }

    mock_resp = httpx.Response(
        status_code=200,
        json=mock_payload,
        request=httpx.Request("GET", "http://localhost:8000/api/dashboard/summary"),
    )

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        summary = await get_asset_summary()

        assert isinstance(summary, AssetSummaryResponse)
        assert summary.total_valuation_krw == 150000000.0
        assert summary.total_principal == 100000000.0  # 70000000 + 30000000
        assert summary.total_profit == 50000000.0
        assert summary.cumulative_roi == 50.0
        assert summary.exchange_rate["rate"] == 1350.5
        assert summary.latest_price_date == "2026-09-11"


@pytest.mark.asyncio
async def test_asset_client_get_asset_ratios_success():
    """get_asset_ratios가 백엔드 API 응답을 올바른 Pydantic 모델로 변환하는지 검증합니다."""
    mock_payload = {
        "total_valuation": 100000000.0,
        "total_target": 100000000.0,
        "additional_cash": 0.0,
        "major_results": [
            {
                "category": "주식",
                "current_amt": 60000000.0,
                "current_ratio": 60.0,
                "target_percentage": 50.0,
                "target_amt": 50000000.0,
                "diff_amt": 10000000.0,
            },
            {
                "category": "채권",
                "current_amt": 40000000.0,
                "current_ratio": 40.0,
                "target_percentage": 50.0,
                "target_amt": 50000000.0,
                "diff_amt": -10000000.0,
            },
        ],
        "sub_results": [
            {
                "category": "국내주식",
                "parent_category": "주식",
                "current_amt": 30000000.0,
                "current_ratio": 30.0,
                "target_percentage": 25.0,
                "target_amt": 25000000.0,
                "diff_amt": 5000000.0,
            }
        ],
    }

    mock_resp = httpx.Response(
        status_code=200,
        json=mock_payload,
        request=httpx.Request("GET", "http://localhost:8000/api/ratios/rebalancing"),
    )

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        ratios = await get_asset_ratios()

        assert isinstance(ratios, AssetRatiosResponse)
        assert ratios.total_valuation == 100000000.0
        assert len(ratios.major_results) == 2
        assert ratios.major_results[0].category == "주식"
        assert ratios.major_results[0].diff_amt == 10000000.0
        assert len(ratios.sub_results) == 1
        assert ratios.sub_results[0].parent_category == "주식"


@pytest.mark.asyncio
async def test_asset_client_http_error_handling():
    """백엔드 API 서버 오류(HTTP 500) 시 AssetClientError가 발생하는지 검증합니다."""
    mock_resp = httpx.Response(
        status_code=500,
        text="Internal Server Error",
        request=httpx.Request("GET", "http://localhost:8000/api/dashboard/summary"),
    )

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = httpx.HTTPStatusError(
            "Internal Server Error", request=mock_resp.request, response=mock_resp
        )
        with pytest.raises(AssetClientError) as exc_info:
            await get_asset_summary()

        assert "AssetManager API 호출 실패 (HTTP 오류 코드: 500)" in str(exc_info.value)


@pytest.mark.asyncio
async def test_asset_client_network_error_handling():
    """백엔드 API 서버 연결 실패 시 AssetClientError가 발생하는지 검증합니다."""
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = httpx.ConnectError("Connection refused")
        with pytest.raises(AssetClientError) as exc_info:
            await get_asset_summary()

        assert "연결 네트워크 오류" in str(exc_info.value)


# ============================================================================
# 2. MessageRenderer 마크다운 포맷팅 검증 테스트
# ============================================================================

def test_render_asset_summary_formatting():
    """render_asset_summary가 모바일 최적화된 불릿과 이모지 포맷으로 렌더링하는지 검증합니다."""
    summary = AssetSummaryResponse(
        total_valuation_krw=123456789.0,
        total_principal=100000000.0,
        total_profit=23456789.0,
        cumulative_roi=23.5,
        contribution_ratio=81.0,
        profit_ratio=19.0,
        exchange_rate={"rate": 1320.0, "date": "2026-09-10"},
        latest_price_date="2026-09-10",
    )

    rendered = render_asset_summary(summary)

    # 불릿과 이모지 포함 여부 검증
    assert "💰 **통합 자산 현황**" in rendered
    assert "• 총 평가자산: 123,456,789원" in rendered
    assert "• 총 투자원금: 100,000,000원" in rendered
    assert "• 누적 투자수익: +23,456,789원 (23.5%)" in rendered
    assert "📅 **기준 정보**" in rendered
    assert "• 환율 기준일: 2026-09-10 (적용 환율: 1,320.0원)" in rendered
    assert "• 주가 기준일: 2026-09-10" in rendered


def test_render_asset_summary_negative_profit():
    """손실 상태일 때 마이너스 부호가 정상 표기되는지 검증합니다."""
    summary = AssetSummaryResponse(
        total_valuation_krw=80000000.0,
        total_principal=100000000.0,
        total_profit=-20000000.0,
        cumulative_roi=-20.0,
        contribution_ratio=100.0,
        profit_ratio=0.0,
        exchange_rate={},
        latest_price_date="최근 데이터 없음",
    )

    rendered = render_asset_summary(summary)
    assert "• 누적 투자수익: -20,000,000원 (-20.0%)" in rendered


def test_render_asset_ratios_formatting():
    """render_asset_ratios가 대분류/소분류 불릿 및 리밸런싱 부호를 정확히 렌더링하는지 검증합니다."""
    ratios = AssetRatiosResponse(
        total_valuation=100000000.0,
        total_target=100000000.0,
        additional_cash=0.0,
        major_results=[
            AssetRatioItem(
                category="주식",
                parent_category=None,
                current_amt=60000000.0,
                current_ratio=60.0,
                target_percentage=50.0,
                target_amt=50000000.0,
                diff_amt=10000000.0,
            ),
            AssetRatioItem(
                category="채권",
                parent_category=None,
                current_amt=40000000.0,
                current_ratio=40.0,
                target_percentage=50.0,
                target_amt=50000000.0,
                diff_amt=-10000000.0,
            ),
        ],
        sub_results=[
            AssetRatioItem(
                category="미국주식",
                parent_category="주식",
                current_amt=40000000.0,
                current_ratio=40.0,
                target_percentage=35.0,
                target_amt=35000000.0,
                diff_amt=5000000.0,
            )
        ],
    )

    rendered = render_asset_ratios(ratios)

    assert "📊 **자산 대분류 비중 및 리밸런싱**" in rendered
    assert "• 주식: 60.0% (60,000,000원) [목표: 50.0% | 차액: +10,000,000원]" in rendered
    assert "• 채권: 40.0% (40,000,000원) [목표: 50.0% | 차액: -10,000,000원]" in rendered
    assert "🔍 **자산 소분류 비중 및 리밸런싱**" in rendered
    assert "[주식]" in rendered
    assert "  - 미국주식: 40.0% (40,000,000원) [목표: 35.0% | 차액: +5,000,000원]" in rendered


# ============================================================================
# 3. CLI 커맨드 핸들러 (/asset, /ratio) 및 에러 응답 테스트
# ============================================================================

@pytest.mark.asyncio
async def test_handle_asset_command_success():
    """/asset 명령어 수신 시 Typing 액션 후 자산 요약 마크다운을 전송하는지 검증합니다."""
    mock_client = MagicMock(spec=TelegramClient)
    mock_client.send_chat_action = AsyncMock(return_value=True)
    mock_client.send_message = AsyncMock(return_value=123)

    summary_model = AssetSummaryResponse(
        total_valuation_krw=100000000.0,
        total_principal=80000000.0,
        total_profit=20000000.0,
        cumulative_roi=25.0,
        contribution_ratio=80.0,
        profit_ratio=20.0,
        exchange_rate={"rate": 1300.0, "date": "2026-09-12"},
        latest_price_date="2026-09-12",
    )

    with patch("src.backend.telegram.commands.asset.get_asset_summary", new_callable=AsyncMock) as mock_get_summary:
        mock_get_summary.return_value = summary_model
        await handle_asset(mock_client, chat_id=12345, text="/asset")

        mock_client.send_chat_action.assert_awaited_once_with(12345, "typing")
        mock_client.send_message.assert_awaited_once()
        chat_id, sent_msg = mock_client.send_message.await_args[0]
        assert chat_id == 12345
        assert "💰 **통합 자산 현황**" in sent_msg
        assert "100,000,000원" in sent_msg


@pytest.mark.asyncio
async def test_handle_asset_command_error_friendly_message():
    """/asset 명령어 처리 중 API 에러 발생 시 사용자 친화적인 에러 메시지를 응답하는지 검증합니다."""
    mock_client = MagicMock(spec=TelegramClient)
    mock_client.send_chat_action = AsyncMock(return_value=True)
    mock_client.send_message = AsyncMock(return_value=124)

    with patch("src.backend.telegram.commands.asset.get_asset_summary", new_callable=AsyncMock) as mock_get_summary:
        mock_get_summary.side_effect = AssetClientError("서버 응답 오류 (500)")
        await handle_asset(mock_client, chat_id=12345, text="/asset")

        mock_client.send_chat_action.assert_awaited_once_with(12345, "typing")
        mock_client.send_message.assert_awaited_once()
        chat_id, sent_msg = mock_client.send_message.await_args[0]
        assert chat_id == 12345
        assert "⚠️ 자산 정보를 가져오는데 실패했습니다: 서버 응답 오류 (500)" in sent_msg


@pytest.mark.asyncio
async def test_handle_ratio_command_success():
    """/ratio 명령어 수신 시 Typing 액션 후 비중/리밸런싱 마크다운을 전송하는지 검증합니다."""
    mock_client = MagicMock(spec=TelegramClient)
    mock_client.send_chat_action = AsyncMock(return_value=True)
    mock_client.send_message = AsyncMock(return_value=125)

    ratio_model = AssetRatiosResponse(
        total_valuation=100000000.0,
        total_target=100000000.0,
        additional_cash=0.0,
        major_results=[],
        sub_results=[],
    )

    with patch("src.backend.telegram.commands.ratio.get_asset_ratios", new_callable=AsyncMock) as mock_get_ratios:
        mock_get_ratios.return_value = ratio_model
        await handle_ratio(mock_client, chat_id=12345, text="/ratio")

        mock_client.send_chat_action.assert_awaited_once_with(12345, "typing")
        mock_client.send_message.assert_awaited_once()
        chat_id, sent_msg = mock_client.send_message.await_args[0]
        assert chat_id == 12345
        assert "📊 **자산 대분류 비중 및 리밸런싱**" in sent_msg


@pytest.mark.asyncio
async def test_handle_ratio_command_error_friendly_message():
    """/ratio 명령어 처리 중 API 에러 발생 시 사용자 친화적인 에러 메시지를 응답하는지 검증합니다."""
    mock_client = MagicMock(spec=TelegramClient)
    mock_client.send_chat_action = AsyncMock(return_value=True)
    mock_client.send_message = AsyncMock(return_value=126)

    with patch("src.backend.telegram.commands.ratio.get_asset_ratios", new_callable=AsyncMock) as mock_get_ratios:
        mock_get_ratios.side_effect = AssetClientError("네트워크 단절")
        await handle_ratio(mock_client, chat_id=12345, text="/ratio")

        mock_client.send_chat_action.assert_awaited_once_with(12345, "typing")
        mock_client.send_message.assert_awaited_once()
        chat_id, sent_msg = mock_client.send_message.await_args[0]
        assert chat_id == 12345
        assert "⚠️ 자산 비중 정보를 가져오는데 실패했습니다: 네트워크 단절" in sent_msg


# ============================================================================
# 4. TelegramBot 롱폴링 엔드투엔드 라우팅 (/asset, /ratio) 테스트
# ============================================================================

@pytest.mark.asyncio
async def test_bot_routes_asset_command_with_mention():
    """TelegramBot이 /asset@MyBot 형태의 멘션 명령어를 정상 라우팅하는지 검증합니다."""
    tg_config = TelegramConfig(
        bot_token="test_token",
        allowed_user_ids=[12345],
        enabled=True,
    )
    mock_client = MagicMock(spec=TelegramClient)
    mock_client.send_chat_action = AsyncMock(return_value=True)
    mock_client.send_message = AsyncMock(return_value=10)
    mock_client.get_updates = AsyncMock(
        return_value=[
            {
                "update_id": 601,
                "message": {
                    "message_id": 71,
                    "from": {"id": 12345, "first_name": "Tester"},
                    "chat": {"id": 12345},
                    "text": "/asset@MyAssetBot",
                },
            }
        ]
    )

    summary_model = AssetSummaryResponse(
        total_valuation_krw=50000000.0,
        total_principal=40000000.0,
        total_profit=10000000.0,
        cumulative_roi=25.0,
        contribution_ratio=80.0,
        profit_ratio=20.0,
        exchange_rate={"rate": 1300.0, "date": "2026-09-12"},
        latest_price_date="2026-09-12",
    )

    with patch("src.backend.telegram.commands.asset.get_asset_summary", new_callable=AsyncMock) as mock_summary:
        mock_summary.return_value = summary_model
        bot = TelegramBot(config=tg_config, client=mock_client)
        next_offset = await bot.poll_once(offset=600)

        assert next_offset == 602
        mock_client.send_chat_action.assert_awaited_once_with(12345, "typing")
        mock_client.send_message.assert_awaited_once()
        sent_chat_id, sent_text = mock_client.send_message.await_args[0]
        assert sent_chat_id == 12345
        assert "💰 **통합 자산 현황**" in sent_text
