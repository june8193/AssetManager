import os
import datetime
import sys

def main():
    # screenshots 디렉토리 아래에 YYYYMMDD_HHMMSS_간단한작업이름 형식으로 폴더 생성
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    folder_name = f"{timestamp}_stock_prices_api"
    screenshot_dir = os.path.join("screenshots", folder_name)
    os.makedirs(screenshot_dir, exist_ok=True)
    
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Playwright is not installed. Please run with 'uv run --with playwright ...'")
        sys.exit(1)
        
    with sync_playwright() as p:
        print("Launching browser...")
        browser = p.chromium.launch()
        page = browser.new_page()
        
        # API URL 접속
        url = "http://localhost:8000/api/stocks/prices?ticker=AAPL&start_date=2026-06-01&end_date=2026-06-05"
        print(f"Navigating to {url}...")
        page.goto(url)
        page.wait_for_timeout(2000)
        
        screenshot_path = os.path.join(screenshot_dir, "api_response.png")
        page.screenshot(path=screenshot_path)
        print(f"Saved screenshot to {screenshot_path}")
        
        browser.close()

if __name__ == "__main__":
    main()
