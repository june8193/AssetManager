# -*- coding: utf-8 -*-
"""텔레그램 메시지 서식 렌더링 및 변환을 담당하는 모듈입니다.

수신된 자산 데이터를 모바일 화면에 최적화하여 표 서식 대신 불릿(•)과 이모지(💰, 📅, 📊, 🔍 등)
형태의 마크다운 서식으로 변환합니다.
"""

import collections
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..asset_client.models import (
        AssetRatiosResponse,
        AssetSummaryResponse,
    )


class MessageRenderer:
    """도메인 모델 데이터를 텔레그램 규격 마크다운 메시지로 렌더링하는 클래스입니다."""

    @staticmethod
    def render_asset_summary(summary: "AssetSummaryResponse") -> str:
        """통합 자산 현황 정보를 모바일 최적화 마크다운 메시지로 렌더링합니다.

        Args:
            summary: 자산 요약 응답 모델 객체

        Returns:
            마크다운 포맷의 자산 현황 및 기준 정보 메시지 문자열
        """
        total_val = summary.total_valuation_krw
        total_principal = summary.total_principal
        total_profit = summary.total_profit
        roi = summary.cumulative_roi
        profit_sign = "+" if total_profit >= 0 else ""

        summary_section = (
            "💰 **통합 자산 현황**\n"
            f"• 총 평가자산: {total_val:,.0f}원\n"
            f"• 총 투자원금: {total_principal:,.0f}원\n"
            f"• 누적 투자수익: {profit_sign}{total_profit:,.0f}원 ({roi:.1f}%)"
        )

        exch_info = summary.exchange_rate or {}
        exch_date = exch_info.get("date", "알 수 없음")
        exch_rate = exch_info.get("rate", 1.0)
        price_date = summary.latest_price_date

        info_section = (
            "📅 **기준 정보**\n"
            f"• 환율 기준일: {exch_date} (적용 환율: {exch_rate:,.1f}원)\n"
            f"• 주가 기준일: {price_date} (최신 DB 가격 데이터 기준)"
        )

        return f"{summary_section}\n\n{info_section}"

    @staticmethod
    def render_asset_ratios(ratios: "AssetRatiosResponse") -> str:
        """자산군별 비중 및 목표 비중 리밸런싱 정보를 마크다운 메시지로 렌더링합니다.

        Args:
            ratios: 자산군별 비중 및 리밸런싱 정보 모델 객체

        Returns:
            마크다운 포맷의 자산 비중 안내 메시지 문자열
        """
        major_items: list[str] = []
        for item in ratios.major_results:
            diff_sign = "+" if item.diff_amt >= 0 else ""
            major_items.append(
                f"• {item.category}: {item.current_ratio:.1f}% ({item.current_amt:,.0f}원) "
                f"[목표: {item.target_percentage:.1f}% | 차액: {diff_sign}{item.diff_amt:,.0f}원]"
            )
        major_section = "\n".join(major_items) if major_items else "• 등록된 대분류 비중 데이터가 없습니다."

        sub_groups: dict[str, list] = collections.defaultdict(list)
        for item in ratios.sub_results:
            parent = item.parent_category or "기타"
            sub_groups[parent].append(item)

        sub_sections: list[str] = []
        for parent, items in sub_groups.items():
            sub_items = []
            for item in items:
                diff_sign = "+" if item.diff_amt >= 0 else ""
                sub_items.append(
                    f"  - {item.category}: {item.current_ratio:.1f}% ({item.current_amt:,.0f}원) "
                    f"[목표: {item.target_percentage:.1f}% | 차액: {diff_sign}{item.diff_amt:,.0f}원]"
                )
            sub_sections.append(f"[{parent}]\n" + "\n".join(sub_items))
        sub_section = "\n\n".join(sub_sections) if sub_sections else "• 등록된 소분류 비중 데이터가 없습니다."

        return (
            "📊 **자산 대분류 비중 및 리밸런싱**\n"
            f"{major_section}\n\n"
            "🔍 **자산 소분류 비중 및 리밸런싱**\n"
            f"{sub_section}\n\n"
            "*(참고: 차액이 +이면 목표 대비 초과 상태, -이면 목표 대비 부족 상태를 뜻합니다.)*"
        )


def render_asset_summary(summary: "AssetSummaryResponse") -> str:
    """MessageRenderer.render_asset_summary의 단축 편의 함수입니다.

    Args:
        summary: 자산 요약 응답 모델 객체

    Returns:
        마크다운 포맷 문자열
    """
    return MessageRenderer.render_asset_summary(summary)


def render_asset_ratios(ratios: "AssetRatiosResponse") -> str:
    """MessageRenderer.render_asset_ratios의 단축 편의 함수입니다.

    Args:
        ratios: 자산군별 비중 및 리밸런싱 모델 객체

    Returns:
        마크다운 포맷 문자열
    """
    return MessageRenderer.render_asset_ratios(ratios)
