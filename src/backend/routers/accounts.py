"""사용자 및 계좌 관리 CRUD 전용 API 라우터 모듈입니다."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import Account, User
from ..schemas import AccountSchema, UserSchema

router = APIRouter(
    prefix="/api/db",
    tags=["accounts"]
)


@router.get("/users", response_model=List[UserSchema])
def get_users(db: Session = Depends(get_db)):
    """전체 사용자 목록을 조회합니다.
    
    Args:
        db (Session): 데이터베이스 세션.
        
    Returns:
        List[UserSchema]: 사용자 목록.
    """
    return db.query(User).all()


@router.get("/accounts", response_model=List[AccountSchema])
def get_accounts(db: Session = Depends(get_db)):
    """전체 계좌 목록을 소유자 이름과 함께 조회합니다.
    
    Args:
        db (Session): 데이터베이스 세션.
        
    Returns:
        List[AccountSchema]: 계좌 목록.
    """
    results = db.query(Account, User.name.label("user_name")) \
                .join(User, Account.user_id == User.id) \
                .order_by(Account.id.desc()).all()
    
    accounts = []
    for acc, user_name in results:
        acc_dict = {c.name: getattr(acc, c.name) for c in acc.__table__.columns}
        acc_dict['user_name'] = user_name
        accounts.append(AccountSchema(**acc_dict))
    return accounts


@router.post("/accounts", response_model=AccountSchema)
def create_account(account: AccountSchema, db: Session = Depends(get_db)):
    """새로운 계좌를 생성합니다.
    
    Args:
        account (AccountSchema): 생성할 계좌 정보.
        db (Session): 데이터베이스 세션.
        
    Returns:
        AccountSchema: 생성된 계좌 정보.
    """
    data = account.model_dump(exclude={"id", "user_name"})
    db_account = Account(**data)
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    return db_account


@router.put("/accounts/{account_id}", response_model=AccountSchema)
def update_account(account_id: int, account: AccountSchema, db: Session = Depends(get_db)):
    """기존 계좌 정보를 수정합니다.
    
    Args:
        account_id (int): 수정할 계좌 식별자.
        account (AccountSchema): 수정할 계좌 정보.
        db (Session): 데이터베이스 세션.
        
    Returns:
        AccountSchema: 수정된 계좌 정보.
        
    Raises:
        HTTPException: 계좌가 존재하지 않는 경우 404.
    """
    db_account = db.query(Account).filter(Account.id == account_id).first()
    if not db_account:
        raise HTTPException(status_code=404, detail="계좌를 찾을 수 없습니다.")
    data = account.model_dump(exclude={"id", "user_name"})
    for key, value in data.items():
        setattr(db_account, key, value)
    db.commit()
    db.refresh(db_account)
    return db_account


@router.delete("/accounts/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db)):
    """계좌를 삭제합니다.
    
    Args:
        account_id (int): 삭제할 계좌 식별자.
        db (Session): 데이터베이스 세션.
        
    Returns:
        dict: 삭제 완료 메시지.
        
    Raises:
        HTTPException: 계좌가 존재하지 않는 경우 404.
    """
    db_account = db.query(Account).filter(Account.id == account_id).first()
    if not db_account:
        raise HTTPException(status_code=404, detail="계좌를 찾을 수 없습니다.")
    db.delete(db_account)
    db.commit()
    return {"message": "삭제되었습니다."}
