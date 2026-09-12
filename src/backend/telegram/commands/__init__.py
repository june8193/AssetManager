# -*- coding: utf-8 -*-
"""텔레그램 커맨드 처리 및 라우팅 패키지입니다."""

import logging
from typing import TYPE_CHECKING, Callable, Awaitable

from .asset import handle_asset
from .daily import handle_daily
from .help import handle_help
from .ratio import handle_ratio
from .restart import RESTART_FLAG_FILENAME, handle_restart
from .sync import handle_sync
from .tx import handle_transactions
from .yearly import handle_yearly

if TYPE_CHECKING:
    from ..client import TelegramClient
    from ...config import TelegramConfig

logger = logging.getLogger(__name__)


class CLICommandHandler:
    """텔레그램 슬래시 명령어를 디스패치하는 핸들러 클래스입니다."""

    def __init__(
        self,
        client: "TelegramClient",
        config: "TelegramConfig",
    ):
        """CLICommandHandler 인스턴스를 초기화합니다.

        Args:
            client: 텔레그램 API 클라이언트 인스턴스
            config: 텔레그램 설정 인스턴스
        """
        self.client = client
        self.config = config

        # 커맨드 매핑 테이블
        self.handlers: dict[str, Callable[["TelegramClient", int, str], Awaitable[None]]] = {
            "/help": handle_help,
            "/asset": handle_asset,
            "/ratio": handle_ratio,
            "/tx": handle_transactions,
            "/transactions": handle_transactions,
            "/yearly": handle_yearly,
            "/daily": handle_daily,
            "/sync": handle_sync,
            "/restart": self._handle_restart,
        }

    async def _handle_restart(
        self, client: "TelegramClient", chat_id: int, text: str
    ) -> None:
        """/restart 명령어를 위임 처리합니다."""
        await handle_restart(client, chat_id, text, config=self.config)

    async def process_cli_command(self, chat_id: int, text: str) -> None:
        """수신된 텍스트에서 명령어를 추출하여 등록된 핸들러로 전달합니다.

        Args:
            chat_id: 텔레그램 사용자 또는 대화방 ID
            text: 명령어 텍스트
        """
        tokens = text.strip().split()
        if not tokens:
            return

        cmd = tokens[0].lower()
        # @봇이름 제거 (예: /help@MyAssetBot -> /help)
        if "@" in cmd:
            cmd = cmd.split("@")[0]

        handler = self.handlers.get(cmd)
        if handler:
            await handler(self.client, chat_id, text)
        else:
            warning_msg = (
                f"⚠️ 알 수 없는 명령어입니다: {cmd}\n"
                "사용 가능한 명령어 확인을 위해 `/help`를 입력해 보세요."
            )
            await self.client.send_message(chat_id, warning_msg)


__all__ = [
    "CLICommandHandler",
    "RESTART_FLAG_FILENAME",
    "handle_asset",
    "handle_daily",
    "handle_help",
    "handle_ratio",
    "handle_restart",
    "handle_sync",
    "handle_transactions",
    "handle_yearly",
]
