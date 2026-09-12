# -*- coding: utf-8 -*-
"""텔레그램 메시지 서식 렌더링 및 변환을 담당하는 모듈입니다.

수신된 자산 데이터를 모바일 화면에 최적화하여 표 서식 대신 불릿(•)과 이모지(💰, 📅, 📊, 🔍, 📝, 📈 등)
형태의 마크다운 서식으로 변환합니다.
"""

import collections
import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..asset_client.models import (
        AssetRatiosResponse,
        AssetSummaryResponse,
        DailyStatsResponse,
        TransactionsResponse,
        YearlyStatsResponse,
    )


class MessageRenderer:
    """도메인 모델 데이터를 텔레그램 규격 마크다운 메시지로 렌더링하는 클래스입니다."""

    @staticmethod
    def _format_currency_amount(
        price: float,
        total_amount: float,
        currency: str,
        exchange_rate: float | None = None,
        quantity: float | None = None,
    ) -> str:
        """통화별 단가, 총액 및 원화 환산 텍스트를 공통 포맷팅하는 헬퍼 함수입니다.

        Args:
            price: 거래 단가
            total_amount: 총 거래 금액
            currency: 통화 코드 (KRW, USD 등)
            exchange_rate: 적용 환율 (선택 사항)
            quantity: 매수/매도 수량 (선택 사항)

        Returns:
            포맷팅된 금액 및 환율 표시 문자열
        """
        currency_unit = "원" if currency == "KRW" else f" {currency}"

        exch_str = ""
        if currency != "KRW" and exchange_rate:
            krw_total = total_amount * exchange_rate
            exch_str = f" (환율 {exchange_rate:,.1f}원 | 원화 환산 {krw_total:,.0f}원)"

        if quantity is not None and quantity > 0:
            return f"\n  {quantity:,.2f}주 @ {price:,.2f}{currency_unit} | 총 {total_amount:,.2f}{currency_unit}{exch_str}"
        else:
            return f"\n  총 {total_amount:,.2f}{currency_unit}{exch_str}"

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

    @staticmethod
    def render_transactions(tx_resp: "TransactionsResponse", limit: int = 5) -> str:
        """최근 거래내역 목록을 모바일 최적화 마크다운 메시지로 렌더링합니다.

        Args:
            tx_resp: 거래 내역 목록 응답 모델 객체
            limit: 표시할 최대 거래 개수 (기본 5개)

        Returns:
            마크다운 포맷의 최근 거래내역 메시지 문자열
        """
        transactions = list(tx_resp.transactions)
        transactions.sort(key=lambda x: (x.transaction_date, x.id or 0), reverse=True)
        recent_txs = transactions[:limit]

        if not recent_txs:
            return "📝 최근 거래 내역이 없습니다."

        type_map = {
            "BUY": "🔴 매수",
            "SELL": "🔵 매도",
            "DIVIDEND": "💰 배당",
            "DEPOSIT": "📥 입금",
            "WITHDRAW": "📤 출금",
            "INITIAL_BALANCE": "🏁 초기잔고",
            "INTEREST": "💵 이자",
            "TAX": "💸 세금",
            "CASH_ADJUSTMENT": "⚖️ 현금조정",
            "EXCHANGE": "💱 환전",
            "TRANSFER": "🔄 이체",
        }

        tx_items: list[str] = []
        for tx in recent_txs:
            date_str = tx.transaction_date
            type_kor = type_map.get(tx.type, tx.type)
            acc_display = f" | {tx.account_display_name}" if tx.account_display_name else ""

            asset_info = ""
            if tx.asset_name:
                ticker_info = f" ({tx.asset_ticker})" if tx.asset_ticker else ""
                asset_info = f" - {tx.asset_name}{ticker_info}"

            is_buy_sell = tx.type in ["BUY", "SELL"] and tx.quantity > 0
            qty_param = tx.quantity if is_buy_sell else None
            amt_str = MessageRenderer._format_currency_amount(
                price=tx.price,
                total_amount=tx.total_amount,
                currency=tx.currency,
                exchange_rate=tx.exchange_rate,
                quantity=qty_param,
            )

            memo_str = f" [{tx.memo}]" if tx.memo else ""
            tx_items.append(
                f"• [{date_str}] **{type_kor}**{acc_display}{asset_info}{memo_str}{amt_str}"
            )

        tx_section = "\n".join(tx_items)
        return f"📝 **최근 거래 내역 (최근 {len(recent_txs)}건)**\n{tx_section}"

    @staticmethod
    def render_yearly_stats(yearly_resp: "YearlyStatsResponse") -> str:
        """연도별 자산 및 투자 수익 통계를 마크다운 메시지로 렌더링합니다.

        Args:
            yearly_resp: 연도별 자산 현황 통계 응답 모델 객체

        Returns:
            마크다운 포맷의 연도별 통계 메시지 문자열
        """
        stats = list(yearly_resp.stats)
        stats.sort(key=lambda x: x.year, reverse=True)

        if not stats:
            return "📅 연도별 자산 통계 데이터가 없습니다."

        yearly_items: list[str] = []
        for y in stats:
            profit_sign = "+" if y.profit >= 0 else ""
            inc_sign = "+" if y.increase >= 0 else ""
            yearly_items.append(
                f"• **{y.year}년**:\n"
                f"  - 기말 자산: {y.assets:,.0f}원 (전년비 {inc_sign}{y.increase:,.0f}원)\n"
                f"  - 투자 수익: {profit_sign}{y.profit:,.0f}원 ({y.roi:+.1f}%)\n"
                f"  - 순 투자금 추가액: {y.contribution:,.0f}원"
            )

        yearly_section = "\n".join(yearly_items)
        return f"📅 **연도별 자산 및 투자 수익 현황**\n{yearly_section}"

    @staticmethod
    def render_daily_stats(daily_resp: "DailyStatsResponse", days: int = 7) -> str:
        """일별 자산 스냅샷 통계를 마크다운 메시지로 렌더링합니다.

        Args:
            daily_resp: 일별 자산 현황 통계 응답 모델 객체
            days: 최근 조회 영업일 수 (기본 7일)

        Returns:
            마크다운 포맷의 일별 통계 메시지 문자열
        """
        stats = list(daily_resp.stats)
        stats.sort(key=lambda x: x.date, reverse=True)

        if not stats:
            return "📈 일별 스냅샷 데이터가 없습니다."

        recent_daily = stats[:days]

        daily_items: list[str] = []
        for d in recent_daily:
            try:
                dt = datetime.datetime.strptime(d.date, "%Y-%m-%d")
                weekday_map = ["월", "화", "수", "목", "금", "토", "일"]
                weekday_str = weekday_map[dt.weekday()]
                date_display = f"{d.date[5:]} ({weekday_str})"
            except Exception:
                date_display = d.date

            profit_sign = "+" if d.profit >= 0 else ""
            dep_str = f" | 입출금: {d.contribution:,.0f}원" if d.contribution != 0 else ""

            daily_items.append(
                f"• {date_display}: 자산 {d.assets:,.0f}원 | "
                f"수익 {profit_sign}{d.profit:,.0f}원 ({d.roi:+.2f}%){dep_str}"
            )

        daily_section = "\n".join(daily_items)
        return f"📈 **일별 자산 및 투자 수익 현황 (최근 {len(recent_daily)}영업일 스냅샷)**\n{daily_section}"


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


def render_transactions(tx_resp: "TransactionsResponse", limit: int = 5) -> str:
    """MessageRenderer.render_transactions의 단축 편의 함수입니다.

    Args:
        tx_resp: 거래 내역 목록 응답 모델 객체
        limit: 표시할 최대 거래 개수 (기본 5개)

    Returns:
        마크다운 포맷 문자열
    """
    return MessageRenderer.render_transactions(tx_resp, limit=limit)


def render_yearly_stats(yearly_resp: "YearlyStatsResponse") -> str:
    """MessageRenderer.render_yearly_stats의 단축 편의 함수입니다.

    Args:
        yearly_resp: 연도별 자산 현황 통계 응답 모델 객체

    Returns:
        마크다운 포맷 문자열
    """
    return MessageRenderer.render_yearly_stats(yearly_resp)


def render_daily_stats(daily_resp: "DailyStatsResponse", days: int = 7) -> str:
    """MessageRenderer.render_daily_stats의 단축 편의 함수입니다.

    Args:
        daily_resp: 일별 자산 현황 통계 응답 모델 객체
        days: 최근 조회 영업일 수 (기본 7일)

    Returns:
        마크다운 포맷 문자열
    """
    return MessageRenderer.render_daily_stats(daily_resp, days=days)
