import pytest
from src.backend.models import TargetRatio
from sqlalchemy.orm import Session

def test_create_target_ratio(db_session: Session):
    """목표 비중 데이터를 생성하고 저장하는 기능을 테스트합니다."""
    # 1. 테스트 데이터 정의
    new_ratio = TargetRatio(
        category_name="일반주식",
        category_type="major",
        target_percentage=40.0
    )
    
    # 2. DB 저장
    db_session.add(new_ratio)
    db_session.commit()
    db_session.refresh(new_ratio)
    
    # 3. 검증
    assert new_ratio.id is not None
    assert new_ratio.category_name == "일반주식"
    assert new_ratio.category_type == "major"
    assert new_ratio.target_percentage == 40.0
    assert new_ratio.parent_category is None
    assert new_ratio.updated_at is not None

def test_create_sub_category_ratio(db_session: Session):
    """하위 카테고리(중분류) 목표 비중 데이터를 생성합니다."""
    # 1. 테스트 데이터 정의
    sub_ratio = TargetRatio(
        category_name="해외주식",
        category_type="sub",
        target_percentage=50.0,
        parent_category="일반주식"
    )
    
    # 2. DB 저장
    db_session.add(sub_ratio)
    db_session.commit()
    db_session.refresh(sub_ratio)
    
    # 3. 검증
    assert sub_ratio.category_name == "해외주식"
    assert sub_ratio.parent_category == "일반주식"
    assert sub_ratio.category_type == "sub"
