# -*- coding: utf-8 -*-
"""자산 마스터 CRUD 및 카테고리 검증 전용 API 라우터 모듈입니다."""

from typing import List, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import AssetSchema
from ..services.asset_service import AssetService

router = APIRouter(
    prefix="/api/db",
    tags=["assets"]
)


def get_asset_service(db: Session = Depends(get_db)) -> AssetService:
    """AssetService 인스턴스를 주입하는 의존성 팩토리 함수입니다.

    Args:
        db (Session): 데이터베이스 세션

    Returns:
        AssetService: 데이터베이스 세션이 바인딩된 자산 서비스 인스턴스
    """
    return AssetService(db)


@router.get("/assets", response_model=List[AssetSchema])
def get_assets(service: AssetService = Depends(get_asset_service)):
    """전체 자산 마스터 목록을 조회합니다.

    Args:
        service (AssetService): 자산 도메인 서비스

    Returns:
        List[AssetSchema]: 자산 마스터 목록
    """
    return service.get_all_assets()


@router.get("/assets/categories", response_model=Dict[str, List[str]])
def get_categories(service: AssetService = Depends(get_asset_service)):
    """자산 대분류 및 중분류 목록을 조회합니다.

    Args:
        service (AssetService): 자산 도메인 서비스

    Returns:
        Dict[str, List[str]]: 대분류별 중분류 허용 목록 매핑
    """
    return service.get_categories()


@router.get("/assets/verify")
async def verify_asset(
    ticker: str,
    country: str,
    major_category: str,
    service: AssetService = Depends(get_asset_service)
):
    """티커와 국가를 기반으로 종목의 실시간 존재 여부를 검증하고 공식 자산명을 반환합니다.

    Args:
        ticker (str): 자산 티커
        country (str): 국가 코드 (KR, US)
        major_category (str): 대분류 카테고리
        service (AssetService): 자산 도메인 서비스

    Returns:
        Dict[str, str]: 공식 자산명

    Raises:
        HTTPException: 이미 등록된 자산이거나(400) 종목을 찾을 수 없는 경우(404)
    """
    try:
        return await service.verify_asset(
            ticker=ticker,
            country=country,
            major_category=major_category
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/assets", response_model=AssetSchema)
def create_asset(
    asset: AssetSchema,
    service: AssetService = Depends(get_asset_service)
):
    """새로운 자산 마스터를 생성합니다.

    Args:
        asset (AssetSchema): 생성할 자산 정보
        service (AssetService): 자산 도메인 서비스

    Returns:
        AssetSchema: 생성된 자산 정보

    Raises:
        HTTPException: 중복 티커 또는 유효하지 않은 카테고리인 경우 400
    """
    try:
        return service.create_asset(
            ticker=asset.ticker,
            name=asset.name,
            major_category=asset.major_category,
            sub_category=asset.sub_category,
            country=asset.country,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/assets/{asset_id}", response_model=AssetSchema)
def update_asset(
    asset_id: int,
    asset: AssetSchema,
    service: AssetService = Depends(get_asset_service)
):
    """기존 자산 마스터 정보를 수정합니다.

    Args:
        asset_id (int): 수정할 자산 식별자
        asset (AssetSchema): 수정할 자산 정보
        service (AssetService): 자산 도메인 서비스

    Returns:
        AssetSchema: 수정된 자산 정보

    Raises:
        HTTPException: 자산이 존재하지 않는 경우 404, 카테고리 오류 시 400
    """
    try:
        updated = service.update_asset(
            asset_id=asset_id,
            name=asset.name,
            major_category=asset.major_category,
            sub_category=asset.sub_category,
            country=asset.country,
        )
        if not updated:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="자산을 찾을 수 없습니다.")
        return updated
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/assets/{asset_id}")
def delete_asset(
    asset_id: int,
    service: AssetService = Depends(get_asset_service)
):
    """자산 마스터를 삭제합니다.

    Args:
        asset_id (int): 삭제할 자산 식별자
        service (AssetService): 자산 도메인 서비스

    Returns:
        dict: 삭제 완료 메시지

    Raises:
        HTTPException: 자산이 존재하지 않는 경우 404
    """
    deleted = service.delete_asset(asset_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="자산을 찾을 수 없습니다.")
    return {"message": "삭제되었습니다."}
