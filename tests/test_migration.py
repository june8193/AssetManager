"""DB 마이그레이션 로직에 대한 단위 테스트 모듈입니다."""

import pytest
from unittest.mock import MagicMock
from pathlib import Path
from sqlalchemy import create_engine, text, inspect
from alembic.config import Config
from alembic.script import ScriptDirectory
from alembic.migration import MigrationContext
from src.backend.migrations import run_migrations, _add_column_if_missing


def test_migration_adds_target_asset_id_column():
    """target_asset_id 컬럼이 누락된 transactions 테이블에 target_asset_id 컬럼이 자동 추가되는지 테스트합니다."""
    engine = create_engine("sqlite:///:memory:")

    with engine.connect() as conn:
        # target_asset_id가 없는 transactions 구버전 테이블 생성
        conn.execute(text("""
            CREATE TABLE transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER NOT NULL,
                asset_id INTEGER NOT NULL,
                transaction_date DATE NOT NULL,
                type VARCHAR NOT NULL,
                quantity FLOAT DEFAULT 0.0,
                price FLOAT DEFAULT 0.0,
                total_amount FLOAT NOT NULL,
                currency VARCHAR NOT NULL,
                exchange_rate FLOAT,
                memo VARCHAR
            )
        """))
        conn.commit()

    # 마이그레이션 실행
    run_migrations(engine)

    # 테이블 정보 조회하여 target_asset_id 컬럼 존재 여부 확인
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(transactions)")).fetchall()
        columns = [row[1] for row in result]
        assert "target_asset_id" in columns
        assert "source" in columns
        assert "external_id" in columns


def _create_transactions_table(conn, include_source: bool = False):
    """테스트용 transactions 구버전/신버전 테이블을 생성하는 헬퍼 함수입니다."""
    source_col = ", source VARCHAR" if include_source else ""
    conn.execute(text(f"""
        CREATE TABLE transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            asset_id INTEGER NOT NULL,
            transaction_date DATE NOT NULL,
            type VARCHAR NOT NULL,
            total_amount FLOAT NOT NULL,
            currency VARCHAR NOT NULL,
            memo VARCHAR
            {source_col}
        )
    """))


def test_migration_updates_source_column_for_kiwoom_memo():
    """source 컬럼 추가 시 '키움 자동저장' 메모 거래는 AUTO_KIWOOM으로, NULL 레코드는 MANUAL로 보정되는지 테스트합니다."""
    engine = create_engine("sqlite:///:memory:")

    with engine.connect() as conn:
        _create_transactions_table(conn, include_source=False)
        # 1. 키움 자동저장 메모 건
        conn.execute(text("""
            INSERT INTO transactions (account_id, asset_id, transaction_date, type, total_amount, currency, memo)
            VALUES (1, 1, '2026-08-03', 'BUY', 10000.0, 'KRW', '키움 자동저장 (체결)')
        """))
        # 2. 기존 수동 거래 건 (source 컬럼이 없던 시점의 NULL 데이터)
        conn.execute(text("""
            INSERT INTO transactions (account_id, asset_id, transaction_date, type, total_amount, currency, memo)
            VALUES (1, 1, '2026-08-03', 'BUY', 20000.0, 'KRW', '일반 수동 입력')
        """))
        conn.commit()

    run_migrations(engine)

    with engine.connect() as conn:
        rows = conn.execute(text("SELECT memo, source FROM transactions ORDER BY id ASC")).fetchall()
        assert len(rows) == 2
        assert rows[0][1] == "AUTO_KIWOOM"
        assert rows[1][1] == "MANUAL"


def test_migration_fixes_existing_null_source_even_if_column_exists():
    """source 컬럼이 이미 존재하는 상태에서 NULL 값이 들어있는 레코드도 MANUAL로 보정되는지 테스트합니다."""
    engine = create_engine("sqlite:///:memory:")

    with engine.connect() as conn:
        _create_transactions_table(conn, include_source=True)
        conn.execute(text("""
            INSERT INTO transactions (account_id, asset_id, transaction_date, type, total_amount, currency, memo, source)
            VALUES (1, 1, '2026-08-03', 'BUY', 30000.0, 'KRW', '잔존 NULL 테스팅', NULL)
        """))
        conn.commit()

    run_migrations(engine)

    with engine.connect() as conn:
        rows = conn.execute(text("SELECT source FROM transactions")).fetchall()
        assert len(rows) == 1
        assert rows[0][0] == "MANUAL"


def test_migration_failure_raises_runtime_error():
    """DB 커넥션이나 쿼리 수행 중 예외 발생 시 RuntimeError가 발생하는지 테스트합니다."""
    mock_engine = MagicMock()
    mock_engine.connect.side_effect = Exception("DB Connection Refused")

    with pytest.raises(RuntimeError) as exc_info:
        run_migrations(mock_engine)

    assert "데이터베이스 마이그레이션 실패" in str(exc_info.value)


def test_alembic_schema_matches_models_metadata(tmp_path):
    """임시 SQLite DB에서 Alembic upgrade head를 실행한 후 Base.metadata와 비교 시 스키마 차이가 없음을 검증합니다."""
    from alembic import command
    from alembic.autogenerate import compare_metadata
    from src.backend.models import Base

    db_file = tmp_path / "test_migration.db"
    db_url = f"sqlite:///{db_file}"

    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", db_url)

    # upgrade head 실행
    command.upgrade(cfg, "head")

    # compare_metadata로 검증
    engine = create_engine(db_url)
    with engine.connect() as conn:
        opts = {
            "compare_type": True,
            "render_as_batch": True,
        }
        mc = MigrationContext.configure(conn, opts=opts)
        diff = compare_metadata(mc, Base.metadata)
        assert diff == [], f"스키마 드리프트 발생: {diff}"


def test_run_migrations_on_empty_db_initializes_head_without_backup(tmp_path):
    """신규 빈 DB에 대해 run_migrations 실행 시 백업 없이 upgrade head가 실행되어 테이블과 alembic_version이 생성되는지 검증합니다."""
    db_file = tmp_path / "new_empty.db"
    backup_dir = tmp_path / "backups"
    settings_file = tmp_path / "settings.toml"
    settings_file.write_text(f'[backup]\npath = "{backup_dir.as_posix()}"\n')

    engine = create_engine(f"sqlite:///{db_file}")

    run_migrations(engine, settings_path=settings_file)

    # 백업 파일이 생성되지 않아야 함
    backups = list(backup_dir.glob("assets_*.db")) if backup_dir.exists() else []
    assert len(backups) == 0

    # 테이블 및 alembic_version 확인
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    assert "users" in tables
    assert "accounts" in tables
    assert "transactions" in tables
    assert "alembic_version" in tables

    cfg = Config("alembic.ini")
    script = ScriptDirectory.from_config(cfg)
    head_rev = script.get_current_head()

    with engine.connect() as conn:
        mc = MigrationContext.configure(conn)
        assert mc.get_current_revision() == head_rev


def test_run_migrations_on_legacy_db_creates_backup_and_upgrades_to_head(tmp_path):
    """alembic_version이 없는 기존 레거시 DB에 대해 run_migrations 실행 시 사전 백업 생성, 스키마 보정 및 head 업그레이드를 검증합니다."""
    db_file = tmp_path / "legacy.db"
    backup_dir = tmp_path / "backups"
    settings_file = tmp_path / "settings.toml"
    settings_file.write_text(f'[backup]\npath = "{backup_dir.as_posix()}"\n')

    engine = create_engine(f"sqlite:///{db_file}")

    with engine.connect() as conn:
        # 1. users 테이블
        conn.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY, username VARCHAR, email VARCHAR, hashed_password VARCHAR, is_active BOOLEAN, is_superuser BOOLEAN)"))
        # 2. accounts 테이블
        conn.execute(text("CREATE TABLE accounts (id INTEGER PRIMARY KEY, user_id INTEGER, name VARCHAR, account_number VARCHAR, broker VARCHAR, account_type VARCHAR, memo VARCHAR, is_active BOOLEAN, created_at DATETIME, updated_at DATETIME)"))
        # 3. transactions 레거시 테이블
        conn.execute(text("""
            CREATE TABLE transactions (
                id INTEGER PRIMARY KEY,
                account_id INTEGER,
                asset_id INTEGER,
                transaction_date DATE,
                type VARCHAR,
                quantity FLOAT,
                price FLOAT,
                total_amount FLOAT,
                currency VARCHAR,
                exchange_rate FLOAT,
                memo VARCHAR
            )
        """))
        conn.execute(text("INSERT INTO transactions (id, account_id, asset_id, transaction_date, type, total_amount, currency, memo) VALUES (1, 1, 1, '2026-01-01', 'BUY', 1000.0, 'KRW', '키움 자동저장 거래')"))
        # 4. allocation_settings 레거시 테이블 (제거되어야 함)
        conn.execute(text("CREATE TABLE allocation_settings (id INTEGER PRIMARY KEY, category VARCHAR, target_ratio FLOAT)"))
        conn.execute(text("INSERT INTO allocation_settings (id, category, target_ratio) VALUES (1, 'STOCK', 0.5)"))
        # 5. account_snapshots 레거시 테이블
        conn.execute(text("""
            CREATE TABLE account_snapshots (
                id INTEGER PRIMARY KEY,
                account_id INTEGER,
                snapshot_date DATE,
                total_asset_krw FLOAT,
                cash_krw FLOAT,
                stock_krw FLOAT,
                created_at DATETIME,
                period_deposit FLOAT DEFAULT 0.0,
                period_withdrawal FLOAT DEFAULT 0.0
            )
        """))
        conn.commit()

    # 실행 전 백업 디렉토리에 백업 없음
    assert not backup_dir.exists() or len(list(backup_dir.glob("assets_*.db"))) == 0

    run_migrations(engine, settings_path=settings_file)

    # 1. 사전 백업 파일이 생성되었는지 확인
    backups = list(backup_dir.glob("assets_*.db"))
    assert len(backups) == 1

    # 2. allocation_settings 테이블이 제거되었는지 확인
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    assert "allocation_settings" not in tables

    # 3. transactions 테이블 보정 및 기존 데이터 보존 확인
    with engine.connect() as conn:
        row = conn.execute(text("SELECT id, memo, source, target_asset_id FROM transactions WHERE id = 1")).fetchone()
        assert row is not None
        assert row[0] == 1
        assert "키움 자동저장 거래" in row[1]
        assert row[2] == "AUTO_KIWOOM"

        # 4. idx_account_snapshot_unique 유니크 인덱스 확인
        indices = conn.execute(text("PRAGMA index_list('account_snapshots')")).fetchall()
        unique_index_names = [idx[1] for idx in indices if idx[2] == 1]
        assert "idx_account_snapshot_unique" in unique_index_names

        # 5. alembic_version이 최신 head인지 확인
        mc = MigrationContext.configure(conn)
        cfg = Config("alembic.ini")
        script = ScriptDirectory.from_config(cfg)
        head_rev = script.get_current_head()
        assert mc.get_current_revision() == head_rev


def test_run_migrations_already_at_head_skips_backup(tmp_path):
    """이미 최신 head 리비전인 DB에 대해 run_migrations 재실행 시 백업을 건너뛰고 No-op으로 즉시 종료되는지 검증합니다."""
    db_file = tmp_path / "uptodate.db"
    backup_dir = tmp_path / "backups"
    settings_file = tmp_path / "settings.toml"
    settings_file.write_text(f'[backup]\npath = "{backup_dir.as_posix()}"\n')

    engine = create_engine(f"sqlite:///{db_file}")

    # 최초 1회 실행하여 head 상태로 생성
    run_migrations(engine, settings_path=settings_file)
    initial_backups = list(backup_dir.glob("assets_*.db")) if backup_dir.exists() else []
    assert len(initial_backups) == 0

    # 재실행: 이미 head 상태이므로 백업이나 변경 없이 통과해야 함
    run_migrations(engine, settings_path=settings_file)
    after_backups = list(backup_dir.glob("assets_*.db")) if backup_dir.exists() else []
    assert len(after_backups) == 0


def test_run_migrations_outdated_revision_creates_backup_and_upgrades(tmp_path):
    """현재 리비전이 최신 head가 아닌 구버전인 경우 사전 백업이 수행되고 upgrade head가 호출되는지 검증합니다."""
    from unittest.mock import patch

    db_file = tmp_path / "outdated.db"
    backup_dir = tmp_path / "backups"
    settings_file = tmp_path / "settings.toml"
    settings_file.write_text(f'[backup]\npath = "{backup_dir.as_posix()}"\n')

    engine = create_engine(f"sqlite:///{db_file}")

    # 먼저 alembic_version 테이블과 구버전 리비전 데이터 생성
    with engine.connect() as conn:
        conn.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
        conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('outdated_dummy_rev')"))
        conn.commit()

    with patch("src.backend.migrations.command.upgrade") as mock_upgrade:
        run_migrations(engine, settings_path=settings_file)

        # 1. 사전 백업이 수행되었는지 확인
        backups = list(backup_dir.glob("assets_*.db"))
        assert len(backups) == 1

        # 2. upgrade head가 호출되었는지 확인
        mock_upgrade.assert_called_once()
        args, kwargs = mock_upgrade.call_args
        assert args[1] == "head"

