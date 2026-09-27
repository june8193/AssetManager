import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from ..database import get_db
from ..models import SimulationPreset
from ..schemas.simulation_preset import (
    SimulationPresetCreate,
    SimulationPresetUpdate,
    SimulationPresetResponse,
    TierItemSchema,
)
from ..services.simulation_service import SimulationService

router = APIRouter(
    prefix="/api/simulation",
    tags=["simulation"]
)



class AllocationItem(BaseModel):
    name: str
    stock_ratio: float


class SimulationRequest(BaseModel):
    allocations: List[AllocationItem]
    period: str
    rebalancing: str


class RecurringSimulationRequest(BaseModel):
    allocations: List[AllocationItem]
    period: str
    rebalancing: str
    annual_deposit: float = 20000000.0


class DynamicTierItem(BaseModel):
    tier: int
    dd_threshold: float
    vix_threshold: float
    target_stock_ratio: float


class DynamicSimulationRequest(BaseModel):
    base_stock_ratio: float = 60.0
    period: str = "5Y"
    rebalancing: str = "monthly"
    mode: str = "recurring"
    annual_deposit: float = 20000000.0
    tiers: List[DynamicTierItem] = []


@router.post("/run")
async def run_backtest_simulation(
    request: SimulationRequest,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """주식/현금 비중 및 리밸런싱 설정에 따른 과거 시뮬레이션을 실행하여 결과를 반환합니다."""
    # 유효성 검사
    if not request.allocations:
        raise HTTPException(status_code=400, detail="최소 하나 이상의 비중 조합이 필요합니다.")
        
    for alloc in request.allocations:
        if alloc.stock_ratio < 0 or alloc.stock_ratio > 100:
            raise HTTPException(status_code=400, detail="주식 비중은 0%에서 100% 사이여야 합니다.")

    if request.period not in ["5Y", "10Y", "20Y", "30Y", "ALL"]:
        raise HTTPException(status_code=400, detail="유효하지 않은 기간 설정입니다.")

    if request.rebalancing not in ["monthly", "yearly", "none"]:
        raise HTTPException(status_code=400, detail="유효하지 않은 리밸런싱 주기 설정입니다.")

    # 서비스 실행
    service = SimulationService(db)
    try:
        allocations_list = [{"name": item.name, "stock_ratio": item.stock_ratio} for item in request.allocations]
        result = await service.run_simulation(
            allocations=allocations_list,
            period=request.period,
            rebalancing=request.rebalancing
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"시뮬레이션 수행 중 오류가 발생했습니다: {str(e)}")


@router.post("/run-recurring")
async def run_recurring_backtest_simulation(
    request: RecurringSimulationRequest,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """주식/현금 비중 및 리밸런싱, 매년 추가금에 따른 적립식 시뮬레이션을 실행하여 결과를 반환합니다."""
    # 유효성 검사
    if not request.allocations:
        raise HTTPException(status_code=400, detail="최소 하나 이상의 비중 조합이 필요합니다.")
        
    for alloc in request.allocations:
        if alloc.stock_ratio < 0 or alloc.stock_ratio > 100:
            raise HTTPException(status_code=400, detail="주식 비중은 0%에서 100% 사이여야 합니다.")

    if request.period not in ["5Y", "10Y", "20Y", "30Y", "ALL"]:
        raise HTTPException(status_code=400, detail="유효하지 않은 기간 설정입니다.")

    if request.rebalancing not in ["monthly", "yearly", "none"]:
        raise HTTPException(status_code=400, detail="유효하지 않은 리밸런싱 주기 설정입니다.")

    if request.annual_deposit < 0:
        raise HTTPException(status_code=400, detail="매년 추가 적립금은 0원 이상이어야 합니다.")

    # 서비스 실행
    service = SimulationService(db)
    try:
        allocations_list = [{"name": item.name, "stock_ratio": item.stock_ratio} for item in request.allocations]
        result = await service.run_recurring_simulation(
            allocations=allocations_list,
            period=request.period,
            rebalancing=request.rebalancing,
            annual_deposit=request.annual_deposit
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"적립식 시뮬레이션 수행 중 오류가 발생했습니다: {str(e)}")


@router.post("/run-dynamic")
async def run_dynamic_backtest_simulation(
    request: DynamicSimulationRequest,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """S&P500 낙폭(Drawdown)과 VIX 지수를 활용한 동적 리밸런싱 시뮬레이션을 실행하여 결과를 반환합니다."""
    # 유효성 검사
    if request.base_stock_ratio < 0 or request.base_stock_ratio > 100:
        raise HTTPException(status_code=400, detail="기본 주식 비중은 0%에서 100% 사이여야 합니다.")

    if request.period not in ["5Y", "10Y", "20Y", "30Y", "ALL"]:
        raise HTTPException(status_code=400, detail="유효하지 않은 기간 설정입니다.")

    if request.rebalancing not in ["monthly", "yearly", "none"]:
        raise HTTPException(status_code=400, detail="유효하지 않은 리밸런싱 주기 설정입니다.")

    if request.mode not in ["recurring", "lump_sum"]:
        raise HTTPException(status_code=400, detail="유효하지 않은 투자 모드입니다.")

    if request.annual_deposit < 0:
        raise HTTPException(status_code=400, detail="매년 추가 적립금은 0원 이상이어야 합니다.")

    for t in request.tiers:
        if t.target_stock_ratio < 0 or t.target_stock_ratio > 100:
            raise HTTPException(status_code=400, detail=f"티어 {t.tier}의 목표 주식 비중은 0%에서 100% 사이여야 합니다.")

    service = SimulationService(db)
    try:
        tiers_list = [t.model_dump() for t in request.tiers] if request.tiers else None
        result = await service.run_dynamic_simulation(
            base_stock_ratio=request.base_stock_ratio,
            period=request.period,
            rebalancing=request.rebalancing,
            mode=request.mode,
            annual_deposit=request.annual_deposit,
            tiers=tiers_list,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"동적 리밸런싱 시뮬레이션 수행 중 오류가 발생했습니다: {str(e)}")


@router.get("/compound/snapshot-stats")
async def get_compound_snapshot_stats(
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """사용자의 과거 스냅샷 통계를 기반으로 연평균 수익률 및 연평균 추가금을 계산합니다."""
    service = SimulationService(db)
    try:
        result = await service.get_compound_snapshot_stats()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"스냅샷 통계 계산 중 오류가 발생했습니다: {str(e)}")


DEFAULT_PRESET_DATA = {
    "name": "기본 추천 (3단계 분할매수)",
    "description": "낙폭 -10%/-20%/-30% 및 VIX 25/30/40 결합 3단계 공포 분할매수 전략",
    "base_stock_ratio": 60.0,
    "rebalancing_period": "monthly",
    "investment_mode": "recurring",
    "annual_deposit": 20000000.0,
    "period": "5Y",
    "tiers": [
        {"tier": 1, "dd_threshold": -10.0, "vix_threshold": 25.0, "target_stock_ratio": 75.0},
        {"tier": 2, "dd_threshold": -20.0, "vix_threshold": 30.0, "target_stock_ratio": 90.0},
        {"tier": 3, "dd_threshold": -30.0, "vix_threshold": 40.0, "target_stock_ratio": 100.0},
    ],
}


@router.get("/presets", response_model=List[SimulationPresetResponse])
def get_simulation_presets(db: Session = Depends(get_db)) -> List[SimulationPresetResponse]:
    """저장된 전체 동적 리밸런싱 전략 프리셋 목록을 반환합니다. DB가 비어있다면 기본 추천 프리셋을 자동 생성합니다."""
    presets = db.query(SimulationPreset).order_by(SimulationPreset.id.asc()).all()

    # 등록된 프리셋이 전혀 없는 경우 기본 추천 프리셋을 자동 시딩합니다.
    if not presets:
        default_preset = SimulationPreset(
            name=DEFAULT_PRESET_DATA["name"],
            description=DEFAULT_PRESET_DATA["description"],
            base_stock_ratio=DEFAULT_PRESET_DATA["base_stock_ratio"],
            rebalancing_period=DEFAULT_PRESET_DATA["rebalancing_period"],
            investment_mode=DEFAULT_PRESET_DATA["investment_mode"],
            annual_deposit=DEFAULT_PRESET_DATA["annual_deposit"],
            period=DEFAULT_PRESET_DATA["period"],
            tiers_json=json.dumps(DEFAULT_PRESET_DATA["tiers"], ensure_ascii=False),
        )
        db.add(default_preset)
        db.commit()
        db.refresh(default_preset)
        presets = [default_preset]

    results = []
    for p in presets:
        try:
            tiers_list = json.loads(p.tiers_json) if p.tiers_json else []
        except Exception:
            tiers_list = []
        is_default = (p.name == DEFAULT_PRESET_DATA["name"])
        results.append(
            SimulationPresetResponse(
                id=p.id,
                name=p.name,
                description=p.description,
                base_stock_ratio=p.base_stock_ratio,
                rebalancing_period=p.rebalancing_period,
                investment_mode=p.investment_mode,
                annual_deposit=p.annual_deposit,
                period=p.period,
                tiers=tiers_list,
                is_default=is_default,
                created_at=p.created_at,
                updated_at=p.updated_at,
            )
        )
    return results


@router.post("/presets", response_model=SimulationPresetResponse, status_code=201)
def create_simulation_preset(
    payload: SimulationPresetCreate,
    db: Session = Depends(get_db)
) -> SimulationPresetResponse:
    """새로운 동적 리밸런싱 전략 프리셋을 생성하고 DB에 영구 저장합니다."""
    # 유효성 검사
    if payload.period not in ["5Y", "10Y", "20Y", "30Y", "ALL"]:
        raise HTTPException(status_code=400, detail="유효하지 않은 백테스트 기간 설정입니다.")
    if payload.rebalancing_period not in ["monthly", "yearly", "none"]:
        raise HTTPException(status_code=400, detail="유효하지 않은 리밸런싱 주기 설정입니다.")
    if payload.investment_mode not in ["recurring", "lump_sum"]:
        raise HTTPException(status_code=400, detail="유효하지 않은 투자 운용 방식입니다.")

    for t in payload.tiers:
        if t.target_stock_ratio < 0 or t.target_stock_ratio > 100:
            raise HTTPException(status_code=400, detail=f"티어 {t.tier}의 목표 주식 비중은 0%에서 100% 사이여야 합니다.")

    # 이름 중복 검사
    existing = db.query(SimulationPreset).filter(SimulationPreset.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"'{payload.name}'(이)라는 이름의 전략 프리셋이 이미 존재합니다.")

    new_preset = SimulationPreset(
        name=payload.name,
        description=payload.description,
        base_stock_ratio=payload.base_stock_ratio,
        rebalancing_period=payload.rebalancing_period,
        investment_mode=payload.investment_mode,
        annual_deposit=payload.annual_deposit,
        period=payload.period,
        tiers_json=json.dumps([t.model_dump() for t in payload.tiers], ensure_ascii=False),
    )
    db.add(new_preset)
    db.commit()
    db.refresh(new_preset)

    return SimulationPresetResponse(
        id=new_preset.id,
        name=new_preset.name,
        description=new_preset.description,
        base_stock_ratio=new_preset.base_stock_ratio,
        rebalancing_period=new_preset.rebalancing_period,
        investment_mode=new_preset.investment_mode,
        annual_deposit=new_preset.annual_deposit,
        period=new_preset.period,
        tiers=payload.tiers,
        is_default=False,
        created_at=new_preset.created_at,
        updated_at=new_preset.updated_at,
    )


@router.put("/presets/{preset_id}", response_model=SimulationPresetResponse)
def update_simulation_preset(
    preset_id: int,
    payload: SimulationPresetUpdate,
    db: Session = Depends(get_db)
) -> SimulationPresetResponse:
    """기존 전략 프리셋의 정보를 수정합니다."""
    preset = db.query(SimulationPreset).filter(SimulationPreset.id == preset_id).first()
    if not preset:
        raise HTTPException(status_code=404, detail="해당 프리셋을 찾을 수 없습니다.")

    if payload.name is not None:
        existing = db.query(SimulationPreset).filter(
            SimulationPreset.name == payload.name,
            SimulationPreset.id != preset_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"'{payload.name}'(이)라는 이름의 전략 프리셋이 이미 존재합니다.")
        preset.name = payload.name

    if payload.description is not None:
        preset.description = payload.description

    if payload.base_stock_ratio is not None:
        if payload.base_stock_ratio < 0 or payload.base_stock_ratio > 100:
            raise HTTPException(status_code=400, detail="기본 주식 비중은 0%에서 100% 사이여야 합니다.")
        preset.base_stock_ratio = payload.base_stock_ratio

    if payload.rebalancing_period is not None:
        if payload.rebalancing_period not in ["monthly", "yearly", "none"]:
            raise HTTPException(status_code=400, detail="유효하지 않은 리밸런싱 주기 설정입니다.")
        preset.rebalancing_period = payload.rebalancing_period

    if payload.investment_mode is not None:
        if payload.investment_mode not in ["recurring", "lump_sum"]:
            raise HTTPException(status_code=400, detail="유효하지 않은 투자 운용 방식입니다.")
        preset.investment_mode = payload.investment_mode

    if payload.annual_deposit is not None:
        if payload.annual_deposit < 0:
            raise HTTPException(status_code=400, detail="매년 추가 적립금은 0원 이상이어야 합니다.")
        preset.annual_deposit = payload.annual_deposit

    if payload.period is not None:
        if payload.period not in ["5Y", "10Y", "20Y", "30Y", "ALL"]:
            raise HTTPException(status_code=400, detail="유효하지 않은 백테스트 기간 설정입니다.")
        preset.period = payload.period

    if payload.tiers is not None:
        for t in payload.tiers:
            if t.target_stock_ratio < 0 or t.target_stock_ratio > 100:
                raise HTTPException(status_code=400, detail=f"티어 {t.tier}의 목표 주식 비중은 0%에서 100% 사이여야 합니다.")
        preset.tiers_json = json.dumps([t.model_dump() for t in payload.tiers], ensure_ascii=False)

    db.commit()
    db.refresh(preset)

    tiers_list = json.loads(preset.tiers_json) if preset.tiers_json else []
    return SimulationPresetResponse(
        id=preset.id,
        name=preset.name,
        description=preset.description,
        base_stock_ratio=preset.base_stock_ratio,
        rebalancing_period=preset.rebalancing_period,
        investment_mode=preset.investment_mode,
        annual_deposit=preset.annual_deposit,
        period=preset.period,
        tiers=tiers_list,
        is_default=(preset.name == DEFAULT_PRESET_DATA["name"]),
        created_at=preset.created_at,
        updated_at=preset.updated_at,
    )


@router.delete("/presets/{preset_id}")
def delete_simulation_preset(
    preset_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """기존 전략 프리셋을 삭제합니다."""
    preset = db.query(SimulationPreset).filter(SimulationPreset.id == preset_id).first()
    if not preset:
        raise HTTPException(status_code=404, detail="해당 프리셋을 찾을 수 없습니다.")

    if preset.name == DEFAULT_PRESET_DATA["name"]:
        raise HTTPException(status_code=400, detail="기본 추천 프리셋은 삭제할 수 없습니다.")

    db.delete(preset)
    db.commit()
    return {"success": True, "message": "프리셋이 성공적으로 삭제되었습니다."}


