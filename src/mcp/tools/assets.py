# -*- coding: utf-8 -*-
"""자산 현황 요약 및 비중/포트폴리오 조회를 위한 MCP 도구 함수 모음입니다.
백엔드 API 서버를 호출하여 데이터를 가져옵니다.
"""

from typing import Optional
from src.mcp.client import api_client


async def _append_volatility_metrics(target_dict: dict) -> dict:
    """응답 딕셔너리에 포트폴리오 내재 변동성 요약 지표를 병합하는 헬퍼 함수.

    리스크 API 호출 실패 시에도 기존 자산·비중 응답을 그대로 반환합니다.
    """
    if not isinstance(target_dict, dict) or "error" in target_dict:
        return target_dict
    try:
        risk = await api_client.get("/api/v1/risk/volatility", params={"period": "1Y"})
    except Exception:
        return target_dict

    if isinstance(risk, dict) and isinstance(risk.get("portfolio"), dict):
        portfolio = risk["portfolio"]
        target_dict["portfolio_volatility"] = portfolio.get("annualized_volatility", 0.0)
        target_dict["daily_volatility_pct"] = portfolio.get("daily_volatility_pct", 0.0)
        target_dict["sp500_volatility_ratio"] = portfolio.get("sp500_ratio", 0.0)
    return target_dict


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
    """자산 대분류 및 소분류별 비중 현황과 리밸런싱 가이드 정보 및 포트폴리오 내재 변동성 요약 지표를 조회합니다.

    Returns:
        dict: 자산 비중 비율, 투자 계산 가이드 및 포트폴리오 내재 변동성 요약 지표
    """
    try:
        # 기본 추가 투자금은 0원으로 하여 비중 계산
        result = await api_client.get("/api/ratios/rebalancing", params={"additional_cash": 0.0})
        return await _append_volatility_metrics(result)
    except Exception as e:
        return {"error": f"자산 비중 조회 중 오류 발생: {str(e)}"}


async def get_portfolio_status(date: Optional[str] = None) -> dict:
    """보유하고 있는 계좌별 주식 종목 리스트, 보유 수량, 평가 금액, 현금 잔고 및 포트폴리오 내재 변동성 요약 지표를 조회합니다.

    Args:
        date (str, optional): 조회 기준일 (Format: YYYY-MM-DD), 생략 시 현재일 기준.

    Returns:
        dict: 포트폴리오 상태 보고서 데이터 및 포트폴리오 내재 변동성 요약 지표
    """
    try:
        params = {}
        if date:
            params["date"] = date
        status = await api_client.get("/api/portfolio/status", params=params)
        return await _append_volatility_metrics(status)
    except Exception as e:
        return {"error": f"포트폴리오 상태 조회 중 오류 발생: {str(e)}"}
