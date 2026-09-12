# -*- coding: utf-8 -*-
"""시장 지수, 휴장일, 시세 및 알림 관련 AssetManager 로컬 REST API 통신 모듈입니다.

FastAPI 백엔드의 /api/market 및 /api/stocks 엔드포인트를 호출하여
지수, 거래소 휴장일, 과거 시계열 가격 데이터를 조회합니다.
"""

from typing import Any
import httpx

from ...config import get_settings
from ..client import TelegramClient
from .client import get_default_client
from .models import (
    AssetClientError,
    MarketHistoryItem,
    MarketHolidayResponse,
    MarketIndexItem,
    MarketIndicesResponse,
    StockPriceItem,
    StockPricesResponse,
)


async def get_market_indices(country: str = "KR") -> MarketIndicesResponse:
    """AssetManager API로부터 KOSPI/KOSDAQ 또는 미국 지수 정보를 조회하여 반환합니다.

    Args:
        country: 국가 코드 (기본값 'KR', 'US' 지원)

    Returns:
        MarketIndicesResponse: 시장 지수 목록 응답 객체
    """
    client = get_default_client()
    params = {"country": country.upper()}
    data = await client.get_json("/api/market/indices", params=params)

    indices = [
        MarketIndexItem(
            index_name=item.get("index_name", ""),
            current_price=float(item.get("current_price", 0.0)),
            change_rate=float(item.get("change_rate", 0.0)),
        )
        for item in data
    ]
    return MarketIndicesResponse(indices=indices)


async def check_market_holiday(date_str: str = "", country: str = "KR") -> MarketHolidayResponse:
    """AssetManager API로부터 특정 날짜의 특정 국가 시장 휴장일 여부를 조회합니다.

    Args:
        date_str: 조회 일자 (YYYY-MM-DD, 생략 시 오늘)
        country: 국가 코드 ('KR' 또는 'US')

    Returns:
        MarketHolidayResponse: 휴장 여부 정보 모델
    """
    client = get_default_client()
    params: dict[str, Any] = {"country": country.upper()}
    if date_str:
        params["date"] = date_str

    data = await client.get_json("/api/market/holiday", params=params)

    return MarketHolidayResponse(
        date=data.get("date", date_str),
        country=data.get("country", country.upper()),
        is_holiday=data.get("is_holiday", False),
        description=data.get("description", "영업일"),
    )


async def get_market_history(
    tickers: list[str],
    start_date: str | None = None,
    end_date: str | None = None,
) -> dict[str, list[MarketHistoryItem]]:
    """AssetManager API로부터 지정된 지수 티커들의 기간별 역사적 가격 및 실시간 현재가를 통합 조회합니다.

    Args:
        tickers: 조회할 티커 목록 (예: ["^KS11", "^KQ11"])
        start_date: 시작일 (YYYY-MM-DD)
        end_date: 종료일 (YYYY-MM-DD)

    Returns:
        dict[str, list[MarketHistoryItem]]: 티커별 일자별 지수 데이터 매핑
    """
    client = get_default_client()
    params: dict[str, Any] = {"tickers": ",".join(tickers)}
    if start_date:
        params["start_date"] = start_date
    if end_date:
        params["end_date"] = end_date

    data = await client.get_json("/api/market/history", params=params)

    results: dict[str, list[MarketHistoryItem]] = {}
    for ticker, items in data.items():
        results[ticker] = [
            MarketHistoryItem(
                date=item.get("date", ""),
                close_price=float(item.get("close_price", 0.0)),
            )
            for item in items
        ]
    return results


async def get_stock_prices(
    ticker: str,
    start_date: str,
    end_date: str | None = None,
) -> StockPricesResponse:
    """AssetManager API로부터 특정 종목의 현재 및 과거 주가 데이터를 조회합니다.

    Args:
        ticker: 종목 코드 또는 티커
        start_date: 조회 시작일 (YYYY-MM-DD)
        end_date: 조회 종료일 (YYYY-MM-DD)

    Returns:
        StockPricesResponse: 주가 이력 모델
    """
    client = get_default_client()
    params: dict[str, Any] = {"ticker": ticker, "start_date": start_date}
    if end_date:
        params["end_date"] = end_date

    data = await client.get_json("/api/stocks/prices", params=params)

    prices = [
        StockPriceItem(
            date=item.get("date", ""),
            close_price=float(item.get("close_price", 0.0)),
        )
        for item in data.get("prices", [])
    ]
    return StockPricesResponse(
        ticker=data.get("ticker", ticker),
        name=data.get("name", ""),
        market=data.get("market", ""),
        prices=prices,
    )


async def resolve_redirect_url(url: str) -> str:
    """단축 URL 또는 리다이렉트 URL을 추적하여 최종 도달하는 원본 상세 URL을 반환합니다.

    Args:
        url: 원본 단축 또는 리다이렉트 URL

    Returns:
        최종 리다이렉트된 대상 URL
    """
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
            response = await client.get(url, headers=headers)
            return str(response.url)
    except Exception:
        return url


async def send_telegram_message(message: str, chat_id: int | None = None) -> str:
    """설정된 TelegramClient를 통해 사용자에게 메시지를 발송합니다.

    Args:
        message: 전송할 마크다운 메시지 전문
        chat_id: 전송 대상 Chat ID (지정되지 않은 경우 allowed_user_ids 전체로 발송)

    Returns:
        성공 안내 메시지 문자열

    Raises:
        AssetClientError: 발송 대상이 없거나 발송 실패 시 발생
    """
    settings = get_settings()
    bot_token = settings.telegram.bot_token
    if not bot_token:
        raise AssetClientError("텔레그램 봇 토큰이 설정되어 있지 않습니다.")

    if chat_id is not None:
        target_chat_ids = [chat_id]
    else:
        target_chat_ids = list(settings.telegram.allowed_user_ids)

    if not target_chat_ids:
        raise AssetClientError("텔레그램 알림을 전송할 수 있는 허용된 사용자 ID가 존재하지 않습니다.")

    tg_client = TelegramClient(bot_token=bot_token)
    success_targets: list[str] = []
    try:
        for tid in target_chat_ids:
            msg_id = await tg_client.send_message(chat_id=tid, text=message)
            if msg_id is not None:
                success_targets.append(str(tid))
            else:
                raise AssetClientError(f"텔레그램 메시지 전송 실패 (chat_id: {tid})")
    finally:
        await tg_client.aclose()

    return f"Telegram message sent successfully to {', '.join(success_targets)}."
