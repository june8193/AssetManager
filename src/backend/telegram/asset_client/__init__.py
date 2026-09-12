# -*- coding: utf-8 -*-
"""AssetManager 로컬 REST API 통신 패키지입니다."""

from .asset_api import (
    get_asset_ratios,
    get_asset_summary,
    get_daily_stats,
    get_snapshots,
    get_transactions,
    get_yearly_stats,
)
from .client import AssetApiClient, get_default_client
from .models import (
    AssetClientError,
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

__all__ = [
    "AssetApiClient",
    "AssetClientError",
    "AssetRatioItem",
    "AssetRatiosResponse",
    "AssetSummaryResponse",
    "DailyStatItem",
    "DailyStatsResponse",
    "SnapshotItem",
    "SnapshotsResponse",
    "TransactionItem",
    "TransactionsResponse",
    "YearlyStatItem",
    "YearlyStatsResponse",
    "get_asset_ratios",
    "get_asset_summary",
    "get_daily_stats",
    "get_default_client",
    "get_snapshots",
    "get_transactions",
    "get_yearly_stats",
]
