"""SQLite 데이터베이스 스키마 마이그레이션을 수행하는 모듈입니다."""

import logging
from sqlalchemy import text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)


def _add_column_if_missing(conn, table_name: str, column_name: str, column_type_def: str) -> bool:
    """테이블에 특정 컬럼이 없는 경우 컬럼을 추가합니다.

    Args:
        conn: SQLAlchemy 데이터베이스 커넥션
        table_name (str): 대상 테이블명
        column_name (str): 추가할 컬럼명
        column_type_def (str): 컬럼 타입 및 기본값 정의

    Returns:
        bool: 컬럼이 추가되었으면 True, 이미 존재하거나 테이블이 없으면 False
    """
    if not table_name.isidentifier() or not column_name.isidentifier():
        raise ValueError(f"유효하지 않은 테이블/컬럼 식별자입니다: table={table_name}, column={column_name}")

    result = conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
    existing_columns = [row[1] for row in result]

    if existing_columns and column_name not in existing_columns:
        logger.info(f"[{table_name}] 테이블에 {column_name} 컬럼을 추가합니다.")
        conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type_def}"))
        conn.commit()
        return True
    return False


def run_migrations(engine: Engine) -> None:
    """기존 SQLite 데이터베이스 테이블 스키마의 누락된 컬럼을 자동으로 추가합니다.

    Args:
        engine (Engine): SQLAlchemy 엔진 객체

    Raises:
        RuntimeError: 데이터베이스 마이그레이션 실행 중 실패 시
    """
    try:
        with engine.connect() as conn:
            # historical_prices 테이블 마이그레이션
            if _add_column_if_missing(conn, "historical_prices", "updated_at", "DATETIME"):
                conn.execute(text("UPDATE historical_prices SET updated_at = datetime('now', 'localtime')"))
                conn.commit()

            # transactions 테이블 마이그레이션
            if _add_column_if_missing(conn, "transactions", "source", "VARCHAR DEFAULT 'MANUAL'"):
                conn.execute(text("UPDATE transactions SET source = 'AUTO_KIWOOM' WHERE memo LIKE '%키움 자동저장%'"))
                conn.commit()

            conn.execute(text("UPDATE transactions SET source = 'MANUAL' WHERE source IS NULL"))
            conn.commit()

            _add_column_if_missing(conn, "transactions", "external_id", "VARCHAR")
            _add_column_if_missing(conn, "transactions", "target_asset_id", "INTEGER")
            _add_column_if_missing(conn, "transactions", "transfer_pair_id", "VARCHAR")
            conn.commit()

            # 레거시 자산 카테고리 표준화 마이그레이션
            conn.execute(text(
                "UPDATE assets SET major_category = '주식', sub_category = '코어(지수)' "
                "WHERE major_category IN ('일반주식', '주식') AND sub_category IN ('일반주식', '해외주식', '국내주식', '주식')"
            ))
            conn.execute(text(
                "UPDATE assets SET major_category = '주식', sub_category = '배당주' "
                "WHERE major_category = '배당주' OR sub_category IN ('배당주', '해외배당', '해외배당주', '국내배당주')"
            ))
            conn.execute(text(
                "UPDATE assets SET major_category = '현금', sub_category = '원화예수금' "
                "WHERE major_category = '현금' AND sub_category IN ('원화', '원화예수금', '현금')"
            ))
            conn.execute(text(
                "UPDATE assets SET major_category = '현금', sub_category = '달러예수금' "
                "WHERE major_category = '현금' AND sub_category IN ('달러', '달러예수금', '외화')"
            ))
            conn.execute(text(
                "UPDATE assets SET major_category = '채권', sub_category = '미국장기채' "
                "WHERE major_category = '채권' AND sub_category IN ('미국채', '미국장기채', '채권')"
            ))
            conn.commit()

    except Exception as e:
        logger.error(f"⚠️ 데이터베이스 마이그레이션 수행 중 오류 발생: {e}", exc_info=True)
        raise RuntimeError(f"데이터베이스 마이그레이션 실패: {e}") from e
