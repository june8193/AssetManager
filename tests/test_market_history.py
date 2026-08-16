# -*- coding: utf-8 -*-
"""시장 지수 통합 조회 API(history)에 대한 단위 테스트 모듈입니다."""

import datetime
from unittest.mock import patch, MagicMock
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.backend.main import app
from src.backend.models import HistoricalPrice

client = TestClient(app)


def test_get_market_history_missing_tickers():
    """tickers 파라미터가 누락된 경우 422 Unprocessable Entity 에러가 발생하는지 검증합니다."""
    response = client.get("/api/market/history")
    assert response.status_code == 422


def test_get_market_history_success(db_session: Session):
    """지정된 기간 동안의 지수 종가 데이터가 정상적으로 조회되는지 검증합니다."""
    # 1. 테스트용 더미 데이터 DB에 추가 (2026-06-01 ~ 2026-06-03)
    dummy_data = [
        HistoricalPrice(ticker="^KS11", price_date=datetime.date(2026, 6, 1), close_price=2700.0),
        HistoricalPrice(ticker="^KS11", price_date=datetime.date(2026, 6, 2), close_price=2710.0),
        HistoricalPrice(ticker="^KS11", price_date=datetime.date(2026, 6, 3), close_price=2720.0),
        HistoricalPrice(ticker="^GSPC", price_date=datetime.date(2026, 6, 1), close_price=5300.0),
        HistoricalPrice(ticker="^GSPC", price_date=datetime.date(2026, 6, 2), close_price=5310.0),
    ]
    for d in dummy_data:
        db_session.add(d)
    db_session.commit()

    # 2. API 호출
    response = client.get(
        "/api/market/history?tickers=^KS11,^GSPC&start_date=2026-06-01&end_date=2026-06-03"
    )
    assert response.status_code == 200

    data = response.json()

    # 3. 결과 검증
    assert "^KS11" in data
    assert "^GSPC" in data

    ks11_list = data["^KS11"]
    assert len(ks11_list) == 3
    assert ks11_list[0] == {"date": "2026-06-01", "close_price": 2700.0}
    assert ks11_list[1] == {"date": "2026-06-02", "close_price": 2710.0}
    assert ks11_list[2] == {"date": "2026-06-03", "close_price": 2720.0}

    gspc_list = data["^GSPC"]
    assert len(gspc_list) == 2
    assert gspc_list[0] == {"date": "2026-06-01", "close_price": 5300.0}
    assert gspc_list[1] == {"date": "2026-06-02", "close_price": 5310.0}


def test_get_market_history_with_realtime(db_session: Session):
    """조회 범위에 오늘이 포함되고 DB에 캐시되지 않았을 때 yfinance 실시간 시세가 정상 병합되는지 검증합니다."""
    today = datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)

    # 1. 어제 데이터까지만 DB에 추가
    db_session.add(HistoricalPrice(ticker="^KS11", price_date=yesterday, close_price=2700.0))
    db_session.commit()

    # 2. yfinance Tickers 모킹
    with patch("src.backend.routers.market.yf.Tickers") as mock_tickers_cls:
        # 실시간 Tickers mock 인스턴스 설정
        mock_instance = MagicMock()
        mock_tickers_cls.return_value = mock_instance

        mock_ticker_obj = MagicMock()
        mock_ticker_obj.fast_info = {
            "last_price": 2750.0,
            "previous_close": 2700.0
        }
        mock_instance.tickers = {"^KS11": mock_ticker_obj}

        # 3. 오늘을 포함하여 API 호출
        start_str = yesterday.strftime("%Y-%m-%d")
        end_str = today.strftime("%Y-%m-%d")

        response = client.get(
            f"/api/market/history?tickers=^KS11&start_date={start_str}&end_date={end_str}"
        )
        assert response.status_code == 200

        data = response.json()
        assert "^KS11" in data
        ks11_list = data["^KS11"]

        # 어제와 오늘 데이터 두 개가 와야 함
        assert len(ks11_list) == 2
        assert ks11_list[0] == {"date": yesterday.strftime("%Y-%m-%d"), "close_price": 2700.0}

        # 오늘 날짜에 실시간 조회한 2750.0이 들어와야 함
        assert ks11_list[1] == {"date": today.strftime("%Y-%m-%d"), "close_price": 2750.0}
