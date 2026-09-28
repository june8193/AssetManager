# -*- coding: utf-8 -*-
"""벤치마크 다기간 성과 및 보유 종목 손익 기여도(Attribution) 조회를 위한 MCP 도구 함수 모음입니다.
백엔드 API 서버를 호출하여 데이터를 가져옵니다.
"""

from typing import Any, Dict, Optional
from src.mcp.client import api_client


async def get_benchmark_attribution(as_of_date: Optional[str] = None) -> Dict[str, Any]:
    """포트폴리오의 4개 기간(1M, 3M, 1Y, YTD) 벤치마크 성과(S&P 500, 나스닥, 코스피 대비 Alpha) 및 보유 종목별 가중 손익 기여도(Top/Bottom 3 랭킹 포함)를 조회합니다.

    Args:
        as_of_date (Optional[str]): 조회 기준일 (YYYY-MM-DD 형식). 미입력 시 오늘 기준.

    Returns:
        Dict[str, Any]: 4개 기간 벤치마크 성과, 종목별 가중 기여도, Top/Bottom 3 기여 종목 요약 데이터
    """
    try:
        params: Dict[str, Any] = {}
        if as_of_date:
            params["as_of_date"] = as_of_date

        result = await api_client.get("/api/benchmark/attribution", params=params)
        return result
    except Exception as e:
        return {"error": f"벤치마크 기여도 조회 중 오류 발생: {str(e)}"}
