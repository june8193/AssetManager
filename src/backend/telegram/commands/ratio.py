# -*- coding: utf-8 -*-
"""텔레그램 /ratio 명령어 핸들러 모듈입니다."""

import logging
from typing import TYPE_CHECKING

from ..asset_client import get_asset_ratios
from ..renderer import render_asset_ratios

if TYPE_CHECKING:
    from ..client import TelegramClient

logger = logging.getLogger(__name__)


async def handle_ratio(client: "TelegramClient", chat_id: int, text: str = "") -> None:
    """자산군별 비중 및 리밸런싱 정보를 조회하여 모바일 최적화 마크다운으로 전송합니다.

    사용자 체감 응답성을 향상시키기 위해 처리 전 'typing' Chat Action을 전송합니다.

    Args:
        client: 텔레그램 API 클라이언트 인스턴스
        chat_id: 대상 대화방 또는 사용자 ID
        text: 사용자가 입력한 원본 명령어 텍스트
    """
    await client.send_chat_action(chat_id, "typing")
    try:
        ratios = await get_asset_ratios()
        final_msg = render_asset_ratios(ratios)
        await client.send_message(chat_id, final_msg)
    except Exception as exc:
        logger.exception(f"자산 비중 조회 CLI 오류: {exc}")
        await client.send_message(chat_id, f"⚠️ 자산 비중 정보를 가져오는데 실패했습니다: {exc}")
