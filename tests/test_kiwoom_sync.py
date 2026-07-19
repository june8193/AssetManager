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

    # 2. 키움증권 계좌 생성
    account = Account(
        user_id=user.id,
        name="5526-9093",
        provider="키움증권",
        alias="일반주식",
        account_type="BROKERAGE"
    )
    db_session.add(account)
    
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
        "account": account,
        "assets": {
            "005930": samsung,
            "AAPL": apple,
            "001230": macquarie
        }
    }

@pytest.mark.asyncio
@patch("src.backend.services.kiwoom_sync_service.KiwoomAuthManager")
@patch("httpx.AsyncClient.post")
async def test_sync_transactions_success_and_skip(
    mock_post, mock_auth_class, db_session: Session, setup_test_data
):
    """정상적인 거래내역 저장, 미등록 자산 스킵, 그리고 중복 스킵 로직을 테스트합니다."""
    # Auth Manager Mock
    mock_auth = mock_auth_class.return_value
    mock_auth.get_valid_token = AsyncMock(return_value="mock_token")
    mock_auth.base_url = "https://api.kiwoom.com"

    # API Response Mocking
    # 1. ka10076 (국내 체결): 삼성전자 10주 매수
    # 2. ust21510 (미국 체결): Apple 5주 매도, NVDA 3주 매수 (NVDA는 미등록 자산)
    # 3. kt00015 (배당금): 맥쿼리인프라 배당금 15,000원 입금
    def mock_api_responses(url, *args, **kwargs):
        headers = kwargs.get("headers", {})
        api_id = headers.get("api-id")
        
        mock_response = AsyncMock()
        mock_response.status_code = 200
        
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
        elif api_id == "ust21510": # 미국 체결
            mock_response.json = lambda: {
                "return_code": 0,
                "result_list": [
                    {
                        "stk_cd": "AAPL",
                        "stk_nm": "Apple",
                        "io_tp_nm": "-매도",
                        "cntr_pric": 185.0,
                        "cntr_qty": 5,
                        "ord_stt": "체결"
                    },
                    {
                        "stk_cd": "NVDA", # 미등록 자산
                        "stk_nm": "NVIDIA",
                        "io_tp_nm": "+매수",
                        "cntr_pric": 120.0,
                        "cntr_qty": 3,
                        "ord_stt": "체결"
                    }
                ]
            }
        elif api_id == "kt00015": # 위탁종합거래내역 (배당금)
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
                    },
                    {
                        "trde_dt": "20260719",
                        "rmrk_nm": "이체입금", # 배당금이 아니므로 스킵
                        "stk_cd": "",
                        "stk_nm": "",
                        "trde_amt": 100000,
                        "trde_qty_jwa_cnt": 0,
                        "exct_amt": 100000,
                        "cmsn": 0
                    }
                ]
            }
        else:
            mock_response.json = lambda: {"return_code": -1, "return_msg": "Unknown API"}
            
        return mock_response

    mock_post.side_effect = mock_api_responses

    service = KiwoomTransactionService()
    
    # 첫 번째 동기화 시도 (삼성전자, Apple, 맥쿼리 배당금은 저장 성공해야 하고 NVDA는 미등록으로 스킵되어야 함)
    result = await service.sync_transactions(db_session, days=1)
    
    assert result["status"] == "success"
    assert result["success_count"] == 3
    assert result["pending_count"] == 1
    
    # 저장 결과 검증
    transactions = db_session.query(Transaction).all()
    assert len(transactions) == 3
    
    # 삼성전자 매수 검증
    tx_samsung = db_session.query(Transaction).filter(Transaction.type == "BUY").first()
    assert tx_samsung is not None
    assert tx_samsung.quantity == 10
    assert tx_samsung.price == 72000
    assert tx_samsung.total_amount == 720000
    assert tx_samsung.currency == "KRW"
    
    # Apple 매도 검증
    tx_apple = db_session.query(Transaction).filter(Transaction.type == "SELL").first()
    assert tx_apple is not None
    assert tx_apple.quantity == 5
    assert tx_apple.price == 185.0
    assert tx_apple.total_amount == 925.0
    assert tx_apple.currency == "USD"

    # 맥쿼리 배당금 검증
    tx_macquarie = db_session.query(Transaction).filter(Transaction.type == "INTEREST").first()
    assert tx_macquarie is not None
    assert tx_macquarie.total_amount == 15000
    assert tx_macquarie.currency == "KRW"

    # 미등록 자산 결과 검증
    assert len(result["unregistered_assets"]) == 1
    assert result["unregistered_assets"][0]["ticker"] == "NVDA"

    # 두 번째 동기화 시도 (중복 검사 테스트: 동일 API 데이터로 재호출 시 신규 저장 건수가 0이어야 함)
    result_second = await service.sync_transactions(db_session, days=1)
    assert result_second["success_count"] == 0
    assert len(db_session.query(Transaction).all()) == 3


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
