import pytest
import os
from src.backend.database import Base, engine, SessionLocal, get_db
from src.backend.main import app

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """모든 테스트 실행 전 테이블을 생성하고 종료 후 삭제합니다.
    
    안전장치: 엔진 URL에 'assets.db'가 포함되어 있으면 실행을 중단합니다.
    """
    # database.py에서 pytest 실행 중일 때 이미 test_pytest.db로 강제 전환했으므로 안전함
    db_url = str(engine.url)
    if "assets.db" in db_url:
        raise RuntimeError(f"⚠️ CRITICAL: 테스트 엔진이 운영 DB(assets.db)를 바라보고 있습니다 ({db_url}). 작업을 중단합니다.")
    
    if "test_pytest.db" not in db_url:
         raise RuntimeError(f"⚠️ CRITICAL: 테스트 엔진이 예상치 못한 DB를 바라보고 있습니다 ({db_url}).")

    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    
    # 테스트 종료 후 파일 삭제
    try:
        if os.path.exists("test_pytest.db"):
            os.remove("test_pytest.db")
    except Exception as e:
        print(f"⚠️ 테스트 DB 파일 삭제 실패: {e}")

@pytest.fixture(autouse=True)
def db_session():
    """테스트에서 사용할 독립적인 DB 세션을 제공하고 종료 후 닫습니다.
    
    각 테스트마다 데이터를 초기화하기 위해 매번 테이블의 데이터를 비웁니다.
    """
    session = SessionLocal()
    try:
        yield session
    finally:
        # 각 테스트 종료 후 데이터 정리 (테이블은 유지)
        for table in reversed(Base.metadata.sorted_tables):
            session.execute(table.delete())
        session.commit()
        session.close()

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
