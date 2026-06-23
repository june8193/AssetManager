import datetime
import pytest
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from src.backend.main import app
from src.backend.models import HistoricalPrice

# TDD Red 단계: 임포트 및 구현 실패를 검증하기 위한 구조
try:
    from src.backend.services.simulation_service import SimulationService
except ImportError:
    SimulationService = None


def test_simulation_service_import():
    """SimulationService 임포트 가능 여부를 검증합니다."""
    assert SimulationService is not None, "SimulationService가 아직 임포트되지 않았거나 구현되지 않았습니다."


def test_simulation_run_api(db_session: Session):
    """시뮬레이션 수행 API가 200 OK와 올바른 데이터 구조를 리턴하는지 검증합니다."""
    # 1. 가상의 S&P500 (^GSPC) 과거 데이터 적재 (2025-01-01부터 시작)
    base_date = datetime.date(2025, 1, 1)
    for i in range(100):
        price_date = base_date + datetime.timedelta(days=i)
        # 100에서 시작해 0.5%씩 점진적 상승하는 시세 (영업일 개념 생략하고 연속 데이터 삽입)
        close_price = 100.0 * (1.005 ** i)
        db_session.add(
            HistoricalPrice(
                ticker="^GSPC",
                price_date=price_date,
                close_price=close_price
            )
        )
    db_session.commit()

    # 2. Test API Client 호출
    client = TestClient(app)
    payload = {
        "allocations": [
            {"name": "주식 100%", "stock_ratio": 100},
            {"name": "주식 60% / 현금 40%", "stock_ratio": 60}
        ],
        "period": "5Y",
        "rebalancing": "monthly"
    }

    # 아직 /api/simulation/run 엔드포인트가 라우터에 등록되어 있지 않으므로 404가 발생하여 실패해야 합니다.
    response = client.post("/api/simulation/run", json=payload)
    assert response.status_code == 200, f"API 응답이 실패했습니다: {response.status_code}"
    
    data = response.json()
    assert "chart" in data
    assert "summaries" in data
    assert "yearly_stats" in data
    assert "monthly_stats" in data
    
    # 구조적 데이터 정합성 검증
    assert len(data["summaries"]) == 2
    assert data["summaries"][0]["name"] == "주식 100%"
    assert "cagr" in data["summaries"][0]
    assert "mdd" in data["summaries"][0]
