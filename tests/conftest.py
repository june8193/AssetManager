import pytest
import os
from fastapi.testclient import TestClient
from src.backend.database import Base, engine, SessionLocal, get_db
from src.backend.main import app

@pytest.fixture
def client():
    """FastAPI TestClient 픽스처를 제공합니다."""
    return TestClient(app)

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """모든 테스트 실행 전 테이블을 생성하고 종료 후 삭제합니다.
    
    안전장치: 엔진 URL에 'assets.db'가 포함되어 있으면 실행을 중단합니다.
    """
    db_url = str(engine.url)
    if "assets.db" in db_url:
        raise RuntimeError(f"⚠️ CRITICAL: 테스트 엔진이 운영 DB(assets.db)를 바라보고 있습니다 ({db_url}). 작업을 중단합니다.")

    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    engine.dispose()

@pytest.fixture(autouse=True)
def db_session():
    """테스트마다 In-memory DB 테이블을 새로 생성하고 종료 후 닫습니다.
    
    In-memory SQLite 환경에서는 create_all/drop_all이 수 밀리초 만에 수행되어 극도로 빠르고 격리가 완벽합니다.
    """
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(autouse=True)
def override_get_db(db_session):
    """FastAPI의 get_db 의존성을 테스트용 세션으로 교체합니다."""
    def _override_get_db():
        try:
            yield db_session
        finally:
            pass
            
    app.dependency_overrides[get_db] = _override_get_db
    yield
    app.dependency_overrides.clear()
