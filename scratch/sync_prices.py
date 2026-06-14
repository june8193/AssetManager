# -*- coding: utf-8 -*-
"""production DB에서 development DB로 historical_prices 데이터를 복사하는 스크립트."""
import sqlite3
import os

def main():
    db_dev = "src/dev_assets.db"
    db_prod = "src/assets.db"

    if not os.path.exists(db_prod):
        print(f"오류: {db_prod} 파일이 존재하지 않습니다.")
        return

    print(f"{db_prod} -> {db_dev} 가격 데이터 이관 중...")
    try:
        conn = sqlite3.connect(db_dev)
        # DB 첨부 후 INSERT OR IGNORE 실행
        conn.execute(f"ATTACH '{db_prod}' AS prod")
        cursor = conn.cursor()
        cursor.execute("INSERT OR IGNORE INTO historical_prices (ticker, price_date, close_price) SELECT ticker, price_date, close_price FROM prod.historical_prices")
        conn.commit()
        print(f"이관 성공. 추가된 행 수: {cursor.rowcount}")
        conn.close()
    except Exception as e:
        print(f"오류 발생: {e}")

if __name__ == "__main__":
    main()
