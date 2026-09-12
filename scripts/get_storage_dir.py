# -*- coding: utf-8 -*-
"""리포트 저장 디렉터리 경로를 출력하는 CLI 스크립트입니다.

settings.toml 및 환경 변수에 설정된 storage_dir 값을 읽어
운영체제에 호환되는 절대 경로로 정규화하여 출력합니다.
"""

import io
import sys
from pathlib import Path

# 프로젝트 루트 디렉터리를 sys.path에 추가하여 src 모듈 임포트 보장
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.backend.config import get_settings


def get_resolved_storage_dir() -> Path:
    """설정된 리포트 저장 디렉터리를 절대 경로로 정규화하여 반환합니다.

    Returns:
        Path: 절대 경로로 변환된 저장 디렉터리 Path 객체
    """
    settings = get_settings()
    storage_dir = settings.telegram.storage_dir
    if not storage_dir:
        storage_dir = "./storage"

    cleaned_dir = storage_dir.strip().strip("'\"")
    resolved_path = Path(cleaned_dir).expanduser().resolve()
    return resolved_path



def main() -> None:
    """CLI 메인 진입점 함수입니다."""
    if sys.platform == "win32" and "pytest" not in sys.modules:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

    resolved_path = get_resolved_storage_dir()
    print(str(resolved_path))


if __name__ == "__main__":
    main()
