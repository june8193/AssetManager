"""거래 내역 관련 Pydantic 스키마 정의."""

from pydantic import BaseModel, ConfigDict
from typing import Optional, Literal
from datetime import date


class TransactionSchema(BaseModel):
    """거래 내역 정보를 담는 스키마입니다.

    Attributes:
        id (Optional[int]): 거래 식별자
        account_id (int): 계좌 식별자
        asset_id (int): 거래 자산 식별자
        target_asset_id (Optional[int]): 환전 상대 자산 식별자
        transaction_date (date): 거래 일자
        type (str): 거래 유형 (BUY, SELL, EXCHANGE 등)
        quantity (float): 수량
        price (float): 단가
        total_amount (float): 총 거래 금액
        currency (str): 통화 (KRW, USD)
        exchange_rate (Optional[float]): 환율
        memo (Optional[str]): 메모
        source (Literal["MANUAL", "AUTO_KIWOOM"]): 거래 출처 (MANUAL, AUTO_KIWOOM)
        external_id (Optional[str]): 외부 시스템 연동 식별자
        transfer_pair_id (Optional[str]): 이체 연동 식별자 (UUID)
        asset_name (Optional[str]): 자산명
        asset_ticker (Optional[str]): 자산 티커
        target_asset_name (Optional[str]): 환전 상대 자산명
        target_asset_ticker (Optional[str]): 환전 상대 자산 티커
        account_display_name (Optional[str]): 계좌 표시 이름
    """
    model_config = ConfigDict(from_attributes=True)

    id: Optional[int] = None
    account_id: int
    asset_id: int
    target_asset_id: Optional[int] = None
    transaction_date: date
    type: Literal["INITIAL_BALANCE", "DEPOSIT", "WITHDRAW", "BUY", "SELL", "INTEREST", "TAX", "CASH_ADJUSTMENT", "EXCHANGE", "TRANSFER"]
    quantity: float = 0.0
    price: float = 0.0
    total_amount: float
    currency: str
    exchange_rate: Optional[float] = None
    memo: Optional[str] = None
    source: Literal["MANUAL", "AUTO_KIWOOM"] = "MANUAL"
    external_id: Optional[str] = None
    transfer_pair_id: Optional[str] = None
    asset_name: Optional[str] = None
    asset_ticker: Optional[str] = None
    target_asset_name: Optional[str] = None
    target_asset_ticker: Optional[str] = None
    account_display_name: Optional[str] = None


class TransferTransactionRequest(BaseModel):
    """계좌 간 이체 생성 요청 스키마입니다."""
    source_account_id: int
    target_account_id: int
    asset_id: int
    amount: float
    transaction_date: date
    memo: Optional[str] = None
