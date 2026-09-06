"""모바일 지수분석(/m/market) 전체 플로우 E2E 자동 검증 스크립트.

이 스크립트는 Playwright를 사용하여 모바일 뷰포트(390x844) 환경에서 다음 시나리오를 검증합니다:
1. 하단 탭 바를 통한 /m/market 진입
2. [시장 지수] 탭: 4대 지수 칩(S&P 500, NASDAQ, KOSPI, KOSDAQ) 전환, 기간 필터 전환, 3단 동기화 차트 및 VIX 주의(20)/경고(30) 기준선, 2대 극단값 카드 검증
3. [포트폴리오 비교] 탭: MDD 요약 카드, 누적 수익률 선 차트, 범례 토글, 알파 초과수익 카드 및 상세 표 아코디언 토글, 헤더 마스킹 연동 검증
4. 주요 화면 스크린샷 자동 저장
"""
import os
import sys
import time
import datetime
import urllib.request
from typing import Optional

# Windows 콘솔 인코딩 대응
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from playwright.sync_api import sync_playwright, Page

BASE_URL = "http://localhost:5173"
TIMESTAMP = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
SCREENSHOT_DIR = os.path.join("screenshots", f"{TIMESTAMP}_mobile_market_analysis")


def wait_for_server(url: str, timeout: int = 30) -> bool:
    """개발 서버가 정상 응답할 때까지 대기합니다.

    Args:
        url: 헬스체크를 수행할 대상 URL 문자열.
        timeout: 최대 대기 시간(초). 기본값은 30초.

    Returns:
        bool: 서버가 정상(HTTP 200 또는 304)으로 응답하면 True, 타임아웃 초과 시 False.
    """
    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] 개발 서버 준비 상태 확인 중: {url}")
    start = time.time()
    while time.time() - start < timeout:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=2) as response:
                if response.status in (200, 304):
                    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] 서버 응답 확인 성공! (HTTP {response.status})")
                    return True
        except Exception:
            time.sleep(1)
    return False


def wait_for_chart_update(page: Page, timeout: int = 30000) -> None:
    """차트 갱신 중 로딩 인디케이터가 사라지고 렌더링이 완료될 때까지 대기합니다.

    Args:
        page: Playwright Page 인스턴스.
        timeout: 로딩 대기 최대 시간(밀리초). 기본값 30,000ms.
    """
    spinner = page.locator("text=차트 갱신 중...")
    try:
        spinner.wait_for(state="hidden", timeout=timeout)
    except Exception:
        # 이미 사라졌거나 표시되지 않은 경우
        pass
    page.wait_for_timeout(1000)



def take_screenshot(page: Page, filename: str, description: str) -> str:
    """현재 페이지 뷰를 지정된 파일명으로 캡처하고 로그를 출력합니다.

    Args:
        page: Playwright Page 인스턴스.
        filename: 저장할 파일명 (예: '01_home_to_market_tab.png').
        description: 스크린샷 단계 및 검증 항목 설명.

    Returns:
        str: 저장된 스크린샷 파일의 전체 상대 경로.
    """
    filepath = os.path.join(SCREENSHOT_DIR, filename)
    page.screenshot(path=filepath)
    print(f"  [OK] {description}. 스크린샷 저장: {filepath}")
    return filepath


def run_e2e() -> None:
    """모바일 지수분석 시나리오 E2E 전체 검증을 실행합니다.

    Raises:
        AssertionError: DOM 요소 상태 불일치 또는 검증 조건 미충족 시 발생.
        Exception: 페이지 로딩 또는 Playwright 동작 중 예외 발생 시 전파.
    """
    if not wait_for_server(BASE_URL):
        print(f"[ERROR] 개발 서버({BASE_URL})에 연결할 수 없습니다.", file=sys.stderr)
        sys.exit(1)

    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    print(f"[DIR] 스크린샷 저장 디렉토리: {SCREENSHOT_DIR}")

    with sync_playwright() as p:
        # iPhone 13 / 14 규격 (390 x 844)
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 390, "height": 844},
            is_mobile=True,
            has_touch=True,
            device_scale_factor=2,
            user_agent=(
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
            ),
        )
        page = context.new_page()

        try:
            # ==========================================
            # 시나리오 1: 홈 접속 -> 하단 탭 '지수분석' 터치 -> /m/market 이동
            # ==========================================
            print("\n[시나리오 1] 홈 화면 접속 및 지수분석 탭 진입 검증...")
            page.goto(BASE_URL, wait_until="networkidle")
            page.wait_for_timeout(1000)

            # 모바일 하단 탭 바에서 '지수분석' 탭 찾기
            market_tab = page.locator("nav[aria-label='모바일 하단 메뉴'] a:has-text('지수분석')")
            assert market_tab.count() > 0, "하단 탭 바에서 '지수분석' 메뉴를 찾을 수 없습니다."
            
            market_tab.click()
            page.wait_for_url("**/m/market**", timeout=5000)
            page.wait_for_timeout(1500)

            take_screenshot(page, "01_home_to_market_tab.png", "지수분석 라우팅 성공 (/m/market)")

            # ==========================================
            # 시나리오 2: [시장 지수] 탭 검증
            # ==========================================
            print("\n[시나리오 2] [시장 지수] 탭 4대 지수 칩 전환, 기간 필터, 3단 차트 및 극단값 카드 검증...")
            
            # 기본 활성 탭 [시장 지수] 확인
            market_tab_btn = page.locator("#tab-market")
            assert market_tab_btn.get_attribute("aria-selected") == "true", "[시장 지수] 탭이 기본 활성화되어 있어야 합니다."

            # 4대 지수 칩 존재 확인
            sp500_chip = page.locator("[data-testid='index-chip-^GSPC']")
            nasdaq_chip = page.locator("[data-testid='index-chip-^IXIC']")
            kospi_chip = page.locator("[data-testid='index-chip-^KS11']")
            kosdaq_chip = page.locator("[data-testid='index-chip-^KQ11']")
            assert sp500_chip.count() > 0, "S&P 500 칩이 존재해야 합니다."
            assert nasdaq_chip.count() > 0, "NASDAQ 칩이 존재해야 합니다."
            assert kospi_chip.count() > 0, "KOSPI 칩이 존재해야 합니다."
            assert kosdaq_chip.count() > 0, "KOSDAQ 칩이 존재해야 합니다."

            # VIX 상태 요약 카드 확인
            vix_card = page.locator("[data-testid='vix-summary-card']")
            assert vix_card.count() > 0, "VIX 상태 요약 카드가 렌더링되어야 합니다."

            # 3단 밀착 동기화 차트 카드 확인
            stacked_chart = page.locator("[data-testid='mobile-stacked-chart-card']")
            assert stacked_chart.count() > 0, "3단 동기화 차트 카드가 렌더링되어야 합니다."

            # 1단(지수 종가), 2단(MDD), 3단(VIX) 계층 확인
            assert page.locator("[data-testid='chart-tier-price']").count() > 0, "1단 지수 종가 차트가 존재해야 합니다."
            assert page.locator("[data-testid='chart-tier-mdd']").count() > 0, "2단 MDD 차트가 존재해야 합니다."
            assert page.locator("[data-testid='chart-tier-vix']").count() > 0, "3단 VIX 차트가 존재해야 합니다."

            # 초기 차트 데이터 로딩 완료 대기
            wait_for_chart_update(page)

            # VIX 기준선 텍스트('주의 20', '경고 30') 렌더링 확인
            vix_chart_svg = page.locator("[data-testid='chart-tier-vix'] svg")
            assert vix_chart_svg.count() > 0, "VIX 차트 SVG가 렌더링되어야 합니다."
            caution_line = vix_chart_svg.locator("text=주의 20")
            warning_line = vix_chart_svg.locator("text=경고 30")
            assert caution_line.count() > 0, "VIX 차트에 '주의 20' 기준선 라벨이 렌더링되어야 합니다."
            assert warning_line.count() > 0, "VIX 차트에 '경고 30' 기준선 라벨이 렌더링되어야 합니다."

            # 2대 극단값 카드(최대 공포 피크 & 최대 낙폭 바닥) 확인
            extreme_container = page.locator("[data-testid='extreme-stats-cards-container']")
            assert extreme_container.count() > 0, "2대 극단값 카드 컨테이너가 렌더링되어야 합니다."
            max_vix_card = page.locator("[data-testid='extreme-card-max-vix']")
            worst_mdd_card = page.locator("[data-testid='extreme-card-worst-mdd']")
            assert max_vix_card.count() > 0, "기간 내 최대 공포 (VIX 피크) 카드가 렌더링되어야 합니다."
            assert worst_mdd_card.count() > 0, "기간 내 최대 낙폭 (MDD 바닥) 카드가 렌더링되어야 합니다."

            take_screenshot(page, "02_market_indices_sp500.png", "S&P 500 3단 차트, VIX 기준선(주의 20/경고 30), 극단값 카드 검증 완료")

            # 4대 지수 칩 전환: NASDAQ 클릭
            print("  -> NASDAQ 칩으로 전환 중...")
            nasdaq_chip.click()
            wait_for_chart_update(page)
            chart_header = page.locator("[data-testid='mobile-stacked-chart-card'] h2")
            assert "NASDAQ" in chart_header.inner_text(), "차트 헤더가 NASDAQ으로 갱신되어야 합니다."
            take_screenshot(page, "03_market_indices_nasdaq_switched.png", "NASDAQ 지수 칩 전환 검증 완료")

            # 4대 지수 칩 전환: KOSPI 클릭
            print("  -> KOSPI 칩으로 전환 중...")
            kospi_chip.click()
            wait_for_chart_update(page)
            assert "KOSPI" in chart_header.inner_text(), "차트 헤더가 KOSPI로 갱신되어야 합니다."
            take_screenshot(page, "04_market_indices_kospi_switched.png", "KOSPI 지수 칩 전환 검증 완료")

            # 4대 지수 칩 전환: KOSDAQ 클릭 (스펙 리뷰 피드백 반영)
            print("  -> KOSDAQ 칩으로 전환 중...")
            kosdaq_chip.click()
            wait_for_chart_update(page)
            assert "KOSDAQ" in chart_header.inner_text(), "차트 헤더가 KOSDAQ으로 갱신되어야 합니다."
            print("  [OK] KOSDAQ 지수 칩 전환 검증 완료.")

            # 기간 필터 버튼 전환 테스트: 1년(1Y) 버튼 클릭 (스펙 리뷰 피드백 반영)
            print("  -> 기간 필터 버튼 (1년) 전환 테스트 중...")
            period_1y_btn = page.locator("button:has-text('1년')")
            assert period_1y_btn.count() > 0, "1년 기간 필터 버튼이 존재해야 합니다."
            period_1y_btn.click()
            wait_for_chart_update(page)
            assert period_1y_btn.get_attribute("aria-pressed") == "true", "1년 버튼이 활성화되어야 합니다."
            print("  [OK] 1년 기간 필터 버튼 전환 검증 완료.")

            # 기간 필터 원복 (3년)
            page.locator("button:has-text('3년')").click()
            wait_for_chart_update(page)

            # ==========================================
            # 시나리오 3: [포트폴리오 비교] 서브 탭 전환 및 기능 검증
            # ==========================================
            print("\n[시나리오 3] [포트폴리오 비교] 탭 전환 및 성과/알파/마스킹 검증...")
            compare_tab_btn = page.locator("#tab-compare")
            compare_tab_btn.click()
            page.wait_for_timeout(500)

            # 포트폴리오 비교 뷰 노출 대기
            compare_view = page.locator("[data-testid='portfolio-comparison-view']")
            assert compare_view.count() > 0, "포트폴리오 비교 뷰 섹션이 노출되어야 합니다."

            # 로딩 완료 대기
            if page.locator("text=벤치마크 데이터를 분석하는 중...").is_visible():
                page.locator("text=벤치마크 데이터를 분석하는 중...").wait_for(state="hidden", timeout=10000)
            page.wait_for_timeout(1000)

            # MDD 요약 카드 확인 (testId: mdd-summary-card)
            mdd_summary = page.locator("[data-testid='mdd-summary-card']")
            assert mdd_summary.count() > 0, "포트폴리오 & 4대 지수 MDD 요약 카드가 렌더링되어야 합니다."

            # 누적 수익률 비교 선 차트 컨테이너 확인
            benchmark_chart = page.locator("[data-testid='benchmark-chart-container']")
            assert benchmark_chart.count() > 0, "누적 수익률 비교 차트 컨테이너가 렌더링되어야 합니다."

            take_screenshot(page, "05_portfolio_compare_initial.png", "포트폴리오 비교 초기 뷰 검증 완료")

            # 범례 칩 토글 테스트: '내 포트폴리오' 시리즈 칩 클릭하여 숨김 토글
            print("  -> 범례 칩 토글 ('내 포트폴리오') 테스트 중...")
            portfolio_legend_chip = page.locator("[data-testid='legend-chip-내 포트폴리오']")
            assert portfolio_legend_chip.count() > 0, "내 포트폴리오 범례 칩이 존재해야 합니다."
            assert portfolio_legend_chip.get_attribute("aria-pressed") == "true"

            portfolio_legend_chip.click()
            page.wait_for_timeout(500)
            assert portfolio_legend_chip.get_attribute("aria-pressed") == "false", "범례 클릭 후 aria-pressed가 false가 되어야 합니다."

            take_screenshot(page, "06_portfolio_compare_series_toggle.png", "차트 범례 칩 토글 검증 완료")

            # 범례 다시 켜기
            portfolio_legend_chip.click()
            page.wait_for_timeout(300)

            # 알파 초과수익 카드 리스트 확인 및 스크롤
            alpha_list = page.locator("[data-testid='mobile-alpha-card-list']")
            assert alpha_list.count() > 0, "알파 초과수익 컴팩트 카드 리스트가 렌더링되어야 합니다."
            alpha_list.scroll_into_view_if_needed()
            page.wait_for_timeout(500)

            # '상세 표 보기' 아코디언 토글 테스트
            print("  -> '상세 표 보기' 아코디언 토글 테스트 중...")
            alpha_toggle_btn = page.locator("[data-testid='alpha-table-toggle-btn']")
            assert alpha_toggle_btn.count() > 0, "'상세 표 보기' 토글 버튼이 존재해야 합니다."
            assert "상세 표 보기" in alpha_toggle_btn.inner_text()

            alpha_toggle_btn.click()
            page.wait_for_timeout(500)
            assert "상세 표 접기" in alpha_toggle_btn.inner_text(), "버튼 텍스트가 '상세 표 접기'로 변경되어야 합니다."

            # 가로 스크롤 상세 데이터 표 노출 확인
            alpha_table = page.locator("[data-testid='alpha-detail-table']")
            assert alpha_table.count() > 0, "상세 데이터 표(table)가 렌더링되어야 합니다."
            assert page.locator("[data-testid='alpha-table-row-sp500']").count() > 0, "S&P 500 행이 존재해야 합니다."

            take_screenshot(page, "07_portfolio_compare_alpha_table_expanded.png", "상세 표 보기 아코디언 확장 및 가로 스크롤 표 검증 완료")

            # 헤더 마스킹(눈 모양 아이콘) 토글 테스트
            print("  -> 상단 헤더 마스킹 토글 테스트 중...")
            page.evaluate("window.scrollTo(0, 0)")
            page.wait_for_timeout(300)

            mask_btn = page.locator("header button[aria-label*='마스킹']")
            assert mask_btn.count() > 0, "상단 헤더 마스킹 토글 버튼이 존재해야 합니다."
            
            mask_btn.click()
            page.wait_for_timeout(500)
            
            # EyeOff 아이콘 노출 확인
            assert page.locator("[data-testid='masking-icon-hidden']").count() > 0, "마스킹 적용 시 EyeOff 아이콘이 노출되어야 합니다."

            take_screenshot(page, "08_portfolio_compare_masked.png", "헤더 마스킹 적용 검증 완료")

            # 마스킹 복구
            mask_btn.click()
            page.wait_for_timeout(300)

            print("\n[SUCCESS] 모든 모바일 지수분석 E2E 시나리오 검증 성공!")
            print(f"총 8개의 스크린샷이 {SCREENSHOT_DIR} 디렉토리에 정상 아카이빙되었습니다.")

        except Exception as e:
            err_path = os.path.join(SCREENSHOT_DIR, "error_screenshot.png")
            page.screenshot(path=err_path)
            print(f"\n[ERROR] E2E 검증 중 오류 발생: {e}", file=sys.stderr)
            print(f"에러 스크린샷 저장: {err_path}", file=sys.stderr)
            raise e
        finally:
            browser.close()


if __name__ == "__main__":
    run_e2e()
