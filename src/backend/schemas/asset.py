"""자산 마스터 관련 Pydantic 스키마 정의."""

from pydantic import BaseModel, ConfigDict, model_validator
from typing import Optional
from ..models import VALID_CATEGORIES


class AssetSchema(BaseModel):
    """자산 마스터 정보를 담는 스키마입니다.

    Attributes:
        id (Optional[int]): 자산 식별자
        ticker (str): 티커 또는 심볼
        name (str): 자산 이름
        major_category (str): 대분류
        sub_category (str): 중분류
        country (str): 국가 코드 (KR, US 등)
    """
    model_config = ConfigDict(from_attributes=True)

    id: Optional[int] = None
    ticker: str
    name: str
    major_category: str
    sub_category: str
    country: str = "KR"

    @model_validator(mode='after')
    def validate_categories(self) -> 'AssetSchema':
        """대분류와 중분류의 조합이 유효한 범위 내에 있는지 검증합니다.
        
        Raises:
            ValueError: 유효하지 않은 카테고리 조합인 경우.
        """
        major = self.major_category
        sub = self.sub_category
        
        if major not in VALID_CATEGORIES:
            raise ValueError(f"유효하지 않은 대분류입니다: '{major}'. 허용 범위: {list(VALID_CATEGORIES.keys())}")
            
        valid_subs = VALID_CATEGORIES[major]
        if sub not in valid_subs:
            raise ValueError(f"유효하지 않은 카테고리 조합입니다: '{sub}'. 대분류 '{major}'에 허용된 중분류: {valid_subs}")
            
        return self
