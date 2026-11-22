# -*- coding: utf-8 -*-
"""포트폴리오 내재 변동성 및 리스크 진단 API 라우터 모듈입니다."""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..market import MarketDataProvider
from ..services.risk_service import RiskService

router = APIRouter(prefix="/api/v1/risk", tags=["risk"])


def get_market_provider(db: Session = Depends(get_db)) -> MarketDataProvider:
    """요청 스코프의 MarketDataProvider 의존성을 생성합니다.

    Args:
        db: SQLAlchemy 데이터베이스 세션.

    Returns:
        국내(키움)/미국(Yahoo Finance) 어댑터가 연결된 MarketDataProvider 인스턴스.
    """
    from ..market.adapters.kiwoom import KiwoomAdapter
    from ..market.adapters.yfinance import YahooFinanceAdapter

    return MarketDataProvider(
        db=db,
        kr_adapter=KiwoomAdapter(),
        us_adapter=YahooFinanceAdapter(),
    )


@router.get("/volatility")
async def get_portfolio_volatility(
    period: str = Query("1Y", pattern="^(1M|3M|1Y)$", description="변동성 산출 기간 (1M, 3M, 1Y)"),
    extra_tickers: Optional[str] = Query(
        None,
        description="시뮬레이션 편입 테스트를 위해 추가할 티커 목록 (쉼표 구분)",
    ),
    db: Session = Depends(get_db),
    provider: MarketDataProvider = Depends(get_market_provider),
) -> Dict[str, Any]:
    """현재 보유 비중 및 유효 종가 시세 기반 포트폴리오 내재 변동성 진단 데이터를 반환합니다.

    Args:
        period: 변동성 산출 기간 (``1M``, ``3M``, ``1Y``).
        extra_tickers: 시뮬레이션 편입 테스트를 위해 추가할 쉼표 구분 티커 문자열.
        db: SQLAlchemy 데이터베이스 세션.
        provider: 마켓 데이터 프로바이더 인스턴스.

    Returns:
        포트폴리오 내재 변동성, 벤치마크, 자산별 기여도, 공분산 행렬, 낙폭 비교 시계열 응답.
    """
    parsed_extras = (
        [t.strip() for t in extra_tickers.split(",") if t.strip()]
        if extra_tickers
        else None
    )
    service = RiskService(db=db, provider=provider)
    return await service.get_volatility_diagnosis(period=period, extra_tickers=parsed_extras)
