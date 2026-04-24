from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import json
import sys
from pathlib import Path

# 프로젝트 루트 디렉토리 및 설정 파일 경로 계산
BASE_DIR = Path(__file__).parent.parent.parent
SETTINGS_PATH = BASE_DIR / "settings.json"

def load_database_url():
    """settings.json 파일에서 데이터베이스 URL을 로드합니다."""
    # 테스트 환경(pytest)인 경우 안전을 위해 별도의 테스트용 DB 파일 사용
    if "pytest" in sys.modules:
        return "sqlite:///./test_pytest.db"

    # 기본값 설정 (src/assets.db)
    default_db_path = BASE_DIR / "src" / "assets.db"
    default_url = f"sqlite:///{default_db_path}"
    
    if not SETTINGS_PATH.exists():
        return default_url
        
    try:
        with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
            settings = json.load(f)
            return settings.get("database", {}).get("url", default_url)
    except Exception as e:
        print(f"⚠️ 설정 파일 로드 중 오류 발생, 기본 DB 사용: {e}")
        return default_url

# 데이터베이스 URL 설정
SQLALCHEMY_DATABASE_URL = load_database_url()

# SQLAlchemy 엔진 및 세션 설정
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
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
