from sqlalchemy import Column, Integer, String, DateTime, Boolean, func, ForeignKey, Float, Date, Enum, UniqueConstraint, event
from sqlalchemy.orm import relationship
from .database import Base
import datetime

class TargetRatio(Base):
    """자산 배분 목표 비중을 저장하는 모델입니다.
    
    Attributes:
        id (int): 고유 식별자 (PK)
        category_name (str): 카테고리 명 (예: '주식', '국내주식')
        category_type (str): 카테고리 구분 ('major', 'sub')
        target_percentage (float): 목표 비중 (%)
        parent_category (str): 상위 카테고리 명 (중분류인 경우 대분류 명)
        updated_at (datetime): 수정 일시
    """
    __tablename__ = "target_ratios"

    id = Column(Integer, primary_key=True, index=True)
    category_name = Column(String, index=True, nullable=False)
    category_type = Column(String, nullable=False) # 'major', 'sub'
    target_percentage = Column(Float, default=0.0)
    parent_category = Column(String, nullable=True)
    mode = Column(String, nullable=True) # 'absolute', 'relative'
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

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
        account_type (str): 계좌 종류 (BROKERAGE, BANK)
        created_at (datetime): 생성 일시
        is_active (bool): 계좌 활성화 여부
    """
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    provider = Column(String, nullable=False)
    alias = Column(String, nullable=True)
    account_type = Column(String, default="BROKERAGE", nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.now)
    is_active = Column(Boolean, default=True, nullable=False)

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

# 자산 대분류 및 중분류 유효성 검증 규칙 정의
VALID_CATEGORIES = {
    "현금": ["원화예수금", "달러예수금"],
    "일반주식": ["국내주식", "해외주식"],
    "채권": ["미국장기채", "美國단기채", "한국장기채", "한국단기채", "미국단기채"], # 한자 오타 수정: 美國단기채 대신 미국단기채
    "배당주": ["국내배당주", "해외배당주"]
}

# 한자 오타 제거하여 깔끔히 정리
VALID_CATEGORIES["채권"] = ["미국장기채", "미국단기채", "한국장기채", "한국단기채"]

@event.listens_for(Asset, 'before_insert')
@event.listens_for(Asset, 'before_update')
def validate_asset_categories(mapper, connection, target):
    """자산의 대분류와 중분류가 유효한 조합인지 검증합니다.
    
    Args:
        mapper: SQLAlchemy mapper 객체.
        connection: DB 커넥션 객체.
        target (Asset): 검증 대상이 되는 자산 인스턴스.
        
    Raises:
        ValueError: 대분류 또는 중분류가 유효하지 않은 경우.
    """
    major = target.major_category
    sub = target.sub_category
    
    if major not in VALID_CATEGORIES:
        raise ValueError(f"유효하지 않은 대분류입니다: '{major}'. 허용 범위: {list(VALID_CATEGORIES.keys())}")
        
    valid_subs = VALID_CATEGORIES[major]
    if sub not in valid_subs:
        raise ValueError(f"유효하지 않은 중분류입니다: '{sub}'. 대분류 '{major}'에 허용된 중분류: {valid_subs}")

class Transaction(Base):
    """거래 원장 데이터를 기록하는 핵심 모델입니다.
    
    Attributes:
        id (int): 고유 식별자 (PK)
        account_id (int): 계좌 식별자 (FK)
        asset_id (int): 자산 식별자 (FK)
        transaction_date (date): 거래 일자
        type (str): 거래 유형 (INITIAL_BALANCE, DEPOSIT, WITHDRAW, BUY, SELL, INTEREST, TAX, CASH_ADJUSTMENT)
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
    type = Column(String, nullable=False)  # INITIAL_BALANCE, DEPOSIT, WITHDRAW, BUY, SELL, INTEREST, TAX, CASH_ADJUSTMENT
    quantity = Column(Float, default=0.0)
    price = Column(Float, default=0.0)
    total_amount = Column(Float, nullable=False)
    currency = Column(String, nullable=False)
    exchange_rate = Column(Float, nullable=True)
    memo = Column(String, nullable=True)

    account = relationship("Account", back_populates="transactions")
    asset = relationship("Asset", back_populates="transactions")

    @property
    def asset_name(self):
        """거래 대상 자산의 이름을 반환합니다."""
        return self.asset.name if self.asset else None

    @property
    def asset_ticker(self):
        """거래 대상 자산의 티커(심볼)를 반환합니다."""
        return self.asset.ticker if self.asset else None

class AccountSnapshot(Base):
    """주기적으로 계산된 계좌의 상태를 캐싱하는 모델입니다.
    
    Attributes:
        id (int): 고유 식별자 (PK)
        account_id (int): 계좌 식별자 (FK)
        snapshot_date (date): 기준 일자
        period_deposit (float): 해당 기간 추가 입금액
        total_valuation (float): 현재 총 평가액
        total_profit (float): 총 수익
    """
    __tablename__ = "account_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    snapshot_date = Column(Date, nullable=False)
    period_deposit = Column(Float, default=0.0) # 해당 기간 추가 입금액 (또는 자본 변동)
    total_valuation = Column(Float, default=0.0)
    total_profit = Column(Float, default=0.0)

    account = relationship("Account", back_populates="snapshots")

class ExchangeRate(Base):
    """특정 날짜의 환율 정보를 저장하는 모델입니다.
    
    Attributes:
        id (int): 고유 식별자 (PK)
        date (date): 환율 기준 일자 (Unique)
        currency (str): 통화 (기본값 'USD')
        rate (float): 환율
        created_at (datetime): 생성 일시
    """
    __tablename__ = "exchange_rates"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, unique=True, index=True, nullable=False)
    currency = Column(String, default="USD", nullable=False)
    rate = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.now)


class HistoricalPrice(Base):
    """주요 지수 및 관심 종목의 일별 역사적 종가 정보를 캐싱하는 모델입니다."""
    __tablename__ = "historical_prices"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, index=True, nullable=False)
    price_date = Column(Date, index=True, nullable=False)
    close_price = Column(Float, nullable=False)

    # 동일한 티커의 동일 날짜 데이터는 유일해야 합니다.
    __table_args__ = (
        UniqueConstraint('ticker', 'price_date', name='_ticker_date_uc'),
    )


class SectorETF(Base):
    """섹터별 대표 ETF 정보를 저장하는 모델입니다."""
    __tablename__ = "sector_etfs"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    country = Column(String, nullable=False, default="KR")  # 'KR' 또는 'US'


class CustomSector(Base):
    """사용자가 직접 구성하는 커스텀 섹터 마스터 모델입니다."""
    __tablename__ = "custom_sectors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    country = Column(String, nullable=False, default="KR")  # 'KR' 또는 'US'
    created_at = Column(DateTime, default=datetime.datetime.now)

    stocks = relationship("CustomSectorStock", back_populates="sector", cascade="all, delete-orphan")


class CustomSectorStock(Base):
    """커스텀 섹터에 포함된 종목 정보를 저장하는 모델입니다."""
    __tablename__ = "custom_sector_stocks"

    id = Column(Integer, primary_key=True, index=True)
    sector_id = Column(Integer, ForeignKey("custom_sectors.id", ondelete="CASCADE"), nullable=False)
    stock_code = Column(String, index=True, nullable=False)  # '005930' 혹은 'NVDA' 등
    stock_name = Column(String, nullable=False)
    shares_outstanding = Column(Float, default=0.0)  # 발행주식수 (시총가중 계산용)

    sector = relationship("CustomSector", back_populates="stocks")

    __table_args__ = (
        UniqueConstraint('sector_id', 'stock_code', name='_sector_stock_uc'),
    )
