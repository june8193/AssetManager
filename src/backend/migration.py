import pandas as pd
import re
import os
from sqlalchemy.orm import Session
from src.backend.database import SessionLocal, engine, Base
from src.backend.models import User, Account, Asset, Transaction, AccountSnapshot
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

    def parse_currency(self, value):
        """통화 문자열을 숫자(float)로 변환합니다."""
        if pd.isna(value) or value is None:
            return 0.0
        if isinstance(value, (int, float)):
            return float(value)
        
        # ₩, $, 쉼표 제거
        clean_val = re.sub(r'[₩\$,\s]', '', str(value))
        if not clean_val:
            return 0.0
        
        return float(clean_val)

    def load_csv(self, file_path):
        """CSV 파일을 로드하고 컬럼 이름을 정규화합니다."""
        # 인코딩 시도
        df = None
        for enc in ['utf-8-sig', 'utf-8', 'cp949']:
            try:
                df = pd.read_csv(file_path, header=[0, 1], encoding=enc)
                break
            except:
                continue
        
        if df is None:
            raise ValueError(f"Could not load {file_path}")

        # 컬럼 이름 정규화 (공백 제거 및 문자열 변환)
        new_columns = []
        for c1, c2 in df.columns:
            new_columns.append((str(c1).strip(), str(c2).strip()))
        df.columns = pd.MultiIndex.from_tuples(new_columns)
        return df

    def extract_legacy_history(self, df):
        """2024년 10월 이전 통합 데이터를 추출합니다."""
        history = []
        # '총 자산' 섹션이 첫 번째 데이터 섹션임 (날짜 다음)
        # 컬럼 순서에 의존: [0] 날짜, [1] 총액, [2] 추가액, [3] 수익
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
        # 컬럼의 Level 0을 순회하며 개별 계좌 섹션 처리
        # 0: 날짜, 1-3: 총 자산, 4-6: 계좌1, 7-9: 계좌2 ... (3개씩 묶임)
        col_level0 = df.columns.get_level_values(0).unique()
        
        for idx, row in df.iterrows():
            date_str = row.iloc[0]
            if pd.isna(date_str) or str(date_str).strip() == "":
                continue

            # 4번째 컬럼(인덱스 4)부터 3개씩 묶어서 계좌 데이터 추출
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

    def migrate(self):
        """전체 마이그레이션 프로세스를 수행합니다."""
        print("마이그레이션 시작...")
        # DB 초기화
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        
        self.db = SessionLocal()
        try:
            # 1. 사용자 생성
            user_jun = User(name="장준")
            user_sung = User(name="홍성은")
            self.db.add_all([user_jun, user_sung])
            self.db.commit()
            
            # 2. 고정 계좌 데이터 생성
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
            
            # 3. CSV 로드 및 이관
            df_history = self.load_csv("work/old_data/자산 관리 - 계좌별 내역.csv")
            
            # 2024년 10월 이전 데이터 (Legacy Account용)
            legacy_history = self.extract_legacy_history(df_history)
            for item in legacy_history:
                dt = self.parse_date(item['date'])
                if not dt: continue
                
                if dt < datetime.date(2024, 11, 1):
                    # 트랜잭션 기록 및 스냅샷 기록 (기존 로직 유지)
                    if item['additional_amount'] != 0:
                        t_type = "DEPOSIT" if item['additional_amount'] > 0 else "WITHDRAW"
                        tx = Transaction(
                            account_id=legacy_acc.id,
                            asset_id=self.get_krw_asset_id(),
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
            # CSV 계좌명과 고정 계좌 데이터 매핑용 딕셔너리 생성
            # (이름+별칭) 조합으로 매칭
            name_to_id_map = {}
            for acc_data in self.FIXED_ACCOUNTS:
                full_key = acc_data["name"]
                if acc_data["alias"]:
                    full_key += f" {acc_data['alias']}"
                name_to_id_map[full_key] = acc_data["id"]
            
            # 일부 특수 매핑 처리
            name_to_id_map["현금 통장 (준 주택청약 + 준 카뱅 현금 + 성은 주택청약)"] = 10
            name_to_id_map["업비트, 케이뱅크 (장준)"] = 11

            specific_history = self.extract_account_history(df_history)
            for item in specific_history:
                dt = self.parse_date(item['date'])
                if not dt: continue
                
                acc_full_name = item['account_name']
                acc_id = None
                
                # 1. 완전 일치 검색
                if acc_full_name in name_to_id_map:
                    acc_id = name_to_id_map[acc_full_name]
                else:
                    # 2. 부분 일치 검색 (이름이 포함되어 있는지)
                    for full_key, aid in name_to_id_map.items():
                        if acc_full_name in full_key or full_key in acc_full_name:
                            acc_id = aid
                            break
                
                if acc_id is None:
                    print(f"경고: 계좌 매핑 실패 - {acc_full_name}")
                    continue
                
                # 트랜잭션 및 스냅샷 기록
                if item['additional_amount'] != 0:
                    t_type = "DEPOSIT" if item['additional_amount'] > 0 else "WITHDRAW"
                    tx = Transaction(
                        account_id=acc_id,
                        asset_id=self.get_krw_asset_id(),
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
            
            # 4. 최종 잔고 동기화 (INITIAL_BALANCE)
            self.sync_initial_balances()
            
            print("마이그레이션 완료!")
            
        except Exception as e:
            print(f"마이그레이션 중 오류 발생: {e}")
            self.db.rollback()
            raise e
        finally:
            self.db.close()

    def split_name_alias(self, full_name):
        """계좌명에서 이름과 별칭을 분리합니다."""
        match = re.match(r"^(.+?)\s*(\(.*\))$", full_name)
        if match:
            return match.group(1).strip(), match.group(2).strip()
        return full_name, None

    def extract_provider(self, full_name):
        """계좌명에서 금융기관을 추출합니다."""
        providers = ['KB', '신한', '미래에셋', '카카오뱅크', '카뱅', '업비트', '케이뱅크', '삼성', '키움', 'NH', '한국투자']
        for p in providers:
            if p in full_name:
                if p == '카뱅': return '카카오뱅크'
                return p
        
        if "연금" in full_name: return "연금"
        if "IRP" in full_name: return "퇴직연금"
        if "현금" in full_name: return "현금"
        return "기타"

    def parse_date(self, date_str):
        """'2021. 1. 1' 형식의 문자열을 date 객체로 변환합니다."""
        try:
            # 쉼표나 점 제거 후 파싱
            clean_date = date_str.replace(' ', '').replace('.', '-')
            if clean_date.endswith('-'):
                clean_date = clean_date[:-1]
            parts = clean_date.split('-')
            return datetime.date(int(parts[0]), int(parts[1]), int(parts[2]))
        except:
            return None

    _krw_asset_id = None
    def get_krw_asset_id(self):
        if self._krw_asset_id: return self._krw_asset_id
        asset = self.db.query(Asset).filter_by(ticker="KRW").first()
        if not asset:
            asset = Asset(ticker="KRW", name="원화예수금", category="현금")
            self.db.add(asset)
            self.db.commit()
        self._krw_asset_id = asset.id
        return asset.id

    def sync_initial_balances(self):
        """자산현황 (DB).csv를 읽어 INITIAL_BALANCE 트랜잭션을 생성합니다."""
        df_status = pd.read_csv("work/old_data/자산 관리 - 자산현황 (DB).csv")
        sync_date = datetime.date(2026, 4, 19)
        
        # 고정 계좌 맵핑 생성
        name_to_id_map = {}
        for acc_data in self.FIXED_ACCOUNTS:
            full_key = acc_data["name"]
            if acc_data["alias"]:
                full_key += f" {acc_data['alias']}"
            name_to_id_map[full_key] = acc_data["id"]
        
        name_to_id_map["현금 통장 (준 주택청약 + 준 카뱅 현금 + 성은 주택청약)"] = 10
        name_to_id_map["업비트, 케이뱅크 (장준)"] = 11
        # 자산현황 CSV의 '계좌' 컬럼 값들에 대한 추가 맵핑
        name_to_id_map["880-8864-2912-0 (장준, 연금저축)"] = 4
        name_to_id_map["014-7558-3984-0 (장준, IRP)"] = 5
        name_to_id_map["223-070-796423 (신한 주택청약, 준)"] = 12
        name_to_id_map["3333-19-6950366 (카카오뱅크 현금자산, 준)"] = 13
        name_to_id_map["223-105-564395 (신한 주택청약, 성은)"] = 14
        name_to_id_map["848-8120-0360-0 (성은, IRP)"] = 8
        name_to_id_map["264-4808-7048-0 (성은, 연금저축)"] = 9
        name_to_id_map["738-5844-5652-0 (성은, 주식)"] = 15
        name_to_id_map["6106-8763 (달러지갑)"] = 6

        asset_map = {} # ticker -> asset_id
        
        for idx, row in df_status.iterrows():
            acc_full_name = row['계좌']
            ticker = row['종목명']
            qty = float(row['보유수량'])
            val_krw = self.parse_currency(row['평가액[원]'])
            
            # 계좌 찾기
            acc_id = None
            if acc_full_name in name_to_id_map:
                acc_id = name_to_id_map[acc_full_name]
            else:
                for full_key, aid in name_to_id_map.items():
                    if acc_full_name in full_key or full_key in acc_full_name:
                        acc_id = aid
                        break
            
            if acc_id is None:
                print(f"경고: 초기 잔고 동기화 중 계좌 매핑 실패 - {acc_full_name}")
                continue
            
            # 자산 찾기 또는 생성
            if ticker not in asset_map:
                asset = self.db.query(Asset).filter_by(name=ticker).first()
                if not asset:
                    asset = Asset(ticker=ticker, name=ticker, category=row['대분류'])
                    self.db.add(asset)
                    self.db.commit()
                asset_map[ticker] = asset.id
            
            # INITIAL_BALANCE 트랜잭션 생성
            tx = Transaction(
                account_id=acc_id,
                asset_id=asset_map[ticker],
                transaction_date=sync_date,
                type="INITIAL_BALANCE",
                quantity=qty,
                total_amount=val_krw,
                currency="KRW"
            )
            self.db.add(tx)
        
        self.db.commit()

if __name__ == "__main__":
    migrator = LegacyDataMigrator()
    migrator.migrate()
