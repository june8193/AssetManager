# -*- coding: utf-8 -*-
"""AssetManager 백엔드 API와 통신하기 위한 HTTP 비동기 클라이언트 모듈입니다.
"""

import os
import httpx
from typing import Any, Dict, Optional

class ApiClient:
    """FastAPI 백엔드 서버와 통신하는 API 클라이언트 클래스입니다.
    """

    def __init__(self):
        # 환경 변수 MCP_BACKEND_URL 로부터 백엔드 서버 주소를 가져옴 (기본값: http://localhost:8000)
        self.base_url = os.environ.get("MCP_BACKEND_URL", "http://localhost:8000").rstrip("/")

    async def get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Any:
        """GET 요청을 비동기로 수행합니다.

        Args:
            endpoint: API 엔드포인트 경로 (예: '/api/dashboard/summary')
            params: 쿼리 매개변수 딕셔너리

        Returns:
            JSON 응답 결과 (dict 또는 list)
        """
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, params=params, timeout=10.0)
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                return {"error": f"HTTP 오류 발생 ({e.response.status_code}): {e.response.text}"}
            except httpx.RequestError as e:
                return {"error": f"네트워크 요청 오류 발생: {str(e)}"}
            except Exception as e:
                return {"error": f"API 호출 중 예외 발생: {str(e)}"}

    async def post(self, endpoint: str, json_data: Optional[Dict[str, Any]] = None) -> Any:
        """POST 요청을 비동기로 수행합니다.

        Args:
            endpoint: API 엔드포인트 경로 (예: '/api/dashboard/refresh')
            json_data: 본문에 실어 보낼 JSON 데이터 딕셔너리

        Returns:
            JSON 응답 결과 (dict 또는 list)
        """
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json=json_data, timeout=15.0)
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                return {"error": f"HTTP 오류 발생 ({e.response.status_code}): {e.response.text}"}
            except httpx.RequestError as e:
                return {"error": f"네트워크 요청 오류 발생: {str(e)}"}
            except Exception as e:
                return {"error": f"API 호출 중 예외 발생: {str(e)}"}

# 공용 싱글톤 인스턴스 생성
api_client = ApiClient()
