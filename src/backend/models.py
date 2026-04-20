from sqlalchemy import Column, Integer, String, DateTime
from .database import Base
import datetime

class Watchlist(Base):
    """관심종목 정보를 저장하는 모델입니다.
    
    Attributes:
        id (int): 고유 식별자 (PK)
        stock_code (str): 종목코드 (예: '005930') (Unique)
        stock_name (str): 종목명 (예: '삼성전자')
    """
    __tablename__ = "watchlist"

    id = Column(Integer, primary_key=True, index=True)
    stock_code = Column(String, unique=True, index=True, nullable=False)
    stock_name = Column(String, nullable=False)
    country = Column(String, default="KR", nullable=False) # 'KR' (국내), 'US' (미국)

class Stock(Base):
    """주식 종목 정보를 저장하는 모델입니다.
    
    Attributes:
        stock_code (str): 종목코드 (PK) (예: '005930')
        stock_name (str): 종목명 (예: '삼성전자')
        market (str): 시장 구분 (예: 'KOSPI', 'KOSDAQ')
    """
    __tablename__ = "stocks"

    stock_code = Column(String, primary_key=True, index=True)
    stock_name = Column(String, index=True, nullable=False)
    market = Column(String, nullable=False)

class SyncHistory(Base):
    """주식 종목 동기화 이력을 저장하는 모델입니다.
    
    Attributes:
        id (int): 고유 식별자 (PK)
        last_sync_at (datetime): 마지막 동기화 완료 일시
    """
    __tablename__ = "sync_history"

    id = Column(Integer, primary_key=True, index=True)
    last_sync_at = Column(DateTime, default=datetime.datetime.now)

# --- 원장 기반 자산 관리 신규 모델 (Phase 1) ---

from sqlalchemy import ForeignKey, Float, Date, Enum
from sqlalchemy.orm import relationship

class User(Base):
    """자산의 실제 소유자 정보를 저장하는 모델입니다.
    
    Attributes:
        id (int): 고유 식별자 (PK)
        name (str): 사용자 이름
        created_at (datetime): 생성 일시
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.now)

    accounts = relationship("Account", back_populates="user")

class Account(Base):
    """증권사, 은행, 연금 등의 개별 계좌 정보를 저장하는 모델입니다.
    
    Attributes:
        id (int): 고유 식별자 (PK)
        user_id (int): 사용자 식별자 (FK)
        name (str): 계좌 이름 (예: '5526-9093')
        provider (str): 금융 기관 (예: 'KB증권', '신한은행')
        alias (str): 계좌 별칭 (예: '(일반 주식)')
        created_at (datetime): 생성 일시
    """
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    provider = Column(String, nullable=False)
    alias = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.now)

    user = relationship("User", back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account")
    snapshots = relationship("AccountSnapshot", back_populates="account")

class Asset(Base):
    """거래 대상 종목, 통화, 상품 정보를 저장하는 마스터 모델입니다.
    
    Attributes:
        id (int): 고유 식별자 (PK)
        ticker (str): 티커 또는 심볼 (예: 'AAPL', 'KRW', '005930')
        name (str): 자산 이름 (예: '애플', '원화예수금', '삼성전자')
        category (str): 자산 카테고리 (주식, 채권, 현금 등)
    """
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    major_category = Column(String, nullable=False) # 대분류 (예: 일반주식, 배당주, 현금)
    sub_category = Column(String, nullable=False)   # 중분류 (예: 해외주식, 국내주식, 원화예수금)
    country = Column(String, nullable=False, default="KR") # 국가 (KR, US 등)

    transactions = relationship("Transaction", back_populates="asset")

class Transaction(Base):
    """거래 원장 데이터를 기록하는 핵심 모델입니다.
    
    Attributes:
        id (int): 고유 식별자 (PK)
        account_id (int): 계좌 식별자 (FK)
        asset_id (int): 자산 식별자 (FK)
        transaction_date (date): 거래 일자
        type (str): 거래 유형 (DEPOSIT, WITHDRAW, BUY, SELL, DIVIDEND, INTEREST)
        quantity (float): 수량
        price (float): 거래 단가
        total_amount (float): 총 거래 금액 (quantity * price)
        currency (str): 통화 (KRW, USD 등)
        exchange_rate (float): 거래 당시 적용 환율
    """
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    transaction_date = Column(Date, nullable=False)
    type = Column(String, nullable=False)  # DEPOSIT, WITHDRAW, BUY, SELL, DIVIDEND, INTEREST
    quantity = Column(Float, default=0.0)
    price = Column(Float, default=0.0)
    total_amount = Column(Float, nullable=False)
    currency = Column(String, nullable=False)
    exchange_rate = Column(Float, nullable=True)

    account = relationship("Account", back_populates="transactions")
    asset = relationship("Asset", back_populates="transactions")

class AccountSnapshot(Base):
    """주기적으로 계산된 계좌의 상태를 캐싱하는 모델입니다.
    
    Attributes:
        id (int): 고유 식별자 (PK)
        account_id (int): 계좌 식별자 (FK)
        snapshot_date (date): 기준 일자
        total_deposit (float): 누적 투자 원금
        total_valuation (float): 현재 총 평가액
        total_profit (float): 총 수익
    """
    __tablename__ = "account_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    snapshot_date = Column(Date, nullable=False)
    total_deposit = Column(Float, default=0.0)
    total_valuation = Column(Float, default=0.0)
    total_profit = Column(Float, default=0.0)

    account = relationship("Account", back_populates="snapshots")
