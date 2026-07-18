# -*- coding: utf-8 -*-
"""연도별/일자별 자산 통계 및 계좌 스냅샷 조회를 위한 MCP 도구 함수 모음입니다.
"""

import datetime
from typing import Optional

from src.backend.database import SessionLocal
from src.backend.services.dashboard_service import DashboardService

async def get_yearly_stats() -> dict:
    """연도별 순 투자 원금 추가액, 투자 수익, 연말 자산 평가액 및 연간 수익률 통계를 조회합니다.

    Returns:
        dict: 연도별 투자 수익률 통계 목록
    """
    db = SessionLocal()
    try:
        service = DashboardService(db)
        stats = service.get_yearly_stats()
        return {"stats": stats}
    except Exception as e:
        return {"error": f"연도별 통계 조회 중 오류 발생: {str(e)}"}
    finally:
        db.close()

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
    db = SessionLocal()
    try:
        s_date = datetime.date.fromisoformat(start_date) if start_date else None
        e_date = datetime.date.fromisoformat(end_date) if end_date else None

        service = DashboardService(db)
        stats = service.get_daily_stats(start_date=s_date, end_date=e_date, all_data=all_data)
        return {"stats": stats}
    except ValueError:
        return {"error": "날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식을 이용해 주세요."}
    except Exception as e:
        return {"error": f"일자별 통계 조회 중 오류 발생: {str(e)}"}
    finally:
        db.close()

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
    db = SessionLocal()
    try:
        s_date = datetime.date.fromisoformat(start_date) if start_date else None
        e_date = datetime.date.fromisoformat(end_date) if end_date else None

        service = DashboardService(db)
        data = service.get_snapshots(start_date=s_date, end_date=e_date, all_data=all_data)
        return data
    except ValueError:
        return {"error": "날짜 형식이 잘못되었습니다. YYYY-MM-DD 형식을 사용해주세요."}
    except Exception as e:
        return {"error": f"스냅샷 이력 조회 중 오류 발생: {str(e)}"}
    finally:
        db.close()
