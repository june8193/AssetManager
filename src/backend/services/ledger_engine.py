"""단일 원장 엔진(LedgerEngine) 모듈.

트랜잭션(Transaction) 10종 거래 이벤트를 단일 진실 공급원(Single Source of Truth)으로 순회하여
보유 주식 수량(Holdings), 통화별 예수금(KRW/USD Cash), 누적 입출금액을 결정론적으로 계산합니다.
"""

from __future__ import annotations
import datetime
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence
from sqlalchemy.orm import Session, joinedload
from src.backend.models import Asset, Transaction


@dataclass
class LedgerState:
    """원장 순회 결과의 불변 상태를 나타내는 데이터 클래스."""

    holdings: Dict[str, float] = field(default_factory=dict)
    cash_krw: float = 0.0
    cash_usd: float = 0.0
    accumulated_deposits_krw: float = 0.0
    accumulated_withdrawals_krw: float = 0.0
    accumulated_deposits_usd: float = 0.0
    accumulated_withdrawals_usd: float = 0.0

    @property
    def cash_balances(self) -> Dict[str, float]:
        """기존 코드 호환성을 위한 통화별 잔고 딕셔너리를 반환합니다."""
        return {"KRW": self.cash_krw, "USD": self.cash_usd}


class LedgerEngine:
    """단일 원장 계산 엔진.
    
    순수 메모리 연산 코어(replay)와 데이터베이스 연동 헬퍼(get_positions)를 모두 제공하는 Deep 모듈입니다.
    """

    @staticmethod
    def replay(
        transactions: Sequence[Transaction],
        as_of: Optional[datetime.date] = None,
        account_id: Optional[int] = None,
        asset_map: Optional[Dict[int, Asset]] = None,
    ) -> LedgerState:
        """트랜잭션 시퀀스를 시간 순으로 순회하여 LedgerState를 산출합니다 (순수 함수형 코어).

        Args:
            transactions (Sequence[Transaction]): 순회할 트랜잭션 리스트
            as_of (Optional[datetime.date]): 기준 일자 (해당 일자 이하 거래만 계산)
            account_id (Optional[int]): 특정 계좌 필터링 (지정 시 해당 계좌만 계산)
            asset_map (Optional[Dict[int, Asset]]): 자산 ID -> Asset 매핑 (tx.asset이 로드되지 않은 경우 사용)

        Returns:
            LedgerState: 계산된 보유 종목 수량 및 통화별 예수금 상태
        """
        # 1. 일자 및 계좌 필터링
        filtered_txs: List[Transaction] = []
        for tx in transactions:
            if as_of is not None and tx.transaction_date and tx.transaction_date > as_of:
                continue
            if account_id is not None and tx.account_id != account_id:
                continue
            filtered_txs.append(tx)

        # 2. 시간 순서로 정렬 (동일 일자일 경우 ID 오름차순)
        sorted_txs = sorted(
            filtered_txs,
            key=lambda x: (x.transaction_date or datetime.date.min, x.id or 0),
        )

        # 3. 통화별 최신 INITIAL_BALANCE 기준선 일자 수집
        initial_balance_dates: Dict[str, datetime.date] = {}
        for tx in sorted_txs:
            if tx.type == "INITIAL_BALANCE" and tx.currency and tx.transaction_date:
                curr = tx.currency
                if curr not in initial_balance_dates or tx.transaction_date > initial_balance_dates[curr]:
                    initial_balance_dates[curr] = tx.transaction_date

        holdings_qty: Dict[str, float] = {}
        cash_krw = 0.0
        cash_usd = 0.0
        accum_dep_krw = 0.0
        accum_wdr_krw = 0.0
        accum_dep_usd = 0.0
        accum_wdr_usd = 0.0

        # 4. 원장 리플레이 순회
        for tx in sorted_txs:
            # Asset 객체 해석 (관계 속성 또는 asset_map 활용)
            asset = getattr(tx, "asset", None)
            tx_asset_id = getattr(tx, "asset_id", None)
            if not asset and asset_map and tx_asset_id:
                asset = asset_map.get(tx_asset_id)

            target_asset = getattr(tx, "target_asset", None)
            tx_target_asset_id = getattr(tx, "target_asset_id", None)
            if not target_asset and asset_map and tx_target_asset_id:
                target_asset = asset_map.get(tx_target_asset_id)

            curr = getattr(tx, "currency", None) or (asset.ticker if asset and asset.ticker in ["KRW", "USD"] else "KRW")
            t_type = getattr(tx, "type", None)
            amount = float(getattr(tx, "total_amount", 0.0) or 0.0)
            qty = float(getattr(tx, "quantity", 0.0) or 0.0)
            tx_date = getattr(tx, "transaction_date", None)

            # --- A. 예수금(현금) 계산 ---
            # INITIAL_BALANCE 기준선 체크: 해당 통화의 기준선 일자 이전(<) 거래는 현금 합산에서 제외
            ib_date = initial_balance_dates.get(curr)
            is_cash_skipped = bool(ib_date and tx_date and tx_date < ib_date)

            def apply_cash(currency: str, delta: float):
                nonlocal cash_krw, cash_usd
                if currency == "KRW":
                    cash_krw += delta
                elif currency == "USD":
                    cash_usd += delta

            if not is_cash_skipped:
                if t_type == "EXCHANGE":
                    # 환전: 출금 통화 차감, 입금 통화 가산
                    src_ticker = asset.ticker if asset else curr
                    tgt_ticker = target_asset.ticker if target_asset else None
                    apply_cash(src_ticker, -amount)
                    if tgt_ticker:
                        apply_cash(tgt_ticker, qty)

                elif t_type in ["DEPOSIT", "INTEREST", "CASH_ADJUSTMENT"]:
                    apply_cash(curr, amount)
                    if t_type == "DEPOSIT":
                        if curr == "KRW":
                            accum_dep_krw += amount
                        elif curr == "USD":
                            accum_dep_usd += amount

                elif t_type == "INITIAL_BALANCE":
                    # INITIAL_BALANCE는 해당 자산이 현금(KRW, USD)인 경우에만 가산
                    is_cash_asset = (asset and asset.ticker in ["KRW", "USD"]) or (curr in ["KRW", "USD"])
                    if is_cash_asset:
                        apply_cash(curr, amount)

                elif t_type in ["WITHDRAW", "TAX"]:
                    apply_cash(curr, -amount)
                    if t_type == "WITHDRAW":
                        if curr == "KRW":
                            accum_wdr_krw += amount
                        elif curr == "USD":
                            accum_wdr_usd += amount

                elif t_type == "BUY":
                    # 주식 매수는 해당 통화 현금 차감
                    apply_cash(curr, -amount)

                elif t_type == "SELL":
                    # 주식 매도는 해당 통화 현금 가산
                    apply_cash(curr, amount)

            # --- B. 주식/일반 자산 수량 계산 ---
            # 현금 자산(KRW, USD)이 아닌 경우 주식 수량 누적 (CASH_ADJUSTMENT는 현금 전용이므로 제외)
            ticker = asset.ticker if asset else None
            if ticker and ticker not in ["KRW", "USD"]:
                if t_type in ["BUY", "DEPOSIT", "INITIAL_BALANCE"]:
                    holdings_qty[ticker] = holdings_qty.get(ticker, 0.0) + qty
                elif t_type in ["SELL", "WITHDRAW", "TAX"]:
                    holdings_qty[ticker] = holdings_qty.get(ticker, 0.0) - qty

        # 5. 수량이 0보다 큰 활성 보유 종목만 필터링
        active_holdings = {k: v for k, v in holdings_qty.items() if v > 0.000001}

        return LedgerState(
            holdings=active_holdings,
            cash_krw=cash_krw,
            cash_usd=cash_usd,
            accumulated_deposits_krw=accum_dep_krw,
            accumulated_withdrawals_krw=accum_wdr_krw,
            accumulated_deposits_usd=accum_dep_usd,
            accumulated_withdrawals_usd=accum_wdr_usd,
        )

    @classmethod
    def get_positions(
        cls,
        db: Session,
        account_id: Optional[int] = None,
        as_of: Optional[datetime.date] = None,
    ) -> LedgerState:
        """데이터베이스에서 트랜잭션을 조회하여 기준 시점의 포지션(LedgerState)을 반환합니다.

        Args:
            db (Session): SQLAlchemy 데이터베이스 세션
            account_id (Optional[int]): 특정 계좌 ID (None일 경우 전체 계좌)
            as_of (Optional[datetime.date]): 기준 일자 (None일 경우 오늘 기준)

        Returns:
            LedgerState: 특정 시점의 보유 주식 수량 및 예수금 잔액 상태
        """
        query = db.query(Transaction).options(
            joinedload(Transaction.asset),
            joinedload(Transaction.target_asset),
        )

        if as_of is not None:
            query = query.filter(Transaction.transaction_date <= as_of)
        if account_id is not None:
            query = query.filter(Transaction.account_id == account_id)

        transactions = query.order_by(
            Transaction.transaction_date.asc(),
            Transaction.id.asc(),
        ).all()

        # Eager load 되지 않은 경우 대비하여 Asset 맵 전달
        all_assets = db.query(Asset).all()
        asset_map = {a.id: a for a in all_assets}

        return cls.replay(
            transactions=transactions,
            as_of=as_of,
            account_id=account_id,
            asset_map=asset_map,
        )
