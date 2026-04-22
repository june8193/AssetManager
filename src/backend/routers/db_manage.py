from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime

from ..database import get_db
from ..models import Account, Asset, Transaction, AccountSnapshot, User
from ..services.dashboard_service import DashboardService

router = APIRouter(
    prefix="/api/db",
    tags=["db_manage"]
)

# --- Pydantic Schemas ---

class SaveSnapshotRequest(BaseModel):
    snapshot_date: date
    exchange_rate: float

class SnapshotPreviewSchema(BaseModel):
    account_id: int
    account_name: str
    snapshot_date: date
    period_deposit: float
    total_valuation: float
    total_profit: float

class AccountSchema(BaseModel):
    """계좌 정보를 담는 스키마입니다.

    Attributes:
        id (Optional[int]): 계좌 식별자 (생성 시 생략 가능)
        user_id (int): 사용자 식별자 (FK)
        name (str): 계좌 이름/번호
        provider (str): 금융 기관 이름
        alias (Optional[str]): 계좌 별칭
        is_active (bool): 계좌 활성 여부
    """
    id: Optional[int] = None
    user_id: int
    name: str
    provider: str
    alias: Optional[str] = None
    is_active: bool = True

    class Config:
        from_attributes = True

class AssetSchema(BaseModel):
    """자산 마스터 정보를 담는 스키마입니다.

    Attributes:
        id (Optional[int]): 자산 식별자
        ticker (str): 티커 또는 심볼
        name (str): 자산 이름
        major_category (str): 대분류
        sub_category (str): 중분류
        country (str): 국가 코드 (KR, US 등)
    """
    id: Optional[int] = None
    ticker: str
    name: str
    major_category: str
    sub_category: str
    country: str = "KR"

    class Config:
        from_attributes = True

class TransactionSchema(BaseModel):
    """거래 내역 정보를 담는 스키마입니다.

    Attributes:
        id (Optional[int]): 거래 식별자
        account_id (int): 계좌 식별자
        asset_id (int): 자산 식별자
        transaction_date (date): 거래 일자
        type (str): 거래 유형 (BUY, SELL 등)
        quantity (float): 수량
        price (float): 단가
        total_amount (float): 총 거래 금액
        currency (str): 통화 (KRW, USD)
        exchange_rate (Optional[float]): 환율
    """
    id: Optional[int] = None
    account_id: int
    asset_id: int
    transaction_date: date
    type: str
    quantity: float = 0.0
    price: float = 0.0
    total_amount: float
    currency: str
    exchange_rate: Optional[float] = None

    class Config:
        from_attributes = True

class SnapshotSchema(BaseModel):
    """계좌 상태 스냅샷 정보를 담는 스키마입니다.

    Attributes:
        id (int): 스냅샷 식별자
        account_id (int): 계좌 식별자
        snapshot_date (date): 기준 일자
        period_deposit (float): 해당 기간 추가 입금액
        total_valuation (float): 총 평가액
        total_profit (float): 누적 수익
    """
    id: int
    account_id: int
    snapshot_date: date
    period_deposit: float
    total_valuation: float
    total_profit: float

    class Config:
        from_attributes = True

class UserSchema(BaseModel):
    """사용자 정보를 담는 스키마입니다."""
    id: int
    name: str

    class Config:
        from_attributes = True

# --- API Endpoints ---

# Users (For dropdowns)
@router.get("/users", response_model=List[UserSchema])
def get_users(db: Session = Depends(get_db)):
    """전체 사용자 목록을 조회합니다."""
    return db.query(User).all()

# Accounts
@router.get("/accounts", response_model=List[AccountSchema])
def get_accounts(db: Session = Depends(get_db)):
    """전체 계좌 목록을 조회합니다."""
    return db.query(Account).order_by(Account.id.desc()).all()

@router.post("/accounts", response_model=AccountSchema)
def create_account(account: AccountSchema, db: Session = Depends(get_db)):
    """새로운 계좌를 생성합니다."""
    data = account.model_dump(exclude={"id"})
    db_account = Account(**data)
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    return db_account

@router.put("/accounts/{account_id}", response_model=AccountSchema)
def update_account(account_id: int, account: AccountSchema, db: Session = Depends(get_db)):
    """기존 계좌 정보를 수정합니다."""
    db_account = db.query(Account).filter(Account.id == account_id).first()
    if not db_account:
        raise HTTPException(status_code=404, detail="Account not found")
    data = account.model_dump(exclude={"id"})
    for key, value in data.items():
        setattr(db_account, key, value)
    db.commit()
    db.refresh(db_account)
    return db_account

@router.delete("/accounts/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db)):
    """계좌를 삭제합니다."""
    db_account = db.query(Account).filter(Account.id == account_id).first()
    if not db_account:
        raise HTTPException(status_code=404, detail="Account not found")
    db.delete(db_account)
    db.commit()
    return {"message": "Deleted"}

# Assets
@router.get("/assets", response_model=List[AssetSchema])
def get_assets(db: Session = Depends(get_db)):
    """전체 자산 마스터 목록을 조회합니다."""
    return db.query(Asset).order_by(Asset.id.desc()).all()

@router.post("/assets", response_model=AssetSchema)
def create_asset(asset: AssetSchema, db: Session = Depends(get_db)):
    """새로운 자산 마스터를 생성합니다."""
    data = asset.model_dump(exclude={"id"})
    db_asset = Asset(**data)
    db.add(db_asset)
    db.commit()
    db.refresh(db_asset)
    return db_asset

@router.put("/assets/{asset_id}", response_model=AssetSchema)
def update_asset(asset_id: int, asset: AssetSchema, db: Session = Depends(get_db)):
    """기존 자산 마스터 정보를 수정합니다."""
    db_asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not db_asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    data = asset.model_dump(exclude={"id"})
    for key, value in data.items():
        setattr(db_asset, key, value)
    db.commit()
    db.refresh(db_asset)
    return db_asset

@router.delete("/assets/{asset_id}")
def delete_asset(asset_id: int, db: Session = Depends(get_db)):
    """자산 마스터를 삭제합니다."""
    db_asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not db_asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    db.delete(db_asset)
    db.commit()
    return {"message": "Deleted"}

# Transactions
@router.get("/transactions", response_model=List[TransactionSchema])
def get_transactions(db: Session = Depends(get_db)):
    """전체 거래 내역을 조회합니다."""
    return db.query(Transaction).order_by(Transaction.transaction_date.desc(), Transaction.id.desc()).all()

@router.post("/transactions", response_model=TransactionSchema)
def create_transaction(transaction: TransactionSchema, db: Session = Depends(get_db)):
    """새로운 거래 내역을 생성합니다."""
    data = transaction.model_dump(exclude={"id"})
    db_transaction = Transaction(**data)
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction

@router.put("/transactions/{transaction_id}", response_model=TransactionSchema)
def update_transaction(transaction_id: int, transaction: TransactionSchema, db: Session = Depends(get_db)):
    """기존 거래 내역 정보를 수정합니다."""
    db_transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not db_transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    data = transaction.model_dump(exclude={"id"})
    for key, value in data.items():
        setattr(db_transaction, key, value)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction

@router.delete("/transactions/{transaction_id}")
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    """거래 내역을 삭제합니다."""
    db_transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not db_transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(db_transaction)
    db.commit()
    return {"message": "Deleted"}

# Snapshots
@router.get("/snapshots", response_model=List[SnapshotSchema])
def get_snapshots(db: Session = Depends(get_db)):
    """전체 자산 상태 스냅샷 목록을 조회합니다.

    Returns:
        List[SnapshotSchema]: 자산 상태 스냅샷 객체 리스트 (최신순)
    """
    return db.query(AccountSnapshot).order_by(AccountSnapshot.snapshot_date.desc()).all()

@router.post("/snapshots/preview", response_model=List[SnapshotPreviewSchema])
async def preview_snapshots(req: SaveSnapshotRequest, db: Session = Depends(get_db)):
    """입력받은 환율을 적용하여 저장될 스냅샷 데이터를 미리 계산합니다.

    Args:
        req (SaveSnapshotRequest): 기준 일자와 환율 정보를 포함한 요청 객체
        db (Session): 데이터베이스 세션

    Returns:
        List[SnapshotPreviewSchema]: 각 계좌별 계산된 스냅샷 미리보기 데이터 리스트
    """
    dashboard_service = DashboardService(db)
    
    accounts = db.query(Account).filter(Account.is_active == True).all()
    if not accounts:
        return []

    # 1. 현재 보유 자산 및 주가 조회
    holdings = dashboard_service.get_holdings()
    query_tickers = list(set([h['asset'].ticker for h in holdings]))
    prices = await dashboard_service.get_current_prices(query_tickers)
    
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
            valuation_krw = valuation * req.exchange_rate
        
        if acc_id in account_valuations:
            account_valuations[acc_id] += valuation_krw
            
    # 3. 각 계좌별 스냅샷 데이터 산출
    # 최적화: 모든 계좌의 트랜잭션을 한 번에 조회
    account_ids = [acc.id for acc in accounts]
    all_transactions = db.query(Transaction).filter(
        Transaction.account_id.in_(account_ids),
        Transaction.transaction_date <= req.snapshot_date
    ).all()
    
    # 계좌별 트랜잭션 그룹화
    tx_by_account = {acc_id: [] for acc_id in account_ids}
    for tx in all_transactions:
        tx_by_account[tx.account_id].append(tx)

    previews = []
    for acc in accounts:
        val_krw = account_valuations[acc.id]
        
        # 이전 마지막 스냅샷 조회 (기간 입금액 계산용)
        last_snapshot = db.query(AccountSnapshot).filter(
            AccountSnapshot.account_id == acc.id,
            AccountSnapshot.snapshot_date < req.snapshot_date
        ).order_by(AccountSnapshot.snapshot_date.desc()).first()
        
        last_date = last_snapshot.snapshot_date if last_snapshot else date(1970, 1, 1)
        
        period_deposit_krw = 0.0
        total_net_deposit_krw = 0.0
        
        for tx in tx_by_account[acc.id]:
            # 트랜잭션 당시 환율이 있으면 그것을 쓰고, 없으면 입력받은 환율(또는 1.0)을 적용하여 원화 환산
            tx_rate = tx.exchange_rate if tx.exchange_rate else (req.exchange_rate if tx.currency == 'USD' else 1.0)
            amount_krw = tx.total_amount
            if tx.currency == 'USD':
                amount_krw = tx.total_amount * tx_rate
                
            # 전체 누적 순 입금액 (수익 계산용)
            if tx.type in ['DEPOSIT', 'INITIAL_BALANCE']:
                total_net_deposit_krw += amount_krw
            elif tx.type == 'WITHDRAW':
                total_net_deposit_krw -= amount_krw
            
            # 특정 기간 순 입금액 (스냅샷 기록용)
            if tx.transaction_date > last_date:
                if tx.type in ['DEPOSIT', 'INITIAL_BALANCE']:
                    period_deposit_krw += amount_krw
                elif tx.type == 'WITHDRAW':
                    period_deposit_krw -= amount_krw
                
        total_profit = val_krw - total_net_deposit_krw
        
        previews.append(SnapshotPreviewSchema(
            account_id=acc.id,
            account_name=acc.name,
            snapshot_date=req.snapshot_date,
            period_deposit=period_deposit_krw,
            total_valuation=val_krw,
            total_profit=total_profit
        ))
        
    return previews

@router.post("/snapshots/save", response_model=List[SnapshotSchema])
async def save_snapshots(previews: List[SnapshotPreviewSchema], db: Session = Depends(get_db)):
    """확인된 미리보기 데이터를 바탕으로 스냅샷을 실제 DB에 저장합니다.

    Args:
        previews (List[SnapshotPreviewSchema]): 저장할 스냅샷 데이터 리스트
        db (Session): 데이터베이스 세션

    Returns:
        List[SnapshotSchema]: DB에 저장된 최종 스냅샷 객체 리스트
    """
    saved_snapshots = []
    # 중복 제거 및 일괄 저장을 위한 계좌 ID 및 날짜 추출
    for p in previews:
        # 기존 동일 날짜 데이터 삭제
        db.query(AccountSnapshot).filter(
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
        db.add(new_snap)
        saved_snapshots.append(new_snap)
        
    db.commit()
    for snap in saved_snapshots:
        db.refresh(snap)
    return saved_snapshots
