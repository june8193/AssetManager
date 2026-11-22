# -*- coding: utf-8 -*-
"""백그라운드 유지보수 루프의 시장 지표(^VIX, DX-Y.NYB) 1일 1회 동기화 테스트입니다."""

import datetime
from unittest.mock import AsyncMock, patch
import pytest

from src.backend.models import HistoricalPrice
from src.backend.tasks import BackgroundTaskManager


@pytest.mark.asyncio
async def test_sync_market_indicators_backfill_and_skip_same_day(db_session):
    """최초 실행 시 ^VIX와 DX-Y.NYB를 백필 수집하고, 동일 날짜 재호출 시 스킵되는지 검증합니다."""
    manager = BackgroundTaskManager()
    today = datetime.date(2026, 11, 22)

    with patch("src.backend.services.benchmark_service.BenchmarkService.get_historical_prices", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = []

        synced = await manager.sync_market_indicators(db_session, today=today)
        assert synced is True
        assert mock_get.call_count == 2

        called_tickers = [call.args[0] for call in mock_get.call_args_list]
        assert "^VIX" in called_tickers
        assert "DX-Y.NYB" in called_tickers

        # 최초 백필이므로 약 20년 전부터 오늘까지 요청
        for call in mock_get.call_args_list:
            start_dt, end_dt = call.args[1], call.args[2]
            assert end_dt == today
            assert (today - start_dt).days >= 365 * 19

        status = manager.get_task_status()["market_indicator_sync"]
        assert status["status"] == "success"
        assert status["last_error"] is None

        # 동일 날짜 재호출 시 스킵
        mock_get.reset_mock()
        synced_again = await manager.sync_market_indicators(db_session, today=today)
        assert synced_again is False
        mock_get.assert_not_called()


@pytest.mark.asyncio
async def test_sync_market_indicators_incremental_when_cached(db_session):
    """DB에 100건 이상 캐시가 있으면 MAX(price_date) - 5일 범위로 증분 동기화하는지 검증합니다."""
    manager = BackgroundTaskManager()
    today = datetime.date(2026, 11, 22)
    base_date = datetime.date(2026, 6, 1)

    for ticker in ("^VIX", "DX-Y.NYB"):
        for i in range(120):
            db_session.add(
                HistoricalPrice(
                    ticker=ticker,
                    price_date=base_date + datetime.timedelta(days=i),
                    close_price=100.0 + i * 0.1,
                )
            )
    db_session.commit()

    expected_max = base_date + datetime.timedelta(days=119)
    expected_start = expected_max - datetime.timedelta(days=5)

    with patch("src.backend.services.benchmark_service.BenchmarkService.get_historical_prices", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = []
        synced = await manager.sync_market_indicators(db_session, today=today)
        assert synced is True
        assert mock_get.call_count == 2
        for call in mock_get.call_args_list:
            assert call.args[1] == expected_start
            assert call.args[2] == today


@pytest.mark.asyncio
async def test_sync_market_indicators_error_records_failed_status(db_session):
    """지표 동기화 중 예외 발생 시 market_indicator_sync 상태가 failed로 기록되는지 검증합니다."""
    manager = BackgroundTaskManager()
    today = datetime.date(2026, 11, 22)

    with patch(
        "src.backend.services.benchmark_service.BenchmarkService.get_historical_prices",
        new_callable=AsyncMock,
        side_effect=RuntimeError("yfinance network error"),
    ):
        synced = await manager.sync_market_indicators(db_session, today=today)
        assert synced is False

    status = manager.get_task_status()["market_indicator_sync"]
    assert status["status"] == "failed"
    assert "yfinance network error" in status["last_error"]
