import sqlite3

def main():
    conn = sqlite3.connect('src/dev_assets.db')
    cursor = conn.cursor()
    cursor.execute("DELETE FROM assets WHERE ticker = 'TSLA'")
    conn.commit()
    print(f"삭제 완료: {cursor.rowcount}개의 행이 삭제되었습니다.")
    conn.close()

if __name__ == "__main__":
    main()
