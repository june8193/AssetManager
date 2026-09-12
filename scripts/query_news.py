# -*- coding: utf-8 -*-
"""네이버 뉴스 검색 API를 사용하여 특정 쿼리의 뉴스를 수집하고 마크다운 형태로 출력하는 CLI 스크립트입니다."""

import argparse
import asyncio
from email.utils import parsedate_to_datetime
import html
import io
from pathlib import Path
import re
import sys
from typing import Any
import httpx

# 프로젝트 루트 디렉터리를 sys.path에 추가하여 src 모듈 임포트 보장
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.backend.config import get_settings
from src.backend.telegram.asset_client import AssetClientError


def clean_html_text(text: str) -> str:
    """HTML 태그를 제거하고 특수 HTML 엔티티를 일반 문자로 복원합니다.

    Args:
        text: 원본 문자열

    Returns:
        정제된 순수 텍스트 문자열
    """
    if not text:
        return ""
    clean = re.sub(r"<[^>]*>", "", text)
    clean = html.unescape(clean)
    return clean


def _match_pub_date(pub_date_str: str, target_date_str: str) -> bool:
    """뉴스 발행일(RFC 822)이 지정한 특정 날짜(YYYY-MM-DD)와 일치하는지 비교합니다.

    Args:
        pub_date_str: RFC 822 형식의 뉴스 발행 일시 (예: 'Fri, 19 Jun 2026 15:30:00 +0900')
        target_date_str: 비교 대상 날짜 문자열 (YYYY-MM-DD)

    Returns:
        날짜가 일치하면 True, 그렇지 않거나 에러 발생 시 False
    """
    if not pub_date_str or not target_date_str:
        return True
    try:
        dt = parsedate_to_datetime(pub_date_str)
        extracted_date = dt.strftime("%Y-%m-%d")
        return extracted_date == target_date_str
    except Exception:
        return False


async def search_naver_news(
    query: str,
    display: int = 10,
    sort: str = "date",
    target_date: str | None = None,
) -> list[dict[str, Any]]:
    """네이버 뉴스 검색 API를 호출하고 가공한 뉴스 목록을 반환합니다.

    Args:
        query: 검색 키워드
        display: 가져올 최대 기사 개수
        sort: 정렬 방식 (date, sim)
        target_date: 특정 날짜 필터 (YYYY-MM-DD, 생략 시 필터 없음)

    Returns:
        정제된 뉴스 항목 리스트. 각 항목은 title, link, description, pubDate 키를 포함합니다.

    Raises:
        AssetClientError: 설정 누락, HTTP 호출 실패 또는 네트워크 오류 발생 시
    """
    settings = get_settings()
    client_id = settings.naver.client_id
    client_secret = settings.naver.client_secret

    if not client_id or not client_secret:
        raise AssetClientError("네이버 API client_id 또는 client_secret 설정이 누락되었습니다.")

    url = "https://openapi.naver.com/v1/search/news.json"
    headers = {
        "X-Naver-Client-Id": client_id,
        "X-Naver-Client-Secret": client_secret,
    }

    # 날짜 필터가 지정된 경우 필터링 후에도 충분한 개수를 보장하기 위해 display 개수를 늘립니다.
    api_display = min(100, max(50, display * 3)) if target_date else display

    params = {
        "query": query,
        "display": api_display,
        "sort": sort,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()

            items = data.get("items", [])
            results: list[dict[str, Any]] = []

            for item in items:
                pub_date_str = item.get("pubDate", "")

                if target_date and not _match_pub_date(pub_date_str, target_date):
                    continue

                results.append(
                    {
                        "title": clean_html_text(item.get("title", "")),
                        "link": item.get("link", ""),
                        "originallink": item.get("originallink", ""),
                        "description": clean_html_text(item.get("description", "")),
                        "pubDate": pub_date_str,
                    }
                )

                if len(results) >= display:
                    break

            return results

    except httpx.HTTPStatusError as exc:
        raise AssetClientError(
            f"네이버 뉴스 API 호출 실패 (HTTP 오류 코드: {exc.response.status_code})"
        ) from exc
    except httpx.RequestError as exc:
        raise AssetClientError(f"네이버 뉴스 API 서버 연결 네트워크 오류: {exc}") from exc
    except Exception as exc:
        raise AssetClientError(f"네이버 뉴스 조회 중 오류 발생: {exc}") from exc


async def main_async() -> None:
    """CLI 메인 비동기 실행 함수입니다."""
    parser = argparse.ArgumentParser(
        description="Query Naver News API and output formatted Markdown."
    )
    parser.add_argument("--query", "-q", required=True, help="Search keyword query")
    parser.add_argument(
        "--display", "-d", type=int, default=10, help="Maximum number of items to display"
    )
    parser.add_argument(
        "--sort", "-s", choices=["date", "sim"], default="date", help="Sorting method"
    )
    parser.add_argument(
        "--date", "-t", default="", help="Specific date filter (YYYY-MM-DD), default is empty"
    )

    args = parser.parse_args()

    try:
        results = await search_naver_news(
            query=args.query,
            display=args.display,
            sort=args.sort,
            target_date=args.date if args.date else None,
        )

        for item in results:
            title = item.get("title", "")
            link = item.get("link", "")
            description = item.get("description", "")
            print(f"- [{title}]({link}): {description}")

    except AssetClientError as err:
        print(f"Error querying news: {err}", file=sys.stderr)
        sys.exit(1)


def main() -> None:
    """CLI 메인 진입점 함수입니다."""
    if sys.platform == "win32" and "pytest" not in sys.modules:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
