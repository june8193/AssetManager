# -*- coding: utf-8 -*-
"""웹 서버 재시작 처리, 플래그 관리 및 비동기 프로세스 종료 서비스 모듈입니다."""

import asyncio
import logging
import sys
from pathlib import Path
from typing import Callable, List, Optional, Set

from fastapi import HTTPException, status

from ..config import get_settings
from ..schemas.settings import SystemRestartResponse

logger = logging.getLogger(__name__)

RESTART_FLAG_FILENAME = ".restart_pending"
DEFAULT_RESTART_DELAY_SECONDS = 0.8
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent.resolve()

# 비동기 백그라운드 태스크가 GC에 의해 조기 수거되는 것을 방지하기 위한 강한 참조 보관 세트
_background_tasks: Set[asyncio.Task] = set()


def default_exit_system() -> None:
    """기본 시스템 종료 함수입니다. 프로세스를 종료 코드 0으로 종료합니다."""
    logger.info("시스템을 종료합니다 (exit 0)...")
    sys.exit(0)


def get_restart_flag_paths() -> List[Path]:
    """재시작 감지용 플래그 파일의 전체 대상 경로 목록을 반환합니다.

    텔레그램 봇 스토리지 경로(telegram.storage_dir)와 프로젝트 루트 경로에 위치하는
    .restart_pending 파일 경로를 수집하여 반환합니다. 중복 경로는 제거됩니다.

    Returns:
        List[Path]: 유효한 플래그 파일 대상 경로 목록
    """
    paths: List[Path] = []
    try:
        tg_storage = get_settings().telegram.storage_dir
        if tg_storage:
            paths.append((Path(tg_storage) / RESTART_FLAG_FILENAME).resolve())
    except Exception as exc:
        logger.warning(f"텔레그램 스토리지 경로 조회 실패: {exc}")

    root_flag = (PROJECT_ROOT / RESTART_FLAG_FILENAME).resolve()
    if root_flag not in paths:
        paths.append(root_flag)

    return paths


def is_restart_pending() -> bool:
    """재시작 대기 플래그 파일이 대상 경로 중 하나라도 존재하는지 확인합니다.

    Returns:
        bool: 플래그 파일이 하나라도 존재하면 True, 그렇지 않으면 False
    """
    for flag_path in get_restart_flag_paths():
        if flag_path.exists():
            return True
    return False


def create_restart_flag() -> List[Path]:
    """재시작 플래그 파일을 모든 대상 경로에 생성합니다.

    디렉터리가 존재하지 않는 경우 자동으로 생성합니다.

    Returns:
        List[Path]: 정상적으로 생성된 플래그 파일 경로 목록
    """
    created_paths: List[Path] = []
    for flag_path in get_restart_flag_paths():
        try:
            flag_path.parent.mkdir(parents=True, exist_ok=True)
            flag_path.write_text("restart_pending", encoding="utf-8")
            created_paths.append(flag_path)
            logger.info(f"재시작 플래그 파일 생성 완료: {flag_path}")
        except Exception as exc:
            logger.error(f"재시작 플래그 파일 생성 실패 ({flag_path}): {exc}")
    return created_paths


def cleanup_restart_flag() -> None:
    """모든 대상 경로에서 재시작 플래그 파일을 삭제합니다."""
    for flag_path in get_restart_flag_paths():
        if flag_path.exists():
            try:
                flag_path.unlink()
                logger.info(f"재시작 플래그 파일 삭제 완료: {flag_path}")
            except Exception as exc:
                logger.error(f"재시작 플래그 파일 삭제 실패 ({flag_path}): {exc}")


async def trigger_server_restart(
    delay: float = DEFAULT_RESTART_DELAY_SECONDS,
    exit_func: Optional[Callable[[], None]] = None,
) -> SystemRestartResponse:
    """서버 재시작 플래그를 생성하고 비동기 지연 후 시스템을 종료합니다.

    이미 재시작 대기 플래그가 존재하는 경우 프로세스를 종료하지 않고
    HTTP 409 Conflict 예외를 발생시킵니다.

    Args:
        delay (float): 종료 함수 호출 전 대기할 지연 시간(초, 기본값 DEFAULT_RESTART_DELAY_SECONDS)
        exit_func (Optional[Callable[[], None]]): 프로세스 종료 콜백 함수 (생략 시 default_exit_system)

    Returns:
        SystemRestartResponse: 재시작 요청 접수 응답 객체

    Raises:
        HTTPException: 이미 재시작 대기 중인 경우 409 Conflict
    """
    if is_restart_pending():
        logger.warning("이미 재시작 대기 플래그가 존재하여 중복 재시작 요청을 차단합니다.")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 서버 재시작이 진행 중입니다. 잠시만 기다려 주세요.",
        )

    create_restart_flag()

    target_exit = exit_func if exit_func is not None else default_exit_system

    async def _delayed_exit() -> None:
        """지연 시간 대기 후 대상 프로세스 종료 함수를 호출합니다."""
        await asyncio.sleep(delay)
        try:
            target_exit()
        except Exception as exc:
            logger.error(f"시스템 종료 함수 실행 중 오류 발생: {exc}")

    # 백그라운드 태스크로 지연 종료를 예약하고 GC 수거 방지를 위해 강한 참조 유지
    task = asyncio.create_task(_delayed_exit())
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)

    return SystemRestartResponse()
