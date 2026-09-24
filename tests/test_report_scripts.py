# -*- coding: utf-8 -*-
"""리포트 스킬 보조 CLI 스크립트 단위 테스트 모듈입니다.

scripts/send_telegram.py, scripts/get_storage_dir.py, scripts/query_market.py,
scripts/query_news.py, scripts/query_us_news.py, scripts/resolve_url.py 의 동작을
Mocking을 활용하여 독립적으로 검증합니다.
"""

import json
import os
import subprocess
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
import httpx


@pytest.fixture
def mock_settings(monkeypatch, tmp_path):
    """임시 설정을 주입하는 fixture입니다."""
    from src.backend.config import Settings, TelegramConfig, NaverConfig

    storage_path = tmp_path / "test_storage"
    storage_path.mkdir(parents=True, exist_ok=True)

    settings = Settings(
        telegram=TelegramConfig(
            bot_token="test_token_12345",
            allowed_user_ids=[12345678, 87654321],
            enabled=True,
            storage_dir=str(storage_path),
        ),
        naver=NaverConfig(
            client_id="test_naver_client_id",
            client_secret="test_naver_client_secret",
        ),
    )
    monkeypatch.setattr("src.backend.config._settings_instance", settings)
    return settings


# ==============================================================================
# 1. get_storage_dir.py 테스트
# ==============================================================================
def test_get_storage_dir_output(mock_settings):
    """get_storage_dir.py 스크립트가 설정된 storage_dir의 절대 경로를 올바르게 반환하는지 검증합니다."""
    from scripts.get_storage_dir import get_resolved_storage_dir

    resolved = get_resolved_storage_dir()
    assert Path(resolved).is_absolute()
    assert Path(resolved) == Path(mock_settings.telegram.storage_dir).resolve()


def test_get_storage_dir_cli(mock_settings):
    """get_storage_dir.py CLI 실행 시 stdout으로 절대 경로를 출력하는지 검증합니다."""
    env = os.environ.copy()
    env["TELEGRAM_STORAGE_DIR"] = mock_settings.telegram.storage_dir

    result = subprocess.run(
        [sys.executable, "scripts/get_storage_dir.py"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        env=env,
        check=True,
    )
    output = result.stdout.strip()
    assert Path(output).is_absolute()
    assert Path(output) == Path(mock_settings.telegram.storage_dir).resolve()


def test_get_storage_dir_with_quotes_and_spaces(monkeypatch):
    """get_storage_dir가 따옴표 및 공백이 포함된 경로를 안정적으로 해석하여 반환하는지 검증합니다."""
    from scripts.get_storage_dir import get_resolved_storage_dir
    from src.backend.config import Settings, TelegramConfig

    # 따옴표와 공백이 포함된 Google Drive 경로
    test_dir = '  "G:/내 드라이브/투자/Asset_jun_bot_storage"  '
    settings = Settings(
        telegram=TelegramConfig(storage_dir=test_dir),
    )
    monkeypatch.setattr("src.backend.config._settings_instance", settings)

    resolved = get_resolved_storage_dir()
    assert Path(resolved).is_absolute()
    # 양쪽 공백 및 따옴표가 제거된 경로와 일치해야 함
    expected = Path("G:/내 드라이브/투자/Asset_jun_bot_storage").resolve()
    assert resolved == expected


# ==============================================================================

# 2. send_telegram.py 테스트
# ==============================================================================
@pytest.mark.asyncio
async def test_send_telegram_message_function(mock_settings):
    """send_telegram_message 함수가 텔레그램 Bot API로 정상 메시지를 발송하는지 검증합니다."""
    from scripts.send_telegram import send_telegram_message

    mock_resp = httpx.Response(
        status_code=200,
        json={"ok": True, "result": {"message_id": 999}},
        request=httpx.Request("POST", "https://api.telegram.org/bottest_token_12345/sendMessage"),
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp

        # 1) 기본 대상자 전체 발송
        result = await send_telegram_message("안녕하세요 테스트입니다.")
        assert "12345678" in result
        assert "87654321" in result
        assert mock_post.call_count == 2

        # 2) 특정 chat_id 지정 발송
        mock_post.reset_mock()
        result_single = await send_telegram_message("단일 전송", chat_id=12345678)
        assert "12345678" in result_single
        assert mock_post.call_count == 1


def test_send_telegram_cli_with_text_and_file(mock_settings, tmp_path):
    """send_telegram.py CLI 실행 시 텍스트 인자 및 파일 내용 발송이 정상 동작하는지 검증합니다."""
    msg_file = tmp_path / "test_report.md"
    msg_file.write_text("📊 일일 보고서 내용 파일입니다.", encoding="utf-8")

    with patch("scripts.send_telegram.send_telegram_message", new_callable=AsyncMock) as mock_send:
        from scripts.send_telegram import main_cli

        mock_send.return_value = "Telegram message sent successfully to 12345678."

        # 1) 텍스트 직접 전달
        with patch.object(sys, "argv", ["scripts/send_telegram.py", "직접 텍스트 메시지", "12345678"]):
            main_cli()
            mock_send.assert_called_with("직접 텍스트 메시지", chat_id=12345678)

        # 2) 파일 경로 전달
        mock_send.reset_mock()
        with patch.object(sys, "argv", ["scripts/send_telegram.py", str(msg_file)]):
            main_cli()
            mock_send.assert_called_with("📊 일일 보고서 내용 파일입니다.", chat_id=None)


# ==============================================================================
# 3. query_market.py 테스트
# ==============================================================================
@pytest.mark.asyncio
async def test_query_market_holiday(mock_settings, capsys):
    """query_market.py의 holiday 액션이 정상 포맷으로 출력되는지 검증합니다."""
    from scripts.query_market import run_check_holiday

    mock_resp = httpx.Response(
        status_code=200,
        json={
            "date": "2026-09-12",
            "country": "KR",
            "is_holiday": True,
            "description": "토요일 휴장",
        },
        request=httpx.Request("GET", "http://localhost:8000/api/market/holiday"),
    )

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp

        await run_check_holiday(date="2026-09-12", country="KR")
        captured = capsys.readouterr().out
        assert "DATE: 2026-09-12" in captured
        assert "COUNTRY: KR" in captured
        assert "IS_HOLIDAY: True" in captured
        assert "DESCRIPTION: 토요일 휴장" in captured


@pytest.mark.asyncio
async def test_query_market_indices(mock_settings, capsys):
    """query_market.py의 indices 액션이 지수 가격 및 변동률을 정상 출력하는지 검증합니다."""
    from scripts.query_market import run_get_indices

    mock_resp = httpx.Response(
        status_code=200,
        json=[
            {"index_name": "KOSPI", "current_price": 2750.5, "change_rate": 1.25},
            {"index_name": "KOSDAQ", "current_price": 860.2, "change_rate": -0.45},
        ],
        request=httpx.Request("GET", "http://localhost:8000/api/market/indices"),
    )

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp

        await run_get_indices(country="KR")
        captured = capsys.readouterr().out
        assert "INDEX_KOSPI_PRICE: 2750.5" in captured
        assert "INDEX_KOSPI_CHANGE: 1.25" in captured
        assert "INDEX_KOSDAQ_PRICE: 860.2" in captured
        assert "INDEX_KOSDAQ_CHANGE: -0.45" in captured


@pytest.mark.asyncio
async def test_query_market_history(mock_settings, capsys):
    """query_market.py의 history 액션이 시계열 데이터와 변동 분석을 정상 계산하여 출력하는지 검증합니다."""
    from scripts.query_market import run_get_history

    mock_resp = httpx.Response(
        status_code=200,
        json={
            "^KS11": [
                {"date": "2026-09-01", "close_price": 2700.0},
                {"date": "2026-09-05", "close_price": 2754.0},
            ]
        },
        request=httpx.Request("GET", "http://localhost:8000/api/market/history"),
    )

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp

        await run_get_history(tickers_str="^KS11", start_date="2026-09-01", end_date="2026-09-05")
        captured = capsys.readouterr().out
        assert "[^KS11 지수 역사적 가격 정보]" in captured
        assert "DATE: 2026-09-01 | CLOSE_PRICE: 2700.0" in captured
        assert "DATE: 2026-09-05 | CLOSE_PRICE: 2754.0" in captured
        assert "[^KS11 지수 변동 분석]" in captured
        assert "+2.00%" in captured


@pytest.mark.asyncio
async def test_query_market_history_zero_price_guard(mock_settings, capsys):
    """query_market.py가 시작가 0원인 비정상 데이터에 대해 ZeroDivisionError 없이 안전하게 처리하는지 검증합니다."""
    from scripts.query_market import run_get_history

    mock_resp = httpx.Response(
        status_code=200,
        json={
            "^TEST": [
                {"date": "2026-09-01", "close_price": 0.0},
                {"date": "2026-09-05", "close_price": 100.0},
            ]
        },
        request=httpx.Request("GET", "http://localhost:8000/api/market/history"),
    )

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp

        await run_get_history(tickers_str="^TEST", start_date="2026-09-01", end_date="2026-09-05")
        captured = capsys.readouterr().out
        assert "CHANGE: 0.00 (0.00%)" in captured



# ==============================================================================
# 4. query_news.py 테스트
# ==============================================================================
@pytest.mark.asyncio
async def test_query_news_search_and_html_cleaning(mock_settings):
    """query_news.py가 네이버 뉴스 API를 호출하여 HTML 태그를 정제하고 날짜 필터를 적용하는지 검증합니다."""
    from scripts.query_news import search_naver_news

    sample_response = {
        "lastBuildDate": "Sat, 12 Sep 2026 12:00:00 +0900",
        "total": 100,
        "start": 1,
        "display": 10,
        "items": [
            {
                "title": "&quot;코스피 <b>반등</b> 성공&quot;... 외국인 순매수",
                "originallink": "https://news.example.com/1",
                "link": "https://n.news.naver.com/1",
                "description": "한국 증시가 <b>상승세</b>로 마감했다.",
                "pubDate": "Sat, 12 Sep 2026 10:30:00 +0900",
            },
            {
                "title": "지난주 뉴스 제목",
                "originallink": "https://news.example.com/2",
                "link": "https://n.news.naver.com/2",
                "description": "지난주 시황 내용입니다.",
                "pubDate": "Mon, 07 Sep 2026 09:00:00 +0900",
            },
        ],
    }

    mock_resp = httpx.Response(
        status_code=200,
        json=sample_response,
        request=httpx.Request("GET", "https://openapi.naver.com/v1/search/news.json"),
    )

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp

        items = await search_naver_news(query="코스피", display=10)
        assert len(items) == 2
        assert items[0]["title"] == '"코스피 반등 성공"... 외국인 순매수'
        assert items[0]["description"] == "한국 증시가 상승세로 마감했다."

        filtered_items = await search_naver_news(query="코스피", display=10, target_date="2026-09-12")
        assert len(filtered_items) == 1
        assert filtered_items[0]["title"] == '"코스피 반등 성공"... 외국인 순매수'


@pytest.mark.asyncio
async def test_query_news_date_pagination_and_early_exit(mock_settings):
    """query_news.py가 날짜순(sort=date) 검색 시 페이지네이션을 통해 타겟 날짜 기사를 찾고, 과거 날짜 도달 시 즉시 탐색을 종료하는지 검증합니다."""
    from scripts.query_news import search_naver_news

    # 1페이지 (start=1): 2026-09-25 기사들 (타겟 날짜 2026-09-24보다 미래)
    page1_response = {
        "total": 500,
        "start": 1,
        "display": 100,
        "items": [
            {
                "title": "오늘(25일) 최신 속보 1",
                "link": "https://n.news.naver.com/25-1",
                "description": "오늘 장 개장 전 뉴스",
                "pubDate": "Fri, 25 Sep 2026 08:00:00 +0900",
            },
            {
                "title": "오늘(25일) 최신 속보 2",
                "link": "https://n.news.naver.com/25-2",
                "description": "오늘 장 개장 전 뉴스 2",
                "pubDate": "Fri, 25 Sep 2026 07:00:00 +0900",
            },
        ],
    }

    # 2페이지 (start=101): 2026-09-24 타겟 기사 2개 + 2026-09-23 과거 기사 1개
    page2_response = {
        "total": 500,
        "start": 101,
        "display": 100,
        "items": [
            {
                "title": "어제(24일) 코스피 마감 시황",
                "link": "https://n.news.naver.com/24-1",
                "description": "코스피 마감 기사 내용",
                "pubDate": "Thu, 24 Sep 2026 16:00:00 +0900",
            },
            {
                "title": "어제(24일) 증시 마감 요약",
                "link": "https://n.news.naver.com/24-2",
                "description": "외국인 매수 마감",
                "pubDate": "Thu, 24 Sep 2026 15:30:00 +0900",
            },
            {
                "title": "그제(23일) 지난 기사",
                "link": "https://n.news.naver.com/23-1",
                "description": "그제 지난 뉴스",
                "pubDate": "Wed, 23 Sep 2026 18:00:00 +0900",
            },
        ],
    }

    resp1 = httpx.Response(status_code=200, json=page1_response, request=httpx.Request("GET", "https://openapi.naver.com/v1/search/news.json"))
    resp2 = httpx.Response(status_code=200, json=page2_response, request=httpx.Request("GET", "https://openapi.naver.com/v1/search/news.json"))

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = [resp1, resp2]

        items = await search_naver_news(query="코스피 마감", display=10, sort="date", target_date="2026-09-24")

        # 1) 타겟 날짜인 2026-09-24 기사 2개만 수집되었는지 확인
        assert len(items) == 2
        assert items[0]["title"] == "어제(24일) 코스피 마감 시황"
        assert items[1]["title"] == "어제(24일) 증시 마감 요약"

        # 2) 2페이지에서 2026-09-23을 만나 조기 종료(Early Exit)되었으므로 총 2회만 호출되었는지 검증 (3페이지 호출 안 함)
        assert mock_get.call_count == 2


@pytest.mark.asyncio
async def test_query_news_rate_limit_retry(mock_settings):
    """query_news.py가 429 Too Many Requests 발생 시 백오프 대기 후 재시도하여 성공하는지 검증합니다."""
    from scripts.query_news import search_naver_news

    resp_429 = httpx.Response(
        status_code=429,
        request=httpx.Request("GET", "https://openapi.naver.com/v1/search/news.json"),
    )
    resp_200 = httpx.Response(
        status_code=200,
        json={
            "total": 1,
            "start": 1,
            "display": 1,
            "items": [
                {
                    "title": "재시도 성공 기사",
                    "link": "https://n.news.naver.com/success",
                    "description": "성공 내용",
                    "pubDate": "Fri, 25 Sep 2026 08:00:00 +0900",
                }
            ],
        },
        request=httpx.Request("GET", "https://openapi.naver.com/v1/search/news.json"),
    )

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get, \
         patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        mock_get.side_effect = [resp_429, resp_200]

        items = await search_naver_news(query="코스피", display=1)
        assert len(items) == 1
        assert items[0]["title"] == "재시도 성공 기사"
        assert mock_get.call_count == 2
        assert mock_sleep.call_count == 1



# ==============================================================================
# 5. query_us_news.py 테스트
# ==============================================================================
def test_query_us_news_yfinance(capsys):
    """query_us_news.py가 yfinance로부터 뉴스를 수집하여 마크다운 리스트로 출력하는지 검증합니다."""
    from scripts.query_us_news import run_query_us_news

    mock_news = [
        {
            "content": {
                "title": "Wall Street closes higher as tech rallies",
                "clickThroughUrl": {"url": "https://finance.yahoo.com/news/tech-rally"},
                "provider": {"displayName": "Reuters"},
            }
        },
        {
            "content": {
                "title": "Fed hints at upcoming rate decisions",
                "canonicalUrl": {"url": "https://finance.yahoo.com/news/fed-rates"},
                "provider": {"displayName": "Bloomberg"},
            }
        },
    ]

    with patch("yfinance.Ticker") as mock_ticker_class:
        mock_instance = MagicMock()
        mock_instance.news = mock_news
        mock_ticker_class.return_value = mock_instance

        run_query_us_news(limit=2)
        captured = capsys.readouterr().out
        assert "- [Wall Street closes higher as tech rallies](https://finance.yahoo.com/news/tech-rally) (Reuters)" in captured
        assert "- [Fed hints at upcoming rate decisions](https://finance.yahoo.com/news/fed-rates) (Bloomberg)" in captured


def test_query_us_news_yfinance_legacy_fallback(capsys):
    """query_us_news.py가 구버전 yfinance의 최상위 title/link/publisher 키를 fallback으로 지원하는지 검증합니다."""
    from scripts.query_us_news import run_query_us_news

    mock_news_legacy = [
        {
            "title": "Legacy format news title",
            "link": "https://finance.yahoo.com/news/legacy",
            "publisher": "CNBC",
        }
    ]

    with patch("yfinance.Ticker") as mock_ticker_class:
        mock_instance = MagicMock()
        mock_instance.news = mock_news_legacy
        mock_ticker_class.return_value = mock_instance

        run_query_us_news(limit=1)
        captured = capsys.readouterr().out
        assert "- [Legacy format news title](https://finance.yahoo.com/news/legacy) (CNBC)" in captured



# ==============================================================================
# 6. resolve_url.py 테스트
# ==============================================================================
@pytest.mark.asyncio
async def test_resolve_url_redirect():
    """resolve_url.py가 리다이렉트 URL을 추적하여 최종 목적지 URL을 반환하는지 검증합니다."""
    from scripts.resolve_url import resolve_redirect_url

    mock_resp = MagicMock()
    mock_resp.url = httpx.URL("https://news.example.com/final/article-1234")

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp

        final_url = await resolve_redirect_url("https://short.url/abc")
        assert final_url == "https://news.example.com/final/article-1234"


# ==============================================================================
# 7. query_stock.py & query_asset.py 테스트
# ==============================================================================
@pytest.mark.asyncio
async def test_query_stock_cli(capsys):
    """query_stock.py가 주가 데이터를 정상 조회하여 출력하는지 검증합니다."""
    mock_resp = httpx.Response(
        status_code=200,
        json={
            "ticker": "AAPL",
            "name": "Apple Inc.",
            "market": "US",
            "prices": [{"date": "2026-09-10", "close_price": 220.5}],
        },
        request=httpx.Request("GET", "http://localhost:8000/api/stocks/prices"),
    )

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp

        with patch.object(
            sys, "argv", ["scripts/query_stock.py", "--ticker", "AAPL", "--start-date", "2026-09-10"]
        ):
            from scripts.query_stock import main_async

            await main_async()
            captured = capsys.readouterr().out
            assert "[Apple Inc. (AAPL) US 주가 정보]" in captured
            assert "DATE: 2026-09-10 | CLOSE_PRICE: 220.5" in captured


@pytest.mark.asyncio
async def test_query_asset_cli(capsys):
    """query_asset.py가 자산 요약 데이터를 정상 조회하여 JSON으로 출력하는지 검증합니다."""
    mock_resp = httpx.Response(
        status_code=200,
        json={
            "total_valuation_krw": 100000000.0,
            "total_contribution": 80000000.0,
            "initial_base_asset": 0.0,
            "total_profit": 20000000.0,
            "cumulative_roi": 25.0,
            "contribution_ratio": 80.0,
            "profit_ratio": 20.0,
            "exchange_rate": {"USDKRW": 1350.0},
            "latest_price_date": "2026-09-11",
        },
        request=httpx.Request("GET", "http://localhost:8000/api/dashboard/summary"),
    )

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp

        with patch.object(sys, "argv", ["scripts/query_asset.py", "--action", "summary"]):
            from scripts.query_asset import main_async as query_asset_main

            await query_asset_main()
            captured = capsys.readouterr().out
            assert "100000000.0" in captured
            assert "25.0" in captured

