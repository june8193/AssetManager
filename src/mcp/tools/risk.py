# -*- coding: utf-8 -*-
"""포트폴리오 내재 변동성, 낙폭 방어력 및 종목별 위험 기여도 조회를 위한 MCP 도구 모듈입니다.
백엔드 API 서버를 호출하여 데이터를 가져옵니다.
"""

from typing import Any, Dict, List
from src.mcp.client import api_client

VALID_PERIODS = {"1M", "3M", "1Y"}


async def get_portfolio_volatility(period: str = "1Y", top_n: int = 5) -> Dict[str, Any]:
    """포트폴리오 내재 변동성, 벤치마크 대비 변동성 배수/Max MDD 및 종목별 위험 기여도를 조회합니다.

    토큰 효율성을 위해 원시 공분산 행렬(`covariance_matrix`)과 일별 낙폭 시계열(`drawdown_comparison`)은
    제외하고, 포트폴리오·벤치마크 요약 및 위험 기여도 상위 종목(`top_risk_contributors`) 중심으로 반환합니다.

    Args:
        period (str): 변동성 산출 기간 (`"1M"`, `"3M"`, `"1Y"` 중 하나, 기본 `"1Y"`).
        top_n (int): 위험 기여도 상위 종목 반환 개수 (현금 제외, 기본 `5`).

    Returns:
        Dict[str, Any]: 포트폴리오 변동성 요약, 벤치마크 통계, 위험 기여도 상위 종목 및 전체 자산별 위험 지표 딕셔너리.
    """
    normalized_period = (period or "1Y").strip().upper()
    if normalized_period not in VALID_PERIODS:
        return {
            "error": f"지원하지 않는 기간입니다: {period}. '1M', '3M', '1Y' 중 하나를 지정하세요."
        }

    safe_top_n = max(1, int(top_n))

    try:
        raw = await api_client.get(
            "/api/v1/risk/volatility",
            params={"period": normalized_period},
        )
        if not isinstance(raw, dict):
            return {"error": "리스크 API 응답 형식이 올바르지 않습니다."}
        if "error" in raw:
            return raw

        drawdown_series = (raw.get("drawdown_comparison") or {}).get("portfolio_current") or []
        portfolio_max_mdd = (
            round(float(min(drawdown_series)), 2) if drawdown_series else 0.0
        )

        portfolio_summary = dict(raw.get("portfolio") or {})
        portfolio_summary["max_mdd"] = portfolio_max_mdd

        enriched_assets: List[Dict[str, Any]] = []
        for asset in raw.get("assets") or []:
            item = dict(asset)
            weight = float(item.get("weight") or 0.0)
            vol_share = float(item.get("volatility_share") or 0.0)
            item["risk_weight_ratio"] = round(vol_share / weight, 2) if weight > 0.0 else 0.0
            enriched_assets.append(item)

        enriched_assets.sort(
            key=lambda x: float(x.get("volatility_share") or 0.0),
            reverse=True,
        )
        top_risk_contributors = [
            item for item in enriched_assets if not item.get("is_cash", False)
        ][:safe_top_n]

        return {
            "period": raw.get("period", normalized_period),
            "as_of_date": raw.get("as_of_date"),
            "total_valuation_krw": raw.get("total_valuation_krw", 0.0),
            "portfolio": portfolio_summary,
            "benchmarks": raw.get("benchmarks") or {},
            "top_risk_contributors": top_risk_contributors,
            "assets": enriched_assets,
        }
    except Exception as e:
        return {"error": f"포트폴리오 변동성 조회 중 오류 발생: {str(e)}"}
