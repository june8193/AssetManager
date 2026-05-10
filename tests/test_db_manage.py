import pytest
from fastapi.testclient import TestClient
from datetime import date
from src.backend.main import app
from src.backend.models import User, Account, AccountSnapshot, Transaction, Asset

client = TestClient(app)

@pytest.fixture
def test_user(db_session):
    """테스트용 유저를 생성합니다."""
    user = User(name="Test User")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

def test_get_users(test_user):
    response = client.get("/api/db/users")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert any(u["name"] == "Test User" for u in data)

def test_get_accounts_includes_user_name(db_session, test_user):
    """계좌 목록 조회 시 소유자 이름(user_name)이 포함되어 있는지 확인합니다."""
    # 계좌 생성
    account = Account(
        user_id=test_user.id,
        name="TEST-ACC-NAME",
        provider="TestProvider",
        account_type="BROKERAGE",
        is_active=True
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)

    # API 호출
    response = client.get("/api/db/accounts")
    assert response.status_code == 200
    
    data = response.json()
    assert len(data) >= 1
    
    # 생성한 계좌 찾기
    target_acc = next((a for a in data if a["id"] == account.id), None)
    assert target_acc is not None
    
    # user_name 필드가 있고, 올바른 값이 들어있는지 확인
    assert "user_name" in target_acc
    assert target_acc["user_name"] == "Test User"

def test_create_and_get_account(test_user):
    user_id = test_user.id

    # 계좌 생성
    payload = {
        "user_id": user_id,
        "name": "TEST-ACC-123",
        "provider": "TestBank",
        "alias": "TestAlias",
        "account_type": "BROKERAGE",
        "is_active": True
    }
    response = client.post("/api/db/accounts", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "TEST-ACC-123"
    assert data["account_type"] == "BROKERAGE"
    account_id = data["id"]

    # 목록 조회 확인
    get_res = client.get("/api/db/accounts")
    assert any(a["id"] == account_id for a in get_res.json())

    # 수정 (은행으로 변경)
    payload["name"] = "UPDATED-ACC"
    payload["account_type"] = "BANK"
    put_res = client.put(f"/api/db/accounts/{account_id}", json=payload)
    assert put_res.status_code == 200
    assert put_res.json()["name"] == "UPDATED-ACC"
    assert put_res.json()["account_type"] == "BANK"

    # 삭제
    del_res = client.delete(f"/api/db/accounts/{account_id}")
    assert del_res.status_code == 200

def test_create_and_get_asset():
    payload = {
        "ticker": "TEST_TICKER",
        "name": "Test Asset",
        "major_category": "Stock",
        "sub_category": "Domestic",
        "country": "KR"
    }
    response = client.post("/api/db/assets", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["ticker"] == "TEST_TICKER"
    asset_id = data["id"]

    # 수정
    payload["name"] = "Updated Asset"
    put_res = client.put(f"/api/db/assets/{asset_id}", json=payload)
    assert put_res.status_code == 200
    assert put_res.json()["name"] == "Updated Asset"

    # 삭제
    client.delete(f"/api/db/assets/{asset_id}")

def test_get_snapshots():
    response = client.get("/api/db/snapshots")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_get_latest_snapshot_date(db_session, test_user):
    """최신 스냅샷 날짜 API를 테스트합니다."""
    # 계좌 생성
    account = Account(user_id=test_user.id, name="Test Account", provider="Test Provider", account_type="BANK")
    db_session.add(account)
    db_session.commit()
    
    from datetime import date
    # 두 개의 스냅샷 생성 (날짜가 다름)
    snap1 = AccountSnapshot(account_id=account.id, snapshot_date=date(2023, 1, 1), total_valuation=1000)
    snap2 = AccountSnapshot(account_id=account.id, snapshot_date=date(2023, 2, 1), total_valuation=2000)
    db_session.add_all([snap1, snap2])
    db_session.commit()
    
    response = client.get("/api/db/snapshots/latest")
    assert response.status_code == 200
    data = response.json()
    assert data["latest_date"] == "2023-02-01"

def test_get_latest_snapshot_date_empty(db_session):
    """스냅샷이 없을 때 최신 날짜 API를 테스트합니다."""
    # 모든 스냅샷 삭제
    db_session.query(AccountSnapshot).delete()
    db_session.commit()
    
    response = client.get("/api/db/snapshots/latest")
    assert response.status_code == 200
    data = response.json()
    assert data["latest_date"] is None

def test_calculate_returns_existing_transactions(db_session, test_user):
    """계산 API가 마지막 스냅샷 이후의 기존 트랜잭션을 반환하는지 테스트합니다."""
    # 1. KRW 자산 생성
    krw = Asset(ticker="KRW", name="원화", major_category="CASH", sub_category="CASH", country="KR")
    db_session.add(krw)
    db_session.flush()
    
    # 2. 계좌 생성
    acc = Account(user_id=test_user.id, name="테스트계좌", provider="테스트", account_type="BROKERAGE", is_active=True)
    db_session.add(acc)
    db_session.flush()
    
    # 3. 과거 트랜잭션 (첫 번째 스냅샷 이전)
    db_session.add(Transaction(
        account_id=acc.id, asset_id=krw.id, transaction_date=date(2023, 12, 15),
        type="DEPOSIT", total_amount=10000, currency="KRW"
    ))
    
    # 4. 첫 번째 스냅샷 (2024-01-01)
    db_session.add(AccountSnapshot(
        account_id=acc.id, snapshot_date=date(2024, 1, 1),
        period_deposit=10000, total_valuation=10000, total_profit=0
    ))
    
    # 5. 새로운 트랜잭션 (첫 번째 스냅샷 이후, 두 번째 계산 이전)
    db_session.add(Transaction(
        account_id=acc.id, asset_id=krw.id, transaction_date=date(2024, 1, 15),
        type="DEPOSIT", total_amount=5000, currency="KRW", memo="Middle Transaction"
    ))
    
    db_session.commit()

    # 증권 계좌 테스트
    response = client.post("/api/db/snapshots/brokerage/calculate", json={
        "account_id": acc.id,
        "snapshot_date": "2024-01-31",
        "new_transactions": [],
        "current_krw": 15000,
        "current_usd": 0
    })
    assert response.status_code == 200
    data = response.json()
    assert len(data["existing_transactions"]) == 1
    assert data["existing_transactions"][0]["memo"] == "Middle Transaction"

    # 은행 계좌 테스트를 위해 타입 변경
    acc.account_type = "BANK"
    db_session.commit()

    response = client.post("/api/db/snapshots/bank/calculate", json={
        "account_id": acc.id,
        "snapshot_date": "2024-01-31",
        "new_transactions": []
    })
    assert response.status_code == 200
    data = response.json()
    assert len(data["existing_transactions"]) == 1
    assert data["existing_transactions"][0]["memo"] == "Middle Transaction"

@pytest.mark.asyncio
async def test_save_unified_snapshots_integration(db_session, test_user):
    """통합 스냅샷 저장 API가 증권 및 은행 계좌를 올바르게 처리하는지 테스트합니다."""
    from src.backend.routers.db_manage import save_unified_snapshots, UnifiedSaveRequest, BrokerageSaveAccountRequest, BankSaveAccountRequest, TransactionSchema
    import datetime
    
    today = datetime.date.today()

    # 1. 기초 자산 생성
    krw = Asset(ticker="KRW", name="원화", major_category="현금", sub_category="현금", country="KR")
    usd = Asset(ticker="USD", name="달러", major_category="현금", sub_category="현금", country="US")
    db_session.add_all([krw, usd])
    db_session.flush()

    # 2. 계좌 생성
    brokerage_acc = Account(user_id=test_user.id, name="증권계좌", provider="KB", account_type="BROKERAGE")
    bank_acc = Account(user_id=test_user.id, name="은행계좌", provider="신한", account_type="BANK")
    db_session.add_all([brokerage_acc, bank_acc])
    db_session.commit()

    # 증권 계좌 요청 데이터
    brokerage_req = BrokerageSaveAccountRequest(
        account_id=brokerage_acc.id,
        new_transactions=[
            TransactionSchema(
                account_id=brokerage_acc.id, asset_id=0, transaction_date=today, 
                type="DEPOSIT", total_amount=100000, currency="KRW"
            )
        ],
        diff_krw=5000,
        diff_usd=0
    )

    # 은행 계좌 요청 데이터
    bank_req = BankSaveAccountRequest(
        account_id=bank_acc.id,
        new_transactions=[
            TransactionSchema(
                account_id=bank_acc.id, asset_id=0, transaction_date=today, 
                type="INTEREST", total_amount=1000, currency="KRW"
            )
        ],
        total_valuation=500000.0
    )

    req = UnifiedSaveRequest(
        snapshot_date=today,
        exchange_rate=1350.0,
        brokerage_accounts=[brokerage_req],
        bank_accounts=[bank_req]
    )

    # API 실행
    await save_unified_snapshots(req, db_session)

    # 검증: 트랜잭션 및 스냅샷 확인
    txs = db_session.query(Transaction).all()
    assert len(txs) >= 3
    
    snaps = db_session.query(AccountSnapshot).filter(AccountSnapshot.snapshot_date == today).all()
    assert len(snaps) == 2

@pytest.mark.asyncio
async def test_save_unified_snapshots_bank_none_valuation(db_session, test_user):
    """은행 계좌의 total_valuation이 None일 경우 계산된 값을 사용하는지 테스트합니다."""
    from src.backend.routers.db_manage import save_unified_snapshots, UnifiedSaveRequest, BankSaveAccountRequest
    import datetime
    
    today = datetime.date.today()

    # 1. 기초 자산 생성
    krw = Asset(ticker="KRW", name="원화", major_category="현금", sub_category="현금", country="KR")
    usd = Asset(ticker="USD", name="달러", major_category="현금", sub_category="현금", country="US")
    db_session.add_all([krw, usd])
    db_session.flush()

    # 2. 계좌 생성
    bank_acc = Account(user_id=test_user.id, name="은행계좌", provider="신한", account_type="BANK")
    db_session.add(bank_acc)
    db_session.commit()

    # 은행 계좌에 초기 잔액 추가
    db_session.add(Transaction(
        account_id=bank_acc.id, asset_id=krw.id, transaction_date=today,
        type="INITIAL_BALANCE", quantity=300000, total_amount=300000, currency="KRW"
    ))
    db_session.commit()

    bank_req = BankSaveAccountRequest(
        account_id=bank_acc.id,
        new_transactions=[],
        total_valuation=None
    )

    req = UnifiedSaveRequest(
        snapshot_date=today,
        exchange_rate=1350.0,
        brokerage_accounts=[],
        bank_accounts=[bank_req]
    )

    await save_unified_snapshots(req, db_session)

    bank_snap = db_session.query(AccountSnapshot).filter(
        AccountSnapshot.account_id == bank_acc.id,
        AccountSnapshot.snapshot_date == today
    ).first()
    
    assert bank_snap.total_valuation == 300000
