"""트랜잭션(거래 내역, 계좌 이체, 환전) 비즈니스 로직을 처리하는 딥 도메인 서비스 모듈입니다."""

import uuid
from typing import List, Optional, Tuple
from datetime import date
from sqlalchemy.orm import Session, joinedload
from ..models import Transaction, Asset, Account, AccountSnapshot
from ..schemas.transaction import TransactionSchema, TransferTransactionRequest


class TransactionService:
    """거래 내역 CRUD 및 이체 짝 생성/연동 삭제를 처리하는 서비스 클래스입니다."""

    def __init__(self, db: Session):
        self.db = db

    def check_past_snapshot_warning(self, account_id: int, transaction_date: date) -> Optional[str]:
        """해당 거래 일자가 이미 확정된 스냅샷 기준일 이전 또는 당일인지 검사하여 경고 메시지를 반환합니다."""
        last_snapshot = (
            self.db.query(AccountSnapshot)
            .filter(AccountSnapshot.account_id == account_id)
            .order_by(AccountSnapshot.snapshot_date.desc())
            .first()
        )
        if last_snapshot and transaction_date <= last_snapshot.snapshot_date:
            return (
                f"입력하신 거래 일자({transaction_date})는 이미 확정된 최신 스냅샷 기준일({last_snapshot.snapshot_date}) 이전입니다. "
                f"과거 거래 수정/추가는 스냅샷 결산 데이터와 불일치를 유발할 수 있으므로, 처리 후 스냅샷 재계산이 권장됩니다."
            )
        return None

    def get_transactions(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[Transaction]:
        """전체 또는 기간 필터링된 거래 내역을 조회합니다."""
        query = self.db.query(Transaction).options(
            joinedload(Transaction.asset),
            joinedload(Transaction.target_asset),
            joinedload(Transaction.account)
        )
        if start_date:
            query = query.filter(Transaction.transaction_date >= start_date)
        if end_date:
            query = query.filter(Transaction.transaction_date <= end_date)
        return query.order_by(Transaction.transaction_date.desc(), Transaction.id.desc()).all()

    def get_period_transactions(
        self,
        account_id: int,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[Transaction]:
        """특정 계좌의 특정 기간 내 거래 내역을 조회합니다."""
        query = self.db.query(Transaction).options(
            joinedload(Transaction.asset),
            joinedload(Transaction.target_asset),
            joinedload(Transaction.account)
        ).filter(Transaction.account_id == account_id)
        if start_date:
            query = query.filter(Transaction.transaction_date > start_date)
        if end_date:
            query = query.filter(Transaction.transaction_date <= end_date)
        return query.order_by(Transaction.transaction_date.desc(), Transaction.id.desc()).all()

    def validate_and_extract_transaction_data(self, transaction: TransactionSchema) -> dict:
        """트랜잭션 입력값의 유효성을 검증하고 DB 모델용 딕셔너리를 반환합니다."""
        if transaction.type == "EXCHANGE":
            if not transaction.target_asset_id:
                raise ValueError("환전(EXCHANGE) 거래 등록 시 도착 자산(target_asset_id)은 필수입니다.")

            source_asset = self.db.query(Asset).filter(Asset.id == transaction.asset_id).first()
            target_asset = self.db.query(Asset).filter(Asset.id == transaction.target_asset_id).first()

            if not source_asset or source_asset.major_category != "현금":
                raise ValueError("환전 출발 자산(asset_id)은 현금 카테고리 자산이어야 합니다.")
            if not target_asset or target_asset.major_category != "현금":
                raise ValueError("환전 도착 자산(target_asset_id)은 현금 카테고리 자산이어야 합니다.")

        return transaction.model_dump(exclude=TransactionSchema.NON_DB_FIELDS)

    def _build_transfer_pair_instances(
        self,
        source_account_id: int,
        target_account_id: int,
        asset_id: int,
        amount: float,
        transaction_date: date,
        quantity: Optional[float] = None,
        price: Optional[float] = None,
        currency: Optional[str] = None,
        exchange_rate: Optional[float] = None,
        memo: Optional[str] = None,
        source: str = "MANUAL",
        external_id: Optional[str] = None,
        transfer_pair_id: Optional[str] = None,
    ) -> Tuple[List[Transaction], Optional[str]]:
        """이체 거래 쌍(WITHDRAW + DEPOSIT) 모델 인스턴스 및 경고 메시지를 생성합니다.

        Args:
            source_account_id (int): 출발 계좌 식별자.
            target_account_id (int): 도착 계좌 식별자.
            asset_id (int): 이체 자산 식별자.
            amount (float): 총 이체 금액.
            transaction_date (date): 거래 일자.
            quantity (Optional[float]): 수량. 미지정 시 amount 사용.
            price (Optional[float]): 단가. 미지정 시 1.0 사용.
            currency (Optional[str]): 통화. 미지정 시 자산 통화 사용.
            exchange_rate (Optional[float]): 환율.
            memo (Optional[str]): 메모.
            source (str): 거래 출처. 기본값 "MANUAL".
            external_id (Optional[str]): 외부 시스템 연동 식별자.
            transfer_pair_id (Optional[str]): 이체 쌍 고유 식별자(UUID). 미지정 시 신규 발급.

        Returns:
            Tuple[List[Transaction], Optional[str]]: [출금 거래, 입금 거래] 인스턴스 목록 및 과거 스냅샷 경고 메시지.

        Raises:
            ValueError: 출발 계좌와 도착 계좌가 동일하거나 자산을 찾을 수 없을 때.
        """
        if source_account_id == target_account_id:
            raise ValueError("출발 계좌와 도착 계좌가 동일할 수 없습니다.")

        asset = self.db.query(Asset).filter(Asset.id == asset_id).first()
        if not asset:
            raise ValueError("자산을 찾을 수 없습니다.")

        pair_id = transfer_pair_id or str(uuid.uuid4())
        tx_currency = currency or (asset.country if asset.country in ["USD", "KRW"] else "KRW")
        tx_qty = quantity if quantity else amount
        tx_price = price if price else 1.0

        base_kwargs = {
            "asset_id": asset_id,
            "target_asset_id": None,
            "transaction_date": transaction_date,
            "quantity": tx_qty,
            "price": tx_price,
            "total_amount": amount,
            "currency": tx_currency,
            "exchange_rate": exchange_rate,
            "memo": memo,
            "source": source,
            "external_id": external_id,
            "transfer_pair_id": pair_id,
        }
        tx_withdraw = Transaction(account_id=source_account_id, type="WITHDRAW", **base_kwargs)
        tx_deposit = Transaction(account_id=target_account_id, type="DEPOSIT", **base_kwargs)

        warning_src = self.check_past_snapshot_warning(source_account_id, transaction_date)
        warning_tgt = self.check_past_snapshot_warning(target_account_id, transaction_date)
        warning = warning_src or warning_tgt

        return [tx_withdraw, tx_deposit], warning

    def create_transaction(self, transaction: TransactionSchema) -> Transaction:
        """새로운 거래 내역을 생성합니다."""
        data = self.validate_and_extract_transaction_data(transaction)
        db_transaction = Transaction(**data)
        self.db.add(db_transaction)
        self.db.commit()
        self.db.refresh(db_transaction)

        # 과거 스냅샷 기준일 이전 거래 여부 검사 후 transient 경고 속성 추가
        warning = self.check_past_snapshot_warning(db_transaction.account_id, db_transaction.transaction_date)
        setattr(db_transaction, "warning", warning)

        return db_transaction

    def create_transfer_pair(self, req: TransferTransactionRequest) -> List[Transaction]:
        """계좌 간 이체 트랜잭션(WITHDRAW + DEPOSIT 쌍)을 원자적으로 생성합니다."""
        pair_txs, warning = self._build_transfer_pair_instances(
            source_account_id=req.source_account_id,
            target_account_id=req.target_account_id,
            asset_id=req.asset_id,
            amount=req.amount,
            transaction_date=req.transaction_date,
            memo=req.memo,
        )

        self.db.add_all(pair_txs)
        self.db.commit()

        for tx in pair_txs:
            self.db.refresh(tx)
            setattr(tx, "warning", warning)

        return pair_txs

    def create_transactions_bulk(self, items: List[TransactionSchema]) -> List[Transaction]:
        """다중 거래 내역(일반 거래, 환전, 이체)을 단일 트랜잭션으로 원자적(All-or-Nothing) 일괄 생성합니다.

        Args:
            items (List[TransactionSchema]): 일괄 생성할 거래 내역 스키마 목록.

        Returns:
            List[Transaction]: 생성된 DB 거래 모델 인스턴스 목록.

        Raises:
            ValueError: 빈 목록 전달 시, 또는 거래 검증(동일 계좌 이체, 필수 자산/계좌 누락 등) 실패 시.
        """
        if not items:
            raise ValueError("등록할 거래 내역이 없습니다.")

        tx_instances: List[Transaction] = []
        warnings_map: List[Optional[str]] = []

        for item in items:
            if item.type == "TRANSFER":
                if not item.target_account_id:
                    raise ValueError("도착 계좌(target_account_id)는 필수입니다.")

                pair_txs, warning = self._build_transfer_pair_instances(
                    source_account_id=item.account_id,
                    target_account_id=item.target_account_id,
                    asset_id=item.asset_id,
                    amount=item.total_amount,
                    transaction_date=item.transaction_date,
                    quantity=item.quantity,
                    price=item.price,
                    currency=item.currency,
                    exchange_rate=item.exchange_rate,
                    memo=item.memo,
                    source=item.source,
                    external_id=item.external_id,
                )
                tx_instances.extend(pair_txs)
                warnings_map.extend([warning, warning])
            else:
                data = self.validate_and_extract_transaction_data(item)
                tx = Transaction(**data)
                warning = self.check_past_snapshot_warning(item.account_id, item.transaction_date)
                tx_instances.append(tx)
                warnings_map.append(warning)

        self.db.add_all(tx_instances)
        self.db.commit()

        for tx, warning in zip(tx_instances, warnings_map):
            self.db.refresh(tx)
            setattr(tx, "warning", warning)

        return tx_instances

    def update_transaction(self, transaction_id: int, transaction: TransactionSchema) -> Transaction:
        """기존 거래 내역 정보를 수정하고 연동된 이체 트랜잭션도 연쇄 수정합니다.

        Args:
            transaction_id (int): 수정할 거래 식별자.
            transaction (TransactionSchema): 수정할 거래 정보 스키마.

        Returns:
            Transaction: 수정된 DB 거래 모델 인스턴스.

        Raises:
            ValueError: 거래 내역 미존재, 필수 도착 계좌 누락, 동일 계좌 지정 등의 검증 실패 시.
        """
        db_transaction = self.db.query(Transaction).filter(Transaction.id == transaction_id).first()
        if not db_transaction:
            raise ValueError("거래 내역을 찾을 수 없습니다.")

        if transaction.type == "TRANSFER":
            if not transaction.target_account_id:
                raise ValueError("도착 계좌(target_account_id)는 필수입니다.")
            if transaction.account_id == transaction.target_account_id:
                raise ValueError("출발 계좌와 도착 계좌가 동일할 수 없습니다.")

            asset = self.db.query(Asset).filter(Asset.id == transaction.asset_id).first()
            currency = transaction.currency or (asset.country if asset and asset.country in ["USD", "KRW"] else "KRW")

            pair_txs = self.db.query(Transaction).filter(
                Transaction.transfer_pair_id == db_transaction.transfer_pair_id,
                Transaction.id != db_transaction.id
            ).all() if db_transaction.transfer_pair_id else []

            if not pair_txs:
                # 단독 거래(또는 pair_id 유실)인 경우 새/기존 pair_id로 이체 쌍 생성
                pair_id = db_transaction.transfer_pair_id or str(uuid.uuid4())
                db_transaction.account_id = transaction.account_id
                db_transaction.asset_id = transaction.asset_id
                db_transaction.target_asset_id = None
                db_transaction.transaction_date = transaction.transaction_date
                db_transaction.type = "WITHDRAW"
                db_transaction.quantity = transaction.total_amount
                db_transaction.price = 1.0
                db_transaction.total_amount = transaction.total_amount
                db_transaction.currency = currency
                db_transaction.exchange_rate = transaction.exchange_rate
                db_transaction.memo = transaction.memo
                db_transaction.source = transaction.source
                db_transaction.transfer_pair_id = pair_id

                deposit_tx = Transaction(
                    account_id=transaction.target_account_id,
                    asset_id=transaction.asset_id,
                    target_asset_id=None,
                    transaction_date=transaction.transaction_date,
                    type="DEPOSIT",
                    quantity=transaction.total_amount,
                    price=1.0,
                    total_amount=transaction.total_amount,
                    currency=currency,
                    exchange_rate=transaction.exchange_rate,
                    memo=transaction.memo,
                    source=transaction.source,
                    transfer_pair_id=pair_id
                )
                self.db.add(deposit_tx)
            else:
                other_tx = pair_txs[0]
                if db_transaction.type == "DEPOSIT" and other_tx.type == "WITHDRAW":
                    withdraw_row = other_tx
                    deposit_row = db_transaction
                else:
                    withdraw_row = db_transaction
                    deposit_row = other_tx

                withdraw_row.account_id = transaction.account_id
                withdraw_row.type = "WITHDRAW"
                deposit_row.account_id = transaction.target_account_id
                deposit_row.type = "DEPOSIT"

                for row in (withdraw_row, deposit_row):
                    row.asset_id = transaction.asset_id
                    row.target_asset_id = None
                    row.transaction_date = transaction.transaction_date
                    row.quantity = transaction.total_amount
                    row.price = 1.0
                    row.total_amount = transaction.total_amount
                    row.currency = currency
                    row.exchange_rate = transaction.exchange_rate
                    row.memo = transaction.memo
                    row.source = transaction.source

            warning_src = self.check_past_snapshot_warning(transaction.account_id, transaction.transaction_date)
            warning_tgt = self.check_past_snapshot_warning(transaction.target_account_id, transaction.transaction_date)
            warning = warning_src or warning_tgt

        else:
            # 일반 거래 유형(type != "TRANSFER")으로 수정
            if db_transaction.transfer_pair_id:
                # 기존 이체 쌍이었던 경우 상대 거래를 삭제하고 단독 거래로 전환
                pair_txs = self.db.query(Transaction).filter(
                    Transaction.transfer_pair_id == db_transaction.transfer_pair_id,
                    Transaction.id != db_transaction.id
                ).all()
                for p in pair_txs:
                    self.db.delete(p)
                db_transaction.transfer_pair_id = None

            data = self.validate_and_extract_transaction_data(transaction)
            for key, value in data.items():
                setattr(db_transaction, key, value)
            if not transaction.transfer_pair_id:
                db_transaction.transfer_pair_id = None

            warning = self.check_past_snapshot_warning(db_transaction.account_id, db_transaction.transaction_date)

        self.db.commit()
        self.db.refresh(db_transaction)
        setattr(db_transaction, "warning", warning)

        return db_transaction

    def delete_transaction(self, transaction_id: int) -> bool:
        """거래 내역을 삭제하며, 연동된 이체 트랜잭션이 있을 경우 원자적으로 함께 삭제합니다."""
        db_transaction = self.db.query(Transaction).filter(Transaction.id == transaction_id).first()
        if not db_transaction:
            raise ValueError("거래 내역을 찾을 수 없습니다.")

        if db_transaction.transfer_pair_id:
            pair_txs = self.db.query(Transaction).filter(
                Transaction.transfer_pair_id == db_transaction.transfer_pair_id
            ).all()
            for p in pair_txs:
                self.db.delete(p)
        else:
            self.db.delete(db_transaction)

        self.db.commit()
        return True
