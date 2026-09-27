# -*- coding: utf-8 -*-
"""동적 리밸런싱 전략 프리셋(Simulation Preset) CRUD REST API 테스트 모듈입니다."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def test_get_presets_returns_default_recommended_preset(client: TestClient, db_session: Session):
    """DB가 비어있을 때 GET /api/simulation/presets 호출 시 기본 추천 프리셋을 자동 제공하는지 검증합니다."""
    response = client.get("/api/simulation/presets")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1

    default_preset = next((p for p in data if p.get("is_default") is True), None)
    assert default_preset is not None
    assert "기본 추천" in default_preset["name"]
    assert default_preset["base_stock_ratio"] == 60.0
    assert default_preset["rebalancing_period"] == "monthly"
    assert default_preset["investment_mode"] == "recurring"
    assert default_preset["period"] == "5Y"
    assert len(default_preset["tiers"]) == 3
    assert default_preset["tiers"][0]["target_stock_ratio"] == 75.0


def test_create_preset_success_and_validation(client: TestClient, db_session: Session):
    """새로운 전략 프리셋을 생성하고, 중복 이름 및 유효하지 않은 입력에 대해 적절히 거부하는지 검증합니다."""
    # 1. 정상 생성
    new_preset_payload = {
        "name": "공포지수 2단계 공격형",
        "description": "변동성 확대 시 주식을 80%, 100%까지 공격적으로 매수하는 전략",
        "base_stock_ratio": 70.0,
        "rebalancing_period": "yearly",
        "investment_mode": "lump_sum",
        "annual_deposit": 0.0,
        "period": "10Y",
        "tiers": [
            {"tier": 1, "dd_threshold": -15.0, "vix_threshold": 28.0, "target_stock_ratio": 85.0},
            {"tier": 2, "dd_threshold": -25.0, "vix_threshold": 35.0, "target_stock_ratio": 100.0},
        ],
    }

    create_res = client.post("/api/simulation/presets", json=new_preset_payload)
    assert create_res.status_code in [200, 201]
    created = create_res.json()
    assert created["id"] is not None
    assert created["name"] == "공포지수 2단계 공격형"
    assert created["base_stock_ratio"] == 70.0
    assert len(created["tiers"]) == 2

    # 2. 동일 이름 중복 생성 시 400 Bad Request
    duplicate_res = client.post("/api/simulation/presets", json=new_preset_payload)
    assert duplicate_res.status_code == 400
    assert duplicate_res.json()["detail"] is not None

    # 3. 비정상 주식 비중 (100% 초과)
    invalid_ratio_payload = dict(new_preset_payload)
    invalid_ratio_payload["name"] = "비정상 비중 전략"
    invalid_ratio_payload["base_stock_ratio"] = 120.0
    invalid_res = client.post("/api/simulation/presets", json=invalid_ratio_payload)
    assert invalid_res.status_code in [400, 422]

    # 4. 비정상 티어 주식 비중
    invalid_tier_payload = dict(new_preset_payload)
    invalid_tier_payload["name"] = "비정상 티어 전략"
    invalid_tier_payload["tiers"] = [
        {"tier": 1, "dd_threshold": -10.0, "vix_threshold": 25.0, "target_stock_ratio": -5.0}
    ]
    invalid_tier_res = client.post("/api/simulation/presets", json=invalid_tier_payload)
    assert invalid_tier_res.status_code in [400, 422]


def test_update_preset_success_and_errors(client: TestClient, db_session: Session):
    """기존 프리셋 정보를 수정하고 존재하지 않는 ID 및 중복 이름 수정 시 예외를 검증합니다."""
    # 프리셋 1 생성
    p1_res = client.post(
        "/api/simulation/presets",
        json={
            "name": "전략 A",
            "description": "초기 전략",
            "base_stock_ratio": 50.0,
            "rebalancing_period": "monthly",
            "investment_mode": "recurring",
            "annual_deposit": 10000000.0,
            "period": "5Y",
            "tiers": [{"tier": 1, "dd_threshold": -10.0, "vix_threshold": 25.0, "target_stock_ratio": 70.0}],
        },
    )
    assert p1_res.status_code in [200, 201]
    p1 = p1_res.json()

    # 프리셋 2 생성
    p2_res = client.post(
        "/api/simulation/presets",
        json={
            "name": "전략 B",
            "description": "두번째 전략",
            "base_stock_ratio": 60.0,
            "rebalancing_period": "monthly",
            "investment_mode": "recurring",
            "annual_deposit": 10000000.0,
            "period": "5Y",
            "tiers": [{"tier": 1, "dd_threshold": -10.0, "vix_threshold": 25.0, "target_stock_ratio": 80.0}],
        },
    )
    assert p2_res.status_code in [200, 201]
    p2 = p2_res.json()

    preset_id = p1["id"]

    # 1. 정상 업데이트
    update_res = client.put(
        f"/api/simulation/presets/{preset_id}",
        json={
            "name": "전략 A 수정본",
            "description": "설명 업데이트",
            "base_stock_ratio": 55.0,
        },
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["name"] == "전략 A 수정본"
    assert updated["description"] == "설명 업데이트"
    assert updated["base_stock_ratio"] == 55.0

    # 2. 다른 프리셋(전략 B)과 중복된 이름으로 수정 시 400
    dup_update = client.put(
        f"/api/simulation/presets/{preset_id}",
        json={"name": "전략 B"},
    )
    assert dup_update.status_code == 400

    # 3. 존재하지 않는 ID 수정 시 404
    not_found_res = client.put(
        "/api/simulation/presets/999999",
        json={"name": "유령 전략"},
    )
    assert not_found_res.status_code == 404


def test_delete_preset_success_and_errors(client: TestClient, db_session: Session):
    """프리셋을 삭제하고 목록에서 제거되었는지 검증합니다."""
    # 먼저 기본 프리셋 로드 보장
    init_res = client.get("/api/simulation/presets")
    assert init_res.status_code == 200

    # 신규 프리셋 생성
    create_res = client.post(
        "/api/simulation/presets",
        json={
            "name": "삭제 대상 전략",
            "description": "곧 삭제됩니다",
            "base_stock_ratio": 60.0,
            "rebalancing_period": "monthly",
            "investment_mode": "recurring",
            "annual_deposit": 10000000.0,
            "period": "5Y",
            "tiers": [],
        },
    )
    assert create_res.status_code in [200, 201]
    preset_id = create_res.json()["id"]

    # 정상 삭제
    del_res = client.delete(f"/api/simulation/presets/{preset_id}")
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # 재삭제 시도 시 404
    del_again = client.delete(f"/api/simulation/presets/{preset_id}")
    assert del_again.status_code == 404

    # 목록 조회 시 해당 프리셋 없음 확인
    list_res = client.get("/api/simulation/presets")
    ids = [p["id"] for p in list_res.json()]
    names = [p["name"] for p in list_res.json()]
    assert preset_id not in ids
    assert "삭제 대상 전략" not in names

    # 기본 추천 프리셋 삭제 시도 시 400 거부 확인
    default_id = next(p["id"] for p in list_res.json() if p.get("is_default"))
    del_default = client.delete(f"/api/simulation/presets/{default_id}")
    assert del_default.status_code == 400
    assert "기본 추천 프리셋" in del_default.json()["detail"]

