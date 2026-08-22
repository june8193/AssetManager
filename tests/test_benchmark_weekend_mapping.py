# -*- coding: utf-8 -*-
"""주말 및 공휴일 스냅샷의 영업일 매핑 및 벤치마크 수익률 정합성 검증 테스트 모듈입니다."""

import pytest
import datetime
from sqlalchemy.orm import Session

from src.backend.models import AccountSnapshot, HistoricalPrice
from src.backend.market import MarketDataProvider, MarketCalendar, FakeMarketAdapter
from src.backend.services.benchmark_service import BenchmarkService


@pytest.fixture
def fake_market_provider(db_session: Session):
    """테스트용 FakeMarketAdapter가 설정된 MarketDataProvider를 제공합니다."""
    kr_adapter = FakeMarketAdapter()
    us_adapter = FakeMarketAdapter()
    return MarketDataProvider(
        db=db_session,
        calendar=MarketCalendar(),
        kr_adapter=kr_adapter,
        us_adapter=us_adapter
    )


@pytest.fixture
def benchmark_service(db_session: Session, fake_market_provider: MarketDataProvider):
    """테스트용 BenchmarkService 인스턴스를 제공합니다."""
    return BenchmarkService(db_session, provider=fake_market_provider)


@pytest.mark.asyncio
async def test_weekend_snapshot_mapped_to_preceding_trading_day(benchmark_service, db_session):
    """주말(일요일)에 작성된 스냅샷이 직전 유효 영업일(금요일)로 정상 매핑되어 계산되는지 검증"""
    # 1. 2026-06-15(월) 기초 스냅샷 및 2026-06-21(일) 주말 스냅샷
    snap_base = AccountSnapshot(
        account_id=1,
        snapshot_date=datetime.date(2026, 6, 15),
        period_deposit=0.0,
        total_valuation=10000000.0,
        total_profit=0.0
    )
    # 일요일에 자산이 1,100만 원(수익 100만 원, 입금 0)으로 상승한 스냅샷
    snap_weekend = AccountSnapshot(
        account_id=1,
        snapshot_date=datetime.date(2026, 6, 21),
        period_deposit=0.0,
        total_valuation=11000000.0,
        total_profit=1000000.0
    )
    db_session.add_all([snap_base, snap_weekend])

    # 2. 영업일 지수 데이터 (6/15 월 ~ 6/19 금)
    trading_dates = [
        datetime.date(2026, 6, 15),
        datetime.date(2026, 6, 16),
        datetime.date(2026, 6, 17),
        datetime.date(2026, 6, 18),
        datetime.date(2026, 6, 19),
    ]
    for d in trading_dates:
        p = HistoricalPrice(
            ticker="^KS11",
            price_date=d,
            close_price=2500.0
        )
        db_session.add(p)
    db_session.commit()

    # 3. 누적 수익률 계산
    result = await benchmark_service.calculate_cumulative_returns(
        start_date=datetime.date(2026, 6, 15),
        end_date=datetime.date(2026, 6, 21),
        tickers=["^KS11"]
    )

    # 4. 검증: 금요일(2026-06-19) 슬롯에 일요일 스냅샷(10% ROI)이 매핑되어 반영되어야 함
    labels = result["labels"]
    assert "2026-06-19" in labels
    portfolio_dataset = next(ds for ds in result["datasets"] if ds["label"] == "내 포트폴리오")
    p_returns = portfolio_dataset["data"]

    # 6/15(월)=0.0, 6/19(금)=10.0 (주말 스냅샷 매핑됨)
    fri_idx = labels.index("2026-06-19")
    assert p_returns[fri_idx] == 10.0

    # 알파 요약에서도 최종 포트폴리오 수익률이 10.0%로 집계되어야 함
    alpha_summary = result["alpha_summaries"][0]
    assert alpha_summary["portfolio_return"] == 10.0
    assert result["portfolio_final_valuation"] == 11000000.0


@pytest.mark.asyncio
async def test_multiple_snapshots_on_weekend_aggregation(benchmark_service, db_session):
    """동일 영업일 슬롯에 금/토/일 복수 스냅샷 매핑 시 최신 평가액 채택 및 입금액 구간 합산 검증"""
    # 기초 스냅샷 (월)
    snap_base = AccountSnapshot(
        account_id=1,
        snapshot_date=datetime.date(2026, 6, 15),
        period_deposit=0.0,
        total_valuation=10000000.0,
        total_profit=0.0
    )
    # 금요일 스냅샷: 1000만
    snap_fri = AccountSnapshot(
        account_id=1,
        snapshot_date=datetime.date(2026, 6, 19),
        period_deposit=0.0,
        total_valuation=10000000.0,
        total_profit=0.0
    )
    # 토요일 스냅샷: 100만 입금, 평가액 1100만
    snap_sat = AccountSnapshot(
        account_id=1,
        snapshot_date=datetime.date(2026, 6, 20),
        period_deposit=1000000.0,
        total_valuation=11000000.0,
        total_profit=0.0
    )
    # 일요일 스냅샷: 50만 추가 입금, 50만 투자수익, 평가액 1200만
    snap_sun = AccountSnapshot(
        account_id=1,
        snapshot_date=datetime.date(2026, 6, 21),
        period_deposit=500000.0,
        total_valuation=12000000.0,
        total_profit=500000.0
    )
    db_session.add_all([snap_base, snap_fri, snap_sat, snap_sun])

    for d in [datetime.date(2026, 6, 15), datetime.date(2026, 6, 19)]:
        p = HistoricalPrice(ticker="^KS11", price_date=d, close_price=2500.0)
        db_session.add(p)
    db_session.commit()

    result = await benchmark_service.calculate_cumulative_returns(
        start_date=datetime.date(2026, 6, 15),
        end_date=datetime.date(2026, 6, 21),
        tickers=["^KS11"]
    )

    # 순수익 = 1200만(일요일 최종) - 150만(토/일 누적입금) - 1000만(기초) = 50만
    # 분모 = 1000만 + 150만 = 1150만
    # ROI = (50만 / 1150만) * 100 = 4.35%
    portfolio_dataset = next(ds for ds in result["datasets"] if ds["label"] == "내 포트폴리오")
    fri_idx = result["labels"].index("2026-06-19")
    assert portfolio_dataset["data"][fri_idx] == 4.35
    assert result["portfolio_final_valuation"] == 12000000.0
