import pandas as pd
import datetime
import re
from sqlalchemy.orm import Session
from src.backend.models import Account, Asset, Transaction
from src.backend.database import SessionLocal

class HoldingService:
    """CSV 자산 보유량 데이터를 DB에 반영하는 클래스입니다."""

    def __init__(self, db: Session):
        self.db = db

    def update_from_csv(self, csv_path: str, update_date: datetime.date = None):
        """CSV 파일을 읽어 보유량 데이터를 INITIAL_BALANCE 트랜잭션으로 생성합니다."""
        if update_date is None:
            update_date = datetime.date.today()

        print(f"[{update_date}] 자산 보유량 업데이트 시작: {csv_path}")
        
        # 1. CSV 로드 (종목코드는 문자열로 강제)
        try:
            df = pd.read_csv(csv_path, encoding='utf-8-sig', dtype={'ticker': str, 'account_name': str})
        except Exception as e:
            print(f"CSV 로드 실패 (utf-8-sig 시도 중): {e}")
            df = pd.read_csv(csv_path, encoding='cp949', dtype={'ticker': str, 'account_name': str})

        # 2. 자산 정보 조회를 위한 Migrator 인스턴스 (API 로직 재사용)
        from src.backend.migration import LegacyDataMigrator
        migrator = LegacyDataMigrator()

        # 3. 데이터 처리
        success_count = 0
        error_count = 0

        for idx, row in df.iterrows():
            acc_num = str(row['account_name']).strip()
            ticker = str(row['ticker']).strip()
            
            # 티커 정규화 (6자리 숫자 앞자리 0 보전)
            if re.match(r"^\d{1,6}$", ticker):
                ticker = ticker.zfill(6)

            quantity = float(row['quantity'])
            avg_price = float(row['avg_price'])
            
            # 계좌 찾기
            account = self.db.query(Account).filter(Account.name == acc_num).first()
            if not account:
                print(f"경고: 계좌를 찾을 수 없습니다 - {acc_num} (행 {idx+2})")
                error_count += 1
                continue
            
            # 자산 찾기 및 자동 등록
            asset = self.db.query(Asset).filter(Asset.ticker == ticker).first()
            if not asset:
                print(f"새로운 자산 발견: {ticker}. 정보 조회 중...")
                try:
                    official_name = migrator.fetch_official_name(ticker)
                    country = "KR"
                    if ticker == "USD" or not re.match(r"^\d{6}$", ticker):
                        if ticker != "KRW":
                            country = "US"
                    
                    asset = Asset(
                        ticker=ticker,
                        name=official_name,
                        major_category="일반주식" if country == "US" or re.match(r"^\d{6}$", ticker) else "현금",
                        sub_category="해외주식" if country == "US" else ("국내주식" if ticker != "KRW" else "원화예수금"),
                        country=country
                    )
                    self.db.add(asset)
                    self.db.commit()
                    self.db.refresh(asset)
                except Exception as e:
                    print(f"경고: 자산 정보를 가져오지 못했습니다 - {ticker} ({e})")
                    error_count += 1
                    continue
            
            # 통화 결정
            currency = "USD" if asset.country == "US" or ticker == "USD" else "KRW"

            # 기존의 모든 INITIAL_BALANCE 삭제 (새로운 baseline으로 대체)
            self.db.query(Transaction).filter(
                Transaction.account_id == account.id,
                Transaction.asset_id == asset.id,
                Transaction.type == "INITIAL_BALANCE"
            ).delete()

            # 신규 트랜잭션 생성
            tx = Transaction(
                account_id=account.id,
                asset_id=asset.id,
                transaction_date=update_date,
                type="INITIAL_BALANCE",
                quantity=quantity,
                price=avg_price,
                total_amount=quantity * avg_price,
                currency=currency
            )
            self.db.add(tx)
            success_count += 1

        self.db.commit()
        print(f"업데이트 완료: 성공 {success_count}건, 실패 {error_count}건")
        return success_count, error_count

if __name__ == "__main__":
    # 간단한 테스트 코드 (추후 scripts/update_holdings.py에서 호출)
    pass
