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


def test_migration_failure_raises_runtime_error():
    """DB 커넥션이나 쿼리 수행 중 예외 발생 시 RuntimeError가 발생하는지 테스트합니다."""
    mock_engine = MagicMock()
    mock_engine.connect.side_effect = Exception("DB Connection Refused")

    with pytest.raises(RuntimeError) as exc_info:
        run_migrations(mock_engine)

    assert "데이터베이스 마이그레이션 실패" in str(exc_info.value)
