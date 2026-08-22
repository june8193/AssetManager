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


@pytest.mark.asyncio
async def test_server_scenario_2026_weekend_snapshot_regression(benchmark_service, db_session):
    """2026년 8월 16일(일요일) 주말 스냅샷이 벤치마크 계산 시 누락되지 않고 8.92%로 정상 산출되는지 회귀 테스트"""
    # 1. 스냅샷 데이터 주입
    snapshots_data = [
        ("2025-12-31", 355351204.0, 14466354.0),
        ("2026-01-31", 380415568.0, 5946253.0),
        ("2026-02-28", 407853408.0, 11170195.0),
        ("2026-03-07", 407361428.0, 4130000.0),
        ("2026-03-29", 404786086.0, 2668535.0),
        ("2026-04-19", 416005915.0, 1000000.0),
        ("2026-05-28", 469360191.52, 9109230.0),
        ("2026-06-06", 469708714.44, 0.0),
        ("2026-06-19", 471332249.84, 0.0),
        ("2026-06-23", 461257329.05, 0.0),      # 화요일 평일 스냅샷 (당시 18.46%)
        ("2026-07-12", 451319204.76, 4423368.0), # 일요일 주말 스냅샷
        ("2026-07-26", 431530624.10, 3730705.0), # 일요일 주말 스냅샷
        ("2026-08-01", 432646763.20, 2575503.0), # 토요일 주말 스냅샷
        ("2026-08-16", 435779436.96, 0.0),      # 일요일 주말 스냅샷 (최신 8.92%)
    ]

    for d_str, val, dep in snapshots_data:
        snap_date = datetime.date.fromisoformat(d_str)
        db_session.add(AccountSnapshot(
            account_id=1,
            snapshot_date=snap_date,
            period_deposit=dep,
            total_valuation=val,
            total_profit=0.0
        ))

    # 2. 지수 시세 주입 (2026-01-02 ~ 2026-08-21 평일 영업일)
    start_date = datetime.date(2026, 1, 1)
    end_date = datetime.date(2026, 8, 22)
    cur = start_date
    while cur <= end_date:
        if cur.weekday() < 5:  # 월~금 평일
            db_session.add(HistoricalPrice(
                ticker="^KS11",
                price_date=cur,
                close_price=2500.0
            ))
        cur += datetime.timedelta(days=1)

    db_session.commit()

    # 3. 누적 수익률 계산
    result = await benchmark_service.calculate_cumulative_returns(
        start_date=start_date,
        end_date=end_date,
        tickers=["^KS11"]
    )

    # 4. 검증: 8/16 주말 스냅샷이 누락되지 않고 최종 포트폴리오 수익률 8.92%로 산출되어야 함!
    alpha_summary = result["alpha_summaries"][0]
    assert alpha_summary["portfolio_return"] == 8.92
    assert round(result["portfolio_final_valuation"]) == 435779437
    assert result["portfolio_latest_snapshot_date"] == "2026-08-16"

    # 비교 테이블에서도 2026년 연간 ROI가 8.92%로 일치해야 함
    tables = await benchmark_service.get_comparison_tables()
    yearly_2026 = next(y for y in tables["yearly"] if y["year"] == 2026)
    assert yearly_2026["roi"] == 8.92

