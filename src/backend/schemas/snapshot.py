"""스냅샷 관련 Pydantic 스키마 정의."""

from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import date
from .transaction import TransactionSchema


class SaveSnapshotRequest(BaseModel):
    snapshot_date: date
    exchange_rate: float


class SnapshotPreviewSchema(BaseModel):
    account_id: int
    account_name: str
    snapshot_date: date
    period_deposit: float
    total_valuation: float
    total_profit: float
    period_profit: float = 0.0
    calculated_return_rate: float = 0.0
    current_cash: float = 0.0
    integrity_warnings: List[str] = []



class SnapshotSchema(BaseModel):
    """계좌 상태 스냅샷 정보를 담는 스키마입니다.

    Attributes:
        id (int): 스냅샷 식별자
        account_id (int): 계좌 식별자
        snapshot_date (date): 기준 일자
        period_deposit (float): 해당 기간 추가 입금액
        total_valuation (float): 총 평가액
        total_profit (float): 누적 수익
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    snapshot_date: date
    period_deposit: float
    total_valuation: float
    total_profit: float


class BrokerageCalculateRequest(BaseModel):
    account_id: int
    snapshot_date: date
    new_transactions: List[TransactionSchema]
    current_krw: float
    current_usd: float
    exchange_rate: float


class BrokerageCalculateResponse(BaseModel):
    theoretical_krw: float
    theoretical_usd: float
    diff_krw: float
    diff_usd: float
    existing_transactions: List[TransactionSchema] = []
    period_deposit: float = 0.0
    period_profit: float = 0.0
    need_last_exchange_rate: bool = False
    last_snapshot_date: Optional[date] = None
    integrity_warnings: List[str] = []


class BrokerageSaveAccountRequest(BaseModel):
    account_id: int
    new_transactions: List[TransactionSchema]
    diff_krw: float  # 원화 차액 (배당 또는 수수료)
    diff_usd: float  # 달러 차액 (배당 또는 수수료)


class BrokerageSaveRequest(BaseModel):
    snapshot_date: date
    exchange_rate: float
    accounts: List[BrokerageSaveAccountRequest]


class BankCalculateRequest(BaseModel):
    """은행계좌 잔액 계산을 위한 요청 스키마입니다."""
    account_id: int
    snapshot_date: date
    new_transactions: List[TransactionSchema]


class BankCalculateResponse(BaseModel):
    """은행계좌 잔액 계산 결과 스키마입니다."""
    theoretical_krw: float
    existing_transactions: List[TransactionSchema] = []
    total_deposit: float = 0.0
    total_withdraw: float = 0.0
    total_interest: float = 0.0
    total_tax: float = 0.0
    total_adjustment: float = 0.0
    period_deposit: float = 0.0
    period_profit: float = 0.0
    integrity_warnings: List[str] = []



class BankSaveAccountRequest(BaseModel):
    """은행 스냅샷 저장용 계좌 요청 스키마입니다."""
    account_id: int
    new_transactions: List[TransactionSchema]
    total_valuation: Optional[float] = None  # 은행 계좌는 현재 잔액이 곧 총 평가액 (선택 사항)


class BankSaveRequest(BaseModel):
    """은행 스냅샷 저장 요청 스키마입니다."""
    snapshot_date: date
    accounts: List[BankSaveAccountRequest]


class UnifiedSaveRequest(BaseModel):
    """증권 및 은행 계좌 통합 스냅샷 저장 요청 스키마입니다."""
    snapshot_date: date
    exchange_rate: float
    brokerage_accounts: List[BrokerageSaveAccountRequest]
    bank_accounts: List[BankSaveAccountRequest]


class LatestSnapshotDateResponse(BaseModel):
    """최신 스냅샷 날짜 정보를 담는 스키마입니다."""
    latest_date: Optional[date] = None


class SnapshotRecalculateItemDiff(BaseModel):
    """단일 스냅샷 계좌 재계산 전/후 차액 비교 스키마입니다."""
    snapshot_id: int
    account_id: int
    account_name: Optional[str] = None
    account_type: Optional[str] = None
    snapshot_date: date
    old_period_deposit: float
    new_period_deposit: float
    diff_period_deposit: float
    old_period_profit: float
    new_period_profit: float
    diff_period_profit: float
    old_total_valuation: float
    new_total_valuation: float
    diff_total_valuation: float
    is_changed: bool


class SnapshotRecalculateRequest(BaseModel):
    """스냅샷 일괄 재계산 요청 스키마입니다."""
    from_date: Optional[date] = None
    account_id: Optional[int] = None
    dry_run: bool = False


class SnapshotRecalculateResponse(BaseModel):
    """스냅샷 일괄 재계산 결과 응답 스키마입니다."""
    total_snapshots_evaluated: int
    total_snapshots_updated: int
    dry_run: bool
    diffs: List[SnapshotRecalculateItemDiff]
    summary_message: str


class SnapshotBatchDeleteRequest(BaseModel):
    """스냅샷 다중 일괄 삭제 요청 스키마입니다."""
    dates: List[date]


class SnapshotBatchDeleteResponse(BaseModel):
    """스냅샷 다중 일괄 삭제 결과 응답 스키마입니다."""
    deleted_count: int
    deleted_dates: List[date]
    message: str


