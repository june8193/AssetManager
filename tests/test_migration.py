"""DB 마이그레이션 로직에 대한 단위 테스트 모듈입니다."""

import pytest
from unittest.mock import MagicMock
from sqlalchemy import create_engine, text
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

