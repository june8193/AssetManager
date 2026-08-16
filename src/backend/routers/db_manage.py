import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional, Literal
from datetime import date, datetime

from ..database import get_db
from ..models import Account, Asset, Transaction, AccountSnapshot, User, ExchangeRate, VALID_CATEGORIES
from ..schemas import (
    UserSchema,
    AccountSchema,
    AssetSchema,
    TransactionSchema,
    TransferTransactionRequest,
    SaveSnapshotRequest,
    SnapshotPreviewSchema,
    SnapshotSchema,
    BrokerageCalculateRequest,
    BrokerageCalculateResponse,
    BrokerageSaveAccountRequest,
    BrokerageSaveRequest,
    BankCalculateRequest,
    BankCalculateResponse,
    BankSaveAccountRequest,
    BankSaveRequest,
    UnifiedSaveRequest,
    LatestSnapshotDateResponse,
)
from ..services.dashboard_service import DashboardService
from ..services.ledger_engine import LedgerEngine
from ..services.price_service import price_service
from ..services.snapshot_service import SnapshotService
from ..services.transaction_service import TransactionService


router = APIRouter(
    prefix="/api/db",
    tags=["db_manage"]
)


# --- Re-exported Handlers for Backward Compatibility ---
from .accounts import (
    get_users,
    get_accounts,
    create_account,
    update_account,
    delete_account,
)
from .assets import (
    get_assets,
    get_categories,
    verify_asset,
    create_asset,
    update_asset,
    delete_asset,
)
from .transactions import (
    get_transactions,
    create_transaction,
    create_transfer_transaction,
    update_transaction,
    delete_transaction,
    get_period_transactions,
)




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

@router.delete("/snapshots/{snapshot_date}")
def delete_snapshots_by_date(snapshot_date: date, db: Session = Depends(get_db)):
    """지정된 날짜의 모든 계좌 스냅샷 데이터 및 관련 보정 거래를 삭제합니다."""
    # 1. 해당 날짜의 스냅샷 데이터 존재 여부 검사
    exists = db.query(AccountSnapshot).filter(AccountSnapshot.snapshot_date == snapshot_date).first()
    if not exists:
        raise HTTPException(status_code=404, detail="해당 날짜의 스냅샷을 찾을 수 없습니다.")

    # 2. 해당 날짜에 생성된 CASH_ADJUSTMENT 거래 내역도 함께 삭제
    db.query(Transaction).filter(
        Transaction.transaction_date == snapshot_date,
        Transaction.type == "CASH_ADJUSTMENT"
    ).delete()

    # 3. 스냅샷 데이터 삭제
    db.query(AccountSnapshot).filter(AccountSnapshot.snapshot_date == snapshot_date).delete()

    db.commit()
    return {"message": f"Deleted snapshots and adjustments for {snapshot_date}"}


@router.post("/snapshots/preview", response_model=List[SnapshotPreviewSchema])
async def preview_snapshots(req: SaveSnapshotRequest, db: Session = Depends(get_db)):
    """입력받은 환율을 적용하여 저장될 스냅샷 데이터를 미리 계산합니다."""
    return await SnapshotService(db).preview_snapshots(req.snapshot_date, req.exchange_rate)

def _save_snapshots_logic(previews: List[SnapshotPreviewSchema], db: Session, commit: bool = True) -> List[AccountSnapshot]:
    """스냅샷 저장 로직의 실제 구현부입니다."""
    return SnapshotService(db).save_snapshots(previews, commit=commit)

@router.post("/snapshots/save", response_model=List[SnapshotSchema])
async def save_snapshots(previews: List[SnapshotPreviewSchema], db: Session = Depends(get_db)):
    """확인된 미리보기 데이터를 바탕으로 스냅샷을 실제 DB에 저장합니다."""
    return SnapshotService(db).save_snapshots(previews, commit=True)


# --- Helper Functions for Snapshot Saving ---

def _save_exchange_rate_logic(db: Session, target_date: date, rate: float):
    """입력받은 환율 정보를 exchange_rates 테이블에 저장하거나 업데이트합니다.

    Args:
        db (Session): 데이터베이스 세션
        target_date (date): 환율을 적용할 날짜
        rate (float): 환율 (USD/KRW)
    """
    existing_rate = db.query(ExchangeRate).filter(
        ExchangeRate.date == target_date,
        ExchangeRate.currency == "USD"
    ).first()
    
    if existing_rate:
        existing_rate.rate = rate
    else:
        new_rate = ExchangeRate(
            date=target_date,
            currency="USD",
            rate=rate
        )
        db.add(new_rate)

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
            data = tx_schema.model_dump(exclude={"id", "asset_name", "asset_ticker"})
            if data['currency'] == 'KRW':
                data['asset_id'] = krw_asset_id
            elif data['currency'] == 'USD':
                data['asset_id'] = usd_asset_id
            else:
                raise HTTPException(status_code=400, detail=f"지원하지 않는 통화입니다: {data['currency']}")
            
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
            data = tx_schema.model_dump(exclude={"id", "asset_name", "asset_ticker"})
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
    # 1. 기존 DB 기반 이론상 현금 계산 (LedgerEngine 단일 원장 엔진 활용)
    base_state = LedgerEngine.get_positions(db, account_id=req.account_id, as_of=req.snapshot_date)
    
    # 2. 사용자가 새로 입력한 입출금 내역 반영
    new_state = LedgerEngine.replay(req.new_transactions)
    
    theoretical_krw = base_state.cash_krw + new_state.cash_krw
    theoretical_usd = base_state.cash_usd + new_state.cash_usd
    
    # 3. 차액 계산
    diff_krw = req.current_krw - theoretical_krw
    diff_usd = req.current_usd - theoretical_usd

    # 4. 마지막 스냅샷 이후의 기존 트랜잭션 조회
    last_snapshot = db.query(AccountSnapshot).filter(
        AccountSnapshot.account_id == req.account_id,
        AccountSnapshot.snapshot_date < req.snapshot_date
    ).order_by(AccountSnapshot.snapshot_date.desc()).first()
    
    last_date = last_snapshot.snapshot_date if last_snapshot else date(1970, 1, 1)
    
    existing_transactions = db.query(Transaction).options(joinedload(Transaction.asset)).filter(
        Transaction.account_id == req.account_id,
        Transaction.transaction_date > last_date,
        Transaction.transaction_date <= req.snapshot_date
    ).order_by(Transaction.transaction_date.desc()).all()
    
    # 5. 기간 입금액 계산 및 통화별 주식 매매/입출금액의 원화 환산액 집계
    period_deposit = 0.0
    period_deposit_krw = 0.0
    period_deposit_usd_krw = 0.0
    
    # 비현금 자산(주식)의 매수/매도 대금 합계
    buy_krw_non_cash = 0.0
    sell_krw_non_cash = 0.0
    buy_usd_non_cash_krw = 0.0
    sell_usd_non_cash_krw = 0.0
    buy_usd_non_cash = 0.0
    sell_usd_non_cash = 0.0

    # 예수금 화면 표시용 변수 (순수 입금/출금 수량 합계)
    deposit_krw = 0.0
    withdraw_krw = 0.0
    deposit_usd = 0.0
    withdraw_usd = 0.0

    def get_tx_rate(t):
        if t.exchange_rate:
            return t.exchange_rate
        return req.exchange_rate if t.currency == 'USD' else 1.0

    # 기존 트랜잭션 집계
    for tx in existing_transactions:
        tx_rate = get_tx_rate(tx)
        amount_krw = tx.total_amount * tx_rate if tx.currency == 'USD' else tx.total_amount
        
        # 입출금 집계
        if tx.type == 'DEPOSIT':
            period_deposit += amount_krw
            if tx.currency == 'KRW':
                period_deposit_krw += amount_krw
                deposit_krw += tx.total_amount
            elif tx.currency == 'USD':
                period_deposit_usd_krw += amount_krw
                deposit_usd += tx.total_amount
        elif tx.type == 'WITHDRAW':
            period_deposit -= amount_krw
            if tx.currency == 'KRW':
                period_deposit_krw -= amount_krw
                withdraw_krw += tx.total_amount
            elif tx.currency == 'USD':
                period_deposit_usd_krw -= amount_krw
                withdraw_usd += tx.total_amount
                
        # 비현금 자산의 주식 매매액 집계
        if tx.asset and tx.asset.ticker not in ['KRW', 'USD']:
            if tx.type == 'BUY':
                if tx.currency == 'KRW':
                    buy_krw_non_cash += amount_krw
                elif tx.currency == 'USD':
                    buy_usd_non_cash_krw += amount_krw
                    buy_usd_non_cash += tx.total_amount
            elif tx.type == 'SELL':
                if tx.currency == 'KRW':
                    sell_krw_non_cash += amount_krw
                elif tx.currency == 'USD':
                    sell_usd_non_cash_krw += amount_krw
                    sell_usd_non_cash += tx.total_amount

    # 신규 트랜잭션 집계
    for tx in req.new_transactions:
        tx_rate = get_tx_rate(tx)
        amount_krw = tx.total_amount * tx_rate if tx.currency == 'USD' else tx.total_amount
        
        # 입출금 집계
        if tx.type == 'DEPOSIT':
            period_deposit += amount_krw
            if tx.currency == 'KRW':
                period_deposit_krw += amount_krw
                deposit_krw += tx.total_amount
            elif tx.currency == 'USD':
                period_deposit_usd_krw += amount_krw
                deposit_usd += tx.total_amount
        elif tx.type == 'WITHDRAW':
            period_deposit -= amount_krw
            if tx.currency == 'KRW':
                period_deposit_krw -= amount_krw
                withdraw_krw += tx.total_amount
            elif tx.currency == 'USD':
                period_deposit_usd_krw -= amount_krw
                withdraw_usd += tx.total_amount
                
        # 비현금 자산의 주식 매매액 집계
        if tx.asset_id != 0:
            asset_obj = db.query(Asset).filter(Asset.id == tx.asset_id).first()
            if asset_obj and asset_obj.ticker not in ['KRW', 'USD']:
                if tx.type == 'BUY':
                    if tx.currency == 'KRW':
                        buy_krw_non_cash += amount_krw
                    elif tx.currency == 'USD':
                        buy_usd_non_cash_krw += amount_krw
                        buy_usd_non_cash += tx.total_amount
                elif tx.type == 'SELL':
                    if tx.currency == 'KRW':
                        sell_krw_non_cash += amount_krw
                    elif tx.currency == 'USD':
                        sell_usd_non_cash_krw += amount_krw
                        sell_usd_non_cash += tx.total_amount


    # 6. 비현금 자산 평가액 및 기간 수익 계산
    dashboard_service = DashboardService(db)
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
    # 1. 기존 DB 기반 이론상 현금 계산 (LedgerEngine 단일 원장 엔진 활용)
    base_state = LedgerEngine.get_positions(db, account_id=req.account_id, as_of=req.snapshot_date)
    
    # 2. 사용자가 새로 입력한 내역 반영
    new_state = LedgerEngine.replay(req.new_transactions)
    final_balance = base_state.cash_krw + new_state.cash_krw

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
    
    # 4. 거래 유형별 합계 계산 (TDD 요구사항 반영)
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
            
    return BankCalculateResponse(
        theoretical_krw=final_balance,
        existing_transactions=existing_transactions,
        total_deposit=total_deposit,
        total_withdraw=total_withdraw,
        total_interest=total_interest,
        total_tax=total_tax,
        total_adjustment=total_adjustment
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
        raise HTTPException(status_code=500, detail="데이터베이스에서 KRW 또는 USD 자산을 찾을 수 없습니다.")

    try:
        _save_exchange_rate_logic(db, req.snapshot_date, req.exchange_rate)
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
        raise HTTPException(status_code=500, detail=f"증권 스냅샷 저장 중 오류 발생: {str(e)}")

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
        raise HTTPException(status_code=500, detail="데이터베이스에서 KRW 자산을 찾을 수 없습니다.")

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
        raise HTTPException(status_code=500, detail=f"은행 스냅샷 저장 중 오류 발생: {str(e)}")

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
        raise HTTPException(status_code=500, detail="데이터베이스에서 KRW 또는 USD 자산을 찾을 수 없습니다.")

    try:
        _save_exchange_rate_logic(db, req.snapshot_date, req.exchange_rate)
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
        raise HTTPException(status_code=500, detail=f"통합 스냅샷 저장 중 오류 발생: {str(e)}")

