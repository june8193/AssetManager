# -*- coding: utf-8 -*-
"""INITIAL_BALANCE 트랜잭션 날짜 마이그레이션 스크립트.

이 스크립트는 2026-04-20 날짜로 등록된 INITIAL_BALANCE 타입 트랜잭션의 날짜를
2026-04-18로 수정하여 증권사 정산 시 발생하는 오차를 해결합니다.
src/assets.db 및 src/dev_assets.db 두 데이터베이스 모두에 대해 작업을 수행합니다.
"""

import sqlite3
from pathlib import Path

def migrate_database(db_path: Path):
    """지정된 데이터베이스 파일에서 INITIAL_BALANCE 트랜잭션 날짜를 보정합니다.

    Args:
        db_path (Path): SQLite 데이터베이스 파일 경로.
    """
    if not db_path.exists():
        print(f"[-] 데이터베이스 파일을 찾을 수 없습니다: {db_path} (건너뜀)")
        return

    print(f"[*] 데이터베이스 마이그레이션 시작: {db_path}")
    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            
            # 먼저 보정 대상이 몇 개 있는지 확인
            cursor.execute(
                "SELECT COUNT(*) FROM transactions WHERE type = 'INITIAL_BALANCE' AND transaction_date = '2026-04-20'"
            )
            count_before = cursor.fetchone()[0]
            print(f" -> 보정 대상 INITIAL_BALANCE 트랜잭션 수: {count_before}개")
            
            if count_before == 0:
                print(" -> 보정 대상 데이터가 없습니다.")
                return

            # 업데이트 실행
            cursor.execute(
                "UPDATE transactions SET transaction_date = '2026-04-18' "
                "WHERE type = 'INITIAL_BALANCE' AND transaction_date = '2026-04-20'"
            )
            conn.commit()
            
            # 보정 완료 후 재확인
            cursor.execute(
                "SELECT COUNT(*) FROM transactions WHERE type = 'INITIAL_BALANCE' AND transaction_date = '2026-04-18'"
            )
            count_after = cursor.fetchone()[0]
            print(f" -> 보정 완료 후 (2026-04-18) 트랜잭션 수: {count_after}개")
            print("[+] 마이그레이션 성공적으로 완료되었습니다.\n")

    except Exception as e:
        print(f"[!] 마이그레이션 중 오류 발생: {e}\n")


def main():
    project_root = Path(__file__).parent.parent
    prod_db = project_root / "src" / "assets.db"
    dev_db = project_root / "src" / "dev_assets.db"
    
    # 두 DB 모두 마이그레이션 진행
    migrate_database(prod_db)
    migrate_database(dev_db)

if __name__ == "__main__":
    main()
