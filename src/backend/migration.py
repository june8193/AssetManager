import pandas as pd
import re
import os
import yfinance as yf
from sqlalchemy.orm import Session
from src.backend.database import SessionLocal, engine, Base
from src.backend.models import User, Account, Asset, Transaction, AccountSnapshot
from src.kiwoom.api import KiwoomAPI
import datetime

class LegacyDataMigrator:
    """구형 구글 시트 데이터를 DB로 이관하는 클래스입니다."""

    # 사용자가 직접 정제한 계좌 데이터 리스트
    FIXED_ACCOUNTS = [
        {"id": 1, "user_id": 1, "name": "Legacy_Total_Account", "provider": "시스템", "alias": "과거 데이터 이관용 가상계좌"},
        {"id": 2, "user_id": 1, "name": "5526-9093", "provider": "키움증권", "alias": "(일반 주식)"},
        {"id": 3, "user_id": 1, "name": "6066-7729", "provider": "키움증권", "alias": "(배당주)"},
        {"id": 4, "user_id": 1, "name": "880-8864-2912-0", "provider": "미래에셋증권", "alias": "(장준, 연금저축)"},
        {"id": 5, "user_id": 1, "name": "014-7558-3984-0", "provider": "미래에셋증권", "alias": "(장준, IRP)"},
        {"id": 6, "user_id": 1, "name": "6106-8763", "provider": "키움증권", "alias": "(달러 지갑)"},
        {"id": 7, "user_id": 2, "name": "735-5844-5652-0", "provider": "미래에셋증권", "alias": "(성은, 주식)"},
        {"id": 8, "user_id": 2, "name": "848-8120-0360-0", "provider": "미래에셋증권", "alias": "(성은, IRP)"},
        {"id": 9, "user_id": 2, "name": "264-4808-7048-0", "provider": "미래에셋증권", "alias": "(성은, 연금저축)"},
        {"id": 10, "user_id": 1, "name": "현금 통장", "provider": "기타", "alias": "(준 주택청약 + 준 카뱅 현금 + 성은 주택청약)"},
        {"id": 11, "user_id": 1, "name": "업비트, 케이뱅크", "provider": "기타", "alias": "장준, 업비트/케이뱅크"},
        {"id": 12, "user_id": 1, "name": "223-070-796423", "provider": "신한은행", "alias": "(신한 주택청약, 준)"},
        {"id": 13, "user_id": 1, "name": "3333-19-6950366", "provider": "카카오뱅크", "alias": "(카카오뱅크 현금자산, 준)"},
        {"id": 14, "user_id": 2, "name": "223-105-564395", "provider": "신한은행", "alias": "(신한 주택청약, 성은)"},
        {"id": 15, "user_id": 2, "name": "738-5844-5652-0", "provider": "미래에셋증권", "alias": "(성은, 주식)"}
    ]

    def __init__(self):
        self.db = None
        self.kiwoom = KiwoomAPI()
        self._kiwoom_token = None
        self.asset_map = {} # (category, sub_category, alias) -> (ticker, name)

    def get_kiwoom_token(self):
        """키움 API 호출용 토큰을 가져옵니다."""
        if self._kiwoom_token:
            return self._kiwoom_token
        
        accounts = self.kiwoom.secrets.get("accounts", [])
        if not accounts:
            raise RuntimeError("키움 API 계정 정보가 secrets.json에 없습니다.")
        
        acc = accounts[0] # 첫 번째 계정 사용
        token = self.kiwoom.get_access_token(acc["app_key"], acc["secret_key"])
        if not token:
            raise RuntimeError("키움 API 토큰 발급에 실패했습니다.")
        
        self._kiwoom_token = token
        return token

    def fetch_official_name(self, ticker):
        """티커/종목 코드로 공식 종목명을 조회합니다. 실패 시 RuntimeError를 발생시킵니다."""
        # 1. 현금성 자산
        if ticker in ["KRW", "USD"]:
            return "원화예수금" if ticker == "KRW" else "달러예수금"

        # 2. 국내 주식 (6자리 숫자)
        if re.match(r"^\d{6}$", ticker):
            token = self.get_kiwoom_token()
            res = self.kiwoom.get_stock_info(token, ticker)
            if res and res.get("return_code") == 0:
                # 키움 API 응답 구조: 'stk_nm' 필드 확인
                name = res.get("stk_nm") or res.get("nm") or res.get("name") or res.get("hname")
                if name:
                    return name
            raise RuntimeError(f"국내 종목 정보 조회 실패: {ticker} (응답: {res})")

        # 3. 미국 주식 (영문자)
        else:
            try:
                stock = yf.Ticker(ticker)
                name = stock.info.get("longName") or stock.info.get("shortName")
                if name:
                    return name
            except Exception as e:
                print(f"yfinance 조회 에러: {e}")
            
            raise RuntimeError(f"미국 종목 정보 조회 실패: {ticker}")

    def load_asset_mapping(self, csv_path):
        """'데이터 이관 - 시트2.csv'를 읽어 자산 매핑 정보를 구축합니다."""
        df = None
        for enc in ['utf-8-sig', 'utf-8', 'cp949']:
            try:
                df = pd.read_csv(csv_path, encoding=enc)
                break
            except:
                continue
        
        if df is None:
            raise ValueError(f"Could not load {csv_path}")

        mapping = {}
        
        # 컬럼명: 대분류, 중분류, 별칭, 식별자(티커 or 종목번호)
        for _, row in df.iterrows():
            cat = str(row['대분류']).strip()
            sub_cat = str(row['중분류']).strip()
            alias = str(row['별칭']).strip()
            ticker = str(row['식별자(티커 or 종목번호)']).strip()
            
            # 티커가 비어있으면 현금으로 간주
            if not ticker or ticker == "nan":
                if "원화" in sub_cat or "원화" in alias:
                    ticker = "KRW"
                elif "달러" in sub_cat or "달러" in alias:
                    ticker = "USD"
                else:
                    print(f"경고: 티커가 없고 통화 식별이 불가능한 항목 스킵 - {alias}")
                    continue

            # 중복 조회를 피하기 위한 매핑 저장
            key = (cat, sub_cat, alias)
            if key not in mapping:
                print(f"분석 중: {alias} ({ticker})...")
                official_name = self.fetch_official_name(ticker)
                
                # 국가 자동 감지 로직
                country = "KR"
                if ticker == "USD" or not re.match(r"^\d{6}$", ticker):
                    if ticker != "KRW":
                        country = "US"

                mapping[key] = {
                    "ticker": ticker,
                    "name": official_name,
                    "major_category": cat,
                    "sub_category": sub_cat,
                    "country": country
                }
        
        self.mapping = mapping
        return mapping

    def get_asset_id(self, cat, sub_cat, alias):
        """카테고리와 별칭으로 asset_id를 가져오거나 생성합니다."""
        key = (cat, sub_cat, alias)
        if key not in self.mapping:
            # 매핑에 없는 자산이 나오면 에러 (사용자 요청 사항: 실패 시 에러 알림)
            raise RuntimeError(f"매핑 테이블에서 자산을 찾을 수 없습니다: {key}")
        
        asset_info = self.mapping[key]
        ticker = asset_info["ticker"]
        
        # DB에서 검색
        asset = self.db.query(Asset).filter_by(ticker=ticker).first()
        if not asset:
            asset = Asset(
                ticker=ticker,
                name=asset_info["name"],
                major_category=asset_info["major_category"],
                sub_category=asset_info["sub_category"],
                country=asset_info["country"]
            )
            self.db.add(asset)
            self.db.commit()
            self.db.refresh(asset)
        
        return asset.id

    def parse_currency(self, value):
        """통화 문자열을 숫자(float)로 변환합니다."""
        if pd.isna(value) or value is None:
            return 0.0
        if isinstance(value, (int, float)):
            return float(value)
        
        clean_val = re.sub(r'[₩\$,\s]', '', str(value))
        if not clean_val or clean_val == "nan":
            return 0.0
        
        return float(clean_val)

    def load_csv(self, file_path):
        """CSV 파일을 로드하고 컬럼 이름을 정규화합니다."""
        df = None
        for enc in ['utf-8-sig', 'utf-8', 'cp949']:
            try:
                df = pd.read_csv(file_path, header=[0, 1], encoding=enc)
                break
            except:
                continue
        
        if df is None:
            raise ValueError(f"Could not load {file_path}")

        new_columns = []
        for c1, c2 in df.columns:
            new_columns.append((str(c1).strip(), str(c2).strip()))
        df.columns = pd.MultiIndex.from_tuples(new_columns)
        return df

    def extract_legacy_history(self, df):
        """2024년 10월 이전 통합 데이터를 추출합니다."""
        history = []
        for idx, row in df.iterrows():
            date_str = row.iloc[0]
            if pd.isna(date_str) or str(date_str).strip() == "":
                continue
            
            history.append({
                'date': str(date_str).strip(),
                'total_valuation': self.parse_currency(row.iloc[1]),
                'additional_amount': self.parse_currency(row.iloc[2]),
                'total_profit': self.parse_currency(row.iloc[3])
            })
        return history

    def extract_account_history(self, df):
        """2024년 12월 이후 계좌별 상세 데이터를 추출합니다."""
        history = []
        for idx, row in df.iterrows():
            date_str = row.iloc[0]
            if pd.isna(date_str) or str(date_str).strip() == "":
                continue

            for i in range(4, len(row), 3):
                acc_name = df.columns[i][0]
                if acc_name.startswith('Unnamed') or acc_name in ['날짜', '총 자산']:
                    continue
                
                total_val = self.parse_currency(row.iloc[i])
                add_val = self.parse_currency(row.iloc[i+1])
                profit_val = self.parse_currency(row.iloc[i+2])
                
                if total_val != 0 or add_val != 0:
                    history.append({
                        'date': str(date_str).strip(),
                        'account_name': acc_name,
                        'total_valuation': total_val,
                        'additional_amount': add_val,
                        'total_profit': profit_val
                    })
        return history

    def parse_date(self, date_str):
        """날짜 문자열을 date 객체로 변환합니다."""
        try:
            clean_date = date_str.replace(' ', '').replace('.', '-')
            if clean_date.endswith('-'):
                clean_date = clean_date[:-1]
            parts = clean_date.split('-')
            return datetime.date(int(parts[0]), int(parts[1]), int(parts[2]))
        except:
            return None

    def migrate(self):
        """전체 마이그레이션 프로세스를 수행합니다."""
        print("마이그레이션 시작...")
        
        # 1. 자산 매핑 로드 (API 조회 포함)
        print("자산 매핑 정보 구축 중 (API 조회 포함)...")
        self.load_asset_mapping("work/old_data/데이터 이관 - 시트2.csv")
        
        # DB 초기화
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        
        self.db = SessionLocal()
        try:
            # 2. 사용자 생성
            user_jun = User(name="장준")
            user_sung = User(name="홍성은")
            self.db.add_all([user_jun, user_sung])
            self.db.commit()
            
            # 3. 고정 계좌 데이터 생성
            print("고정 계좌 데이터 생성 중...")
            legacy_acc = None
            for acc_data in self.FIXED_ACCOUNTS:
                acc = Account(
                    id=acc_data["id"],
                    user_id=acc_data["user_id"],
                    name=acc_data["name"],
                    provider=acc_data["provider"],
                    alias=acc_data["alias"]
                )
                self.db.add(acc)
                if acc_data["id"] == 1:
                    legacy_acc = acc
            self.db.commit()
            
            # 4. CSV 로드 및 이관
            df_history = self.load_csv("work/old_data/자산 관리 - 계좌별 내역.csv")
            
            # 2024년 10월 이전 데이터 (Legacy Account용)
            legacy_history = self.extract_legacy_history(df_history)
            krw_asset_id = self.get_asset_id("현금", "원화예수금", "원화 예수금")
            
            for item in legacy_history:
                dt = self.parse_date(item['date'])
                if not dt: continue
                
                if dt < datetime.date(2024, 11, 1):
                    if item['additional_amount'] != 0:
                        t_type = "DEPOSIT" if item['additional_amount'] > 0 else "WITHDRAW"
                        tx = Transaction(
                            account_id=legacy_acc.id,
                            asset_id=krw_asset_id,
                            transaction_date=dt,
                            type=t_type,
                            total_amount=abs(item['additional_amount']),
                            currency="KRW"
                        )
                        self.db.add(tx)
                    
                    snp = AccountSnapshot(
                        account_id=legacy_acc.id,
                        snapshot_date=dt,
                        total_valuation=item['total_valuation'],
                        total_profit=item['total_profit']
                    )
                    self.db.add(snp)
            
            # 2024년 12월 이후 계좌별 데이터
            name_to_id_map = {f"{a['name']} {a['alias']}" if a['alias'] else a['name']: a['id'] for a in self.FIXED_ACCOUNTS}
            # 특수 매핑
            name_to_id_map["현금 통장 (준 주택청약 + 준 카뱅 현금 + 성은 주택청약)"] = 10
            name_to_id_map["업비트, 케이뱅크 (장준)"] = 11

            specific_history = self.extract_account_history(df_history)
            for item in specific_history:
                dt = self.parse_date(item['date'])
                if not dt: continue
                
                acc_full_name = item['account_name']
                acc_id = name_to_id_map.get(acc_full_name)
                if not acc_id:
                    for k, v in name_to_id_map.items():
                        if acc_full_name in k or k in acc_full_name:
                            acc_id = v
                            break
                
                if not acc_id:
                    print(f"경고: 계좌 매핑 실패 - {acc_full_name}")
                    continue
                
                if item['additional_amount'] != 0:
                    t_type = "DEPOSIT" if item['additional_amount'] > 0 else "WITHDRAW"
                    tx = Transaction(
                        account_id=acc_id,
                        asset_id=krw_asset_id,
                        transaction_date=dt,
                        type=t_type,
                        total_amount=abs(item['additional_amount']),
                        currency="KRW"
                    )
                    self.db.add(tx)
                
                snp = AccountSnapshot(
                    account_id=acc_id,
                    snapshot_date=dt,
                    total_valuation=item['total_valuation'],
                    total_profit=item['total_profit']
                )
                self.db.add(snp)
            
            self.db.commit()
            
            # 5. 최종 잔고 동기화 (INITIAL_BALANCE)
            self.sync_initial_balances()
            
            print("마이그레이션 완료!")
            
        except Exception as e:
            print(f"마이그레이션 중 오류 발생: {e}")
            self.db.rollback()
            raise e
        finally:
            self.db.close()

    def sync_initial_balances(self):
        """시트2 데이터를 기반으로 INITIAL_BALANCE 트랜잭션을 생성합니다."""
        df_status = pd.read_csv("work/old_data/데이터 이관 - 시트2.csv")
        sync_date = datetime.date(2026, 4, 19)
        
        # 계좌 매핑 정보 (이름 기반)
        name_to_id_map = {f"{a['name']} {a['alias']}" if a['alias'] else a['name']: a['id'] for a in self.FIXED_ACCOUNTS}
        # 시트2의 '계좌 이름' 컬럼과 FIXED_ACCOUNTS 매칭
        
        for _, row in df_status.iterrows():
            acc_full_name = row['계좌 이름']
            qty = float(row['보유수량'])
            
            # 계좌 찾기
            acc_id = name_to_id_map.get(acc_full_name)
            if not acc_id:
                for k, v in name_to_id_map.items():
                    if acc_full_name in k or k in acc_full_name:
                        acc_id = v
                        break
            
            if not acc_id:
                print(f"경고: 초기 잔고 동기화 중 계좌 매핑 실패 - {acc_full_name}")
                continue
            
            # 자산 식별 (매핑 테이블 활용)
            cat = str(row['대분류']).strip()
            sub_cat = str(row['중분류']).strip()
            alias = str(row['별칭']).strip()
            
            asset_id = self.get_asset_id(cat, sub_cat, alias)
            
            # INITIAL_BALANCE 트랜잭션 생성
            tx = Transaction(
                account_id=acc_id,
                asset_id=asset_id,
                transaction_date=sync_date,
                type="INITIAL_BALANCE",
                quantity=qty,
                total_amount=0.0, # 시트2에 금액 정보가 없으므로 0으로 설정 (추후 보완 가능)
                currency="KRW" if "KRW" in self.mapping[(cat, sub_cat, alias)]["ticker"] else "USD"
            )
            self.db.add(tx)
        
        self.db.commit()

if __name__ == "__main__":
    migrator = LegacyDataMigrator()
    migrator.migrate()
