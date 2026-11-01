# -*- coding: utf-8 -*-
"""settings.toml 설정 조회, 검증, 저장 및 백업 복원 API에 대한 TDD 단위/통합 테스트 모듈입니다."""

import os
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from src.backend.config import get_settings
from src.kiwoom.auth import KiwoomAuthManager


SAMPLE_TOML_CONTENT = """# 키움증권 REST API 서비스 URL
base_url = "https://api.kiwoom.com"
ws_url = "wss://api.kiwoom.com/ws"

# 데이터베이스 설정
[database]
url = "sqlite:///./src/dev_assets.db"

# 증권사 계좌 정보 목록 (여러 계정 등록 가능)
[[accounts]]
broker = "키움증권"                # 증권사 명칭
account = "5526-9093"             # 계좌 번호
app_key = "SAMPLE_APP_KEY"        # 발급받은 APP KEY
secret_key = "SAMPLE_SECRET_KEY"   # 발급받은 SECRET KEY

# 데이터베이스 자동 백업 설정
[backup]
interval_hours = 24    # 백업 주기 (단위: 시간)
path = "./backups"     # 백업 파일이 저장될 상대/절대 경로
max_files = 7           # 보관할 최대 백업 파일 개수

# 텔레그램 봇 연동 설정
[telegram]
bot_token = "123456:SAMPLE_TELEGRAM_TOKEN"
allowed_user_ids = [123456789]
enabled = false
storage_dir = "./storage"

# 네이버 뉴스 검색 API 연동 설정
[naver]
client_id = "SAMPLE_NAVER_CLIENT_ID"
client_secret = "SAMPLE_NAVER_CLIENT_SECRET"
"""


@pytest.fixture
def isolated_settings_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """임시 settings.toml 및 백업 경로를 설정하여 실제 설정 파일과 격리하는 픽스처입니다."""
    temp_settings = tmp_path / "settings.toml"
    temp_settings.write_text(SAMPLE_TOML_CONTENT, encoding="utf-8")
    monkeypatch.setenv("SETTINGS_PATH", str(temp_settings))

    # 테스트 전후 캐시 리셋
    get_settings(str(temp_settings), reload=True)
    KiwoomAuthManager._instance = None

    yield temp_settings

    # 정리 후 캐시 리셋
    KiwoomAuthManager._instance = None


def test_get_settings_success(client: TestClient, isolated_settings_env: Path):
    """GET /api/v1/system/settings 호출 시 구조화 데이터 및 평문 토큰/원문을 정상 반환하는지 테스트합니다."""
    response = client.get("/api/v1/system/settings")
    assert response.status_code == 200
    data = response.json()

    # 필수 최상위 키 검증
    assert "settings" in data
    assert "raw_toml" in data
    assert "has_backup" in data
    assert "backup_modified_at" in data

    # 초기 상태에서는 백업이 없음
    assert data["has_backup"] is False
    assert data["backup_modified_at"] is None

    # 마스킹 없는 평문 확인
    settings = data["settings"]
    assert settings["base_url"] == "https://api.kiwoom.com"
    assert settings["accounts"][0]["app_key"] == "SAMPLE_APP_KEY"
    assert settings["accounts"][0]["secret_key"] == "SAMPLE_SECRET_KEY"
    assert settings["telegram"]["bot_token"] == "123456:SAMPLE_TELEGRAM_TOKEN"
    assert settings["naver"]["client_secret"] == "SAMPLE_NAVER_CLIENT_SECRET"

    # raw_toml 원문에 한글 주석 포함 여부 확인
    assert "# 키움증권 REST API 서비스 URL" in data["raw_toml"]


def test_put_settings_form_mode_preserves_comments_and_creates_backup(
    client: TestClient, isolated_settings_env: Path
):
    """Form 모드로 수정 시 한글 주석을 보존하면서 값을 변경하고 백업(.bak)을 생성하는지 테스트합니다."""
    # 1. 수정할 페이로드 준비
    get_res = client.get("/api/v1/system/settings")
    current = get_res.json()["settings"]
    current["base_url"] = "https://updated.kiwoom.com"
    current["backup"]["interval_hours"] = 12
    current["accounts"][0]["account"] = "9999-1111"
    # 새 계좌 하나 추가
    current["accounts"].append({
        "broker": "토스증권",
        "account": "1234-5678",
        "app_key": "TOSS_KEY",
        "secret_key": "TOSS_SECRET",
    })

    payload = {
        "mode": "form",
        "settings": current,
        "raw_toml": None,
    }

    # 2. PUT 호출
    put_res = client.put("/api/v1/system/settings", json=payload)
    assert put_res.status_code == 200
    data = put_res.json()

    # 백업 생성 확인
    assert data["has_backup"] is True
    assert data["backup_modified_at"] is not None

    bak_file = isolated_settings_env.with_name(f"{isolated_settings_env.name}.bak")
    assert bak_file.exists()
    bak_content = bak_file.read_text(encoding="utf-8")
    assert "https://api.kiwoom.com" in bak_content

    # 파일 변경 및 주석 보존 확인
    new_content = isolated_settings_env.read_text(encoding="utf-8")
    assert "https://updated.kiwoom.com" in new_content
    assert "interval_hours = 12" in new_content
    assert "# 키움증권 REST API 서비스 URL" in new_content
    assert "# 증권사 명칭" in new_content

    # 인메모리 캐시 갱신 확인
    cached = get_settings()
    assert cached.base_url == "https://updated.kiwoom.com"
    assert cached.backup.interval_hours == 12


def test_put_settings_raw_mode_success(client: TestClient, isolated_settings_env: Path):
    """Raw 모드로 TOML 원문 텍스트를 전달하여 성공적으로 저장하는지 테스트합니다."""
    raw_toml = SAMPLE_TOML_CONTENT.replace(
        "https://api.kiwoom.com", "https://raw-mode.kiwoom.com"
    )

    payload = {
        "mode": "raw",
        "settings": None,
        "raw_toml": raw_toml,
    }

    response = client.put("/api/v1/system/settings", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["settings"]["base_url"] == "https://raw-mode.kiwoom.com"
    assert "https://raw-mode.kiwoom.com" in data["raw_toml"]

    file_content = isolated_settings_env.read_text(encoding="utf-8")
    assert "https://raw-mode.kiwoom.com" in file_content

    # 메모리 캐시 갱신 확인
    assert get_settings().base_url == "https://raw-mode.kiwoom.com"


def test_put_settings_validation_errors(client: TestClient, isolated_settings_env: Path):
    """TOML 문법 오류, 필수 키 누락, 잘못된 범위 등 유효성 오류 시 400 및 파일 보존을 테스트합니다."""
    orig_content = isolated_settings_env.read_text(encoding="utf-8")

    # 1. Raw 모드: 문법 오류
    bad_raw_payload = {
        "mode": "raw",
        "raw_toml": "base_url = [invalid toml syntax",
    }
    res1 = client.put("/api/v1/system/settings", json=bad_raw_payload)
    assert res1.status_code == 400
    assert "TOML" in res1.json()["detail"] or "문법" in res1.json()["detail"]

    # 2. Form 모드: 필수 키 누락 (accounts 빈 리스트)
    get_res = client.get("/api/v1/system/settings")
    bad_form = get_res.json()["settings"]
    bad_form["accounts"] = []
    res2 = client.put("/api/v1/system/settings", json={"mode": "form", "settings": bad_form})
    assert res2.status_code == 400

    # 3. Form 모드: 범위 오류 (interval_hours < 1)
    bad_form2 = get_res.json()["settings"]
    bad_form2["backup"]["interval_hours"] = 0
    res3 = client.put("/api/v1/system/settings", json={"mode": "form", "settings": bad_form2})
    assert res3.status_code == 400

    # 4. Form 모드: telegram.allowed_user_ids 잘못된 문자열
    bad_form3 = get_res.json()["settings"]
    bad_form3["telegram"]["allowed_user_ids"] = ["invalid_number"]
    res4 = client.put("/api/v1/system/settings", json={"mode": "form", "settings": bad_form3})
    assert res4.status_code == 400

    # 검증 실패 후 파일 내용이 전혀 오염되지 않았는지 확인
    assert isolated_settings_env.read_text(encoding="utf-8") == orig_content


def test_restore_settings_success(client: TestClient, isolated_settings_env: Path):
    """백업 파일(.bak)이 존재할 때 정상 복원 및 메모리 갱신을 테스트합니다."""
    # 1. 먼저 PUT을 호출하여 원본 백업 생성 및 변경 적용
    get_res = client.get("/api/v1/system/settings")
    modified = get_res.json()["settings"]
    modified["base_url"] = "https://before-restore.kiwoom.com"
    client.put("/api/v1/system/settings", json={"mode": "form", "settings": modified})

    assert get_settings().base_url == "https://before-restore.kiwoom.com"

    # 2. POST /api/v1/system/settings/restore 호출
    restore_res = client.post("/api/v1/system/settings/restore")
    assert restore_res.status_code == 200
    data = restore_res.json()

    # 복원된 값 확인 (초기 base_url로 복원)
    assert data["settings"]["base_url"] == "https://api.kiwoom.com"
    assert isolated_settings_env.read_text(encoding="utf-8").startswith("# 키움증권")
    assert get_settings().base_url == "https://api.kiwoom.com"


def test_restore_settings_not_found(client: TestClient, isolated_settings_env: Path):
    """백업 파일이 없을 때 POST /api/v1/system/settings/restore 호출 시 404를 반환하는지 테스트합니다."""
    bak_file = isolated_settings_env.with_name(f"{isolated_settings_env.name}.bak")
    if bak_file.exists():
        bak_file.unlink()

    response = client.post("/api/v1/system/settings/restore")
    assert response.status_code == 404
    assert "백업" in response.json()["detail"]


def test_restore_settings_corrupted_backup(
    client: TestClient, isolated_settings_env: Path
):
    """손상된 백업 파일(.bak)로 복원 시도 시 400 에러를 반환하는지 테스트합니다."""
    bak_file = isolated_settings_env.with_name(f"{isolated_settings_env.name}.bak")
    bak_file.write_text("corrupted toml content [[[", encoding="utf-8")

    response = client.post("/api/v1/system/settings/restore")
    assert response.status_code == 400
    assert "유효성" in response.json()["detail"] or "TOML" in response.json()["detail"]


def test_put_settings_reduce_accounts(
    client: TestClient, isolated_settings_env: Path
):
    """계좌 목록을 추가했다가 다시 축소할 때 정상 반영되는지 테스트합니다."""
    # 1. 2개로 증가
    get_res = client.get("/api/v1/system/settings")
    settings = get_res.json()["settings"]
    settings["accounts"].append({
        "broker": "KB증권",
        "account": "1111-2222",
        "app_key": "KB_KEY",
        "secret_key": "KB_SECRET",
    })
    res1 = client.put(
        "/api/v1/system/settings", json={"mode": "form", "settings": settings}
    )
    assert res1.status_code == 200
    assert len(res1.json()["settings"]["accounts"]) == 2

    # 2. 1개로 축소
    settings["accounts"].pop()
    res2 = client.put(
        "/api/v1/system/settings", json={"mode": "form", "settings": settings}
    )
    assert res2.status_code == 200
    assert len(res2.json()["settings"]["accounts"]) == 1
    assert res2.json()["settings"]["accounts"][0]["broker"] == "키움증권"

