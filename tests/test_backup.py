import pytest
import json
import os
import shutil
import datetime
from pathlib import Path
from unittest.mock import patch, MagicMock, mock_open
from src.backend.services.backup_service import BackupService

@pytest.fixture
def temp_backup_dir(tmp_path):
    """임시 백업 디렉토리를 생성합니다."""
    d = tmp_path / "backups"
    d.mkdir()
    return d

@pytest.fixture
def mock_db_file(tmp_path):
    """임시 DB 파일을 생성합니다."""
    f = tmp_path / "assets.db"
    f.write_text("dummy database content")
    return f

@pytest.fixture
def backup_service(temp_backup_dir, mock_db_file):
    """테스트용 설정을 가진 BackupService 인스턴스를 생성합니다."""
    settings = {
        "backup": {
            "interval_hours": 24,
            "path": str(temp_backup_dir),
            "max_files": 3
        }
    }
    
    with patch("builtins.open", mock_open(read_data=json.dumps(settings))), \
         patch("json.load", return_value=settings):
        service = BackupService()
        # 테스트를 위해 DB 경로를 임시 경로로 변경
        service.db_path = str(mock_db_file)
        return service

def test_should_backup_initially(backup_service, temp_backup_dir):
    """백업이 하나도 없을 때 백업을 수행해야 함을 확인합니다."""
    assert backup_service._should_backup() is True

def test_should_not_backup_within_interval(backup_service, temp_backup_dir):
    """백업 주기가 지나지 않았을 때 백업을 수행하지 않아야 함을 확인합니다."""
    # 현재 시간으로 백업 파일 생성
    now = datetime.datetime.now()
    latest_backup = temp_backup_dir / f"assets_{now.strftime('%Y%m%d_%H%M%S')}.db"
    latest_backup.write_text("old backup")
    
    assert backup_service._should_backup() is False

def test_should_backup_after_interval(backup_service, temp_backup_dir):
    """백업 주기가 지났을 때 백업을 수행해야 함을 확인합니다."""
    # 25시간 전 시간으로 백업 파일 생성 (주기 24시간)
    past = datetime.datetime.now() - datetime.timedelta(hours=25)
    past_timestamp = past.timestamp()
    old_backup = temp_backup_dir / f"assets_{past.strftime('%Y%m%d_%H%M%S')}.db"
    old_backup.write_text("old backup")
    
    # 윈도우에서는 ctime 변경이 어려우므로 mtime을 과거로 돌리고 
    # BackupService 로직에서 mtime을 사용하도록 유도하거나 utime으로 조정
    os.utime(str(old_backup), (past_timestamp, past_timestamp))
    
    assert backup_service._should_backup() is True

def test_perform_backup_creates_file(backup_service, temp_backup_dir):
    """백업 수행 시 파일이 생성되는지 확인합니다."""
    backup_service._perform_backup()
    
    backups = list(temp_backup_dir.glob("assets_*.db"))
    assert len(backups) == 1
    assert backups[0].read_text() == "dummy database content"

def test_rotate_backups_keeps_limit(backup_service, temp_backup_dir):
    """백업 파일 개수가 한도를 초과하면 가장 오래된 것을 삭제하는지 확인합니다."""
    # 3개 파일 미리 생성 (한도가 3개)
    for i in range(3):
        dt = datetime.datetime.now() - datetime.timedelta(days=i)
        f = temp_backup_dir / f"assets_{dt.strftime('%Y%m%d_%H%M%S')}.db"
        f.write_text(f"backup {i}")
        # 생성 시간 조정을 위해 파일 시간 수정 (필요 시)
    
    assert len(list(temp_backup_dir.glob("assets_*.db"))) == 3
    
    # 새로운 백업 수행 (4번째)
    backup_service._perform_backup()
    
    # 여전히 3개여야 함
    backups = sorted(list(temp_backup_dir.glob("assets_*.db")))
    assert len(backups) == 3
