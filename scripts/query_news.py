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


def _compare_pub_date(pub_date_str: str, target_date_str: str) -> int:
    """뉴스 발행일(RFC 822)과 지정한 특정 날짜(YYYY-MM-DD)의 선후 관계를 비교합니다.

    Args:
        pub_date_str: RFC 822 형식의 뉴스 발행 일시 (예: 'Fri, 19 Jun 2026 15:30:00 +0900')
        target_date_str: 비교 대상 날짜 문자열 (YYYY-MM-DD)

    Returns:
        1: 뉴스 발행일이 대상 날짜보다 미래인 경우 (pub_date > target_date)
        0: 날짜가 일치하거나 파싱할 수 없는 경우 (pub_date == target_date)
        -1: 뉴스 발행일이 대상 날짜보다 과거인 경우 (pub_date < target_date)
    """
    if not pub_date_str or not target_date_str:
        return 0
    try:
        dt = parsedate_to_datetime(pub_date_str)
        extracted_date = dt.strftime("%Y-%m-%d")
        if extracted_date > target_date_str:
            return 1
        elif extracted_date < target_date_str:
            return -1
        return 0
    except Exception:
        return 0


def _match_pub_date(pub_date_str: str, target_date_str: str) -> bool:
    """뉴스 발행일(RFC 822)이 지정한 특정 날짜(YYYY-MM-DD)와 일치하는지 비교합니다.

    Args:
        pub_date_str: RFC 822 형식의 뉴스 발행 일시 (예: 'Fri, 19 Jun 2026 15:30:00 +0900')
        target_date_str: 비교 대상 날짜 문자열 (YYYY-MM-DD)

    Returns:
        날짜가 일치하면 True, 그렇지 않거나 에러 발생 시 False
    """
    return _compare_pub_date(pub_date_str, target_date_str) == 0


async def _fetch_naver_news_page(
    client: httpx.AsyncClient,
    url: str,
    headers: dict[str, str],
    params: dict[str, Any],
    max_retries: int = 3,
) -> dict[str, Any]:
    """네이버 뉴스 검색 API를 호출하며, 429 Too Many Requests 발생 시 백오프 재시도합니다.

    Args:
        client: httpx 비동기 클라이언트
        url: 요청 대상 API URL
        headers: 요청 헤더 (클라이언트 ID 및 시크릿)
        params: 쿼리 파라미터 (query, display, start, sort)
        max_retries: 최대 재시도 횟수 (기본값: 3)

    Returns:
        네이버 검색 API 응답 딕셔너리

    Raises:
        httpx.HTTPStatusError: 재시도 후에도 비정상 응답이 지속되는 경우
    """
    for attempt in range(max_retries):
        response = await client.get(url, headers=headers, params=params)
        if response.status_code == 429 and attempt < max_retries - 1:
            await asyncio.sleep(0.5 * (2**attempt))
            continue
        response.raise_for_status()
        return response.json()
    response.raise_for_status()
    return {}


async def search_naver_news(
    query: str,
    display: int = 10,
    sort: str = "date",
    target_date: str | None = None,
) -> list[dict[str, Any]]:
    """네이버 뉴스 검색 API를 호출하고 가공한 뉴스 목록을 반환합니다.

    날짜 필터(target_date)가 지정된 경우, 해당 날짜의 기사만 수집하기 위해
    페이지네이션(start 파라미터)을 수행하며, sort='date'인 경우 과거 날짜 도달 시 조기 종료합니다.

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

    results: list[dict[str, Any]] = []
    max_start = 1000  # 네이버 뉴스 검색 API start 파라미터 최대치
    page_size = 100 if target_date else display
    current_start = 1

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            while current_start <= max_start and len(results) < display:
                params = {
                    "query": query,
                    "display": page_size,
                    "start": current_start,
                    "sort": sort,
                }

                data = await _fetch_naver_news_page(client, url, headers, params)
                items = data.get("items", [])
                if not items:
                    break

                stop_early = False
                for item in items:
                    pub_date_str = item.get("pubDate", "")

                    if target_date:
                        cmp = _compare_pub_date(pub_date_str, target_date)
                        if cmp > 0:
                            # 타겟 날짜보다 미래 기사 -> 다음 기사 탐색
                            continue
                        elif cmp < 0:
                            # 타겟 날짜보다 과거 기사
                            if sort == "date":
                                # 날짜순 정렬 시 이미 과거로 넘어갔으므로 이후 기사는 모두 과거임 -> 즉시 종료
                                stop_early = True
                                break
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

                if stop_early or not target_date or len(results) >= display:
                    break

                current_start += page_size

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
