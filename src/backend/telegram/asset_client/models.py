# -*- coding: utf-8 -*-
"""AssetManager 로컬 REST API 통신용 데이터 모델 및 예외 정의 모듈입니다.

자산 요약(AssetSummaryResponse), 자산군별 비중 및 리밸런싱(AssetRatiosResponse, AssetRatioItem) 등의
Pydantic 모델과 API 클라이언트 예외(AssetClientError)를 정의합니다.
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

