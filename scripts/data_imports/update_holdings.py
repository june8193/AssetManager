"""보유 자산 업데이트 스크립트.

CSV 파일로부터 보유 자산 데이터를 읽어 데이터베이스에 반영합니다.
기존 INITIAL_BALANCE 트랜잭션을 삭제하고 최신 데이터로 교체합니다.
"""
import datetime

from src.backend.database import SessionLocal
from src.backend.models import Transaction
from src.backend.scripts.holding_service import HoldingService


def main():
    """보유 자산 데이터를 CSV에서 읽어 DB에 반영하는 메인 함수.

    1. 기존 INITIAL_BALANCE 트랜잭션 전체 삭제
    2. CSV 파일로부터 최신 보유 자산 데이터 반영
    """
    db = SessionLocal()
    try:
        # 기존 INITIAL_BALANCE 트랜잭션 전체 삭제 (초기화)
        print("기존 초기 잔고(INITIAL_BALANCE) 트랜잭션 삭제 중...")
        deleted_count = db.query(Transaction).filter(
            Transaction.type == "INITIAL_BALANCE"
        ).delete()
        db.commit()
        print(f"삭제 완료: {deleted_count}건")

        # HoldingService를 통한 최신 데이터 반영
        service = HoldingService(db)
        csv_path = "work/old_data/데이터 이관 - 시트3.csv"
        update_date = datetime.date.today()

        success, error = service.update_from_csv(csv_path, update_date=update_date)

        print("데이터 반영 완료!")
        print(f"성공: {success}건")
        print(f"실패: {error}건")

    except Exception as e:
        print(f"오류 발생: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    main()
