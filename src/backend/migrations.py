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

            # 레거시 자산 카테고리 표준화 마이그레이션 (assets 테이블이 존재하는 경우에만 실행)
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

            # 지출 관리 테이블 자동 생성 (Base.metadata.create_all 사용)
            from .models import PaymentMethod, ExpenseCategory, Expense
            from .database import Base
            Base.metadata.create_all(bind=engine)

            # 지출 마스터 기본 시드 적재
            seed_expense_masters(conn)

    except Exception as e:
        logger.error(f"⚠️ 데이터베이스 마이그레이션 수행 중 오류 발생: {e}", exc_info=True)
        raise RuntimeError(f"데이터베이스 마이그레이션 실패: {e}") from e


def seed_expense_masters(db_or_conn) -> None:
    """지출 관리의 기본 결제수단 및 카테고리 시드 데이터를 적재합니다.

    이미 존재하는 항목은 건너뛰며, 중복 적재되지 않습니다.

    Args:
        db_or_conn: SQLAlchemy Session 또는 Connection 객체
    """
    from sqlalchemy.orm import Session
    from .models import PaymentMethod, ExpenseCategory

    default_payment_methods = [
        {
            "owner": "장준",
            "institution": "카카오뱅크",
            "alias": "장준 카카오뱅크",
            "account_number": "3333",
            "is_active": True,
        },
        {
            "owner": "장준",
            "institution": "현대카드",
            "alias": "장준 현대카드",
            "account_number": "1002",
            "is_active": True,
        },
    ]

    default_categories = [
        {"name": "식비/카페", "color": "#FF6B6B", "is_default": True},
        {"name": "쇼핑", "color": "#4ECDC4", "is_default": True},
        {"name": "주거/통신", "color": "#45B7D1", "is_default": True},
        {"name": "교통/차량", "color": "#FFA07A", "is_default": True},
        {"name": "문화/여가", "color": "#98D8C8", "is_default": True},
        {"name": "의료/건강", "color": "#F7DC6F", "is_default": True},
        {"name": "금융/보험", "color": "#BB8FCE", "is_default": True},
        {"name": "생활/기타", "color": "#95A5A6", "is_default": True},
    ]

    if isinstance(db_or_conn, Session):
        session = db_or_conn
        # 결제수단 시드 적재
        for pm_data in default_payment_methods:
            exists = session.query(PaymentMethod).filter_by(
                owner=pm_data["owner"],
                institution=pm_data["institution"],
                account_number=pm_data["account_number"],
            ).first()
            if not exists:
                session.add(PaymentMethod(**pm_data))

        # 카테고리 시드 적재
        for cat_data in default_categories:
            exists = session.query(ExpenseCategory).filter_by(name=cat_data["name"]).first()
            if not exists:
                session.add(ExpenseCategory(**cat_data))

        session.commit()
    else:
        # Connection 객체인 경우 (text 쿼리 실행)
        for pm_data in default_payment_methods:
            row = db_or_conn.execute(
                text("SELECT id FROM payment_methods WHERE owner = :owner AND institution = :institution AND account_number = :account_number"),
                {"owner": pm_data["owner"], "institution": pm_data["institution"], "account_number": pm_data["account_number"]},
            ).fetchone()
            if not row:
                db_or_conn.execute(
                    text("INSERT INTO payment_methods (owner, institution, alias, account_number, is_active, created_at) "
                         "VALUES (:owner, :institution, :alias, :account_number, :is_active, datetime('now', 'localtime'))"),
                    pm_data,
                )

        for cat_data in default_categories:
            row = db_or_conn.execute(
                text("SELECT id FROM expense_categories WHERE name = :name"),
                {"name": cat_data["name"]},
            ).fetchone()
            if not row:
                db_or_conn.execute(
                    text("INSERT INTO expense_categories (name, color, is_default, created_at) "
                         "VALUES (:name, :color, :is_default, datetime('now', 'localtime'))"),
                    cat_data,
                )
        db_or_conn.commit()


