import sqlite3
import os

def migrate():
    # DB 파일 경로
    db_path = "src/assets.db"
    
    if not os.path.exists(db_path):
        print(f"DB file not found at {db_path}")
        return
        
    print(f"Connecting to database: {db_path} ...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # 보정 대상 데이터: (수정할 period_deposit, account_id, snapshot_date)
        updates = [
            (100000.0, 12, "2026-05-28"),
            (0.0, 14, "2026-05-28"),
            (9009230.0, 13, "2026-05-28")
        ]
        
        # 보정 전 상태 출력
        print("\n--- Before Update ---")
        for _, account_id, snapshot_date in updates:
            cursor.execute(
                "SELECT id, account_id, snapshot_date, period_deposit FROM account_snapshots WHERE account_id = ? AND snapshot_date = ?",
                (account_id, snapshot_date)
            )
            row = cursor.fetchone()
            if row:
                print(f"ID: {row[0]}, Account ID: {row[1]}, Date: {row[2]}, Period Deposit: {row[3]}")
            else:
                print(f"No snapshot found for Account ID: {account_id} on {snapshot_date}")
                
        # 업데이트 실행
        print("\nUpdating snapshots...")
        for period_deposit, account_id, snapshot_date in updates:
            cursor.execute(
                "UPDATE account_snapshots SET period_deposit = ? WHERE account_id = ? AND snapshot_date = ?",
                (period_deposit, account_id, snapshot_date)
            )
        
        conn.commit()
        print("Update successful!")
        
        # 보정 후 상태 출력
        print("\n--- After Update ---")
        for _, account_id, snapshot_date in updates:
            cursor.execute(
                "SELECT id, account_id, snapshot_date, period_deposit FROM account_snapshots WHERE account_id = ? AND snapshot_date = ?",
                (account_id, snapshot_date)
            )
            row = cursor.fetchone()
            if row:
                print(f"ID: {row[0]}, Account ID: {row[1]}, Date: {row[2]}, Period Deposit: {row[3]}")

    except Exception as e:
        conn.rollback()
        print(f"Error during migration: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
