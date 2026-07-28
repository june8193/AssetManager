# -*- coding: utf-8 -*-
"""시스템 백그라운드 태스크 상태 및 관리 라우터 모듈입니다."""

from fastapi import APIRouter
from ..tasks import task_manager_instance

router = APIRouter(prefix="/api/v1/system", tags=["System"])


@router.get("/tasks/status")
def get_task_status():
    """백그라운드 주기적 태스크들의 현재 실행/에러 상태를 반환합니다."""
    return task_manager_instance.get_task_status()
