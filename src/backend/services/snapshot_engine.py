"""스냅샷 산출, 증권/은행 정산 차액 계산 및 원자적 영속화를 전담하는 딥 도메인 엔진 모듈입니다."""

from typing import List, Optional, Dict, Any, Union
from datetime import date
from sqlalchemy.orm import Session, joinedload

from ..models import Account, Asset, Transaction, AccountSnapshot, ExchangeRate
from ..schemas import (
    TransactionSchema,
    SnapshotPreviewSchema,
    BrokerageCalculateRequest,
    BrokerageCalculateResponse,
    BrokerageSaveAccountRequest,
    BrokerageSaveRequest,
    BankCalculateRequest,
    BankCalculateResponse,
    BankSaveAccountRequest,
    BankSaveRequest,
    UnifiedSaveRequest,
    SnapshotRecalculateRequest,
    SnapshotRecalculateResponse,
    SnapshotRecalculateItemDiff,
)
from .dashboard_service import DashboardService
from .ledger_engine import LedgerEngine
from .transaction_service import TransactionService



class SnapshotEngine:
    """스냅샷 미리보기, 정산 계산 및 단일 DB 트랜잭션 영속화를 캡슐화한 딥 도메인 엔진 클래스입니다."""

    def __init__(self, db: Session):
        """SnapshotEngine 인스턴스를 초기화합니다.
        
        Args:
            db (Session): 데이터베이스 세션.
        """
        self.db = db
        self.dashboard_service = DashboardService(db)

    async def _calculate_non_cash_valuation(
        self,
        account_id: Optional[int],
        exchange_rate: float
    ) -> float:
        """비현금 자산(주식 등)의 실시간 평가액(KRW 환산)을 계산합니다.
        
        Args:
            account_id (Optional[int]): 특정 계좌 ID (None이면 전체 계좌 대상).
            exchange_rate (float): USD/KRW 환율.
            
        Returns:
            float: 원화 환산 비현금 자산 총 평가액.
        """
        holdings = self.dashboard_service.get_holdings()
        if account_id is not None:
            acc_holdings = [h for h in holdings if h['account'].id == account_id and h['asset'].major_category != '현금']
        else:
            acc_holdings = [h for h in holdings if h['asset'].major_category != '현금']

        if not acc_holdings:
            return 0.0

        tickers = list(set([h['asset'].ticker for h in acc_holdings]))
        prices = await self.dashboard_service.get_current_prices(tickers)

        total_val = 0.0
        for h in acc_holdings:
            asset = h['asset']
            qty = h['quantity']
            price = prices.get(asset.ticker, 0.0)
            val = qty * price
            if asset.country == 'US' or asset.ticker == 'USD':
                val = val * exchange_rate
            total_val += val
        return total_val

    def _convert_tx_to_krw(self, tx: Union[Transaction, TransactionSchema], exchange_rate: float) -> float:
        """트랜잭션의 총 금액을 원화(KRW)로 환산하여 반환합니다.
        
        Args:
            tx (Union[Transaction, TransactionSchema]): 트랜잭션 모델 또는 스키마 객체.
            exchange_rate (float): 기본 적용 환율.
            
        Returns:
            float: 원화 환산 금액.
        """
        rate = tx.exchange_rate if tx.exchange_rate else (exchange_rate if tx.currency == 'USD' else 1.0)
        return tx.total_amount * rate if tx.currency == 'USD' else tx.total_amount

    def _create_transaction_from_schema(self, tx_schema: TransactionSchema, asset_id: int) -> Transaction:
        """TransactionSchema 객체로부터 DB Transaction 모델 인스턴스를 생성합니다.
        
        Args:
            tx_schema (TransactionSchema): 트랜잭션 스키마.
            asset_id (int): 대상 자산 ID.
            
        Returns:
            Transaction: DB에 삽입할 Transaction 인스턴스.
        """
        data = tx_schema.model_dump(
            exclude={"id", "asset_name", "asset_ticker", "target_asset_name", "target_asset_ticker", "account_display_name", "warning"}
        )

        data['asset_id'] = asset_id
        if data['quantity'] == 0 and data['total_amount'] != 0:
            data['quantity'] = data['total_amount']
        return Transaction(**data)


    async def preview(self, snapshot_date: date, exchange_rate: float) -> List[SnapshotPreviewSchema]:
        """실시간 시세 및 거래 원장을 기반으로 계좌별 스냅샷 미리보기를 산출합니다.
        
        Args:
            snapshot_date (date): 스냅샷 기준 일자.
            exchange_rate (float): 적용 환율 (USD/KRW).
            
        Returns:
            List[SnapshotPreviewSchema]: 계좌별 미리보기 리스트.
        """
        holdings = self.dashboard_service.get_holdings()
        active_accounts = self.db.query(Account).filter(Account.is_active.is_(True)).all()

        tickers = list(set([h['asset'].ticker for h in holdings if h['asset'].major_category != '현금']))
        prices = await self.dashboard_service.get_current_prices(tickers)

        previews = []
        for acc in active_accounts:
            acc_holdings = [h for h in holdings if h['account'].id == acc.id]

            # 1. 평가액 산출
            val_krw = 0.0
            for h in acc_holdings:
                asset = h['asset']
                qty = h['quantity']
                if asset.major_category == '현금':
                    if asset.ticker == 'KRW':
                        val_krw += qty
                    elif asset.ticker == 'USD':
                        val_krw += qty * exchange_rate
                else:
                    price = prices.get(asset.ticker, 0.0)
                    val = qty * price
                    if asset.country == 'US' or asset.ticker == 'USD':
                        val = val * exchange_rate
                    val_krw += val

            # 2. 직전 스냅샷 조회
            last_snapshot = self.db.query(AccountSnapshot).filter(
                AccountSnapshot.account_id == acc.id,
                AccountSnapshot.snapshot_date < snapshot_date
            ).order_by(AccountSnapshot.snapshot_date.desc()).first()

            last_date = last_snapshot.snapshot_date if last_snapshot else date(1970, 1, 1)

            # 3. 기간 내 입출금 집계
            txs = self.db.query(Transaction).filter(
                Transaction.account_id == acc.id,
                Transaction.transaction_date > last_date,
                Transaction.transaction_date <= snapshot_date
            ).all()

            period_deposit_krw = 0.0
            for t in txs:
                amount_krw = self._convert_tx_to_krw(t, exchange_rate)
                if t.type == 'DEPOSIT':
                    period_deposit_krw += amount_krw
                elif t.type == 'WITHDRAW':
                    period_deposit_krw -= amount_krw

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

            # 정합성 검증 (은행/예금 계좌에서 비정상 수익 발생 감지)
            integrity_warnings = []
            if acc.account_type == 'BANK' and abs(period_profit) > 0.01:
                integrity_warnings.append(
                    f"[{acc.alias or acc.name}] 매매손익이 없는 은행 계좌에서 기간 수익({round(period_profit):,}원)이 발생했습니다. 입출금 또는 이자/세금 내역 누락 여부를 확인해주세요."
                )

            previews.append(SnapshotPreviewSchema(
                account_id=acc.id,
                account_name=acc.alias or acc.name,
                snapshot_date=snapshot_date,
                period_deposit=period_deposit_krw,
                total_valuation=val_krw,
                total_profit=total_profit,
                period_profit=period_profit,
                calculated_return_rate=round(calculated_return_rate, 2),
                current_cash=current_cash_krw,
                integrity_warnings=integrity_warnings
            ))

        return previews

    async def calculate_brokerage(self, req: BrokerageCalculateRequest) -> BrokerageCalculateResponse:
        """증권 계좌의 이론상 현금 잔액을 계산하고 실제 잔액과의 차액(배당/수수료 등)을 산출합니다.
        
        Args:
            req (BrokerageCalculateRequest): 계산 요청 정보.
            
        Returns:
            BrokerageCalculateResponse: 이론 잔액 및 차액 산출 결과.
        """
        # 1. 기존 DB 기반 이론상 현금 계산 (LedgerEngine 활용)
        base_state = LedgerEngine.get_positions(self.db, account_id=req.account_id, as_of=req.snapshot_date)
        
        # 2. 새로 입력된 트랜잭션 리플레이 반영
        new_state = LedgerEngine.replay(req.new_transactions)
        
        theoretical_krw = base_state.cash_krw + new_state.cash_krw
        theoretical_usd = base_state.cash_usd + new_state.cash_usd
        
        # 3. 차액 계산
        diff_krw = req.current_krw - theoretical_krw
        diff_usd = req.current_usd - theoretical_usd

        # 4. 마지막 스냅샷 이후의 기존 트랜잭션 조회
        last_snapshot = self.db.query(AccountSnapshot).filter(
            AccountSnapshot.account_id == req.account_id,
            AccountSnapshot.snapshot_date < req.snapshot_date
        ).order_by(AccountSnapshot.snapshot_date.desc()).first()
        
        last_date = last_snapshot.snapshot_date if last_snapshot else date(1970, 1, 1)
        
        existing_transactions = self.db.query(Transaction).options(joinedload(Transaction.asset)).filter(
            Transaction.account_id == req.account_id,
            Transaction.transaction_date > last_date,
            Transaction.transaction_date <= req.snapshot_date
        ).order_by(Transaction.transaction_date.desc()).all()
        
        # 5. 기간 입금액 및 원화 환산액 집계 (기존 + 신규 통합 순회)
        period_deposit = 0.0
        all_txs = list(existing_transactions) + req.new_transactions
        for tx in all_txs:
            amount_krw = self._convert_tx_to_krw(tx, req.exchange_rate)
            if tx.type == 'DEPOSIT':
                period_deposit += amount_krw
            elif tx.type == 'WITHDRAW':
                period_deposit -= amount_krw

        # 6. 비현금 자산 평가액 및 기간 수익 계산
        non_cash_valuation = await self._calculate_non_cash_valuation(req.account_id, req.exchange_rate)
        total_valuation = (req.current_krw + req.current_usd * req.exchange_rate) + non_cash_valuation
        last_valuation = last_snapshot.total_valuation if last_snapshot else 0.0
        period_profit = total_valuation - last_valuation - period_deposit

        # 7. 정합성 경고 산출
        integrity_warnings = []
        if abs(diff_krw) > 0.01:
            integrity_warnings.append(
                f"원화 차액({round(diff_krw):,}원)이 감지되었습니다. 예수금 보정 거래(CASH_ADJUSTMENT)가 생성됩니다."
            )
        if abs(diff_usd) > 0.01:
            integrity_warnings.append(
                f"달러 차액(${round(diff_usd, 2):,})이 감지되었습니다. 예수금 보정 거래(CASH_ADJUSTMENT)가 생성됩니다."
            )

        return BrokerageCalculateResponse(
            theoretical_krw=theoretical_krw,
            theoretical_usd=theoretical_usd,
            diff_krw=diff_krw,
            diff_usd=diff_usd,
            existing_transactions=existing_transactions,
            period_deposit=period_deposit,
            period_profit=period_profit,
            integrity_warnings=integrity_warnings
        )

    async def calculate_bank(self, req: BankCalculateRequest) -> BankCalculateResponse:
        """은행 계좌의 예상 잔액 및 유형별 합계를 산출합니다.
        
        Args:
            req (BankCalculateRequest): 은행 계산 요청 정보.
            
        Returns:
            BankCalculateResponse: 잔액 및 유형별 집계 결과.
        """
        base_state = LedgerEngine.get_positions(self.db, account_id=req.account_id, as_of=req.snapshot_date)
        new_state = LedgerEngine.replay(req.new_transactions)
        final_balance = base_state.cash_krw + new_state.cash_krw

        last_snapshot = self.db.query(AccountSnapshot).filter(
            AccountSnapshot.account_id == req.account_id,
            AccountSnapshot.snapshot_date < req.snapshot_date
        ).order_by(AccountSnapshot.snapshot_date.desc()).first()
        
        last_date = last_snapshot.snapshot_date if last_snapshot else date(1970, 1, 1)
        
        existing_transactions = self.db.query(Transaction).filter(
            Transaction.account_id == req.account_id,
            Transaction.transaction_date > last_date,
            Transaction.transaction_date <= req.snapshot_date
        ).order_by(Transaction.transaction_date.desc()).all()
        
        total_deposit = 0.0
        total_withdraw = 0.0
        total_interest = 0.0
        total_tax = 0.0
        total_adjustment = 0.0

        all_txs = list(existing_transactions) + req.new_transactions
        for tx in all_txs:
            t_type = tx.type
            amount = tx.total_amount
            
            if t_type in ['DEPOSIT', 'INITIAL_BALANCE']:
                total_deposit += amount
            elif t_type == 'WITHDRAW':
                total_withdraw += amount
            elif t_type == 'INTEREST':
                total_interest += amount
            elif t_type == 'TAX':
                total_tax += amount
            elif t_type == 'CASH_ADJUSTMENT':
                total_adjustment += amount
                
        period_deposit = total_deposit - total_withdraw
        last_valuation = last_snapshot.total_valuation if last_snapshot else 0.0
        period_profit = final_balance - last_valuation - period_deposit

        # 정합성 경고 산출
        integrity_warnings = []
        if abs(period_profit) > 0.01:
            integrity_warnings.append(
                f"은행 계좌에서 기간 수익({round(period_profit):,}원)이 발생했습니다. 이자/세금 외 입출금 누락 여부를 확인해주세요."
            )
                
        return BankCalculateResponse(
            theoretical_krw=final_balance,
            existing_transactions=existing_transactions,
            total_deposit=total_deposit,
            total_withdraw=total_withdraw,
            total_interest=total_interest,
            total_tax=total_tax,
            total_adjustment=total_adjustment,
            period_deposit=period_deposit,
            period_profit=period_profit,
            integrity_warnings=integrity_warnings
        )


    def _save_exchange_rate(self, target_date: date, rate: float):
        """환율 레코드를 저장하거나 갱신합니다.
        
        Args:
            target_date (date): 대상 일자.
            rate (float): USD/KRW 환율.
        """
        existing_rate = self.db.query(ExchangeRate).filter(
            ExchangeRate.date == target_date,
            ExchangeRate.currency == "USD"
        ).first()
        
        if existing_rate:
            existing_rate.rate = rate
        else:
            self.db.add(ExchangeRate(date=target_date, currency="USD", rate=rate))

    def _process_brokerage_accounts(
        self,
        snapshot_date: date,
        accounts: List[BrokerageSaveAccountRequest],
        krw_asset_id: int,
        usd_asset_id: int
    ):
        """증권 계좌의 신규 거래 및 잔고 보정 내역(CASH_ADJUSTMENT)을 삽입합니다.
        
        Args:
            snapshot_date (date): 기준 일자.
            accounts (List[BrokerageSaveAccountRequest]): 증권 계좌 저장 요청 목록.
            krw_asset_id (int): 원화 자산 ID.
            usd_asset_id (int): 달러 자산 ID.
            
        Raises:
            ValueError: 지원하지 않는 통화인 경우.
        """
        for acc_req in accounts:
            for tx_schema in acc_req.new_transactions:
                if tx_schema.currency == 'KRW':
                    asset_id = krw_asset_id
                elif tx_schema.currency == 'USD':
                    asset_id = usd_asset_id
                else:
                    raise ValueError(f"지원하지 않는 통화입니다: {tx_schema.currency}")
                
                self.db.add(self._create_transaction_from_schema(tx_schema, asset_id))
            
            # 차액 보정 저장
            if abs(acc_req.diff_krw) > 0.01:
                self.db.add(Transaction(
                    account_id=acc_req.account_id,
                    asset_id=krw_asset_id,
                    transaction_date=snapshot_date,
                    type="CASH_ADJUSTMENT",
                    quantity=acc_req.diff_krw,
                    price=1.0,
                    total_amount=acc_req.diff_krw,
                    currency="KRW"
                ))
                
            if abs(acc_req.diff_usd) > 0.01:
                self.db.add(Transaction(
                    account_id=acc_req.account_id,
                    asset_id=usd_asset_id,
                    transaction_date=snapshot_date,
                    type="CASH_ADJUSTMENT",
                    quantity=acc_req.diff_usd,
                    price=1.0,
                    total_amount=acc_req.diff_usd,
                    currency="USD"
                ))

    def _process_bank_accounts(self, accounts: List[BankSaveAccountRequest], krw_asset_id: int):
        """은행 계좌의 신규 거래 내역을 삽입합니다.
        
        Args:
            accounts (List[BankSaveAccountRequest]): 은행 계좌 저장 요청 목록.
            krw_asset_id (int): 원화 자산 ID.
        """
        for acc_req in accounts:
            for tx_schema in acc_req.new_transactions:
                self.db.add(self._create_transaction_from_schema(tx_schema, krw_asset_id))

    def _update_bank_previews(
        self,
        previews: List[SnapshotPreviewSchema],
        bank_accounts_req: List[BankSaveAccountRequest]
    ):
        """사용자가 지정한 은행 계좌 총 평가액을 바탕으로 기간 수익을 재계산합니다.
        
        Args:
            previews (List[SnapshotPreviewSchema]): 스냅샷 미리보기 리스트.
            bank_accounts_req (List[BankSaveAccountRequest]): 은행 계좌 요청 목록.
        """
        bank_valuation_map = {acc.account_id: acc.total_valuation for acc in bank_accounts_req if acc.total_valuation is not None}
        if not bank_valuation_map:
            return

        for p in previews:
            if p.account_id in bank_valuation_map:
                p.total_valuation = bank_valuation_map[p.account_id]
                
                last_snapshot = self.db.query(AccountSnapshot).filter(
                    AccountSnapshot.account_id == p.account_id,
                    AccountSnapshot.snapshot_date < p.snapshot_date
                ).order_by(AccountSnapshot.snapshot_date.desc()).first()
                
                last_valuation = last_snapshot.total_valuation if last_snapshot else 0.0
                p.total_profit = p.total_valuation - last_valuation - p.period_deposit
                p.period_profit = p.total_profit
                
                base_assets = last_valuation + p.period_deposit
                p.calculated_return_rate = round((p.period_profit / base_assets * 100), 2) if base_assets != 0 else 0.0

    def save_snapshots(self, previews: List[SnapshotPreviewSchema], commit: bool = True) -> List[AccountSnapshot]:
        """미리보기 데이터를 바탕으로 기존 스냅샷을 교체 저장합니다.
        
        Args:
            previews (List[SnapshotPreviewSchema]): 저장할 스냅샷 미리보기 리스트.
            commit (bool): DB 커밋 여부.
            
        Returns:
            List[AccountSnapshot]: 저장된 스냅샷 모델 인스턴스 리스트.
        """
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

    async def save_unified(self, req: UnifiedSaveRequest) -> List[AccountSnapshot]:
        """환율 기록, 정산 보정 거래 및 스냅샷 캐시를 단일 트랜잭션으로 원자적 커밋합니다.
        
        Args:
            req (UnifiedSaveRequest): 통합 저장 요청 정보.
            
        Returns:
            List[AccountSnapshot]: 영속화된 계좌 스냅샷 목록.
            
        Raises:
            ValueError: 필수 자산(KRW, USD)이 존재하지 않는 경우.
        """
        krw_asset = self.db.query(Asset).filter(Asset.ticker == "KRW").first()
        usd_asset = self.db.query(Asset).filter(Asset.ticker == "USD").first()
        
        if not krw_asset or not usd_asset:
            raise ValueError("데이터베이스에서 KRW 또는 USD 자산을 찾을 수 없습니다.")

        try:
            self._save_exchange_rate(req.snapshot_date, req.exchange_rate)
            self._process_brokerage_accounts(req.snapshot_date, req.brokerage_accounts, krw_asset.id, usd_asset.id)
            self._process_bank_accounts(req.bank_accounts, krw_asset.id)
            
            self.db.flush()

            previews = await self.preview(req.snapshot_date, req.exchange_rate)
            self._update_bank_previews(previews, req.bank_accounts)

            return self.save_snapshots(previews, commit=True)
        except Exception:
            self.db.rollback()
            raise

    async def save_brokerage(self, req: BrokerageSaveRequest) -> List[AccountSnapshot]:
        """증권 계좌 전용 스냅샷을 원자적으로 저장합니다.
        
        Args:
            req (BrokerageSaveRequest): 증권 스냅샷 저장 요청 정보.
            
        Returns:
            List[AccountSnapshot]: 영속화된 계좌 스냅샷 목록.
            
        Raises:
            ValueError: 필수 자산(KRW, USD)이 존재하지 않는 경우.
        """
        krw_asset = self.db.query(Asset).filter(Asset.ticker == "KRW").first()
        usd_asset = self.db.query(Asset).filter(Asset.ticker == "USD").first()
        
        if not krw_asset or not usd_asset:
            raise ValueError("데이터베이스에서 KRW 또는 USD 자산을 찾을 수 없습니다.")

        try:
            self._save_exchange_rate(req.snapshot_date, req.exchange_rate)
            self._process_brokerage_accounts(req.snapshot_date, req.accounts, krw_asset.id, usd_asset.id)
            
            self.db.flush()
            previews = await self.preview(req.snapshot_date, req.exchange_rate)
            return self.save_snapshots(previews, commit=True)
        except Exception:
            self.db.rollback()
            raise

    async def save_bank(self, req: BankSaveRequest) -> List[AccountSnapshot]:
        """은행 계좌 전용 스냅샷을 원자적으로 저장합니다.
        
        Args:
            req (BankSaveRequest): 은행 스냅샷 저장 요청 정보.
            
        Returns:
            List[AccountSnapshot]: 영속화된 계좌 스냅샷 목록.
            
        Raises:
            ValueError: 원화 자산(KRW)이 존재하지 않는 경우.
        """
        krw_asset = self.db.query(Asset).filter(Asset.ticker == "KRW").first()
        if not krw_asset:
            raise ValueError("데이터베이스에서 KRW 자산을 찾을 수 없습니다.")

        try:
            latest_rate_obj = self.db.query(ExchangeRate).order_by(ExchangeRate.date.desc()).first()
            latest_rate = latest_rate_obj.rate if latest_rate_obj else 1350.0

            self._process_bank_accounts(req.accounts, krw_asset.id)
            self.db.flush()

            previews = await self.preview(req.snapshot_date, latest_rate)
            self._update_bank_previews(previews, req.accounts)

            return self.save_snapshots(previews, commit=True)
        except Exception:
            self.db.rollback()
            raise

    def get_snapshots(self) -> List[AccountSnapshot]:
        """전체 자산 스냅샷 목록을 최신순으로 조회합니다.
        
        Returns:
            List[AccountSnapshot]: 최신순 스냅샷 모델 목록.
        """
        return self.db.query(AccountSnapshot).order_by(AccountSnapshot.snapshot_date.desc()).all()

    def get_latest_snapshot_date(self) -> Optional[date]:
        """가장 최근에 기록된 스냅샷 날짜를 조회합니다.
        
        Returns:
            Optional[date]: 가장 최근 스냅샷 날짜 (없으면 None).
        """
        latest_snapshot = self.db.query(AccountSnapshot).order_by(AccountSnapshot.snapshot_date.desc()).first()
        return latest_snapshot.snapshot_date if latest_snapshot else None

    def delete_snapshots_by_date(self, snapshot_date: date) -> bool:
        """지정된 날짜의 모든 계좌 스냅샷 데이터 및 관련 보정 거래를 삭제합니다.
        
        Args:
            snapshot_date (date): 삭제할 스냅샷 기준 일자.
            
        Returns:
            bool: 삭제 성공 여부.
        """
        exists = self.db.query(AccountSnapshot).filter(AccountSnapshot.snapshot_date == snapshot_date).first()
        if not exists:
            return False

        self.db.query(Transaction).filter(
            Transaction.transaction_date == snapshot_date,
            Transaction.type == "CASH_ADJUSTMENT"
        ).delete()

        self.db.query(AccountSnapshot).filter(AccountSnapshot.snapshot_date == snapshot_date).delete()
        return True

    def _calculate_bank_period_metrics(self, period_txs: List[Transaction]) -> tuple[float, float]:
        """은행 계좌 기간 거래 내역으로부터 (순입출금, 기간수익)을 산출합니다."""
        total_dep = sum(tx.total_amount for tx in period_txs if tx.type == "DEPOSIT")
        total_with = sum(tx.total_amount for tx in period_txs if tx.type == "WITHDRAW")
        total_int = sum(tx.total_amount for tx in period_txs if tx.type == "INTEREST")
        total_tx = sum(tx.total_amount for tx in period_txs if tx.type == "TAX")
        total_adj = sum(tx.total_amount for tx in period_txs if tx.type == "CASH_ADJUSTMENT")

        period_deposit = total_dep - total_with
        period_profit = total_int - total_tx + total_adj
        return period_deposit, period_profit

    def _calculate_brokerage_period_deposit(self, period_txs: List[Transaction]) -> float:
        """증권 계좌 기간 거래 내역으로부터 순입출금을 산출합니다."""
        period_deposit = 0.0
        for tx in period_txs:
            mult = 1.0 if tx.type == "DEPOSIT" else (-1.0 if tx.type == "WITHDRAW" else 0.0)
            if mult != 0.0:
                period_deposit += tx.total_amount * mult
        return period_deposit

    async def recalculate(self, req: SnapshotRecalculateRequest) -> SnapshotRecalculateResponse:
        """원장 거래 내역을 기반으로 과거 스냅샷의 입출금 및 기간 수익을 일괄 재산출합니다.
        
        Args:
            req (SnapshotRecalculateRequest): 재계산 요청 정보 (from_date, account_id, dry_run).
            
        Returns:
            SnapshotRecalculateResponse: 재계산 평가 결과 및 전/후 차액 diff 목록.
        """
        tx_service = TransactionService(self.db)
        
        # 1. 대상 계좌 목록 조회
        acc_query = self.db.query(Account)
        if req.account_id:
            acc_query = acc_query.filter(Account.id == req.account_id)
        accounts = acc_query.all()

        diffs: List[SnapshotRecalculateItemDiff] = []
        total_evaluated = 0
        total_updated = 0

        # 2. 계좌별로 과거부터 최신순으로 스냅샷 순회
        for acc in accounts:
            snapshots = (
                self.db.query(AccountSnapshot)
                .filter(AccountSnapshot.account_id == acc.id)
                .order_by(AccountSnapshot.snapshot_date.asc())
                .all()
            )
            if not snapshots:
                continue

            prev_snap: Optional[AccountSnapshot] = None

            for snap in snapshots:
                is_target = True
                if req.from_date and snap.snapshot_date < req.from_date:
                    is_target = False

                if is_target:
                    total_evaluated += 1

                # 직전 스냅샷 일자
                start_date = prev_snap.snapshot_date if prev_snap else None
                end_date = snap.snapshot_date

                # 기간 내 거래 내역 조회
                period_txs = tx_service.get_period_transactions(acc.id, start_date, end_date)

                new_period_deposit = 0.0
                new_period_profit = 0.0
                new_total_valuation = snap.total_valuation

                if prev_snap is None:
                    # 첫 스냅샷은 시작 기준점이므로 기존 스냅샷 값 유지
                    new_period_deposit = snap.period_deposit or 0.0
                    new_period_profit = snap.total_profit or 0.0
                else:
                    if acc.account_type == "BANK":
                        new_period_deposit, new_period_profit = self._calculate_bank_period_metrics(period_txs)
                    else:
                        new_period_deposit = self._calculate_brokerage_period_deposit(period_txs)
                        prev_val = prev_snap.total_valuation or 0.0
                        new_period_profit = (snap.total_valuation or 0.0) - (prev_val + new_period_deposit)

                if is_target:
                    old_dep = snap.period_deposit or 0.0
                    old_profit = snap.total_profit or 0.0
                    diff_dep = new_period_deposit - old_dep
                    diff_profit = new_period_profit - old_profit
                    diff_val = 0.0

                    is_changed = abs(diff_dep) > 0.01 or abs(diff_profit) > 0.01

                    if is_changed:
                        total_updated += 1
                        if not req.dry_run:
                            snap.period_deposit = new_period_deposit
                            snap.total_profit = new_period_profit

                    diffs.append(
                        SnapshotRecalculateItemDiff(
                            snapshot_id=snap.id,
                            account_id=acc.id,
                            account_name=acc.name,
                            account_type=acc.account_type,
                            snapshot_date=snap.snapshot_date,
                            old_period_deposit=old_dep,
                            new_period_deposit=new_period_deposit,
                            diff_period_deposit=diff_dep,
                            old_period_profit=old_profit,
                            new_period_profit=new_period_profit,
                            diff_period_profit=diff_profit,
                            old_total_valuation=snap.total_valuation or 0.0,
                            new_total_valuation=new_total_valuation,
                            diff_total_valuation=diff_val,
                            is_changed=is_changed
                        )
                    )

                prev_snap = snap

        if not req.dry_run and total_updated > 0:
            self.db.commit()


        summary_msg = (
            f"[Dry Run] {total_evaluated}개 스냅샷 검토 완료, {total_updated}개 변경 대상 감지"
            if req.dry_run
            else f"{total_evaluated}개 스냅샷 검토 완료, {total_updated}개 스냅샷 갱신 완료"
        )

        return SnapshotRecalculateResponse(
            total_snapshots_evaluated=total_evaluated,
            total_snapshots_updated=total_updated,
            dry_run=req.dry_run,
            diffs=diffs,
            summary_message=summary_msg
        )

