# -*- coding: utf-8 -*-
"""자산 데이터를 조회하여 출력하는 CLI 스크립트입니다."""

import argparse
import asyncio
import io
from pathlib import Path
import sys

# 프로젝트 루트 디렉터리를 sys.path에 추가하여 src 모듈 임포트 보장
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.backend.telegram.asset_client import (
    AssetClientError,
    get_asset_ratios,
    get_asset_summary,
    get_daily_stats,
    get_portfolio_status,
    get_snapshots,
    get_transactions,
    get_watchlist_prices,
    get_yearly_stats,
)


async def main_async() -> None:
    """CLI 비동기 실행 함수입니다."""
    parser = argparse.ArgumentParser(description="Query asset data from AssetManager API.")
    parser.add_argument(
        "--action",
        required=True,
        choices=[
            "summary",
            "ratios",
            "watchlist",
            "portfolio",
            "yearly",
            "daily",
            "snapshots",
            "transactions",
        ],
        help="Action to perform",
    )
    parser.add_argument(
        "--country",
        default="KR",
        choices=["KR", "US"],
        help="Country for watchlist inquiry",
    )
    parser.add_argument(
        "--date",
        default=None,
        help="Inquiry standard date (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--start-date",
        default=None,
        help="Start date for daily stats (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--end-date",
        default=None,
        help="End date for daily stats (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Query all daily stats data",
    )

    args = parser.parse_args()

    try:
        if args.action == "summary":
            res = await get_asset_summary()
            print(res.model_dump_json(indent=2))
        elif args.action == "ratios":
            res = await get_asset_ratios()
            print(res.model_dump_json(indent=2))
        elif args.action == "watchlist":
            res = await get_watchlist_prices(country=args.country)
            print(res.model_dump_json(indent=2))
        elif args.action == "portfolio":
            res = await get_portfolio_status(date=args.date)
            print(res.model_dump_json(indent=2))
        elif args.action == "yearly":
            res = await get_yearly_stats()
            print(res.model_dump_json(indent=2))
        elif args.action == "daily":
            res = await get_daily_stats(
                start_date=args.start_date, end_date=args.end_date, all_data=args.all
            )
            print(res.model_dump_json(indent=2))
        elif args.action == "snapshots":
            res = await get_snapshots()
            print(res.model_dump_json(indent=2))
        elif args.action == "transactions":
            res = await get_transactions(start_date=args.start_date, end_date=args.end_date)
            print(res.model_dump_json(indent=2))
    except AssetClientError as err:
        print(f"API Error: {err}", file=sys.stderr)
        sys.exit(1)
    except Exception as err:
        print(f"Unexpected Error: {err}", file=sys.stderr)
        sys.exit(1)


def main() -> None:
    """CLI 메인 진입점 함수입니다."""
    if sys.platform == "win32" and "pytest" not in sys.modules:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
