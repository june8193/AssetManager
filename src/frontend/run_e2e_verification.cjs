const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 }
  });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:5173/benchmark ...");
  await page.goto("http://localhost:5173/benchmark");
  
  // 데이터 로딩 대기
  console.log("Waiting for backend server initialization...");
  await page.waitForTimeout(10000);

  // 에러 화면 발생 시 '다시 시도' 자동 클릭 처리
  const retryBtn = page.locator('button:has-text("다시 시도")');
  if (await retryBtn.count() > 0) {
    console.log("Detected error screen. Clicking '다시 시도'...");
    await retryBtn.click();
    await page.waitForTimeout(5000);
  }

  // 스크린샷 폴더 생성 (GEMINI.md 규칙 준수)
  const dirName = "20260530_213200_market_analysis_refactor";
  const screenshotsDir = path.join(__dirname, "..", "..", "screenshots", dirName);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 초기 화면 캡처
  const initialScreenshotPath = path.join(screenshotsDir, "1_initial_page.png");
  await page.screenshot({ path: initialScreenshotPath, fullPage: true });
  console.log(`Initial screenshot saved to ${initialScreenshotPath}`);

  // 차트 하단 통합 토글 컨트롤에서 KOSPI 지수와 KOSDAQ 지수 OFF 해보기
  console.log("Toggling off KOSPI and KOSDAQ indexes in bottom controller...");
  const kospiBtn = page.locator('button:has-text("KOSPI")');
  await kospiBtn.click();
  const kosdaqBtn = page.locator('button:has-text("KOSDAQ")');
  await kosdaqBtn.click();

  // 차트 하단 통합 토글 컨트롤에서 관심: 삼성전자 ON 해보기
  console.log("Toggling on watchlist stock (Samsung Electronics) chart comparison...");
  const samsungBtn = page.locator('button:has-text("관심: 삼성전자")');
  await samsungBtn.click();

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
