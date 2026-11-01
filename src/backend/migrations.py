"""SQLite 데이터베이스 스키마 마이그레이션을 수행하는 모듈입니다."""

import logging
from pathlib import Path
from sqlalchemy import text, inspect
from sqlalchemy.engine import Engine
from alembic.config import Config
from alembic import command
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory

from .database import Base
from .services.backup_service import backup_database_file

logger = logging.getLogger(__name__)

# 프로젝트 루트 경로 (src/backend/migrations.py 기준 상위 3단계)
PROJECT_ROOT = Path(__file__).resolve().parents[2]

# Alembic 도입 시점의 최초 Baseline 리비전 해시
INITIAL_BASELINE_REVISION = "eaaefb394327"


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


def _get_alembic_config(engine: Engine) -> Config:
    """Alembic Config 객체를 생성하고 대상 엔진 URL 및 연결을 주입합니다.

    Args:
        engine (Engine): SQLAlchemy 엔진 객체

    Returns:
        Config: Alembic 설정 객체
    """
    ini_path = PROJECT_ROOT / "alembic.ini"
    cfg = Config(str(ini_path))
    cfg.set_main_option("sqlalchemy.url", str(engine.url))
    cfg.attributes["connection"] = engine
    return cfg


def _maybe_backup_database(engine: Engine, settings_path: str | Path = "settings.toml") -> None:
    """엔진이 디스크에 존재하는 파일 기반 SQLite 데이터베이스인 경우 사전 백업을 수행합니다.

    Args:
        engine (Engine): SQLAlchemy 엔진 객체
        settings_path (str | Path): 백업 설정 파일 경로
    """
    if engine.url.get_backend_name() != "sqlite":
        return

    db_file_str = engine.url.database
    if not db_file_str or db_file_str == ":memory:":
        return

    db_file = Path(db_file_str)
    if db_file.exists() and db_file.is_file():
        logger.info(f"마이그레이션 실행 전 사전 백업을 수행합니다: {db_file}")
        backup_database_file(db_file, settings_path=settings_path)


def _apply_legacy_schema_fixes(conn, engine: Engine) -> None:
    """Alembic 도입 이전 레거시 스키마의 멱등 보정 작업을 수행합니다.

    Args:
        conn: SQLAlchemy 커넥션 객체
        engine (Engine): SQLAlchemy 엔진 객체
    """
    # 1. historical_prices 누락 컬럼
    if _add_column_if_missing(conn, "historical_prices", "updated_at", "DATETIME"):
        conn.execute(text("UPDATE historical_prices SET updated_at = datetime('now', 'localtime')"))
        conn.commit()

    # 2. transactions 누락 컬럼 및 소스 기본값 보정
    if _add_column_if_missing(conn, "transactions", "source", "VARCHAR DEFAULT 'MANUAL'"):
        conn.execute(text("UPDATE transactions SET source = 'AUTO_KIWOOM' WHERE memo LIKE '%키움 자동저장%'"))
        conn.commit()

    conn.execute(text("UPDATE transactions SET source = 'MANUAL' WHERE source IS NULL"))
    conn.commit()

    _add_column_if_missing(conn, "transactions", "external_id", "VARCHAR")
    _add_column_if_missing(conn, "transactions", "target_asset_id", "INTEGER")
    _add_column_if_missing(conn, "transactions", "transfer_pair_id", "VARCHAR")
    conn.commit()

    # 3. 레거시 자산 카테고리 표준화 (assets 테이블이 존재하는 경우)
    assets_info = conn.execute(text("PRAGMA table_info(assets)")).fetchall()
    if assets_info:
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

    # 4. 불필요한 레거시 테이블 및 컬럼 정리
    conn.execute(text("DROP TABLE IF EXISTS expense_sub_categories"))
    conn.execute(text("DROP TABLE IF EXISTS allocation_settings"))
    try:
        conn.execute(text("ALTER TABLE expenses DROP COLUMN sub_category_id"))
    except Exception as e:
        logger.debug(f"expenses.sub_category_id 컬럼 삭제 건너뜁니다 (이미 삭제되었거나 미존재): {e}")
    conn.commit()

    # 5. Base.metadata.create_all을 통한 신규/누락 테이블 보완 (expense_rules, simulation_presets 등)
    Base.metadata.create_all(bind=engine)

    # 6. account_snapshots 유니크 인덱스 보장 (테이블 존재 시)
    snapshots_info = conn.execute(text("PRAGMA table_info(account_snapshots)")).fetchall()
    if snapshots_info:
        conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_account_snapshot_unique "
            "ON account_snapshots(account_id, snapshot_date)"
        ))
        conn.commit()

    # 7. 지출 마스터 no-op 호출
    seed_expense_masters(conn)


def run_migrations(engine: Engine, settings_path: str | Path = "settings.toml") -> None:
    """데이터베이스 스키마 마이그레이션을 안전하게 수행합니다.

    Alembic 리비전을 조회하여:
    1. 이미 최신 head이면 No-op으로 즉시 종료합니다.
    2. 빈 신규 DB이면 백업 없이 alembic upgrade head를 실행합니다.
    3. 기존 레거시 파일 DB이면 사전 백업을 생성하고, 레거시 보정 로직을 수행한 뒤 초기 baseline으로 stamp 및 head 업그레이드합니다.
    4. 구버전 리비전의 파일 DB이면 사전 백업을 생성한 뒤 alembic upgrade head를 실행합니다.

    Args:
        engine (Engine): SQLAlchemy 엔진 객체
        settings_path (str | Path, optional): 백업 설정 파일 경로. Defaults to "settings.toml".

    Raises:
        RuntimeError: 데이터베이스 마이그레이션 실행 중 실패 시
    """
    try:
        cfg = _get_alembic_config(engine)
        script = ScriptDirectory.from_config(cfg)
        head_rev = script.get_current_head()
        bases = script.get_bases()
        baseline_rev = bases[0] if bases else INITIAL_BASELINE_REVISION

        # 대상 DB의 현재 리비전 및 기존 도메인 테이블 존재 여부 확인
        with engine.connect() as conn:
            mc = MigrationContext.configure(conn)
            current_rev = mc.get_current_revision()
            inspector = inspect(conn)
            existing_tables = set(inspector.get_table_names())

        has_domain_tables = bool(existing_tables.intersection({"users", "accounts", "transactions"}))

        # 1. 이미 최신 head인 경우: No-op
        if current_rev is not None and current_rev == head_rev:
            logger.info(f"데이터베이스가 이미 최신 리비전({current_rev})입니다. 마이그레이션을 건너뜁니다.")
            return

        # 2. 신규 빈 DB: 도메인 테이블도 없고 alembic_version도 없는 경우
        if current_rev is None and not has_domain_tables:
            logger.info("신규 빈 데이터베이스가 감지되었습니다. 최신 리비전으로 초기화합니다.")
            command.upgrade(cfg, "head")
            return

        # 3. 레거시 DB: alembic_version은 없으나 기존 도메인 테이블이 있는 경우
        if current_rev is None and has_domain_tables:
            logger.info("Alembic 이전 레거시 데이터베이스가 감지되었습니다. 마이그레이션을 준비합니다.")
            # 파일 DB인 경우 사전 백업
            _maybe_backup_database(engine, settings_path=settings_path)

            # 멱등 보정 수행
            with engine.connect() as conn:
                _apply_legacy_schema_fixes(conn, engine)

            # Baseline 리비전으로 stamp 후 최신으로 upgrade
            command.stamp(cfg, baseline_rev)
            if baseline_rev != head_rev:
                command.upgrade(cfg, "head")
            logger.info(f"레거시 데이터베이스 마이그레이션 완료 (리비전: {head_rev}).")
            return

        # 4. 구버전 버전 관리 DB: current_rev != head_rev
        logger.info(f"데이터베이스 업그레이드가 필요합니다 (현재: {current_rev} -> 최신: {head_rev}).")
        _maybe_backup_database(engine, settings_path=settings_path)
        command.upgrade(cfg, "head")
        logger.info(f"데이터베이스 업그레이드 완료 (리비전: {head_rev}).")

    except Exception as e:
        logger.error(f"⚠️ 데이터베이스 마이그레이션 수행 중 오류 발생: {e}", exc_info=True)
        raise RuntimeError(f"데이터베이스 마이그레이션 실패: {e}") from e


def seed_expense_masters(db_or_conn=None) -> None:
    """지출 관리 마스터(결제수단, 카테고리) 시드 데이터를 적재하지 않습니다.

    사용자가 화면에서 등록/수정/삭제한 상태를 그대로 보존하기 위해
    자동 시딩 로직을 완전히 비활성화(no-op)했습니다.

    Args:
        db_or_conn: 호환성을 위한 선택적 매개변수 (미사용)
    """
    pass
