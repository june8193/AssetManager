# -*- coding: utf-8 -*-
"""FastAPI lifespan 통합, 장애 알림 스케줄러 및 환경 격리 검증 테스트 모듈입니다."""

import asyncio
import datetime
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from src.backend.config import TelegramConfig
from src.backend.telegram.scheduler.failure_alert import FailureAlertScheduler
from src.backend.main import should_start_telegram, lifespan, app


# ============================================================================
# 1. 환경 격리 및 기동 가드 판정 테스트
# ============================================================================


def test_should_start_telegram_disabled_in_pytest():
    """테스트 환경(pytest 실행 중)에서는 무조건 False를 반환해야 합니다."""
    config = TelegramConfig(bot_token="test_token", enabled=True)
    with patch.dict("os.environ", {"APP_ENV": "production", "PYTEST_CURRENT_TEST": "test"}):
        assert should_start_telegram(config) is False


def test_should_start_telegram_disabled_in_development():
    """개발 환경(APP_ENV=development)에서는 bot_token이나 enabled가 있어도 항상 False여야 합니다."""
    config = TelegramConfig(bot_token="test_token", enabled=True)
    with patch.dict("os.environ", {"APP_ENV": "development"}, clear=False):
        with patch("src.backend.main.is_in_testing_environment", return_value=False):
            assert should_start_telegram(config) is False


def test_should_start_telegram_disabled_when_token_empty():
    """봇 토큰이 비어있으면 production이거나 enabled가 True여도 False여야 합니다."""
    config = TelegramConfig(bot_token="", enabled=True)
    with patch.dict("os.environ", {"APP_ENV": "production"}, clear=False):
        with patch("src.backend.main.is_in_testing_environment", return_value=False):
            assert should_start_telegram(config) is False


def test_should_start_telegram_enabled_in_production_with_valid_token():
    """운영 환경(APP_ENV=production)이고 유효한 토큰이 있으면 True를 반환해야 합니다."""
    config = TelegramConfig(bot_token="valid_token", enabled=False)
    with patch.dict("os.environ", {"APP_ENV": "production"}, clear=False):
        with patch("src.backend.main.is_in_testing_environment", return_value=False):
            assert should_start_telegram(config) is True


def test_should_start_telegram_enabled_by_explicit_flag_with_valid_token():
    """enabled=True이고 유효한 토큰이 있으며 개발/테스트 환경이 아니면 True를 반환해야 합니다."""
    config = TelegramConfig(bot_token="valid_token", enabled=True)
    with patch.dict("os.environ", {"APP_ENV": ""}, clear=False):
        with patch("src.backend.main.is_in_testing_environment", return_value=False):
            assert should_start_telegram(config) is True


# ============================================================================
# 2. 백엔드 태스크 장애 알림 스케줄러(FailureAlertScheduler) 테스트
# ============================================================================


@pytest.fixture
def mock_telegram_client():
    """Mock TelegramClient 인스턴스를 생성합니다."""
    client = MagicMock()
    client.send_message = AsyncMock(return_value={"ok": True})
    client.aclose = AsyncMock()
    return client


@pytest.fixture
def telegram_config():
    """테스트용 TelegramConfig 인스턴스를 생성합니다."""
    return TelegramConfig(
        bot_token="test_bot_token",
        allowed_user_ids=[12345, 67890],
        enabled=True,
    )


@pytest.fixture
def mock_task_manager():
    """태스크 상태를 모킹하는 Mock BackgroundTaskManager를 생성합니다."""
    manager = MagicMock()
    manager.get_task_status = MagicMock(
        return_value={
            "price_update": {
                "last_run": "2026-09-12T12:00:00",
                "status": "success",
                "last_success": "2026-09-12T12:00:00",
                "last_error": None,
                "last_error_time": None,
            },
            "db_backup": {
                "last_run": "2026-09-12T11:00:00",
                "status": "success",
                "last_success": "2026-09-12T11:00:00",
                "last_error": None,
                "last_error_time": None,
            },
        }
    )
    return manager


@pytest.mark.asyncio
async def test_failure_alert_scheduler_detects_failed_tasks(
    mock_telegram_client,
    telegram_config,
    mock_task_manager,
):
    """태스크 실패 상태(failed) 감지 시 모든 허용 사용자에게 알림을 발송해야 합니다."""
    mock_task_manager.get_task_status.return_value = {
        "price_update": {
            "last_run": "2026-09-12T12:10:00",
            "status": "failed",
            "last_success": "2026-09-12T12:00:00",
            "last_error": "키움 OpenAPI 연결 시간 초과",
            "last_error_time": "2026-09-12T12:10:00",
        },
        "db_backup": {
            "last_run": "2026-09-12T11:00:00",
            "status": "success",
            "last_success": "2026-09-12T11:00:00",
            "last_error": None,
            "last_error_time": None,
        },
    }

    scheduler = FailureAlertScheduler(
        client=mock_telegram_client,
        config=telegram_config,
        task_manager=mock_task_manager,
    )

    alerted_count = await scheduler.check_and_alert()
    assert alerted_count == 1

    # allowed_user_ids: [12345, 67890] 둘 다에게 발송되었는지 검증
    assert mock_telegram_client.send_message.call_count == 2
    calls = mock_telegram_client.send_message.call_args_list
    target_users = [c[0][0] for c in calls]
    assert 12345 in target_users
    assert 67890 in target_users

    # 메시지에 태스크명과 에러 문구가 포함되었는지 검증
    sent_text = calls[0][0][1]
    assert "🚨 [백엔드 장애 알림]" in sent_text
    assert "price_update" in sent_text or "시세 업데이트" in sent_text
    assert "키움 OpenAPI 연결 시간 초과" in sent_text


@pytest.mark.asyncio
async def test_failure_alert_scheduler_deduplication(
    mock_telegram_client,
    telegram_config,
    mock_task_manager,
):
    """동일한 에러에 대해서는 다음 주기 검사 시 중복 발송하지 않아야 합니다."""
    failed_status = {
        "db_backup": {
            "last_run": "2026-09-12T12:05:00",
            "status": "failed",
            "last_success": "2026-09-12T10:00:00",
            "last_error": "디스크 용량 부족",
            "last_error_time": "2026-09-12T12:05:00",
        }
    }
    mock_task_manager.get_task_status.return_value = failed_status

    scheduler = FailureAlertScheduler(
        client=mock_telegram_client,
        config=telegram_config,
        task_manager=mock_task_manager,
    )

    # 1회차 검사 -> 알림 1건 발송 (사용자 2명)
    alerted_count_1 = await scheduler.check_and_alert()
    assert alerted_count_1 == 1
    assert mock_telegram_client.send_message.call_count == 2

    # 2회차 검사 (상태 동일) -> 중복 알림 방지로 발송 0건이어야 함
    alerted_count_2 = await scheduler.check_and_alert()
    assert alerted_count_2 == 0
    assert mock_telegram_client.send_message.call_count == 2


@pytest.mark.asyncio
async def test_failure_alert_scheduler_re_alerts_on_new_error(
    mock_telegram_client,
    telegram_config,
    mock_task_manager,
):
    """에러 발생 시각이나 에러 내용이 갱신된 새로운 실패는 다시 알림을 발송해야 합니다."""
    scheduler = FailureAlertScheduler(
        client=mock_telegram_client,
        config=telegram_config,
        task_manager=mock_task_manager,
    )

    # 1회차: 에러 1
    mock_task_manager.get_task_status.return_value = {
        "stock_sync": {
            "status": "failed",
            "last_error": "첫 번째 에러",
            "last_error_time": "2026-09-12T12:00:00",
        }
    }
    await scheduler.check_and_alert()
    assert mock_telegram_client.send_message.call_count == 2

    # 2회차: 새로운 에러
    mock_task_manager.get_task_status.return_value = {
        "stock_sync": {
            "status": "failed",
            "last_error": "두 번째 에러 (새로운 오류)",
            "last_error_time": "2026-09-12T12:05:00",
        }
    }
    await scheduler.check_and_alert()
    assert mock_telegram_client.send_message.call_count == 4


@pytest.mark.asyncio
async def test_failure_alert_scheduler_clears_on_recovery(
    mock_telegram_client,
    telegram_config,
    mock_task_manager,
):
    """태스크가 성공으로 복구된 후 다시 동일 에러가 발생하면 재알림이 가능해야 합니다."""
    scheduler = FailureAlertScheduler(
        client=mock_telegram_client,
        config=telegram_config,
        task_manager=mock_task_manager,
    )

    # 1회차: 실패
    mock_task_manager.get_task_status.return_value = {
        "price_update": {
            "status": "failed",
            "last_error": "일시적 네트워크 에러",
            "last_error_time": "2026-09-12T12:00:00",
        }
    }
    await scheduler.check_and_alert()
    assert mock_telegram_client.send_message.call_count == 2

    # 2회차: 성공으로 정상 복구
    mock_task_manager.get_task_status.return_value = {
        "price_update": {
            "status": "success",
            "last_error": None,
            "last_error_time": None,
        }
    }
    await scheduler.check_and_alert()
    assert mock_telegram_client.send_message.call_count == 2

    # 3회차: 다시 실패 발생 (에러 메시지가 같더라도 복구 후 재발생이므로 알림 발송되어야 함)
    mock_task_manager.get_task_status.return_value = {
        "price_update": {
            "status": "failed",
            "last_error": "일시적 네트워크 에러",
            "last_error_time": "2026-09-12T12:15:00",
        }
    }
    await scheduler.check_and_alert()
    assert mock_telegram_client.send_message.call_count == 4


@pytest.mark.asyncio
async def test_failure_alert_scheduler_lifecycle(
    mock_telegram_client,
    telegram_config,
    mock_task_manager,
):
    """start() 및 stop() 수명주기 제어가 올바르게 동작해야 합니다."""
    scheduler = FailureAlertScheduler(
        client=mock_telegram_client,
        config=telegram_config,
        task_manager=mock_task_manager,
    )

    assert scheduler.is_running is False
    task = scheduler.start(check_interval=0.1)
    assert scheduler.is_running is True
    assert task is not None
    assert not task.done()

    # 잠시 대기 후 stop
    await asyncio.sleep(0.05)
    scheduler.stop()
    await asyncio.sleep(0.01)
    assert scheduler.is_running is False
    assert task.cancelled() or task.done()


# ============================================================================
# 3. FastAPI lifespan 수명주기 통합 및 graceful shutdown 테스트
# ============================================================================


@pytest.mark.asyncio
async def test_lifespan_starts_and_stops_telegram_services_when_enabled():
    """활성화 조건 충족 시 lifespan 진입 시 봇/스케줄러가 기동되고 종료 시 안전하게 정리되어야 합니다."""
    mock_bot = MagicMock()
    mock_bot.start_polling = AsyncMock()
    mock_bot.aclose = AsyncMock()

    mock_market_sched = MagicMock()
    mock_market_sched.start = MagicMock(return_value=asyncio.create_task(asyncio.sleep(10)))
    mock_market_sched.stop = MagicMock()

    mock_failure_sched = MagicMock()
    mock_failure_sched.start = MagicMock(return_value=asyncio.create_task(asyncio.sleep(10)))
    mock_failure_sched.stop = MagicMock()

    with (
        patch("src.backend.main.should_start_telegram", return_value=True),
        patch("src.backend.main.TelegramBot", return_value=mock_bot),
        patch("src.backend.main.MarketCloseScheduler", return_value=mock_market_sched),
        patch("src.backend.main.FailureAlertScheduler", return_value=mock_failure_sched),
        patch("src.backend.main.TelegramClient") as mock_client_cls,
        patch("src.backend.migrations.run_migrations"),
        patch("src.backend.database.Base.metadata.create_all"),
    ):
        mock_client = MagicMock()
        mock_client.aclose = AsyncMock()
        mock_client_cls.return_value = mock_client

        async with lifespan(app):
            # lifespan 진입 상태: 봇 롱폴링 및 스케줄러 기동 확인
            assert mock_bot.start_polling.called
            assert mock_market_sched.start.called
            assert mock_failure_sched.start.called

        # lifespan 종료(shutdown) 상태: 정리 로직 확인
        assert mock_market_sched.stop.called
        assert mock_failure_sched.stop.called
        assert mock_bot.aclose.called


@pytest.mark.asyncio
async def test_lifespan_bypasses_telegram_when_disabled():
    """비활성화 조건(should_start_telegram=False) 시 텔레그램 서비스가 기동되지 않아야 합니다."""
    with (
        patch("src.backend.main.should_start_telegram", return_value=False),
        patch("src.backend.main.TelegramBot") as mock_bot_cls,
        patch("src.backend.migrations.run_migrations"),
        patch("src.backend.database.Base.metadata.create_all"),
    ):
        async with lifespan(app):
            pass

        assert not mock_bot_cls.called
