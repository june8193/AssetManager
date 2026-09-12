# -*- coding: utf-8 -*-
"""텔레그램 Bot API 비동기 통신 클라이언트 모듈입니다.

httpx.AsyncClient를 기반으로 커넥션 풀링을 활용하여 메시지 발송, 수정,
롱폴링 업데이트 수신(getUpdates) 및 커맨드 목록 등록(setMyCommands)을 수행합니다.
"""

import json
import logging
import re
from typing import Any
import httpx

logger = logging.getLogger(__name__)


def markdown_to_html(text: str) -> str:
    """마크다운 텍스트를 텔레그램 규격 HTML 서식으로 변환합니다.

    Args:
        text: 원본 마크다운 텍스트

    Returns:
        텔레그램 HTML 규격에 맞춰 변환된 텍스트
    """
    if not text:
        return ""

    # HTML 특수문자 이스케이프
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # 코드 블록 및 인라인 코드
    text = re.sub(r"```([\s\S]*?)```", r"<pre>\1</pre>", text)
    text = re.sub(r"`([^`\n]+)`", r"<code>\1</code>", text)
    # 볼드
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"\*([^*]+)\*", r"<b>\1</b>", text)
    # 링크
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', text)
    # 인용문
    text = re.sub(
        r"^\s*&gt;\s*(.*?)$", r"<blockquote>\1</blockquote>", text, flags=re.MULTILINE
    )
    # 제목
    text = re.sub(r"^\s*#{1,6}\s*(.*?)$", r"<b>\1</b>", text, flags=re.MULTILINE)
    # 구분선
    text = re.sub(r"^\s*---\s*$", "━━━━━━━━━━━━━━━━━━━━", text, flags=re.MULTILINE)

    return text


def remove_markdown_markup(text: str) -> str:
    """텍스트에서 마크다운 마크업 기호를 제거하고 순수 일반 텍스트로 변환합니다.

    Args:
        text: 마크다운 서식이 포함된 원본 텍스트

    Returns:
        서식 기호가 제거된 순수 일반 텍스트
    """
    if not text:
        return ""

    text = text.replace("```", "")
    text = text.replace("`", "")
    text = text.replace("**", "").replace("*", "")
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"^\s*>\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*#{1,6}\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*---\s*$", "", text, flags=re.MULTILINE)

    return text


class TelegramClient:
    """Telegram Bot REST API 송수신을 담당하는 비동기 클라이언트 클래스입니다."""

    def __init__(
        self,
        bot_token: str = "",
        base_url: str | None = None,
        http_client: httpx.AsyncClient | None = None,
    ):
        """TelegramClient 인스턴스를 초기화합니다.

        Args:
            bot_token: 텔레그램 봇 API 토큰
            base_url: Telegram API 기본 URL (생략 시 bot_token 기반 자동 생성)
            http_client: 외부에서 주입할 httpx.AsyncClient 인스턴스 (생략 시 내부 관리)
        """
        self.bot_token = bot_token
        if base_url:
            self.base_url = base_url.rstrip("/")
        else:
            self.base_url = f"https://api.telegram.org/bot{bot_token}"

        self._external_client = http_client is not None
        self._http_client = http_client

    def _get_http_client(self, timeout: float = 10.0) -> httpx.AsyncClient:
        """재사용 가능한 httpx.AsyncClient 인스턴스를 반환합니다.

        Args:
            timeout: 클라이언트 요청 타임아웃 (초)

        Returns:
            httpx.AsyncClient 인스턴스
        """
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(timeout=timeout)
        return self._http_client

    async def aclose(self) -> None:
        """내부에서 생성된 HTTP 클라이언트를 종료하고 소켓 리소스를 해제합니다."""
        if not self._external_client and self._http_client is not None:
            if not self._http_client.is_closed:
                await self._http_client.aclose()
            self._http_client = None

    async def __aenter__(self) -> "TelegramClient":
        """비동기 컨텍스트 매니저 진입."""
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """비동기 컨텍스트 매니저 종료 시 리소스 해제."""
        await self.aclose()

    async def send_message(
        self,
        chat_id: int,
        text: str,
        parse_mode: str | None = "HTML",
    ) -> int | None:
        """사용자에게 Telegram 메시지를 전송합니다.

        1차로 지정된 parse_mode(기본 HTML)로 전송을 시도하고,
        실패할 경우 마크다운 마크업을 제거한 일반 텍스트로 Fallback 재전송합니다.

        Args:
            chat_id: 텔레그램 대화방 또는 사용자 ID
            text: 전송할 원본 마크다운 텍스트
            parse_mode: 파싱 모드 ("HTML" 또는 None)

        Returns:
            성공 시 생성된 메시지 ID (message_id: int), 최종 실패 시 None
        """
        url = f"{self.base_url}/sendMessage"
        content_to_send = markdown_to_html(text) if parse_mode == "HTML" else text

        payload: dict[str, Any] = {
            "chat_id": chat_id,
            "text": content_to_send,
        }
        if parse_mode:
            payload["parse_mode"] = parse_mode

        client = self._get_http_client(timeout=10.0)
        try:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            if data.get("ok") and data.get("result"):
                return data["result"].get("message_id")
        except httpx.HTTPError as exc:
            logger.warning(
                f"Telegram sendMessage 1차 전송 실패 (Chat ID: {chat_id}): {exc}"
            )

            # Fallback: 일반 텍스트 모드로 재전송
            plain_body = remove_markdown_markup(text)
            error_detail = str(exc)
            if isinstance(exc, httpx.HTTPStatusError):
                try:
                    err_json = exc.response.json()
                    error_detail = (
                        f"{exc.response.status_code} "
                        f"{err_json.get('description', exc.response.reason_phrase)}"
                    )
                except (json.JSONDecodeError, ValueError):
                    error_detail = f"{exc.response.status_code} {exc.response.reason_phrase}"

            fallback_text = (
                "⚠️ 메시지 전송 중 오류가 발생했습니다.\n"
                f"원인: {error_detail}\n\n"
                "--- [전송 실패한 답변 내용] ---\n"
                f"{plain_body}"
            )

            fallback_payload: dict[str, Any] = {
                "chat_id": chat_id,
                "text": fallback_text,
                "parse_mode": None,
            }

            try:
                response2 = await client.post(url, json=fallback_payload)
                response2.raise_for_status()
                data2 = response2.json()
                if data2.get("ok") and data2.get("result"):
                    return data2["result"].get("message_id")
            except Exception as fallback_exc:
                logger.critical(
                    f"Telegram Fallback 평문 전송도 실패 (Chat ID: {chat_id}): {fallback_exc}"
                )
        except Exception as exc:
            logger.error(f"Telegram sendMessage 중 예상치 못한 오류: {exc}")

        return None

    async def edit_message(
        self,
        chat_id: int,
        message_id: int,
        text: str,
        parse_mode: str | None = "HTML",
    ) -> bool:
        """기존에 발송된 Telegram 메시지를 수정합니다.

        Args:
            chat_id: 텔레그램 대화방 또는 사용자 ID
            message_id: 수정할 메시지 ID
            text: 변경할 마크다운 텍스트
            parse_mode: 파싱 모드 ("HTML" 또는 None)

        Returns:
            수정 성공 여부
        """
        url = f"{self.base_url}/editMessageText"
        content_to_send = markdown_to_html(text) if parse_mode == "HTML" else text

        payload: dict[str, Any] = {
            "chat_id": chat_id,
            "message_id": message_id,
            "text": content_to_send,
        }
        if parse_mode:
            payload["parse_mode"] = parse_mode

        client = self._get_http_client(timeout=10.0)
        try:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            return True
        except httpx.HTTPError as exc:
            logger.warning(
                f"Telegram editMessageText 1차 수정 실패 (Chat ID: {chat_id}): {exc}"
            )

            plain_body = remove_markdown_markup(text)
            fallback_payload: dict[str, Any] = {
                "chat_id": chat_id,
                "message_id": message_id,
                "text": plain_body,
                "parse_mode": None,
            }
            try:
                response2 = await client.post(url, json=fallback_payload)
                response2.raise_for_status()
                return True
            except Exception as fallback_exc:
                logger.critical(
                    f"Telegram editMessageText Fallback 수정 실패 (Chat ID: {chat_id}): {fallback_exc}"
                )
                return False
        except Exception as exc:
            logger.error(f"Telegram editMessageText 중 예상치 못한 오류: {exc}")
            return False

    async def send_chat_action(self, chat_id: int, action: str = "typing") -> bool:
        """사용자에게 Telegram Chat Action(예: typing)을 전송합니다.

        Args:
            chat_id: 텔레그램 대화방 ID
            action: 액션 종류 (기본값: "typing")

        Returns:
            성공 여부
        """
        url = f"{self.base_url}/sendChatAction"
        payload = {"chat_id": chat_id, "action": action}
        client = self._get_http_client(timeout=5.0)
        try:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            return True
        except Exception as exc:
            logger.warning(f"Telegram sendChatAction 호출 실패 (Chat ID: {chat_id}): {exc}")
            return False

    async def get_updates(
        self,
        offset: int | None = None,
        timeout: int = 30,
        allowed_updates: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """Telegram 서버로부터 새 업데이트 목록을 롱폴링으로 조회합니다.

        Args:
            offset: 수신할 첫 번째 업데이트의 식별자 ID
            timeout: 롱폴링 대기 제한 시간 (초 단위, 기본 30초)
            allowed_updates: 수신할 업데이트 종류 목록 (기본값: ["message"])

        Returns:
            업데이트 객체 딕셔너리 리스트 (오류 시 빈 리스트)
        """
        url = f"{self.base_url}/getUpdates"
        params: dict[str, Any] = {
            "timeout": timeout,
            "allowed_updates": allowed_updates or ["message"],
        }
        if offset is not None:
            params["offset"] = offset

        client_timeout = float(timeout + 5)
        # 롱폴링은 전용 타임아웃이 필요하므로 httpx.AsyncClient를 파라미터 타임아웃과 함께 사용
        client = self._get_http_client(timeout=client_timeout)
        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            if data.get("ok"):
                return data.get("result", [])
            logger.error(f"Telegram getUpdates 응답 오류: {data}")
            return []
        except httpx.HTTPError as exc:
            logger.error(f"Telegram getUpdates HTTP 오류: {exc}")
            return []
        except Exception as exc:
            logger.error(f"Telegram getUpdates 예외: {exc}")
            return []

    async def set_my_commands(self, commands: list[dict[str, str]]) -> bool:
        """텔레그램 봇에 등록될 공식 명령어 목록을 설정합니다.

        Args:
            commands: [{'command': 'help', 'description': '설명'}, ...] 형태의 리스트

        Returns:
            성공 여부
        """
        url = f"{self.base_url}/setMyCommands"
        payload = {"commands": commands}
        client = self._get_http_client(timeout=10.0)

        try:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            return bool(data.get("ok"))
        except Exception as exc:
            logger.error(f"Telegram setMyCommands 호출 실패: {exc}")
            return False
