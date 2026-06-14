# -*- coding: utf-8 -*-
import os
import sys
import datetime
from playwright.sync_api import sync_playwright

def main():
    # 캡처 결과 저장 디렉토리 생성
    now_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    screenshot_dir = os.path.join("screenshots", f"{now_str}_market_api")
    os.makedirs(screenshot_dir, exist_ok=True)
    
    print(f"Saving screenshots to: {screenshot_dir}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # 1. 프론트엔드 메인 페이지 캡처
        try:
            print("Navigating to frontend main...")
            page.goto("http://localhost:5173", timeout=10000)
            page.wait_for_timeout(2000) # 렌더링 대기
            page.screenshot(path=os.path.join(screenshot_dir, "frontend_main.png"))
            print("  [OK] frontend_main.png saved.")
        except Exception as e:
            print(f"  [ERROR] Failed to capture frontend main: {e}")
            
        # 2. 지수 조회 API 응답 캡처
        try:
            print("Navigating to indices API...")
            page.goto("http://localhost:8000/api/market/indices", timeout=10000)
            page.screenshot(path=os.path.join(screenshot_dir, "api_indices.png"))
            print("  [OK] api_indices.png saved.")
        except Exception as e:
            print(f"  [ERROR] Failed to capture indices API: {e}")
            
        # 3. 휴장일 판정 API 응답 캡처
        try:
            print("Navigating to holiday API...")
            page.goto("http://localhost:8000/api/market/holiday?date=2026-05-01&country=kr", timeout=10000)
            page.screenshot(path=os.path.join(screenshot_dir, "api_holiday_kr.png"))
            print("  [OK] api_holiday_kr.png saved.")
        except Exception as e:
            print(f"  [ERROR] Failed to capture holiday API: {e}")

        browser.close()

if __name__ == "__main__":
    main()
