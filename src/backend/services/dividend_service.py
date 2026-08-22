# -*- coding: utf-8 -*-
"""배당 수령 내역 집계, 연환산 산식 및 종목별 배당률 계산 서비스 모듈입니다."""

import datetime
from typing import Dict, List, Any
from sqlalchemy.orm import Session
from sqlalchemy import extract
from ..models import Asset, Transaction, ExchangeRate, HistoricalPrice
from .ledger_engine import LedgerEngine

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

        # 평균 연간 배당률 계산 (배당 목적 자산군: 중분류 '배당주' + 대분류 '채권'의 총 평가액 대비 TTM 배당금 가중평균)
        stock_analysis = self.get_stock_dividend_analysis()
        target_stocks = [
            s for s in stock_analysis
            if s.get("sub_category") == "배당주" or s.get("major_category") == "채권"
        ]
        total_target_val_krw = 0.0
        total_target_div_krw = 0.0
        for s in target_stocks:
            rate = usd_rate if s.get("currency") == "USD" else 1.0
            total_target_val_krw += (s.get("current_price", 0.0) * s.get("quantity", 0.0)) * rate
            total_target_div_krw += s.get("ttm_amount", 0.0) * rate

        avg_yield = round((total_target_div_krw / total_target_val_krw) * 100, 2) if total_target_val_krw > 0 else 0.0

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
        """각 종목별 YTD 수령액, 최근 12개월(TTM) 실수령 배당금, 시가 배당률 및 매수가 대비 배당률을 계산합니다."""
        usd_rate = self.get_latest_usd_rate()
        today = datetime.date.today()
        current_year = today.year
        ttm_start_date = today - datetime.timedelta(days=365)

        # 원장 엔진을 통한 현재 보유 수량 조회
        positions_state = LedgerEngine.get_positions(self.db, as_of=today)
        holdings = positions_state.holdings

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

            # 현재 보유 수량
            quantity = float(holdings.get(asset.ticker, 0.0))

            # 해당 자산의 모든 INTEREST 및 TAX 거래내역
            txs = self.db.query(Transaction).filter(
                Transaction.asset_id == asset.id,
                Transaction.type.in_(["INTEREST", "TAX"])
            ).all()

            # 매수 가중평균 단가(buy_price) 산출 (BUY 및 INITIAL_BALANCE 기준)
            buy_txs = self.db.query(Transaction).filter(
                Transaction.asset_id == asset.id,
                Transaction.type.in_(["BUY", "INITIAL_BALANCE"])
            ).all()
            total_buy_qty = sum(float(tx.quantity or 0.0) for tx in buy_txs if (tx.quantity or 0) > 0)
            total_buy_amt = sum(float(tx.total_amount or 0.0) for tx in buy_txs if (tx.total_amount or 0) > 0)
            buy_price = (total_buy_amt / total_buy_qty) if total_buy_qty > 0 else 0.0

            ytd_amount = 0.0
            cumulative_amount = 0.0
            ttm_amount = 0.0

            for tx in txs:
                amt = tx.total_amount if tx.type == "INTEREST" else -tx.total_amount
                cumulative_amount += amt
                if tx.transaction_date.year == current_year:
                    ytd_amount += amt
                if ttm_start_date <= tx.transaction_date <= today:
                    ttm_amount += amt

            # 최근 12개월(TTM) 시가 배당률 산출
            # 총 평가액(current_price * quantity) 대비 TTM 배당금 비율
            valuation = current_price * quantity
            if valuation > 0 and ttm_amount > 0:
                yield_ttm_current = (ttm_amount / valuation) * 100
            else:
                yield_ttm_current = 0.0

            # 최근 12개월(TTM) 매수가 대비 배당률 (YoC) 산출
            total_cost = buy_price * quantity
            if total_cost > 0 and ttm_amount > 0:
                yield_ttm_cost = (ttm_amount / total_cost) * 100
            else:
                yield_ttm_cost = 0.0

            result.append({
                "id": asset.id,
                "name": asset.name,
                "ticker": asset.ticker,
                "major_category": asset.major_category,
                "sub_category": asset.sub_category,
                "currency": currency,
                "quantity": quantity,
                "current_price": current_price,
                "buy_price": round(buy_price, 2),
                "ytd_amount": round(ytd_amount, 2),
                "ttm_amount": round(ttm_amount, 2),
                "yield_ttm_current": round(yield_ttm_current, 2),
                "yield_ttm_cost": round(yield_ttm_cost, 2),
                "cumulative": round(cumulative_amount, 2),
                # 프론트엔드/기존 호환용 필드
                "annual_estimate": round(ttm_amount, 2),
                "yield_current": round(yield_ttm_current, 2),
                "yield_cost": round(yield_ttm_cost, 2)
            })

        return result
