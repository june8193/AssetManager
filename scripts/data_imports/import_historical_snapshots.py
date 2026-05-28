"""과거 자산 내역(CSV)을 데이터베이스로 이관하는 마이그레이션 스크립트.

이 스크립트는 '자산 관리 - 계좌별 내역.csv' 파일을 읽어 
데이터베이스의 `account_snapshots` 테이블에 과거 데이터를 채웁니다.
"""

import pandas as pd
import sqlite3
from pathlib import Path
import re
from datetime import datetime

# 설정
CSV_PATH = Path("work/old_data/자산 관리 - 계좌별 내역.csv")
DB_PATH = Path("src/assets.db")

# 계좌 매핑 (CSV 컬럼 위치 -> DB account_id)
# 0: 날짜, 1: 총액(ID 1), 2: 추가액, 3: 수익
# 4: 5526-9093(ID 2), 5: 추가액, 6: 수익
# ... 순서대로 3열씩 묶임
ACCOUNT_MAPPING = {
    1: 1,   # Legacy_Total_Account (총 자산)
    4: 2,   # 5526-9093
    7: 3,   # 6066-7729
    10: 4,  # 880-8864-2912-0
    13: 5,  # 014-7558-3984-0
    16: 6,  # 6106-8763
    19: 15, # 735-5844-5652-0 (DB ID 15)
    22: 8,  # 848-8120-0360-0
    25: 9,  # 264-4808-7048-0
    28: 10, # 현금 통장
    31: 11, # 업비트, 케이뱅크
}

def parse_currency(value):
    """'₩1,234,567' 또는 '-₩123' 형태의 문자열을 float로 변환합니다."""
    if pd.isna(value) or value == "":
        return 0.0
    
    if isinstance(value, (int, float)):
        return float(value)
    
    # 공백 제거 및 특수문자 제거
    clean_val = str(value).replace(",", "").replace("₩", "").replace(" ", "")
    try:
        return float(clean_val)
    except ValueError:
        return 0.0

def migrate():
    """CSV 데이터를 읽어 DB로 이관합니다."""
    if not CSV_PATH.exists():
        print(f"오류: CSV 파일을 찾을 수 없습니다: {CSV_PATH}")
        return

    # CSV 로드 (헤더가 2줄임)
    # 0번 줄: 계좌명, 1번 줄: 속성명(총액, 추가액, 수익)
    df = pd.read_csv(CSV_PATH, header=None, skiprows=2)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    total_inserted = 0
    
    try:
        for _, row in df.iterrows():
            date_str = str(row[0]).strip()
            if not date_str or date_str == "nan":
                continue
            
            # 날짜 형식 변환: 2021. 1. 1 -> 2021-01-01
            try:
                date_obj = datetime.strptime(date_str, "%Y. %m. %d")
                formatted_date = date_obj.strftime("%Y-%m-%d")
            except ValueError:
                # 가끔 년.월 만 있는 경우 등 예외 처리 필요할 수 있음
                print(f"날짜 형식 오류 건너뜀: {date_str}")
                continue

            for col_idx, account_id in ACCOUNT_MAPPING.items():
                total_valuation = parse_currency(row[col_idx])
                period_deposit = parse_currency(row[col_idx + 1])
                total_profit = parse_currency(row[col_idx + 2])

                # 데이터가 모두 0이면 의미 없는 행으로 간주하고 건너뜀 (단, 총 자산 계좌는 제외)
                if account_id != 1 and total_valuation == 0 and period_deposit == 0 and total_profit == 0:
                    continue

                # 중복 확인 및 삽입 
                # (DB의 idx_account_snapshot_unique 인덱스에 의해 동일 날짜/계좌는 자동으로 REPLACE 됨)
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO account_snapshots 
                    (account_id, snapshot_date, period_deposit, total_valuation, total_profit)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (account_id, formatted_date, period_deposit, total_valuation, total_profit)
                )
                total_inserted += 1

        conn.commit()
        print(f"마이그레이션 완료: 총 {total_inserted}개의 스냅샷 데이터를 처리했습니다.")

    except Exception as e:
        print(f"작업 중 오류 발생: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
