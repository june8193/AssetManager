import pytest
from fastapi.testclient import TestClient
from src.backend.main import app
from src.backend.models import TargetRatio
from sqlalchemy.orm import Session
from unittest.mock import AsyncMock, patch

client = TestClient(app)

def test_get_target_ratios_api(db_session: Session):
    """목표 비중 목록 조회 API를 테스트합니다."""
    db_session.add(TargetRatio(category_name="주식", category_type="major", target_percentage=50.0))
    db_session.commit()

    response = client.get("/api/ratios/targets")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["category_name"] == "주식"

def test_update_target_ratios_api(db_session: Session):
    """목표 비중 업데이트 API를 테스트합니다."""
    payload = [
        {"category_name": "주식", "category_type": "major", "target_percentage": 60.0},
        {"category_name": "현금", "category_type": "major", "target_percentage": 40.0}
    ]
    
    response = client.post("/api/ratios/targets", json=payload)
    assert response.status_code == 200
    assert response.json()["message"] == "Successfully updated target ratios"
    
    # DB 확인
    saved = db_session.query(TargetRatio).all()
    assert len(saved) == 2

@pytest.mark.asyncio
async def test_get_rebalancing_api(db_session: Session):
    """리밸런싱 계산 API를 테스트합니다."""
    # 1. 기초 데이터 설정
    db_session.add(TargetRatio(category_name="주식", category_type="major", target_percentage=100.0))
    db_session.commit()
    
    # 2. RatioService.calculate_rebalancing 모킹
    mock_result = {
        "total_valuation": 1000.0,
        "total_target": 1100.0,
        "additional_cash": 100.0,
        "major_results": [{"category": "주식", "target_amt": 1100.0, "current_amt": 1000.0, "diff_amt": 100.0}],
        "sub_results": []
    }
    
    with patch("src.backend.routers.ratios.RatioService.calculate_rebalancing", new_callable=AsyncMock) as mock_calc:
        mock_calc.return_value = mock_result
        
        response = client.get("/api/ratios/rebalancing?additional_cash=100.0")
        assert response.status_code == 200
        data = response.json()
        assert data["total_target"] == 1100.0
        assert data["major_results"][0]["category"] == "주식"
