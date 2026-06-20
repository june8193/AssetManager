# check_db_page.py
# 마스터 관리(/db) 페이지에 접속하여 브라우저 콘솔 에러와 페이지 내용을 진단하는 스크립트입니다.

import asyncio
import os
from datetime import datetime
from playwright.async_api import async_playwright

async def run_diagnostics():
    print("--- 마스터 관리 페이지(/db) E2E 진단 시작 ---")
    
    # 1. 스크린샷 디렉토리 준비
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    screenshot_dir = f"/Users/seongeunhong/Desktop/local_repo/AssetManager/screenshots/{timestamp}_check_db_page"
    os.makedirs(screenshot_dir, exist_ok=True)
    print(f"스크린샷 저장 디렉토리: {screenshot_dir}")

    # 콘솔 로그 및 에러 수집
    console_logs = []
    page_errors = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        
        # 콘솔 이벤트 리스너 등록
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: page_errors.append(err.message))
        
        url = "http://localhost:5173/db"
        print(f"접속 중: {url}")
        
        try:
            await page.goto(url, wait_until="networkidle")
        except Exception as e:
            print(f"Network idle 대기 실패, 기본 접속 시도: {e}")
            await page.goto(url)
            
        print("페이지 로딩 완료. 5초 동안 데이터 렌더링 대기...")
        await asyncio.sleep(5)
        
        # HTML 바디 내용 일부 출력 (문제 파악용)
        body_text = await page.evaluate("document.body.innerText")
        print("\n--- 브라우저 바디 텍스트 (앞 1000자) ---")
        print(body_text[:1000])
        print("--------------------------------------\n")
        
        # 현재 화면 스크린샷 저장
        screenshot_path = os.path.join(screenshot_dir, "db_page_loaded.png")
        await page.screenshot(path=screenshot_path, full_page=True)
        print(f"초기 페이지 스크린샷 저장: {screenshot_path}")

        # 탭 메뉴들 찾아서 클릭해보기
        tabs = ["계좌 관리", "자산 마스터", "거래 내역", "스냅샷", "환율 관리"]
        for tab_name in tabs:
            print(f"\n'{tab_name}' 탭 클릭 시도...")
            try:
                # 탭 클릭
                tab_selector = f"button:has-text('{tab_name}')"
                if await page.locator(tab_selector).count() > 0:
                    await page.click(tab_selector)
                    await asyncio.sleep(2)
                    
                    # 스크린샷 저장
                    tab_filename = f"tab_{tab_name.replace(' ', '_')}.png"
                    tab_screenshot_path = os.path.join(screenshot_dir, tab_filename)
                    await page.screenshot(path=tab_screenshot_path, full_page=True)
                    print(f"'{tab_name}' 탭 스크린샷 저장: {tab_screenshot_path}")
                else:
                    print(f"'{tab_name}' 탭 버튼을 찾을 수 없습니다.")
            except Exception as e:
                print(f"'{tab_name}' 탭 클릭 중 에러 발생: {e}")

        # 브라우저 종료
        await browser.close()
        
    print("\n--- 수집된 브라우저 콘솔 로그 ---")
    for log in console_logs:
        print(log)
    print("--------------------------------")
    
    print("\n--- 발생한 브라우저 페이지 에러 ---")
    if page_errors:
        for err in page_errors:
            print(f"ERROR: {err}")
    else:
        print("에러 없음")
    print("----------------------------------")
    print("--- 마스터 관리 페이지 E2E 진단 완료 ---")

if __name__ == "__main__":
    asyncio.run(run_diagnostics())
