"""스냅샷 일괄 재계산 관리자 CLI 도구 스크립트.

원장 거래 내역을 기반으로 과거 스냅샷의 입출금 및 기간 수익을 재산출하여
데이터베이스를 갱신하거나 dry-run으로 변경 사항을 검토합니다.

사용 예시:
    uv run scripts/recalculate_snapshots.py --dry-run
    uv run scripts/recalculate_snapshots.py --commit
    uv run scripts/recalculate_snapshots.py --from-date 2026-01-01 --commit
"""

import argparse
import asyncio
import sys
from datetime import datetime, date
from pathlib import Path

# 프로젝트 루트 경로를 sys.path에 추가
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

# Windows 콘솔 인코딩 호환성 보장
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from src.backend.database import SessionLocal
from src.backend.services.snapshot_engine import SnapshotEngine
from src.backend.schemas.snapshot import SnapshotRecalculateRequest


async def main():
    parser = argparse.ArgumentParser(description="스냅샷 일괄 재계산 도구")
    parser.add_argument("--from-date", type=str, default=None, help="재계산 시작 일자 (YYYY-MM-DD)")
    parser.add_argument("--account-id", type=int, default=None, help="특정 계좌 ID 필터 (선택 사항)")
    parser.add_argument("--dry-run", action="store_true", default=False, help="DB 변경 없이 diff만 출력")
    parser.add_argument("--commit", action="store_true", default=False, help="실제 DB에 변경 사항 반영")

    args = parser.parse_args()

    # --commit이 지정되지 않으면 기본적으로 dry_run으로 동작
    dry_run = not args.commit or args.dry_run

    parsed_from_date: date | None = None
    if args.from_date:
        try:
            parsed_from_date = datetime.strptime(args.from_date, "%Y-%m-%d").date()
        except ValueError:
            print(f"[오류] 올바르지 않은 날짜 형식입니다: {args.from_date} (YYYY-MM-DD 필요)")
            sys.exit(1)

    print("=" * 60)
    print("[스냅샷 일괄 재계산 실행]")
    print(f"   - 모드: {'[미리보기 (Dry Run)]' if dry_run else '[실제 반영 (Commit)]'}")
    print(f"   - 시작 일자: {parsed_from_date or '전체 기간'}")
    print(f"   - 계좌 필터: {args.account_id or '전체 계좌'}")
    print("=" * 60)


    db = SessionLocal()
    try:
        engine = SnapshotEngine(db)
        req = SnapshotRecalculateRequest(
            from_date=parsed_from_date,
            account_id=args.account_id,
            dry_run=dry_run
        )
        response = await engine.recalculate(req)

        print(f"\n[결과] {response.summary_message}")
        print(f"   - 평가된 스냅샷 수: {response.total_snapshots_evaluated}개")
        print(f"   - 변경 대상 스냅샷 수: {response.total_snapshots_updated}개\n")

        if response.diffs:
            print("[상세 변경 내역]")
            for diff in response.diffs:
                if diff.is_changed:
                    print(
                        f"  * [{diff.snapshot_date}] 계좌 '{diff.account_name}' ({diff.account_type})\n"
                        f"    - 입출금: {diff.old_period_deposit:,.0f}원 -> {diff.new_period_deposit:,.0f}원 (차액: {diff.diff_period_deposit:+,.0f}원)\n"
                        f"    - 기간수익: {diff.old_period_profit:,.0f}원 -> {diff.new_period_profit:,.0f}원 (차액: {diff.diff_period_profit:+,.0f}원)"
                    )
        else:
            print("[안내] 변경이 필요한 스냅샷이 없습니다. 모든 데이터가 정합성을 유지하고 있습니다.")


        print("=" * 60)
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())
