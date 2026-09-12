# -*- coding: utf-8 -*-
"""텔레그램 /daily 명령어 핸들러 모듈입니다."""

import logging
from typing import TYPE_CHECKING

from ..asset_client import get_daily_stats
from ..renderer import render_daily_stats

if TYPE_CHECKING:
    from ..client import TelegramClient

logger = logging.getLogger(__name__)


async def handle_daily(client: "TelegramClient", chat_id: int, text: str = "") -> None:
    """일별 자산 스냅샷 통계를 조회하여 모바일 최적화 마크다운으로 전송합니다.

    명령어 뒤에 숫자 인자를 전달하여 조회할 영업일 수를 지정할 수 있습니다 (기본값: 7일).
    유효하지 않은 인자 전달 시 기본값(7일)으로 안전하게 대체 처리합니다.
    사용자 체감 응답성을 높이기 위해 처리 전 'typing' Chat Action을 전송합니다.

    Args:
        client: 텔레그램 API 클라이언트 인스턴스
        chat_id: 대상 대화방 또는 사용자 ID
        text: 사용자가 입력한 원본 명령어 텍스트 (예: '/daily 10')
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
        daily_resp = await get_daily_stats(all_data=True)
        final_msg = render_daily_stats(daily_resp, days=days)
        await client.send_message(chat_id, final_msg)
    except Exception as exc:
        logger.exception(f"일별 수익률 조회 CLI 오류: {exc}")
        await client.send_message(chat_id, f"⚠️ 일별 수익률 정보를 가져오는데 실패했습니다: {exc}")
