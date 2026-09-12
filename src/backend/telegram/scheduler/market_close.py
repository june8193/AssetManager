# -*- coding: utf-8 -*-
"""장 마감 시각 거래내역 자동 동기화 스케줄러 모듈입니다.

평일(월~금) 18:10 국내장 마감 시점 및 화~토 07:10 미국장 마감 시점에
키움증권으로부터 당일 1일치 거래내역을 자동 동기화하고,
신규 감지된 거래나 미등록 종목이 존재할 때 허가된 사용자들에게 텔레그램 알림을 발송합니다.
"""

import asyncio
import datetime
import logging
from typing import TYPE_CHECKING

from ..asset_client import sync_kiwoom_transactions
from ..renderer import render_auto_sync_notification

if TYPE_CHECKING:
    from ..client import TelegramClient
    from ...config import TelegramConfig

logger = logging.getLogger(__name__)


class MarketCloseScheduler:
    """평일 18:10(국내장) 및 화~토 07:10(미국장) 자동 거래내역 동기화 스케줄러 클래스입니다."""

    def __init__(
        self,
        client: "TelegramClient",
        config: "TelegramConfig",
    ):
        """MarketCloseScheduler 인스턴스를 초기화합니다.

        Args:
            client: 텔레그램 API 클라이언트 인스턴스
            config: 텔레그램 설정 인스턴스
        """
        self.client = client
        self.config = config
        self._is_running = False
        self._task: asyncio.Task | None = None
        self.last_domestic_date: datetime.date | None = None
        self.last_overseas_date: datetime.date | None = None

    @property
    def is_running(self) -> bool:
        """스케줄러 동작 상태를 반환합니다."""
        return self._is_running

    def is_market_close_time(self, now: datetime.datetime) -> tuple[bool, str]:
        """주어진 일시가 장 마감 동기화 실행 시각인지 판정합니다.

        - 국내장 마감: 평일(월~금, weekday: 0~4) 18:10
        - 미국장 마감: 화~토(weekday: 1~5) 07:10

        Args:
            now: 판정 대상 datetime 객체

        Returns:
            tuple[bool, str]: (실행 여부, 마켓 명칭)
        """
        weekday = now.weekday()
        hour = now.hour
        minute = now.minute

        # 1. 국내장 마감 (월~금 18:10)
        if weekday in [0, 1, 2, 3, 4] and hour == 18 and minute == 10:
            return True, "국내장 마감"

        # 2. 미국장 마감 (화~토 07:10)
        if weekday in [1, 2, 3, 4, 5] and hour == 7 and minute == 10:
            return True, "미국장 마감"

        return False, ""

    def should_trigger(self, now: datetime.datetime) -> tuple[bool, str]:
        """현재 시각이 실행 시점이고 당일 이미 실행되지 않았는지 확인합니다.

        Args:
            now: 확인할 datetime 객체

        Returns:
            tuple[bool, str]: (트리거 여부, 마켓 명칭)
        """
        should_run, market_name = self.is_market_close_time(now)
        if not should_run:
            return False, ""

        today = now.date()
        if "국내장" in market_name:
            if self.last_domestic_date == today:
                return False, ""
        elif "미국장" in market_name:
            if self.last_overseas_date == today:
                return False, ""

        return True, market_name

    def record_run(self, market_type: str, run_date: datetime.date) -> None:
        """동기화 실행 일자를 기록하여 당일 중복 실행을 방지합니다.

        Args:
            market_type: 마켓 유형 또는 명칭 (예: "domestic", "국내장", "국내장 마감", "overseas", "미국장", "미국장 마감")
            run_date: 실행 일자 (date 객체)
        """
        market_lower = market_type.lower()
        if "domestic" in market_lower or "국내장" in market_type:
            self.last_domestic_date = run_date
        elif "overseas" in market_lower or "미국장" in market_type:
            self.last_overseas_date = run_date

    async def _execute_auto_sync(self, market_name: str = "") -> None:
        """키움 거래내역 1일치를 동기화하고 변경사항 발생 시 사용자에게 알림을 발송합니다.

        Args:
            market_name: 마켓 명칭 (예: "국내장 마감", "미국장 마감")
        """
        try:
            logger.info(f"{market_name} 키움증권 자동 거래내역 동기화 실행 (days=1)...")
            result = await sync_kiwoom_transactions(days=1)

            success_count = (
                result.get("success_count", 0)
                if isinstance(result, dict)
                else getattr(result, "success_count", 0)
            )
            pending_count = (
                result.get("pending_count", 0)
                if isinstance(result, dict)
                else getattr(result, "pending_count", 0)
            )

            # 신규 거래 및 미등록 자산이 모두 없으면 발송 생략
            if success_count == 0 and pending_count == 0:
                logger.info(
                    f"{market_name} 동기화 완료: 새 거래 및 미등록 종목이 없어 텔레그램 알림을 생략합니다."
                )
                return

            msg = render_auto_sync_notification(result, market_name=market_name)

            for user_id in self.config.allowed_user_ids:
                try:
                    await self.client.send_message(user_id, msg)
                except Exception as send_err:
                    logger.error(
                        f"텔레그램 자동 동기화 알림 발송 실패 (User ID: {user_id}): {send_err}"
                    )

        except Exception as exc:
            logger.exception(f"{market_name} 키움증권 자동 동기화 실행 실패: {exc}")
            error_msg = f"⚠️ {market_name} 거래내역 자동 동기화 실행 중 오류가 발생했습니다: {exc}"
            for user_id in self.config.allowed_user_ids:
                try:
                    await self.client.send_message(user_id, error_msg)
                except Exception as send_err:
                    logger.warning(
                        f"에러 알림 발송 실패 (User ID: {user_id}): {send_err}"
                    )


    async def run_scheduler_loop(
        self,
        stop_event: asyncio.Event | None = None,
        check_interval: float = 30.0,
    ) -> None:
        """장 마감 시각 감시 및 자동 동기화 주기적 루프를 실행합니다.

        Args:
            stop_event: 종료 신호 이벤트 객체 (선택 사항)
            check_interval: 루프 확인 간격 초 (기본값: 30초)
        """
        logger.info("장 마감 거래내역 자동 동기화 스케줄러 루프를 시작합니다.")
        self._is_running = True

        try:
            while stop_event is None or not stop_event.is_set():
                if not self._is_running:
                    break

                try:
                    now = datetime.datetime.now()
                    should_trigger, market_name = self.should_trigger(now)

                    if should_trigger:
                        self.record_run(market_name, now.date())
                        await self._execute_auto_sync(market_name)

                except Exception as loop_err:
                    logger.error(f"스케줄러 루프 체크 중 예외 발생: {loop_err}")

                await asyncio.sleep(check_interval)
        except asyncio.CancelledError:
            logger.info("장 마감 스케줄러 루프가 취소되었습니다.")
        finally:
            self._is_running = False

    def start(self) -> asyncio.Task | None:
        """스케줄러 백그라운드 태스크를 생성하여 실행합니다.

        Returns:
            생성된 asyncio.Task 객체 또는 None
        """
        self._is_running = True
        try:
            loop = asyncio.get_running_loop()
            self._task = loop.create_task(self.run_scheduler_loop())
            return self._task
        except RuntimeError:
            logger.warning("실행 중인 이벤트 루프가 없어 백그라운드 태스크 생성을 생략합니다.")
            return None


    def stop(self) -> None:
        """스케줄러 백그라운드 태스크를 안전하게 취소하고 정지합니다."""
        self._is_running = False
        if self._task and not self._task.done():
            self._task.cancel()
            self._task = None
