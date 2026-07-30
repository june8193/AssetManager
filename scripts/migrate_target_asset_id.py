import sqlite3
import os
import sys

def migrate_db(db_path: str):
    if not os.path.exists(db_path):
        print(f"[Info] DB file not found: {db_path}, skipping migration.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # transactions 테이블의 컬럼 정보 확인
    cursor.execute("PRAGMA table_info(transactions);")
    columns = [row[1] for row in cursor.fetchall()]

    if "target_asset_id" not in columns:
        print(f"[Migration] Adding target_asset_id column to {db_path}...")
        cursor.execute("ALTER TABLE transactions ADD COLUMN target_asset_id INTEGER REFERENCES assets(id);")
        conn.commit()
        print(f"[Migration] Successfully added target_asset_id column to {db_path}.")
    else:
        print(f"[Info] target_asset_id already exists in {db_path}.")

    conn.close()

if __name__ == "__main__":
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    db_paths = [
        os.path.join(base_dir, "src", "assets.db"),
        os.path.join(base_dir, "src", "dev_assets.db")
    ]
    for path in db_paths:
        migrate_db(path)
