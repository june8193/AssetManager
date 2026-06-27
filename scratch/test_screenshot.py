import asyncio
import os
from playwright.async_api import async_playwright

async def main():
    # 저장할 디렉토리 생성
    os.makedirs("screenshots/20260627_112800_scheduler_e2e", exist_ok=True)
    
    async with async_playwright() as p:
        # 헤드리스 브라우저 실행
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        # 화면 크기 설정
        await page.set_viewport_size({"width": 1280, "height": 800})
        
        try:
            print("http://localhost:5173 접속 시도...")
            await page.goto("http://localhost:5173", timeout=10000)
            await asyncio.sleep(5)  # 렌더링 완료 대기
            
            # 스크린샷 저장
            screenshot_path = "screenshots/20260627_112800_scheduler_e2e/dashboard.png"
            await page.screenshot(path=screenshot_path)
            print(f"스크린샷 저장 완료: {screenshot_path}")
        except Exception as e:
            print(f"스크린샷 캡처 중 오류 발생: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
