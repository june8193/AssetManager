# -*- coding: utf-8 -*-
"""자산 현황 요약 및 비중/포트폴리오 조회를 위한 MCP 도구 함수 모음입니다.
"""

import datetime
from typing import Optional

from src.backend.database import SessionLocal
from src.backend.services.dashboard_service import DashboardService
from src.backend.services.ratio_service import RatioService
from src.backend.services.portfolio_service import get_portfolio_status as get_portfolio_status_service

async def get_asset_summary() -> dict:
    """총자산 요약 정보(총 평가자산, 원금, 수익, 누적 수익률 등)를 조회합니다.

    Returns:
        dict: 자산 요약 결과 데이터
    """
    db = SessionLocal()
    try:
        service = DashboardService(db)
        # force_update=False를 적용하여 빠르게 캐시 데이터에서 가져옴 (A안)
        summary = await service.get_dashboard_summary(force_update=False)
        return summary
    except Exception as e:
        return {"error": f"자산 요약 조회 중 오류 발생: {str(e)}"}
    finally:
        db.close()

async def get_asset_ratios() -> dict:
    """자산 대분류 및 소분류별 비중 현황과 리밸런싱 가이드 정보를 조회합니다.

    Returns:
        dict: 자산 비중 비율 및 투자 계산 가이드 데이터
    """
    db = SessionLocal()
    try:
        service = RatioService(db)
        # 기본 추가 투자금은 0원으로 하여 비중 계산
        result = await service.calculate_rebalancing(additional_cash=0.0)
        return result
    except Exception as e:
        return {"error": f"자산 비중 조회 중 오류 발생: {str(e)}"}
    finally:
        db.close()

async def get_portfolio_status(date: Optional[str] = None) -> dict:
    """보유하고 있는 계좌별 주식 종목 리스트, 보유 수량, 평가 금액 및 현금 잔고를 조회합니다.

    Args:
        date (str, optional): 조회 기준일 (Format: YYYY-MM-DD), 생략 시 현재일 기준.

    Returns:
        dict: 포트폴리오 상태 보고서 데이터
    """
    db = SessionLocal()
    try:
        if date:
            try:
                datetime.date.fromisoformat(date)
            except ValueError:
                return {"error": "날짜 형식이 잘못되었습니다. YYYY-MM-DD 형식을 사용해 주세요."}

        status = await get_portfolio_status_service(db, date)
        return status
    except Exception as e:
        return {"error": f"포트폴리오 상태 조회 중 오류 발생: {str(e)}"}
    finally:
        db.close()
