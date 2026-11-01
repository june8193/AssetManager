import os
import json
import tomllib
import shutil
import datetime
import glob
from pathlib import Path
from src.kiwoom.api import KiwoomAPI

# 프로젝트 루트 경로 (src/backend/services/backup_service.py 기준 상위 4단계)
PROJECT_ROOT = Path(__file__).resolve().parents[3]


def _load_backup_settings(settings_path: str | Path = "settings.toml") -> dict:
    """settings.toml에서 백업 설정 섹션을 안전하게 로드합니다.

    Args:
        settings_path (str | Path, optional): 설정 파일 경로. Defaults to "settings.toml".

    Returns:
        dict: [backup] 설정 딕셔너리.
    """
    try:
        with open(settings_path, "rb") as f:
            full_settings = tomllib.load(f)
    except Exception:
        full_settings = {}

    return full_settings.get("backup", {
        "interval_hours": 24,
        "path": "./backups",
        "max_files": 7
    })


def backup_database_file(db_path: str | Path, settings_path: str | Path = "settings.toml") -> Path:
    """지정된 SQLite DB 파일을 설정된 백업 디렉토리에 assets_YYYYMMDD_HHMMSS.db 형식으로 복사 백업합니다.

    Args:
        db_path (str | Path): 백업 대상 SQLite DB 파일 경로.
        settings_path (str | Path, optional): 설정 파일 경로. 기본값은 "settings.toml".

    Returns:
        Path: 생성된 백업 파일 경로.

    Raises:
        FileNotFoundError: 대상 DB 파일이 존재하지 않는 경우.
    """
    src_file = Path(db_path)
    if not src_file.exists() or not src_file.is_file():
        raise FileNotFoundError(f"백업 대상 DB 파일을 찾을 수 없습니다: {db_path}")

    backup_settings = _load_backup_settings(settings_path)
    backup_dir_str = backup_settings.get("path", "./backups")
    backup_dir = Path(backup_dir_str)
    backup_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    dest_path = backup_dir / f"assets_{timestamp}.db"

    shutil.copy2(src_file, dest_path)
    return dest_path


class BackupService:
    """데이터베이스 파일의 주기적인 백업을 관리하는 서비스 클래스입니다."""

    def __init__(self, settings_path="settings.toml"):
        """BackupService를 초기화하고 설정을 로드합니다.

        Args:
            settings_path (str): 설정 파일 경로.
        """
        self.settings = _load_backup_settings(settings_path)

        # 실제 DB 경로 설정 (src/assets.db)
        self.db_path = str(PROJECT_ROOT / "src" / "assets.db")

        self.backup_dir = Path(self.settings.get("path", "./backups"))
        self.interval_hours = self.settings.get("interval_hours", 24)
        self.max_files = self.settings.get("max_files", 7)

    @staticmethod
    def backup_database_file(db_path: str | Path, settings_path: str | Path = "settings.toml") -> Path:
        """지정된 SQLite DB 파일을 즉시 백업합니다."""
        return backup_database_file(db_path, settings_path=settings_path)

    def check_and_backup(self):
        """백업 주기를 확인하고 필요한 경우 백업을 수행합니다."""
        if self._should_backup():
            print(f"[INFO] 백업 주기가 도래하여 백업을 시작합니다. (대상: {self.db_path})")
            try:
                self._perform_backup()
                self._rotate_backups()
                print("[INFO] 백업 및 로테이션이 완료되었습니다.")
            except Exception as e:
                print(f"[ERROR] 백업 중 오류 발생: {e}")
        else:
            print("[INFO] 최근 백업이 최신 상태입니다. 백업을 건너뜁니다.")

    def _should_backup(self) -> bool:
        """마지막 백업 시간과 비교하여 백업이 필요한지 확인합니다.

        Returns:
            bool: 백업이 필요하면 True, 아니면 False.
        """
        if not self.backup_dir.exists():
            return True

        # assets_*.db 형식의 파일 중 가장 최근 파일 찾기
        backups = glob.glob(str(self.backup_dir / "assets_*.db"))
        if not backups:
            return True

        latest_backup = max(backups, key=os.path.getmtime)
        last_backup_time = datetime.datetime.fromtimestamp(os.path.getmtime(latest_backup))

        # 현재 시간과 비교
        diff = datetime.datetime.now() - last_backup_time
        return diff.total_seconds() >= (self.interval_hours * 3600)

    def _perform_backup(self):
        """실제 파일 복사를 통해 백업을 생성합니다."""
        if not os.path.exists(self.db_path):
            raise FileNotFoundError(f"DB 파일을 찾을 수 없습니다: {self.db_path}")

        if not self.backup_dir.exists():
            self.backup_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        dest_path = self.backup_dir / f"assets_{timestamp}.db"

        shutil.copy2(self.db_path, dest_path)

    def _rotate_backups(self):
        """최대 백업 개수를 초과한 오래된 파일을 삭제합니다."""
        backups = sorted(glob.glob(str(self.backup_dir / "assets_*.db")), key=os.path.getmtime)

        if len(backups) > self.max_files:
            num_to_delete = len(backups) - self.max_files
            for i in range(num_to_delete):
                try:
                    os.remove(backups[i])
                    print(f"[INFO] 오래된 백업 파일을 삭제했습니다: {backups[i]}")
                except Exception as e:
                    print(f"[WARN] 백업 파일 삭제 실패: {e}")

if __name__ == "__main__":
    # 직접 실행 시 테스트
    service = BackupService()
    service.check_and_backup()
