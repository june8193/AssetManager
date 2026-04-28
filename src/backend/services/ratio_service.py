from sqlalchemy.orm import Session
from ..models import TargetRatio
from .dashboard_service import DashboardService
from typing import Dict, List, Any
import asyncio

class RatioService:
    """자산 배분 비중 및 리밸런싱을 계산하는 서비스 클래스입니다."""

    def __init__(self, db: Session):
        self.db = db
        self.dashboard_service = DashboardService(db)

    async def calculate_rebalancing(self, additional_cash: float = 0.0) -> Dict[str, Any]:
        """목표 비중과 현재 자산을 비교하여 리밸런싱 가이드를 계산합니다.
        
        Args:
            additional_cash (float): 추가로 투자할 금액 (KRW)

        Returns:
            Dict[str, Any]: 리밸런싱 계산 결과
                - total_valuation (float): 현재 총 평가액
                - total_target (float): 목표 총액 (현재 + 추가 투자금)
                - major_results (List[Dict]): 대분류별 계산 결과
                - sub_results (List[Dict]): 중분류별 계산 결과
        """
        # 1. 현재 자산 현황 가져오기
        dashboard_data = await self.dashboard_service.get_dashboard_summary()
        current_total = dashboard_data["total_valuation_krw"]
        total_target = current_total + additional_cash

        # 카테고리별 현재액 맵핑 (편의용)
        major_current_map = {c["category"]: c["value_krw"] for c in dashboard_data["categories"]}
        sub_current_map = {}
        for c in dashboard_data["categories"]:
            for sc in c.get("sub_categories", []):
                sub_current_map[sc["category"]] = sc["value_krw"]

        # 2. 목표 비중 설정 가져오기
        target_ratios = self.db.query(TargetRatio).all()
        major_targets = [r for r in target_ratios if r.category_type == "major"]
        sub_targets = [r for r in target_ratios if r.category_type == "sub"]

        # 3. 대분류 계산
        major_results = []
        major_target_amt_map = {} # 대분류명 -> 목표 금액 (중분류 계산용)

        for tr in major_targets:
            current_amt = major_current_map.get(tr.category_name, 0.0)
            target_amt = total_target * (tr.target_percentage / 100.0)
            major_target_amt_map[tr.category_name] = target_amt
            
            major_results.append({
                "category": tr.category_name,
                "current_amt": current_amt,
                "current_ratio": (current_amt / current_total * 100.0) if current_total > 0 else 0.0,
                "target_percentage": tr.target_percentage,
                "target_amt": target_amt,
                "diff_amt": target_amt - current_amt
            })

        # 4. 중분류 계산
        sub_results = []
        for tr in sub_targets:
            current_amt = sub_current_map.get(tr.category_name, 0.0)
            
            # 중분류는 해당 대분류 목표 금액의 비율로 계산
            parent_target_amt = major_target_amt_map.get(tr.parent_category, 0.0)
            target_amt = parent_target_amt * (tr.target_percentage / 100.0)
            
            sub_results.append({
                "category": tr.category_name,
                "parent_category": tr.parent_category,
                "current_amt": current_amt,
                "current_ratio": (current_amt / parent_target_amt * 100.0) if parent_target_amt > 0 else 0.0,
                "target_percentage": tr.target_percentage,
                "target_amt": target_amt,
                "diff_amt": target_amt - current_amt
            })

        return {
            "total_valuation": current_total,
            "total_target": total_target,
            "additional_cash": additional_cash,
            "major_results": major_results,
            "sub_results": sub_results
        }

    def update_target_ratios(self, ratios: List[Dict[str, Any]]):
        """목표 비중 설정을 업데이트합니다. 
        전달된 목록에 없는 기존 카테고리는 삭제됩니다.
        """
        # 1. 현재 DB에 저장된 모든 목표 비중 가져오기
        existing_targets = self.db.query(TargetRatio).all()
        existing_map = {(t.category_name, t.category_type): t for t in existing_targets}
        
        # 2. 업데이트 또는 추가된 항목 처리
        incoming_keys = set()
        for r in ratios:
            key = (r["category_name"], r["category_type"])
            incoming_keys.add(key)
            
            if key in existing_map:
                target = existing_map[key]
                target.target_percentage = r["target_percentage"]
                target.parent_category = r.get("parent_category")
            else:
                new_target = TargetRatio(
                    category_name=r["category_name"],
                    category_type=r["category_type"],
                    target_percentage=r["target_percentage"],
                    parent_category=r.get("parent_category")
                )
                self.db.add(new_target)
        
        # 3. 전달된 목록에 없는 기존 항목 삭제
        for key, target in existing_map.items():
            if key not in incoming_keys:
                self.db.delete(target)
        
        self.db.commit()
