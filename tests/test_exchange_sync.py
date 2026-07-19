import pytest
import datetime
from unittest.mock import AsyncMock, patch, Mock, MagicMock
from sqlalchemy.orm import Session

from src.kiwoom.api import KiwoomAPI
from src.backend.services.price_service import price_service
from src.backend.models import ExchangeRate


@pytest.mark.asyncio
async def test_kiwoom_api_get_exchange_rate():
    """KiwoomAPI.get_exchange_rate 메서드가 헤더 및 바디를 올바르게 설정하여 호출하는지 검증합니다."""
    api = KiwoomAPI()
    
    mock_response = Mock()
    mock_response.status_code = 200
    mock_response.json = Mock(return_value={
        "return_code": 0,
        "sell_aplc_exrt": "1,350.50",
        "buy_aplc_exrt": "1,340.50",
        "aplc_exrt": "1345.500000"
    })
    
    with patch("requests.post", return_value=mock_response) as mock_post:
        res = api.get_exchange_rate(token="mock_token", sell_crnc="USD", buy_crnc="KRW", exmn_tp="1")
        
        assert res is not None
        assert res["sell_aplc_exrt"] == "1,350.50"
        
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert kwargs["headers"]["api-id"] == "ust31301"
        assert kwargs["headers"]["authorization"] == "Bearer mock_token"
        assert kwargs["json"]["sell_crnc_code"] == "USD"
        assert kwargs["json"]["buy_crnc_code"] == "KRW"
        assert kwargs["json"]["exmn_tp"] == "1"


@pytest.mark.asyncio
async def test_fetch_and_save_exchange_rate(db_session: Session):
    """fetch_and_save_exchange_rate가 환율 정보를 조회해 DB에 저장 및 갱신하는지 검증합니다."""
    mock_res = {
        "return_code": 0,
        "sell_aplc_exrt": "1,385.50",
        "buy_aplc_exrt": "1,375.50"
    }
    
    mock_token = AsyncMock(return_value="mock_token")
    
    with patch.object(price_service.kiwoom_api, "get_exchange_rate", return_value=mock_res) as mock_get, \
         patch.object(price_service.kiwoom_auth, "get_valid_token", mock_token):
        target_date = datetime.date(2026, 7, 19)
        
        # 1. 신규 저장 테스트
        rate = await price_service.fetch_and_save_exchange_rate(db_session, target_date)
        assert rate == 1385.5
        
        db_rate = db_session.query(ExchangeRate).filter_by(date=target_date, currency="USD").first()
        assert db_rate is not None
        assert db_rate.rate == 1385.5
        
        # 2. 업데이트(덮어쓰기) 테스트
        mock_res["sell_aplc_exrt"] = "1,390.00"
        rate_updated = await price_service.fetch_and_save_exchange_rate(db_session, target_date)
        assert rate_updated == 1390.0
        
        db_rate_updated = db_session.query(ExchangeRate).filter_by(date=target_date, currency="USD").first()
        assert db_rate_updated.rate == 1390.0


@pytest.mark.asyncio
async def test_update_all_market_prices_exchange_trigger(db_session: Session):
    """오전 7시 이후 영업일에 당일 환율 정보가 없으면 환율 수집이 트리거되는지 검증합니다."""
    today = datetime.date(2026, 7, 20)  # 월요일 (영업일 가정)
    
    # 1. 오전 7시 이전 실행 시 -> 환율 수집 미실행
    now_kst_6am = datetime.datetime(2026, 7, 20, 6, 30, 0)
    mock_fetch = AsyncMock(return_value=1350.0)
    
    with patch("datetime.datetime") as mock_datetime, \
         patch.object(price_service, "fetch_and_save_exchange_rate", mock_fetch), \
         patch.object(price_service, "is_market_holiday", return_value=False), \
         patch.object(price_service, "_get_today", return_value=today):
        
        mock_now = MagicMock()
        mock_now.hour = 6
        mock_now.date.return_value = today
        mock_datetime.now.return_value = mock_now
        
        # 시세 업데이트 호출
        await price_service.update_all_market_prices()
        
        # 오전 6시이므로 수집 미호출
        assert not mock_fetch.called

    # 2. 오전 7시 이후 실행 & DB에 오늘 환율이 없을 때 -> 환율 수집 실행
    mock_fetch.reset_mock()
    with patch("datetime.datetime") as mock_datetime, \
         patch.object(price_service, "fetch_and_save_exchange_rate", mock_fetch), \
         patch.object(price_service, "is_market_holiday", return_value=False), \
         patch.object(price_service, "_get_today", return_value=today):
        
        mock_now = MagicMock()
        mock_now.hour = 7
        mock_now.date.return_value = today
        mock_datetime.now.return_value = mock_now
        
        await price_service.update_all_market_prices()
        
        # 호출되어야 함
        assert mock_fetch.called

    # 3. 오전 7시 이후 실행 & DB에 이미 오늘 환율이 있을 때 -> 환율 수집 스킵
    mock_fetch.reset_mock()
    # DB에 오늘 환율 미리 주입
    existing_rate = ExchangeRate(date=today, currency="USD", rate=1350.0)
    db_session.add(existing_rate)
    db_session.commit()
    
    with patch("datetime.datetime") as mock_datetime, \
         patch.object(price_service, "fetch_and_save_exchange_rate", mock_fetch), \
         patch.object(price_service, "is_market_holiday", return_value=False), \
         patch.object(price_service, "_get_today", return_value=today):
        
        mock_now = MagicMock()
        mock_now.hour = 8
        mock_now.date.return_value = today
        mock_datetime.now.return_value = mock_now
        
        await price_service.update_all_market_prices()
        
        # 이미 존재하므로 호출되면 안 됨
        assert not mock_fetch.called

    # 4. 한국 휴장일일 때 -> 오전 7시 이후라도 환율 수집 스킵
    mock_fetch.reset_mock()
    # DB에서 기존 환율 제거
    db_session.delete(existing_rate)
    db_session.commit()
    
    with patch("datetime.datetime") as mock_datetime, \
         patch.object(price_service, "fetch_and_save_exchange_rate", mock_fetch), \
         patch.object(price_service, "is_market_holiday", return_value=True), \
         patch.object(price_service, "_get_today", return_value=today):
        
        mock_now = MagicMock()
        mock_now.hour = 9
        mock_now.date.return_value = today
        mock_datetime.now.return_value = mock_now
        
        await price_service.update_all_market_prices()
        
        # 휴장일이므로 호출되면 안 됨
        assert not mock_fetch.called
