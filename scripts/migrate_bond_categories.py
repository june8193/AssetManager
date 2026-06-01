"""기존 데이터베이스 내 채권 카테고리를 세분화하고 마이그레이션하는 스크립트입니다.

이 스크립트는 운영 DB(src/assets.db) 및 개발용 DB(src/dev_assets.db)를 대상으로
'해외채권'을 '미국장기채'로 변경하고, 신규 채권 세분화 카테고리를 목표 비중에 등록합니다.
"""

import os
import sqlite3

def migrate_database(db_path: str):
    """지정된 SQLite 데이터베이스 파일을 마이그레이션합니다.
    
    Args:
        db_path (str): SQLite 데이터베이스 파일 경로.
    """
    if not os.path.exists(db_path):
        print(f"데이터베이스 파일이 존재하지 않아 건너뜁니다: {db_path}")
        return
        
    print(f"마이그레이션 시작: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # 1. assets 테이블의 sub_category가 '해외채권'인 데이터를 '미국장기채'로 업데이트
        cursor.execute("""
            UPDATE assets 
            SET sub_category = '미국장기채' 
            WHERE major_category = '채권' AND sub_category = '해외채권'
        """)
        updated_assets = cursor.rowcount
        print(f"  - assets 테이블 {updated_assets}개 행 업데이트 완료 ('해외채권' -> '미국장기채')")
        
        # 2. target_ratios 테이블의 category_name이 '해외채권'인 데이터를 '미국장기채'로 업데이트
        cursor.execute("""
            UPDATE target_ratios 
            SET category_name = '미국장기채' 
            WHERE category_name = '해외채권' AND category_type = 'sub' AND parent_category = '채권'
        """)
        updated_ratios = cursor.rowcount
        print(f"  - target_ratios 테이블 {updated_ratios}개 행 업데이트 완료 ('해외채권' -> '미국장기채')")
        
        # 3. target_ratios 테이블에 신규 카테고리 등록 (미국단기채, 한국장기채, 한국단기채)
        new_categories = ["미국단기채", "한국장기채", "한국단기채"]
        for cat in new_categories:
            # 이미 등록되어 있는지 확인
            cursor.execute("""
                SELECT id FROM target_ratios 
                WHERE category_name = ? AND category_type = 'sub' AND parent_category = '채권'
            """, (cat,))
            if cursor.fetchone() is None:
                # 등록되어 있지 않은 경우에만 비중 0.0%로 등록
                cursor.execute("""
                    INSERT INTO target_ratios (category_name, category_type, target_percentage, parent_category, mode, updated_at)
                    VALUES (?, 'sub', 0.0, '채권', 'absolute', datetime('now', 'localtime'))
                """, (cat,))
                print(f"  - target_ratios 테이블에 신규 카테고리 '{cat}' 등록 완료 (비중 0.0%)")
            else:
                print(f"  - target_ratios 테이블에 '{cat}' 카테고리가 이미 존재하여 등록을 건너뜁니다.")
                
        conn.commit()
        print(f"마이그레이션 성공적으로 완료: {db_path}\n")
        
    except Exception as e:
        conn.rollback()
        print(f"마이그레이션 중 오류 발생: {e}\n")
        raise e
    finally:
        conn.close()

def main():
    """운영 및 개발용 데이터베이스를 찾아 마이그레이션을 수행합니다."""
    # 데이터베이스 파일 후보 경로들
    db_paths = [
        "src/assets.db",
        "src/dev_assets.db"
    ]
    
    for path in db_paths:
        migrate_database(path)

if __name__ == "__main__":
    main()
