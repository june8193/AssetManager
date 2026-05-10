import sqlite3
from pathlib import Path

def main():
    db_path = Path("src/assets.db")
    if not db_path.exists():
        print("DB 파일을 찾을 수 없습니다.")
        return

    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            
            # 스냅샷 삭제
            cursor.execute("DELETE FROM account_snapshots WHERE snapshot_date = '2026-05-10'")
            snapshots_deleted = cursor.rowcount
            
            # 거래 내역 삭제
            cursor.execute("DELETE FROM transactions WHERE transaction_date = '2026-05-10'")
            txs_deleted = cursor.rowcount
            
            conn.commit()
            print(f"✅ 조치 완료: 스냅샷 {snapshots_deleted}건, 거래 내역 {txs_deleted}건 삭제됨.")
            
    except Exception as e:
        print(f"❌ 오류 발생: {e}")

if __name__ == "__main__":
    main()
