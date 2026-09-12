# -*- coding: utf-8 -*-
"""yfinance를 사용하여 미국 시장 뉴스를 수집하고 마크다운 형태로 출력하는 CLI 스크립트입니다."""

import argparse
import io
from pathlib import Path
import sys
from typing import Any
import yfinance as yf

# 프로젝트 루트 디렉터리를 sys.path에 추가하여 src 모듈 임포트 보장
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


def run_query_us_news(limit: int = 5) -> None:
    """yfinance로부터 미국 시장(^GSPC) 뉴스를 조회하여 마크다운 목록 형식으로 출력합니다.

    Args:
        limit: 출력할 최대 뉴스 건수 (기본값: 5)
    """
    try:
        ticker = yf.Ticker("^GSPC")
        news_list = ticker.news
        if not news_list:
            print("No news found for US market (^GSPC).")
            return

        for item in news_list[:limit]:
            content: dict[str, Any] = item.get("content", {})
            title = content.get("title", "") or item.get("title", "")

            link = ""
            click_through = content.get("clickThroughUrl")
            if click_through:
                link = click_through.get("url", "")
            if not link:
                canonical = content.get("canonicalUrl")
                if canonical:
                    link = canonical.get("url", "")
            if not link:
                link = item.get("link", "")

            provider: dict[str, Any] = content.get("provider", {})
            publisher = provider.get("displayName") or item.get("publisher", "Yahoo Finance")
            print(f"- [{title}]({link}) ({publisher})")

    except Exception as err:
        print(f"Error querying US news from yfinance: {err}", file=sys.stderr)
        sys.exit(1)


def main() -> None:
    """CLI 메인 진입점 함수입니다."""
    if sys.platform == "win32" and "pytest" not in sys.modules:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

    parser = argparse.ArgumentParser(
        description="Query Yahoo Finance news for US market and output formatted Markdown."
    )
    parser.add_argument(
        "--limit", "-l", type=int, default=5, help="Maximum number of news items to return"
    )

    args = parser.parse_args()
    run_query_us_news(limit=args.limit)


if __name__ == "__main__":
    main()
