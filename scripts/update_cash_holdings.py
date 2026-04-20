"""현금 계좌 보유량 업데이트 스크립트.

CSV 파일(현금계좌_이관.csv)을 읽어 KRW 현금 잔액을
INITIAL_BALANCE 트랜잭션으로 데이터베이스에 반영합니다.
"""
import datetime
import re
import sys

import pandas as pd

from src.backend.database import SessionLocal
from src.backend.models import Account, Asset, Transaction


def parse_amount(value: str) -> float:
    """금액 문자열에서 숫자를 파싱합니다.

    Args:
        value: '₩8,080,000' 형태의 금액 문자열

    Returns:
        파싱된 float 금액 값
    """
    cleaned = re.sub(r"[₩,\s]", "", str(value))
    return float(cleaned)


def main():
    """현금 계좌 보유량을 CSV에서 읽어 INITIAL_BALANCE 트랜잭션으로 DB에 반영합니다.

    1. CSV 파일 로드 및 파싱
    2. 각 계좌의 KRW INITIAL_BALANCE 트랜잭션 삭제 후 재생성
    """
    csv_path = "work/old_data/데이터 이관 - 현금계좌_이관.csv"

    # CSV 로드
    try:
        df = pd.read_csv(csv_path, encoding="utf-8-sig", dtype={"account_name": str, "ticker": str})
    except Exception as e:
        print(f"CSV 로드 실패: {e}")
        sys.exit(1)

    print(f"CSV 로드 완료: {len(df)}건")

    db = SessionLocal()
    try:
        # KRW 자산 조회
        krw_asset = db.query(Asset).filter(Asset.ticker == "KRW").first()
        if not krw_asset:
            print("오류: KRW 자산이 DB에 존재하지 않습니다.")
            sys.exit(1)
        print(f"KRW 자산 확인: ID={krw_asset.id}, name={krw_asset.name}")

        update_date = datetime.date.today()
        success_count = 0
        error_count = 0

        for idx, row in df.iterrows():
            acc_num = str(row["account_name"]).strip()
            ticker = str(row["ticker"]).strip()
            alias = str(row.get("alias", "")).strip()

            # KRW 현금만 처리
            if ticker != "KRW":
                print(f"건너뜀 (KRW 아님): {acc_num} / {ticker}")
                continue

            # 금액 파싱 (quantity 컬럼)
            try:
                quantity = parse_amount(row["quantity"])
            except Exception as e:
                print(f"경고: 금액 파싱 실패 - {acc_num} / {row['quantity']} ({e})")
                error_count += 1
                continue

            # 계좌 조회
            account = db.query(Account).filter(Account.name == acc_num).first()
            if not account:
                print(f"경고: 계좌를 찾을 수 없습니다 - {acc_num} (행 {idx + 2})")
                error_count += 1
                continue

            # 기존 KRW INITIAL_BALANCE 트랜잭션 삭제
            deleted = db.query(Transaction).filter(
                Transaction.account_id == account.id,
                Transaction.asset_id == krw_asset.id,
                Transaction.type == "INITIAL_BALANCE",
            ).delete()

            # 신규 트랜잭션 생성
            tx = Transaction(
                account_id=account.id,
                asset_id=krw_asset.id,
                transaction_date=update_date,
                type="INITIAL_BALANCE",
                quantity=quantity,
                price=1.0,
                total_amount=quantity,
                currency="KRW",
            )
            db.add(tx)
            print(f"반영: {acc_num} ({alias}) → KRW {quantity:,.0f} (기존 {deleted}건 삭제)")
            success_count += 1

        db.commit()
        print()
        print(f"업데이트 완료: 성공 {success_count}건, 실패 {error_count}건")

    except Exception as e:
        print(f"오류 발생: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
