from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime

from ..database import get_db
from ..models import Account, Asset, Transaction, AccountSnapshot, User, ExchangeRate
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
        user_name (Optional[str]): 사용자 이름 (추가)
        name (str): 계좌 이름/번호
        provider (str): 금융 기관 이름
        alias (Optional[str]): 계좌 별칭
        account_type (str): 계좌 종류 (BROKERAGE, BANK)
        is_active (bool): 계좌 활성 여부
    """
    id: Optional[int] = None
    user_id: int
    user_name: Optional[str] = None
    name: str
    provider: str
    alias: Optional[str] = None
    account_type: str = "BROKERAGE"
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
        memo (Optional[str]): 메모
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
    memo: Optional[str] = None

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

class BrokerageCalculateRequest(BaseModel):
    account_id: int
    snapshot_date: date
    new_transactions: List[TransactionSchema]
    current_krw: float
    current_usd: float
    exchange_rate: float

class BrokerageCalculateResponse(BaseModel):
    theoretical_krw: float
    theoretical_usd: float
    diff_krw: float
    diff_usd: float
    existing_transactions: List[TransactionSchema] = []
    period_deposit: float = 0.0
    period_profit: float = 0.0

class BrokerageSaveAccountRequest(BaseModel):
    account_id: int
    new_transactions: List[TransactionSchema]
    diff_krw: float # 원화 차액 (배당 또는 수수료)
    diff_usd: float # 달러 차액 (배당 또는 수수료)

class BrokerageSaveRequest(BaseModel):
    snapshot_date: date
    exchange_rate: float
    accounts: List[BrokerageSaveAccountRequest]

class BankCalculateRequest(BaseModel):
    """은행계좌 잔액 계산을 위한 요청 스키마입니다."""
    account_id: int
    snapshot_date: date
    new_transactions: List[TransactionSchema]

class BankCalculateResponse(BaseModel):
    """은행계좌 잔액 계산 결과 스키마입니다."""
    theoretical_krw: float
    existing_transactions: List[TransactionSchema] = []

# Bank Snapshot Wizard Schemas
class BankSaveAccountRequest(BaseModel):
    account_id: int
    new_transactions: List[TransactionSchema]
    total_valuation: Optional[float] = None # 은행 계좌는 현재 잔액이 곧 총 평가액 (선택 사항)

class BankSaveRequest(BaseModel):
    snapshot_date: date
    accounts: List[BankSaveAccountRequest]

class UnifiedSaveRequest(BaseModel):
    snapshot_date: date
    exchange_rate: float
    brokerage_accounts: List[BrokerageSaveAccountRequest]
    bank_accounts: List[BankSaveAccountRequest]

class LatestSnapshotDateResponse(BaseModel):
    """최신 스냅샷 날짜 정보를 담는 스키마입니다."""
    latest_date: Optional[date] = None

# --- API Endpoints ---

# Users (For dropdowns)
@router.get("/users", response_model=List[UserSchema])
def get_users(db: Session = Depends(get_db)):
    """전체 사용자 목록을 조회합니다."""
    return db.query(User).all()

# Accounts
@router.get("/accounts", response_model=List[AccountSchema])
def get_accounts(db: Session = Depends(get_db)):
    """전체 계좌 목록을 조회합니다 (소유자 이름 포함)."""
    results = db.query(Account, User.name.label("user_name")) \
                .join(User, Account.user_id == User.id) \
                .order_by(Account.id.desc()).all()
    
    accounts = []
    for acc, user_name in results:
        # Pydantic schema expects user_name to be present in the dict/object
        acc_dict = {c.name: getattr(acc, c.name) for c in acc.__table__.columns}
        acc_dict['user_name'] = user_name
        accounts.append(AccountSchema(**acc_dict))
    return accounts

@router.post("/accounts", response_model=AccountSchema)
def create_account(account: AccountSchema, db: Session = Depends(get_db)):
    """새로운 계좌를 생성합니다."""
    data = account.model_dump(exclude={"id", "user_name"})
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
    data = account.model_dump(exclude={"id", "user_name"})
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

@router.get("/snapshots/latest", response_model=LatestSnapshotDateResponse)
def get_latest_snapshot_date(db: Session = Depends(get_db)):
    """가장 최근에 기록된 스냅샷의 날짜를 조회합니다."""
    latest_snapshot = db.query(AccountSnapshot).order_by(AccountSnapshot.snapshot_date.desc()).first()
    return LatestSnapshotDateResponse(latest_date=latest_snapshot.snapshot_date if latest_snapshot else None)

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
                
        if acc.account_type == 'BROKERAGE':
            last_valuation = last_snapshot.total_valuation if last_snapshot else 0.0
            total_profit = val_krw - last_valuation - period_deposit_krw
        else:
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

def _save_snapshots_logic(previews: List[SnapshotPreviewSchema], db: Session, commit: bool = True) -> List[AccountSnapshot]:
    """스냅샷 저장 로직의 실제 구현부입니다. (트랜잭션 제어 가능)

    Args:
        previews (List[SnapshotPreviewSchema]): 저장할 스냅샷 미리보기 데이터 리스트
        db (Session): 데이터베이스 세션
        commit (bool): DB 커밋 수행 여부. 기본값은 True.

    Returns:
        List[AccountSnapshot]: 생성된 AccountSnapshot 객체 리스트
    """
    saved_snapshots = []
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
        
    if commit:
        db.commit()
        for snap in saved_snapshots:
            db.refresh(snap)
    return saved_snapshots

@router.post("/snapshots/save", response_model=List[SnapshotSchema])
async def save_snapshots(previews: List[SnapshotPreviewSchema], db: Session = Depends(get_db)):
    """확인된 미리보기 데이터를 바탕으로 스냅샷을 실제 DB에 저장합니다.

    Args:
        previews (List[SnapshotPreviewSchema]): 저장할 스냅샷 데이터 리스트
        db (Session): 데이터베이스 세션

    Returns:
        List[SnapshotSchema]: DB에 저장된 최종 스냅샷 객체 리스트
    """
    return _save_snapshots_logic(previews, db, commit=True)

# --- Helper Functions for Snapshot Saving ---

def _process_brokerage_accounts_logic(
    db: Session, 
    snapshot_date: date, 
    accounts: List[BrokerageSaveAccountRequest], 
    krw_asset_id: int, 
    usd_asset_id: int
):
    """증권 계좌의 신규 트랜잭션 및 잔고 보정 내역을 처리합니다.

    Args:
        db (Session): 데이터베이스 세션
        snapshot_date (date): 스냅샷 기준일
        accounts (List[BrokerageSaveAccountRequest]): 증권 계좌 저장 요청 리스트
        krw_asset_id (int): 원화 자산 ID
        usd_asset_id (int): 달러 자산 ID
    """
    for acc_req in accounts:
        # 1. 신규 입출금 내역 저장
        for tx_schema in acc_req.new_transactions:
            data = tx_schema.model_dump(exclude={"id"})
            if data['currency'] == 'KRW':
                data['asset_id'] = krw_asset_id
            elif data['currency'] == 'USD':
                data['asset_id'] = usd_asset_id
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported currency: {data['currency']}")
            
            if data['quantity'] == 0 and data['total_amount'] != 0:
                data['quantity'] = data['total_amount']
            
            db.add(Transaction(**data))
        
        # 2. 차액(잔고 보정) 저장
        if abs(acc_req.diff_krw) > 0.01:
            db.add(Transaction(
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
            db.add(Transaction(
                account_id=acc_req.account_id,
                asset_id=usd_asset_id,
                transaction_date=snapshot_date,
                type="CASH_ADJUSTMENT",
                quantity=acc_req.diff_usd,
                price=1.0,
                total_amount=acc_req.diff_usd,
                currency="USD"
            ))

def _process_bank_accounts_logic(
    db: Session, 
    accounts: List[BankSaveAccountRequest], 
    krw_asset_id: int
):
    """은행 계좌의 신규 트랜잭션 내역을 처리합니다.

    Args:
        db (Session): 데이터베이스 세션
        accounts (List[BankSaveAccountRequest]): 은행 계좌 저장 요청 리스트
        krw_asset_id (int): 원화 자산 ID
    """
    for acc_req in accounts:
        for tx_schema in acc_req.new_transactions:
            data = tx_schema.model_dump(exclude={"id"})
            data['asset_id'] = krw_asset_id
            
            if data['quantity'] == 0 and data['total_amount'] != 0:
                data['quantity'] = data['total_amount']
            
            db.add(Transaction(**data))

def _update_bank_previews_logic(
    db: Session, 
    previews: List[SnapshotPreviewSchema], 
    bank_accounts_req: List[BankSaveAccountRequest]
):
    """은행 계좌의 총 평가액을 사용자 입력값으로 업데이트하고 수익을 재계산합니다.

    Args:
        db (Session): 데이터베이스 세션
        previews (List[SnapshotPreviewSchema]): 계산된 미리보기 리스트
        bank_accounts_req (List[BankSaveAccountRequest]): 은행 계좌 저장 요청 리스트
    """
    bank_valuation_map = {acc.account_id: acc.total_valuation for acc in bank_accounts_req if acc.total_valuation is not None}
    if not bank_valuation_map:
        return

    bank_account_ids = list(bank_valuation_map.keys())
    snapshot_date = previews[0].snapshot_date if previews else None
    
    # N+1 쿼리 방지: 모든 해당 은행 계좌의 트랜잭션을 한 번에 조회
    all_txs = db.query(Transaction).filter(
        Transaction.account_id.in_(bank_account_ids),
        Transaction.transaction_date <= snapshot_date
    ).all()
    
    # 계좌별 순 입금액 계산을 위한 그룹화
    net_deposits = {acc_id: 0.0 for acc_id in bank_account_ids}
    for tx in all_txs:
        if tx.type in ['DEPOSIT', 'INITIAL_BALANCE']:
            net_deposits[tx.account_id] += tx.total_amount
        elif tx.type == 'WITHDRAW':
            net_deposits[tx.account_id] -= tx.total_amount

    for p in previews:
        if p.account_id in bank_valuation_map:
            p.total_valuation = bank_valuation_map[p.account_id]
            p.total_profit = p.total_valuation - net_deposits[p.account_id]

# --- Brokerage Wizard Endpoints ---

@router.post("/snapshots/brokerage/calculate", response_model=BrokerageCalculateResponse)
async def calculate_brokerage_snapshot(req: BrokerageCalculateRequest, db: Session = Depends(get_db)):
    """증권계좌의 이론상 현금 잔액을 계산하고 입력값과의 차액(배당금 등)을 산출합니다.

    Args:
        req (BrokerageCalculateRequest): 계산 요청 데이터 (계좌 ID, 기준일, 신규 내역, 현재 잔액 등)
        db (Session): 데이터베이스 세션

    Returns:
        BrokerageCalculateResponse: 이론적 잔액 및 실제 잔액과의 차액 결과
    """
    dashboard_service = DashboardService(db)
    
    # 1. 기존 DB 기반 이론상 현금 계산
    theoretical = dashboard_service.calculate_theoretical_cash(req.account_id, req.snapshot_date)
    
    # 2. 사용자가 새로 입력한 입출금 내역 반영
    new_krw_net = 0.0
    new_usd_net = 0.0
    for tx in req.new_transactions:
        if tx.currency == 'KRW':
            if tx.type in ['DEPOSIT', 'INITIAL_BALANCE', 'DIVIDEND', 'INTEREST', 'CASH_ADJUSTMENT', 'SELL']:
                new_krw_net += tx.total_amount
            elif tx.type in ['WITHDRAW', 'FEE', 'TAX', 'BUY']:
                new_krw_net -= tx.total_amount
        elif tx.currency == 'USD':
            if tx.type in ['DEPOSIT', 'INITIAL_BALANCE', 'DIVIDEND', 'INTEREST', 'CASH_ADJUSTMENT', 'SELL']:
                new_usd_net += tx.total_amount
            elif tx.type in ['WITHDRAW', 'FEE', 'TAX', 'BUY']:
                new_usd_net -= tx.total_amount
    
    theoretical_krw = theoretical['KRW'] + new_krw_net
    theoretical_usd = theoretical['USD'] + new_usd_net
    
    # 3. 차액 계산
    diff_krw = req.current_krw - theoretical_krw
    diff_usd = req.current_usd - theoretical_usd

    # 4. 마지막 스냅샷 이후의 기존 트랜잭션 조회
    last_snapshot = db.query(AccountSnapshot).filter(
        AccountSnapshot.account_id == req.account_id,
        AccountSnapshot.snapshot_date < req.snapshot_date
    ).order_by(AccountSnapshot.snapshot_date.desc()).first()
    
    last_date = last_snapshot.snapshot_date if last_snapshot else date(1970, 1, 1)
    
    existing_transactions = db.query(Transaction).filter(
        Transaction.account_id == req.account_id,
        Transaction.transaction_date > last_date,
        Transaction.transaction_date <= req.snapshot_date
    ).order_by(Transaction.transaction_date.desc()).all()
    
    # 5. 기간 입금액 계산 (기존 트랜잭션 + 신규 입력 트랜잭션 중 입출금 내역의 원화 환산액 합계)
    period_deposit = 0.0
    for tx in existing_transactions:
        tx_rate = tx.exchange_rate if tx.exchange_rate else (req.exchange_rate if tx.currency == 'USD' else 1.0)
        amount_krw = tx.total_amount
        if tx.currency == 'USD':
            amount_krw = tx.total_amount * tx_rate
            
        if tx.type in ['DEPOSIT', 'INITIAL_BALANCE']:
            period_deposit += amount_krw
        elif tx.type == 'WITHDRAW':
            period_deposit -= amount_krw
            
    for tx in req.new_transactions:
        tx_rate = tx.exchange_rate if tx.exchange_rate else (req.exchange_rate if tx.currency == 'USD' else 1.0)
        amount_krw = tx.total_amount
        if tx.currency == 'USD':
            amount_krw = tx.total_amount * tx_rate
            
        if tx.type in ['DEPOSIT', 'INITIAL_BALANCE']:
            period_deposit += amount_krw
        elif tx.type == 'WITHDRAW':
            period_deposit -= amount_krw

    # 6. 비현금 자산 평가액 및 기간 수익 계산
    holdings = dashboard_service.get_holdings()
    acc_holdings = [h for h in holdings if h['account'].id == req.account_id and h['asset'].ticker not in ['KRW', 'USD']]
    
    non_cash_valuation = 0.0
    if acc_holdings:
        tickers = list(set([h['asset'].ticker for h in acc_holdings]))
        prices = await dashboard_service.get_current_prices(tickers)
        for h in acc_holdings:
            asset = h['asset']
            qty = h['quantity']
            price = prices.get(asset.ticker, 0.0)
            val = qty * price
            if asset.country == 'US' or asset.ticker == 'USD':
                val = val * req.exchange_rate
            non_cash_valuation += val
            
    total_valuation = (req.current_krw + req.current_usd * req.exchange_rate) + non_cash_valuation
    last_valuation = last_snapshot.total_valuation if last_snapshot else 0.0
    
    period_profit = total_valuation - last_valuation - period_deposit
    
    return BrokerageCalculateResponse(
        theoretical_krw=theoretical_krw,
        theoretical_usd=theoretical_usd,
        diff_krw=diff_krw,
        diff_usd=diff_usd,
        existing_transactions=existing_transactions,
        period_deposit=period_deposit,
        period_profit=period_profit
    )

@router.post("/snapshots/bank/calculate", response_model=BankCalculateResponse)
async def calculate_bank_snapshot(req: BankCalculateRequest, db: Session = Depends(get_db)):
    """은행계좌의 예상 잔액을 계산합니다.

    Args:
        req (BankCalculateRequest): 계산 요청 데이터 (계좌 ID, 기준일, 신규 내역 등)
        db (Session): 데이터베이스 세션

    Returns:
        BankCalculateResponse: 계산된 최종 잔액
    """
    dashboard_service = DashboardService(db)
    
    # 1. 기존 DB 기반 이론상 현금 계산 (KRW만 사용)
    theoretical = dashboard_service.calculate_theoretical_cash(req.account_id, req.snapshot_date)
    
    # 2. 사용자가 새로 입력한 내역 반영
    new_krw_net = 0.0
    for tx in req.new_transactions:
        if tx.type in ['DEPOSIT', 'INITIAL_BALANCE', 'DIVIDEND', 'INTEREST', 'CASH_ADJUSTMENT']:
            new_krw_net += tx.total_amount
        elif tx.type in ['WITHDRAW', 'FEE', 'TAX']:
            new_krw_net -= tx.total_amount
        elif tx.type == 'BUY':
            new_krw_net -= tx.total_amount
        elif tx.type == 'SELL':
            new_krw_net += tx.total_amount
            
    final_balance = theoretical['KRW'] + new_krw_net

    # 3. 마지막 스냅샷 이후의 기존 트랜잭션 조회
    last_snapshot = db.query(AccountSnapshot).filter(
        AccountSnapshot.account_id == req.account_id,
        AccountSnapshot.snapshot_date < req.snapshot_date
    ).order_by(AccountSnapshot.snapshot_date.desc()).first()
    
    last_date = last_snapshot.snapshot_date if last_snapshot else date(1970, 1, 1)
    
    existing_transactions = db.query(Transaction).filter(
        Transaction.account_id == req.account_id,
        Transaction.transaction_date > last_date,
        Transaction.transaction_date <= req.snapshot_date
    ).order_by(Transaction.transaction_date.desc()).all()
    
    return BankCalculateResponse(
        theoretical_krw=final_balance,
        existing_transactions=existing_transactions
    )

@router.post("/snapshots/brokerage/save", response_model=List[SnapshotSchema])
async def save_brokerage_snapshots(req: BrokerageSaveRequest, db: Session = Depends(get_db)):
    """증권계좌의 입출금, 차액(배당/수수료)을 저장하고 최종 스냅샷을 생성합니다.

    Args:
        req (BrokerageSaveRequest): 저장 요청 데이터 (기준일, 환율, 계좌별 상세 데이터 등)
        db (Session): 데이터베이스 세션

    Returns:
        List[SnapshotSchema]: 생성된 최종 스냅샷 객체 리스트
    """
    krw_asset = db.query(Asset).filter(Asset.ticker == "KRW").first()
    usd_asset = db.query(Asset).filter(Asset.ticker == "USD").first()
    
    if not krw_asset or not usd_asset:
        raise HTTPException(status_code=500, detail="KRW or USD asset not found in database")

    try:
        _process_brokerage_accounts_logic(db, req.snapshot_date, req.accounts, krw_asset.id, usd_asset.id)
        
        db.flush() 
        
        previews = await preview_snapshots(SaveSnapshotRequest(
            snapshot_date=req.snapshot_date,
            exchange_rate=req.exchange_rate
        ), db)
        
        return _save_snapshots_logic(previews, db, commit=True)

    except Exception as e:
        db.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Error during brokerage snapshot save: {str(e)}")

@router.post("/snapshots/bank/save", response_model=List[SnapshotSchema])
async def save_bank_snapshots(req: BankSaveRequest, db: Session = Depends(get_db)):
    """은행 계좌의 입출금, 이자, 세금을 저장하고 최종 스냅샷을 생성합니다.

    Args:
        req (BankSaveRequest): 저장 요청 데이터 (기준일, 계좌별 상세 데이터 등)
        db (Session): 데이터베이스 세션

    Returns:
        List[SnapshotSchema]: 생성된 최종 스냅샷 객체 리스트
    """
    krw_asset = db.query(Asset).filter(Asset.ticker == "KRW").first()
    if not krw_asset:
        raise HTTPException(status_code=500, detail="KRW asset not found in database")

    try:
        latest_rate_obj = db.query(ExchangeRate).order_by(ExchangeRate.date.desc()).first()
        latest_rate = latest_rate_obj.rate if latest_rate_obj else 1350.0

        _process_bank_accounts_logic(db, req.accounts, krw_asset.id)
        
        db.flush() 
        
        previews = await preview_snapshots(SaveSnapshotRequest(
            snapshot_date=req.snapshot_date,
            exchange_rate=latest_rate
        ), db)
        
        _update_bank_previews_logic(db, previews, req.accounts)

        return _save_snapshots_logic(previews, db, commit=True)

    except Exception as e:
        db.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Error during bank snapshot save: {str(e)}")

@router.post("/snapshots/unified/save", response_model=List[SnapshotSchema])
async def save_unified_snapshots(req: UnifiedSaveRequest, db: Session = Depends(get_db)):
    """증권계좌와 은행계좌의 데이터를 통합하여 저장하고 최종 스냅샷을 생성합니다.

    Args:
        req (UnifiedSaveRequest): 통합 저장 요청 데이터
        db (Session): 데이터베이스 세션

    Returns:
        List[SnapshotSchema]: 생성된 최종 스냅샷 객체 리스트
    """
    krw_asset = db.query(Asset).filter(Asset.ticker == "KRW").first()
    usd_asset = db.query(Asset).filter(Asset.ticker == "USD").first()
    
    if not krw_asset or not usd_asset:
        raise HTTPException(status_code=500, detail="KRW or USD asset not found in database")

    try:
        _process_brokerage_accounts_logic(db, req.snapshot_date, req.brokerage_accounts, krw_asset.id, usd_asset.id)
        _process_bank_accounts_logic(db, req.bank_accounts, krw_asset.id)
        
        db.flush()

        previews = await preview_snapshots(SaveSnapshotRequest(
            snapshot_date=req.snapshot_date,
            exchange_rate=req.exchange_rate
        ), db)
        
        _update_bank_previews_logic(db, previews, req.bank_accounts)

        return _save_snapshots_logic(previews, db, commit=True)

    except Exception as e:
        db.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Error during unified snapshot save: {str(e)}")

