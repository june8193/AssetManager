# -*- coding: utf-8 -*-
"""지출 관리, 결제수단 및 카테고리 Pydantic 스키마 정의 모듈입니다."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


# --- 결제수단 (Payment Method) 스키마 ---

class PaymentMethodBase(BaseModel):
    """결제수단 공통 속성 스키마입니다."""
    owner: str
    institution: str
    alias: Optional[str] = None
    account_number: Optional[str] = None
    is_active: bool = True


class PaymentMethodCreate(PaymentMethodBase):
    """결제수단 생성 요청 스키마입니다."""
    pass


class PaymentMethodUpdate(BaseModel):
    """결제수단 수정 요청 스키마입니다."""
    owner: Optional[str] = None
    institution: Optional[str] = None
    alias: Optional[str] = None
    account_number: Optional[str] = None
    is_active: Optional[bool] = None


class PaymentMethodResponse(PaymentMethodBase):
    """결제수단 응답 스키마입니다."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: Optional[datetime] = None


# --- 지출 카테고리 (Expense Category) 스키마 ---

class ExpenseCategoryBase(BaseModel):
    """지출 카테고리 공통 속성 스키마입니다."""
    name: str
    color: str = "#95A5A6"
    is_default: bool = False


class ExpenseCategoryCreate(ExpenseCategoryBase):
    """지출 카테고리 생성 요청 스키마입니다."""
    pass


class ExpenseCategoryUpdate(BaseModel):
    """지출 카테고리 수정 요청 스키마입니다."""
    name: Optional[str] = None
    color: Optional[str] = None
    is_default: Optional[bool] = None


class ExpenseCategoryResponse(ExpenseCategoryBase):
    """지출 카테고리 응답 스키마입니다."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: Optional[datetime] = None


# --- 지출 거래 원장 (Expense) 스키마 ---

class ExpenseBase(BaseModel):
    """지출 내역 공통 속성 스키마입니다."""
    transaction_date: datetime
    year_month: str
    merchant: str
    amount: float
    payment_method_id: Optional[int] = None
    owner: str
    institution: str
    category_id: Optional[int] = None
    is_excluded: bool = False
    memo: Optional[str] = None
    source_file: Optional[str] = None


class ExpenseCreate(ExpenseBase):
    """지출 내역 생성 요청 스키마입니다."""
    pass


class ExpenseUpdate(BaseModel):
    """지출 내역 수정 요청 스키마입니다."""
    transaction_date: Optional[datetime] = None
    year_month: Optional[str] = None
    merchant: Optional[str] = None
    amount: Optional[float] = None
    payment_method_id: Optional[int] = None
    owner: Optional[str] = None
    institution: Optional[str] = None
    category_id: Optional[int] = None
    is_excluded: Optional[bool] = None
    memo: Optional[str] = None
    source_file: Optional[str] = None


class ExpenseResponse(ExpenseBase):
    """지출 내역 응답 스키마입니다."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: Optional[datetime] = None
    category_name: Optional[str] = None
    payment_method_alias: Optional[str] = None


# --- 명세서 업로드 미리보기 및 커밋 스키마 ---

class ExpenseUploadPreviewTransaction(BaseModel):
    """명세서에서 추출된 단일 거래 미리보기 스키마입니다."""
    transaction_date: str
    year_month: str
    merchant: str
    amount: float
    original_type: Optional[str] = None
    memo: Optional[str] = None
    category_id: Optional[int] = None
    is_excluded: bool = False


class ExpenseUploadPreviewResponse(BaseModel):
    """명세서 업로드 미리보기 응답 스키마입니다."""
    payment_method: Optional[PaymentMethodResponse] = None
    year_month: str
    source_file: str
    transactions: list[ExpenseUploadPreviewTransaction]


class ExpenseCommitItem(BaseModel):
    """확정 등록할 개별 지출 거래 항목 스키마입니다."""
    transaction_date: str | datetime
    year_month: Optional[str] = None
    merchant: str
    amount: float
    category_id: Optional[int] = None
    is_excluded: bool = False
    memo: Optional[str] = None
    original_type: Optional[str] = None


class ExpenseCommitRequest(BaseModel):
    """지출 내역 일괄 확정(덮어쓰기) 등록 요청 스키마입니다."""
    payment_method_id: int
    year_month: str
    source_file: Optional[str] = None
    items: list[ExpenseCommitItem]


class ExpenseCommitResponse(BaseModel):
    """지출 내역 일괄 확정 등록 결과 응답 스키마입니다."""
    status: str = "success"
    message: str
    count: int
    year_month: str
    payment_method_id: int


# --- 지출 대시보드 및 통계 스키마 ---

class MonthlyTrendItem(BaseModel):
    """월별 지출 추이 항목 스키마입니다."""
    year_month: str
    total_amount: float


class CategoryBreakdownItem(BaseModel):
    """카테고리별 지출 비중 항목 스키마입니다."""
    category_id: Optional[int] = None
    category_name: str
    color: str
    amount: float
    percentage: float


class PaymentMethodBreakdownItem(BaseModel):
    """결제수단별 지출 요약 항목 스키마입니다."""
    payment_method_id: Optional[int] = None
    alias: Optional[str] = None
    institution: str
    owner: str
    amount: float
    percentage: float


class ExpenseStatsResponse(BaseModel):
    """지출 대시보드 종합 통계 응답 스키마입니다."""
    year_month: str
    current_total: float
    prev_total: float
    mom_change_amount: float
    mom_change_rate: float
    excluded_total: float
    monthly_trends: list[MonthlyTrendItem]
    category_breakdown: list[CategoryBreakdownItem]
    payment_method_breakdown: list[PaymentMethodBreakdownItem]

