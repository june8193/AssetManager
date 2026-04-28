import pytest
from fastapi.testclient import TestClient
from src.backend.main import app
from src.backend.models import Asset, TargetRatio, Transaction, Account, User
from sqlalchemy.orm import Session
from datetime import date
from unittest.mock import patch

client = TestClient(app)

@pytest.mark.asyncio
async def test_get_ratio_hierarchy_api(db_session: Session):
    """계층형 데이터 조회 API를 테스트합니다."""
    # 1. 기초 데이터 설정
    user = User(name="Test User")
    db_session.add(user)
    db_session.flush()
    
    account = Account(user_id=user.id, name="Test Account", provider="KB", account_type="BROKERAGE")
    db_session.add(account)
    db_session.flush()
    
    asset1 = Asset(ticker="005930", name="삼성전자", major_category="주식", sub_category="국내주식", country="KR")
    asset2 = Asset(ticker="AAPL", name="애플", major_category="주식", sub_category="해외주식", country="US")
    db_session.add_all([asset1, asset2])
    db_session.flush()
    
    # 목표 비중 설정
    db_session.add(TargetRatio(category_name="주식", category_type="major", target_percentage=100.0))
    db_session.add(TargetRatio(category_name="국내주식", category_type="sub", target_percentage=60.0, parent_category="주식"))
    db_session.add(TargetRatio(category_name="해외주식", category_type="sub", target_percentage=40.0, parent_category="주식"))
    
    # 거래 내역 (현재 잔고 구성을 위해)
    # 총 평가액: 10 * 70000 + 5 * 200000 = 700,000 + 1,000,000 = 1,700,000
    db_session.add(Transaction(account_id=account.id, asset_id=asset1.id, transaction_date=date.today(), 
                               type="BUY", quantity=10.0, price=70000.0, total_amount=700000.0, currency="KRW"))
    db_session.add(Transaction(account_id=account.id, asset_id=asset2.id, transaction_date=date.today(), 
                               type="BUY", quantity=5.0, price=200000.0, total_amount=1000000.0, currency="KRW"))
    db_session.commit()

    # DashboardService.get_dashboard_summary가 호출될 수 있으므로, 
    # 실제 가격 조회를 피하기 위해 dashboard_service의 데이터 수집 부분을 모킹하거나 
    # RatioService에서 사용하는 부분을 고려해야 함.
    # 여기서는 실제 API 호출 시 RatioService가 동작할 것임.

    # 2. API 호출
    response = client.get("/api/ratios/hierarchy")
    
    # 3. 검증
    # 현재 엔드포인트가 없으므로 404가 나야 함 (Step 2에서 확인)
    assert response.status_code == 200
    data = response.json()
    
    # 대분류 확인
    assert len(data) == 1
    major = data[0]
    assert major["category_name"] == "주식"
    assert major["category_type"] == "major"
    assert "children" in major
    assert len(major["children"]) == 2
    
    # 중분류 확인
    sub_names = [child["category_name"] for child in major["children"]]
    assert "국내주식" in sub_names
    assert "해외주식" in sub_names
    
    # 국내주식 하위 자산 확인
    domestic = next(child for child in major["children"] if child["category_name"] == "국내주식")
    assert len(domestic["children"]) == 1
    assert domestic["children"][0]["ticker"] == "005930"
    assert domestic["children"][0]["quantity"] == 10.0
