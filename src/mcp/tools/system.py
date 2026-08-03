# -*- coding: utf-8 -*-
"""서버 DB 탐색 및 로그 조회를 위한 MCP 도구 모듈입니다.
개발용 노트북에서 서버 PC 백엔드 API를 호출하여 DB 테이블, 스키마, SELECT 쿼리 및 로그를 조회합니다.
"""

from typing import Optional, Dict, Any, List
from src.mcp.client import api_client


async def get_db_tables() -> Any:
    """서버 데이터베이스의 모든 테이블 목록과 각 테이블의 레코드 수를 조회합니다.

    Returns:
        Any: 테이블명과 레코드 수를 담은 리스트 또는 에러 메시지 딕셔너리
    """
    try:
        return await api_client.get("/api/v1/system/db/tables")
    except Exception as e:
        return {"error": f"DB 테이블 목록 조회 실패: {str(e)}"}


async def get_db_schema(table_name: str) -> Any:
    """서버 데이터베이스 내 지정한 테이블의 상세 스키마(컬럼, 데이터 타입, PK, FK 등)를 조회합니다.

    Args:
        table_name (str): 스키마를 조회할 데이터베이스 테이블 명칭

    Returns:
        Any: 컬럼 상세 및 제약 조건 스키마 정보 또는 에러 메시지 딕셔너리
    """
    try:
        return await api_client.get(f"/api/v1/system/db/schema/{table_name}")
    except Exception as e:
        return {"error": f"테이블 '{table_name}' 스키마 조회 실패: {str(e)}"}


async def execute_db_query(query: str, limit: Optional[int] = 500) -> Any:
    """서버 데이터베이스를 대상으로 Read-Only SELECT SQL 쿼리를 실행합니다.

    안전을 위해 SELECT, WITH, EXPLAIN SELECT 쿼리만 허용되며,
    INSERT, UPDATE, DELETE 등 수정 쿼리는 차단됩니다. 최대 500행까지 반환됩니다.

    Args:
        query (str): 실행할 SELECT SQL 쿼리문
        limit (Optional[int]): 반환할 최대 행 개수 (기본값: 500, 최대: 500)

    Returns:
        Any: 컬럼 목록 및 데이터 행 리스트 또는 에러 메시지 딕셔너리
    """
    try:
        return await api_client.post(
            "/api/v1/system/db/query",
            json_data={"query": query, "limit": limit or 500},
        )
    except Exception as e:
        return {"error": f"SQL 쿼리 실행 실패: {str(e)}"}


async def get_system_logs(
    filename: str = "app.log",
    lines: Optional[int] = 100,
    level: Optional[str] = None,
    keyword: Optional[str] = None,
) -> Any:
    """서버 PC 백엔드의 최신 시스템/에러 로그 내용 및 라인을 조회합니다.

    Args:
        filename (str): 조회할 로그 파일 명칭 (기본값: app.log)
        lines (Optional[int]): 가져올 최신 라인 수 (기본값: 100)
        level (Optional[str]): 필터링할 로그 레벨 (INFO, WARN, ERROR)
        keyword (Optional[str]): 검색할 키워드

    Returns:
        Any: 필터링된 로그 라인 리스트 및 메타데이터 또는 에러 메시지 딕셔너리
    """
    try:
        params: Dict[str, Any] = {"filename": filename, "lines": lines or 100}
        if level:
            params["level"] = level
        if keyword:
            params["keyword"] = keyword

        return await api_client.get("/api/v1/system/logs/content", params=params)
    except Exception as e:
        return {"error": f"시스템 로그 조회 실패: {str(e)}"}
