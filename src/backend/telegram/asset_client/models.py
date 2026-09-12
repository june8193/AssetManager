# -*- coding: utf-8 -*-
"""AssetManager 로컬 REST API 통신용 데이터 모델 및 예외 정의 모듈입니다.

자산 요약(AssetSummaryResponse), 자산군별 비중 및 리밸런싱(AssetRatiosResponse, AssetRatioItem),
거래 내역(TransactionsResponse, TransactionItem),
연도별/일별 통계(YearlyStatsResponse, DailyStatsResponse),
스냅샷(SnapshotsResponse, SnapshotItem) 모델과 API 예외(AssetClientError)를 정의합니다.
"""

from pydantic import BaseModel, Field


class AssetClientError(Exception):
    """AssetManager 로컬 REST API 통신 중 발생하는 에러를 나타내는 예외 클래스입니다."""

    pass


class AssetSummaryResponse(BaseModel):
    """자산 요약 정보 응답 Pydantic 모델입니다."""

    total_valuation_krw: float = Field(..., description="총 평가자산 (KRW)")
    total_principal: float = Field(..., description="총 투자 원금 (최초 기초 자산 + 누적 추가액)")
    total_profit: float = Field(..., description="누적 투자 수익")
    cumulative_roi: float = Field(..., description="누적 투자수익률 (%)")
    contribution_ratio: float = Field(..., description="투자원금 비율 (%)")
    profit_ratio: float = Field(..., description="투자수익 비율 (%)")
    exchange_rate: dict = Field(default_factory=dict, description="환율 정보")
    latest_price_date: str = Field(..., description="최신 주가 기준일")


class AssetRatioItem(BaseModel):
    """자산 분류별 세부 비중 및 리밸런싱 정보 모델입니다."""

    category: str = Field(..., description="자산 분류 명칭")
    parent_category: str | None = Field(None, description="상위 대분류 명칭 (소분류인 경우)")
    current_amt: float = Field(..., description="현재 평가액 (KRW)")
    current_ratio: float = Field(..., description="현재 비중 (%)")
    target_percentage: float = Field(..., description="목표 비중 (%)")
    target_amt: float = Field(..., description="목표 평가액 (KRW)")
    diff_amt: float = Field(..., description="목표 비중 대비 차액 (조정 필요 금액, KRW)")


class AssetRatiosResponse(BaseModel):
    """자산군별 비중 현황 및 리밸런싱 가이드 응답 Pydantic 모델입니다."""

    total_valuation: float = Field(..., description="현재 총 평가액 (KRW)")
    total_target: float = Field(..., description="목표 총액 (KRW)")
    additional_cash: float = Field(..., description="추가 투자금 (KRW)")
    major_results: list[AssetRatioItem] = Field(default_factory=list, description="자산 대분류별 비중 목록")
    sub_results: list[AssetRatioItem] = Field(default_factory=list, description="자산 소분류별 비중 목록")


class TransactionItem(BaseModel):
    """개별 거래 내역 정보 모델입니다."""

    id: int | None = Field(None, description="거래 식별자")
    account_id: int = Field(..., description="계좌 식별자")
    asset_id: int = Field(..., description="자산 식별자")
    transaction_date: str = Field(..., description="거래 일자 (YYYY-MM-DD)")
    type: str = Field(..., description="거래 유형 (BUY, SELL 등)")
    quantity: float = Field(0.0, description="수량")
    price: float = Field(0.0, description="단가")
    total_amount: float = Field(..., description="총 거래 금액")
    currency: str = Field("KRW", description="통화 (KRW, USD)")
    exchange_rate: float | None = Field(None, description="환율")
    memo: str | None = Field(None, description="메모")
    asset_name: str | None = Field(None, description="자산명")
    asset_ticker: str | None = Field(None, description="자산 티커")
    account_display_name: str | None = Field(None, description="계좌 표시 이름")


class TransactionsResponse(BaseModel):
    """거래 내역 목록 응답 모델입니다."""

    transactions: list[TransactionItem] = Field(default_factory=list, description="거래 내역 목록")


class YearlyStatItem(BaseModel):
    """연도별 자산 현황 통계 아이템 모델입니다."""

    year: int = Field(..., description="연도")
    contribution: float = Field(..., description="순 추가액 (KRW)")
    profit: float = Field(..., description="연간 투자 수익 (KRW)")
    roi: float = Field(..., description="연간 투자수익률 (%)")
    assets: float = Field(..., description="기말 자산 평가액 (KRW)")
    increase: float = Field(..., description="자산 증감액 (KRW)")


class YearlyStatsResponse(BaseModel):
    """연도별 자산 현황 통계 응답 모델입니다."""

    stats: list[YearlyStatItem] = Field(default_factory=list, description="연도별 자산 현황 목록")


class DailyStatItem(BaseModel):
    """일자별 자산 현황 통계 아이템 모델입니다."""

    date: str = Field(..., description="날짜 (YYYY-MM-DD)")
    contribution: float = Field(..., description="추가액 (KRW)")
    profit: float = Field(..., description="투자 수익 (KRW)")
    roi: float = Field(..., description="투자수익률 (%)")
    assets: float = Field(..., description="자산 평가액 (KRW)")
    increase: float = Field(..., description="자산 증감액 (KRW)")


class DailyStatsResponse(BaseModel):
    """일자별 자산 현황 통계 응답 모델입니다."""

    stats: list[DailyStatItem] = Field(default_factory=list, description="일자별 자산 현황 목록")


class SnapshotItem(BaseModel):
    """계좌 상태 스냅샷 정보 모델입니다."""

    id: int = Field(..., description="스냅샷 식별자")
    account_id: int = Field(..., description="계좌 식별자")
    snapshot_date: str = Field(..., description="기준 일자 (YYYY-MM-DD)")
    period_deposit: float = Field(..., description="해당 기간 추가 입금액")
    total_valuation: float = Field(..., description="총 평가액")
    total_profit: float = Field(..., description="누적 수익")


class SnapshotsResponse(BaseModel):
    """자산 상태 스냅샷 목록 응답 모델입니다."""

    snapshots: list[SnapshotItem] = Field(default_factory=list, description="자산 상태 스냅샷 목록")


class KiwoomSyncTransactionItem(BaseModel):
    """키움증권 동기화 성공 거래 항목 모델입니다."""

    type: str = Field(..., description="거래 유형 (BUY, SELL, INTEREST, TAX 등)")
    asset_name: str = Field(..., description="자산명")
    quantity: float = Field(0.0, description="체결 수량")
    price: float = Field(0.0, description="체결 단가")
    total_amount: float = Field(..., description="총 거래 금액")
    currency: str = Field("KRW", description="통화 (KRW, USD)")
    is_manual_matched: bool = Field(False, description="수동 입력 거래 매칭 여부")
    traded_at: str | None = Field(None, description="체결 일시 (YYYY-MM-DD HH:MM 또는 YYYY-MM-DD)")


class KiwoomUnregisteredAssetItem(BaseModel):
    """키움증권 동기화 시 미등록 자산 항목 모델입니다."""

    ticker: str = Field(..., description="종목 코드")
    name: str = Field(..., description="종목명")
    type: str = Field(..., description="거래 유형 (BUY, SELL 등)")
    quantity: float = Field(0.0, description="수량")
    price: float = Field(0.0, description="단가")
    total_amount: float = Field(..., description="총 거래 금액")
    currency: str = Field("KRW", description="통화 (KRW, USD)")
    traded_at: str | None = Field(None, description="체결 일시")


class KiwoomFailedAccountItem(BaseModel):
    """동기화 실패 계좌 항목 모델입니다."""

    account_name: str = Field(..., description="계좌 명칭")
    error: str = Field(..., description="오류 메시지")


class KiwoomSyncResponse(BaseModel):
    """키움증권 거래내역 동기화 API 응답 Pydantic 모델입니다."""

    status: str = Field("success", description="동기화 상태 (success 또는 error)")
    success_count: int = Field(0, description="성공적으로 저장된 거래 건수")
    pending_count: int = Field(0, description="미등록으로 생략된 거래 건수")
    synced_transactions: list[KiwoomSyncTransactionItem] = Field(
        default_factory=list, description="동기화 완료된 거래 목록"
    )
    unregistered_assets: list[KiwoomUnregisteredAssetItem] = Field(
        default_factory=list, description="미등록 자산 거래 목록"
    )
    failed_accounts: list[KiwoomFailedAccountItem] = Field(
        default_factory=list, description="동기화 실패 계좌 목록"
    )

