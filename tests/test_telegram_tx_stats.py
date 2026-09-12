# -*- coding: utf-8 -*-
"""텔레그램 거래내역(/tx, /transactions) 및 연간(/yearly), 일별(/daily) 통계 E2E 슬라이스 단위 테스트입니다.

asset_client REST API 연동, MessageRenderer 마크다운 서식화,
CLI 명령어 파라미터 파싱, Typing 액션 및 에러 처리를 검증합니다.
"""

import httpx
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.backend.telegram.asset_client.client import AssetApiClient
from src.backend.telegram.asset_client.models import (
    AssetClientError,
    DailyStatItem,
    DailyStatsResponse,
    SnapshotItem,
    SnapshotsResponse,
    TransactionItem,
    TransactionsResponse,
    YearlyStatItem,
    YearlyStatsResponse,
)
from src.backend.telegram.asset_client.asset_api import (
    get_daily_stats,
    get_snapshots,
    get_transactions,
    get_yearly_stats,
)
from src.backend.telegram.renderer import (
    MessageRenderer,
    render_daily_stats,
    render_transactions,
    render_yearly_stats,
)
from src.backend.telegram.commands.tx import handle_transactions
from src.backend.telegram.commands.yearly import handle_yearly
from src.backend.telegram.commands.daily import handle_daily
from src.backend.telegram.commands import CLICommandHandler
from src.backend.telegram.client import TelegramClient
from src.backend.telegram.bot import TelegramBot
from src.backend.config import TelegramConfig


# ============================================================================
# 1. asset_client 단위 테스트 (/api/db/transactions, /api/dashboard/yearly, /api/dashboard/daily, /api/db/snapshots)
# ============================================================================

@pytest.mark.asyncio
async def test_asset_client_get_transactions_success():
    """get_transactions가 백엔드 API 응답 리스트를 올바른 TransactionsResponse 모델로 변환하는지 검증합니다."""
    mock_payload = [
        {
            "id": 1,
            "account_id": 10,
            "asset_id": 101,
            "transaction_date": "2026-09-10",
            "type": "BUY",
            "quantity": 10.0,
            "price": 70000.0,
            "total_amount": 700000.0,
            "currency": "KRW",
            "exchange_rate": None,
            "memo": "정기 매수",
            "asset_name": "삼성전자",
            "asset_ticker": "005930",
            "account_display_name": "키움 위탁계좌",
        },
        {
            "id": 2,
            "account_id": 20,
            "asset_id": 102,
            "transaction_date": "2026-09-11",
            "type": "BUY",
            "quantity": 2.0,
            "price": 150.0,
            "total_amount": 300.0,
            "currency": "USD",
            "exchange_rate": 1350.0,
            "memo": None,
            "asset_name": "Apple Inc.",
            "asset_ticker": "AAPL",
            "account_display_name": "토스 해외계좌",
        },
    ]

    mock_resp = httpx.Response(
        status_code=200,
        json=mock_payload,
        request=httpx.Request("GET", "http://localhost:8000/api/db/transactions"),
    )

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        resp = await get_transactions()

        assert isinstance(resp, TransactionsResponse)
        assert len(resp.transactions) == 2
        assert resp.transactions[0].asset_name == "삼성전자"
        assert resp.transactions[0].total_amount == 700000.0
        assert resp.transactions[1].currency == "USD"
        assert resp.transactions[1].exchange_rate == 1350.0


@pytest.mark.asyncio
async def test_asset_client_get_transactions_dict_payload():
    """get_transactions가 dict 래핑 응답({'transactions': [...]})도 정상 처리하는지 검증합니다."""
    mock_payload = {
        "transactions": [
            {
                "id": 10,
                "account_id": 1,
                "asset_id": 2,
                "transaction_date": "2026-09-12",
                "type": "DIVIDEND",
                "quantity": 0.0,
                "price": 0.0,
                "total_amount": 50000.0,
                "currency": "KRW",
                "asset_name": "맥쿼리인프라",
            }
        ]
    }

    mock_resp = httpx.Response(
        status_code=200,
        json=mock_payload,
        request=httpx.Request("GET", "http://localhost:8000/api/db/transactions"),
    )

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        resp = await get_transactions()

        assert isinstance(resp, TransactionsResponse)
        assert len(resp.transactions) == 1
        assert resp.transactions[0].type == "DIVIDEND"
        assert resp.transactions[0].asset_name == "맥쿼리인프라"


@pytest.mark.asyncio
async def test_asset_client_get_yearly_stats_success():
    """get_yearly_stats가 연도별 통계 응답을 올바른 YearlyStatsResponse 모델로 변환하는지 검증합니다."""
    mock_payload = [
        {
            "year": 2025,
            "contribution": 12000000.0,
            "profit": 15000000.0,
            "roi": 15.5,
            "assets": 110000000.0,
            "increase": 27000000.0,
        },
        {
            "year": 2026,
            "contribution": 8000000.0,
            "profit": 20000000.0,
            "roi": 18.2,
            "assets": 138000000.0,
            "increase": 28000000.0,
        },
    ]

    mock_resp = httpx.Response(
        status_code=200,
        json=mock_payload,
        request=httpx.Request("GET", "http://localhost:8000/api/dashboard/yearly"),
    )

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        resp = await get_yearly_stats()

        assert isinstance(resp, YearlyStatsResponse)
        assert len(resp.stats) == 2
        assert resp.stats[0].year == 2025
        assert resp.stats[1].profit == 20000000.0
        assert resp.stats[1].roi == 18.2


@pytest.mark.asyncio
async def test_asset_client_get_daily_stats_success():
    """get_daily_stats가 일별 통계 응답을 올바른 DailyStatsResponse 모델로 변환하는지 검증합니다."""
    mock_payload = [
        {
            "date": "2026-09-10",
            "contribution": 0.0,
            "profit": 1200000.0,
            "roi": 0.85,
            "assets": 135000000.0,
            "increase": 1200000.0,
        },
        {
            "date": "2026-09-11",
            "contribution": 1000000.0,
            "profit": -500000.0,
            "roi": -0.35,
            "assets": 135500000.0,
            "increase": 500000.0,
        },
    ]

    mock_resp = httpx.Response(
        status_code=200,
        json=mock_payload,
        request=httpx.Request("GET", "http://localhost:8000/api/dashboard/daily"),
    )

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        resp = await get_daily_stats(all_data=True)

        assert isinstance(resp, DailyStatsResponse)
        assert len(resp.stats) == 2
        assert resp.stats[0].date == "2026-09-10"
        assert resp.stats[1].profit == -500000.0
        # params에 all=true 전달 확인
        mock_get.assert_awaited_once()
        assert mock_get.await_args[1]["params"]["all"] == "true"


@pytest.mark.asyncio
async def test_asset_client_get_snapshots_success():
    """get_snapshots가 스냅샷 목록 응답을 올바른 SnapshotsResponse 모델로 변환하는지 검증합니다."""
    mock_payload = [
        {
            "id": 1,
            "account_id": 10,
            "snapshot_date": "2026-09-11",
            "period_deposit": 1000000.0,
            "total_valuation": 50000000.0,
            "total_profit": 5000000.0,
        }
    ]

    mock_resp = httpx.Response(
        status_code=200,
        json=mock_payload,
        request=httpx.Request("GET", "http://localhost:8000/api/db/snapshots"),
    )

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        resp = await get_snapshots()

        assert isinstance(resp, SnapshotsResponse)
        assert len(resp.snapshots) == 1
        assert resp.snapshots[0].snapshot_date == "2026-09-11"
        assert resp.snapshots[0].total_valuation == 50000000.0


# ============================================================================
# 2. MessageRenderer 마크다운 포맷팅 검증 테스트
# ============================================================================

def test_render_transactions_formatting():
    """render_transactions가 종목명, 매매구분(이모지), 단가, 수량, 총금액, 환율을 정확히 렌더링하는지 검증합니다."""
    tx_resp = TransactionsResponse(
        transactions=[
            TransactionItem(
                id=1,
                account_id=1,
                asset_id=10,
                transaction_date="2026-09-10",
                type="BUY",
                quantity=10.0,
                price=75000.0,
                total_amount=750000.0,
                currency="KRW",
                memo="월간적립",
                asset_name="삼성전자",
                asset_ticker="005930",
                account_display_name="키움위탁",
            ),
            TransactionItem(
                id=2,
                account_id=2,
                asset_id=20,
                transaction_date="2026-09-11",
                type="SELL",
                quantity=5.0,
                price=200.0,
                total_amount=1000.0,
                currency="USD",
                exchange_rate=1350.0,
                memo=None,
                asset_name="Apple Inc.",
                asset_ticker="AAPL",
                account_display_name="토스해외",
            ),
            TransactionItem(
                id=3,
                account_id=1,
                asset_id=30,
                transaction_date="2026-09-12",
                type="DIVIDEND",
                quantity=0.0,
                price=0.0,
                total_amount=15000.0,
                currency="KRW",
                memo="분기배당",
                asset_name="맥쿼리인프라",
                asset_ticker="088980",
                account_display_name=None,
            ),
        ]
    )

    rendered = render_transactions(tx_resp, limit=5)

    assert "📝 **최근 거래 내역 (최근 3건)**" in rendered
    # 매매구분 이모지 매핑 확인
    assert "매수" in rendered
    assert "매도" in rendered
    assert "배당" in rendered
    assert "삼성전자 (005930)" in rendered
    assert "키움위탁" in rendered
    assert "10.00주 @ 75,000.00원 | 총 750,000.00원" in rendered
    # 외화 환율 및 원화 환산 확인
    assert "Apple Inc. (AAPL)" in rendered
    assert "5.00주 @ 200.00 USD | 총 1,000.00 USD" in rendered
    assert "환율 1,350.0원 | 원화 환산 1,350,000원" in rendered


def test_render_transactions_empty():
    """거래내역이 없을 때 빈 안내 메시지를 반환하는지 검증합니다."""
    tx_resp = TransactionsResponse(transactions=[])
    rendered = render_transactions(tx_resp, limit=5)
    assert rendered == "📝 최근 거래 내역이 없습니다."


def test_render_yearly_stats_formatting():
    """render_yearly_stats가 연도별 자산 총액, 연간 수익금 및 수익률을 정확히 렌더링하는지 검증합니다."""
    yearly_resp = YearlyStatsResponse(
        stats=[
            YearlyStatItem(
                year=2024,
                contribution=10000000.0,
                profit=-2000000.0,
                roi=-5.0,
                assets=80000000.0,
                increase=8000000.0,
            ),
            YearlyStatItem(
                year=2025,
                contribution=15000000.0,
                profit=25000000.0,
                roi=25.0,
                assets=120000000.0,
                increase=40000000.0,
            ),
        ]
    )

    rendered = render_yearly_stats(yearly_resp)

    assert "📅 **연도별 자산 및 투자 수익 현황**" in rendered
    # 최신 연도순 정렬 확인 (2025년이 먼저)
    pos_2025 = rendered.find("2025년")
    pos_2024 = rendered.find("2024년")
    assert pos_2025 < pos_2024

    assert "• **2025년**:" in rendered
    assert "기말 자산: 120,000,000원 (전년비 +40,000,000원)" in rendered
    assert "투자 수익: +25,000,000원 (+25.0%)" in rendered
    assert "순 투자금 추가액: 15,000,000원" in rendered

    assert "• **2024년**:" in rendered
    assert "투자 수익: -2,000,000원 (-5.0%)" in rendered


def test_render_yearly_stats_empty():
    """연도별 통계 데이터가 없을 때 빈 안내 메시지를 반환하는지 검증합니다."""
    yearly_resp = YearlyStatsResponse(stats=[])
    rendered = render_yearly_stats(yearly_resp)
    assert rendered == "📅 연도별 자산 통계 데이터가 없습니다."


def test_render_daily_stats_formatting():
    """render_daily_stats가 요일 변환, 자산, 수익금, 수익률, 입출금을 정확히 렌더링하는지 검증합니다."""
    daily_resp = DailyStatsResponse(
        stats=[
            DailyStatItem(
                date="2026-09-11",
                contribution=500000.0,
                profit=1500000.0,
                roi=1.12,
                assets=135500000.0,
                increase=2000000.0,
            ),
            DailyStatItem(
                date="2026-09-10",
                contribution=0.0,
                profit=-300000.0,
                roi=-0.22,
                assets=133500000.0,
                increase=-300000.0,
            ),
        ]
    )

    rendered = render_daily_stats(daily_resp, days=7)

    assert "📈 **일별 자산 및 투자 수익 현황 (최근 2영업일 스냅샷)**" in rendered
    # 2026-09-11은 금요일 (09-11 (금))
    assert "09-11 (금): 자산 135,500,000원 | 수익 +1,500,000원 (+1.12%) | 입출금: 500,000원" in rendered
    # 입출금이 0일 때는 입출금 항목 생략
    assert "09-10 (목): 자산 133,500,000원 | 수익 -300,000원 (-0.22%)" in rendered
    assert "입출금: 0원" not in rendered


def test_render_daily_stats_empty():
    """일별 통계 데이터가 없을 때 빈 안내 메시지를 반환하는지 검증합니다."""
    daily_resp = DailyStatsResponse(stats=[])
    rendered = render_daily_stats(daily_resp, days=7)
    assert rendered == "📈 일별 스냅샷 데이터가 없습니다."


# ============================================================================
# 3. CLI 커맨드 핸들러 및 파라미터 파싱 (/tx, /yearly, /daily) 테스트
# ============================================================================

@pytest.mark.asyncio
async def test_handle_tx_command_default_limit():
    """/tx 명령어 수신 시 기본 limit(5)으로 조회 및 전송하는지 검증합니다."""
    mock_client = MagicMock(spec=TelegramClient)
    mock_client.send_chat_action = AsyncMock(return_value=True)
    mock_client.send_message = AsyncMock(return_value=101)

    tx_resp = TransactionsResponse(transactions=[])

    with patch("src.backend.telegram.commands.tx.get_transactions", new_callable=AsyncMock) as mock_get_tx:
        mock_get_tx.return_value = tx_resp
        await handle_transactions(mock_client, chat_id=12345, text="/tx")

        mock_client.send_chat_action.assert_awaited_once_with(12345, "typing")
        mock_get_tx.assert_awaited_once()
        mock_client.send_message.assert_awaited_once_with(12345, "📝 최근 거래 내역이 없습니다.")


@pytest.mark.asyncio
async def test_handle_tx_command_custom_limit_and_alias():
    """/transactions 10 등 커스텀 인자 파싱 및 별칭 명령어가 정상 작동하는지 검증합니다."""
    mock_client = MagicMock(spec=TelegramClient)
    mock_client.send_chat_action = AsyncMock(return_value=True)
    mock_client.send_message = AsyncMock(return_value=102)

    # 15건의 더미 거래내역
    items = [
        TransactionItem(
            id=i,
            account_id=1,
            asset_id=i,
            transaction_date=f"2026-09-{i:02d}",
            type="BUY",
            quantity=1.0,
            price=1000.0,
            total_amount=1000.0,
            currency="KRW",
            asset_name=f"종목{i}",
        )
        for i in range(1, 16)
    ]
    tx_resp = TransactionsResponse(transactions=items)

    with patch("src.backend.telegram.commands.tx.get_transactions", new_callable=AsyncMock) as mock_get_tx:
        mock_get_tx.return_value = tx_resp
        # /transactions 10 호출
        await handle_transactions(mock_client, chat_id=12345, text="/transactions 10")

        mock_client.send_chat_action.assert_awaited_once_with(12345, "typing")
        sent_msg = mock_client.send_message.await_args[0][1]
        assert "최근 10건" in sent_msg


@pytest.mark.asyncio
async def test_handle_tx_command_invalid_param_fallback():
    """/tx abc 등 숫자가 아닌 인자 전달 시 기본값(5)으로 안전하게 대체되는지 검증합니다."""
    mock_client = MagicMock(spec=TelegramClient)
    mock_client.send_chat_action = AsyncMock(return_value=True)
    mock_client.send_message = AsyncMock(return_value=103)

    items = [
        TransactionItem(
            id=i,
            account_id=1,
            asset_id=i,
            transaction_date=f"2026-09-{i:02d}",
            type="BUY",
            quantity=1.0,
            price=1000.0,
            total_amount=1000.0,
            currency="KRW",
            asset_name=f"종목{i}",
        )
        for i in range(1, 10)
    ]
    tx_resp = TransactionsResponse(transactions=items)

    with patch("src.backend.telegram.commands.tx.get_transactions", new_callable=AsyncMock) as mock_get_tx:
        mock_get_tx.return_value = tx_resp
        # 음수 및 문자열 인자 테스트
        await handle_transactions(mock_client, chat_id=12345, text="/tx invalid_arg")

        sent_msg = mock_client.send_message.await_args[0][1]
        assert "최근 5건" in sent_msg


@pytest.mark.asyncio
async def test_handle_yearly_command_success():
    """/yearly 명령어 수신 시 Typing 액션 후 연도별 통계를 전송하는지 검증합니다."""
    mock_client = MagicMock(spec=TelegramClient)
    mock_client.send_chat_action = AsyncMock(return_value=True)
    mock_client.send_message = AsyncMock(return_value=104)

    yearly_resp = YearlyStatsResponse(
        stats=[
            YearlyStatItem(
                year=2026,
                contribution=5000000.0,
                profit=10000000.0,
                roi=10.0,
                assets=100000000.0,
                increase=15000000.0,
            )
        ]
    )

    with patch("src.backend.telegram.commands.yearly.get_yearly_stats", new_callable=AsyncMock) as mock_yearly:
        mock_yearly.return_value = yearly_resp
        await handle_yearly(mock_client, chat_id=12345, text="/yearly")

        mock_client.send_chat_action.assert_awaited_once_with(12345, "typing")
        sent_msg = mock_client.send_message.await_args[0][1]
        assert "📅 **연도별 자산 및 투자 수익 현황**" in sent_msg
        assert "2026년" in sent_msg


@pytest.mark.asyncio
async def test_handle_daily_command_custom_days():
    """/daily 3 명령어 수신 시 지정된 일수(3일)로 포맷팅하여 전송하는지 검증합니다."""
    mock_client = MagicMock(spec=TelegramClient)
    mock_client.send_chat_action = AsyncMock(return_value=True)
    mock_client.send_message = AsyncMock(return_value=105)

    stats = [
        DailyStatItem(
            date=f"2026-09-{i:02d}",
            contribution=0.0,
            profit=100000.0,
            roi=0.1,
            assets=100000000.0,
            increase=100000.0,
        )
        for i in range(1, 10)
    ]
    daily_resp = DailyStatsResponse(stats=stats)

    with patch("src.backend.telegram.commands.daily.get_daily_stats", new_callable=AsyncMock) as mock_daily:
        mock_daily.return_value = daily_resp
        await handle_daily(mock_client, chat_id=12345, text="/daily 3")

        mock_client.send_chat_action.assert_awaited_once_with(12345, "typing")
        sent_msg = mock_client.send_message.await_args[0][1]
        assert "최근 3영업일 스냅샷" in sent_msg


@pytest.mark.asyncio
async def test_command_handlers_error_handling():
    """API 호출 실패 시 사용자 친화적인 에러 메시지를 응답하는지 검증합니다."""
    mock_client = MagicMock(spec=TelegramClient)
    mock_client.send_chat_action = AsyncMock(return_value=True)
    mock_client.send_message = AsyncMock(return_value=106)

    # 1. tx 에러
    with patch("src.backend.telegram.commands.tx.get_transactions", new_callable=AsyncMock) as mock_tx:
        mock_tx.side_effect = AssetClientError("DB 조회 실패")
        await handle_transactions(mock_client, chat_id=12345, text="/tx")
        assert "⚠️ 최근 거래내역을 가져오는데 실패했습니다: DB 조회 실패" in mock_client.send_message.await_args[0][1]

    # 2. yearly 에러
    mock_client.send_message.reset_mock()
    with patch("src.backend.telegram.commands.yearly.get_yearly_stats", new_callable=AsyncMock) as mock_yr:
        mock_yr.side_effect = AssetClientError("통계 연산 오류")
        await handle_yearly(mock_client, chat_id=12345, text="/yearly")
        assert "⚠️ 연간 수익률 정보를 가져오는데 실패했습니다: 통계 연산 오류" in mock_client.send_message.await_args[0][1]

    # 3. daily 에러
    mock_client.send_message.reset_mock()
    with patch("src.backend.telegram.commands.daily.get_daily_stats", new_callable=AsyncMock) as mock_dy:
        mock_dy.side_effect = AssetClientError("스냅샷 서버 응답 없음")
        await handle_daily(mock_client, chat_id=12345, text="/daily")
        assert "⚠️ 일별 수익률 정보를 가져오는데 실패했습니다: 스냅샷 서버 응답 없음" in mock_client.send_message.await_args[0][1]


# ============================================================================
# 4. TelegramBot 롱폴링 엔드투엔드 라우팅 (/tx, /yearly, /daily) 테스트
# ============================================================================

@pytest.mark.asyncio
async def test_bot_routes_tx_yearly_daily_commands():
    """TelegramBot이 /tx, /yearly, /daily 명령어를 수신하여 각각 적절한 핸들러로 라우팅하는지 검증합니다."""
    tg_config = TelegramConfig(
        bot_token="test_token",
        allowed_user_ids=[12345],
        enabled=True,
    )
    mock_client = MagicMock(spec=TelegramClient)
    mock_client.send_chat_action = AsyncMock(return_value=True)
    mock_client.send_message = AsyncMock(return_value=200)

    # 3개 명령어에 대한 순차 updates 모킹
    updates = [
        {
            "update_id": 701,
            "message": {
                "message_id": 81,
                "from": {"id": 12345},
                "chat": {"id": 12345},
                "text": "/tx 3",
            },
        },
        {
            "update_id": 702,
            "message": {
                "message_id": 82,
                "from": {"id": 12345},
                "chat": {"id": 12345},
                "text": "/yearly",
            },
        },
        {
            "update_id": 703,
            "message": {
                "message_id": 83,
                "from": {"id": 12345},
                "chat": {"id": 12345},
                "text": "/daily 5",
            },
        },
    ]
    mock_client.get_updates = AsyncMock(return_value=updates)

    with patch("src.backend.telegram.commands.tx.get_transactions", new_callable=AsyncMock) as mock_tx, \
         patch("src.backend.telegram.commands.yearly.get_yearly_stats", new_callable=AsyncMock) as mock_yr, \
         patch("src.backend.telegram.commands.daily.get_daily_stats", new_callable=AsyncMock) as mock_dy:

        mock_tx.return_value = TransactionsResponse(transactions=[])
        mock_yr.return_value = YearlyStatsResponse(stats=[])
        mock_dy.return_value = DailyStatsResponse(stats=[])

        bot = TelegramBot(config=tg_config, client=mock_client)
        next_offset = await bot.poll_once(offset=700)

        assert next_offset == 704
        assert mock_client.send_chat_action.await_count == 3
        assert mock_client.send_message.await_count == 3
