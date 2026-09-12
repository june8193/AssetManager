# -*- coding: utf-8 -*-
"""리다이렉트 URL을 추적하여 최종 원본 상세 URL을 반환하는 CLI 스크립트입니다."""

import asyncio
import io
from pathlib import Path
import sys

# 프로젝트 루트 디렉터리를 sys.path에 추가하여 src 모듈 임포트 보장
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.backend.telegram.asset_client import resolve_redirect_url


async def main_async() -> None:
    """비동기 URL 해석 실행 함수입니다."""
    if len(sys.argv) < 2:
        print("사용법: uv run python scripts/resolve_url.py <URL>")
        sys.exit(1)

    url = sys.argv[1]
    final_url = await resolve_redirect_url(url)
    print(final_url)


def main() -> None:
    """CLI 메인 진입점 함수입니다."""
    if sys.platform == "win32" and "pytest" not in sys.modules:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
