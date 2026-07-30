from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import os
import json
import tomllib
import sys
from pathlib import Path

# 프로젝트 루트 디렉토리 및 설정 파일 경로 계산
BASE_DIR = Path(__file__).parent.parent.parent
SETTINGS_PATH = BASE_DIR / "settings.toml"

IS_TESTING = "pytest" in sys.modules

def load_database_url():
    """settings.toml 파일에서 데이터베이스 URL을 로드합니다."""
    # 1. 테스트 환경(pytest)인 경우 워커별 격리된 In-memory DB 사용
    if IS_TESTING:
        worker_id = os.getenv("PYTEST_XDIST_WORKER", "master")
        if worker_id != "master":
            return f"sqlite:///file:{worker_id}?mode=memory&cache=shared"
        return "sqlite:///:memory:"

    # 2. 개발 환경(APP_ENV=development)인 경우 개발용 DB 사용
    if os.getenv("APP_ENV") == "development":
        dev_db_path = BASE_DIR / "src" / "dev_assets.db"
        return f"sqlite:///{dev_db_path}"

    # 3. 기본값 설정 (운영용 DB)
    default_db_path = BASE_DIR / "src" / "assets.db"
    default_url = f"sqlite:///{default_db_path}"
    
    if not SETTINGS_PATH.exists():
        return default_url
        
    try:
        with open(SETTINGS_PATH, "rb") as f:
            settings = tomllib.load(f)
            return settings.get("database", {}).get("url", default_url)
    except Exception as e:
        print(f"⚠️ 설정 파일 로드 중 오류 발생, 기본 DB 사용: {e}")
        return default_url

# 데이터베이스 URL 설정
SQLALCHEMY_DATABASE_URL = load_database_url()

# SQLAlchemy 엔진 및 세션 설정
engine_kwargs = {"connect_args": {"check_same_thread": False, "timeout": 30}}
if IS_TESTING:
    engine_kwargs["poolclass"] = StaticPool
    if "file:" in SQLALCHEMY_DATABASE_URL:
        engine_kwargs["connect_args"]["uri"] = True

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, **engine_kwargs
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 모델 정의를 위한 Base 클래스
Base = declarative_base()

def get_db():
    """요청 당 독립적인 DB 세션을 생성하고 닫는 제너레이터 함수입니다."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
