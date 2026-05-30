const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:5173/benchmark ...");
  await page.goto("http://localhost:5173/benchmark");
  
  // 데이터 로딩 대기
  await page.waitForTimeout(3000);

  // 스크린샷 폴더 생성
  const dirName = "20260530_210500_watchlist_chart_compare";
  const screenshotsDir = path.join(__dirname, "..", "..", "screenshots", dirName);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 초기 화면 캡처
  const initialScreenshotPath = path.join(screenshotsDir, "1_initial_page.png");
  await page.screenshot({ path: initialScreenshotPath, fullPage: true });
  console.log(`Initial screenshot saved to ${initialScreenshotPath}`);

  // 관심 종목 체크박스 요소를 찾아 클릭
  console.log("Toggling watchlist stock (Samsung Electronics) chart comparison...");
  
  // '005930' 텍스트를 가진 행의 checkbox를 선택
  const samsungRow = page.locator('tr:has-text("삼성전자")');
  const checkboxWrapper = samsungRow.locator('label');
  await checkboxWrapper.click();

  // 차트 갱신 대기 (yfinance 조회 및 Recharts 렌더링 애니메이션 대기)
  console.log("Waiting for data fetch and chart rendering...");
  await page.waitForTimeout(5000);

  // 토글 후 화면 캡처
  const afterScreenshotPath = path.join(screenshotsDir, "2_after_toggled.png");
  await page.screenshot({ path: afterScreenshotPath, fullPage: true });
  console.log(`Toggled screenshot saved to ${afterScreenshotPath}`);

  await browser.close();
  console.log("E2E verification completed successfully!");
}

main().catch(err => {
  console.error("E2E script failed:", err);
  process.exit(1);
});
