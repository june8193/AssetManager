"""데이터베이스 조회 유틸리티 스크립트.

이 스크립트는 AI 에이전트나 개발자가 데이터베이스 내용을 신속하게 조회하기 위해 사용합니다.
매번 일회성 파이썬 스크립트를 작성하지 않고도 SQL 쿼리를 직접 실행할 수 있습니다.
"""

import sqlite3
import pandas as pd
import argparse
import sys
from pathlib import Path


def run_query(query: str, db_path: str):
    """주어진 SQL 쿼리를 실행하고 결과를 표 형식으로 출력합니다.

    Args:
        query (str): 실행할 SQL 쿼리 문자열.
        db_path (str): SQLite 데이터베이스 파일 경로.

    Returns:
        None
    """
    try:
        # DB 파일 존재 여부 확인
        if not Path(db_path).exists():
            print(f"오류: 데이터베이스 파일을 찾을 수 없습니다. (경로: {db_path})")
            return

        with sqlite3.connect(db_path) as conn:
            df = pd.read_sql_query(query, conn)

            if df.empty:
                print("조회 결과가 없습니다.")
            else:
                # pandas 출력 설정 (모든 열 표시 및 가독성 향상)
                pd.set_option("display.max_columns", None)
                pd.set_option("display.expand_frame_repr", False)
                pd.set_option("display.max_colwidth", None)
                pd.set_option("display.width", 1000)
                
                print(df.to_string(index=False))
                print(f"\n[조회 완료: {len(df)}개의 행]")

    except Exception as e:
        print(f"쿼리 실행 중 오류가 발생했습니다: {e}", file=sys.stderr)


def main():
    """커맨드라인 인자를 처리하여 쿼리를 실행합니다."""
    parser = argparse.ArgumentParser(description="AssetManager 데이터베이스 조회 도구")
    parser.add_argument("query", nargs="?", help="실행할 SQL 쿼리문")
    parser.add_argument(
        "-l", "--list-tables", action="store_true", help="데이터베이스의 모든 테이블 목록을 조회합니다."
    )
    parser.add_argument(
        "--db", default="src/assets.db", help="데이터베이스 파일 경로 (기본값: src/assets.db)"
    )

    args = parser.parse_args()

    if args.list_tables:
        tables_query = (
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
        )
        print("--- 데이터베이스 테이블 목록 ---")
        run_query(tables_query, args.db)
    elif args.query:
        run_query(args.query, args.db)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
