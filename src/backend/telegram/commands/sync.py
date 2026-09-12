# -*- coding: utf-8 -*-
"""텔레그램 /sync 명령어 핸들러 모듈입니다."""

import logging
from typing import TYPE_CHECKING

from ..asset_client import sync_kiwoom_transactions
from ..renderer import render_kiwoom_sync

if TYPE_CHECKING:
    from ..client import TelegramClient

logger = logging.getLogger(__name__)


async def handle_sync(client: "TelegramClient", chat_id: int, text: str = "") -> None:
    """키움증권 거래내역 수동 동기화를 수행하고 결과를 모바일 최적화 마크다운으로 전송합니다.

    명령어 뒤에 숫자 인자를 전달하여 동기화할 과거 일수를 지정할 수 있습니다 (기본값: 7일).
    유효하지 않은 인자나 0 이하의 값이 전달된 경우 기본값(7일)으로 안전하게 대체 처리합니다.
    동기화 수행 전 사용자 체감 반응성을 높이기 위해 'typing' Chat Action을 전송합니다.

    Args:
        client: 텔레그램 API 클라이언트 인스턴스
        chat_id: 대상 대화방 또는 사용자 ID
        text: 사용자가 입력한 원본 명령어 텍스트 (예: '/sync 3')
    """
    tokens = text.strip().split()
    days = 7
    if len(tokens) > 1:
        try:
            parsed_days = int(tokens[1])
            if parsed_days > 0:
                days = parsed_days
        except ValueError:
            pass

    await client.send_chat_action(chat_id, "typing")
    try:
        result = await sync_kiwoom_transactions(days=days)
        final_msg = render_kiwoom_sync(result, days=days)
        await client.send_message(chat_id, final_msg)
    except Exception as exc:
        logger.exception(f"키움증권 거래내역 동기화 CLI 오류: {exc}")
        await client.send_message(chat_id, f"⚠️ 동기화 중 오류가 발생했습니다: {exc}")
