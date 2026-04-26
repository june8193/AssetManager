import pytest
from fastapi.testclient import TestClient
from datetime import date
from src.backend.main import app
from src.backend.models import Account, Transaction, Asset

client = TestClient(app)

@pytest.fixture
def setup_bank_account(db_session):
    # 1. KRW 자산 생성
    krw = Asset(ticker="KRW", name="원화", major_category="CASH", sub_category="CASH", country="KR")
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
    
    # 새로운 트랜잭션 시뮬레이션: 입금 5000, 출금 2000, 이자 100, 세금 15
    new_transactions = [
        {"account_id": acc.id, "asset_id": krw.id, "transaction_date": "2024-01-15", "type": "DEPOSIT", "total_amount": 5000, "currency": "KRW"},
        {"account_id": acc.id, "asset_id": krw.id, "transaction_date": "2024-01-16", "type": "WITHDRAW", "total_amount": 2000, "currency": "KRW"},
        {"account_id": acc.id, "asset_id": krw.id, "transaction_date": "2024-01-17", "type": "INTEREST", "total_amount": 100, "currency": "KRW"},
        {"account_id": acc.id, "asset_id": krw.id, "transaction_date": "2024-01-17", "type": "TAX", "total_amount": 15, "currency": "KRW"},
    ]
    
    response = client.post("/api/db/snapshots/bank/calculate", json={
        "account_id": acc.id,
        "snapshot_date": "2024-01-31",
        "new_transactions": new_transactions
    })
    
    assert response.status_code == 200
    data = response.json()
    # 계산: 10000 + 5000 - 2000 + 100 - 15 = 13085
    assert data["theoretical_krw"] == 13085.0
