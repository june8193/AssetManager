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
