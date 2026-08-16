"""Pydantic 스키마 패키지 단위 테스트."""

import pytest
from datetime import date
from pydantic import ValidationError

from src.backend.schemas.account import UserSchema, AccountSchema
from src.backend.schemas.asset import AssetSchema
from src.backend.schemas.transaction import TransactionSchema, TransferTransactionRequest
from src.backend.schemas.snapshot import (
    SaveSnapshotRequest,
    SnapshotPreviewSchema,
    SnapshotSchema,
    BrokerageCalculateRequest,
    BrokerageCalculateResponse,
    BrokerageSaveAccountRequest,
    BrokerageSaveRequest,
    BankCalculateRequest,
    BankCalculateResponse,
    BankSaveAccountRequest,
    BankSaveRequest,
    UnifiedSaveRequest,
    LatestSnapshotDateResponse,
)
from src.backend.schemas import (
    UserSchema as ExportedUserSchema,
    AccountSchema as ExportedAccountSchema,
    AssetSchema as ExportedAssetSchema,
    TransactionSchema as ExportedTransactionSchema,
    SnapshotSchema as ExportedSnapshotSchema,
)


def test_schema_package_exports():
    """schemas 패키지의 __init__.py에서 주요 스키마들이 정상적으로 노출되는지 검증합니다."""
    assert ExportedUserSchema is UserSchema
    assert ExportedAccountSchema is AccountSchema
    assert ExportedAssetSchema is AssetSchema
    assert ExportedTransactionSchema is TransactionSchema
    assert ExportedSnapshotSchema is SnapshotSchema


def test_account_schema_validation():
    """AccountSchema 생성 및 기본값 검증."""
    account = AccountSchema(
        id=1,
        user_id=10,
        user_name="홍길동",
        name="주거래계좌",
        provider="KB국민",
    )
    assert account.account_type == "BROKERAGE"
    assert account.is_active is True
    assert account.alias is None


def test_asset_schema_validation_success():
    """유효한 대분류/중분류 카테고리 조합을 가진 AssetSchema 생성 검증."""
    asset = AssetSchema(
        ticker="005930",
        name="삼성전자",
        major_category="일반주식",
        sub_category="국내주식",
        country="KR"
    )
    assert asset.ticker == "005930"
    assert asset.major_category == "일반주식"
    assert asset.sub_category == "국내주식"


def test_asset_schema_validation_invalid_major():
    """유효하지 않은 대분류 지정 시 검증 에러 발생."""
    with pytest.raises(ValidationError) as exc_info:
        AssetSchema(
            ticker="TEST",
            name="테스트",
            major_category="잘못된대분류",
            sub_category="국내주식",
        )
    assert "유효하지 않은 대분류입니다" in str(exc_info.value)


def test_asset_schema_validation_invalid_sub():
    """유효하지 않은 중분류 지정 시 검증 에러 발생."""
    with pytest.raises(ValidationError) as exc_info:
        AssetSchema(
            ticker="TEST",
            name="테스트",
            major_category="일반주식",
            sub_category="잘못된중분류",
        )
    assert "유효하지 않은 카테고리 조합입니다" in str(exc_info.value)


def test_transaction_schema_validation():
    """TransactionSchema 기본값 및 유효성 검증."""
    tx = TransactionSchema(
        account_id=1,
        asset_id=100,
        transaction_date=date(2026, 8, 1),
        type="BUY",
        quantity=10.0,
        price=70000.0,
        total_amount=700000.0,
        currency="KRW",
    )
    assert tx.source == "MANUAL"
    assert tx.exchange_rate is None


def test_transfer_transaction_request():
    """TransferTransactionRequest 생성 검증."""
    req = TransferTransactionRequest(
        source_account_id=1,
        target_account_id=2,
        asset_id=100,
        amount=500000.0,
        transaction_date=date(2026, 8, 1),
        memo="용돈 이체"
    )
    assert req.source_account_id == 1
    assert req.target_account_id == 2
    assert req.amount == 500000.0


def test_snapshot_schemas():
    """스냅샷 관련 요청/응답 스키마 인스턴스화 검증."""
    preview = SnapshotPreviewSchema(
        account_id=1,
        account_name="테스트계좌",
        snapshot_date=date(2026, 8, 1),
        period_deposit=100000.0,
        total_valuation=1500000.0,
        total_profit=50000.0,
    )
    assert preview.calculated_return_rate == 0.0
    assert preview.current_cash == 0.0

    unified = UnifiedSaveRequest(
        snapshot_date=date(2026, 8, 1),
        exchange_rate=1350.0,
        brokerage_accounts=[],
        bank_accounts=[],
    )
    assert unified.exchange_rate == 1350.0
