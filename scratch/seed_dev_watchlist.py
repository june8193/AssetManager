import sys
import os
import sqlite3

def main():
    db_path = "src/dev_assets.db"
    if not os.path.exists(db_path):
        print(f"Error: {db_path} does not exist.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 테이블에 삼성전자와 애플 추가
    try:
        cursor.execute("INSERT OR IGNORE INTO watchlist (id, stock_code, stock_name, country) VALUES (1, '005930', '삼성전자', 'KR')")
        cursor.execute("INSERT OR IGNORE INTO watchlist (id, stock_code, stock_name, country) VALUES (2, 'AAPL', 'Apple', 'US')")
        conn.commit()
        print("Successfully seeded watchlist items into dev_assets.db")
    except Exception as e:
        print(f"Error seeding: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    main()
