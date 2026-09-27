# -*- coding: utf-8 -*-
"""지출(Expense) 내역, 카테고리 및 통계 조회를 위한 MCP 도구 모듈입니다.
백엔드 API 서버의 지출 관련 엔드포인트를 호출하여 데이터를 제공합니다.
"""

from typing import Any, Dict, Optional
from src.mcp.client import api_client


async def get_expense_categories() -> Dict[str, Any]:
    """등록된 지출 카테고리 마스터 목록을 조회합니다.

    AI 에이전트가 시스템의 지출 분류 체계를 파악하거나 카테고리 ID 및 색상 정보를 확인할 때 사용합니다.

    Returns:
        Dict[str, Any]: 카테고리 목록({"categories": [...]}) 또는 오류 메시지({"error": ...}).
    """
    try:
        categories = await api_client.get("/api/expenses/categories")
        if isinstance(categories, dict) and "error" in categories:
            return categories

        return {"categories": categories}
    except Exception as e:
        return {"error": f"지출 카테고리 목록 조회 중 오류 발생: {str(e)}"}


async def get_expense_summary(
    year_month: Optional[str] = None,
    start_month: Optional[str] = None,
    end_month: Optional[str] = None,
    owner: Optional[str] = None,
) -> Dict[str, Any]:
    """기준월 또는 기간별 지출 총액, 월별 추이, 카테고리별/결제수단별 비중 통계를 조회합니다.

    Args:
        year_month (Optional[str]): 기준 년월 (YYYY-MM 형식, 예: '2026-08').
        start_month (Optional[str]): 조회 시작년월 (YYYY-MM 형식, 예: '2026-01').
        end_month (Optional[str]): 조회 종료년월 (YYYY-MM 형식, 예: '2026-08').
        owner (Optional[str]): 소유주 필터 조건 (예: '장준', '성은', None 지정 시 전체).

    Returns:
        Dict[str, Any]: 지출 통계 집계 데이터(총액, 월별 추이, 카테고리/결제수단 비중 등) 또는 오류 메시지({"error": ...}).
    """
    try:
        params: Dict[str, Any] = {}
        if year_month:
            params["year_month"] = year_month
        if start_month:
            params["start_month"] = start_month
        if end_month:
            params["end_month"] = end_month
        if owner:
            params["owner"] = owner

        stats = await api_client.get("/api/expenses/stats", params=params)
        if isinstance(stats, dict) and "error" in stats:
            return stats

        return stats
    except Exception as e:
        return {"error": f"지출 종합 통계 조회 중 오류 발생: {str(e)}"}


async def get_expenses(
    year_month: Optional[str] = None,
    start_month: Optional[str] = None,
    end_month: Optional[str] = None,
    owner: Optional[str] = None,
    category_name: Optional[str] = None,
    category_id: Optional[int] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> Dict[str, Any]:
    """기간, 소유주, 카테고리, 검색어, 페이징 조건에 맞는 지출 거래 내역 목록을 조회합니다.

    카테고리 ID를 모르는 경우 category_name을 전달하면 카테고리 마스터에서 ID를 자동 매핑하여 조회합니다.

    Args:
        year_month (Optional[str]): 단일 정산년월 (YYYY-MM 형식, 예: '2026-08').
        start_month (Optional[str]): 조회 시작년월 (YYYY-MM 형식, 예: '2026-01').
        end_month (Optional[str]): 조회 종료년월 (YYYY-MM 형식, 예: '2026-08').
        owner (Optional[str]): 소유주 필터 조건 (예: '장준', '성은').
        category_name (Optional[str]): 카테고리명 (예: '식비', '교통'). category_id가 없을 때 자동 매핑됩니다.
        category_id (Optional[int]): 카테고리 ID 필터 조건. 지정 시 category_name보다 우선합니다.
        search (Optional[str]): 가맹점명 또는 메모 검색어.
        limit (int): 페이징 건수 (기본값: 50).
        offset (int): 페이징 시작 인덱스 (기본값: 0).

    Returns:
        Dict[str, Any]: 지출 거래 목록({"total_count": int, "expenses": List[Dict]}) 또는 오류 메시지({"error": str}).
    """
    try:
        target_category_id: Optional[int] = category_id

        # category_id가 없고 category_name이 전달된 경우 자동 매핑 수행
        if target_category_id is None and category_name is not None:
            categories_resp = await api_client.get("/api/expenses/categories")
            if isinstance(categories_resp, dict) and "error" in categories_resp:
                return categories_resp

            categories_list = categories_resp if isinstance(categories_resp, list) else []
            normalized_query_name = category_name.strip().lower()

            matched = next(
                (
                    c for c in categories_list
                    if isinstance(c, dict) and c.get("name", "").strip().lower() == normalized_query_name
                ),
                None,
            )

            if not matched:
                # 일치하는 카테고리가 없는 경우 백엔드 호출 없이 빈 결과 반환
                return {"total_count": 0, "expenses": []}

            target_category_id = matched.get("id")

        params: Dict[str, Any] = {
            "limit": limit,
            "offset": offset,
        }
        if year_month:
            params["year_month"] = year_month
        if start_month:
            params["start_month"] = start_month
        if end_month:
            params["end_month"] = end_month
        if owner:
            params["owner"] = owner
        if target_category_id is not None:
            params["category_id"] = target_category_id
        if search:
            params["search"] = search

        expenses = await api_client.get("/api/expenses", params=params)
        if isinstance(expenses, dict) and "error" in expenses:
            return expenses

        expenses_list = expenses if isinstance(expenses, list) else []
        return {
            "total_count": len(expenses_list),
            "expenses": expenses_list,
        }
    except Exception as e:
        return {"error": f"지출 내역 목록 조회 중 오류 발생: {str(e)}"}

