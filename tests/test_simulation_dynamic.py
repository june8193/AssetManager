import datetime
import pytest
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from src.backend.main import app
from src.backend.models import HistoricalPrice
from src.backend.services.simulation_service import SimulationService


def test_dynamic_simulation_service_and_tier_trigger(db_session: Session):
    """동적 리밸런싱 서비스가 낙폭(ATH 대비)과 VIX 결합 조건을 만족할 때 비중을 확대하고,
    월말 정기 점검일에 공포가 해소되면 기본 비중으로 복귀하는지 검증합니다.
    """
    # 1. 일별 S&P500(^GSPC) 및 VIX(^VIX) 시세 적재
    # 2025-01-02: Peak 100, VIX 15 (정상) -> 기본 비중 60%
    # 2025-01-03: Close 88 (DD -12%), VIX 26 -> Tier 1 (DD <= -10% AND VIX >= 25) 만족 -> 75% 확대
    # 2025-01-06: Close 78 (DD -22%), VIX 32 -> Tier 2 (DD <= -20% AND VIX >= 30) 만족 -> 90% 확대
    # 2025-01-31: 월말 점검일. Close 95 (DD -5%), VIX 18 -> 공포 해제 -> 기본 비중 60% 복귀
    test_data = [
        (datetime.date(2025, 1, 2), 100.0, 15.0),
        (datetime.date(2025, 1, 3), 88.0, 26.0),
        (datetime.date(2025, 1, 6), 78.0, 32.0),
        (datetime.date(2025, 1, 31), 95.0, 18.0),
    ]
    for p_date, sp_close, vix_close in test_data:
        db_session.add(HistoricalPrice(ticker="^GSPC", price_date=p_date, close_price=sp_close))
        db_session.add(HistoricalPrice(ticker="^VIX", price_date=p_date, close_price=vix_close))
    db_session.commit()

    service = SimulationService(db_session)
    tiers = [
        {"tier": 1, "dd_threshold": -10.0, "vix_threshold": 25.0, "target_stock_ratio": 75.0},
        {"tier": 2, "dd_threshold": -20.0, "vix_threshold": 30.0, "target_stock_ratio": 90.0},
        {"tier": 3, "dd_threshold": -30.0, "vix_threshold": 40.0, "target_stock_ratio": 100.0},
    ]

    import asyncio
    result = asyncio.run(
        service.run_dynamic_simulation(
            base_stock_ratio=60.0,
            period="ALL",
            rebalancing="monthly",
            mode="lump_sum",
            annual_deposit=0.0,
            tiers=tiers,
        )
    )

    # 3개 벤치마크 데이터셋 존재 검증
    assert "chart" in result
    assert "summaries" in result
    assert "rebalancing_events" in result

    datasets = result["chart"]["datasets"]
    assert len(datasets) == 3
    labels = [d["label"] for d in datasets]
    assert "동적 리밸런싱 전략" in labels
    assert "일반 정기 리밸런싱" in labels
    assert "S&P 500 단순 보유" in labels

    summaries = result["summaries"]
    assert len(summaries) == 3
    summary_names = [s["name"] for s in summaries]
    assert "동적 리밸런싱 전략" in summary_names
    assert "일반 정기 리밸런싱" in summary_names
    assert "S&P 500 단순 보유" in summary_names
    assert "volatility" in summaries[0]


    # 리밸런싱 이벤트 검증
    events = result["rebalancing_events"]
    assert len(events) >= 2  # Tier 1, Tier 2 확대 및 월말 복귀 이벤트
    
    # 필수 메타데이터 키 검증
    for ev in events:
        for required_key in ["date", "event_type", "sp500_price", "drawdown", "vix", "old_stock_ratio", "new_stock_ratio"]:
            assert required_key in ev, f"이벤트에 {required_key} 키가 누락되었습니다: {ev}"

    # 이벤트 상세 확인
    tier1_event = next((e for e in events if e.get("new_stock_ratio") == 75.0), None)
    assert tier1_event is not None
    assert tier1_event["date"] == "2025-01-03"
    assert tier1_event["event_type"] == "공포 단계 발동 (티어 1)"
    assert tier1_event["sp500_price"] == 88.0
    assert tier1_event["drawdown"] == -12.0
    assert tier1_event["vix"] == 26.0
    assert tier1_event["old_stock_ratio"] == 56.9

    tier2_event = next((e for e in events if e.get("new_stock_ratio") == 90.0), None)
    assert tier2_event is not None
    assert tier2_event["date"] == "2025-01-06"
    assert tier2_event["event_type"] == "공포 단계 발동 (티어 2)"
    assert tier2_event["drawdown"] == -22.0
    assert tier2_event["vix"] == 32.0

    recovery_event = next((e for e in events if e.get("event_type") == "정기 복귀" or e.get("new_stock_ratio") == 60.0), None)
    assert recovery_event is not None
    assert recovery_event["date"] == "2025-01-31"
    assert recovery_event["event_type"] == "정기 복귀"
    assert recovery_event["new_stock_ratio"] == 60.0

    # 3개 벤치마크 연도별 및 월별 상세 통계 검증
    yearly_stats = result["yearly_stats"]
    monthly_stats = result["monthly_stats"]
    for benchmark_name in ["동적 리밸런싱 전략", "일반 정기 리밸런싱", "S&P 500 단순 보유"]:
        assert benchmark_name in yearly_stats
        assert benchmark_name in monthly_stats
        assert len(yearly_stats[benchmark_name]) > 0
        assert "year" in yearly_stats[benchmark_name][0]
        assert "year_return" in yearly_stats[benchmark_name][0]
        assert "mdd" in yearly_stats[benchmark_name][0]
        assert len(monthly_stats[benchmark_name]) > 0
        assert "month" in monthly_stats[benchmark_name][0]
        assert "month_return" in monthly_stats[benchmark_name][0]
        assert "mdd" in monthly_stats[benchmark_name][0]



def test_dynamic_simulation_api_endpoints(db_session: Session):
    """POST /api/simulation/run-dynamic 엔드포인트가 거치식 및 적립식 모드를 정상 지원하는지 검증합니다."""
    # S&P500 및 VIX 데이터 적재
    base_date = datetime.date(2025, 1, 1)
    for i in range(40):
        p_date = base_date + datetime.timedelta(days=i)
        db_session.add(HistoricalPrice(ticker="^GSPC", price_date=p_date, close_price=100.0 + i))
        db_session.add(HistoricalPrice(ticker="^VIX", price_date=p_date, close_price=20.0))
    db_session.commit()

    client = TestClient(app)

    # 1. 거치식 (lump_sum)
    payload_lump = {
        "base_stock_ratio": 60.0,
        "period": "ALL",
        "rebalancing": "monthly",
        "mode": "lump_sum",
        "annual_deposit": 0.0,
        "tiers": [
            {"tier": 1, "dd_threshold": -10.0, "vix_threshold": 25.0, "target_stock_ratio": 75.0}
        ]
    }
    res_lump = client.post("/api/simulation/run-dynamic", json=payload_lump)
    assert res_lump.status_code == 200, f"Lump sum failed: {res_lump.text}"
    data_lump = res_lump.json()
    assert len(data_lump["summaries"]) == 3
    assert "rebalancing_events" in data_lump
    assert "yearly_stats" in data_lump
    assert "monthly_stats" in data_lump
    for b_name in ["동적 리밸런싱 전략", "일반 정기 리밸런싱", "S&P 500 단순 보유"]:
        assert b_name in data_lump["yearly_stats"]
        assert b_name in data_lump["monthly_stats"]

    # 2. 적립식 (recurring)
    payload_rec = {
        "base_stock_ratio": 70.0,
        "period": "ALL",
        "rebalancing": "monthly",
        "mode": "recurring",
        "annual_deposit": 10000000.0,
        "tiers": []
    }
    res_rec = client.post("/api/simulation/run-dynamic", json=payload_rec)
    assert res_rec.status_code == 200, f"Recurring failed: {res_rec.text}"
    data_rec = res_rec.json()
    assert len(data_rec["summaries"]) == 3
    assert "rebalancing_events" in data_rec
    assert "yearly_stats" in data_rec
    assert "monthly_stats" in data_rec
    for b_name in ["동적 리밸런싱 전략", "일반 정기 리밸런싱", "S&P 500 단순 보유"]:
        assert b_name in data_rec["yearly_stats"]
        assert b_name in data_rec["monthly_stats"]


def test_dynamic_simulation_api_validation(db_session: Session):
    """POST /api/simulation/run-dynamic 엔드포인트의 입력 유효성 검사를 검증합니다."""
    client = TestClient(app)

    # 잘못된 base_stock_ratio
    res = client.post("/api/simulation/run-dynamic", json={"base_stock_ratio": 120.0})
    assert res.status_code == 400

    # 음수 base_stock_ratio
    res = client.post("/api/simulation/run-dynamic", json={"base_stock_ratio": -10.0})
    assert res.status_code == 400

    # 잘못된 period
    res = client.post("/api/simulation/run-dynamic", json={"period": "1Y"})
    assert res.status_code == 400

    # 잘못된 mode
    res = client.post("/api/simulation/run-dynamic", json={"mode": "unknown"})
    assert res.status_code == 400

    # 잘못된 tier (target_stock_ratio > 100)
    res = client.post(
        "/api/simulation/run-dynamic",
        json={
            "tiers": [{"tier": 1, "dd_threshold": -10.0, "vix_threshold": 20.0, "target_stock_ratio": 150.0}]
        }
    )
    assert res.status_code == 400
