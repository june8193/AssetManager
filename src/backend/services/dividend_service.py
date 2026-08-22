# -*- coding: utf-8 -*-
"""배당 수령 내역 집계, 연환산 산식 및 종목별 배당률 계산 서비스 모듈입니다."""

import datetime
from typing import Dict, List, Any
from sqlalchemy.orm import Session
from sqlalchemy import extract
from ..models import Asset, Transaction, ExchangeRate, HistoricalPrice

class DividendService:
    """배당 데이터 분석 및 집계를 담당하는 서비스 클래스"""

    def __init__(self, db: Session):
        self.db = db

    def get_latest_usd_rate(self) -> float:
        """가장 최근 저장된 USD/KRW 환율을 조회합니다. 없으면 1350.0 기본값 반환."""
        rate_obj = self.db.query(ExchangeRate).filter(ExchangeRate.currency == "USD").order_by(ExchangeRate.date.desc()).first()
        return rate_obj.rate if rate_obj else 1350.0

    def get_dividend_summary(self) -> Dict[str, Any]:
        """총 누적 배당금, YTD 배당금, 평균 배당률 및 월별 수령/누적 시계열을 반환합니다."""
        usd_rate = self.get_latest_usd_rate()
        current_year = datetime.date.today().year

        # 투자 자산(현금 제외)에 귀속된 배당/분배금(INTEREST) 및 배당소득세(TAX) 거래내역만 조회
        transactions = (
            self.db.query(Transaction)
            .join(Asset, Transaction.asset_id == Asset.id)
            .filter(
                Transaction.type.in_(["INTEREST", "TAX"]),
                Asset.major_category != "현금",
                Asset.ticker.notin_(["KRW", "USD"])
            )
            .all()
        )

        total_krw = 0.0
        ytd_krw = 0.0
        monthly_map: Dict[str, float] = {}

        for tx in transactions:
            tx_amount_krw = tx.total_amount if tx.currency == "KRW" else tx.total_amount * usd_rate
            if tx.type == "TAX":
                tx_amount_krw = -tx_amount_krw

            total_krw += tx_amount_krw

            if tx.transaction_date.year == current_year:
                ytd_krw += tx_amount_krw
                month_key = tx.transaction_date.strftime("%Y-%m")
                monthly_map[month_key] = monthly_map.get(month_key, 0.0) + tx_amount_krw

        # 월별 시계열 데이터 정렬 및 누적 계산
        sorted_months = sorted(monthly_map.keys())
        monthly_data = []
        cum_val = 0.0
        for m in sorted_months:
            amt = monthly_map[m]
            cum_val += amt
            monthly_data.append({
                "month": m,
                "amount": round(amt, 2),
                "cumulative": round(cum_val, 2)
            })

        # 평균 연간 배당률 계산 (종목별 배당률의 평균 또는 포트폴리오 기준)
        stock_analysis = self.get_stock_dividend_analysis()
        active_yields = [s["yield_current"] for s in stock_analysis if s["yield_current"] > 0]
        avg_yield = round(sum(active_yields) / len(active_yields), 2) if active_yields else 0.0

        current_month = datetime.date.today().month
        monthly_avg = round(ytd_krw / current_month, 2) if current_month > 0 else 0.0

        return {
            "total_krw": round(total_krw, 2),
            "ytd_krw": round(ytd_krw, 2),
            "avg_yield": avg_yield,
            "monthly_avg": monthly_avg,
            "monthly_data": monthly_data
        }

    def get_stock_dividend_analysis(self) -> List[Dict[str, Any]]:
        """각 종목별 YTD 배당 수령액, 추정 연배당금, 시가 배당률 및 누적 배당금을 계산합니다."""
        usd_rate = self.get_latest_usd_rate()
        current_year = datetime.date.today().year
        current_month = datetime.date.today().month

        # 투자 자산(현금 제외)만 조회
        assets = (
            self.db.query(Asset)
            .filter(
                Asset.major_category != "현금",
                Asset.ticker.notin_(["KRW", "USD"])
            )
            .all()
        )
        result = []

        for asset in assets:
            # 최신 역사적 종가 조회
            hp_obj = self.db.query(HistoricalPrice).filter(
                HistoricalPrice.ticker == asset.ticker
            ).order_by(HistoricalPrice.price_date.desc()).first()
            current_price = hp_obj.close_price if hp_obj else 0.0

            # 통화 결정
            currency = "USD" if asset.country == "US" else "KRW"

            # 해당 자산의 모든 INTEREST 및 TAX 거래내역
            txs = self.db.query(Transaction).filter(
                Transaction.asset_id == asset.id,
                Transaction.type.in_(["INTEREST", "TAX"])
            ).all()

            # 가장 최근 BUY 거래내역에서 매수가(buy_price) 추정 (없으면 0.0)
            buy_tx = self.db.query(Transaction).filter(
                Transaction.asset_id == asset.id,
                Transaction.type == "BUY"
            ).order_by(Transaction.transaction_date.desc()).first()
            buy_price = buy_tx.price if buy_tx else 0.0

            ytd_amount = 0.0
            cumulative_amount = 0.0

            for tx in txs:
                amt = tx.total_amount if tx.type == "INTEREST" else -tx.total_amount
                cumulative_amount += amt
                if tx.transaction_date.year == current_year:
                    ytd_amount += amt

            # 연환산 추정 배당금: (YTD / current_month) * 12
            if ytd_amount > 0 and current_month > 0:
                annual_estimate = (ytd_amount / current_month) * 12
            else:
                annual_estimate = 0.0

            # 시가 배당률: (annual_estimate / current_price) * 100
            if annual_estimate > 0 and current_price > 0:
                yield_current = (annual_estimate / current_price) * 100
            else:
                yield_current = 0.0

            # 매수가 대비 배당률 (YoC)
            if annual_estimate > 0 and buy_price > 0:
                yield_cost = (annual_estimate / buy_price) * 100
            else:
                yield_cost = 0.0

            result.append({
                "id": asset.id,
                "name": asset.name,
                "ticker": asset.ticker,
                "major_category": asset.major_category,
                "sub_category": asset.sub_category,
                "currency": currency,
                "current_price": current_price,
                "buy_price": buy_price,
                "ytd_amount": round(ytd_amount, 2),
                "annual_estimate": round(annual_estimate, 2),
                "yield_current": round(yield_current, 2),
                "yield_cost": round(yield_cost, 2),
                "cumulative": round(cumulative_amount, 2)
            })

        return result
