"""트랜잭션(거래 내역, 계좌 이체, 환전) 비즈니스 로직을 처리하는 딥 도메인 서비스 모듈입니다."""

import uuid
from typing import List, Optional
from datetime import date
from sqlalchemy.orm import Session, joinedload
from ..models import Transaction, Asset, Account, AccountSnapshot


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

    def validate_and_extract_transaction_data(self, transaction) -> dict:
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

        return transaction.model_dump(
            exclude={"id", "asset_name", "asset_ticker", "target_asset_name", "target_asset_ticker", "account_display_name", "warning"}
        )

    def create_transaction(self, transaction) -> Transaction:
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


    def create_transfer_pair(self, req) -> List[Transaction]:
        """계좌 간 이체 트랜잭션(WITHDRAW + DEPOSIT 쌍)을 원자적으로 생성합니다."""
        if req.source_account_id == req.target_account_id:
            raise ValueError("출발 계좌와 도착 계좌가 동일할 수 없습니다.")

        asset = self.db.query(Asset).filter(Asset.id == req.asset_id).first()
        if not asset:
            raise ValueError("자산을 찾을 수 없습니다.")

        transfer_pair_id = str(uuid.uuid4())
        currency = asset.country if asset.country in ["USD", "KRW"] else "KRW"

        base_kwargs = {
            "asset_id": req.asset_id,
            "transaction_date": req.transaction_date,
            "quantity": req.amount,
            "price": 1.0,
            "total_amount": req.amount,
            "currency": currency,
            "memo": req.memo,
            "transfer_pair_id": transfer_pair_id
        }
        tx_withdraw = Transaction(account_id=req.source_account_id, type="WITHDRAW", **base_kwargs)
        tx_deposit = Transaction(account_id=req.target_account_id, type="DEPOSIT", **base_kwargs)

        pair_txs = [tx_withdraw, tx_deposit]
        self.db.add_all(pair_txs)
        self.db.commit()

        # 과거 스냅샷 경고 확인
        warning_src = self.check_past_snapshot_warning(req.source_account_id, req.transaction_date)
        warning_tgt = self.check_past_snapshot_warning(req.target_account_id, req.transaction_date)
        warning = warning_src or warning_tgt

        for tx in pair_txs:
            self.db.refresh(tx)
            setattr(tx, "warning", warning)

        return pair_txs


    def update_transaction(self, transaction_id: int, transaction) -> Transaction:
        """기존 거래 내역 정보를 수정하고 연동된 이체 트랜잭션도 연쇄 수정합니다."""
        db_transaction = self.db.query(Transaction).filter(Transaction.id == transaction_id).first()
        if not db_transaction:
            raise ValueError("거래 내역을 찾을 수 없습니다.")

        data = self.validate_and_extract_transaction_data(transaction)
        for key, value in data.items():
            setattr(db_transaction, key, value)

        if db_transaction.transfer_pair_id:
            pair_txs = self.db.query(Transaction).filter(
                Transaction.transfer_pair_id == db_transaction.transfer_pair_id,
                Transaction.id != db_transaction.id
            ).all()
            for p in pair_txs:
                p.total_amount = db_transaction.total_amount
                p.transaction_date = db_transaction.transaction_date
                p.memo = db_transaction.memo

        self.db.commit()
        self.db.refresh(db_transaction)

        warning = self.check_past_snapshot_warning(db_transaction.account_id, db_transaction.transaction_date)
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
