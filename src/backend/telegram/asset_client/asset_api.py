# -*- coding: utf-8 -*-
"""자산, 비중, 거래내역 및 통계 관련 REST API 호출 함수 모듈입니다.

로컬 FastAPI 엔드포인트(/api/dashboard/summary, /api/ratios/rebalancing,
/api/db/transactions, /api/dashboard/yearly, /api/dashboard/daily, /api/db/snapshots)를
비동기 호출하고 Pydantic 모델로 변환하여 반환합니다.
"""

from .client import get_default_client
from .models import (
    AssetRatioItem,
    AssetRatiosResponse,
    AssetSummaryResponse,
    DailyStatItem,
    DailyStatsResponse,
    SnapshotItem,
    SnapshotsResponse,
    TransactionItem,
    TransactionsResponse,
    YearlyStatItem,
    YearlyStatsResponse,
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


async def get_transactions(
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int | None = None,
) -> TransactionsResponse:
    """AssetManager API로부터 거래 내역 목록을 조회하여 Pydantic 모델로 반환합니다.

    Args:
        start_date: 조회 시작 일자 (YYYY-MM-DD)
        end_date: 조회 종료 일자 (YYYY-MM-DD)
        limit: 조회할 최대 건수 제한 (선택 사항)

    Returns:
        거래 내역 목록 응답 모델 (TransactionsResponse)
    """
    client = get_default_client()
    params: dict[str, str] = {}
    if start_date:
        params["start_date"] = start_date
    if end_date:
        params["end_date"] = end_date

    data = await client.get_json("/api/db/transactions", params=params if params else None)

    raw_txs = data.get("transactions", []) if isinstance(data, dict) else data
    transactions: list[TransactionItem] = []
    for item in raw_txs:
        asset = item.get("asset") or {}
        asset_name = item.get("asset_name") or asset.get("name")
        asset_ticker = item.get("asset_ticker") or asset.get("ticker")

        transactions.append(
            TransactionItem(
                id=item.get("id"),
                account_id=item.get("account_id", 0),
                asset_id=item.get("asset_id", 0),
                transaction_date=str(item.get("transaction_date", "")),
                type=item.get("type", ""),
                quantity=item.get("quantity", 0.0),
                price=item.get("price", 0.0),
                total_amount=item.get("total_amount", 0.0),
                currency=item.get("currency", "KRW"),
                exchange_rate=item.get("exchange_rate"),
                memo=item.get("memo"),
                asset_name=asset_name,
                asset_ticker=asset_ticker,
                account_display_name=item.get("account_display_name"),
            )
        )

    if limit is not None and limit > 0:
        transactions = transactions[:limit]

    return TransactionsResponse(transactions=transactions)


async def get_yearly_stats() -> YearlyStatsResponse:
    """AssetManager API로부터 연도별 자산 현황 통계를 조회하여 Pydantic 모델로 반환합니다.

    Returns:
        연도별 자산 현황 통계 응답 모델 (YearlyStatsResponse)
    """
    client = get_default_client()
    data = await client.get_json("/api/dashboard/yearly")

    raw_stats = data.get("stats", []) if isinstance(data, dict) else data
    stats = [
        YearlyStatItem(
            year=item.get("year", 0),
            contribution=item.get("contribution", 0.0),
            profit=item.get("profit", 0.0),
            roi=item.get("roi", 0.0),
            assets=item.get("assets", 0.0),
            increase=item.get("increase", 0.0),
        )
        for item in raw_stats
    ]

    return YearlyStatsResponse(stats=stats)


async def get_daily_stats(
    start_date: str | None = None,
    end_date: str | None = None,
    all_data: bool = False,
    days: int | None = None,
) -> DailyStatsResponse:
    """AssetManager API로부터 일자별 자산 현황 통계를 조회하여 Pydantic 모델로 반환합니다.

    Args:
        start_date: 조회 시작 일자 (YYYY-MM-DD)
        end_date: 조회 종료 일자 (YYYY-MM-DD)
        all_data: 전체 일별 데이터 조회 여부
        days: 반환할 최근 일수 제한 (선택 사항)

    Returns:
        일자별 자산 현황 통계 응답 모델 (DailyStatsResponse)
    """
    client = get_default_client()
    params: dict[str, str] = {"all": str(all_data).lower()}
    if start_date:
        params["start_date"] = start_date
    if end_date:
        params["end_date"] = end_date

    data = await client.get_json("/api/dashboard/daily", params=params)

    raw_stats = data.get("stats", []) if isinstance(data, dict) else data
    stats = [
        DailyStatItem(
            date=str(item.get("date", "")),
            contribution=item.get("contribution", 0.0),
            profit=item.get("profit", 0.0),
            roi=item.get("roi", 0.0),
            assets=item.get("assets", 0.0),
            increase=item.get("increase", 0.0),
        )
        for item in raw_stats
    ]

    if days is not None and days > 0:
        stats = stats[:days]

    return DailyStatsResponse(stats=stats)


async def get_snapshots() -> SnapshotsResponse:
    """AssetManager API로부터 계좌별 스냅샷 정보를 조회하여 Pydantic 모델로 반환합니다.

    Returns:
        계좌별 스냅샷 목록 응답 모델 (SnapshotsResponse)
    """
    client = get_default_client()
    data = await client.get_json("/api/db/snapshots")

    raw_snapshots = data.get("snapshots", []) if isinstance(data, dict) else data
    snapshots = [
        SnapshotItem(
            id=item.get("id", 0),
            account_id=item.get("account_id", 0),
            snapshot_date=str(item.get("snapshot_date", "")),
            period_deposit=item.get("period_deposit", 0.0),
            total_valuation=item.get("total_valuation", 0.0),
            total_profit=item.get("total_profit", 0.0),
        )
        for item in raw_snapshots
    ]

    return SnapshotsResponse(snapshots=snapshots)
