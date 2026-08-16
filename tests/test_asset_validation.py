import pytest
from src.backend.models import Asset
from src.backend.schemas import AssetSchema
from pydantic import ValidationError

def test_db_model_asset_category_validation_invalid_major(db_session):
    """DB 모델 수준에서 유효하지 않은 대분류 입력 시 ValueError가 발생해야 합니다."""
    with pytest.raises(ValueError) as excinfo:
        asset = Asset(
            ticker="TEST1",
            name="테스트 자산 1",
            major_category="잘못된대분류",
            sub_category="국내주식",
            country="KR"
        )
        db_session.add(asset)
        db_session.commit()
    db_session.rollback()
    assert "유효하지 않은 대분류" in str(excinfo.value)

def test_db_model_asset_category_validation_invalid_sub(db_session):
    """DB 모델 수준에서 유효하지 않은 중분류 입력 시 ValueError가 발생해야 합니다."""
    with pytest.raises(ValueError) as excinfo:
        asset = Asset(
            ticker="TEST2",
            name="테스트 자산 2",
            major_category="일반주식",
            sub_category="원화예수금",  # 일반주식의 중분류로는 유효하지 않음
            country="KR"
        )
        db_session.add(asset)
        db_session.commit()
    db_session.rollback()
    assert "유효하지 않은 중분류" in str(excinfo.value)

def test_db_model_asset_category_validation_valid(db_session):
    """DB 모델 수준에서 유효한 카테고리 조합은 정상적으로 저장되어야 합니다."""
    asset = Asset(
        ticker="TEST3",
        name="테스트 자산 3",
        major_category="채권",
        sub_category="미국장기채",
        country="US"
    )
    db_session.add(asset)
    db_session.commit()
    
    db_asset = db_session.query(Asset).filter_by(ticker="TEST3").first()
    assert db_asset is not None
    assert db_asset.major_category == "채권"
    assert db_asset.sub_category == "미국장기채"

def test_schema_asset_category_validation_invalid():
    """Pydantic 스키마 수준에서 유효하지 않은 카테고리 조합 입력 시 ValidationError가 발생해야 합니다."""
    with pytest.raises(ValidationError) as excinfo:
        AssetSchema(
            ticker="TEST4",
            name="테스트 자산 4",
            major_category="일반주식",
            sub_category="달러예수금",  # 달러예수금은 현금의 중분류임
            country="US"
        )
    assert "유효하지 않은 카테고리 조합" in str(excinfo.value)

def test_schema_asset_category_validation_valid():
    """Pydantic 스키마 수준에서 유효한 카테고리 조합은 에러 없이 생성되어야 합니다."""
    schema = AssetSchema(
        ticker="TEST5",
        name="테스트 자산 5",
        major_category="배당주",
        sub_category="해외배당주",
        country="US"
    )
    assert schema.major_category == "배당주"
    assert schema.sub_category == "해외배당주"
