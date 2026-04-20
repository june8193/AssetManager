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
                Account(user_id=user.id, name="KB증권 (일반주식)", provider="KB증권", alias="(일반주식)"),
                Account(user_id=user.id, name="미래에셋 (연금저축)", provider="미래에셋증권", alias="(연금저축)"),
                Account(user_id=user.id, name="신한은행 (주택청약)", provider="신한은행", alias="(주택청약)")
            ]
            db.add_all(accounts)
            db.commit()
        
        # 3. 기본 자산 마스터 생성
        assets_to_seed = [
            {"ticker": "KRW", "name": "원화예수금", "major_category": "현금", "sub_category": "원화예수금", "country": "KR"},
            {"ticker": "USD", "name": "달러예수금", "major_category": "현금", "sub_category": "달러예수금", "country": "US"},
            {"ticker": "005930", "name": "삼성전자", "major_category": "일반주식", "sub_category": "국내주식", "country": "KR"},
            {"ticker": "000660", "name": "SK하이닉스", "major_category": "일반주식", "sub_category": "국내주식", "country": "KR"},
            {"ticker": "AAPL", "name": "애플", "major_category": "일반주식", "sub_category": "해외주식", "country": "US"},
            {"ticker": "TSLA", "name": "테슬라", "major_category": "일반주식", "sub_category": "해외주식", "country": "US"},
            {"ticker": "NVDA", "name": "엔비디아", "major_category": "일반주식", "sub_category": "해외주식", "country": "US"}
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
