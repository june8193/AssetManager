# -*- coding: utf-8 -*-
"""텔레그램 키움 거래내역 수동 동기화(/sync) 및 장 마감 자동 스케줄러 단위 테스트 모듈입니다.

asset_client의 sync_kiwoom_transactions 연동,
MessageRenderer의 render_kiwoom_sync 및 render_auto_sync_notification 마크다운 포맷팅,
/sync 명령어 파라미터 파싱 및 CLI 디스패치,
MarketCloseScheduler의 장 마감 시간 판정 및 자동 동기화 알림 발송 조건을 검증합니다.
"""

import asyncio
import datetime
from unittest.mock import AsyncMock, MagicMock, patch
import httpx
import pytest

from src.backend.config import TelegramConfig
from src.backend.telegram.asset_client.asset_api import sync_kiwoom_transactions
from src.backend.telegram.asset_client.models import (
    AssetClientError,
    KiwoomFailedAccountItem,
    KiwoomSyncResponse,
    KiwoomSyncTransactionItem,
    KiwoomUnregisteredAssetItem,
)
from src.backend.telegram.client import TelegramClient
from src.backend.telegram.commands import CLICommandHandler
from src.backend.telegram.commands.sync import handle_sync
from src.backend.telegram.renderer import (
    MessageRenderer,
    render_auto_sync_notification,
    render_kiwoom_sync,
)
from src.backend.telegram.scheduler import MarketCloseScheduler


# ============================================================================
# 1. asset_client.sync_kiwoom_transactions 단위 테스트
# ============================================================================

@pytest.mark.asyncio
async def test_asset_client_sync_kiwoom_transactions_success():
    """sync_kiwoom_transactions가 백엔드 API 응답을 KiwoomSyncResponse 모델로 올바르게 변환하는지 검증합니다."""
    mock_payload = {
        "status": "success",
        "success_count": 2,
        "pending_count": 1,
        "synced_transactions": [
            {
                "type": "BUY",
                "asset_name": "삼성전자",
                "quantity": 10.0,
                "price": 70000.0,
                "total_amount": 700000.0,
                "currency": "KRW",
                "is_manual_matched": False,
                "traded_at": "2026-09-12 14:30",
            },
            {
                "type": "INTEREST",
                "asset_name": "Apple Inc.",
                "quantity": 0.0,
                "price": 50.22,
                "total_amount": 50.22,
                "currency": "USD",
                "is_manual_matched": True,
                "traded_at": "2026-09-11 23:15",
            },
        ],
        "unregistered_assets": [
            {
                "ticker": "000660",
                "name": "SK하이닉스",
                "type": "BUY",
                "quantity": 5.0,
                "price": 180000.0,
                "total_amount": 900000.0,
                "currency": "KRW",
                "traded_at": "2026-09-12 11:20",
            }
        ],
        "failed_accounts": [
            {"account_name": "연금저축계좌", "error": "계좌 비밀번호 오류"}
        ],
    }

    mock_resp = httpx.Response(
        status_code=200,
        json=mock_payload,
        request=httpx.Request("POST", "http://localhost:8000/api/kiwoom/sync-transactions"),
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        resp = await sync_kiwoom_transactions(days=7)

        assert isinstance(resp, KiwoomSyncResponse)
        assert resp.status == "success"
        assert resp.success_count == 2
        assert resp.pending_count == 1
        assert len(resp.synced_transactions) == 2
        assert resp.synced_transactions[0].asset_name == "삼성전자"
        assert resp.synced_transactions[0].traded_at == "2026-09-12 14:30"
        assert len(resp.unregistered_assets) == 1
        assert resp.unregistered_assets[0].ticker == "000660"
        assert len(resp.failed_accounts) == 1
        assert resp.failed_accounts[0].account_name == "연금저축계좌"

        # Query params 검증
        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args.kwargs
        assert call_kwargs.get("params") == {"days": 7}


@pytest.mark.asyncio
async def test_asset_client_sync_kiwoom_transactions_error():
    """백엔드 오류 시 AssetClientError가 발생하는지 검증합니다."""
    mock_resp = httpx.Response(
        status_code=500,
        text="Internal Server Error",
        request=httpx.Request("POST", "http://localhost:8000/api/kiwoom/sync-transactions"),
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        with pytest.raises(AssetClientError):
            await sync_kiwoom_transactions(days=3)


# ============================================================================
# 2. MessageRenderer 동기화 포맷팅 단위 테스트
# ============================================================================

def test_render_kiwoom_sync_with_data():
    """수동 동기화 응답 렌더링에 성공 건수, 미등록 종목, 기간 및 링크가 포함되는지 검증합니다."""
    data = KiwoomSyncResponse(
        status="success",
        success_count=1,
        pending_count=1,
        synced_transactions=[
            KiwoomSyncTransactionItem(
                type="BUY",
                asset_name="삼성전자",
                quantity=10.0,
                price=70000.0,
                total_amount=700000.0,
                currency="KRW",
                is_manual_matched=False,
                traded_at="2026-09-12 14:30",
            )
        ],
        unregistered_assets=[
            KiwoomUnregisteredAssetItem(
                ticker="000660",
                name="SK하이닉스",
                type="BUY",
                quantity=5.0,
                price=180000.0,
                total_amount=900000.0,
                currency="KRW",
                traded_at="2026-09-12 11:20",
            )
        ],
        failed_accounts=[
            KiwoomFailedAccountItem(account_name="위탁계좌", error="인증 실패")
        ],
    )

    rendered = render_kiwoom_sync(data, days=7)

    assert "키움증권 거래내역 동기화 결과 (최근 7일)" in rendered
    assert "성공적으로 저장된 거래 (1건)" in rendered
    assert "삼성전자" in rendered
    assert "700,000원" in rendered
    assert "2026-09-12 14:30" in rendered
    assert "자산 마스터 미등록으로 저장이 생략된 거래 (1건)" in rendered
    assert "SK하이닉스 (000660)" in rendered
    assert "http://localhost:5173/assets" in rendered
    assert "동기화 실패 계좌 (1개)" in rendered
    assert "위탁계좌: 인증 실패" in rendered


def test_render_kiwoom_sync_empty():
    """거래내역이 없을 때의 수동 동기화 메시지 포맷팅을 검증합니다."""
    data = KiwoomSyncResponse(
        status="success",
        success_count=0,
        pending_count=0,
        synced_transactions=[],
        unregistered_assets=[],
        failed_accounts=[],
    )

    rendered = render_kiwoom_sync(data, days=1)

    assert "최근 1일" in rendered
    assert "새롭게 감지된 거래가 없습니다." in rendered
    assert "미등록 스킵된 거래가 없습니다." in rendered


def test_render_auto_sync_notification_with_market_name():
    """자동 동기화 알림 메시지에 마켓 명칭과 신규 거래/미등록 종목이 포맷팅되는지 검증합니다."""
    data = KiwoomSyncResponse(
        status="success",
        success_count=1,
        pending_count=0,
        synced_transactions=[
            KiwoomSyncTransactionItem(
                type="SELL",
                asset_name="애플",
                quantity=2.0,
                price=150.0,
                total_amount=300.0,
                currency="USD",
                is_manual_matched=True,
                traded_at="2026-09-12 05:30",
            )
        ],
        unregistered_assets=[],
        failed_accounts=[],
    )

    rendered = render_auto_sync_notification(data, market_name="미국장 마감")

    assert "미국장 마감 자동 동기화 알림" in rendered
    assert "성공적으로 저장된 거래 (1건)" in rendered
    assert "애플" in rendered
    assert "수동 매칭완료" in rendered
    assert "$300.00" in rendered


# ============================================================================
# 3. /sync 커맨드 핸들러 단위 테스트
# ============================================================================

@pytest.mark.asyncio
async def test_handle_sync_default_days():
    """기본 /sync 입력 시 7일 동기화가 호출되고 렌더링 결과가 전송되는지 검증합니다."""
    mock_client = AsyncMock(spec=TelegramClient)
    mock_sync_result = KiwoomSyncResponse(
        status="success",
        success_count=1,
        pending_count=0,
        synced_transactions=[
            KiwoomSyncTransactionItem(
                type="BUY",
                asset_name="삼성전자",
                quantity=1.0,
                price=70000.0,
                total_amount=700000.0,
                currency="KRW",
            )
        ],
    )

    with patch(
        "src.backend.telegram.commands.sync.sync_kiwoom_transactions",
        new_callable=AsyncMock,
    ) as mock_sync:
        mock_sync.return_value = mock_sync_result

        await handle_sync(mock_client, chat_id=12345, text="/sync")

        mock_client.send_chat_action.assert_called_once_with(12345, "typing")
        mock_sync.assert_called_once_with(days=7)
        mock_client.send_message.assert_called_once()
        sent_text = mock_client.send_message.call_args[0][1]
        assert "키움증권 거래내역 동기화 결과 (최근 7일)" in sent_text
        assert "삼성전자" in sent_text


@pytest.mark.asyncio
async def test_handle_sync_custom_days_and_invalid_param_fallback():
    """커스텀 일수(/sync 3) 및 잘못된 파라미터(/sync abc, /sync -5) 전달 시의 동작을 검증합니다."""
    mock_client = AsyncMock(spec=TelegramClient)
    mock_sync_result = KiwoomSyncResponse(status="success", success_count=0, pending_count=0)

    with patch(
        "src.backend.telegram.commands.sync.sync_kiwoom_transactions",
        new_callable=AsyncMock,
    ) as mock_sync:
        mock_sync.return_value = mock_sync_result

        # 1. 커스텀 일수: 3일
        await handle_sync(mock_client, chat_id=12345, text="/sync 3")
        mock_sync.assert_called_with(days=3)

        # 2. 문자가 들어온 경우 -> 기본값 7일 대체
        await handle_sync(mock_client, chat_id=12345, text="/sync invalid")
        mock_sync.assert_called_with(days=7)

        # 3. 0 이하가 들어온 경우 -> 기본값 7일 대체
        await handle_sync(mock_client, chat_id=12345, text="/sync 0")
        mock_sync.assert_called_with(days=7)


@pytest.mark.asyncio
async def test_handle_sync_error_handling():
    """동기화 API 실패 시 사용자에게 친절한 에러 메시지가 전송되는지 검증합니다."""
    mock_client = AsyncMock(spec=TelegramClient)

    with patch(
        "src.backend.telegram.commands.sync.sync_kiwoom_transactions",
        new_callable=AsyncMock,
    ) as mock_sync:
        mock_sync.side_effect = Exception("API Connection Timeout")

        await handle_sync(mock_client, chat_id=12345, text="/sync")

        mock_client.send_message.assert_called_once()
        sent_text = mock_client.send_message.call_args[0][1]
        assert "⚠️ 동기화 중 오류가 발생했습니다" in sent_text
        assert "API Connection Timeout" in sent_text


@pytest.mark.asyncio
async def test_bot_routes_sync_command():
    """CLICommandHandler가 /sync 명령어를 올바르게 라우팅하는지 검증합니다."""
    mock_client = AsyncMock(spec=TelegramClient)
    config = TelegramConfig(bot_token="TEST", allowed_user_ids=[12345])
    handler = CLICommandHandler(client=mock_client, config=config)

    assert "/sync" in handler.handlers

    with patch(
        "src.backend.telegram.commands.sync.sync_kiwoom_transactions",
        new_callable=AsyncMock,
    ) as mock_sync:
        mock_sync.return_value = KiwoomSyncResponse(status="success", success_count=0)

        await handler.process_cli_command(12345, "/sync 5")
        mock_sync.assert_called_once_with(days=5)


# ============================================================================
# 4. MarketCloseScheduler 장 마감 스케줄러 단위 테스트
# ============================================================================

def test_market_close_scheduler_time_check():
    """스케줄러의 장 마감 시각 판정 로직이 정확히 동작하는지 검증합니다."""
    scheduler = MarketCloseScheduler(client=MagicMock(), config=MagicMock())

    # 1. 국내장 마감: 월~금 18:10 (weekday: 0~4)
    # 2026-09-11 금요일 18:10 -> 국내장 마감
    fri_1810 = datetime.datetime(2026, 9, 11, 18, 10, 15)
    should_run, market_name = scheduler.is_market_close_time(fri_1810)
    assert should_run is True
    assert "국내장" in market_name

    # 2. 미국장 마감: 화~토 07:10 (weekday: 1~5)
    # 2026-09-12 토요일 07:10 -> 미국장 마감
    sat_0710 = datetime.datetime(2026, 9, 12, 7, 10, 0)
    should_run, market_name = scheduler.is_market_close_time(sat_0710)
    assert should_run is True
    assert "미국장" in market_name

    # 2026-09-08 화요일 07:10 -> 미국장 마감
    tue_0710 = datetime.datetime(2026, 9, 8, 7, 10, 0)
    should_run, market_name = scheduler.is_market_close_time(tue_0710)
    assert should_run is True
    assert "미국장" in market_name

    # 3. 비실행 케이스들:
    # 일요일 18:10 (weekday 6) -> 실행 안 함
    sun_1810 = datetime.datetime(2026, 9, 13, 18, 10, 0)
    assert scheduler.is_market_close_time(sun_1810)[0] is False

    # 토요일 18:10 (weekday 5) -> 실행 안 함
    sat_1810 = datetime.datetime(2026, 9, 12, 18, 10, 0)
    assert scheduler.is_market_close_time(sat_1810)[0] is False

    # 월요일 07:10 (weekday 0) -> 일요일 미국장은 열리지 않으므로 실행 안 함
    mon_0710 = datetime.datetime(2026, 9, 7, 7, 10, 0)
    assert scheduler.is_market_close_time(mon_0710)[0] is False

    # 평일 타 시각: 금요일 18:09, 18:11
    assert scheduler.is_market_close_time(datetime.datetime(2026, 9, 11, 18, 9, 0))[0] is False
    assert scheduler.is_market_close_time(datetime.datetime(2026, 9, 11, 18, 11, 0))[0] is False


def test_market_close_scheduler_deduplication():
    """하루에 동일한 장 마감 동기화가 중복 실행되지 않는지 검증합니다."""
    scheduler = MarketCloseScheduler(client=MagicMock(), config=MagicMock())

    now = datetime.datetime(2026, 9, 11, 18, 10, 0)

    # 1. 국내장: 첫 번째 체크 시 실행 대상
    should_trigger, market = scheduler.should_trigger(now)
    assert should_trigger is True
    assert market == "국내장 마감"

    # 실제 스케줄러 루프가 넘기는 문자열("국내장 마감")로 실행 기록 반영
    scheduler.record_run(market, now.date())

    # 같은 날 18:10 재확인 시: 중복 방지되어 실행 안 됨
    should_trigger2, _ = scheduler.should_trigger(now)
    assert should_trigger2 is False

    # 2. 미국장: 화~토 07:10 체크 및 중복 방지
    sat_now = datetime.datetime(2026, 9, 12, 7, 10, 0)
    should_trigger_us, market_us = scheduler.should_trigger(sat_now)
    assert should_trigger_us is True
    assert market_us == "미국장 마감"

    scheduler.record_run(market_us, sat_now.date())
    should_trigger_us2, _ = scheduler.should_trigger(sat_now)
    assert should_trigger_us2 is False



@pytest.mark.asyncio
async def test_market_close_scheduler_executes_and_notifies_when_has_changes():
    """신규 거래가 있거나 미등록 종목이 있을 때 모든 allowed_user_ids에게 알림이 발송되는지 검증합니다."""
    mock_client = AsyncMock(spec=TelegramClient)
    config = TelegramConfig(bot_token="TEST", allowed_user_ids=[111, 222])
    scheduler = MarketCloseScheduler(client=mock_client, config=config)

    mock_resp = KiwoomSyncResponse(
        status="success",
        success_count=1,
        pending_count=0,
        synced_transactions=[
            KiwoomSyncTransactionItem(
                type="BUY",
                asset_name="현대차",
                quantity=3.0,
                price=200000.0,
                total_amount=600000.0,
                currency="KRW",
            )
        ],
    )

    with patch(
        "src.backend.telegram.scheduler.market_close.sync_kiwoom_transactions",
        new_callable=AsyncMock,
    ) as mock_sync:
        mock_sync.return_value = mock_resp

        await scheduler._execute_auto_sync("국내장 마감")

        mock_sync.assert_called_once_with(days=1)
        # 허가된 두 사용자(111, 222)에게 모두 메시지 전송
        assert mock_client.send_message.call_count == 2
        calls = [c[0] for c in mock_client.send_message.call_args_list]
        recipients = [c[0] for c in calls]
        assert set(recipients) == {111, 222}
        assert "국내장 마감 자동 동기화 알림" in calls[0][1]
        assert "현대차" in calls[0][1]


@pytest.mark.asyncio
async def test_market_close_scheduler_skips_when_no_changes():
    """신규 거래 및 미등록 종목이 모두 없을 때 텔레그램 메시지 발송이 생략되는지 검증합니다."""
    mock_client = AsyncMock(spec=TelegramClient)
    config = TelegramConfig(bot_token="TEST", allowed_user_ids=[111, 222])
    scheduler = MarketCloseScheduler(client=mock_client, config=config)

    mock_resp = KiwoomSyncResponse(
        status="success",
        success_count=0,
        pending_count=0,
        synced_transactions=[],
        unregistered_assets=[],
    )

    with patch(
        "src.backend.telegram.scheduler.market_close.sync_kiwoom_transactions",
        new_callable=AsyncMock,
    ) as mock_sync:
        mock_sync.return_value = mock_resp

        await scheduler._execute_auto_sync("미국장 마감")

        mock_sync.assert_called_once_with(days=1)
        # 발송 생략 검증
        mock_client.send_message.assert_not_called()


@pytest.mark.asyncio
async def test_market_close_scheduler_notifies_when_unregistered_assets_exist():
    """신규 저장은 0건이지만 미등록 종목이 감지된 경우 사용자에게 알림이 발송되는지 검증합니다."""
    mock_client = AsyncMock(spec=TelegramClient)
    config = TelegramConfig(bot_token="TEST", allowed_user_ids=[111])
    scheduler = MarketCloseScheduler(client=mock_client, config=config)

    mock_resp = KiwoomSyncResponse(
        status="success",
        success_count=0,
        pending_count=1,
        unregistered_assets=[
            KiwoomUnregisteredAssetItem(
                ticker="NVDA",
                name="Nvidia",
                type="BUY",
                quantity=1.0,
                price=120.0,
                total_amount=120.0,
                currency="USD",
            )
        ],
    )

    with patch(
        "src.backend.telegram.scheduler.market_close.sync_kiwoom_transactions",
        new_callable=AsyncMock,
    ) as mock_sync:
        mock_sync.return_value = mock_resp

        await scheduler._execute_auto_sync("미국장 마감")

        assert mock_client.send_message.call_count == 1
        sent_text = mock_client.send_message.call_args[0][1]
        assert "Nvidia (NVDA)" in sent_text


@pytest.mark.asyncio
async def test_market_close_scheduler_error_handling():
    """자동 동기화 중 예외 발생 시 허가된 사용자들에게 에러 알림이 전송되는지 검증합니다."""
    mock_client = AsyncMock(spec=TelegramClient)
    config = TelegramConfig(bot_token="TEST", allowed_user_ids=[111])
    scheduler = MarketCloseScheduler(client=mock_client, config=config)

    with patch(
        "src.backend.telegram.scheduler.market_close.sync_kiwoom_transactions",
        new_callable=AsyncMock,
    ) as mock_sync:
        mock_sync.side_effect = Exception("Kiwoom Open API Network Down")

        await scheduler._execute_auto_sync("국내장 마감")

        assert mock_client.send_message.call_count == 1
        sent_text = mock_client.send_message.call_args[0][1]
        assert "거래내역 자동 동기화 실행 중 오류가 발생했습니다" in sent_text
        assert "Kiwoom Open API Network Down" in sent_text


@pytest.mark.asyncio
async def test_market_close_scheduler_lifecycle():
    """스케줄러의 start 및 stop 생명주기 제어가 올바르게 동작하는지 검증합니다."""
    mock_client = AsyncMock(spec=TelegramClient)
    config = TelegramConfig(bot_token="TEST", allowed_user_ids=[111])
    scheduler = MarketCloseScheduler(client=mock_client, config=config)

    assert scheduler.is_running is False

    task = scheduler.start()
    assert scheduler.is_running is True
    assert task is not None

    scheduler.stop()
    assert scheduler.is_running is False
    await asyncio.sleep(0)
    assert task.cancelled() or task.done()


