# -*- coding: utf-8 -*-
"""settings.toml 파일 조회, 검증, 주석 보존 수정 및 백업 복원을 담당하는 서비스 모듈입니다."""

import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import HTTPException, status
import tomlkit
from tomlkit.items import AoT

from ..config import get_settings
from ..schemas.settings import (
    SystemSettingsData,
    SystemSettingsResponse,
    SystemSettingsUpdateRequest,
)
from ...kiwoom.auth import KiwoomAuthManager


PROJECT_ROOT = Path(__file__).parent.parent.parent.parent.resolve()


def get_settings_filepath() -> Path:
    """현재 활성화된 settings.toml 파일의 절대 경로를 반환합니다.

    환경 변수 SETTINGS_PATH가 설정되어 있으면 해당 경로를 우선 사용하고,
    그렇지 않으면 프로젝트 루트의 settings.toml을 반환합니다.

    Returns:
        Path: 설정 파일의 절대 경로
    """
    env_path = os.getenv("SETTINGS_PATH")
    if env_path:
        return Path(env_path).resolve()
    return (PROJECT_ROOT / "settings.toml").resolve()


def get_backup_filepath(settings_path: Optional[Path] = None) -> Path:
    """설정 파일에 대응하는 백업(.bak) 파일의 절대 경로를 반환합니다.

    Args:
        settings_path (Optional[Path]): 설정 파일 경로 (생략 시 get_settings_filepath 사용)

    Returns:
        Path: 백업 파일의 절대 경로
    """
    base_path = settings_path or get_settings_filepath()
    return base_path.with_name(f"{base_path.name}.bak")


def read_system_settings() -> SystemSettingsResponse:
    """현재 settings.toml 파일의 원문 및 구조화된 설정 데이터를 조회합니다.

    Returns:
        SystemSettingsResponse: 구조화된 설정 데이터와 Raw 문자열, 백업 상태를 포함한 응답 객체

    Raises:
        HTTPException: 파일이 없거나 문법 오류로 파싱할 수 없는 경우 500 에러
    """
    filepath = get_settings_filepath()

    # 설정 파일이 없으면 settings.toml.example을 기본으로 읽기 시도
    if not filepath.exists():
        example_path = PROJECT_ROOT / "settings.toml.example"
        if example_path.exists():
            raw_toml = example_path.read_text(encoding="utf-8")
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"설정 파일({filepath.name})을 찾을 수 없습니다.",
            )
    else:
        raw_toml = filepath.read_text(encoding="utf-8")

    try:
        doc = tomlkit.parse(raw_toml)
        parsed_dict = doc.unwrap()
        settings_data = SystemSettingsData.model_validate(parsed_dict)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"설정 파일 파싱 또는 유효성 검증 실패: {str(e)}",
        )

    backup_path = get_backup_filepath(filepath)
    has_backup = backup_path.exists()
    backup_modified_at: Optional[str] = None
    if has_backup:
        backup_modified_at = datetime.fromtimestamp(
            backup_path.stat().st_mtime
        ).isoformat()

    return SystemSettingsResponse(
        settings=settings_data,
        raw_toml=raw_toml,
        has_backup=has_backup,
        backup_modified_at=backup_modified_at,
    )


def _apply_form_to_toml_doc(
    doc: tomlkit.TOMLDocument, settings_data: SystemSettingsData
) -> None:
    """구조화된 설정 데이터를 기존 TOMLDocument에 in-place 반영하여 주석과 서식을 보존합니다.

    Args:
        doc (tomlkit.TOMLDocument): 업데이트할 대상 TOML 문서 객체
        settings_data (SystemSettingsData): 반영할 최신 시스템 설정 데이터
    """
    doc["base_url"] = settings_data.base_url

    if settings_data.ws_url or "ws_url" in doc:
        doc["ws_url"] = settings_data.ws_url

    # [database]
    if "database" not in doc:
        doc["database"] = tomlkit.table()
    doc["database"]["url"] = settings_data.database.url

    # [backup]
    if "backup" not in doc:
        doc["backup"] = tomlkit.table()
    doc["backup"]["interval_hours"] = settings_data.backup.interval_hours
    doc["backup"]["path"] = settings_data.backup.path
    doc["backup"]["max_files"] = settings_data.backup.max_files

    # [telegram]
    if "telegram" not in doc:
        doc["telegram"] = tomlkit.table()
    doc["telegram"]["bot_token"] = settings_data.telegram.bot_token
    doc["telegram"]["allowed_user_ids"] = settings_data.telegram.allowed_user_ids
    doc["telegram"]["enabled"] = settings_data.telegram.enabled
    doc["telegram"]["storage_dir"] = settings_data.telegram.storage_dir

    # [naver]
    if "naver" not in doc:
        doc["naver"] = tomlkit.table()
    doc["naver"]["client_id"] = settings_data.naver.client_id
    doc["naver"]["client_secret"] = settings_data.naver.client_secret

    # [[accounts]]
    if "accounts" not in doc or not isinstance(doc["accounts"], AoT):
        aot = tomlkit.aot()
        doc["accounts"] = aot
    else:
        aot = doc["accounts"]

    common_len = min(len(aot), len(settings_data.accounts))
    for i in range(common_len):
        acc = settings_data.accounts[i]
        aot[i]["broker"] = acc.broker
        aot[i]["account"] = acc.account
        aot[i]["app_key"] = acc.app_key
        aot[i]["secret_key"] = acc.secret_key

    while len(aot) > len(settings_data.accounts):
        aot.pop()

    for acc in settings_data.accounts[common_len:]:
        t = tomlkit.table()
        t["broker"] = acc.broker
        t["account"] = acc.account
        t["app_key"] = acc.app_key
        t["secret_key"] = acc.secret_key
        aot.append(t)


def update_system_settings(
    request: SystemSettingsUpdateRequest,
) -> SystemSettingsResponse:
    """설정을 수정하고 주석을 보존한 채 파일로 저장하며 직전 설정을 자동 백업합니다.

    Args:
        request (SystemSettingsUpdateRequest): form 또는 raw 모드의 수정 요청 페이로드

    Returns:
        SystemSettingsResponse: 수정 완료 후 갱신된 설정 응답 객체

    Raises:
        HTTPException: 문법 오류, 필수 키 누락, 유효성 검증 실패 시 400 에러
    """
    filepath = get_settings_filepath()

    if request.mode == "raw":
        if request.raw_toml is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="raw 모드에서는 raw_toml 값이 필수입니다.",
            )
        # 1. TOML 문법 파싱 검증
        try:
            doc = tomlkit.parse(request.raw_toml)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"TOML 문법 오류: {str(e)}",
            )
        # 2. 스키마 검증
        try:
            SystemSettingsData.model_validate(doc.unwrap())
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"설정 유효성 검증 실패: {str(e)}",
            )
        new_raw_toml = request.raw_toml

    elif request.mode == "form":
        if request.settings is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="form 모드에서는 settings 객체가 필수입니다.",
            )
        if isinstance(request.settings, SystemSettingsData):
            settings_data = request.settings
        else:
            try:
                settings_data = SystemSettingsData.model_validate(request.settings)
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"설정 유효성 검증 실패: {str(e)}",
                )

        # 기존 파일이 존재하면 로드하여 주석 및 서식 보존, 없으면 새로 생성
        if filepath.exists():
            existing_text = filepath.read_text(encoding="utf-8")
            doc = tomlkit.parse(existing_text)
        else:
            example_path = PROJECT_ROOT / "settings.toml.example"
            if example_path.exists():
                doc = tomlkit.parse(example_path.read_text(encoding="utf-8"))
            else:
                doc = tomlkit.document()

        # 각 섹션 in-place 업데이트
        _apply_form_to_toml_doc(doc, settings_data)

        new_raw_toml = tomlkit.dumps(doc)

        # 직렬화 후 교차 검증
        try:
            verify_doc = tomlkit.parse(new_raw_toml)
            SystemSettingsData.model_validate(verify_doc.unwrap())
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"설정 직렬화 후 검증 실패: {str(e)}",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"지원하지 않는 편집 모드입니다: {request.mode}",
        )

    # 덮어쓰기 직전 백업 생성
    backup_path = get_backup_filepath(filepath)
    if filepath.exists():
        backup_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(filepath, backup_path)

    # 새 설정 파일 저장
    filepath.parent.mkdir(parents=True, exist_ok=True)
    filepath.write_text(new_raw_toml, encoding="utf-8")

    # 인메모리 캐시 갱신
    get_settings(reload=True)
    KiwoomAuthManager.reset()

    return read_system_settings()


def restore_system_settings() -> SystemSettingsResponse:
    """settings.toml.bak 백업 파일로부터 설정을 복원합니다.

    Returns:
        SystemSettingsResponse: 복원 완료 후 갱신된 설정 응답 객체

    Raises:
        HTTPException: 백업 파일이 없으면 404, 백업 파일 검증 실패 시 400 에러
    """
    filepath = get_settings_filepath()
    backup_path = get_backup_filepath(filepath)

    if not backup_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="백업 설정 파일(settings.toml.bak)이 존재하지 않습니다.",
        )

    bak_content = backup_path.read_text(encoding="utf-8")
    try:
        doc = tomlkit.parse(bak_content)
        SystemSettingsData.model_validate(doc.unwrap())
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"백업 파일 TOML 유효성 검증 실패: {str(e)}",
        )

    filepath.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(backup_path, filepath)

    # 인메모리 캐시 갱신
    get_settings(reload=True)
    KiwoomAuthManager.reset()

    return read_system_settings()
