#!/usr/bin/env python3
"""은행 계좌 스냅샷 손익 계산 기준 통일 및 DB 마이그레이션 스크립트.

기존에 전체 누적 손익으로 잘못 기록된 은행 계좌 스냅샷의 total_profit 및 period_deposit을
직전 스냅샷 대비 '기간 손익' 및 '기간 순입금액'으로 재계산하여 보정합니다.
"""

import os
import sys
import shutil
import tomllib
import argparse
import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# 프로젝트 루트 경로 추가
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.backend.models import Account, Transaction, AccountSnapshot


def get_default_backup_dir(settings_path: str = "settings.toml") -> Path:
    """settings.toml에서 백업 디렉토리 설정을 로드합니다.
    
    Args:
        settings_path (str): settings.toml 파일 경로.
        
    Returns:
        Path: 설정된 백업 디렉토리 경로 (없으면 ./backups).
    """
    p = PROJECT_ROOT / settings_path
    if p.exists():
        try:
            with open(p, "rb") as f:
                data = tomllib.load(f)
                b_path = data.get("backup", {}).get("path")
                if b_path:
                    return Path(b_path)
        except Exception as e:
            print(f"[경고] settings.toml 백업 경로 로드 실패: {e}")
    return PROJECT_ROOT / "backups"


def perform_db_backup(db_path: str, backup_dir: Optional[str] = None) -> Path:
    """마이그레이션 수행 전 DB 파일을 백업 디렉토리에 복사합니다.
    
    Args:
        db_path (str): 원본 DB 파일 경로.
        backup_dir (Optional[str]): 대상 백업 디렉토리 (None일 경우 settings.toml 참조).
        
    Returns:
        Path: 생성된 백업 파일 경로.
    """
    src_p = Path(db_path).resolve()
    if not src_p.exists():
        raise FileNotFoundError(f"DB 파일을 찾을 수 없습니다: {db_path}")

    dest_dir = Path(backup_dir) if backup_dir else get_default_backup_dir()
    dest_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    dest_file = dest_dir / f"assets_backup_{timestamp}.db"

    shutil.copy2(src_p, dest_file)
    return dest_file


def run_migration(
    db_path: str = "src/assets.db",
    account_id: Optional[int] = None,
    dry_run: bool = False,
    backup_dir: Optional[str] = None,
    no_backup: bool = False
) -> List[Dict[str, Any]]:
    """은행 계좌 스냅샷 손익 마이그레이션을 실행합니다.
    
    Args:
        db_path (str): 대상 SQLite DB 파일 경로.
        account_id (Optional[int]): 특정 계좌 ID 필터 (지정하지 않으면 모든 은행 계좌).
        dry_run (bool): 실제 DB 저장 여부 (True일 경우 변경사항 커밋 안 함).
        backup_dir (Optional[str]): 백업 디렉토리 경로.
        no_backup (bool): 자동 백업 생략 여부.
        
    Returns:
        List[Dict[str, Any]]: 마이그레이션 대상 스냅샷별 전/후 데이터 목록.
    """
    db_file = Path(db_path).resolve()
    if not db_file.exists():
        raise FileNotFoundError(f"DB 파일이 존재하지 않습니다: {db_path}")

    if not dry_run and not no_backup:
        backup_created = perform_db_backup(str(db_file), backup_dir)
        print(f"[INFO] 마이그레이션 전 DB 자동 백업 완료: {backup_created}")

    engine = create_engine(f"sqlite:///{db_file}")
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()

    results: List[Dict[str, Any]] = []

    try:
        # 1. 은행 계좌 목록 조회
        acc_query = session.query(Account).filter(Account.account_type == "BANK")
        if account_id is not None:
            acc_query = acc_query.filter(Account.id == account_id)
        
        bank_accounts = acc_query.all()
        if not bank_accounts:
            print("[INFO] 마이그레이션 대상 은행 계좌가 없습니다.")
            return []

        # 2. 계좌별 스냅샷 순회 및 재계산
        for acc in bank_accounts:
            snapshots = session.query(AccountSnapshot).filter(
                AccountSnapshot.account_id == acc.id
            ).order_by(AccountSnapshot.snapshot_date.asc()).all()

            if not snapshots:
                continue

            last_snapshot_date = datetime.date(1970, 1, 1)
            last_valuation = 0.0

            for snap in snapshots:
                # 해당 기간(직전 스냅샷 일자 초과 ~ 현재 스냅샷 일자 이하) 트랜잭션 조회
                txs = session.query(Transaction).filter(
                    Transaction.account_id == acc.id,
                    Transaction.transaction_date > last_snapshot_date,
                    Transaction.transaction_date <= snap.snapshot_date
                ).all()

                # 기간 순입금액 계산 (INITIAL_BALANCE, DEPOSIT은 입금, WITHDRAW는 출금)
                period_deposit = 0.0
                for tx in txs:
                    if tx.type in ['DEPOSIT', 'INITIAL_BALANCE']:
                        period_deposit += tx.total_amount
                    elif tx.type == 'WITHDRAW':
                        period_deposit -= tx.total_amount

                # 기간 손익 계산: 현재 평가액 - 직전 평가액 - 기간 순입금액
                period_profit = snap.total_valuation - last_valuation - period_deposit

                result_item = {
                    "account_id": acc.id,
                    "account_name": acc.alias or acc.name,
                    "snapshot_id": snap.id,
                    "snapshot_date": snap.snapshot_date.strftime("%Y-%m-%d"),
                    "total_valuation": snap.total_valuation,
                    "old_period_deposit": snap.period_deposit,
                    "new_period_deposit": period_deposit,
                    "old_period_profit": snap.total_profit,
                    "new_period_profit": period_profit,
                }
                results.append(result_item)

                if not dry_run:
                    snap.period_deposit = period_deposit
                    snap.total_profit = period_profit

                last_snapshot_date = snap.snapshot_date
                last_valuation = snap.total_valuation

        if not dry_run:
            session.commit()
            print(f"[SUCCESS] 총 {len(results)}건의 은행 스냅샷이 성공적으로 업데이트되었습니다.")
        else:
            session.rollback()
            print(f"[DRY-RUN] 시뮬레이션 완료 (총 {len(results)}건 대상, DB 변경 없음).")

    except Exception as e:
        session.rollback()
        print(f"[ERROR] 마이그레이션 중 오류 발생: {e}")
        raise
    finally:
        session.close()

    return results


def print_results_table(results: List[Dict[str, Any]]):
    """마이그레이션 전/후 결과를 가독성 높은 테이블 형태로 출력합니다."""
    if not results:
        print("출력할 마이그레이션 결과가 없습니다.")
        return

    header = f"{'일자':<12} | {'계좌명':<16} | {'총평가액':>14} | {'입금액(이전)':>14} -> {'입금액(변경)':>14} | {'손익(이전)':>14} -> {'손익(변경)':>14}"
    divider = "-" * len(header)
    print("\n" + divider)
    print(header)
    print(divider)

    for r in results:
        val_str = f"{r['total_valuation']:,.0f}원"
        old_dep_str = f"{r['old_period_deposit']:,.0f}원"
        new_dep_str = f"{r['new_period_deposit']:,.0f}원"
        old_prof_str = f"{r['old_period_profit']:+,.0f}원"
        new_prof_str = f"{r['new_period_profit']:+,.0f}원"

        print(
            f"{r['snapshot_date']:<12} | "
            f"{r['account_name']:<16} | "
            f"{val_str:>14} | "
            f"{old_dep_str:>14} -> {new_dep_str:>14} | "
            f"{old_prof_str:>14} -> {new_prof_str:>14}"
        )
    print(divider + "\n")


def main():
    """CLI 진입점 함수."""
    parser = argparse.ArgumentParser(description="은행 계좌 스냅샷 기간 손익 마이그레이션 스크립트")
    parser.add_argument("--db-path", default="src/assets.db", help="대상 SQLite DB 파일 경로 (기본값: src/assets.db)")
    parser.add_argument("--account-id", type=int, default=None, help="특정 은행 계좌 ID만 마이그레이션")
    parser.add_argument("--dry-run", action="store_true", help="DB에 실제로 쓰지 않고 계산 결과만 시뮬레이션")
    parser.add_argument("--backup-dir", default=None, help="백업 저장 디렉토리 (기본값: settings.toml의 [backup].path)")
    parser.add_argument("--no-backup", action="store_true", help="마이그레이션 전 자동 백업 생략")

    args = parser.parse_args()

    print("=" * 70)
    print(" [AssetManager] 은행 계좌 스냅샷 손익 기준 정렬 마이그레이션")
    print(f" 대상 DB: {args.db_path}")
    print(f" 모드: {'DRY-RUN (시뮬레이션)' if args.dry_run else '실제 실행 (COMMIT)'}")
    print("=" * 70)

    try:
        results = run_migration(
            db_path=args.db_path,
            account_id=args.account_id,
            dry_run=args.dry_run,
            backup_dir=args.backup_dir,
            no_backup=args.no_backup
        )
        print_results_table(results)
    except Exception as e:
        print(f"\n[실패] 마이그레이션 실패: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
