# -*- coding: utf-8 -*-
"""자산 및 비중 관련 REST API 호출 함수 모듈입니다.

로컬 FastAPI 엔드포인트(/api/dashboard/summary, /api/ratios/rebalancing 등)를 비동기 호출하고
Pydantic 모델로 변환하여 반환합니다.
"""

from .client import get_default_client
from .models import (
    AssetRatioItem,
    AssetRatiosResponse,
    AssetSummaryResponse,
)


async def get_asset_summary() -> AssetSummaryResponse:
    """AssetManager API로부터 자산 요약 정보를 조회하여 Pydantic 모델로 반환합니다.

    Returns:
        통합 자산 현황 요약 모델 (AssetSummaryResponse)
    """
    client = get_default_client()
    data = await client.get_json("/api/dashboard/summary")

    total_asset = data.get("total_valuation_krw", 0.0)
    total_contribution = data.get("total_contribution", 0.0)
    initial_base = data.get("initial_base_asset", 0.0)
    total_principal = initial_base + total_contribution
    total_profit = data.get("total_profit", 0.0)
    roi = data.get("cumulative_roi", 0.0)
    contribution_ratio = data.get("contribution_ratio", 100.0)
    profit_ratio = data.get("profit_ratio", 0.0)
    exchange_rate = data.get("exchange_rate", {})
    latest_price_date = data.get("latest_price_date", "최근 데이터 없음")

    return AssetSummaryResponse(
        total_valuation_krw=total_asset,
        total_principal=total_principal,
        total_profit=total_profit,
        cumulative_roi=roi,
        contribution_ratio=contribution_ratio,
        profit_ratio=profit_ratio,
        exchange_rate=exchange_rate,
        latest_price_date=latest_price_date,
    )


async def get_asset_ratios() -> AssetRatiosResponse:
    """AssetManager API로부터 자산군별 비중 및 리밸런싱 정보를 조회하여 Pydantic 모델로 반환합니다.

    Returns:
        자산군별 비중 현황 및 리밸런싱 모델 (AssetRatiosResponse)
    """
    client = get_default_client()
    data = await client.get_json("/api/ratios/rebalancing")

    major_results = [
        AssetRatioItem(
            category=item.get("category", "미분류"),
            parent_category=None,
            current_amt=item.get("current_amt", 0.0),
            current_ratio=item.get("current_ratio", 0.0),
            target_percentage=item.get("target_percentage", 0.0),
            target_amt=item.get("target_amt", 0.0),
            diff_amt=item.get("diff_amt", 0.0),
        )
        for item in data.get("major_results", [])
    ]

    sub_results = [
        AssetRatioItem(
            category=item.get("category", "미분류"),
            parent_category=item.get("parent_category"),
            current_amt=item.get("current_amt", 0.0),
            current_ratio=item.get("current_ratio", 0.0),
            target_percentage=item.get("target_percentage", 0.0),
            target_amt=item.get("target_amt", 0.0),
            diff_amt=item.get("diff_amt", 0.0),
        )
        for item in data.get("sub_results", [])
    ]

    return AssetRatiosResponse(
        total_valuation=data.get("total_valuation", 0.0),
        total_target=data.get("total_target", 0.0),
        additional_cash=data.get("additional_cash", 0.0),
        major_results=major_results,
        sub_results=sub_results,
    )
