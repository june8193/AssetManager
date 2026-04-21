
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.backend.models import Base, Asset
from src.backend.services.asset_service import update_asset_category

# 테스트용 인메모리 DB 설정
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture
def db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

def test_update_asset_category(db):
    """자산 카테고리 업데이트 기능을 테스트합니다."""
    # 1. 초기 데이터 준비
    test_asset = Asset(
        id=16,
        ticker="TLT",
        name="iShares 20+ Year Treasury Bond ETF",
        major_category="일반주식",
        sub_category="해외주식",
        country="US"
    )
    db.add(test_asset)
    db.commit()

    # 2. 업데이트 실행
    updated_asset = update_asset_category(db, 16, "채권", "해외채권")

    # 3. 검증
    assert updated_asset is not None
    assert updated_asset.major_category == "채권"
    assert updated_asset.sub_category == "해외채권"
    
    # DB에서 다시 조회해서 확인
    db_asset = db.query(Asset).filter(Asset.id == 16).first()
    assert db_asset.major_category == "채권"
    assert db_asset.sub_category == "해외채권"
