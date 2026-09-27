# -*- coding: utf-8 -*-
"""동적 리밸런싱 전략 프리셋 관리를 위한 Pydantic 스키마 정의 모듈입니다."""

from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal
import datetime


class TierItemSchema(BaseModel):
    """공포 지수 및 낙폭 기준 다단계 리밸런싱 티어 스키마입니다."""
    tier: int = Field(..., description="단계 번호 (1부터 시작)")
    dd_threshold: float = Field(..., description="누적 최고점 대비 낙폭(Drawdown) 기준 (%)")
    vix_threshold: float = Field(..., description="CBOE 변동성 지수(VIX) 기준치")
    target_stock_ratio: float = Field(..., ge=0.0, le=100.0, description="목표 주식 비중 (%)")


class SimulationPresetCreate(BaseModel):
    """동적 리밸런싱 전략 프리셋 생성 요청 스키마입니다."""
    name: str = Field(..., min_length=1, max_length=100, description="전략 프리셋 명칭")
    description: Optional[str] = Field(None, description="전략 상세 설명")
    base_stock_ratio: float = Field(60.0, ge=0.0, le=100.0, description="기본 주식 비중 (%)")
    rebalancing_period: Literal["monthly", "yearly", "none"] = Field(
        "monthly", description="리밸런싱 점검 주기 ('monthly', 'yearly', 'none')"
    )
    investment_mode: Literal["recurring", "lump_sum"] = Field(
        "recurring", description="투자 운용 방식 ('recurring', 'lump_sum')"
    )
    annual_deposit: float = Field(20000000.0, ge=0.0, description="매년 추가 적립금 (원)")
    period: Literal["5Y", "10Y", "20Y", "30Y", "ALL"] = Field(
        "5Y", description="백테스트 기간 ('5Y', '10Y', '20Y', '30Y', 'ALL')"
    )
    tiers: List[TierItemSchema] = Field(default_factory=list, description="다단계 공포 매수 조건 목록")


class SimulationPresetUpdate(BaseModel):
    """동적 리밸런싱 전략 프리셋 수정 요청 스키마입니다."""
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="전략 프리셋 명칭")
    description: Optional[str] = Field(None, description="전략 상세 설명")
    base_stock_ratio: Optional[float] = Field(None, ge=0.0, le=100.0, description="기본 주식 비중 (%)")
    rebalancing_period: Optional[Literal["monthly", "yearly", "none"]] = Field(
        None, description="리밸런싱 점검 주기 ('monthly', 'yearly', 'none')"
    )
    investment_mode: Optional[Literal["recurring", "lump_sum"]] = Field(
        None, description="투자 운용 방식 ('recurring', 'lump_sum')"
    )
    annual_deposit: Optional[float] = Field(None, ge=0.0, description="매년 추가 적립금 (원)")
    period: Optional[Literal["5Y", "10Y", "20Y", "30Y", "ALL"]] = Field(
        None, description="백테스트 기간 ('5Y', '10Y', '20Y', '30Y', 'ALL')"
    )
    tiers: Optional[List[TierItemSchema]] = Field(None, description="다단계 공포 매수 조건 목록")


class SimulationPresetResponse(BaseModel):
    """동적 리밸런싱 전략 프리셋 응답 스키마입니다."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    base_stock_ratio: float
    rebalancing_period: str
    investment_mode: str
    annual_deposit: float
    period: str
    tiers: List[TierItemSchema]
    is_default: bool = False
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None
