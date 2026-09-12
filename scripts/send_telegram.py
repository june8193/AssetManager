# -*- coding: utf-8 -*-
"""텔레그램 메시지를 발송하는 CLI 스크립트입니다.

지정된 문자열 또는 파일 경로로부터 메시지 내용을 읽어 텔레그램 허용 사용자에게 발송합니다.
"""

import asyncio
import io
import os
from pathlib import Path
import sys

# 프로젝트 루트 디렉터리를 sys.path에 추가하여 src 모듈 임포트 보장
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.backend.telegram.asset_client import send_telegram_message, AssetClientError


def main_cli() -> None:
    """CLI 명령행 인자를 파싱하고 텔레그램 메시지 발송을 수행합니다."""
    if sys.platform == "win32" and "pytest" not in sys.modules:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

    if len(sys.argv) < 2:
        print("사용법: uv run python scripts/send_telegram.py <메시지 내용 또는 파일 경로> [chat_id]")
        sys.exit(1)

    message_or_path = sys.argv[1]
    chat_id = None
    if len(sys.argv) >= 3:
        try:
            chat_id = int(sys.argv[2])
        except ValueError:
            print(f"오류: chat_id는 숫자여야 합니다. 입력값: {sys.argv[2]}", file=sys.stderr)
            sys.exit(1)

    if os.path.isfile(message_or_path):
        try:
            with open(message_or_path, "r", encoding="utf-8") as f:
                message = f.read()
        except Exception as e:
            print(f"오류: 파일을 읽을 수 없습니다 ({message_or_path}): {e}", file=sys.stderr)
            sys.exit(1)
    else:
        message = message_or_path

    try:
        result = asyncio.run(send_telegram_message(message, chat_id=chat_id))
        print(result)
    except AssetClientError as err:
        print(f"오류: 텔레그램 메시지 전송 실패: {err}", file=sys.stderr)
        sys.exit(1)
    except Exception as exc:
        print(f"예기치 못한 오류 발생: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main_cli()
