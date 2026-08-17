import pytest
from fastapi.testclient import TestClient
from datetime import date
from src.backend.main import app
from src.backend.models import Account, Transaction, Asset

client = TestClient(app)

@pytest.fixture
def setup_bank_account(db_session):
    # 1. KRW 자산 생성
    krw = Asset(ticker="KRW", name="원화", major_category="현금", sub_category="원화예수금", country="KR")
    db_session.add(krw)
    db_session.flush()
    
    # 2. 은행 계좌 생성
    acc = Account(user_id=1, name="테스트은행", provider="신한", account_type="BANK", is_active=True)
    db_session.add(acc)
    db_session.flush()
    
    # 3. 초기 잔액 설정 (10,000원)
    tx = Transaction(
        account_id=acc.id,
        asset_id=krw.id,
        transaction_date=date(2024, 1, 1),
        type="INITIAL_BALANCE",
        quantity=10000,
        price=1.0,
        total_amount=10000,
        currency="KRW"
    )
    db_session.add(tx)
    db_session.commit()
    return acc, krw

def test_calculate_bank_snapshot(setup_bank_account, db_session):
    acc, krw = setup_bank_account
    
    # 새로운 트랜잭션 시뮬레이션: 입금 5000, 출금 2000, 이자 100, 세금 15, 현금보정 200 (FEE 제외)
    new_transactions = [
        {"account_id": acc.id, "asset_id": krw.id, "transaction_date": "2024-01-15", "type": "DEPOSIT", "total_amount": 5000, "currency": "KRW"},
        {"account_id": acc.id, "asset_id": krw.id, "transaction_date": "2024-01-16", "type": "WITHDRAW", "total_amount": 2000, "currency": "KRW"},
        {"account_id": acc.id, "asset_id": krw.id, "transaction_date": "2024-01-17", "type": "INTEREST", "total_amount": 100, "currency": "KRW"},
        {"account_id": acc.id, "asset_id": krw.id, "transaction_date": "2024-01-17", "type": "TAX", "total_amount": 15, "currency": "KRW"},
        {"account_id": acc.id, "asset_id": krw.id, "transaction_date": "2024-01-19", "type": "CASH_ADJUSTMENT", "total_amount": 200, "currency": "KRW"},
    ]
    
    response = client.post("/api/db/snapshots/bank/calculate", json={
        "account_id": acc.id,
        "snapshot_date": "2024-01-31",
        "new_transactions": new_transactions
    })
    
    assert response.status_code == 200
    data = response.json()
    # 계산: 10000 (초기) + 5000 (입금) - 2000 (출금) + 100 (이자) - 15 (세금) + 200 (보정) = 13285
    assert data["theoretical_krw"] == 13285.0
    
    # 거래 유형별 합계 검증
    # 초기 잔액(INITIAL_BALANCE: 10000)은 입금(total_deposit)에 포함되어야 함
    assert data["total_deposit"] == 15000.0
    assert data["total_withdraw"] == 2000.0
    assert data["total_interest"] == 100.0
    assert data["total_tax"] == 15.0
    assert data["total_adjustment"] == 200.0
    
    # 기간 순입금액 및 기간 손익 검증 (신규 추가 필드)
    # period_deposit = 15000 - 2000 = 13000.0
    assert data["period_deposit"] == 13000.0
    # period_profit = 13285 (잔액) - 0 (직전평가) - 13000 (기간순입금) = 285.0 (이자 100 - 세금 15 + 보정 200)
    assert data["period_profit"] == 285.0


def test_calculate_bank_snapshot_with_previous_snapshot(setup_bank_account, db_session):
    """직전 스냅샷이 존재하는 경우의 기간 입금액 및 기간 손익 산출 검증."""
    acc, krw = setup_bank_account
    from src.backend.models import AccountSnapshot
    
    # 1. 2024-01-10 기준 직전 스냅샷 생성 (평가액 10,000원)
    prev_snap = AccountSnapshot(
        account_id=acc.id,
        snapshot_date=date(2024, 1, 10),
        period_deposit=10000.0,
        total_valuation=10000.0,
        total_profit=0.0
    )
    db_session.add(prev_snap)
    db_session.commit()
    
    # 2. 2024-01-11 이후 트랜잭션: 이자 500원, 세금 70원, 출금 1000원
    new_transactions = [
        {"account_id": acc.id, "asset_id": krw.id, "transaction_date": "2024-01-20", "type": "WITHDRAW", "total_amount": 1000, "currency": "KRW"},
        {"account_id": acc.id, "asset_id": krw.id, "transaction_date": "2024-01-25", "type": "INTEREST", "total_amount": 500, "currency": "KRW"},
        {"account_id": acc.id, "asset_id": krw.id, "transaction_date": "2024-01-25", "type": "TAX", "total_amount": 70, "currency": "KRW"},
    ]
    
    response = client.post("/api/db/snapshots/bank/calculate", json={
        "account_id": acc.id,
        "snapshot_date": "2024-01-31",
        "new_transactions": new_transactions
    })
    
    assert response.status_code == 200
    data = response.json()
    # 최종 잔액: 10000 - 1000 + 500 - 70 = 9430.0
    assert data["theoretical_krw"] == 9430.0
    assert data["period_deposit"] == -1000.0
    # 기간 손익 = 9430 - 10000(직전평가) - (-1000)(순입금) = 430.0 (이자 500 - 세금 70)
    assert data["period_profit"] == 430.0


def test_invalid_transaction_types_validation(setup_bank_account, db_session):
    acc, krw = setup_bank_account
    
    # FEE 또는 DIVIDEND 등 삭제/정의되지 않은 유형 입력 시 422 에러 확인
    for invalid_type in ["FEE", "DIVIDEND", "UNKNOWN"]:
        invalid_transaction = {
            "account_id": acc.id,
            "asset_id": krw.id,
            "transaction_date": "2024-01-15",
            "type": invalid_type,
            "total_amount": 100,
            "currency": "KRW"
        }
        
        response = client.post("/api/db/snapshots/bank/calculate", json={
            "account_id": acc.id,
            "snapshot_date": "2024-01-31",
            "new_transactions": [invalid_transaction]
        })
        assert response.status_code == 422


