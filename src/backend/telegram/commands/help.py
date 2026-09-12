# -*- coding: utf-8 -*-
"""텔레그램 /help 명령어 핸들러 모듈입니다."""

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..client import TelegramClient

logger = logging.getLogger(__name__)

HELP_MESSAGE = (
    "💡 **AssetManager 텔레그램 봇 명령어 안내**\n"
    "• /help: 사용 가능한 명령어 목록을 확인합니다.\n"
    "• /asset: 통합 자산 현황 및 평가금액, 누적 수익률을 조회합니다.\n"
    "• /ratio: 대분류/소분류 자산 배분 비중 및 리밸런싱 현황을 조회합니다.\n"
    "• /tx [개수] 또는 /transactions [개수]: 최근 거래내역을 조회합니다. (기본 5개)\n"
    "• /yearly: 연도별 자산 추이 및 연간 투자수익률을 조회합니다.\n"
    "• /daily [일수]: 최근 일별 자산 평가액 및 수익 변동 스냅샷을 조회합니다. (기본 7일)\n"
    "• /sync [일수]: 키움증권 거래내역을 수동으로 즉시 동기화합니다. (기본 7일)"
)


async def handle_help(client: "TelegramClient", chat_id: int, text: str = "") -> None:
    """도움말 메시지를 포맷팅하여 사용자에게 전송합니다.

    Args:
        client: 텔레그램 API 클라이언트 인스턴스
        chat_id: 대상 사용자 또는 대화방 ID
        text: 사용자가 입력한 원본 텍스트
    """
    await client.send_message(chat_id, HELP_MESSAGE)
