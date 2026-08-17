# -*- coding: utf-8 -*-
"""AssetService 도메인 서비스 및 비즈니스 불변식 단위 테스트입니다."""

import pytest
from unittest.mock import AsyncMock, patch

from src.backend.models import Asset, VALID_CATEGORIES
from src.backend.services.asset_service import AssetService, update_asset_category


def test_asset_service_crud_lifecycle(db_session):
    """AssetService의 생성, 조회, 수정, 삭제 전체 생명주기를 검증합니다."""
    service = AssetService(db_session)

    # 1. 자산 생성
    created = service.create_asset(
        ticker="005930",
        name="삼성전자",
        major_category="일반주식",
        sub_category="국내주식",
        country="KR"
    )
    assert created.id is not None
    assert created.ticker == "005930"
    assert created.name == "삼성전자"
    assert created.major_category == "일반주식"
    assert created.sub_category == "국내주식"

    # 2. ID 및 Ticker 기반 조회
    by_id = service.get_asset_by_id(created.id)
    assert by_id is not None
    assert by_id.ticker == "005930"

    by_ticker = service.get_asset_by_ticker("005930")
    assert by_ticker is not None
    assert by_ticker.id == created.id

    # 3. 전체 목록 조회
    all_assets = service.get_all_assets()
    assert len(all_assets) == 1
    assert all_assets[0].ticker == "005930"

    # 4. 자산 수정 (배당주로 변경)
    updated = service.update_asset(
        asset_id=created.id,
        name="삼성전자(수정)",
        major_category="배당주",
        sub_category="국내배당주"
    )
    assert updated is not None
    assert updated.name == "삼성전자(수정)"
    assert updated.major_category == "배당주"
    assert updated.sub_category == "국내배당주"

    # 5. 자산 삭제
    deleted = service.delete_asset(created.id)
    assert deleted is True
    assert service.get_asset_by_id(created.id) is None
    assert service.delete_asset(99999) is False


def test_asset_service_duplicate_ticker_rejection(db_session):
    """동일한 티커로 중복 자산 생성을 시도할 경우 ValueError 예외가 발생하는지 검증합니다."""
    service = AssetService(db_session)

    service.create_asset(
        ticker="AAPL",
        name="애플",
        major_category="일반주식",
        sub_category="해외주식",
        country="US"
    )

    with pytest.raises(ValueError) as excinfo:
        service.create_asset(
            ticker="AAPL",
            name="애플 중복",
            major_category="일반주식",
            sub_category="해외주식",
            country="US"
        )
    assert "이미 등록된 자산(티커)입니다" in str(excinfo.value)


def test_asset_service_invalid_category_combination_rejection(db_session):
    """유효하지 않은 대분류/중분류 카테고리 조합으로 생성 및 수정 시 ValueError가 발생하는지 검증합니다."""
    service = AssetService(db_session)

    # 1. 생성 시 잘못된 대분류
    with pytest.raises(ValueError) as excinfo:
        service.create_asset(
            ticker="TEST1",
            name="테스트1",
            major_category="가상화폐",
            sub_category="비트코인",
            country="KR"
        )
    assert "유효하지 않은 대분류" in str(excinfo.value)

    # 2. 생성 시 잘못된 중분류
    with pytest.raises(ValueError) as excinfo:
        service.create_asset(
            ticker="TEST2",
            name="테스트2",
            major_category="일반주식",
            sub_category="원화예수금",
            country="KR"
        )
    assert "유효하지 않은 중분류" in str(excinfo.value)

    # 3. 유효하게 생성 후 수정 시 잘못된 중분류
    asset = service.create_asset(
        ticker="TEST3",
        name="테스트3",
        major_category="채권",
        sub_category="한국장기채",
        country="KR"
    )

    with pytest.raises(ValueError) as excinfo:
        service.update_asset(
            asset_id=asset.id,
            major_category="채권",
            sub_category="해외주식"
        )
    assert "유효하지 않은 중분류" in str(excinfo.value)


def test_asset_service_cash_asset_helpers(db_session):
    """현금 자산(KRW, USD) 조회 헬퍼 및 카테고리 목록 반환을 검증합니다."""
    service = AssetService(db_session)

    # 현금 자산 미등록 시 None
    assert service.get_cash_asset("KRW") is None

    # KRW 자산 등록
    krw = service.create_asset(
        ticker="KRW",
        name="원화예수금",
        major_category="현금",
        sub_category="원화예수금",
        country="KR"
    )
    assert service.get_cash_asset("KRW") is not None
    assert service.get_cash_asset("KRW").id == krw.id

    # USD 자산 등록
    usd = service.create_asset(
        ticker="USD",
        name="달러예수금",
        major_category="현금",
        sub_category="달러예수금",
        country="US"
    )
    assert service.get_cash_asset("USD") is not None
    assert service.get_cash_asset("USD").id == usd.id

    # 카테고리 맵 조회
    categories = service.get_categories()
    assert categories == VALID_CATEGORIES


@pytest.mark.asyncio
async def test_asset_service_verify_asset(db_session):
    """실시간 종목 검증 시 현금 자산과 주식 시장 조회가 올바르게 동작하는지 검증합니다."""
    service = AssetService(db_session)

    # 1. 현금 자산 검증 (KRW, USD)
    krw_result = await service.verify_asset(ticker="KRW", country="KR", major_category="현금")
    assert krw_result == {"name": "원화예수금"}

    usd_result = await service.verify_asset(ticker="USD", country="US", major_category="현금")
    assert usd_result == {"name": "달러예수금"}

    # 지원하지 않는 현금 티커 -> ValueError
    with pytest.raises(ValueError) as excinfo:
        await service.verify_asset(ticker="EUR", country="EU", major_category="현금")
    assert "지원하지 않는 현금 티커" in str(excinfo.value)

    # 2. 주식 종목 실시간 검증 (Mocking price_service)
    with patch("src.backend.services.asset_service.price_service.get_stock_name", new_callable=AsyncMock) as mock_get_name:
        mock_get_name.return_value = "삼성전자"
        stock_result = await service.verify_asset(ticker="005930", country="KR", major_category="일반주식")
        assert stock_result == {"name": "삼성전자"}
        mock_get_name.assert_called_once_with("005930", "KR")

    # 주식 종목 미발견 시 -> LookupError
    with patch("src.backend.services.asset_service.price_service.get_stock_name", new_callable=AsyncMock) as mock_get_name:
        mock_get_name.return_value = None
        with pytest.raises(LookupError) as excinfo:
            await service.verify_asset(ticker="INVALID", country="US", major_category="일반주식")
        assert "찾을 수 없습니다" in str(excinfo.value)

    # 이미 DB에 등록된 자산 중복 검증 시 -> ValueError
    service.create_asset(
        ticker="TSLA",
        name="테슬라",
        major_category="일반주식",
        sub_category="해외주식",
        country="US"
    )
    with pytest.raises(ValueError) as excinfo:
        await service.verify_asset(ticker="TSLA", country="US", major_category="일반주식")
    assert "이미 등록된 자산(티커)입니다" in str(excinfo.value)


def test_legacy_update_asset_category_compatibility(db_session):
    """기존 레거시 함수 update_asset_category와의 하위 호환성을 검증합니다."""
    service = AssetService(db_session)
    asset = service.create_asset(
        ticker="TLT",
        name="iShares 20+ Year Treasury Bond ETF",
        major_category="일반주식",
        sub_category="해외주식",
        country="US"
    )

    updated = update_asset_category(db_session, asset.id, "채권", "미국장기채")
    assert updated is not None
    assert updated.major_category == "채권"
    assert updated.sub_category == "미국장기채"
