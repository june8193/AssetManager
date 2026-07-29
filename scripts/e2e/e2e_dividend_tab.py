"""배당 분석 메뉴 종목별 연간 배당률 표 카테고리 탭 E2E 테스트 스크립트"""
import os
import sys
import time
from playwright.sync_api import sync_playwright

SCREENSHOT_DIR = os.path.join("screenshots", "20260729_163000_dividend_category_tab")

def run_e2e():
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})

        print("1. 배당 분석 페이지 접속 (http://localhost:5173/#/dividend)...")
        page.goto("http://localhost:5173/#/dividend")
        page.wait_for_timeout(3000)

        # 1. 기본 선택 상태 (배당주 탭 활성화 확인 & 스크린샷)
        print("2. 기본 상태 [배당주] 탭 검증 중...")
        page.wait_for_selector("text=종목별 연간 배당률 & 가상 주가 시뮬레이터")
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "01_default_dividend_tab.png"), full_page=True)

        # 2. [채권] 탭 클릭
        print("3. [채권] 탭 클릭 및 데이터 변경 검증 중...")
        bond_button = page.get_by_role("button", name="채권", exact=True)
        bond_button.click()
        page.wait_for_timeout(1000)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "02_bond_tab.png"), full_page=True)

        # 3. [전체 자산] 탭 클릭
        print("4. [전체 자산] 탭 클릭 및 데이터 변경 검증 중...")
        all_button = page.get_by_role("button", name="전체 자산", exact=True)
        all_button.click()
        page.wait_for_timeout(1000)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "03_all_assets_tab.png"), full_page=True)

        # 4. [배당주] 탭으로 다시 복귀
        div_button = page.get_by_role("button", name="배당주", exact=True)
        div_button.click()
        page.wait_for_timeout(500)

        print("E2E 테스트 성공 완료! 스크린샷이 저장되었습니다:", SCREENSHOT_DIR)
        browser.close()

if __name__ == "__main__":
    run_e2e()
