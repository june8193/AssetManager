"""중복된 자산 스냅샷 데이터를 정리하고 제약 조건을 추가하는 스크립트.

1. 동일한 (account_id, snapshot_date)를 가진 중복 데이터 중 입금액 정보가 있는 것을 남기고 정리합니다.
2. 2025년 이후(2024-12-29 포함)의 ID 1번(Legacy_Total_Account) 데이터를 삭제합니다.
3. 중복 방지를 위한 UNIQUE INDEX를 추가합니다.
"""

import sqlite3
from pathlib import Path

DB_PATH = Path("src/assets.db")

def cleanup():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        print("--- 데이터 정리 작업 시작 ---")
        
        # 1. ID 1번 계좌 2024-12-29 이후 데이터 삭제
        cursor.execute(
            "DELETE FROM account_snapshots WHERE account_id = 1 AND snapshot_date >= '2024-12-29'"
        )
        print(f"ID 1번 계좌 정리 완료: {cursor.rowcount}행 삭제")

        # 2. 중복 데이터 정리 (모든 중복 건에 대해 입금액이 0인 행을 우선 삭제)
        # 잔액이 동일함이 확인되었으므로, 같은 날짜/계좌 중 입금액(total_deposit)이 0인 행을 삭제합니다.
        # 단, 만약 둘 다 0이더라도 하나는 남겨야 하므로 ID 기반으로 정리합니다.
        
        # 삭제 대상 ID 식별: 동일 (account_id, snapshot_date) 중 
        # total_deposit이 0인 행을 삭제하되, 만약 모든 중복행이 0이면 가장 큰 ID만 남김.
        
        # 첫 번째 패스: 입금액이 0인 중복 행 삭제 (입금액이 있는 행이 최소 하나 존재할 때)
        cursor.execute("""
            DELETE FROM account_snapshots 
            WHERE id IN (
                SELECT a1.id 
                FROM account_snapshots a1
                JOIN account_snapshots a2 ON a1.account_id = a2.account_id AND a1.snapshot_date = a2.snapshot_date
                WHERE a1.id != a2.id 
                AND a1.total_deposit = 0.0 
                AND a2.total_deposit != 0.0
            )
        """)
        print(f"입금액 누락 중복 데이터 정리(Pass 1) 완료: {cursor.rowcount}행 삭제")

        # 두 번째 패스: 여전히 남은 중복 행 처리 (완전 일치 등) - 가장 작은 ID만 남김
        cursor.execute("""
            DELETE FROM account_snapshots 
            WHERE id NOT IN (
                SELECT MIN(id) 
                FROM account_snapshots 
                GROUP BY account_id, snapshot_date
            )
        """)
        print(f"잔여 중복 데이터 정리(Pass 2) 완료: {cursor.rowcount}행 삭제")

        # 3. UNIQUE INDEX 추가 (중복 방지 제약)
        print("UNIQUE INDEX 생성 중...")
        cursor.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_account_snapshot_unique ON account_snapshots (account_id, snapshot_date)"
        )
        print("중복 방지 인덱스(idx_account_snapshot_unique) 생성 완료")

        conn.commit()
        print("--- 모든 정리 작업 완료 ---")

    except Exception as e:
        print(f"오류 발생: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    cleanup()
