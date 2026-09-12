# -*- coding: utf-8 -*-
"""개별 종목 주가 데이터를 조회하여 출력하는 CLI 스크립트입니다."""

import argparse
import asyncio
import io
from pathlib import Path
import sys

# 프로젝트 루트 디렉터리를 sys.path에 추가하여 src 모듈 임포트 보장
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.backend.telegram.asset_client import get_stock_prices, AssetClientError


async def main_async() -> None:
    """CLI 비동기 실행 함수입니다."""
    parser = argparse.ArgumentParser(description="Query stock historical and current prices.")
    parser.add_argument(
        "--ticker",
        required=True,
        help="Stock code or ticker (e.g., 005930, AAPL)",
    )
    parser.add_argument(
        "--start-date",
        required=True,
        help="Start date for price history (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--end-date",
        default=None,
        help="End date for price history (YYYY-MM-DD), defaults to today",
    )

    args = parser.parse_args()

    try:
        res = await get_stock_prices(
            ticker=args.ticker,
            start_date=args.start_date,
            end_date=args.end_date,
        )
        print(f"[{res.name} ({res.ticker}) {res.market} 주가 정보]")
        if not res.prices:
            print("해당 기간의 데이터가 존재하지 않습니다.")
            return
        for item in res.prices:
            print(f"DATE: {item.date} | CLOSE_PRICE: {item.close_price}")
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
