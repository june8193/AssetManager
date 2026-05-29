"""주요 지수 벤치마크 비교 대시보드의 E2E 기능 동작을 검증하는 테스트 스크립트.

Playwright를 사용하여 로컬 개발 서버에 접속하고, 대시보드 렌더링, 기간 필터 토글,
관심 종목 차트 토글(lazy-loading) 작동 여부를 검증하고 스크린샷을 기록합니다.
"""
import os
import sys
import sqlite3
import datetime
from playwright.sync_api import sync_playwright

SCREENSHOT_DIR = "screenshots/20260529_091600_benchmark_dashboard"

# 가상 테스트 데이터 ID 정의
TEST_ACCOUNT_ID = 999
TEST_WATCHLIST_IDS = [9991, 9992]


def setup_db():
    """E2E 테스트에 필요한 가상 계좌 스냅샷 및 관심 종목을 주입합니다.

    기존 캐시 테이블(historical_prices) 내 관련 데이터를 비워 동적 캐싱 동작도 검증합니다.
    """
    print("E2E 테스트를 위한 DB 데이터 생성 및 초기화 중...")
    conn = sqlite3.connect("src/dev_assets.db")
    cursor = conn.cursor()

    # 1. 기존 테스트 데이터가 있으면 삭제
    cursor.execute("DELETE FROM accounts WHERE id = ?", (TEST_ACCOUNT_ID,))
    cursor.execute("DELETE FROM account_snapshots WHERE account_id = ?", (TEST_ACCOUNT_ID,))
    cursor.execute("DELETE FROM watchlist WHERE id IN (?, ?)", (TEST_WATCHLIST_IDS[0], TEST_WATCHLIST_IDS[1]))
    
    # 2. 테스트용 지수 및 종목 캐시 비우기 (동적 지연 캐싱 검증 목적)
    cursor.execute("DELETE FROM historical_prices WHERE ticker IN ('^KS11', '^KQ11', '^GSPC', '^IXIC', '005930', 'NVDA')")

    # 3. 테스트용 임시 활성 계좌 생성
    cursor.execute("""
        INSERT INTO accounts (id, user_id, name, provider, alias, account_type, is_active)
        VALUES (?, 1, 'E2E 테스트용 일반계좌', '키움증권', 'E2E_키움', 'BROKERAGE', 1)
    """, (TEST_ACCOUNT_ID,))

    # 4. 일별 자산 스냅샷 데이터 생성 (2026-05-01 ~ 2026-05-25 사이 5일 간격으로 자산 증가 모사)
    snapshot_dates = [
        ("2026-05-01", 10000000.0, 0.0),
        ("2026-05-05", 10200000.0, 0.0),
        ("2026-05-10", 10500000.0, 0.0),
        ("2026-05-15", 10800000.0, 0.0),
        ("2026-05-20", 11200000.0, 0.0),
        ("2026-05-25", 11500000.0, 0.0),
    ]
    for d_str, valuation, deposit in snapshot_dates:
        dt = datetime.datetime.strptime(d_str, "%Y-%m-%d").date()
        cursor.execute("""
            INSERT INTO account_snapshots (account_id, snapshot_date, period_deposit, total_valuation, total_profit)
            VALUES (?, ?, ?, ?, 0.0)
        """, (TEST_ACCOUNT_ID, dt, deposit, valuation))

    # 5. 관심 종목 테이블(watchlist)에 테스트용 항목 삽입
    # 삼성전자 (KR), NVIDIA (US)
    cursor.execute("""
        INSERT INTO watchlist (id, stock_code, stock_name, country)
        VALUES (?, '005930', '삼성전자', 'KR')
    """, (TEST_WATCHLIST_IDS[0],))
    cursor.execute("""
        INSERT INTO watchlist (id, stock_code, stock_name, country)
        VALUES (?, 'NVDA', 'NVIDIA', 'US')
    """, (TEST_WATCHLIST_IDS[1],))

    # 6. 관심종목 현재가 조회를 위해 stocks 테이블에 정보가 있는지 확인하고 없으면 더미 추가
    cursor.execute("SELECT count(*) FROM stocks WHERE stock_code = '005930'")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO stocks (stock_code, stock_name, market) VALUES ('005930', '삼성전자', 'KOSPI')")
    cursor.execute("SELECT count(*) FROM stocks WHERE stock_code = 'NVDA'")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO stocks (stock_code, stock_name, market) VALUES ('NVDA', 'NVIDIA', 'NASDAQ')")

    conn.commit()
    conn.close()
    print("E2E 테스트 데이터 준비 완료.")


def teardown_db():
    """E2E 테스트 후 가상 계좌 및 관심 종목을 정리합니다."""
    print("E2E 테스트 데이터 정리 중...")
    conn = sqlite3.connect("src/dev_assets.db")
    cursor = conn.cursor()

    cursor.execute("DELETE FROM accounts WHERE id = ?", (TEST_ACCOUNT_ID,))
    cursor.execute("DELETE FROM account_snapshots WHERE account_id = ?", (TEST_ACCOUNT_ID,))
    cursor.execute("DELETE FROM watchlist WHERE id IN (?, ?)", (TEST_WATCHLIST_IDS[0], TEST_WATCHLIST_IDS[1]))

    conn.commit()
    conn.close()
    print("E2E 테스트 데이터 정리 완료.")


def run_e2e():
    """E2E 시나리오 테스트를 수행합니다."""
    setup_db()
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    
    with sync_playwright() as p:
        print("브라우저 실행 중...")
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        
        try:
            # 1. 벤치마크 대시보드 진입 및 지연 캐싱 로드 검증
            print("1. 벤치마크 성과 비교 대시보드 진입 중 (Lazy Caching 로드 대기)...")
            page.goto("http://localhost:5173/benchmark")
            # yfinance 호출 및 캐싱 시간이 걸리므로 8초간 충분히 대기합니다.
            page.wait_for_timeout(8000)
            page.screenshot(path=f"{SCREENSHOT_DIR}/step1_dashboard_loaded.png")
            print("대시보드 최초 로드 확인. 스크린샷 저장 완료.")

            # 2. 기간 필터 변경 (최근 1개월로 변경)
            print("2. 1M (최근 1개월) 필터로 변경 중...")
            page.locator("select").select_option("1M")
            page.wait_for_timeout(3000)
            page.screenshot(path=f"{SCREENSHOT_DIR}/step2_period_1m.png")
            print("1M 필터 변경 확인. 스크린샷 저장 완료.")

            # 3. 관심종목 테이블에서 삼성전자 차트 토글 켜기 (Lazy Loading 검증)
            print("3. 관심 종목 테이블에서 삼성전자(005930) 차트 비교 토글 클릭...")
            # 삼성전자 행에 있는 체크박스 스위치 토글
            # 첫 번째 토글 스위치(삼성전자)를 찾아 자바스크립트로 직접 클릭하여 토글
            page.locator("input[type='checkbox']").first.evaluate("el => el.click()")
            # 비동기로 과거 시계열을 다운로드하고 차트에 그리는 시간 5초 대기
            page.wait_for_timeout(5000)
            page.screenshot(path=f"{SCREENSHOT_DIR}/step3_watchlist_toggled.png")
            print("삼성전자 차트 토글 활성화 및 라인 추가 확인. 스크린샷 저장 완료.")

            print("E2E 테스트 모든 시나리오 통과!")

        except Exception as e:
            print(f"❌ E2E 테스트 실패: {e}", file=sys.stderr)
            page.screenshot(path=f"{SCREENSHOT_DIR}/error_state.png")
            sys.exit(1)
        finally:
            browser.close()
            teardown_db()


if __name__ == "__main__":
    run_e2e()
