import datetime
import asyncio
import pytest
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from src.backend.main import app
from src.backend.models import HistoricalPrice
from src.backend.services.simulation_service import SimulationService


def test_simulation_recurring_service_method(db_session: Session):
    """SimulationService의 run_recurring_simulation 메서드 작동과 계산 로직을 검증합니다."""
    # 1. 2개년도의 가상 S&P500 데이터 적재 (2025-01-01 ~ 2026-12-31 중 2개년 시작/끝일 가정)
    # 영업일만 단순 적재:
    # 2025년: 1월 1일 (지수 100), 12월 31일 (지수 110) -> 연간 10% 상승
    # 2026년: 1월 1일 (지수 110), 12월 31일 (지수 121) -> 연간 10% 상승
    dates = [
        datetime.date(2025, 1, 1),
        datetime.date(2025, 12, 31),
        datetime.date(2026, 1, 1),
        datetime.date(2026, 12, 31)
    ]
    prices = [100.0, 110.0, 110.0, 121.0]

    for dt, pr in zip(dates, prices):
        db_session.add(
            HistoricalPrice(
                ticker="^GSPC",
                price_date=dt,
                close_price=pr
            )
        )
    db_session.commit()

    service = SimulationService(db_session)
    allocations = [{"name": "주식 100%", "stock_ratio": 100}]
    
    # asyncio.run을 사용하여 비동기 서비스 메서드를 동기식으로 테스트
    result = asyncio.run(service.run_recurring_simulation(
        allocations=allocations,
        period="ALL",
        rebalancing="yearly",
        annual_deposit=20000000.0
    ))

    # 3. 계산 논리 수동 검증
    # t=0 (2025-01-01): 추가금 20,000,000원 주입. 주식 100% 매수. 주가 100.0. 주식 수량 = 200,000. 현금 = 0. 가치 = 20,000,000원.
    # t=1 (2025-12-31): 주가 110.0. 주식 가치 = 200,000 * 110 = 22,000,000원. 현금 = 0. 가치 = 22,000,000원.
    # t=2 (2026-01-01): 연초 추가금 20,000,000원 추가 주입. 총 가치 = 42,000,000원. 주가 110.0. 새로운 주식 수량 = 42,000,000 / 110.0 = 381,818.18.
    # t=3 (2026-12-31): 주가 121.0. 주식 가치 = 381,818.18 * 121.0 = 46,200,000원.
    # 최종 가치 = 46,200,000원.
    # 총 투자원금 = 40,000,000원.
    # 누적 이자수익 = 6,200,000원.

    assert "summaries" in result
    summary = result["summaries"][0]
    assert summary["name"] == "주식 100%"
    assert summary["total_invested"] == 40000000.0
    assert abs(summary["final_valuation"] - 46200000.0) < 0.01
    assert abs(summary["total_interest"] - 6200000.0) < 0.01


def test_simulation_recurring_api(db_session: Session):
    """적립식 시뮬레이션 API 엔드포인트를 호출하여 올바른 데이터 규격이 오는지 검증합니다."""
    # S&P500 데이터 적재
    base_date = datetime.date(2025, 1, 1)
    for i in range(10):
        db_session.add(
            HistoricalPrice(
                ticker="^GSPC",
                price_date=base_date + datetime.timedelta(days=i),
                close_price=100.0 + i
            )
        )
    db_session.commit()

    client = TestClient(app)
    payload = {
        "allocations": [
            {"name": "주식 100%", "stock_ratio": 100},
            {"name": "주식 60% / 현금 40%", "stock_ratio": 60}
        ],
        "period": "5Y",
        "rebalancing": "monthly",
        "annual_deposit": 20000000.0
    }

    response = client.post("/api/simulation/run-recurring", json=payload)
    # 현재는 구현되지 않았으므로 404 또는 500 에러 등이 날 것입니다 (Red 단계)
    assert response.status_code == 200
    
    data = response.json()
    assert "chart" in data
    assert "summaries" in data
    assert "yearly_stats" in data
    assert "monthly_stats" in data
    
    assert len(data["summaries"]) == 2
    assert data["summaries"][0]["name"] == "주식 100%"
    assert "total_invested" in data["summaries"][0]
    assert "final_valuation" in data["summaries"][0]
    assert "total_interest" in data["summaries"][0]
