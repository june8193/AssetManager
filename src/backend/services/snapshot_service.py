"""스냅샷 미리보기, 현금 잔액 산출, 스냅샷 저장 및 마법사 연산을 처리하는 딥 도메인 서비스 모듈입니다."""

from typing import List, Dict, Any, Optional
from datetime import date
from sqlalchemy.orm import Session, joinedload
from ..models import Account, Asset, Transaction, AccountSnapshot, ExchangeRate
from .dashboard_service import DashboardService


class SnapshotService:
    """스냅샷 계산, 미리보기 및 영속화를 담당하는 클래스입니다."""

    def __init__(self, db: Session):
        self.db = db
        self.dashboard_service = DashboardService(db)

    def save_snapshots(self, previews: List[Any], commit: bool = True) -> List[AccountSnapshot]:
        """스냅샷 저장 로직의 구현부입니다. 기존 동일 날짜 스냅샷을 삭제하고 새로 저장합니다."""
        saved_snapshots = []
        for p in previews:
            self.db.query(AccountSnapshot).filter(
                AccountSnapshot.account_id == p.account_id,
                AccountSnapshot.snapshot_date == p.snapshot_date
            ).delete()

            new_snap = AccountSnapshot(
                account_id=p.account_id,
                snapshot_date=p.snapshot_date,
                period_deposit=p.period_deposit,
                total_valuation=p.total_valuation,
                total_profit=p.total_profit
            )
            self.db.add(new_snap)
            saved_snapshots.append(new_snap)

        if commit:
            self.db.commit()
            for snap in saved_snapshots:
                self.db.refresh(snap)
        return saved_snapshots

    def delete_snapshot(self, snapshot_date: date) -> int:
        """특정 일자의 모든 계좌 스냅샷을 삭제합니다."""
        deleted_count = self.db.query(AccountSnapshot).filter(
            AccountSnapshot.snapshot_date == snapshot_date
        ).delete()
        self.db.commit()
        return deleted_count

    async def preview_snapshots(self, snapshot_date: date, exchange_rate: float) -> List[Any]:
        """입력받은 환율을 적용하여 저장될 스냅샷 데이터를 미리 계산합니다."""
        accounts = self.db.query(Account).filter(Account.is_active == True).all()
        if not accounts:
            return []

        # 1. 현재 보유 자산 및 주가 조회
        holdings = self.dashboard_service.get_holdings()
        query_tickers = list(set([h['asset'].ticker for h in holdings]))
        prices = await self.dashboard_service.get_current_prices(query_tickers)

        # 2. 계좌별 평가액 합산 (입력된 환율 적용)
        account_valuations = {acc.id: 0.0 for acc in accounts}
        for h in holdings:
            acc_id = h['account'].id
            asset = h['asset']
            qty = h['quantity']
            price = prices.get(asset.ticker, 0.0)

            valuation = qty * price
            valuation_krw = valuation
            if asset.country == 'US' or asset.ticker == 'USD':
                valuation_krw = valuation * exchange_rate

            if acc_id in account_valuations:
                account_valuations[acc_id] += valuation_krw

        previews = []
        for acc in accounts:
            last_snapshot = self.db.query(AccountSnapshot).filter(
                AccountSnapshot.account_id == acc.id,
                AccountSnapshot.snapshot_date < snapshot_date
            ).order_by(AccountSnapshot.snapshot_date.desc()).first()

            last_date = last_snapshot.snapshot_date if last_snapshot else date(1970, 1, 1)

            txs = self.db.query(Transaction).filter(
                Transaction.account_id == acc.id,
                Transaction.transaction_date > last_date,
                Transaction.transaction_date <= snapshot_date
            ).all()

            period_deposit_krw = 0.0
            for tx in txs:
                if tx.type == 'DEPOSIT':
                    period_deposit_krw += tx.total_amount
                elif tx.type == 'WITHDRAW':
                    period_deposit_krw -= tx.total_amount

            val_krw = account_valuations.get(acc.id, 0.0)

            last_valuation = last_snapshot.total_valuation if last_snapshot else 0.0
            total_profit = val_krw - last_valuation - period_deposit_krw

            period_profit = total_profit
            base_assets = last_valuation + period_deposit_krw
            calculated_return_rate = (period_profit / base_assets * 100) if base_assets != 0 else 0.0

            cash_balances = self.dashboard_service.calculate_theoretical_cash(
                account_id=acc.id,
                snapshot_date=snapshot_date
            )
            current_cash_krw = cash_balances.get('KRW', 0.0) + (cash_balances.get('USD', 0.0) * exchange_rate)

            # Lazy import schema to avoid circular imports
            from ..routers.db_manage import SnapshotPreviewSchema
            previews.append(SnapshotPreviewSchema(
                account_id=acc.id,
                account_name=acc.alias or acc.name,
                snapshot_date=snapshot_date,
                period_deposit=period_deposit_krw,
                total_valuation=val_krw,
                total_profit=total_profit,
                period_profit=period_profit,
                calculated_return_rate=round(calculated_return_rate, 2),
                current_cash=current_cash_krw
            ))

        return previews

    def save_exchange_rate(self, snapshot_date: date, rate: float):
        """스냅샷 적용 환율을 DB에 기록하거나 업데이트합니다."""
        existing_rate = self.db.query(ExchangeRate).filter(ExchangeRate.date == snapshot_date).first()
        if existing_rate:
            existing_rate.rate = rate
        else:
            new_rate = ExchangeRate(date=snapshot_date, rate=rate)
            self.db.add(new_rate)

    def process_brokerage_accounts_logic(self, snapshot_date: date, accounts_data: List[Any], krw_asset_id: int, usd_asset_id: int):
        """증권계좌의 입출금 및 차액 트랜잭션을 일괄 생성합니다."""
        for acc in accounts_data:
            if acc.krw_deposit != 0:
                self.db.add(Transaction(
                    account_id=acc.account_id,
                    asset_id=krw_asset_id,
                    transaction_date=snapshot_date,
                    type='DEPOSIT' if acc.krw_deposit > 0 else 'WITHDRAW',
                    quantity=abs(acc.krw_deposit),
                    price=1.0,
                    total_amount=abs(acc.krw_deposit),
                    currency='KRW',
                    memo='스냅샷 생성 시 추가된 원화 입출금'
                ))

            if acc.usd_deposit != 0:
                self.db.add(Transaction(
                    account_id=acc.account_id,
                    asset_id=usd_asset_id,
                    transaction_date=snapshot_date,
                    type='DEPOSIT' if acc.usd_deposit > 0 else 'WITHDRAW',
                    quantity=abs(acc.usd_deposit),
                    price=1.0,
                    total_amount=abs(acc.usd_deposit),
                    currency='USD',
                    memo='스냅샷 생성 시 추가된 외화 입출금'
                ))

            if acc.krw_diff != 0:
                self.db.add(Transaction(
                    account_id=acc.account_id,
                    asset_id=krw_asset_id,
                    transaction_date=snapshot_date,
                    type='INTEREST' if acc.krw_diff > 0 else 'TAX',
                    quantity=abs(acc.krw_diff),
                    price=1.0,
                    total_amount=abs(acc.krw_diff),
                    currency='KRW',
                    memo='스냅샷 정산 차액 (배당금/수수료 등)'
                ))

            if acc.usd_diff != 0:
                self.db.add(Transaction(
                    account_id=acc.account_id,
                    asset_id=usd_asset_id,
                    transaction_date=snapshot_date,
                    type='INTEREST' if acc.usd_diff > 0 else 'TAX',
                    quantity=abs(acc.usd_diff),
                    price=1.0,
                    total_amount=abs(acc.usd_diff),
                    currency='USD',
                    memo='스냅샷 정산 차액 (배당금/수수료 등)'
                ))

    def process_bank_accounts_logic(self, accounts_data: List[Any], krw_asset_id: int):
        """은행 계좌의 신규 트랜잭션을 일괄 생성합니다."""
        for acc in accounts_data:
            for tx in acc.new_transactions:
                self.db.add(Transaction(
                    account_id=tx.account_id,
                    asset_id=krw_asset_id,
                    transaction_date=tx.transaction_date,
                    type=tx.type,
                    quantity=tx.quantity,
                    price=tx.price,
                    total_amount=tx.total_amount,
                    currency=tx.currency,
                    memo=tx.memo
                ))

    def update_bank_previews_logic(self, previews: List[Any], accounts_data: List[Any]):
        """은행 계좌의 미리보기 데이터를 입력된 실제 잔액으로 갱신합니다."""
        bank_valuation_map = {acc.account_id: acc.current_balance for acc in accounts_data}
        net_deposits = {acc.account_id: acc.net_deposit for acc in accounts_data}

        for p in previews:
            if p.account_id in bank_valuation_map:
                p.total_valuation = bank_valuation_map[p.account_id]
                p.total_profit = p.total_valuation - net_deposits[p.account_id]
