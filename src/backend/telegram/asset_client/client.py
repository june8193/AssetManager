# -*- coding: utf-8 -*-
"""AssetManager 로컬 REST API 통신을 전담하는 비동기 HTTP 게이트웨이 클라이언트 모듈입니다.

FastAPI 로컬 엔드포인트와의 세션, 타임아웃, 예외 변환 및 자동 응답 파싱을 담당합니다.
"""

import os
from typing import Any, NoReturn, Optional, Type, TypeVar
import httpx
from pydantic import BaseModel

from .models import AssetClientError

T = TypeVar("T", bound=BaseModel)


class AssetApiClient:
    """AssetManager 백엔드 API와의 세션, 타임아웃, 예외 변환 및 응답 파싱을 관장하는 클라이언트입니다."""

    def __init__(self, base_url: str | None = None, timeout: float = 30.0):
        """AssetApiClient 인스턴스를 초기화합니다.

        Args:
            base_url: AssetManager API 베이스 URL (생략 시 ASSET_MANAGER_API_URL 환경변수 또는 http://localhost:8000)
            timeout: HTTP 요청 타임아웃 초 (기본값: 30초)
        """
        self._base_url = base_url
        self.timeout = timeout

    def get_base_url(self) -> str:
        """설정 또는 환경변수로부터 베이스 URL을 결정하여 반환합니다.

        Returns:
            트레일링 슬래시가 제거된 베이스 URL 문자열
        """
        if self._base_url:
            return self._base_url.rstrip("/")
        env_url = os.getenv("ASSET_MANAGER_API_URL", "http://localhost:8000")
        return env_url.rstrip("/")

    def handle_exception(self, exc: Exception) -> NoReturn:
        """httpx 및 기타 통신 예외를 일관된 AssetClientError로 변환하여 발생시킵니다.

        Args:
            exc: 발생한 원본 예외 객체

        Raises:
            AssetClientError: 일관되게 정형화된 API 클라이언트 예외
        """
        if isinstance(exc, AssetClientError):
            raise exc
        elif isinstance(exc, httpx.HTTPStatusError):
            raise AssetClientError(
                f"AssetManager API 호출 실패 (HTTP 오류 코드: {exc.response.status_code})"
            ) from exc
        elif isinstance(exc, httpx.RequestError):
            raise AssetClientError(
                f"AssetManager API 서버 연결 네트워크 오류: {exc}"
            ) from exc
        else:
            raise AssetClientError(f"알 수 없는 오류 발생: {exc}") from exc

    async def get_json(
        self,
        endpoint: str,
        params: dict[str, Any] | None = None,
        response_model: Optional[Type[T]] = None,
    ) -> Any:
        """HTTP GET 요청을 수행하고 결과를 JSON 또는 Pydantic 모델로 변환하여 반환합니다.

        Args:
            endpoint: API 엔드포인트 경로 (예: '/api/dashboard/summary')
            params: URL 쿼리 파라미터 딕셔너리 (선택 사항)
            response_model: 자동 파싱할 Pydantic 모델 클래스 (선택 사항)

        Returns:
            Pydantic 모델 인스턴스 또는 JSON 파싱 데이터

        Raises:
            AssetClientError: API 호출 실패 또는 네트워크 오류 시 발생
        """
        base_url = self.get_base_url()
        url = f"{base_url}{endpoint}"

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()

                if response_model is not None:
                    return response_model.model_validate(data)
                return data
        except Exception as exc:
            self.handle_exception(exc)

    async def post_json(
        self,
        endpoint: str,
        params: dict[str, Any] | None = None,
        json_data: dict[str, Any] | None = None,
        response_model: Optional[Type[T]] = None,
    ) -> Any:
        """HTTP POST 요청을 수행하고 결과를 JSON 또는 Pydantic 모델로 변환하여 반환합니다.

        Args:
            endpoint: API 엔드포인트 경로
            params: URL 쿼리 파라미터 딕셔너리 (선택 사항)
            json_data: POST 요청 JSON 페이로드 (선택 사항)
            response_model: 자동 파싱할 Pydantic 모델 클래스 (선택 사항)

        Returns:
            Pydantic 모델 인스턴스 또는 JSON 파싱 데이터

        Raises:
            AssetClientError: API 호출 실패 또는 네트워크 오류 시 발생
        """
        base_url = self.get_base_url()
        url = f"{base_url}{endpoint}"

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, params=params, json=json_data)
                response.raise_for_status()
                data = response.json()

                if response_model is not None:
                    return response_model.model_validate(data)
                return data
        except Exception as exc:
            self.handle_exception(exc)


# 글로벌 기본 싱글톤 클라이언트 인스턴스
_default_client = AssetApiClient()


def get_default_client() -> AssetApiClient:
    """기본 싱글톤 AssetApiClient 인스턴스를 반환합니다.

    Returns:
        기본 설정된 AssetApiClient 객체
    """
    return _default_client
