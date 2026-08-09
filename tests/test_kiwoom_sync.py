import datetime
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from src.backend.main import app
from src.backend.models import Account, Asset, Transaction, User
from src.backend.services.kiwoom_sync_service import KiwoomTransactionService, _parse_traded_at

client = TestClient(app)

@pytest.fixture
def setup_test_data(db_session: Session):
    # 1. 테스트 유저 생성
    user = User(name="홍길동")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    # 2. 키움증권 계좌 2개 생성
    account1 = Account(
        user_id=user.id,
        name="5526-9093",
        provider="키움증권",
        alias="일반주식",
        account_type="BROKERAGE"
    )
    account2 = Account(
        user_id=user.id,
        name="6066-7729",
        provider="키움증권",
        alias="미국주식",
        account_type="BROKERAGE"
    )
    db_session.add_all([account1, account2])
    
    # 3. 테스트용 등록 자산 생성
    samsung = Asset(
        ticker="005930",
        name="삼성전자",
        major_category="일반주식",
        sub_category="국내주식",
        country="KR"
    )
    apple = Asset(
        ticker="AAPL",
        name="Apple",
        major_category="일반주식",
        sub_category="해외주식",
        country="US"
    )
    macquarie = Asset(
        ticker="001230",
        name="맥쿼리인프라",
        major_category="배당주",
        sub_category="국내배당주",
        country="KR"
    )
    db_session.add_all([samsung, apple, macquarie])
    db_session.commit()
    
    return {
        "user": user,
        "accounts": {
            "5526-9093": account1,
            "6066-7729": account2
        },
        "assets": {
            "005930": samsung,
            "AAPL": apple,
            "001230": macquarie
        }
    }

@pytest.mark.asyncio
@patch("src.backend.services.kiwoom_sync_service.KiwoomAuthManager")
@patch("httpx.AsyncClient.post")
async def test_sync_transactions_multi_accounts(
    mock_post, mock_auth_class, db_session: Session, setup_test_data
):
    """다중 계좌별 토큰 스위칭 조회 및 분리 적재 시나리오를 테스트합니다."""
    # Auth Manager Mock
    mock_auth = mock_auth_class.return_value
    mock_auth.base_url = "https://api.kiwoom.com"
    
    # 계좌별 다른 토큰 반환 모의
    async def mock_get_token(account_name=None):
        if account_name == "5526-9093":
            return "token_5526"
        elif account_name == "6066-7729":
            return "token_6066"
        return "default_token"
    mock_auth.get_valid_token = mock_get_token

    # API Response Mocking (토큰 헤더에 따라 다르게 반환)
    # - token_5526: 국내체결(삼성전자 10주 매수), 배당금(맥쿼리 15000원 입금)
    # - token_6066: 미국체결(Apple 5주 매도, NVDA 3주 매수)
    def mock_api_responses(url, *args, **kwargs):
        headers = kwargs.get("headers", {})
        api_id = headers.get("api-id")
        auth_header = headers.get("authorization", "")
        
        mock_response = AsyncMock()
        mock_response.status_code = 200
        
        if auth_header == "Bearer token_5526":
            if api_id == "ka10076": # 국내 체결
                mock_response.json = lambda: {
                    "return_code": 0,
                    "cntr": [
                        {
                            "stk_cd": "005930",
                            "stk_nm": "삼성전자",
                            "io_tp_nm": "+매수",
                            "cntr_pric": 72000,
                            "cntr_qty": 10,
                            "ord_stt": "체결"
                        }
                    ]
                }
            elif api_id == "ust21510": # 미국 체결 없음
                mock_response.json = lambda: {"return_code": 0, "result_list": []}
            elif api_id == "kt00015": # 배당금
                mock_response.json = lambda: {
                    "return_code": 0,
                    "trst_ovrl_trde_prps_array": [
                        {
                            "trde_dt": "20260719",
                            "rmrk_nm": "배당금",
                            "stk_cd": "001230",
                            "stk_nm": "맥쿼리인프라",
                            "trde_amt": 15000,
                            "trde_qty_jwa_cnt": 0,
                            "exct_amt": 15000,
                            "cmsn": 0
                        }
                    ]
                }
        elif auth_header == "Bearer token_6066":
            if api_id == "ka10076": # 국내 체결 없음
                mock_response.json = lambda: {"return_code": 0, "cntr": []}
            elif api_id == "ust21510": # 미국 체결
                mock_response.json = lambda: {
                    "return_code": 0,
                    "result_list": [
                        {
                            "stk_cd": "AAPL",
                            "frgn_stk_nm": "Apple",
                            "slby_tp": "1",
                            "slby_tp_nm": "매도",
                            "cntr_uv": "185.0",
                            "cntr_qty": "5",
                            "ord_stat": "체결완료"
                        },
                        {
                            "stk_cd": "NVDA", # 미등록 자산
                            "frgn_stk_nm": "NVIDIA",
                            "slby_tp": "2",
                            "slby_tp_nm": "매수",
                            "cntr_uv": "120.0",
                            "cntr_qty": "3",
                            "ord_stat": "체결완료"
                        }
                    ]
                }
            elif api_id == "kt00015": # 배당 없음
                mock_response.json = lambda: {"return_code": 0, "trst_ovrl_trde_prps_array": []}
        else:
            mock_response.json = lambda: {"return_code": -1, "return_msg": "Unknown Token"}
            
        return mock_response

    mock_post.side_effect = mock_api_responses

    service = KiwoomTransactionService()
    
    # 동기화 시도 (두 계좌 모두 동기화가 순차적으로 구동되어야 함)
    result = await service.sync_transactions(db_session, days=1)
    
    assert result["status"] == "success"
    # 총 성공건수 = account1(삼성 매수 1 + 맥쿼리 배당 1) + account2(Apple 매도 1) = 3
    # 총 보류건수 = account2(NVDA 매수 1) = 1
    assert result["success_count"] == 3
    assert result["pending_count"] == 1
    
    # DB 저장 분리 검증
    acc1 = setup_test_data["accounts"]["5526-9093"]
    acc2 = setup_test_data["accounts"]["6066-7729"]
    
    txs_acc1 = db_session.query(Transaction).filter(Transaction.account_id == acc1.id).all()
    assert len(txs_acc1) == 2
    
    txs_acc2 = db_session.query(Transaction).filter(Transaction.account_id == acc2.id).all()
    assert len(txs_acc2) == 1
    assert txs_acc2[0].asset.ticker == "AAPL"

    # 중복 저장 방지 검증 (동일 데이터로 재호출 시 두 계좌 모두 추가 적재 건수가 0이어야 함)
    result_second = await service.sync_transactions(db_session, days=1)
    assert result_second["success_count"] == 0


@pytest.mark.asyncio
@patch("src.backend.services.kiwoom_sync_service.KiwoomTransactionService.sync_transactions")
async def test_sync_transactions_api_endpoint(mock_sync):
    """FastAPI 라우터 엔드포인트 호출을 검증합니다."""
    mock_sync.return_value = {
        "status": "success",
        "success_count": 2,
        "pending_count": 0,
        "synced_transactions": [],
        "unregistered_assets": []
    }
    
    response = client.post("/api/kiwoom/sync-transactions?days=7")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["success_count"] == 2
    mock_sync.assert_called_once()


@pytest.mark.asyncio
@patch("src.backend.services.kiwoom_sync_service.KiwoomAuthManager.get_valid_token")
async def test_sync_transactions_account_failure_reporting(mock_get_token, setup_test_data, db_session: Session):
    """특정 계좌 동기화 중 예외 발생 시 failed_accounts 목록에 담겨 반환되는지 검증합니다."""
    # 토큰 발급 시 예외 발생시킴
    mock_get_token.side_effect = Exception("인증 토큰 오류 발생")

    service = KiwoomTransactionService()
    result = await service.sync_transactions(db_session, days=1)

    assert result["status"] == "success"
    assert "failed_accounts" in result
    assert len(result["failed_accounts"]) == 2
    assert result["failed_accounts"][0]["account_name"] == "5526-9093"
    assert "인증 토큰 오류 발생" in result["failed_accounts"][0]["error"]


@pytest.mark.asyncio
@patch("src.backend.services.kiwoom_sync_service.KiwoomAuthManager")
@patch("httpx.AsyncClient.post")
async def test_sync_with_a_prefix_ticker(
    mock_post, mock_auth_class, db_session: Session, setup_test_data
):
    """국내 주식 종목코드에 'A' 접두사(예: A005930)가 포함된 경우 DB의 등록 자산(005930)과 매칭되어 저장되는지 테스트합니다."""
    mock_auth = mock_auth_class.return_value
    mock_auth.base_url = "https://api.kiwoom.com"
    mock_auth.get_valid_token = AsyncMock(return_value="token_test")

    def mock_api_responses(url, *args, **kwargs):
        headers = kwargs.get("headers", {})
        api_id = headers.get("api-id")
        mock_response = AsyncMock()
        mock_response.raise_for_status = lambda: None

        if api_id == "ka10076":
            mock_response.json = lambda: {
                "return_code": 0,
                "cntr": [
                    {
                        "stk_cd": "A005930",
                        "stk_nm": "삼성전자",
                        "io_tp_nm": "매수",
                        "cntr_qty": "5",
                        "cntr_pric": "70000"
                    }
                ]
            }
        elif api_id == "ust21510":
            mock_response.json = lambda: {"return_code": 0, "cntr": []}
        else:
            mock_response.json = lambda: {"return_code": 0, "cntr": []}

        return mock_response

    mock_post.side_effect = mock_api_responses

    service = KiwoomTransactionService()
    result = await service.sync_transactions(db_session, days=1)

    assert result["status"] == "success"
    assert result["success_count"] == 2
    assert result["pending_count"] == 0
    assert len(result["unregistered_assets"]) == 0
    assert result["synced_transactions"][0]["asset_name"] == "삼성전자"


@pytest.mark.asyncio
@patch("src.backend.services.kiwoom_sync_service.KiwoomAuthManager")
@patch("httpx.AsyncClient.post")
async def test_sync_binding_manual_transaction(
    mock_post, mock_auth_class, db_session: Session, setup_test_data
):
    """기존 수동 등록 거래(external_id=None)가 있을 때 키움 체결 데이터 수신 시 1:1 매칭(바인딩)되는지 테스트합니다."""
    import datetime

    mock_auth = mock_auth_class.return_value
    mock_auth.base_url = "https://api.kiwoom.com"
    mock_auth.get_valid_token = AsyncMock(return_value="token_test")

    acc1 = setup_test_data["accounts"]["5526-9093"]
    samsung = setup_test_data["assets"]["005930"]

    # 수동 거래 사전 생성
    manual_tx = Transaction(
        account_id=acc1.id,
        asset_id=samsung.id,
        transaction_date=datetime.date.today(),
        type="BUY",
        quantity=10.0,
        price=70000.0,
        total_amount=700000.0,
        currency="KRW",
        source="MANUAL",
        external_id=None,
        memo="수동 입력 거래"
    )
    db_session.add(manual_tx)
    db_session.commit()

    def mock_api_responses(url, *args, **kwargs):
        headers = kwargs.get("headers", {})
        api_id = headers.get("api-id")
        mock_response = AsyncMock()
        mock_response.raise_for_status = lambda: None

        if api_id == "ka10076":
            mock_response.json = lambda: {
                "return_code": 0,
                "cntr": [
                    {
                        "ord_no": "ORD_001",
                        "stk_cd": "005930",
                        "stk_nm": "삼성전자",
                        "io_tp_nm": "매수",
                        "cntr_qty": "10",
                        "cntr_pric": "70000"
                    }
                ]
            }
        else:
            mock_response.json = lambda: {"return_code": 0, "cntr": []}

        return mock_response

    mock_post.side_effect = mock_api_responses

    service = KiwoomTransactionService()
    result = await service.sync_transactions(db_session, days=1)

    assert result["status"] == "success"
    db_session.refresh(manual_tx)
    assert manual_tx.source == "AUTO_KIWOOM"
    assert manual_tx.external_id == "ORD_001"


@pytest.mark.asyncio
@patch("src.backend.services.kiwoom_sync_service.KiwoomAuthManager")
@patch("httpx.AsyncClient.post")
async def test_sync_split_executions(
    mock_post, mock_auth_class, db_session: Session, setup_test_data
):
    """동일 일자/종목/수량/단가로 2개의 다른 체결번호가 수신될 때 분할 매매가 누락 없이 각각 저장되는지 테스트합니다."""
    mock_auth = mock_auth_class.return_value
    mock_auth.base_url = "https://api.kiwoom.com"
    mock_auth.get_valid_token = AsyncMock(return_value="token_test")

    def mock_api_responses(url, *args, **kwargs):
        headers = kwargs.get("headers", {})
        api_id = headers.get("api-id")
        mock_response = AsyncMock()
        mock_response.raise_for_status = lambda: None

        if api_id == "ka10076":
            mock_response.json = lambda: {
                "return_code": 0,
                "cntr": [
                    {
                        "ord_no": "SPLIT_001",
                        "stk_cd": "005930",
                        "stk_nm": "삼성전자",
                        "io_tp_nm": "매수",
                        "cntr_qty": "10",
                        "cntr_pric": "70000"
                    },
                    {
                        "ord_no": "SPLIT_002",
                        "stk_cd": "005930",
                        "stk_nm": "삼성전자",
                        "io_tp_nm": "매수",
                        "cntr_qty": "10",
                        "cntr_pric": "70000"
                    }
                ]
            }
        else:
            mock_response.json = lambda: {"return_code": 0, "cntr": []}

        return mock_response

    mock_post.side_effect = mock_api_responses

    service = KiwoomTransactionService()
    result = await service.sync_transactions(db_session, days=1)

    assert result["status"] == "success"
    # 계좌 2개 x 분할매수 2건 = 총 4건
    assert result["success_count"] == 4
    
    acc1 = setup_test_data["accounts"]["5526-9093"]
    txs = db_session.query(Transaction).filter(Transaction.account_id == acc1.id).all()
    assert len(txs) == 2
    ext_ids = {t.external_id for t in txs}
    assert ext_ids == {"SPLIT_001", "SPLIT_002"}




@pytest.mark.asyncio
@patch("src.backend.services.kiwoom_sync_service.KiwoomAuthManager")
@patch("httpx.AsyncClient.post")
async def test_sync_transactions_traded_at_field(
    mock_post, mock_auth_class, db_session: Session, setup_test_data
):
    """동기화 결과(synced_transactions 및 unregistered_assets)에 traded_at 필드가 날짜/시간 포맷으로 포함되는지 검증합니다."""
    mock_auth = mock_auth_class.return_value
    mock_auth.base_url = "https://api.kiwoom.com"
    mock_auth.get_valid_token = AsyncMock(return_value="token_traded_at")

    def mock_api_responses(url, *args, **kwargs):
        headers = kwargs.get("headers", {})
        api_id = headers.get("api-id")
        
        mock_response = AsyncMock()
        mock_response.status_code = 200
        
        if api_id == "ka10076": # 국내 체결 (시간 14:30:15 포함)
            mock_response.json = lambda: {
                "return_code": 0,
                "cntr": [
                    {
                        "stk_cd": "005930",
                        "stk_nm": "삼성전자",
                        "io_tp_nm": "+매수",
                        "cntr_pric": 72000,
                        "cntr_qty": 10,
                        "cntr_tm": "143015"
                    }
                ]
            }
        elif api_id == "ust21510": # 미국 체결 (미등록 종목, 시간 22:15:00 포함)
            mock_response.json = lambda: {
                "return_code": 0,
                "result_list": [
                    {
                        "stk_cd": "NVDA",
                        "frgn_stk_nm": "NVIDIA",
                        "slby_tp": "2",
                        "slby_tp_nm": "매수",
                        "cntr_uv": "120.0",
                        "cntr_qty": "3",
                        "cntr_tm": "221500"
                    }
                ]
            }
        elif api_id == "kt00015": # 배당금 (시간 없음)
            mock_response.json = lambda: {
                "return_code": 0,
                "trst_ovrl_trde_prps_array": [
                    {
                        "trde_dt": "20260719",
                        "rmrk_nm": "배당금",
                        "stk_cd": "001230",
                        "stk_nm": "맥쿼리인프라",
                        "trde_amt": 15000,
                        "trde_qty_jwa_cnt": 0
                    }
                ]
            }
        else:
            mock_response.json = lambda: {"return_code": 0}
        return mock_response

    mock_post.side_effect = mock_api_responses

    service = KiwoomTransactionService()
    result = await service.sync_transactions(db_session, days=1)

    assert result["status"] == "success"
    # synced_transactions 검증
    synced = result["synced_transactions"]
    assert len(synced) >= 2
    samsung_tx = next(t for t in synced if t["asset_name"] == "삼성전자")
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    assert "traded_at" in samsung_tx
    assert samsung_tx["traded_at"] == f"{today_str} 14:30"

    macquarie_tx = next(t for t in synced if t["asset_name"] == "맥쿼리인프라")
    assert "traded_at" in macquarie_tx
    assert macquarie_tx["traded_at"] == "2026-07-19"

    # unregistered_assets 검증
    unregistered = result["unregistered_assets"]
    assert len(unregistered) >= 1
    nvda_tx = next(t for t in unregistered if t["ticker"] == "NVDA")
    assert "traded_at" in nvda_tx
    assert nvda_tx["traded_at"] == f"{today_str} 22:15"


def test_parse_traded_at_helper():
    """_parse_traded_at 헬퍼 함수의 3/4/5/6자리 시각 패딩, 날짜 포맷팅 및 예외 케이스 처리 단원 검증."""
    # 3자리 시각 ("930" -> 09:30)
    assert _parse_traded_at("20260803", "930") == "2026-08-03 09:30"
    # 4자리 시각 ("1430" -> 14:30)
    assert _parse_traded_at("20260803", "1430") == "2026-08-03 14:30"
    # 5자리 시각 ("93000" -> 09:30)
    assert _parse_traded_at("20260803", "93000") == "2026-08-03 09:30"
    # 6자리 시각 ("143015" -> 14:30)
    assert _parse_traded_at("20260803", "143015") == "2026-08-03 14:30"
    # 00시 00분 또는 시각 정보 없음
    assert _parse_traded_at("20260803", "000000") == "2026-08-03"
    assert _parse_traded_at("20260803", None) == "2026-08-03"
    # datetime 객체 전달
    dt = datetime.datetime(2026, 8, 3, 14, 30)
    assert _parse_traded_at(dt.date(), "143000") == "2026-08-03 14:30"


@pytest.mark.asyncio
@patch("src.backend.services.kiwoom_sync_service.KiwoomAuthManager")
@patch("httpx.AsyncClient.post")
async def test_sync_overseas_dividend_and_tax(
    mock_post, mock_auth_class, db_session: Session, setup_test_data
):
    """해외 배당금(정산금액 fc_exct_amt) 및 해외 배당세(TAX) 동기화 동작을 검증합니다."""
    mock_auth = mock_auth_class.return_value
    mock_auth.base_url = "https://api.kiwoom.com"
    mock_auth.get_valid_token = AsyncMock(return_value="valid_token")

    def mock_api_responses(url, *args, **kwargs):
        headers = kwargs.get("headers", {})
        api_id = headers.get("api-id")
        mock_response = AsyncMock()
        mock_response.raise_for_status = lambda: None

        if api_id == "kt00015":
            mock_response.json = lambda: {
                "return_code": 0,
                "trst_ovrl_trde_prps_array": [
                    {
                        "trde_dt": "20260807",
                        "trde_no": "000000004",
                        "rmrk_nm": "배당금(외화)입금",
                        "stk_cd": "AAPL",
                        "stk_nm": "Apple",
                        "crnc_cd": "USD",
                        "fc_trde_amt": "80.63",
                        "fc_exct_amt": "80.63",
                        "trde_amt": "000000000000000",
                        "trde_qty_jwa_cnt": ""
                    },
                    {
                        "trde_dt": "20260807",
                        "trde_no": "000000005",
                        "rmrk_nm": "해외배당세출금",
                        "stk_cd": "AAPL",
                        "stk_nm": "Apple",
                        "crnc_cd": "KRW",
                        "fc_trde_amt": "0.00",
                        "trde_amt": "000000000017610",
                        "trde_qty_jwa_cnt": ""
                    }
                ]
            }
        else:
            mock_response.json = lambda: {"return_code": 0, "result_list": []}
        return mock_response

    mock_post.side_effect = mock_api_responses

    service = KiwoomTransactionService()
    result = await service.sync_transactions(db_session, days=7)

    assert result["status"] == "success"

    apple_asset = setup_test_data["assets"]["AAPL"]
    account = setup_test_data["accounts"]["5526-9093"]

    # DB에 배당금(INTEREST) 및 배당세(TAX)가 정상 적재되었는지 검증
    interest_tx = db_session.query(Transaction).filter(
        Transaction.account_id == account.id,
        Transaction.asset_id == apple_asset.id,
        Transaction.type == "INTEREST"
    ).first()
    assert interest_tx is not None
    assert interest_tx.total_amount == 80.63
    assert interest_tx.price == 0.0
    assert interest_tx.quantity == 0.0
    assert interest_tx.currency == "USD"
    assert interest_tx.external_id == "000000004"

    tax_tx = db_session.query(Transaction).filter(
        Transaction.account_id == account.id,
        Transaction.asset_id == apple_asset.id,
        Transaction.type == "TAX"
    ).first()
    assert tax_tx is not None
    assert tax_tx.total_amount == 17610.0
    assert tax_tx.price == 0.0
    assert tax_tx.quantity == 0.0
    assert tax_tx.currency == "KRW"
    assert tax_tx.external_id == "000000005"


