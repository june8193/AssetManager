
from sqlalchemy.orm import Session
from src.backend.models import Asset

def update_asset_category(db: Session, asset_id: int, major_category: str, sub_category: str) -> Asset:
    """자산의 카테고리를 업데이트합니다.
    
    Args:
        db (Session): 데이터베이스 세션
        asset_id (int): 업데이트할 자산의 ID
        major_category (str): 새로운 대분류
        sub_category (str): 새로운 중분류
        
    Returns:
        Asset: 업데이트된 자산 객체. 자산을 찾지 못한 경우 None을 반환합니다.
    """
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        return None
    
    asset.major_category = major_category
    asset.sub_category = sub_category
    
    db.commit()
    db.refresh(asset)
    return asset
