import pytest
from unittest.mock import AsyncMock, patch
from src.backend.services.ratio_service import RatioService
from src.backend.models import TargetRatio
from sqlalchemy.orm import Session

@pytest.mark.asyncio
async def test_get_hierarchy_stock_target_exists(db_session: Session):
    """DB에 종목별 목표 비중이 있는 경우 올바르게 반환되는지 확인합니다."""
    # 1. 목표 비중 설정
    db_session.add(TargetRatio(category_name="주식", category_type="major", target_percentage=100.0))
    db_session.add(TargetRatio(category_name="코어(지수)", category_type="sub", target_percentage=100.0, parent_category="주식"))
    # 종목별 목표 비중 설정 (AAPL: 60%, TSLA: 40%)
    db_session.add(TargetRatio(category_name="AAPL", category_type="stock", target_percentage=60.0, parent_category="코어(지수)"))
    db_session.add(TargetRatio(category_name="TSLA", category_type="stock", target_percentage=40.0, parent_category="코어(지수)"))
    db_session.commit()

    # 2. DashboardService.get_dashboard_summary 모킹
    mock_dashboard_data = {
        "total_valuation_krw": 2000.0,
        "accounts": [
            {
                "name": "계좌1",
                "assets": [
                    {
                        "ticker": "AAPL",
                        "name": "Apple Inc.",
                        "category": "주식",
                        "sub_category": "코어(지수)",
                        "quantity": 10,
                        "price": 100.0,
                        "valuation_krw": 1000.0
                    },
                    {
                        "ticker": "TSLA",
                        "name": "Tesla Inc.",
                        "category": "주식",
                        "sub_category": "코어(지수)",
                        "quantity": 10,
                        "price": 100.0,
                        "valuation_krw": 1000.0
                    }
                ]
            }
        ],
        "categories": []
    }

    service = RatioService(db_session)
    
    with patch.object(service.dashboard_service, 'get_dashboard_summary', new_callable=AsyncMock) as mock_summary:
        mock_summary.return_value = mock_dashboard_data
        
        # 3. 실행
        hierarchy = await service.get_hierarchy()
        
        # 4. 검증
        major_node = next(n for n in hierarchy if n["category_name"] == "주식")
        sub_node = next(n for n in major_node["children"] if n["category_name"] == "코어(지수)")
        
        aapl = next(s for s in sub_node["children"] if s["ticker"] == "AAPL")
        tsla = next(s for s in sub_node["children"] if s["ticker"] == "TSLA")
        
        # DB에 설정된 값이 반환되어야 함
        assert aapl["target_percentage"] == 60.0
        assert tsla["target_percentage"] == 40.0

@pytest.mark.asyncio
async def test_get_hierarchy_stock_target_defaults_to_current(db_session: Session):
    """DB에 종목별 목표 비중이 없을 경우 현재 비중이 기본값으로 설정되는지 확인합니다."""
    # 1. 목표 비중 설정 (종목 비중은 설정하지 않음)
    db_session.add(TargetRatio(category_name="주식", category_type="major", target_percentage=100.0))
    db_session.add(TargetRatio(category_name="코어(지수)", category_type="sub", target_percentage=100.0, parent_category="주식"))
    db_session.commit()

    # 2. DashboardService.get_dashboard_summary 모킹
    # AAPL 1500, TSLA 500 (총 2000) -> 현재 비중: AAPL 75%, TSLA 25%
    mock_dashboard_data = {
        "total_valuation_krw": 2000.0,
        "accounts": [
            {
                "name": "계좌1",
                "assets": [
                    {
                        "ticker": "AAPL",
                        "name": "Apple Inc.",
                        "category": "주식",
                        "sub_category": "코어(지수)",
                        "quantity": 15,
                        "price": 100.0,
                        "valuation_krw": 1500.0
                    },
                    {
                        "ticker": "TSLA",
                        "name": "Tesla Inc.",
                        "category": "주식",
                        "sub_category": "코어(지수)",
                        "quantity": 5,
                        "price": 100.0,
                        "valuation_krw": 500.0
                    }
                ]
            }
        ],
        "categories": []
    }

    service = RatioService(db_session)
    
    with patch.object(service.dashboard_service, 'get_dashboard_summary', new_callable=AsyncMock) as mock_summary:
        mock_summary.return_value = mock_dashboard_data
        
        # 3. 실행
        hierarchy = await service.get_hierarchy()
        
        # 4. 검증
        major_node = next(n for n in hierarchy if n["category_name"] == "주식")
        sub_node = next(n for n in major_node["children"] if n["category_name"] == "코어(지수)")
        
        aapl = next(s for s in sub_node["children"] if s["ticker"] == "AAPL")
        tsla = next(s for s in sub_node["children"] if s["ticker"] == "TSLA")
        
        # 현재 비중 검증
        assert aapl["current_ratio"] == 75.0
        assert tsla["current_ratio"] == 25.0
        
        # DB에 값이 없으므로 현재 비중이 목표 비중으로 설정되어야 함
        assert aapl["target_percentage"] == 75.0
        assert tsla["target_percentage"] == 25.0
