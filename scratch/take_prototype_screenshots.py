import os
import asyncio
from playwright.async_api import async_playwright

async def main():
    screenshot_dir = os.path.join(os.getcwd(), 'screenshots', '20260729_150400_dividend_prototype')
    os.makedirs(screenshot_dir, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 1280, 'height': 960})

        print("Navigating to Variant A...")
        await page.goto("http://localhost:5173/dividend?variant=A", wait_until="networkidle")
        await page.wait_for_timeout(1000)
        await page.screenshot(path=os.path.join(screenshot_dir, "variant_A_dashboard.png"), full_page=True)

        print("Navigating to Variant B...")
        await page.goto("http://localhost:5173/dividend?variant=B", wait_until="networkidle")
        await page.wait_for_timeout(1000)
        await page.screenshot(path=os.path.join(screenshot_dir, "variant_B_tabs.png"), full_page=True)

        print("Navigating to Variant C...")
        await page.goto("http://localhost:5173/dividend?variant=C", wait_until="networkidle")
        await page.wait_for_timeout(1000)
        await page.screenshot(path=os.path.join(screenshot_dir, "variant_C_split.png"), full_page=True)

        await browser.close()
        print(f"Screenshots saved to {screenshot_dir}")

if __name__ == '__main__':
    asyncio.run(main())
