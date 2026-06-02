# test_browser_e2e.py
# Playwright를 이용해 대시보드 화면을 접속하고 스크린샷을 캡처하는 E2E 검증 스크립트

import asyncio
import os
from playwright.async_api import async_playwright

async def run_browser_e2e():
    print("--- Playwright 브라우저 E2E 검증 시작 ---")
    
    # 1. 스크린샷 디렉토리 준비
    screenshot_dir = "c:/localrepo/AssetManager/screenshots/20260602_104300_sgov_dashboard_e2e"
    os.makedirs(screenshot_dir, exist_ok=True)
    
    async with async_playwright() as p:
        # headless 브라우저 런칭
        browser = await p.chromium.launch(headless=True)
        # 뷰포트 크기를 넉넉하게 지정하여 전체 화면이 한눈에 보이게 함
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        
        # 2. 대시보드 페이지 접속
        url = "http://localhost:5173"
        print(f"URL 접속 중: {url}")
        await page.goto(url)
        
        # 3. 데이터 로딩 대기
        print("데이터 로딩 대기 중 (5초)...")
        await asyncio.sleep(5)
        
        # 4. 스크린샷 캡처
        screenshot_path = os.path.join(screenshot_dir, "dashboard.png")
        await page.screenshot(path=screenshot_path, full_page=True)
        print(f"스크린샷 저장 완료: {screenshot_path}")
        
        # 브라우저 종료
        await browser.close()
        print("Playwright 브라우저 E2E 검증 완료.")

if __name__ == "__main__":
    asyncio.run(run_browser_e2e())
