import pytest
from unittest.mock import AsyncMock, patch
from src.backend.services.ratio_service import RatioService
from src.backend.models import TargetRatio
from sqlalchemy.orm import Session

@pytest.mark.asyncio
async def test_calculate_rebalancing_logic(db_session: Session):
    """리밸런싱 계산 로직의 정확성을 검증합니다."""
    
    # 1. 목표 비중 설정 (DB)
    # 대분류: 주식(40%), 현금(60%)
    # 중분류: 국내주식(주식의 50%), 해외주식(주식의 50%)
    db_session.add(TargetRatio(category_name="주식", category_type="major", target_percentage=40.0))
    db_session.add(TargetRatio(category_name="현금", category_type="major", target_percentage=60.0))
    db_session.add(TargetRatio(category_name="국내주식", category_type="sub", target_percentage=50.0, parent_category="주식"))
    db_session.add(TargetRatio(category_name="해외주식", category_type="sub", target_percentage=50.0, parent_category="주식"))
    db_session.commit()

    # 2. DashboardService.get_dashboard_summary 모킹
    # 현재 자산: 주식 300, 현금 700 (총 1000)
    # 주식 상세: 국내 100, 해외 200
    mock_dashboard_data = {
        "total_valuation_krw": 1000.0,
        "categories": [
            {
                "category": "주식",
                "value_krw": 300.0,
                "sub_categories": [
                    {"category": "국내주식", "value_krw": 100.0},
                    {"category": "해외주식", "value_krw": 200.0}
                ]
            },
            {
                "category": "현금",
                "value_krw": 700.0,
                "sub_categories": []
            }
        ]
    }

    service = RatioService(db_session)
    
    with patch.object(service.dashboard_service, 'get_dashboard_summary', new_callable=AsyncMock) as mock_summary:
        mock_summary.return_value = mock_dashboard_data
        
        # 3. 계산 실행 (추가 투자금 200)
        # 총 목표 금액 = 1000 + 200 = 1200
        # 주식 목표 (40%) = 480
        # 현금 목표 (60%) = 720
        # 국내주식 목표 (주식의 50%) = 240
        # 해외주식 목표 (주식의 50%) = 240
        
        result = await service.calculate_rebalancing(additional_cash=200.0)
        
        # 4. 검증
        assert result["total_valuation"] == 1000.0
        assert result["total_target"] == 1200.0
        
        # 대분류 검증
        major_stock = next(r for r in result["major_results"] if r["category"] == "주식")
        assert major_stock["target_amt"] == 480.0
        assert major_stock["current_amt"] == 300.0
        assert major_stock["diff_amt"] == 180.0
        
        major_cash = next(r for r in result["major_results"] if r["category"] == "현금")
        assert major_cash["target_amt"] == 720.0
        assert major_cash["diff_amt"] == 20.0
        
        # 중분류 검증
        sub_kr = next(r for r in result["sub_results"] if r["category"] == "국내주식")
        assert sub_kr["target_amt"] == 240.0 # 480 * 0.5
        assert sub_kr["diff_amt"] == 140.0   # 240 - 100
        
        sub_us = next(r for r in result["sub_results"] if r["category"] == "해외주식")
        assert sub_us["target_amt"] == 240.0 # 480 * 0.5
        assert sub_us["diff_amt"] == 40.0    # 240 - 200

def test_update_target_ratios_with_deletion(db_session: Session):
    """목표 비중 업데이트 시 기존 항목 삭제 기능을 테스트합니다."""
    # 1. 초기 데이터 설정
    db_session.add(TargetRatio(category_name="삭제될항목", category_type="major", target_percentage=10.0))
    db_session.add(TargetRatio(category_name="유지될항목", category_type="major", target_percentage=90.0))
    db_session.commit()
    
    service = RatioService(db_session)
    
    # 2. 업데이트 수행 (삭제될항목 제외)
    new_ratios = [
        {"category_name": "유지될항목", "category_type": "major", "target_percentage": 50.0},
        {"category_name": "신규항목", "category_type": "major", "target_percentage": 50.0}
    ]
    
    service.update_target_ratios(new_ratios)
    
    # 3. 검증
    saved = db_session.query(TargetRatio).all()
    assert len(saved) == 2
    assert any(s.category_name == "유지될항목" and s.target_percentage == 50.0 for s in saved)
    assert any(s.category_name == "신규항목" for s in saved)
    assert not any(s.category_name == "삭제될항목" for s in saved)
