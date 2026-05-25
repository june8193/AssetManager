from sqlalchemy.orm import Session
from .database import engine
from .models import Transaction

def run_migration():
    """기존 ADJUSTMENT 트랜잭션 타입을 CASH_ADJUSTMENT로 변경하는 마이그레이션 함수입니다.
    
    데이터베이스 내의 모든 Transaction 중 type이 'ADJUSTMENT'인 레코드를
    'CASH_ADJUSTMENT'로 일괄 변경합니다.
    """
    print("마이그레이션 시작: ADJUSTMENT -> CASH_ADJUSTMENT")
    with Session(bind=engine) as session:
        try:
            updated_count = session.query(Transaction).filter(Transaction.type == 'ADJUSTMENT').update(
                {Transaction.type: 'CASH_ADJUSTMENT'},
                synchronize_session=False
            )
            session.commit()
            print(f"마이그레이션 완료: {updated_count}건의 ADJUSTMENT 트랜잭션을 CASH_ADJUSTMENT로 업데이트하였습니다.")
        except Exception as e:
            session.rollback()
            print(f"마이그레이션 중 오류 발생: {e}")

if __name__ == "__main__":
    run_migration()
