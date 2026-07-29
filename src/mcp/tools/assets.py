# -*- coding: utf-8 -*-
"""자산 현황 요약 및 비중/포트폴리오 조회를 위한 MCP 도구 함수 모음입니다.
백엔드 API 서버를 호출하여 데이터를 가져옵니다.
"""

from typing import Optional
from src.mcp.client import api_client

async def get_asset_summary() -> dict:
    """총자산 요약 정보(총 평가자산, 원금, 수익, 누적 수익률 등)를 조회합니다.

    Returns:
        dict: 자산 요약 결과 데이터
    """
    try:
        # force_update=False를 적용하여 캐시된 데이터를 가져옴
        summary = await api_client.get("/api/dashboard/summary", params={"force_update": False})
        return summary
    except Exception as e:
        return {"error": f"자산 요약 조회 중 오류 발생: {str(e)}"}

async def get_asset_ratios() -> dict:
    """자산 대분류 및 소분류별 비중 현황과 리밸런싱 가이드 정보 및 포트폴리오 위험조정 지표를 조회합니다.

    Returns:
        dict: 자산 비중 비율, 투자 계산 가이드 및 샤프/소티노/MDD 지표
    """
    try:
        # 기본 추가 투자금은 0원으로 하여 비중 계산
        result = await api_client.get("/api/ratios/rebalancing", params={"additional_cash": 0.0})
        if isinstance(result, dict) and "error" not in result:
            perf = await api_client.get("/api/v1/performance/portfolio", params={"period": "1Y"})
            if isinstance(perf, dict) and "sharpe_ratio" in perf:
                result["sharpe_ratio"] = perf.get("sharpe_ratio", 0.0)
                result["sortino_ratio"] = perf.get("sortino_ratio", 0.0)
                result["mdd"] = perf.get("mdd", 0.0)
                result["max_mdd"] = perf.get("max_mdd", 0.0)
        return result
    except Exception as e:
        return {"error": f"자산 비중 조회 중 오류 발생: {str(e)}"}

async def get_portfolio_status(date: Optional[str] = None) -> dict:
    """보유하고 있는 계좌별 주식 종목 리스트, 보유 수량, 평가 금액, 현금 잔고 및 위험조정 지표(Sharpe, Sortino, MDD)를 조회합니다.

    Args:
        date (str, optional): 조회 기준일 (Format: YYYY-MM-DD), 생략 시 현재일 기준.

    Returns:
        dict: 포트폴리오 상태 보고서 데이터 및 위험조정 지표
    """
    try:
        params = {}
        if date:
            params["date"] = date
        status = await api_client.get("/api/portfolio/status", params=params)
        if isinstance(status, dict) and "error" not in status:
            perf = await api_client.get("/api/v1/performance/portfolio", params={"period": "1Y"})
            if isinstance(perf, dict) and "sharpe_ratio" in perf:
                status["sharpe_ratio"] = perf.get("sharpe_ratio", 0.0)
                status["sortino_ratio"] = perf.get("sortino_ratio", 0.0)
                status["mdd"] = perf.get("mdd", 0.0)
                status["max_mdd"] = perf.get("max_mdd", 0.0)
        return status
    except Exception as e:
        return {"error": f"포트폴리오 상태 조회 중 오류 발생: {str(e)}"}

