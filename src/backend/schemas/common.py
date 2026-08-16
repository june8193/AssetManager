"""공통 Pydantic 스키마 정의."""

from pydantic import BaseModel
from typing import Optional, Any


class MessageResponse(BaseModel):
    """표준 메시지 응답 스키마입니다."""
    message: str
    detail: Optional[Any] = None
