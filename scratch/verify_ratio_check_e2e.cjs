const path = require('path');
module.paths.push(path.join(__dirname, '../src/frontend/node_modules'));
const { chromium } = require('playwright');
const fs = require('fs');

async function main() {
  console.log("Launching headless browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 }
  });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:5173/ratios/check ...");
  await page.goto("http://localhost:5173/ratios/check");

  console.log("Waiting for backend server data loading...");
  // API 및 차트 로딩을 위해 8초 대기
  await page.waitForTimeout(8000);

  // 스크린샷 폴더 생성 (GEMINI.md 규칙)
  const dirName = "20260601_220700_ratio_check_e2e";
  const screenshotsDir = path.join(__dirname, "..", "screenshots", dirName);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 1. 초기 대분류 화면 캡처
  const img1 = path.join(screenshotsDir, "1_e2e_initial_major.png");
  await page.screenshot({ path: img1 });
  console.log(`E2E: Captured initial page -> ${img1}`);

  // 2. 리스트의 첫 번째 행(대분류)을 클릭하여 중분류로 드릴다운
  console.log("E2E: Clicking the first major category row in list...");
  const firstRow = page.locator('[data-testid="ratio-row"]').first();
  if (await firstRow.count() > 0) {
    const rowText = await firstRow.innerText();
    console.log(`Clicking category item:\n${rowText}`);
    await firstRow.click();
    await page.waitForTimeout(2000); // 렌더링 및 트랜지션 대기

    // 중분류 화면 캡처
    const img2 = path.join(screenshotsDir, "2_e2e_drill_down_sub.png");
    await page.screenshot({ path: img2 });
    console.log(`E2E: Captured sub-category page -> ${img2}`);

    // 3. 중분류 중 첫 번째 행을 클릭하여 종목으로 드릴다운
    console.log("E2E: Clicking the first sub-category row to see stocks...");
    const subRow = page.locator('[data-testid="ratio-row"]').first();
    if (await subRow.count() > 0) {
      await subRow.click();
      await page.waitForTimeout(2000);

      // 종목 화면 캡처
      const img3 = path.join(screenshotsDir, "3_e2e_drill_down_stock.png");
      await page.screenshot({ path: img3 });
      console.log(`E2E: Captured stock-level page -> ${img3}`);
    }

    // 4. Breadcrumb의 '포트폴리오'를 클릭하여 초기 상태로 리셋
    console.log("E2E: Clicking '포트폴리오' breadcrumb to reset...");
    const homeBreadcrumb = page.locator('button:has-text("포트폴리오")');
    if (await homeBreadcrumb.count() > 0) {
      await homeBreadcrumb.click();
      await page.waitForTimeout(2000);

      // 리셋 후 화면 캡처
      const img4 = path.join(screenshotsDir, "4_e2e_reset.png");
      await page.screenshot({ path: img4 });
      console.log(`E2E: Captured reset page -> ${img4}`);
    }
  } else {
    console.log("E2E Warning: No interactive category rows found. Perhaps the DB has no assets?");
  }

  await browser.close();
  console.log("E2E test script completed!");
}

main().catch(err => {
  console.error("E2E test script failed:", err);
  process.exit(1);
});
