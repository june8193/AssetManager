# -*- coding: utf-8 -*-
"""시스템 백그라운드 태스크 상태, DB 탐색 및 시스템 로그 관리 라우터 모듈입니다."""

import re
import uuid
import decimal
import datetime
from pathlib import Path
from typing import List, Optional, Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from ..database import get_db
from ..tasks import task_manager_instance

router = APIRouter(prefix="/api/v1/system", tags=["System"])

# 허용할 로그 디렉터리 경로 목록 설정
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent.absolute()
LOGS_DIR = PROJECT_ROOT / "backups" / "logs"
ALLOWED_LOG_DIRS = [LOGS_DIR.resolve(), (PROJECT_ROOT / "logs").resolve()]


# --- Pydantic Request/Response Schemas ---

class QueryRequest(BaseModel):
    """Read-Only SQL 쿼리 요청 스키마입니다.

    Attributes:
        query (str): 실행할 Read-Only SQL 문장
        limit (Optional[int]): 반환할 최대 행 개수 (기본값: 500, 최대: 500)
    """
    query: str = Field(..., description="실행할 SELECT SQL 쿼리문")
    limit: Optional[int] = Field(500, ge=1, le=500, description="반환할 최대 행 개수 (최대 500건)")


class TableSummaryResponse(BaseModel):
    """DB 테이블 요약 정보 응답 스키마입니다.

    Attributes:
        name (str): 테이블 명칭
        row_count (int): 레코드 수
    """
    name: str = Field(..., description="테이블 명칭")
    row_count: int = Field(..., description="테이블 내 레코드 수")


class ColumnSchemaResponse(BaseModel):
    """테이블 컬럼 스키마 정의 스키마입니다.

    Attributes:
        name (str): 컬럼 명칭
        type (str): 데이터 타입
        nullable (bool): Null 허용 여부
        primary_key (bool): 기본키(PK) 여부
        default (Optional[str]): 기본값
    """
    name: str = Field(..., description="컬럼 명칭")
    type: str = Field(..., description="컬럼 데이터 타입")
    nullable: bool = Field(..., description="Null 허용 여부")
    primary_key: bool = Field(..., description="주 키(PK) 여부")
    default: Optional[str] = Field(None, description="기본값")


class TableSchemaResponse(BaseModel):
    """특정 테이블 상세 스키마 응답 스키마입니다.

    Attributes:
        table_name (str): 테이블 명칭
        columns (List[ColumnSchemaResponse]): 컬럼 스키마 목록
        foreign_keys (List[Dict[str, Any]]): 외래키 제약조건 목록
    """
    table_name: str = Field(..., description="테이블 명칭")
    columns: List[ColumnSchemaResponse] = Field(..., description="컬럼 상세 정의 목록")
    foreign_keys: List[Dict[str, Any]] = Field(..., description="외래키 정의 목록")


class QueryExecutionResponse(BaseModel):
    """Read-Only SQL 실행 결과 응답 스키마입니다.

    Attributes:
        columns (List[str]): 조회 컬럼 목록
        rows (List[List[Any]]): 조회 행 값 목록
        row_count (int): 결과 행 개수
        truncated (bool): 최대 행 제한 초과 잘림 여부
    """
    columns: List[str] = Field(..., description="조회 결과 컬럼 목록")
    rows: List[List[Any]] = Field(..., description="조회 결과 행 목록")
    row_count: int = Field(..., description="반환된 행 개수")
    truncated: bool = Field(..., description="최대 개수 초과 잘림 여부")


class LogFileResponse(BaseModel):
    """로그 파일 요약 응답 스키마입니다.

    Attributes:
        name (str): 파일명
        size_bytes (int): 크기(바이트)
        modified_at (str): 최종 수정 일시
    """
    name: str = Field(..., description="로그 파일명")
    size_bytes: int = Field(..., description="파일 크기 (바이트)")
    modified_at: str = Field(..., description="최종 수정 일시 (ISO 포맷)")


class LogContentResponse(BaseModel):
    """로그 내용 조회 응답 스키마입니다.

    Attributes:
        filename (str): 파일명
        total_lines (int): 조건에 일치하는 전체 라인 수
        lines (List[str]): 추출된 최근 라인 목록
    """
    filename: str = Field(..., description="로그 파일명")
    total_lines: int = Field(..., description="조건에 일치하는 전체 라인 수")
    lines: List[str] = Field(..., description="추출된 로그 라인 목록")


# --- Internal Helper Functions ---

def _get_inspector_and_tables(db: Session):
    """SQLAlchemy 세션으로부터 Inspector와 테이블 목록을 함께 가져옵니다.

    Args:
        db (Session): SQLAlchemy 데이터베이스 세션

    Returns:
        tuple[Inspector, List[str]]: Inspector 객체 및 전체 테이블명 리스트
    """
    bind = db.get_bind()
    inspector = inspect(bind)
    return inspector, inspector.get_table_names()


def _serialize_value(val: Any) -> Any:
    """DB 조회 결과를 JSON 직렬화 가능한 형태로 안전하게 변환합니다.

    Args:
        val (Any): 변환할 원본 값

    Returns:
        Any: JSON 직렬화 가능 객체 (str, float, int, bool, None 등)
    """
    if isinstance(val, (datetime.datetime, datetime.date, datetime.time)):
        return val.isoformat()
    if isinstance(val, decimal.Decimal):
        return float(val)
    if isinstance(val, (bytes, bytearray)):
        return val.decode("utf-8", errors="replace")
    if isinstance(val, (Path, uuid.UUID)):
        return str(val)
    return val


def _validate_read_only_query(query_str: str) -> str:
    """쿼리가 안전한 Read-Only SELECT 문인지 검증합니다.

    문자열 리터럴('...', "...") 및 SQL 주석(--, /*...*/)을 제외한 본문에서만
    금지 키워드(INSERT, UPDATE, DELETE 등)를 검사하여 오작동을 방지합니다.

    Args:
        query_str (str): 검증할 원본 SQL 쿼리 문자열

    Returns:
        str: 검증을 통과한 단일 SQL 쿼리 문자열

    Raises:
        HTTPException: 쿼리가 비어 있거나 DML/DDL 구문, 다중 문장이 포함된 경우 (400)
    """
    cleaned = query_str.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="쿼리가 비어 있습니다.")

    statements = [s.strip() for s in cleaned.split(";") if s.strip()]
    if len(statements) > 1:
        raise HTTPException(status_code=400, detail="다중 SQL 문장은 실행할 수 없습니다. 단일 SELECT 쿼리만 허용됩니다.")

    single_query = statements[0]

    code_without_comments = re.sub(r"--.*$", "", single_query, flags=re.MULTILINE)
    code_without_comments = re.sub(r"/\*.*?\*/", "", code_without_comments, flags=re.DOTALL).strip()

    code_for_keyword_check = re.sub(r"'(?:''|[^'])*'", "''", code_without_comments)
    code_for_keyword_check = re.sub(r'"(?:""|[^"])*"', '""', code_for_keyword_check)

    upper_q = code_for_keyword_check.upper().strip()

    if not (upper_q.startswith("SELECT") or upper_q.startswith("WITH") or upper_q.startswith("EXPLAIN SELECT")):
        raise HTTPException(status_code=400, detail="안전을 위해 SELECT 쿼리만 실행할 수 있습니다.")

    forbidden_keywords = [
        r"\bINSERT\b", r"\bUPDATE\b", r"\bDELETE\b", r"\bDROP\b",
        r"\bALTER\b", r"\bCREATE\b", r"\bTRUNCATE\b", r"\bREPLACE\b",
        r"\bEXEC\b", r"\bEXECUTE\b", r"\bPRAGMA\b"
    ]
    for pattern in forbidden_keywords:
        if re.search(pattern, upper_q):
            raise HTTPException(status_code=400, detail="안전을 위해 SELECT 쿼리만 실행할 수 있습니다. 금지 키워드가 포함되어 있습니다.")

    return single_query


# --- API Endpoints ---

@router.get("/tasks/status")
def get_task_status():
    """백그라운드 주기적 태스크들의 현재 실행/에러 상태를 반환합니다.

    Returns:
        Dict[str, Any]: 태스크별 execution 상태 및 이력 디렉터리
    """
    return task_manager_instance.get_task_status()


@router.get("/db/tables", response_model=List[TableSummaryResponse])
def get_db_tables(db: Session = Depends(get_db)):
    """SQLite DB의 모든 테이블 목록과 각 테이블의 레코드 수를 반환합니다.

    Args:
        db (Session): 데이터베이스 세션 객체

    Returns:
        List[TableSummaryResponse]: 테이블명과 레코드 수 목록

    Raises:
        HTTPException: DB 메타데이터 및 테이블 목록 조회 중 오류 발생 시 (500)
    """
    try:
        inspector, table_names = _get_inspector_and_tables(db)
        result = []
        for name in table_names:
            try:
                count_res = db.execute(text(f'SELECT COUNT(*) FROM "{name}"')).scalar()
                row_count = int(count_res) if count_res is not None else 0
            except Exception:
                row_count = 0
            result.append(TableSummaryResponse(name=name, row_count=row_count))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"테이블 목록 조회 중 오류 발생: {str(e)}")


@router.get("/db/schema/{table_name}", response_model=TableSchemaResponse)
def get_table_schema(table_name: str, db: Session = Depends(get_db)):
    """특정 테이블의 상세 스키마(컬럼, 타입, PK, FK)를 반환합니다.

    Args:
        table_name (str): 스키마를 조회할 테이블명
        db (Session): 데이터베이스 세션 객체

    Returns:
        TableSchemaResponse: 테이블명, 컬럼 목록, 외래키 목록 정보

    Raises:
        HTTPException: 테이블이 존재하지 않는 경우 (404)
    """
    inspector, table_names = _get_inspector_and_tables(db)
    if table_name not in table_names:
        raise HTTPException(status_code=404, detail=f"테이블 '{table_name}'을(를) 찾을 수 없습니다.")

    columns_raw = inspector.get_columns(table_name)
    columns = []
    for col in columns_raw:
        columns.append(ColumnSchemaResponse(
            name=col.get("name"),
            type=str(col.get("type")),
            nullable=col.get("nullable", True),
            primary_key=bool(col.get("primary_key", 0)),
            default=str(col.get("default")) if col.get("default") is not None else None,
        ))

    foreign_keys = inspector.get_foreign_keys(table_name)

    return TableSchemaResponse(
        table_name=table_name,
        columns=columns,
        foreign_keys=foreign_keys,
    )


@router.post("/db/query", response_model=QueryExecutionResponse)
def execute_db_query(req: QueryRequest, db: Session = Depends(get_db)):
    """Read-Only SELECT SQL 쿼리를 안전하게 실행하고 결과를 반환합니다.

    Args:
        req (QueryRequest): SQL 쿼리 및 최대 행 수 요청 객체
        db (Session): 데이터베이스 세션 객체

    Returns:
        QueryExecutionResponse: 컬럼 목록, 행 데이터 리스트, 행 개수, 잘림(truncated) 여부

    Raises:
        HTTPException: SQL 검증 실패 (400) 또는 DB 실행 오류 발생 시 (400)
    """
    query = _validate_read_only_query(req.query)
    max_limit = min(req.limit or 500, 500)

    try:
        res = db.execute(text(query))

        if not res.returns_rows:
            return QueryExecutionResponse(columns=[], rows=[], row_count=0, truncated=False)

        columns = list(res.keys())
        fetched_rows = res.fetchmany(max_limit + 1)
        truncated = len(fetched_rows) > max_limit
        rows_to_return = fetched_rows[:max_limit]

        formatted_rows = []
        for row in rows_to_return:
            row_values = [_serialize_value(item) for item in row]
            formatted_rows.append(row_values)

        return QueryExecutionResponse(
            columns=columns,
            rows=formatted_rows,
            row_count=len(formatted_rows),
            truncated=truncated,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"SQL 실행 오류: {str(e)}")


@router.get("/logs/files", response_model=List[LogFileResponse])
def get_log_files():
    """서버 로그 디렉터리들에 존재하는 로그 파일 목록을 반환합니다.

    Returns:
        List[LogFileResponse]: 파일명, 파일 크기, 최종 수정 일시 목록
    """
    files_info = []
    seen_names = set()

    for log_dir in ALLOWED_LOG_DIRS:
        if not log_dir.exists():
            continue
        for file_path in log_dir.glob("*"):
            if file_path.is_file() and file_path.name not in seen_names:
                try:
                    stat = file_path.stat()
                    seen_names.add(file_path.name)
                    files_info.append(LogFileResponse(
                        name=file_path.name,
                        size_bytes=stat.st_size,
                        modified_at=datetime.datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    ))
                except Exception:
                    continue

    files_info.sort(key=lambda x: x.modified_at, reverse=True)
    return files_info


@router.get("/logs/content", response_model=LogContentResponse)
def get_log_content(
    filename: str = Query(..., description="조회할 로그 파일명"),
    lines: int = Query(100, ge=1, le=2000, description="반환할 최대 라인 수"),
    level: Optional[str] = Query(None, description="로그 레벨 필터 (INFO, WARN, ERROR)"),
    keyword: Optional[str] = Query(None, description="검색 키워드"),
):
    """지정한 로그 파일의 내용(최신 라인, 필터링 적용)을 안전하게 반환합니다.

    Args:
        filename (str): 조회할 로그 파일명
        lines (int): 추출할 라인 수 (기본 100줄)
        level (Optional[str]): 필터링할 로그 레벨
        keyword (Optional[str]): 검색 키워드

    Returns:
        LogContentResponse: 파일명, 전체 일치 라인 수, 추출 라인 목록

    Raises:
        HTTPException: 경로 접근 권한 오류 (404) 또는 파일 읽기 실패 (500)
    """
    target_path = None
    for log_dir in ALLOWED_LOG_DIRS:
        candidate = (log_dir / filename).resolve()
        if candidate.is_relative_to(log_dir) and candidate.exists() and candidate.is_file():
            target_path = candidate
            break

    if target_path is None:
        raise HTTPException(status_code=404, detail=f"로그 파일 '{filename}'을(를) 찾을 수 없거나 접근 권한이 없습니다.")

    try:
        with open(target_path, "r", encoding="utf-8", errors="replace") as f:
            all_lines = f.readlines()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"로그 파일 읽기 실패: {str(e)}")

    filtered_lines = []
    level_upper = level.upper() if level else None
    keyword_lower = keyword.lower() if keyword else None

    for line in all_lines:
        line_str = line.rstrip("\r\n")
        if level_upper and level_upper not in line_str.upper():
            continue
        if keyword_lower and keyword_lower not in line_str.lower():
            continue
        filtered_lines.append(line_str)

    tail_lines = filtered_lines[-lines:] if lines < len(filtered_lines) else filtered_lines

    return LogContentResponse(
        filename=filename,
        total_lines=len(filtered_lines),
        lines=tail_lines,
    )
