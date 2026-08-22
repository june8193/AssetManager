# -*- coding: utf-8 -*-
"""자산 대분류(주식) 및 중분류(코어(지수), 알파(성장), 배당주) DB 마이그레이션 스크립트."""

import os
import sys
import sqlite3
from datetime import datetime

# 종목별 신규 분류 매핑
CORE_TICKERS = {"237350", "360750", "379800", "438080", "QQQ", "VOO"}
ALPHA_TICKERS = {"000660", "005930", "GOOGL", "SOXQ"}
DIVIDEND_TICKERS = {"PFE", "O", "KO", "SCHD"}


def migrate_database(db_path: str) -> None:
    """지정된 SQLite DB 파일의 assets 및 target_ratios 테이블을 새로운 분류 체계로 마이그레이션합니다.
    
    Args:
        db_path (str): 마이그레이션할 DB 파일 경로.
    """
    if not os.path.exists(db_path):
        print(f"[SKIP] DB 파일이 존재하지 않습니다: {db_path}")
        return

    print(f"\n==========================================")
    print(f"[*] 마이그레이션 시작: {db_path}")
    print(f"==========================================")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # 1. assets 테이블 마이그레이션
        cursor.execute("SELECT id, ticker, name, major_category, sub_category FROM assets")
        assets = cursor.fetchall()
        print(f"[-] 총 {len(assets)}개 자산 검토 중...")

        for asset_id, ticker, name, major, sub in assets:
            new_major = major
            new_sub = sub

            if ticker in CORE_TICKERS:
                new_major = "주식"
                new_sub = "코어(지수)"
            elif ticker in ALPHA_TICKERS:
                new_major = "주식"
                new_sub = "알파(성장)"
            elif ticker in DIVIDEND_TICKERS:
                new_major = "주식"
                new_sub = "배당주"
            elif major in ("일반주식", "배당주"):
                new_major = "주식"
                if sub in ("국내배당주", "해외배당주", "배당주"):
                    new_sub = "배당주"
                else:
                    new_sub = "알파(성장)"

            if (new_major, new_sub) != (major, sub):
                cursor.execute(
                    "UPDATE assets SET major_category = ?, sub_category = ? WHERE id = ?",
                    (new_major, new_sub, asset_id)
                )
                print(f"  - [자산 갱신] {name} ({ticker}): ({major}, {sub}) -> ({new_major}, {new_sub})")

        # 2. target_ratios 테이블 마이그레이션
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='target_ratios'")
        if cursor.fetchone():
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            # 2.1 대분류 처리: 일반주식 -> 주식 (65%), 배당주 대분류 삭제
            cursor.execute("SELECT id FROM target_ratios WHERE category_name = '주식' AND category_type = 'major'")
            stock_major = cursor.fetchone()
            if stock_major:
                cursor.execute(
                    "UPDATE target_ratios SET target_percentage = 65.0, updated_at = ? WHERE id = ?",
                    (now_str, stock_major[0])
                )
            else:
                cursor.execute("SELECT id FROM target_ratios WHERE category_name = '일반주식' AND category_type = 'major'")
                general_stock = cursor.fetchone()
                if general_stock:
                    cursor.execute(
                        "UPDATE target_ratios SET category_name = '주식', target_percentage = 65.0, updated_at = ? WHERE id = ?",
                        (now_str, general_stock[0])
                    )
                else:
                    cursor.execute(
                        "INSERT INTO target_ratios (category_name, category_type, target_percentage, parent_category, updated_at, mode) VALUES ('주식', 'major', 65.0, NULL, ?, 'absolute')",
                        (now_str,)
                    )

            # 기존 대분류 배당주 삭제
            cursor.execute("DELETE FROM target_ratios WHERE category_name = '배당주' AND category_type = 'major'")

            # 2.2 기존 일반주식/배당주 산하 중분류 삭제
            cursor.execute("DELETE FROM target_ratios WHERE category_type = 'sub' AND parent_category IN ('일반주식', '배당주')")
            cursor.execute("DELETE FROM target_ratios WHERE category_type = 'sub' AND category_name IN ('해외주식', '국내주식', '해외배당주', '국내배당주')")

            # 2.3 새로운 중분류 삽입 (목표 비중 0.0% 초기화)
            new_sub_categories = ["코어(지수)", "알파(성장)", "배당주"]
            for sub_cat in new_sub_categories:
                cursor.execute("SELECT id FROM target_ratios WHERE category_name = ? AND category_type = 'sub' AND parent_category = '주식'", (sub_cat,))
                if not cursor.fetchone():
                    cursor.execute(
                        "INSERT INTO target_ratios (category_name, category_type, target_percentage, parent_category, updated_at, mode) VALUES (?, 'sub', 0.0, '주식', ?, 'absolute')",
                        (sub_cat, now_str)
                    )
                    print(f"  - [중분류 생성] {sub_cat} (부모: 주식, 목표: 0.0%)")

            # 2.4 종목 레벨 목표 비중 부모 카테고리 갱신 및 0% 초기화
            cursor.execute("SELECT id, category_name FROM target_ratios WHERE category_type = 'stock'")
            stock_ratios = cursor.fetchall()
            for ratio_id, ticker in stock_ratios:
                parent_sub = None
                if ticker in CORE_TICKERS:
                    parent_sub = "코어(지수)"
                elif ticker in ALPHA_TICKERS:
                    parent_sub = "알파(성장)"
                elif ticker in DIVIDEND_TICKERS:
                    parent_sub = "배당주"

                if parent_sub:
                    cursor.execute(
                        "UPDATE target_ratios SET parent_category = ?, target_percentage = 0.0, updated_at = ? WHERE id = ?",
                        (parent_sub, now_str, ratio_id)
                    )
                    print(f"  - [종목 비중 갱신] {ticker}: 부모 -> {parent_sub}, 목표 -> 0.0%")

        conn.commit()
        print(f"[SUCCESS] {db_path} 마이그레이션 완료!")

    except Exception as e:
        conn.rollback()
        print(f"[ERROR] 마이그레이션 실패: {e}")
        raise
    finally:
        conn.close()


def main():
    """스크립트 엔트리포인트."""
    target_dbs = ["src/dev_assets.db", "src/assets.db"]
    if len(sys.argv) > 1:
        target_dbs = sys.argv[1:]

    for db_path in target_dbs:
        migrate_database(db_path)


if __name__ == "__main__":
    main()
