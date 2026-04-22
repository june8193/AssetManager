import sqlite3
import os

def migrate():
    db_path = os.path.join("src", "assets.db")
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(account_snapshots)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if "period_deposit" in columns:
            print("Column 'period_deposit' already exists in 'account_snapshots'.")
        elif "total_deposit" in columns:
            print("Renaming 'total_deposit' to 'period_deposit' in 'account_snapshots'...")
            cursor.execute("ALTER TABLE account_snapshots RENAME COLUMN total_deposit TO period_deposit")
            conn.commit()
            print("Migration successful.")
        else:
            print("Neither 'total_deposit' nor 'period_deposit' found in 'account_snapshots'.")

    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
