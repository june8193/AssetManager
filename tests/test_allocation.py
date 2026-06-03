import pytest
from fastapi.testclient import TestClient
import datetime
from unittest.mock import MagicMock, patch
from src.backend.main import app

# 아직 구현되지 않은 모듈을 import하려고 하므로, 
# 테스트 실행 시 당연히 ImportError 또는 AttributeError 등으로 실패할 것입니다. (TDD Red)
# 이를 통해 실패하는 테스트(Red)를 구축합니다.
from src.backend.services.allocation_service import AllocationService

client = TestClient(app)

def test_calculate_allocation_score():
    """자산배분 3점 스코어링 공식 검증"""
    service = AllocationService(db=None)
    
    # 1. 3점 만점 (매우 안전)
    # 조건: 현재가(105) > 200일 이평선(100) [추세 +1]
    #      현재가(105) > 200일 전 가격(95) [모멘텀 +1]
    #      VIX(15) < 임계값(30) [공포 +1]
    score_3 = service.calculate_allocation_score(
        price_today=105.0,
        ma_val=100.0,
        price_past=95.0,
        vix_today=15.0,
        vix_threshold=30.0
    )
    assert score_3 == 3

    # 2. 2점
    # 조건: 현재가(98) < 200일 이평선(100) [추세 +0]
    #      현재가(98) > 200일 전 가격(95) [모멘텀 +1]
    #      VIX(15) < 임계값(30) [공포 +1]
    score_2 = service.calculate_allocation_score(
        price_today=98.0,
        ma_val=100.0,
        price_past=95.0,
        vix_today=15.0,
        vix_threshold=30.0
    )
    assert score_2 == 2

    # 3. 1점
    # 조건: 현재가(92) < 200일 이평선(100) [추세 +0]
    #      현재가(92) < 200일 전 가격(95) [모멘텀 +0]
    #      VIX(15) < 임계값(30) [공포 +1]
    score_1 = service.calculate_allocation_score(
        price_today=92.0,
        ma_val=100.0,
        price_past=95.0,
        vix_today=15.0,
        vix_threshold=30.0
    )
    assert score_1 == 1

    # 4. 0점 (최악 패닉)
    # 조건: 현재가(92) < 200일 이평선(100) [추세 +0]
    #      현재가(92) < 200일 전 가격(95) [모멘텀 +0]
    #      VIX(35) > 임계값(30) [공포 +0]
    score_0 = service.calculate_allocation_score(
        price_today=92.0,
        ma_val=100.0,
        price_past=95.0,
        vix_today=35.0,
        vix_threshold=30.0
    )
    assert score_0 == 0

def test_adjust_weights():
    """현금 및 주식 비중 Clamping 및 나머지 할당 로직 검증"""
    service = AllocationService(db=None)

    # 1. 3점 -> 현금 0% 계산되지만 min_cash_weight=10%가 적용되어 최종 현금 10%, 주식 90%
    stock_w, cash_w = service.adjust_weights(
        score=3,
        min_cash_weight=10.0,
        max_cash_weight=40.0
    )
    assert cash_w == 10.0
    assert stock_w == 90.0

    # 2. 2점 -> 현금 35% 계산되고 min/max 범위(10~40%) 내이므로 최종 현금 35%, 주식 65%
    stock_w, cash_w = service.adjust_weights(
        score=2,
        min_cash_weight=10.0,
        max_cash_weight=40.0
    )
    assert cash_w == 35.0
    assert stock_w == 65.0

    # 3. 0점 -> 현금 100% 계산되지만 max_cash_weight=40%가 적용되어 최종 현금 40%, 주식 60%
    stock_w, cash_w = service.adjust_weights(
        score=0,
        min_cash_weight=10.0,
        max_cash_weight=40.0
    )
    assert cash_w == 40.0
    assert stock_w == 60.0

@patch('src.backend.services.allocation_service.BenchmarkService')
def test_run_backtest(mock_benchmark_service_class, db_session):
    """백테스트 시뮬레이션 계산 로직 검증 (CAGR, MDD 및 차트 시계열)"""
    # mock BenchmarkService 및 get_historical_prices
    mock_instance = MagicMock()
    mock_benchmark_service_class.return_value = mock_instance
    
    # 10일치 가격 데이터 mock
    # 날짜 범위 설정 (2026-05-01 ~ 2026-05-10)
    dates = [datetime.date(2026, 5, i) for i in range(1, 11)]
    
    # 지수 종가: 100부터 하루에 1%씩 상승하도록 설정 (100 -> 109.36)
    # VIX 지수: 15.0으로 안정 상태 유지
    # MA 200일선: 95.0으로 현재 가격보다 낮음 (추세 +1)
    # 200일 전 가격: 90.0으로 현재 가격보다 낮음 (모멘텀 +1)
    # 따라서 스코어는 계속 3점이며, min_cash_weight=10%가 적용되어 주식 90%, 현금 10%
    
    mock_prices_index = []
    mock_prices_vix = []
    
    for d, p in zip(dates, [100.0 * (1.01**i) for i in range(10)]):
        # mock HistoricalPrice objects
        price_obj = MagicMock()
        price_obj.price_date = d
        price_obj.close_price = p
        mock_prices_index.append(price_obj)
        
        vix_obj = MagicMock()
        vix_obj.price_date = d
        vix_obj.close_price = 15.0
        mock_prices_vix.append(vix_obj)

    # get_historical_prices가 지수 티커일 때는 mock_prices_index를, VIX일 때는 mock_prices_vix를 반환하게 설정
    # 비동기 함수로 정의하여 코루틴을 반환하도록 함
    async def side_effect(ticker, start_date, end_date):
        if ticker == "^VIX":
            return mock_prices_vix
        return mock_prices_index

    mock_instance.get_historical_prices.side_effect = side_effect
    
    service = AllocationService(db=db_session)
    
    # 강제로 내부의 benchmark_service를 mock_instance로 교체
    service.benchmark_service = mock_instance
    
    # 백테스트 수행
    result = service.run_backtest(
        target_index="S&P500",
        lookback_period=5,
        rebalancing_frequency="매일",
        vix_threshold=30.0,
        min_cash_weight=10.0,
        max_cash_weight=40.0
    )
    
    assert "cagr" in result
    assert "mdd" in result
    assert "strategy_returns" in result
    assert "benchmark_returns" in result
    assert "dates" in result
    assert "today_recommendation" in result
    
    # CAGR, MDD가 실수 값인지 검증
    assert isinstance(result["cagr"], float)
    assert isinstance(result["mdd"], float)
    assert len(result["dates"]) > 0
    assert result["today_recommendation"]["recommended_stock_weight"] == 90.0
    assert result["today_recommendation"]["recommended_cash_weight"] == 10.0

@patch('src.backend.routers.allocation.AllocationService')
def test_backtest_api(mock_service_class):
    """백테스트 API 엔드포인트 동작 검증"""
    mock_instance = MagicMock()
    mock_service_class.return_value = mock_instance
    mock_instance.run_backtest.return_value = {
        "cagr": 12.5,
        "mdd": 8.2,
        "strategy_returns": [0.0, 1.2, 2.5],
        "benchmark_returns": [0.0, 0.8, 1.9],
        "dates": ["2026-05-01", "2026-05-02", "2026-05-03"],
        "today_recommendation": {
            "recommended_stock_weight": 90.0,
            "recommended_cash_weight": 10.0,
            "current_score": 3,
            "score_breakdown": {
                "trend_pass": True,
                "momentum_pass": True,
                "vix_stable": True,
                "trend_val": 105.0,
                "ma_val": 100.0,
                "past_val": 95.0,
                "vix_val": 15.0
            }
        }
    }

    # 올바른 파라미터로 요청
    payload = {
        "target_index": "S&P500",
        "lookback_period": 200,
        "rebalancing_frequency": "매월 말",
        "vix_threshold": 30.0,
        "min_cash_weight": 10.0,
        "max_cash_weight": 40.0
    }
    
    response = client.post("/api/allocation/backtest", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "cagr" in data
    assert "mdd" in data
    assert "strategy_returns" in data
    assert data["cagr"] == 12.5
    
    # 잘못된 파라미터 (vix_threshold 범위 초과 등)
    invalid_payload = payload.copy()
    invalid_payload["vix_threshold"] = -5.0
    response_invalid = client.post("/api/allocation/backtest", json=invalid_payload)
    assert response_invalid.status_code == 422

