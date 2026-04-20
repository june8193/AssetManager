import sys
import os
import datetime

# 프로젝트 루트를 path에 추가
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from src.backend.database import SessionLocal, engine, Base
from src.backend.models import User, Account, Asset

def seed_data():
    """초기 기초 데이터를 생성합니다."""
    # 테이블 생성
    print("테이블 생성 중...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # 1. 기본 사용자 생성
        user = db.query(User).filter_by(name="관리자").first()
        if not user:
            print("기본 사용자 생성 중...")
            user = User(name="관리자")
            db.add(user)
            db.commit()
            db.refresh(user)
        
        # 2. 기본 계좌 생성
        if not db.query(Account).filter_by(user_id=user.id).first():
            print("기본 계좌 생성 중...")
            accounts = [
                Account(user_id=user.id, name="KB증권 (일반주식)", type="주식"),
                Account(user_id=user.id, name="미래에셋 (연금저축)", type="연금"),
                Account(user_id=user.id, name="신한은행 (종합예상)", type="현금")
            ]
            db.add_all(accounts)
            db.commit()
        
        # 3. 기본 자산 마스터 생성
        assets_to_seed = [
            {"ticker": "KRW", "name": "원화예수금", "category": "현금"},
            {"ticker": "USD", "name": "달러예수금", "category": "현금"},
            {"ticker": "005930", "name": "삼성전자", "category": "주식"},
            {"ticker": "000660", "name": "SK하이닉스", "category": "주식"},
            {"ticker": "AAPL", "name": "애플", "category": "주식"},
            {"ticker": "TSLA", "name": "테슬라", "category": "주식"},
            {"ticker": "NVDA", "name": "엔비디아", "category": "주식"}
        ]
        
        for asset_data in assets_to_seed:
            if not db.query(Asset).filter_by(ticker=asset_data["ticker"]).first():
                print(f"자산 {asset_data['name']} ({asset_data['ticker']}) 생성 중...")
                asset = Asset(**asset_data)
                db.add(asset)
        
        db.commit()
        print("초기 데이터 생성 완료!")

    except Exception as e:
        print(f"오류 발생: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
