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
