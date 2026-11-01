# -*- coding: utf-8 -*-
"""시스템 설정(settings.toml) 관리용 Pydantic 스키마 모듈입니다."""

from typing import List, Union, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field, field_validator


class AccountSettingItem(BaseModel):
    """증권사 계좌 연동 설정 항목 스키마입니다."""

    broker: str = Field(..., min_length=1, description="증권사 명칭")
    account: str = Field(..., min_length=1, description="계좌 번호")
    app_key: str = Field(..., min_length=1, description="발급받은 APP KEY")
    secret_key: str = Field(..., min_length=1, description="발급받은 SECRET KEY")


class DatabaseSettingSection(BaseModel):
    """데이터베이스 설정 섹션 스키마입니다."""

    url: str = Field(..., min_length=1, description="데이터베이스 연결 URL")


class BackupSettingSection(BaseModel):
    """데이터베이스 자동 백업 설정 섹션 스키마입니다."""

    interval_hours: int = Field(..., ge=1, description="백업 주기 (시간)")
    path: str = Field(..., min_length=1, description="백업 저장 경로")
    max_files: int = Field(..., ge=1, description="보관할 최대 백업 파일 개수")


class TelegramSettingSection(BaseModel):
    """텔레그램 봇 연동 설정 섹션 스키마입니다."""

    bot_token: str = Field(default="", description="텔레그램 봇 토큰")
    allowed_user_ids: List[Union[int, str]] = Field(
        default_factory=list, description="허용된 사용자 ID 목록"
    )
    enabled: bool = Field(default=False, description="봇 활성화 여부")
    storage_dir: str = Field(default="./storage", description="스토리지 디렉터리 경로")

    @field_validator("allowed_user_ids")
    @classmethod
    def validate_allowed_user_ids(cls, v: List[Union[int, str]]) -> List[int]:
        """allowed_user_ids의 모든 원소가 정수 변환 가능한지 검증합니다.

        Args:
            v (List[Union[int, str]]): 검증 대상 사용자 ID 목록

        Returns:
            List[int]: 정수형으로 변환된 사용자 ID 목록

        Raises:
            ValueError: 리스트가 아니거나 정수로 변환 불가능한 원소가 포함된 경우
        """
        if not isinstance(v, list):
            raise ValueError("allowed_user_ids는 리스트 형태여야 합니다.")
        result: List[int] = []
        for item in v:
            try:
                result.append(int(item))
            except (ValueError, TypeError):
                raise ValueError(f"allowed_user_ids의 항목은 정수로 변환 가능해야 합니다: {item}")
        return result


class NaverSettingSection(BaseModel):
    """네이버 뉴스 검색 API 연동 설정 섹션 스키마입니다."""

    client_id: str = Field(default="", description="네이버 클라이언트 ID")
    client_secret: str = Field(default="", description="네이버 클라이언트 시크릿")


class SystemSettingsData(BaseModel):
    """전체 시스템 설정 구조화 데이터 스키마입니다."""

    base_url: str = Field(..., min_length=1, description="키움 REST API 서비스 URL")
    ws_url: str = Field(default="", description="키움 웹소켓 URL")
    database: DatabaseSettingSection = Field(..., description="데이터베이스 설정")
    accounts: List[AccountSettingItem] = Field(..., min_length=1, description="증권사 계좌 목록")
    backup: BackupSettingSection = Field(..., description="백업 설정")
    telegram: TelegramSettingSection = Field(
        default_factory=TelegramSettingSection, description="텔레그램 봇 설정"
    )
    naver: NaverSettingSection = Field(
        default_factory=NaverSettingSection, description="네이버 API 설정"
    )


class SystemSettingsResponse(BaseModel):
    """설정 조회 응답 스키마입니다."""

    settings: SystemSettingsData = Field(..., description="구조화된 설정 객체")
    raw_toml: str = Field(..., description="설정 파일 원문 텍스트")
    has_backup: bool = Field(..., description="백업 파일 존재 여부")
    backup_modified_at: Optional[str] = Field(
        None, description="백업 파일 최종 수정 일시 (ISO 포맷)"
    )


class SystemSettingsUpdateRequest(BaseModel):
    """설정 수정 요청 스키마입니다."""

    mode: Literal["form", "raw"] = Field("form", description="편집 모드 (form 또는 raw)")
    settings: Optional[Union[SystemSettingsData, Dict[str, Any]]] = Field(
        None, description="form 모드 시 전달할 설정 객체"
    )
    raw_toml: Optional[str] = Field(
        None, description="raw 모드 시 전달할 TOML 원문"
    )


class SystemRestartResponse(BaseModel):
    """서버 재시작 요청 응답 스키마입니다."""

    status: str = Field(default="restarting", description="재시작 처리 상태")
    message: str = Field(
        default="서버를 재시작합니다. 약 5~8초 정도 소요됩니다...",
        description="사용자 안내 메시지",
    )

