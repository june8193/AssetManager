# -*- coding: utf-8 -*-
"""환율 분석(USD/KRW + DXY) 서비스 및 API 엔드포인트 테스트 모듈입니다."""

import datetime
from unittest.mock import AsyncMock, patch
import pytest

from src.backend.models import ExchangeRate, HistoricalPrice
from src.backend.services.market_analysis_service import MarketAnalysisService


def _make_fake_get_hist(db_session):
    """DB 세션에서 HistoricalPrice를 조회하는 테스트용 비동기 헬퍼를 생성합니다."""

    async def _fake_get_hist(ticker, s_dt, e_dt):
        return (
            db_session.query(HistoricalPrice)
            .filter(
                HistoricalPrice.ticker == ticker,
                HistoricalPrice.price_date >= s_dt,
                HistoricalPrice.price_date <= e_dt,
            )
            .order_by(HistoricalPrice.price_date.asc())
            .all()
        )

    return _fake_get_hist


@pytest.mark.asyncio
async def test_exchange_rate_analysis_hybrid_unification(db_session):
    """kiwoom_start_date 이전은 USDKRW=X(backfill), 이후는 100% exchange_rates(kiwoom)만 사용하는지 검증합니다."""
    # 백필 구간(2026-04-17 ~ 2026-04-18) 및 키움 이후 더미(2026-04-19 ~ 2026-04-20, 의도적으로 다른 값)
    backfill_rows = [
        (datetime.date(2026, 4, 17), 1300.0),
        (datetime.date(2026, 4, 18), 1310.0),
        (datetime.date(2026, 4, 19), 9999.0),  # 키움 구간이므로 무시되어야 함
        (datetime.date(2026, 4, 20), 9999.0),  # 키움 구간이므로 무시되어야 함
    ]
    for dt, val in backfill_rows:
        db_session.add(HistoricalPrice(ticker="USDKRW=X", price_date=dt, close_price=val))

    # 키움 API 데이터 (2026-04-19부터)
    db_session.add(ExchangeRate(date=datetime.date(2026, 4, 19), currency="USD", rate=1320.0))
    db_session.add(ExchangeRate(date=datetime.date(2026, 4, 20), currency="USD", rate=1330.0))

    # DXY 데이터 (4/18은 결측 -> 4/17 값 Forward-fill 검증)
    db_session.add(HistoricalPrice(ticker="DX-Y.NYB", price_date=datetime.date(2026, 4, 17), close_price=102.0))
    db_session.add(HistoricalPrice(ticker="DX-Y.NYB", price_date=datetime.date(2026, 4, 19), close_price=103.5))
    db_session.commit()

    service = MarketAnalysisService(db_session)

    with patch.object(service.benchmark_service, "get_historical_prices", side_effect=_make_fake_get_hist(db_session)):
        result = await service.get_exchange_rate_analysis(
            datetime.date(2026, 4, 17), datetime.date(2026, 4, 20)
        )

    assert result["labels"] == ["2026-04-17", "2026-04-18", "2026-04-19", "2026-04-20"]
    assert result["rates"] == [1300.0, 1310.0, 1320.0, 1330.0]
    assert result["sources"] == ["backfill", "backfill", "kiwoom", "kiwoom"]
    assert result["dxy"] == [102.0, 102.0, 103.5, 103.5]
    assert result["is_weekly"] is False
    assert result["summary"]["kiwoom_start_date"] == "2026-04-19"


@pytest.mark.asyncio
async def test_exchange_rate_analysis_high_low_stats_and_flat_edge_case(db_session):
    """고점 대비 하락, 저점 대비 상승, 레인지 위치(%) 및 고점==저점 엣지케이스를 검증합니다."""
    rows = [
        (datetime.date(2026, 5, 1), 1300.0),  # 저점
        (datetime.date(2026, 5, 2), 1400.0),  # 고점
        (datetime.date(2026, 5, 3), 1350.0),  # 현재
    ]
    for dt, val in rows:
        db_session.add(ExchangeRate(date=dt, currency="USD", rate=val))
    db_session.commit()

    service = MarketAnalysisService(db_session)
    with patch.object(service.benchmark_service, "get_historical_prices", new_callable=AsyncMock, return_value=[]):
        result = await service.get_exchange_rate_analysis(
            datetime.date(2026, 5, 1), datetime.date(2026, 5, 3)
        )

    s = result["summary"]
    assert s["latest_date"] == "2026-05-03"
    assert s["latest_rate"] == 1350.0
    assert s["high_rate"] == 1400.0
    assert s["high_date"] == "2026-05-02"
    assert s["from_high_amount"] == -50.0
    assert s["from_high_rate"] == round((-50.0 / 1400.0) * 100, 2)
    assert s["low_rate"] == 1300.0
    assert s["low_date"] == "2026-05-01"
    assert s["from_low_amount"] == 50.0
    assert s["from_low_rate"] == round((50.0 / 1300.0) * 100, 2)
    assert s["range_position_pct"] == 50.0

    # 고점 == 저점 엣지케이스 (range_position_pct == 50.0)
    db_session.query(ExchangeRate).delete()
    db_session.add(ExchangeRate(date=datetime.date(2026, 6, 1), currency="USD", rate=1350.0))
    db_session.add(ExchangeRate(date=datetime.date(2026, 6, 2), currency="USD", rate=1350.0))
    db_session.commit()

    with patch.object(service.benchmark_service, "get_historical_prices", new_callable=AsyncMock, return_value=[]):
        flat_res = await service.get_exchange_rate_analysis(
            datetime.date(2026, 6, 1), datetime.date(2026, 6, 2)
        )
    assert flat_res["summary"]["range_position_pct"] == 50.0


@pytest.mark.asyncio
async def test_exchange_rate_analysis_weekly_downsampling(db_session):
    """3년 초과(1095일 초과) 및 200건 초과 시 주간 다운샘플링(is_weekly=True)이 적용되는지 검증합니다."""
    start = datetime.date(2022, 1, 1)
    for i in range(250):
        dt = start + datetime.timedelta(days=i * 5)
        db_session.add(ExchangeRate(date=dt, currency="USD", rate=1300.0 + (i % 20)))
        db_session.add(HistoricalPrice(ticker="DX-Y.NYB", price_date=dt, close_price=100.0 + (i % 5)))
    db_session.commit()

    end = start + datetime.timedelta(days=250 * 5)
    service = MarketAnalysisService(db_session)

    with patch.object(service.benchmark_service, "get_historical_prices", side_effect=_make_fake_get_hist(db_session)):
        res = await service.get_exchange_rate_analysis(start, end)

    assert res["is_weekly"] is True
    assert len(res["labels"]) < 250
    assert len(res["labels"]) == len(res["rates"]) == len(res["dxy"]) == len(res["sources"])


def test_exchange_rate_analysis_endpoint(client, db_session):
    """GET /api/market/analysis/exchange-rate 정상 응답(200) 및 잘못된 날짜(400)를 검증합니다."""
    db_session.add(ExchangeRate(date=datetime.date(2026, 11, 19), currency="USD", rate=1338.0))
    db_session.add(ExchangeRate(date=datetime.date(2026, 11, 20), currency="USD", rate=1334.79))
    db_session.commit()

    with patch(
        "src.backend.services.benchmark_service.BenchmarkService.get_historical_prices",
        new_callable=AsyncMock,
        return_value=[],
    ):
        resp = client.get("/api/market/analysis/exchange-rate?start_date=2026-11-01&end_date=2026-11-20")
        assert resp.status_code == 200
        data = resp.json()
        assert data["labels"] == ["2026-11-19", "2026-11-20"]
        assert data["summary"]["latest_rate"] == 1334.79

        bad_resp = client.get("/api/market/analysis/exchange-rate?start_date=invalid-date")
        assert bad_resp.status_code == 400
