# -*- coding: utf-8 -*-
"""텔레그램 /restart 커맨드 핸들러 모듈입니다.

사용자의 재시작 요청을 받아 스토리지에 재시작 대기 플래그(.restart_pending)를 생성하고
안내 메시지 전송 후 프로세스를 종료하여 PM2 등 프로세스 관리자에 의한 재시작을 유도합니다.
"""

import logging
import os
import sys
from typing import TYPE_CHECKING, Callable

from ...config import TelegramConfig, get_settings

if TYPE_CHECKING:
    from ..client import TelegramClient

logger = logging.getLogger(__name__)

RESTART_FLAG_FILENAME = ".restart_pending"


def default_exit_system() -> None:
    """기본 시스템 종료 함수입니다. 프로세스를 코드 0으로 종료합니다."""
    logger.info("시스템을 종료합니다 (exit 0)...")
    sys.exit(0)


async def handle_restart(
    client: "TelegramClient",
    chat_id: int,
    text: str = "",
    config: TelegramConfig | None = None,
    exit_func: Callable[[], None] | None = None,
) -> None:
    """서버 프로세스 재시작 명령을 처리합니다.

    스토리지 디렉터리에 재시작 플래그 파일을 생성하고,
    사용자에게 안내 메시지를 전송한 후 시스템 종료 함수를 호출합니다.

    Args:
        client: 텔레그램 API 클라이언트 인스턴스
        chat_id: 대상 사용자 또는 대화방 ID
        text: 사용자가 입력한 명령어 텍스트
        config: 텔레그램 설정 객체 (생략 시 get_settings().telegram 사용)
        exit_func: 프로세스 종료 콜백 함수 (생략 시 default_exit_system 사용)
    """
    if config is None:
        config = get_settings().telegram

    target_exit = exit_func if exit_func is not None else default_exit_system

    flag_file = os.path.join(config.storage_dir, RESTART_FLAG_FILENAME)
    try:
        os.makedirs(config.storage_dir, exist_ok=True)
        with open(flag_file, "w", encoding="utf-8") as f:
            f.write("restart_pending")
        logger.info(f"재시작 플래그 파일 생성 완료: {flag_file}")
    except Exception as exc:
        logger.error(f"재시작 플래그 파일 생성 실패: {exc}")

    await client.send_message(
        chat_id, "🔄 서버를 재시작합니다. 약 5~8초 정도 소요됩니다..."
    )

    try:
        target_exit()
    except Exception as exc:
        logger.error(f"시스템 종료 함수 실행 중 오류 발생: {exc}")
