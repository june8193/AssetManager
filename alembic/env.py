"""Alembic 데이터베이스 마이그레이션 환경 설정 모듈."""

from logging.config import fileConfig

from sqlalchemy import pool, create_engine
from alembic import context

from src.backend.database import load_database_url
from src.backend.models import Base

# Alembic Config 객체 (alembic.ini 설정값 참조)
config = context.config

# 파이썬 로깅 설정 적용 (기존 로거가 비활성화되지 않도록 보장)
if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

# autogenerate 비교를 위한 모델 메타데이터
target_metadata = Base.metadata


def get_url() -> str:
    """데이터베이스 URL을 로드합니다.
    
    Alembic 설정에 'sqlalchemy.url'이 명시되어 있으면 우선 사용하고,
    그렇지 않으면 애플리케이션의 load_database_url()을 호출하여 환경에 맞는 URL을 동적으로 로드합니다.
    """
    url = config.get_main_option("sqlalchemy.url")
    if not url:
        url = load_database_url()
        config.set_main_option("sqlalchemy.url", url)
    return url


def run_migrations_offline() -> None:
    """오프라인 모드에서 마이그레이션을 실행합니다.
    
    데이터베이스 엔진 연결 없이 SQL 스크립트 형태로 쿼리를 생성하여 출력합니다.
    """
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """온라인 모드에서 마이그레이션을 실행합니다.
    
    실제 데이터베이스 엔진에 연결하여 트랜잭션 내에서 스키마 변경을 적용합니다.
    프로그래매틱 호출로 connection이 전달된 경우 이를 우선 재사용합니다.
    """
    connectable = config.attributes.get("connection", None)

    if connectable is None:
        url = get_url()
        connectable = create_engine(
            url,
            poolclass=pool.NullPool,
            connect_args={"check_same_thread": False, "timeout": 30} if "sqlite" in url else {},
        )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
