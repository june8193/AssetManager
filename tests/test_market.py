# -*- coding: utf-8 -*-
"""시장 지수 및 휴장일 조회 API의 단위 테스트 모듈입니다."""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from src.backend.main import app

client = TestClient(app)

@pytest.fixture
def mock_yfinance():
    """yfinance.Tickers 호출을 모킹하기 위한 픽스처입니다."""
    with patch("src.backend.routers.market.yf.Tickers") as mock_tickers_cls:
        # Mock Tickers 인스턴스
        mock_instance = MagicMock()
        mock_tickers_cls.return_value = mock_instance
        
        # KOSPI (^KS11) mock
        mock_kospi = MagicMock()
        mock_kospi.fast_info = {
            "last_price": 2700.50,
            "previous_close": 2667.16  # (2700.50 / 2667.16 - 1) * 100 = 1.25%
        }
        
        # KOSDAQ (^KQ11) mock
        mock_kosdaq = MagicMock()
        mock_kosdaq.fast_info = {
            "last_price": 850.20,
            "previous_close": 854.04  # (850.20 / 854.04 - 1) * 100 = -0.45%
        }

        # S&P 500 (^GSPC) mock
        mock_sp500 = MagicMock()
        mock_sp500.fast_info = {
            "last_price": 5000.00,
            "previous_close": 4950.00  # (5000 / 4950 - 1) * 100 = 1.01%
        }

        # NASDAQ (^IXIC) mock
        mock_nasdaq = MagicMock()
        mock_nasdaq.fast_info = {
            "last_price": 16000.00,
            "previous_close": 16100.00  # (16000 / 16100 - 1) * 100 = -0.62%
        }

        # DOW JONES (^DJI) mock
        mock_dow = MagicMock()
        mock_dow.fast_info = {
            "last_price": 39000.00,
            "previous_close": 39000.00  # (39000 / 39000 - 1) * 100 = 0.0%
        }
        
        # Tickers 인스턴스의 tickers 딕셔너리 모킹
        mock_instance.tickers = {
            "^KS11": mock_kospi,
            "^KQ11": mock_kosdaq,
            "^GSPC": mock_sp500,
            "^IXIC": mock_nasdaq,
            "^DJI": mock_dow
        }
        
        yield mock_instance

def test_get_market_indices_kr_success(mock_yfinance):
    """한국 지수가 모킹된 값을 기준으로 정상적으로 반환되는지 확인합니다."""
    response = client.get("/api/market/indices")
    assert response.status_code == 200
    
    data = response.json()
    assert len(data) == 2
    
    # KOSPI 검증
    assert data[0]["index_name"] == "KOSPI"
    assert data[0]["current_price"] == 2700.50
    assert data[0]["change_rate"] == 1.25
    
    # KOSDAQ 검증
    assert data[1]["index_name"] == "KOSDAQ"
    assert data[1]["current_price"] == 850.20
    assert data[1]["change_rate"] == -0.45

def test_get_market_indices_us_success(mock_yfinance):
    """미국 지수가 모킹된 값을 기준으로 정상적으로 반환되는지 확인합니다."""
    response = client.get("/api/market/indices?country=US")
    assert response.status_code == 200
    
    data = response.json()
    assert len(data) == 3
    
    # S&P 500 검증
    assert data[0]["index_name"] == "S&P 500"
    assert data[0]["current_price"] == 5000.00
    assert data[0]["change_rate"] == 1.01
    
    # NASDAQ 검증
    assert data[1]["index_name"] == "NASDAQ"
    assert data[1]["current_price"] == 16000.00
    assert data[1]["change_rate"] == -0.62
    
    # DOW JONES 검증
    assert data[2]["index_name"] == "DOW JONES"
    assert data[2]["current_price"] == 39000.00
    assert data[2]["change_rate"] == 0.0

def test_get_market_indices_failure_kr():
    """KR 지수 호출 실패 시 KOSPI/KOSDAQ 기본값이 정상적으로 반환되는지 확인합니다."""
    with patch("src.backend.routers.market.yf.Tickers", side_effect=Exception("API Error")):
        response = client.get("/api/market/indices?country=KR")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) == 2
        assert data[0]["index_name"] == "KOSPI"
        assert data[0]["current_price"] == 0.0
        assert data[0]["change_rate"] == 0.0
        assert data[1]["index_name"] == "KOSDAQ"
        assert data[1]["current_price"] == 0.0
        assert data[1]["change_rate"] == 0.0

def test_get_market_indices_failure_us():
    """US 지수 호출 실패 시 미국 3대 지수 기본값이 정상적으로 반환되는지 확인합니다."""
    with patch("src.backend.routers.market.yf.Tickers", side_effect=Exception("API Error")):
        response = client.get("/api/market/indices?country=US")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) == 3
        assert data[0]["index_name"] == "S&P 500"
        assert data[0]["current_price"] == 0.0
        assert data[0]["change_rate"] == 0.0
        assert data[1]["index_name"] == "NASDAQ"
        assert data[1]["current_price"] == 0.0
        assert data[1]["change_rate"] == 0.0
        assert data[2]["index_name"] == "DOW JONES"
        assert data[2]["current_price"] == 0.0
        assert data[2]["change_rate"] == 0.0

def test_get_market_indices_invalid_country():
    """지원하지 않는 국가 코드가 입력된 경우 400 에러를 반환하는지 확인합니다."""
    response = client.get("/api/market/indices?country=JP")
    assert response.status_code == 400
    assert "지원하지 않는 국가 코드" in response.json()["detail"]

@pytest.mark.parametrize(
    "date_str, country, expected_holiday, expected_desc",
    [
        # 1. 주말 판정 (2026-06-14 일요일)
        ("2026-06-14", "KR", True, "주말"),
        ("2026-06-14", "US", True, "주말"),
        
        # 2. 한국 근로자의 날 (2026-05-01 금요일)
        ("2026-05-01", "KR", True, "근로자의 날"),
        
        # 3. 한국 연말 휴장일 (2026-12-31 목요일 -> 당일 연말 휴장일)
        ("2026-12-31", "KR", True, "연말 휴장일"),
        
        # 4. 한국 연말 휴장일 보정 (2023-12-31 일요일 -> 직전 금요일인 12-29가 연말 휴장일)
        ("2023-12-29", "KR", True, "연말 휴장일"),
        ("2023-12-31", "KR", True, "주말"),  # 주말 판정이 우선됨
        
        # 5. 한국 일반 공휴일 (2026-08-15 광복절은 토요일이라 주말로 걸리므로 평일인 2026-10-09 한글날 금요일)
        ("2026-10-09", "KR", True, "한글날"),
        
        # 6. 한국 제헌절 (7월 17일 - 영업일이어야 함)
        ("2026-07-17", "KR", False, "영업일"),
        
        # 7. 미국 성금요일 (2026-04-03 금요일)
        ("2026-04-03", "US", True, "성금요일"),
        
        # 8. 미국 추수감사절 (2026-11-26 목요일)
        ("2026-11-26", "US", True, "추수감사절"),
        
        # 9. 일반 영업일 (2026-06-16 화요일)
        ("2026-06-16", "KR", False, "영업일"),
        ("2026-06-16", "US", False, "영업일"),
    ]
)
def test_check_market_holiday(date_str, country, expected_holiday, expected_desc):
    """지정된 날짜와 국가에 대해 휴장일 여부 및 사유가 정확히 반환되는지 검증합니다."""
    response = client.get(f"/api/market/holiday?date={date_str}&country={country}")
    assert response.status_code == 200
    
    data = response.json()
    assert data["date"] == date_str
    assert data["country"] == country.upper()
    assert data["is_holiday"] == expected_holiday
    assert data["description"] == expected_desc

def test_check_market_holiday_invalid_date():
    """날짜 형식이 올바르지 않은 경우 400 에러를 반환하는지 확인합니다."""
    response = client.get("/api/market/holiday?date=2026/06/14")
    assert response.status_code == 400
    assert "날짜 형식" in response.json()["detail"]

def test_check_market_holiday_invalid_country():
    """지원하지 않는 국가 코드가 입력된 경우 400 에러를 반환하는지 확인합니다."""
    response = client.get("/api/market/holiday?country=JP")
    assert response.status_code == 400
    assert "국가 코드" in response.json()["detail"]
