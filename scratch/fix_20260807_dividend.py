# -*- coding: utf-8 -*-
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.backend.models import Transaction, Account, Asset

def fix_20260807_data():
    engine = create_engine("sqlite:///src/assets.db")
    Session = sessionmaker(bind=engine)
    db = Session()

    try:
        # 1. 2026-08-07 기존 배당금 2건 (ID 218, 219) 금액 보정
        tx_218 = db.query(Transaction).filter(Transaction.id == 218).first()
        if tx_218:
            tx_218.quantity = 0.0
            tx_218.price = 0.0
            tx_218.total_amount = 40.50
            tx_218.currency = "USD"
            print(f"[보정 완료] ID {tx_218.id} (SGOV 배당금): {tx_218.total_amount} USD")

        tx_219 = db.query(Transaction).filter(Transaction.id == 219).first()
        if tx_219:
            tx_219.quantity = 0.0
            tx_219.price = 0.0
            tx_219.total_amount = 80.63
            tx_219.currency = "USD"
            print(f"[보정 완료] ID {tx_219.id} (TLT 배당금): {tx_219.total_amount} USD")

        # 2. 2026-08-07 해외 배당세 출금 2건 신규 적재 (중복 체크 후)
        # SGOV 배당세 (8,840원, external_id: 000000003)
        sgov_asset = db.query(Asset).filter(Asset.ticker == "SGOV").first()
        tlt_asset = db.query(Asset).filter(Asset.ticker == "TLT").first()

        tax_sgov_exist = db.query(Transaction).filter(Transaction.external_id == "000000003").first()
        if not tax_sgov_exist and sgov_asset:
            tax_sgov = Transaction(
                account_id=2,
                asset_id=sgov_asset.id,
                transaction_date=datetime.date(2026, 8, 7),
                type="TAX",
                quantity=0.0,
                price=0.0,
                total_amount=8840.0,
                currency="KRW",
                memo="키움 자동저장 (해외배당세)",
                source="AUTO_KIWOOM",
                external_id="000000003"
            )
            db.add(tax_sgov)
            print("[신규 적재] SGOV 해외배당세 (8,840원)")

        tax_tlt_exist = db.query(Transaction).filter(Transaction.external_id == "000000005").first()
        if not tax_tlt_exist and tlt_asset:
            tax_tlt = Transaction(
                account_id=2,
                asset_id=tlt_asset.id,
                transaction_date=datetime.date(2026, 8, 7),
                type="TAX",
                quantity=0.0,
                price=0.0,
                total_amount=17610.0,
                currency="KRW",
                memo="키움 자동저장 (해외배당세)",
                source="AUTO_KIWOOM",
                external_id="000000005"
            )
            db.add(tax_tlt)
            print("[신규 적재] TLT 해외배당세 (17,610원)")

        db.commit()
        print("\n 모든 DB 보정 작업 성공적으로 완료!")

    except Exception as e:
        db.rollback()
        print(f"오류 발생: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_20260807_data()
