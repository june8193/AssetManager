const path = require('path');
module.paths.push(path.join(__dirname, '../src/frontend/node_modules'));
const { chromium } = require('playwright');
const fs = require('fs');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // 1280 x 1000 크기로 뷰포트 설정
  await page.setViewportSize({ width: 1280, height: 1000 });

  const htmlPath = path.resolve(__dirname, 'ratio_test_page.html');
  const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;
  
  console.log(`Navigating to ${fileUrl} ...`);
  await page.goto(fileUrl);
  await page.waitForTimeout(2000); // Chart.js 애니메이션 대기

  // 오늘 날짜로 screenshots 폴더명 생성 (GEMINI.md 규칙)
  const dirName = "20260531_191000_ratio_test_mock";
  const screenshotsDir = path.join(__dirname, "..", "screenshots", dirName);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 1. 초기 대분류 화면 캡처
  const img1 = path.join(screenshotsDir, "1_initial_major.png");
  await page.screenshot({ path: img1 });
  console.log(`Captured initial page: ${img1}`);

  // 2. '주식' 파이차트 부분 또는 리스트의 '주식' 항목을 클릭하여 중분류로 드릴다운
  console.log("Drill-down: Clicking '주식' item to zoom in...");
  const stockRow = page.locator('span:has-text("주식")').first();
  await stockRow.click();
  await page.waitForTimeout(1500); // 트랜지션 및 차트 갱신 대기

  const img2 = path.join(screenshotsDir, "2_drill_down_to_stocks_sub.png");
  await page.screenshot({ path: img2 });
  console.log(`Captured stocks sub-category page: ${img2}`);

  // 3. '해외주식' 항목을 클릭하여 종목으로 드릴다운
  console.log("Drill-down: Clicking '해외주식' item to zoom in...");
  const foreignStockRow = page.locator('span:has-text("해외주식")').first();
  await foreignStockRow.click();
  await page.waitForTimeout(1500);

  const img3 = path.join(screenshotsDir, "3_drill_down_to_foreign_stocks.png");
  await page.screenshot({ path: img3 });
  console.log(`Captured foreign stocks detail page: ${img3}`);

  await browser.close();
  console.log("Mock Drill-down capture completed successfully!");
}

main().catch(err => {
  console.error("Capture failed:", err);
  process.exit(1);
});
