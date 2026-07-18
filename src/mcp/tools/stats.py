# -*- coding: utf-8 -*-
"""연도별/일자별 자산 통계 및 계좌 스냅샷 조회를 위한 MCP 도구 함수 모음입니다.
백엔드 API 서버를 호출하여 데이터를 가져옵니다.
"""

from typing import Optional, Any
from src.mcp.client import api_client

async def get_yearly_stats() -> dict:
    """연도별 순 투자 원금 추가액, 투자 수익, 연말 자산 평가액 및 연간 수익률 통계를 조회합니다.

    Returns:
        dict: 연도별 투자 수익률 통계 목록
    """
    try:
        stats = await api_client.get("/api/dashboard/yearly")
        if isinstance(stats, dict) and "error" in stats:
            return stats
        return {"stats": stats}
    except Exception as e:
        return {"error": f"연도별 통계 조회 중 오류 발생: {str(e)}"}

async def get_daily_stats(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    all_data: bool = False
) -> dict:
    """일자별 순 원금 증감, 일일 투자 수익 및 자산 총액 변동 추이 목록을 조회합니다.

    Args:
        start_date (str, optional): 조회 시작일 (YYYY-MM-DD)
        end_date (str, optional): 조회 종료일 (YYYY-MM-DD)
        all_data (bool): 전체 데이터를 가져올지 여부 (기본값 False)

    Returns:
        dict: 일자별 자산 및 수익률 흐름 통계
    """
    try:
        params: dict[str, Any] = {"all": all_data}
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
        
        stats = await api_client.get("/api/dashboard/daily", params=params)
        if isinstance(stats, dict) and "error" in stats:
            return stats
        return {"stats": stats}
    except Exception as e:
        return {"error": f"일자별 통계 조회 중 오류 발생: {str(e)}"}

async def get_snapshots(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    all_data: bool = False
) -> dict:
    """계좌별 자산 잔액 기록 스냅샷 데이터 이력을 조회합니다.

    Args:
        start_date (str, optional): 조회 시작일 (YYYY-MM-DD)
        end_date (str, optional): 조회 종료일 (YYYY-MM-DD)
        all_data (bool): 전체 스냅샷 이력을 가져올지 여부 (기본값 False)

    Returns:
        dict: 계좌 스냅샷 이력
    """
    try:
        params: dict[str, Any] = {"all": all_data}
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
            
        data = await api_client.get("/api/dashboard/snapshots", params=params)
        return data
    except Exception as e:
        return {"error": f"스냅샷 이력 조회 중 오류 발생: {str(e)}"}
