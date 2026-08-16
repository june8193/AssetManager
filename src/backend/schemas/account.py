"""계좌 및 사용자 관련 Pydantic 스키마 정의."""

from pydantic import BaseModel, ConfigDict
from typing import Optional


class UserSchema(BaseModel):
    """사용자 정보를 담는 스키마입니다."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class AccountSchema(BaseModel):
    """계좌 정보를 담는 스키마입니다.

    Attributes:
        id (Optional[int]): 계좌 식별자 (생성 시 생략 가능)
        user_id (int): 사용자 식별자 (FK)
        user_name (Optional[str]): 사용자 이름 (추가)
        name (str): 계좌 이름/번호
        provider (str): 금융 기관 이름
        alias (Optional[str]): 계좌 별칭
        account_type (str): 계좌 종류 (BROKERAGE, BANK)
        is_active (bool): 계좌 활성 여부
    """
    model_config = ConfigDict(from_attributes=True)

    id: Optional[int] = None
    user_id: int
    user_name: Optional[str] = None
    name: str
    provider: str
    alias: Optional[str] = None
    account_type: str = "BROKERAGE"
    is_active: bool = True
