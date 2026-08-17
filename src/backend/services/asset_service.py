# -*- coding: utf-8 -*-
"""자산 마스터 관리 및 카테고리 불변식 검증을 담당하는 도메인 서비스 모듈입니다."""

from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session

from ..models import Asset, VALID_CATEGORIES
from .price_service import price_service


# 현금 자산 티커에 대한 기본 명칭 매핑
CASH_TICKER_NAMES = {
    "KRW": "원화예수금",
    "USD": "달러예수금",
}


class AssetService:
    """자산(Asset) 마스터의 생성, 조회, 수정, 삭제 및 도메인 유효성 검증을 캡슐화한 서비스 클래스입니다."""

    def __init__(self, db: Session):
        """AssetService를 초기화합니다.

        Args:
            db (Session): SQLAlchemy 데이터베이스 세션
        """
        self.db = db

    def get_all_assets(self) -> List[Asset]:
        """전체 자산 마스터 목록을 ID 내림차순으로 조회합니다.

        Returns:
            List[Asset]: 자산 마스터 목록
        """
        return self.db.query(Asset).order_by(Asset.id.desc()).all()

    def get_asset_by_id(self, asset_id: int) -> Optional[Asset]:
        """자산 식별자(ID)로 단일 자산을 조회합니다.

        Args:
            asset_id (int): 자산 식별자

        Returns:
            Optional[Asset]: 자산 객체 또는 None
        """
        return self.db.query(Asset).filter(Asset.id == asset_id).first()

    def get_asset_by_ticker(self, ticker: str) -> Optional[Asset]:
        """티커(Ticker)로 단일 자산을 조회합니다.

        Args:
            ticker (str): 자산 티커

        Returns:
            Optional[Asset]: 자산 객체 또는 None
        """
        return self.db.query(Asset).filter(Asset.ticker == ticker).first()

    def get_cash_asset(self, currency: str) -> Optional[Asset]:
        """지정된 통화(예: 'KRW', 'USD')에 해당하는 현금 자산을 조회합니다.

        Args:
            currency (str): 통화 코드 (예: 'KRW', 'USD')

        Returns:
            Optional[Asset]: 현금 자산 객체 또는 None
        """
        return self.get_asset_by_ticker(currency)

    def get_categories(self) -> Dict[str, List[str]]:
        """자산 대분류 및 중분류 허용 목록 매핑을 반환합니다.

        Returns:
            Dict[str, List[str]]: 대분류별 중분류 목록 딕셔너리
        """
        return VALID_CATEGORIES

    def validate_categories(self, major_category: str, sub_category: str) -> None:
        """자산의 대분류와 중분류가 유효한 조합인지 검증합니다.

        Args:
            major_category (str): 대분류 카테고리
            sub_category (str): 중분류 카테고리

        Raises:
            ValueError: 대분류 또는 중분류가 유효하지 않은 조합인 경우
        """
        if major_category not in VALID_CATEGORIES:
            raise ValueError(f"유효하지 않은 대분류입니다: {major_category}")
        if sub_category not in VALID_CATEGORIES[major_category]:
            raise ValueError(f"유효하지 않은 중분류입니다: '{major_category}' 대분류에는 '{sub_category}' 중분류를 사용할 수 없습니다.")

    def create_asset(
        self,
        ticker: str,
        name: str,
        major_category: str,
        sub_category: str,
        country: str = "KR",
    ) -> Asset:
        """새로운 자산 마스터를 생성하고 DB에 영속화합니다.

        Args:
            ticker (str): 자산 티커 또는 심볼
            name (str): 자산 명칭
            major_category (str): 대분류
            sub_category (str): 중분류
            country (str, optional): 국가 코드. Defaults to "KR".

        Returns:
            Asset: 생성된 자산 인스턴스

        Raises:
            ValueError: 티커가 중복되거나 카테고리 조합이 유효하지 않은 경우
        """
        # 1. 티커 중복 검증
        if self.get_asset_by_ticker(ticker) is not None:
            raise ValueError("이미 등록된 자산(티커)입니다.")

        # 2. 카테고리 계층 불변식 검증
        self.validate_categories(major_category, sub_category)

        # 3. 자산 객체 생성 및 저장
        db_asset = Asset(
            ticker=ticker,
            name=name,
            major_category=major_category,
            sub_category=sub_category,
            country=country,
        )
        self.db.add(db_asset)
        self.db.commit()
        self.db.refresh(db_asset)
        return db_asset

    def update_asset(
        self,
        asset_id: int,
        name: Optional[str] = None,
        major_category: Optional[str] = None,
        sub_category: Optional[str] = None,
        country: Optional[str] = None,
    ) -> Optional[Asset]:
        """기존 자산 마스터 정보를 수정합니다.

        Args:
            asset_id (int): 수정할 자산 식별자
            name (Optional[str]): 새로운 자산 명칭
            major_category (Optional[str]): 새로운 대분류
            sub_category (Optional[str]): 새로운 중분류
            country (Optional[str]): 새로운 국가 코드

        Returns:
            Optional[Asset]: 수정된 자산 객체. 자산이 없으면 None 반환

        Raises:
            ValueError: 카테고리 조합이 유효하지 않은 경우
        """
        db_asset = self.get_asset_by_id(asset_id)
        if not db_asset:
            return None

        new_major = major_category if major_category is not None else db_asset.major_category
        new_sub = sub_category if sub_category is not None else db_asset.sub_category

        # 카테고리 변경 시 불변식 검증
        self.validate_categories(new_major, new_sub)

        if name is not None:
            db_asset.name = name
        db_asset.major_category = new_major
        db_asset.sub_category = new_sub
        if country is not None:
            db_asset.country = country

        self.db.commit()
        self.db.refresh(db_asset)
        return db_asset

    def delete_asset(self, asset_id: int) -> bool:
        """자산 마스터를 삭제합니다.

        Args:
            asset_id (int): 삭제할 자산 식별자

        Returns:
            bool: 삭제 성공 시 True, 자산이 없으면 False
        """
        db_asset = self.get_asset_by_id(asset_id)
        if not db_asset:
            return False

        self.db.delete(db_asset)
        self.db.commit()
        return True

    async def verify_asset(self, ticker: str, country: str, major_category: str) -> Dict[str, str]:
        """티커와 국가를 기반으로 종목의 실시간 존재 여부를 검증하고 공식 자산명을 반환합니다.

        Args:
            ticker (str): 자산 티커
            country (str): 국가 코드 (KR, US)
            major_category (str): 대분류 카테고리

        Returns:
            Dict[str, str]: 공식 자산명 딕셔너리 (예: {"name": "삼성전자"})

        Raises:
            ValueError: 이미 등록된 자산이거나 지원하지 않는 현금 티커인 경우
            LookupError: 주식시장에서 종목을 찾을 수 없는 경우
        """
        # 1. 중복 등록 여부 검증
        if self.get_asset_by_ticker(ticker) is not None:
            raise ValueError("이미 등록된 자산(티커)입니다.")

        # 2. 현금 자산 처리
        if major_category == "현금":
            if ticker in CASH_TICKER_NAMES:
                return {"name": CASH_TICKER_NAMES[ticker]}
            raise ValueError("지원하지 않는 현금 티커입니다.")

        # 3. 주식 시장 실시간 종목명 조회
        name = await price_service.get_stock_name(ticker, country)
        if not name:
            raise LookupError("해당 국가의 주식시장에서 종목을 찾을 수 없습니다.")

        return {"name": name}


def update_asset_category(db: Session, asset_id: int, major_category: str, sub_category: str) -> Optional[Asset]:
    """자산의 카테고리를 업데이트하는 레거시 호환 래퍼 함수입니다.

    Args:
        db (Session): 데이터베이스 세션
        asset_id (int): 업데이트할 자산의 ID
        major_category (str): 새로운 대분류
        sub_category (str): 새로운 중분류

    Returns:
        Optional[Asset]: 업데이트된 자산 객체. 자산을 찾지 못한 경우 None을 반환합니다.
    """
    service = AssetService(db)
    return service.update_asset(
        asset_id=asset_id,
        major_category=major_category,
        sub_category=sub_category,
    )
