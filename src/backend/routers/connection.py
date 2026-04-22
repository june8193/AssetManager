from fastapi import APIRouter, HTTPException
from src.kiwoom.api import KiwoomAPI
import logging
from typing import Dict, Any

router = APIRouter(
    prefix="/api/connection",
    tags=["connection"]
)

logger = logging.getLogger("ConnectionRouter")

@router.get("/test", response_model=Dict[str, Any])
async def test_api_connection():
    """키움증권 모든 계정의 연결 상태를 테스트하고 결과를 반환합니다.

    Returns:
        dict: 연결 성공 여부 및 상세 데이터를 포함한 딕셔너리
    
    Raises:
        HTTPException: API 호출 중 오류가 발생한 경우 500 에러를 반환합니다.
    """
    try:
        # settings.json 경로가 루트라고 가정 (uv run 실행 시)
        api = KiwoomAPI(settings_path="settings.json")
        results = api.check_all_connections()
        return {"status": "success", "data": results}
    except Exception as e:
        logger.error(f"연결 테스트 중 오류 발생: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"연결 테스트 중 오류가 발생했습니다: {str(e)}"
        )
