# -*- coding: utf-8 -*-
"""시스템 DB 탐색 및 로그 조회를 위한 REST API 단위 테스트 모듈입니다."""

import decimal
import datetime
import pytest
from pathlib import Path
from fastapi.testclient import TestClient


@pytest.fixture
def mock_logs_dir(tmp_path, monkeypatch):
    """로그 테스트용 임시 디렉터리를 생성하고 ALLOWED_LOG_DIRS를 몽키패치합니다.

    Args:
        tmp_path (Path): pytest 임시 디렉터리 픽스처
        monkeypatch (pytest.MonkeyPatch): pytest 몽키패치 픽스처

    Returns:
        Path: 생성된 임시 로그 디렉터리 경로
    """
    logs_dir = tmp_path / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    from src.backend.routers import system
    monkeypatch.setattr(system, "ALLOWED_LOG_DIRS", [logs_dir.resolve()])
    return logs_dir


def test_get_db_tables(client: TestClient):
    """DB 테이블 목록 및 레코드 수를 정상적으로 반환하는지 테스트합니다.

    Args:
        client (TestClient): FastAPI 테스트 클라이언트 픽스처
    """
    response = client.get("/api/v1/system/db/tables")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    table_names = [item["name"] for item in data]
    assert "users" in table_names or "accounts" in table_names
    for item in data:
        assert "name" in item
        assert "row_count" in item
        assert isinstance(item["row_count"], int)


def test_get_table_schema(client: TestClient):
    """특정 테이블의 상세 스키마(컬럼, PK, FK)를 반환하는지 테스트합니다.

    Args:
        client (TestClient): FastAPI 테스트 클라이언트 픽스처
    """
    response = client.get("/api/v1/system/db/schema/accounts")
    assert response.status_code == 200
    data = response.json()
    assert data["table_name"] == "accounts"
    assert "columns" in data
    assert isinstance(data["columns"], list)
    assert "foreign_keys" in data

    col_names = [col["name"] for col in data["columns"]]
    assert "id" in col_names
    assert "user_id" in col_names
    assert "name" in col_names


def test_get_table_schema_not_found(client: TestClient):
    """존재하지 않는 테이블 스키마 요청 시 404 에러를 반환하는지 테스트합니다.

    Args:
        client (TestClient): FastAPI 테스트 클라이언트 픽스처
    """
    response = client.get("/api/v1/system/db/schema/non_existent_table")
    assert response.status_code == 404


def test_execute_read_only_query_success(client: TestClient):
    """Read-Only SELECT 쿼리가 정상 실행되는지 테스트합니다.

    Args:
        client (TestClient): FastAPI 테스트 클라이언트 픽스처
    """
    payload = {"query": "SELECT id, name, provider FROM accounts LIMIT 10"}
    response = client.post("/api/v1/system/db/query", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "columns" in data
    assert "rows" in data
    assert "row_count" in data
    assert data["columns"] == ["id", "name", "provider"]
    assert isinstance(data["rows"], list)


def test_execute_read_only_query_with_keyword_in_string_literal(client: TestClient):
    """문자열 리터럴 내에 'DELETE', 'DROP' 등의 키워드가 포함된 SELECT 쿼리가 오작동하지 않는지 테스트합니다.

    Args:
        client (TestClient): FastAPI 테스트 클라이언트 픽스처
    """
    payload = {"query": "SELECT id, name FROM accounts WHERE name = 'DELETE' OR provider = 'DROP'"}
    response = client.post("/api/v1/system/db/query", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["columns"] == ["id", "name"]


def test_execute_write_query_blocked(client: TestClient):
    """DELETE, UPDATE, INSERT, DROP 등의 수정 쿼리는 차단(HTTP 400)하는지 테스트합니다.

    Args:
        client (TestClient): FastAPI 테스트 클라이언트 픽스처
    """
    invalid_queries = [
        "DELETE FROM accounts",
        "UPDATE accounts SET name = 'hacked'",
        "INSERT INTO accounts (user_id, name, provider) VALUES (1, 'test', 'test')",
        "DROP TABLE accounts",
        "ALTER TABLE accounts ADD COLUMN test TEXT",
        "CREATE TABLE test (id INT)",
        "SELECT * FROM accounts; DELETE FROM accounts;",
    ]
    for invalid_query in invalid_queries:
        response = client.post("/api/v1/system/db/query", json={"query": invalid_query})
        assert response.status_code == 400
        assert "SELECT" in response.json()["detail"]


def test_get_log_files(client: TestClient, mock_logs_dir: Path):
    """로그 파일 목록 조회를 테스트합니다.

    Args:
        client (TestClient): FastAPI 테스트 클라이언트 픽스처
        mock_logs_dir (Path): 임시 로그 디렉터리 픽스처
    """
    (mock_logs_dir / "app.log").write_text("2026-08-03 10:00:00 [INFO] System started\n", encoding="utf-8")
    (mock_logs_dir / "error.log").write_text("2026-08-03 10:05:00 [ERROR] Connection lost\n", encoding="utf-8")

    response = client.get("/api/v1/system/logs/files")
    assert response.status_code == 200
    data = response.json()
    filenames = [f["name"] for f in data]
    assert "app.log" in filenames
    assert "error.log" in filenames


def test_get_log_content_with_filter(client: TestClient, mock_logs_dir: Path):
    """로그 파일 내용 조회, 라인 제한, 레벨 필터링 및 키워드 검색을 테스트합니다.

    Args:
        client (TestClient): FastAPI 테스트 클라이언트 픽스처
        mock_logs_dir (Path): 임시 로그 디렉터리 픽스처
    """
    log_file = mock_logs_dir / "app.log"
    log_content = (
        "2026-08-03 10:00:00 [INFO] Server started\n"
        "2026-08-03 10:01:00 [WARN] High memory usage\n"
        "2026-08-03 10:02:00 [ERROR] Database connection failed\n"
        "2026-08-03 10:03:00 [INFO] User logged in\n"
    )
    log_file.write_text(log_content, encoding="utf-8")

    # 1. 전체 내용 조회 (lines=10)
    response = client.get("/api/v1/system/logs/content?filename=app.log&lines=10")
    assert response.status_code == 200
    data = response.json()
    assert data["total_lines"] == 4
    assert len(data["lines"]) == 4

    # 2. ERROR 레벨 필터링
    response = client.get("/api/v1/system/logs/content?filename=app.log&level=ERROR")
    assert response.status_code == 200
    data = response.json()
    assert len(data["lines"]) == 1
    assert "ERROR" in data["lines"][0]

    # 3. 키워드 검색
    response = client.get("/api/v1/system/logs/content?filename=app.log&keyword=memory")
    assert response.status_code == 200
    data = response.json()
    assert len(data["lines"]) == 1
    assert "High memory usage" in data["lines"][0]


def test_get_log_content_path_traversal_blocked(client: TestClient, mock_logs_dir: Path):
    """상위 디렉터리 접근(Path Traversal) 시도가 차단되는지 테스트합니다.

    Args:
        client (TestClient): FastAPI 테스트 클라이언트 픽스처
        mock_logs_dir (Path): 임시 로그 디렉터리 픽스처
    """
    response = client.get("/api/v1/system/logs/content?filename=../secret.txt")
    assert response.status_code == 404
