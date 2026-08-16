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
    """전체 사용자 목록 조회 API 동작을 검증합니다."""
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
    """계좌 생성, 조회, 수정, 삭제(CRUD) 플로우를 검증합니다."""
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
    """자산 마스터 생성, 수정, 삭제 플로우를 검증합니다."""
    payload = {
        "ticker": "TEST_TICKER",
        "name": "Test Asset",
        "major_category": "일반주식",
        "sub_category": "국내주식",
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
    krw = Asset(ticker="KRW", name="원화", major_category="현금", sub_category="원화예수금", country="KR")
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
        "current_usd": 0,
        "exchange_rate": 1.0
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
    from src.backend.schemas import UnifiedSaveRequest, BrokerageSaveAccountRequest, BankSaveAccountRequest, TransactionSchema
    from src.backend.routers.snapshots import save_unified_snapshots
    import datetime
    
    today = datetime.date.today()

    # 1. 기초 자산 생성
    krw = Asset(ticker="KRW", name="원화", major_category="현금", sub_category="원화예수금", country="KR")
    usd = Asset(ticker="USD", name="달러", major_category="현금", sub_category="달러예수금", country="US")
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
    from src.backend.schemas import UnifiedSaveRequest, BankSaveAccountRequest
    from src.backend.routers.snapshots import save_unified_snapshots
    import datetime
    
    today = datetime.date.today()

    # 1. 기초 자산 생성
    krw = Asset(ticker="KRW", name="원화", major_category="현금", sub_category="원화예수금", country="KR")
    usd = Asset(ticker="USD", name="달러", major_category="현금", sub_category="달러예수금", country="US")
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


@pytest.mark.asyncio
async def test_preview_snapshots_excludes_initial_balance(db_session, test_user):
    """INITIAL_BALANCE 트랜잭션이 스냅샷의 period_deposit에 포함되지 않음을 검증합니다."""
    from src.backend.schemas import SaveSnapshotRequest
    from src.backend.routers.snapshots import preview_snapshots
    
    # 1. 기초 자산 생성
    krw = Asset(ticker="KRW", name="원화", major_category="현금", sub_category="원화예수금", country="KR")
    db_session.add(krw)
    db_session.flush()

    # 2. 계좌 생성
    acc = Account(user_id=test_user.id, name="테스트계좌", provider="테스트", account_type="BROKERAGE", is_active=True)
    db_session.add(acc)
    db_session.flush()

    # 3. INITIAL_BALANCE(초기 잔고) 및 DEPOSIT(추가 입금) 트랜잭션 생성
    db_session.add(Transaction(
        account_id=acc.id, asset_id=krw.id, transaction_date=date(2026, 5, 27),
        type="INITIAL_BALANCE", quantity=1000000.0, total_amount=1000000.0, currency="KRW"
    ))
    db_session.add(Transaction(
        account_id=acc.id, asset_id=krw.id, transaction_date=date(2026, 5, 28),
        type="DEPOSIT", quantity=200000.0, total_amount=200000.0, currency="KRW"
    ))
    db_session.commit()

    # 4. 스냅샷 미리보기 실행 (기준일 2026-05-28)
    req = SaveSnapshotRequest(
        snapshot_date=date(2026, 5, 28),
        exchange_rate=1350.0
    )
    previews = await preview_snapshots(req, db_session)

    # 5. 검증
    target_preview = next((p for p in previews if p.account_id == acc.id), None)
    assert target_preview is not None
    # period_deposit는 INITIAL_BALANCE가 제외된 200,000원이어야 합니다.
    assert target_preview.period_deposit == 200000.0


@pytest.mark.asyncio
async def test_save_unified_snapshots_saves_exchange_rate(db_session, test_user):
    """Unified 스냅샷 저장 시 입력받은 환율이 exchange_rates 테이블에 저장되는지 검증합니다."""
    from src.backend.schemas import UnifiedSaveRequest
    from src.backend.routers.snapshots import save_unified_snapshots
    from src.backend.models import ExchangeRate
    import datetime

    today = datetime.date.today()

    # 기초 자산 생성
    krw = Asset(ticker="KRW", name="원화", major_category="현금", sub_category="원화예수금", country="KR")
    usd = Asset(ticker="USD", name="달러", major_category="현금", sub_category="달러예수금", country="US")
    db_session.add_all([krw, usd])
    db_session.flush()

    req = UnifiedSaveRequest(
        snapshot_date=today,
        exchange_rate=1420.5,
        brokerage_accounts=[],
        bank_accounts=[]
    )

    # 기존 exchange_rates 데이터가 없는 상태에서 호출
    await save_unified_snapshots(req, db_session)

    # exchange_rates 조회
    saved_rate = db_session.query(ExchangeRate).filter(
        ExchangeRate.date == today,
        ExchangeRate.currency == "USD"
    ).first()

    assert saved_rate is not None
    assert saved_rate.rate == 1420.5


@pytest.mark.asyncio
async def test_save_unified_snapshots_updates_existing_exchange_rate(db_session, test_user):
    """Unified 스냅샷 저장 시 이미 동일 날짜/통화의 환율이 존재할 경우 업데이트되는지 검증합니다."""
    from src.backend.schemas import UnifiedSaveRequest
    from src.backend.routers.snapshots import save_unified_snapshots
    from src.backend.models import ExchangeRate
    import datetime

    today = datetime.date.today()

    # 기존 환율 미리 삽입
    old_rate = ExchangeRate(date=today, currency="USD", rate=1350.0)
    db_session.add(old_rate)
    db_session.commit()

    # 기초 자산 생성
    krw = Asset(ticker="KRW", name="원화", major_category="현금", sub_category="원화예수금", country="KR")
    usd = Asset(ticker="USD", name="달러", major_category="현금", sub_category="달러예수금", country="US")
    db_session.add_all([krw, usd])
    db_session.flush()

    req = UnifiedSaveRequest(
        snapshot_date=today,
        exchange_rate=1390.0,
        brokerage_accounts=[],
        bank_accounts=[]
    )

    await save_unified_snapshots(req, db_session)

    # exchange_rates 조회 (동일 날짜 데이터가 업데이트 되었는지 검증)
    saved_rate = db_session.query(ExchangeRate).filter(
        ExchangeRate.date == today,
        ExchangeRate.currency == "USD"
    ).first()

    assert saved_rate is not None
    assert saved_rate.rate == 1390.0


def test_delete_snapshots_by_date(db_session, test_user):
    """특정 날짜의 스냅샷 및 관련 CASH_ADJUSTMENT 거래를 일괄 삭제하는 API를 검증합니다."""
    # 1. 계좌 생성
    acc = Account(user_id=test_user.id, name="테스트계좌", provider="테스트", account_type="BROKERAGE", is_active=True)
    db_session.add(acc)
    db_session.flush()
    
    # 2. 기초 자산 생성
    krw = Asset(ticker="KRW", name="원화", major_category="현금", sub_category="원화예수금", country="KR")
    db_session.add(krw)
    db_session.flush()

    # 3. 스냅샷 데이터 생성
    target_date = date(2026, 6, 6)
    snap = AccountSnapshot(
        account_id=acc.id,
        snapshot_date=target_date,
        period_deposit=10000,
        total_valuation=100000,
        total_profit=5000
    )
    db_session.add(snap)

    # 4. 동일 날짜의 CASH_ADJUSTMENT 거래 생성
    tx_adjust = Transaction(
        account_id=acc.id,
        asset_id=krw.id,
        transaction_date=target_date,
        type="CASH_ADJUSTMENT",
        quantity=-5000,
        price=1.0,
        total_amount=-5000,
        currency="KRW"
    )
    # 다른 날짜의 CASH_ADJUSTMENT 거래 생성 (삭제 안 되어야 함)
    tx_other = Transaction(
        account_id=acc.id,
        asset_id=krw.id,
        transaction_date=date(2026, 6, 5),
        type="CASH_ADJUSTMENT",
        quantity=-3000,
        price=1.0,
        total_amount=-3000,
        currency="KRW"
    )
    db_session.add_all([tx_adjust, tx_other])
    db_session.commit()

    # 5. 삭제 API 호출
    tx_adjust_id = tx_adjust.id
    tx_other_id = tx_other.id

    response = client.delete(f"/api/db/snapshots/{target_date.isoformat()}")
    assert response.status_code == 200
    assert response.json()["message"] == f"Deleted snapshots and adjustments for {target_date.isoformat()}"

    # 6. 검증: 스냅샷이 삭제되었는지 확인
    snap_in_db = db_session.query(AccountSnapshot).filter_by(snapshot_date=target_date).first()
    assert snap_in_db is None

    # 7. 검증: 동일 날짜의 CASH_ADJUSTMENT 거래가 삭제되었는지 확인
    tx_adjust_in_db = db_session.query(Transaction).filter(Transaction.id == tx_adjust_id).first()
    assert tx_adjust_in_db is None

    # 8. 검증: 다른 날짜의 CASH_ADJUSTMENT 거래는 유지되는지 확인
    tx_other_in_db = db_session.query(Transaction).filter(Transaction.id == tx_other_id).first()
    assert tx_other_in_db is not None


def test_get_transactions_with_date_filters(db_session, test_user):
    """GET /api/db/transactions API의 start_date 및 end_date 필터 기능을 검증합니다."""
    # 1. 자산 생성 (유효한 카테고리 조합 사용)
    asset = Asset(ticker="BTC", name="비트코인", major_category="일반주식", sub_category="국내주식", country="KR")
    db_session.add(asset)
    db_session.flush()

    # 2. 계좌 생성
    acc = Account(user_id=test_user.id, name="테스트계좌", provider="테스트", account_type="BROKERAGE", is_active=True)
    db_session.add(acc)
    db_session.flush()

    # 3. 거래 내역 삽입
    tx1 = Transaction(
        account_id=acc.id, asset_id=asset.id, transaction_date=date(2026, 5, 10),
        type="BUY", quantity=1.0, price=100.0, total_amount=100.0, currency="KRW", memo="May Tx"
    )
    tx2 = Transaction(
        account_id=acc.id, asset_id=asset.id, transaction_date=date(2026, 6, 15),
        type="BUY", quantity=1.0, price=200.0, total_amount=200.0, currency="KRW", memo="June Tx"
    )
    tx3 = Transaction(
        account_id=acc.id, asset_id=asset.id, transaction_date=date(2026, 7, 20),
        type="BUY", quantity=1.0, price=300.0, total_amount=300.0, currency="KRW", memo="July Tx"
    )
    db_session.add_all([tx1, tx2, tx3])
    db_session.commit()

    # Case 1: 필터 없음 -> 모든 거래 반환
    response = client.get("/api/db/transactions")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 3
    # 생성된 3개가 포함되어 있고 asset_name, asset_ticker가 올바른지 확인
    filtered = [t for t in data if t["memo"] in ["May Tx", "June Tx", "July Tx"]]
    assert len(filtered) == 3
    assert all(t["asset_name"] == "비트코인" for t in filtered)
    assert all(t["asset_ticker"] == "BTC" for t in filtered)

    # Case 2: start_date 지정 -> 2026-06-01 이후 거래 (June, July)
    response = client.get("/api/db/transactions", params={"start_date": "2026-06-01"})
    assert response.status_code == 200
    data = response.json()
    filtered = [t for t in data if t["memo"] in ["May Tx", "June Tx", "July Tx"]]
    assert len(filtered) == 2
    assert any(t["memo"] == "June Tx" for t in filtered)
    assert any(t["memo"] == "July Tx" for t in filtered)

    # Case 3: end_date 지정 -> 2026-06-30 이전 거래 (May, June)
    response = client.get("/api/db/transactions", params={"end_date": "2026-06-30"})
    assert response.status_code == 200
    data = response.json()
    filtered = [t for t in data if t["memo"] in ["May Tx", "June Tx", "July Tx"]]
    assert len(filtered) == 2
    assert any(t["memo"] == "May Tx" for t in filtered)
    assert any(t["memo"] == "June Tx" for t in filtered)

    # Case 4: start_date & end_date 지정 -> 2026-06-01 ~ 2026-06-30 사이 거래 (June)
    response = client.get("/api/db/transactions", params={"start_date": "2026-06-01", "end_date": "2026-06-30"})
    assert response.status_code == 200
    data = response.json()
    filtered = [t for t in data if t["memo"] in ["May Tx", "June Tx", "July Tx"]]
    assert len(filtered) == 1
    assert filtered[0]["memo"] == "June Tx"

def test_create_transfer_transaction(db_session, test_user):
    """POST /api/db/transactions/transfer 호출 시 이체 쌍 트랜잭션(WITHDRAW, DEPOSIT)이 자동 생성되는지 검증합니다."""
    asset = Asset(ticker="KRW", name="원화예수금", major_category="일반주식", sub_category="국내주식", country="KR")
    acc_src = Account(user_id=test_user.id, name="출발계좌", provider="은행A", account_type="BANK", is_active=True)
    acc_dst = Account(user_id=test_user.id, name="도착계좌", provider="은행B", account_type="BANK", is_active=True)
    db_session.add_all([asset, acc_src, acc_dst])
    db_session.commit()

    payload = {
        "source_account_id": acc_src.id,
        "target_account_id": acc_dst.id,
        "asset_id": asset.id,
        "amount": 50000.0,
        "transaction_date": "2026-08-01",
        "memo": "용돈 이체"
    }
    response = client.post("/api/db/transactions/transfer", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2

    tx_src = next(t for t in data if t["account_id"] == acc_src.id)
    tx_dst = next(t for t in data if t["account_id"] == acc_dst.id)

    assert tx_src["type"] == "WITHDRAW"
    assert tx_src["total_amount"] == 50000.0
    assert tx_src["quantity"] == 50000.0
    assert tx_src["price"] == 1.0
    assert tx_src["transfer_pair_id"] is not None

    assert tx_dst["type"] == "DEPOSIT"
    assert tx_dst["total_amount"] == 50000.0
    assert tx_dst["quantity"] == 50000.0
    assert tx_dst["price"] == 1.0
    assert tx_dst["transfer_pair_id"] == tx_src["transfer_pair_id"]

def test_delete_transfer_transaction_cascade(db_session, test_user):
    """이체 트랜잭션 삭제 시 동일 transfer_pair_id를 가진 상대방 트랜잭션도 함께 삭제되는지 검증합니다."""
    asset = Asset(ticker="KRW2", name="원화예수금2", major_category="일반주식", sub_category="국내주식", country="KR")
    acc_src = Account(user_id=test_user.id, name="출발계좌2", provider="은행A", account_type="BANK", is_active=True)
    acc_dst = Account(user_id=test_user.id, name="도착계좌2", provider="은행B", account_type="BANK", is_active=True)
    db_session.add_all([asset, acc_src, acc_dst])
    db_session.commit()

    payload = {
        "source_account_id": acc_src.id,
        "target_account_id": acc_dst.id,
        "asset_id": asset.id,
        "amount": 30000.0,
        "transaction_date": "2026-08-02",
        "memo": "이체 삭제 테스트"
    }
    res = client.post("/api/db/transactions/transfer", json=payload)
    assert res.status_code == 200
    created_txs = res.json()
    tx_id = created_txs[0]["id"]

    # 삭제
    del_res = client.delete(f"/api/db/transactions/{tx_id}")
    assert del_res.status_code == 200

    # DB 확인: 두 거래 모두 삭제되어야 함
    pair_id = created_txs[0]["transfer_pair_id"]
    remaining = db_session.query(Transaction).filter(Transaction.transfer_pair_id == pair_id).all()
    assert len(remaining) == 0

def test_update_transfer_transaction_cascade(db_session, test_user):
    """이체 트랜잭션 수정 시 동일 transfer_pair_id를 가진 상대방 트랜잭션도 금액/일자/메모가 자동 수정되는지 검증합니다."""
    asset = Asset(ticker="KRW3", name="원화예수금3", major_category="일반주식", sub_category="국내주식", country="KR")
    acc_src = Account(user_id=test_user.id, name="출발계좌3", provider="은행A", account_type="BANK", is_active=True)
    acc_dst = Account(user_id=test_user.id, name="도착계좌3", provider="은행B", account_type="BANK", is_active=True)
    db_session.add_all([asset, acc_src, acc_dst])
    db_session.commit()

    payload = {
        "source_account_id": acc_src.id,
        "target_account_id": acc_dst.id,
        "asset_id": asset.id,
        "amount": 20000.0,
        "transaction_date": "2026-08-01",
        "memo": "변경전 이체"
    }
    res = client.post("/api/db/transactions/transfer", json=payload)
    assert res.status_code == 200
    created_txs = res.json()
    src_tx = next(t for t in created_txs if t["account_id"] == acc_src.id)

    # 수정 payload (출금 트랜잭션 업데이트)
    update_payload = dict(src_tx)
    update_payload["total_amount"] = 25000.0
    update_payload["transaction_date"] = "2026-08-03"
    update_payload["memo"] = "변경후 이체"

    put_res = client.put(f"/api/db/transactions/{src_tx['id']}", json=update_payload)
    assert put_res.status_code == 200

    # DB 확인: 상대방 입금 거래도 25000.0, 2026-08-03, "변경후 이체"로 수정되어야 함
    pair_id = src_tx["transfer_pair_id"]
    updated_pair = db_session.query(Transaction).filter(Transaction.transfer_pair_id == pair_id).all()
    assert len(updated_pair) == 2
    assert all(t.total_amount == 25000.0 for t in updated_pair)
    assert all(str(t.transaction_date) == "2026-08-03" for t in updated_pair)
    assert all(t.memo == "변경후 이체" for t in updated_pair)

def _create_test_asset_and_account(db_session, user_id: int, suffix: str):
    """테스트용 자산 및 계좌를 생성하는 헬퍼 함수입니다."""
    asset = Asset(ticker=f"SRC_TEST_{suffix}", name=f"출처테스트자산_{suffix}", major_category="일반주식", sub_category="국내주식", country="KR")
    account = Account(user_id=user_id, name=f"출처테스트계좌_{suffix}", provider="키움증권", account_type="BROKERAGE", is_active=True)
    db_session.add_all([asset, account])
    db_session.commit()
    db_session.refresh(asset)
    db_session.refresh(account)
    return asset, account


def test_get_transactions_includes_source_and_external_id(db_session, test_user):
    """GET /api/db/transactions 호출 시 source 및 external_id 필드가 정상 직렬화되는지 검증합니다."""
    asset, account = _create_test_asset_and_account(db_session, test_user.id, "1")

    tx = Transaction(
        account_id=account.id,
        asset_id=asset.id,
        transaction_date=date(2026, 8, 3),
        type="BUY",
        quantity=10.0,
        price=50000.0,
        total_amount=500000.0,
        currency="KRW",
        memo="키움 자동저장 (체결)",
        source="AUTO_KIWOOM",
        external_id="EXT12345"
    )
    db_session.add(tx)
    db_session.commit()

    res = client.get("/api/db/transactions")
    assert res.status_code == 200
    tx_list = res.json()
    target_tx = next((t for t in tx_list if t["id"] == tx.id), None)
    assert target_tx is not None
    assert target_tx["source"] == "AUTO_KIWOOM"
    assert target_tx["external_id"] == "EXT12345"


def test_create_transaction_default_source_is_manual(db_session, test_user):
    """POST /api/db/transactions 호출 시 source 미지정할 경우 기본값 'MANUAL'로 보정되는지 검증합니다."""
    asset, account = _create_test_asset_and_account(db_session, test_user.id, "2")

    payload = {
        "account_id": account.id,
        "asset_id": asset.id,
        "transaction_date": "2026-08-03",
        "type": "BUY",
        "quantity": 5.0,
        "price": 50000.0,
        "total_amount": 250000.0,
        "currency": "KRW"
    }
    post_res = client.post("/api/db/transactions", json=payload)
    assert post_res.status_code == 200
    post_data = post_res.json()
    assert post_data["source"] == "MANUAL"


def test_create_transaction_with_custom_source_and_external_id(db_session, test_user):
    """POST /api/db/transactions 호출 시 커스텀 source 및 external_id 전달 및 직렬화를 검증합니다."""
    asset, account = _create_test_asset_and_account(db_session, test_user.id, "3")

    payload_auto = {
        "account_id": account.id,
        "asset_id": asset.id,
        "transaction_date": "2026-08-03",
        "type": "BUY",
        "quantity": 2.0,
        "price": 100000.0,
        "total_amount": 200000.0,
        "currency": "KRW",
        "source": "AUTO_KIWOOM",
        "external_id": "EXT99999"
    }
    post_auto_res = client.post("/api/db/transactions", json=payload_auto)
    assert post_auto_res.status_code == 200
    post_auto_data = post_auto_res.json()
    assert post_auto_data["source"] == "AUTO_KIWOOM"
    assert post_auto_data["external_id"] == "EXT99999"



