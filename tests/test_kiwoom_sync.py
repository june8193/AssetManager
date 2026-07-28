import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from src.backend.main import app
from src.backend.models import Account, Asset, Transaction, User
from src.backend.services.kiwoom_sync_service import KiwoomTransactionService

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
