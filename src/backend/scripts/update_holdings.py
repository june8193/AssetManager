import sys
import os
import datetime
import argparse

# 프로젝트 루트 디렉토리를 sys.path에 추가 (import src... 가 가능하도록)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../")))

from src.backend.database import SessionLocal
from src.backend.scripts.holding_service import HoldingService

def main():
    parser = argparse.ArgumentParser(description="CSV 파일을 통한 자산 보유량 업데이트 스크립트")
    parser.add_argument("csv_path", help="보유량 csv 파일 경로")
    parser.add_argument("--date", help="업데이트 기준 날짜 (YYYY-MM-DD), 기본값은 오늘", default=None)
    
    args = parser.parse_args()
    
    # 날짜 유효성 검사
    update_date = None
    if args.date:
        try:
            update_date = datetime.datetime.strptime(args.date, "%Y-%m-%d").date()
        except ValueError:
            print("오류: 날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)")
            sys.exit(1)
    else:
        update_date = datetime.date.today()

    if not os.path.exists(args.csv_path):
        print(f"오류: 파일을 찾을 수 없습니다 - {args.csv_path}")
        sys.exit(1)

    db = SessionLocal()
    try:
        service = HoldingService(db)
        success, error = service.update_from_csv(args.csv_path, update_date)
        print(f"\n작업이 완료되었습니다. (성공: {success}, 실패: {error})")
    except Exception as e:
        print(f"오류 발생: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    main()
