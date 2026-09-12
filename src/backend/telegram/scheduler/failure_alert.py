# -*- coding: utf-8 -*-
"""백엔드 백그라운드 태스크 장애 감시 및 텔레그램 알림 스케줄러 모듈입니다.

5분 주기로 백엔드 태스크(시세 업데이트, DB 백업, 종목 동기화, 환율 업데이트 등)의 실행 상태를 감시하고,
실패(failed) 및 오류가 감지되면 허가된 모든 사용자에게 텔레그램 긴급 장애 알림을 발송합니다.
동일 실패에 대한 반복 스팸 알림을 방지하기 위해 중복 방지(Deduplication) 및 복구 감지 메커니즘을 포함합니다.
"""

import asyncio
import datetime
import logging
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from ..client import TelegramClient
    from ...config import TelegramConfig
    from ...tasks import BackgroundTaskManager

logger = logging.getLogger(__name__)

# 태스크 식별자별 한글 명칭 매핑
TASK_DISPLAY_NAMES: dict[str, str] = {
    "price_update": "시세 업데이트 (price_update)",
    "db_backup": "DB 자동 백업 (db_backup)",
    "stock_sync": "종목 동기화 (stock_sync)",
    "exchange_rate_update": "환율 업데이트 (exchange_rate_update)",
}


class FailureAlertScheduler:
    """5분 주기 백엔드 태스크 장애 감시 및 텔레그램 긴급 알림 스케줄러 클래스입니다."""

    def __init__(
        self,
        client: "TelegramClient",
        config: "TelegramConfig",
        task_manager: "BackgroundTaskManager | None" = None,
    ) -> None:
        """FailureAlertScheduler 인스턴스를 초기화합니다.

        Args:
            client: 텔레그램 API 클라이언트 인스턴스
            config: 텔레그램 설정 인스턴스
            task_manager: 백엔드 태스크 매니저 인스턴스 (생략 시 전역 task_manager_instance 참조)
        """
        self.client = client
        self.config = config
        self._task_manager = task_manager
        self._is_running = False
        self._task: asyncio.Task | None = None
        # 마지막으로 알림을 보낸 실패 기록: {task_name: (last_error, last_error_time)}
        self._last_alerted_errors: dict[str, tuple[str | None, str | None]] = {}

    @property
    def is_running(self) -> bool:
        """스케줄러 동작 여부를 반환합니다."""
        return self._is_running

    def _get_task_manager(self) -> Any:
        """백그라운드 태스크 매니저 인스턴스를 가져옵니다."""
        if self._task_manager is not None:
            return self._task_manager
        from ...tasks import task_manager_instance
        return task_manager_instance

    def _format_alert_message(
        self,
        task_name: str,
        error_msg: str,
        error_time: str | None,
    ) -> str:
        """텔레그램 장애 알림 메시지를 마크다운 형식으로 포맷팅합니다.

        Args:
            task_name: 태스크 식별자
            error_msg: 오류 메시지
            error_time: 오류 발생 시각 문자열

        Returns:
            마크다운으로 포맷된 장애 알림 텍스트
        """
        display_name = TASK_DISPLAY_NAMES.get(task_name, task_name)
        time_str = error_time or datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        lines = [
            "🚨 [백엔드 장애 알림]",
            "백엔드 백그라운드 태스크에서 오류가 감지되었습니다.",
            "",
            f"• 태스크: {display_name}",
            f"• 발생 시각: {time_str}",
            f"• 오류 내용: {error_msg}",
            "",
            "서버 로그 및 상태를 확인해 주시기 바랍니다.",
        ]
        return "\n".join(lines)

    async def check_and_alert(self) -> int:
        """현재 백엔드 태스크들의 상태를 1회 점검하고, 신규 장애 감지 시 알림을 발송합니다.

        Returns:
            새로 알림을 발송한 실패 태스크 수
        """
        task_manager = self._get_task_manager()
        task_status: dict[str, dict[str, Any]] = task_manager.get_task_status()
        alerted_count = 0

        for task_name, info in task_status.items():
            status = info.get("status")
            last_error = info.get("last_error")
            last_error_time = info.get("last_error_time")

            # 1. 상태가 정상(success 등)으로 복구된 경우 캐시 초기화 (향후 재발생 시 알림 발송 허용)
            if status != "failed":
                if task_name in self._last_alerted_errors:
                    logger.info(f"태스크 '{task_name}' 정상 복구 감지. 장애 알림 캐시를 초기화합니다.")
                    self._last_alerted_errors.pop(task_name, None)
                continue

            # 2. failed 상태이지만 에러 메시지가 없는 비정상 케이스 방어
            error_content = last_error or "알 수 없는 백엔드 오류"

            # 3. 중복 알림 방지 (Deduplication) 검사
            previous_alert = self._last_alerted_errors.get(task_name)
            current_alert_key = (error_content, last_error_time)

            if previous_alert == current_alert_key:
                # 이미 동일 오류에 대해 알림 발송 완료됨 -> 스팸 방지를 위해 생략
                continue

            # 4. 신규 장애 알림 메시지 생성 및 모든 허용 사용자에게 발송
            msg = self._format_alert_message(
                task_name=task_name,
                error_msg=error_content,
                error_time=last_error_time,
            )

            for user_id in self.config.allowed_user_ids:
                try:
                    await self.client.send_message(user_id, msg)
                except Exception as exc:
                    logger.error(
                        f"텔레그램 장애 알림 발송 실패 (User ID: {user_id}, 태스크: {task_name}): {exc}"
                    )

            # 알림 발송 성공 기록
            self._last_alerted_errors[task_name] = current_alert_key
            alerted_count += 1
            logger.warning(
                f"백엔드 태스크 장애 알림 발송 완료: {task_name} (오류: {error_content})"
            )

        return alerted_count

    async def run_scheduler_loop(
        self,
        stop_event: asyncio.Event | None = None,
        check_interval: float = 300.0,
    ) -> None:
        """주기적으로 태스크 상태를 감시하는 비동기 루프를 실행합니다.

        Args:
            stop_event: 종료 신호 이벤트 객체 (옵션)
            check_interval: 상태 확인 주기 초 (기본값: 300초 = 5분)
        """
        logger.info(f"백엔드 태스크 장애 감시 스케줄러 루프 시작 (주기: {check_interval}초)")
        self._is_running = True

        try:
            while stop_event is None or not stop_event.is_set():
                if not self._is_running:
                    break

                try:
                    await self.check_and_alert()
                except Exception as loop_err:
                    logger.error(f"장애 감시 스케줄러 점검 중 예외 발생: {loop_err}")

                await asyncio.sleep(check_interval)
        except asyncio.CancelledError:
            logger.info("백엔드 태스크 장애 감시 스케줄러 루프가 취소되었습니다.")
        finally:
            self._is_running = False

    def start(self, check_interval: float = 300.0) -> asyncio.Task | None:
        """장애 감시 스케줄러 백그라운드 태스크를 생성하여 실행합니다.

        Args:
            check_interval: 상태 확인 주기 초 (기본값: 300.0초)

        Returns:
            생성된 asyncio.Task 객체 또는 None
        """
        self._is_running = True
        try:
            loop = asyncio.get_running_loop()
            self._task = loop.create_task(
                self.run_scheduler_loop(check_interval=check_interval)
            )
            return self._task
        except RuntimeError:
            logger.warning("실행 중인 이벤트 루프가 없어 장애 감시 스케줄러 태스크 생성을 생략합니다.")
            return None

    def stop(self) -> None:
        """장애 감시 스케줄러 백그라운드 태스크를 안전하게 취소하고 정지합니다."""
        self._is_running = False
        if self._task and not self._task.done():
            self._task.cancel()
            self._task = None
