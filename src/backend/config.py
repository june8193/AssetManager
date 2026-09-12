# -*- coding: utf-8 -*-
"""애플리케이션 전역 설정 관리 모듈입니다.

settings.toml 파일과 환경 변수를 통합하여 텔레그램, 네이버 API, DB 등의 설정을 로드하고 제공합니다.
"""

from dataclasses import dataclass, field
import os
from pathlib import Path
import tomllib
from typing import Any


@dataclass
class TelegramConfig:
    """텔레그램 봇 설정 정보를 저장하는 데이터 클래스입니다."""

    bot_token: str = ""
    allowed_user_ids: list[int] = field(default_factory=list)
    enabled: bool = False
    storage_dir: str = "./storage"

    def __post_init__(self) -> None:
        """allowed_user_ids 항목을 정수형으로 정규화합니다."""
        normalized: list[int] = []
        for uid in self.allowed_user_ids:
            try:
                normalized.append(int(uid))
            except (ValueError, TypeError):
                continue
        self.allowed_user_ids = normalized

    def is_user_allowed(self, user_id: int | str) -> bool:
        """주어진 사용자 ID가 허용 목록에 포함되어 있는지 검사합니다.

        Args:
            user_id: 텔레그램 사용자 ID (정수 또는 숫자 문자열)

        Returns:
            허용 목록에 존재하면 True, 그렇지 않으면 False
        """
        try:
            target_id = int(user_id)
        except (ValueError, TypeError):
            return False
        return target_id in self.allowed_user_ids


@dataclass
class NaverConfig:
    """네이버 검색 API 인증 정보를 저장하는 데이터 클래스입니다."""

    client_id: str = ""
    client_secret: str = ""


@dataclass
class DatabaseConfig:
    """데이터베이스 연결 설정 데이터 클래스입니다."""

    url: str = "sqlite:///./src/assets.db"


@dataclass
class BackupConfig:
    """데이터베이스 백업 설정 데이터 클래스입니다."""

    interval_hours: int = 24
    path: str = "./backups"
    max_files: int = 7


@dataclass
class Settings:
    """AssetManager 전체 통합 설정 클래스입니다."""

    base_url: str = "https://api.kiwoom.com"
    ws_url: str = ""
    database: DatabaseConfig = field(default_factory=DatabaseConfig)
    backup: BackupConfig = field(default_factory=BackupConfig)
    telegram: TelegramConfig = field(default_factory=TelegramConfig)
    naver: NaverConfig = field(default_factory=NaverConfig)

    @classmethod
    def load_from_toml(cls, filepath: str | None = None) -> "Settings":
        """TOML 파일 및 환경 변수로부터 설정을 로드하여 Settings 객체를 반환합니다.

        Args:
            filepath: 설정 파일 경로. 생략 시 SETTINGS_PATH 환경변수 또는 ./settings.toml 사용

        Returns:
            로드 및 환경변수 오버라이드가 완료된 Settings 객체
        """
        if filepath is None:
            filepath = os.getenv("SETTINGS_PATH", "./settings.toml")

        data: dict[str, Any] = {}
        path_obj = Path(filepath)
        if path_obj.exists():
            with open(path_obj, "rb") as f:
                data = tomllib.load(f)

        # 1. Base URL
        base_url = data.get("base_url", "https://api.kiwoom.com")
        ws_url = data.get("ws_url", "")

        # 2. Database
        db_dict = data.get("database", {})
        db_config = DatabaseConfig(
            url=db_dict.get("url", "sqlite:///./src/assets.db")
        )

        # 3. Backup
        backup_dict = data.get("backup", {})
        backup_config = BackupConfig(
            interval_hours=backup_dict.get("interval_hours", 24),
            path=backup_dict.get("path", "./backups"),
            max_files=backup_dict.get("max_files", 7),
        )

        # 4. Telegram
        tg_dict = data.get("telegram", {})
        tg_token = tg_dict.get("bot_token", "")
        tg_users = tg_dict.get("allowed_user_ids", [])
        tg_enabled = tg_dict.get("enabled", False)
        tg_storage = tg_dict.get("storage_dir", "./storage")

        # Telegram 환경변수 오버라이드
        env_token = os.getenv("TELEGRAM_BOT_TOKEN")
        if env_token is not None:
            tg_token = env_token

        env_users = os.getenv("TELEGRAM_ALLOWED_USER_IDS")
        if env_users is not None:
            parsed_users: list[int] = []
            for item in env_users.split(","):
                item_str = item.strip()
                if item_str:
                    try:
                        parsed_users.append(int(item_str))
                    except ValueError:
                        pass
            tg_users = parsed_users

        env_enabled = os.getenv("TELEGRAM_ENABLED")
        if env_enabled is not None:
            tg_enabled = env_enabled.lower() in ("true", "1", "t", "yes", "y")

        env_storage = os.getenv("STORAGE_DIR") or os.getenv("TELEGRAM_STORAGE_DIR")
        if env_storage is not None:
            tg_storage = env_storage

        tg_config = TelegramConfig(
            bot_token=tg_token,
            allowed_user_ids=list(tg_users),
            enabled=tg_enabled,
            storage_dir=tg_storage,
        )

        # 5. Naver
        naver_dict = data.get("naver", {})
        naver_id = naver_dict.get("client_id", "")
        naver_secret = naver_dict.get("client_secret", "")

        # Naver 환경변수 오버라이드
        env_nid = os.getenv("NAVER_CLIENT_ID") or os.getenv("NAVER_API_CLIENT_ID")
        if env_nid is not None:
            naver_id = env_nid

        env_nsecret = os.getenv("NAVER_CLIENT_SECRET") or os.getenv("NAVER_API_CLIENT_SECRET")
        if env_nsecret is not None:
            naver_secret = env_nsecret

        naver_config = NaverConfig(
            client_id=naver_id,
            client_secret=naver_secret,
        )

        return cls(
            base_url=base_url,
            ws_url=ws_url,
            database=db_config,
            backup=backup_config,
            telegram=tg_config,
            naver=naver_config,
        )


_settings_instance: Settings | None = None


def get_settings(filepath: str | None = None, reload: bool = False) -> Settings:
    """전역 캐시된 Settings 인스턴스를 반환합니다.

    Args:
        filepath: 설정 파일 경로 (지정 시 해당 파일에서 로드)
        reload: True일 경우 캐시를 무시하고 새로 로드

    Returns:
        Settings 인스턴스
    """
    global _settings_instance
    if _settings_instance is None or reload or filepath is not None:
        _settings_instance = Settings.load_from_toml(filepath)
    return _settings_instance
