from sqlalchemy import Column, Integer, String
from .database import Base

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
