import datetime
from sqlalchemy.orm import Session
from .database import engine
from .models import HistoricalPrice

def run_migration():
    """historical_prices 테이블의 오염된 데이터를 정제하는 마이그레이션 함수입니다.
    
    1. close_price가 0.0인 레코드 삭제
    2. 오늘보다 미래 날짜의 레코드 삭제
    """
    print("마이그레이션 시작: historical_prices 데이터 정제")
    today = datetime.date.today()
    with Session(bind=engine) as session:
        try:
            # 1. close_price == 0.0 인 데이터 삭제
            deleted_zero = session.query(HistoricalPrice).filter(HistoricalPrice.close_price == 0.0).delete(synchronize_session=False)
            
            # 2. price_date > today 인 데이터 삭제
            deleted_future = session.query(HistoricalPrice).filter(HistoricalPrice.price_date > today).delete(synchronize_session=False)
            
            session.commit()
            print(f"마이그레이션 완료:")
            print(f"  - close_price가 0.0인 데이터 {deleted_zero}건 삭제 완료")
            print(f"  - 미래 날짜({today} 이후)의 데이터 {deleted_future}건 삭제 완료")
        except Exception as e:
            session.rollback()
            print(f"마이그레이션 중 오류 발생: {e}")

if __name__ == "__main__":
    run_migration()
