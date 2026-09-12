# -*- coding: utf-8 -*-
"""텔레그램 봇 롱폴링 루프 및 사용자 요청 인가/디스패칭 모듈입니다."""

import asyncio
import logging
from typing import Any

from ..config import TelegramConfig, get_settings
from .client import TelegramClient
from .commands import CLICommandHandler

logger = logging.getLogger(__name__)


class TelegramBot:
    """Telegram 봇의 롱폴링 수신 및 사용자 인가, 커맨드 디스패치를 총괄하는 클래스입니다."""

    def __init__(
        self,
        config: TelegramConfig | None = None,
        client: TelegramClient | None = None,
    ):
        """TelegramBot 인스턴스를 초기화합니다.

        Args:
            config: 텔레그램 설정 객체 (생략 시 get_settings().telegram 사용)
            client: 텔레그램 API 클라이언트 (생략 시 config를 바탕으로 자동 생성)
        """
        if config is None:
            self.config = get_settings().telegram
        else:
            self.config = config

        if client is None:
            self.client = TelegramClient(bot_token=self.config.bot_token)
        else:
            self.client = client

        self.command_handler = CLICommandHandler(
            client=self.client,
            config=self.config,
        )

    async def aclose(self) -> None:
        """봇 내부 클라이언트 리소스를 안전하게 종료합니다."""
        await self.client.aclose()

    async def poll_once(self, offset: int | None = None) -> int | None:
        """Telegram 서버로부터 새 업데이트를 1회 롱폴링 수신하여 처리합니다.

        보안 가드를 적용하여 비인가 사용자의 접근을 차단하고,
        인가된 사용자의 슬래시 명령어 또는 일반 텍스트를 처리합니다.

        Args:
            offset: 수신할 업데이트의 시작 식별자

        Returns:
            다음 폴링에서 사용할 갱신된 offset 값
        """
        updates = await self.client.get_updates(offset=offset, timeout=30)
        next_offset = offset

        for update in updates:
            update_id = update.get("update_id")
            if update_id is not None:
                next_offset = update_id + 1

            message = update.get("message")
            if not message:
                continue

            chat = message.get("chat", {})
            chat_id = chat.get("id")
            from_user = message.get("from", {})
            user_id = from_user.get("id") or chat_id
            text = message.get("text")

            if chat_id is None or user_id is None:
                continue

            # 1. 보안 가드: 인가된 사용자 ID인지 검사
            if not self.config.is_user_allowed(user_id):
                logger.warning(
                    f"비인가 사용자의 텔레그램 접근 차단: User ID {user_id}, Chat ID {chat_id}"
                )
                warning_msg = (
                    f"⚠️ 접근 권한이 없습니다. 관리자에게 문의하세요. (User ID: {user_id})"
                )
                await self.client.send_message(chat_id, warning_msg)
                continue

            # 2. 인가된 사용자 메시지 처리
            if text:
                logger.info(f"텔레그램 메시지 수신 (User ID: {user_id}): {text}")

                if text.startswith("/"):
                    await self.command_handler.process_cli_command(chat_id, text)
                else:
                    notice_msg = (
                        "💡 자연어 대화 기능은 지원하지 않습니다.\n"
                        "사용 가능한 명령어를 확인하려면 `/help`를 입력하세요."
                    )
                    await self.client.send_message(chat_id, notice_msg)
            else:
                # 텍스트가 없는 미디어/스티커 등의 메시지 수신 시 안내
                non_text_notice = (
                    "💡 명령어 텍스트만 처리할 수 있습니다.\n"
                    "사용 가능한 명령어를 확인하려면 `/help`를 입력하세요."
                )
                await self.client.send_message(chat_id, non_text_notice)

        return next_offset

    async def register_bot_commands(self) -> None:
        """텔레그램 클라이언트에 공식 봇 명령어 목록을 등록합니다."""
        commands = [
            {"command": "help", "description": "사용 가능한 명령어 목록 안내"},
            {"command": "asset", "description": "통합 자산 현황 조회"},
            {"command": "ratio", "description": "자산 비중 및 리밸런싱 현황 조회"},
            {"command": "tx", "description": "최근 거래내역 조회"},
            {"command": "yearly", "description": "연도별 자산 통계 조회"},
            {"command": "daily", "description": "일별 자산 스냅샷 조회"},
            {"command": "sync", "description": "키움증권 거래내역 수동 동기화"},
        ]
        success = await self.client.set_my_commands(commands)
        if success:
            logger.info("텔레그램 봇 커맨드 목록 등록 완료")
        else:
            logger.warning("텔레그램 봇 커맨드 목록 등록 실패")

    async def start_polling(
        self,
        stop_event: asyncio.Event | None = None,
    ) -> None:
        """텔레그램 getUpdates 롱폴링 루프를 시작합니다.

        Args:
            stop_event: 폴링 종료를 알리는 asyncio.Event 객체 (옵션)
        """
        logger.info("텔레그램 봇 롱폴링 루프를 시작합니다.")
        await self.register_bot_commands()

        offset: int | None = None
        try:
            while stop_event is None or not stop_event.is_set():
                try:
                    offset = await self.poll_once(offset)
                except Exception as exc:
                    logger.error(f"텔레그램 폴링 중 예외 발생: {exc}")
                    await asyncio.sleep(3.0)

                await asyncio.sleep(0.1)
        finally:
            await self.aclose()
            logger.info("텔레그램 봇 롱폴링 루프가 정상 종료되었습니다.")
