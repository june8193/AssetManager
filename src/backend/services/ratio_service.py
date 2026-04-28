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

    async def get_hierarchy(self) -> List[Dict[str, Any]]:
        """계층형 데이터 구조(Major > Sub > Stock)를 반환합니다.
        
        Returns:
            List[Dict[str, Any]]: 계층형 데이터
        """
        # 1. 현재 자산 현황 가져오기
        dashboard_data = await self.dashboard_service.get_dashboard_summary()
        current_total = dashboard_data["total_valuation_krw"]
        
        # 2. 목표 비중 설정 가져오기
        target_ratios = self.db.query(TargetRatio).all()
        major_targets = {r.category_name: r for r in target_ratios if r.category_type == "major"}
        sub_targets = {r.category_name: r for r in target_ratios if r.category_type == "sub"}

        # 3. 계층 구조 생성
        # Dashboard data provides: accounts, categories (major), total_valuation_krw
        
        # 자산들을 major > sub 로 그룹화
        asset_tree = {} # major -> sub -> list of assets
        for acc in dashboard_data["accounts"]:
            for asset in acc["assets"]:
                major_cat = asset["category"]
                sub_cat = asset["sub_category"]
                
                if major_cat not in asset_tree:
                    asset_tree[major_cat] = {}
                if sub_cat not in asset_tree[major_cat]:
                    asset_tree[major_cat][sub_cat] = []
                
                # 중복 자산 합산 (여러 계좌에 있을 수 있음)
                existing_asset = next((a for a in asset_tree[major_cat][sub_cat] if a["ticker"] == asset["ticker"]), None)
                if existing_asset:
                    existing_asset["quantity"] += asset["quantity"]
                    existing_asset["valuation_krw"] += asset["valuation_krw"]
                else:
                    asset_tree[major_cat][sub_cat].append({
                        "ticker": asset["ticker"],
                        "name": asset["name"],
                        "quantity": asset["quantity"],
                        "price": asset["price"],
                        "valuation_krw": asset["valuation_krw"]
                    })

        # 4. 최종 트리 구성
        hierarchy = []
        all_major_names = set(major_targets.keys()) | set(asset_tree.keys())
        
        for major_name in all_major_names:
            major_target = major_targets.get(major_name)
            major_asset_data = asset_tree.get(major_name, {})
            
            # 대분류의 총 가치 계산
            major_current_value = sum(
                sum(a["valuation_krw"] for a in sub_assets)
                for sub_assets in major_asset_data.values()
            )
            
            major_node = {
                "category_name": major_name,
                "category_type": "major",
                "target_percentage": major_target.target_percentage if major_target else 0.0,
                "current_value": major_current_value,
                "current_ratio": (major_current_value / current_total * 100.0) if current_total > 0 else 0.0,
                "children": []
            }
            
            # 중분류 (해당 대분류 하위의 목표 비중 또는 현재 자산)
            all_sub_names = {name for name, r in sub_targets.items() if r.parent_category == major_name} | set(major_asset_data.keys())
            
            for sub_name in all_sub_names:
                sub_target = sub_targets.get(sub_name)
                sub_assets = major_asset_data.get(sub_name, [])
                
                sub_current_value = sum(a["valuation_krw"] for a in sub_assets)
                
                sub_node = {
                    "category_name": sub_name,
                    "category_type": "sub",
                    "target_percentage": sub_target.target_percentage if sub_target else 0.0,
                    "current_value": sub_current_value,
                    "current_ratio": (sub_current_value / major_current_value * 100.0) if major_current_value > 0 else 0.0,
                    "children": sorted(sub_assets, key=lambda x: x["valuation_krw"], reverse=True)
                }
                major_node["children"].append(sub_node)
            
            # 중분류 정렬 (평가액 순)
            major_node["children"].sort(key=lambda x: x["current_value"], reverse=True)
            hierarchy.append(major_node)
            
        # 대분류 정렬 (평가액 순)
        hierarchy.sort(key=lambda x: x["current_value"], reverse=True)
        
        return hierarchy

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
        """목표 비중 설정을 업데이트하거나 생성(Upsert)합니다."""
        # 1. 현재 DB에 저장된 모든 목표 비중 가져오기
        existing_targets = self.db.query(TargetRatio).all()
        existing_map = {(t.category_name, t.category_type): t for t in existing_targets}
        
        # 2. 업데이트 또는 추가된 항목 처리
        for r in ratios:
            key = (r["category_name"], r["category_type"])
            
            if key in existing_map:
                target = existing_map[key]
                target.target_percentage = r["target_percentage"]
                target.parent_category = r.get("parent_category")
                target.mode = r.get("mode", "absolute")
            else:
                new_target = TargetRatio(
                    category_name=r["category_name"],
                    category_type=r["category_type"],
                    target_percentage=r["target_percentage"],
                    parent_category=r.get("parent_category"),
                    mode=r.get("mode", "absolute")
                )
                self.db.add(new_target)
        
        self.db.commit()
