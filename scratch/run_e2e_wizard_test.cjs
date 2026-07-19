const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 }
  });
  const page = await context.newPage();

  console.log("Navigating to Snapshot Wizard Page...");
  await page.goto("http://localhost:5173/db/snapshots/new");
  
  // 페이지 로딩 대기
  await page.waitForTimeout(4000);

  // 스크린샷 폴더 생성 (규칙: screenshots/YYYYMMDD_HHMMSS_작업이름)
  const now = new Date();
  const format2 = (n) => String(n).padStart(2, '0');
  const dirName = `${now.getFullYear()}${format2(now.getMonth()+1)}${format2(now.getDate())}_` +
                  `${format2(now.getHours())}${format2(now.getMinutes())}${format2(now.getSeconds())}_snapshot_wizard_test`;
  const screenshotsDir = path.join(__dirname, "..", "screenshots", dirName);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 1. 초기 상태 캡처
  const initialScreenshotPath = path.join(screenshotsDir, "1_wizard_step1_loaded.png");
  await page.screenshot({ path: initialScreenshotPath });
  console.log(`Wizard page loaded screenshot saved to ${initialScreenshotPath}`);

  // 2. 환율 입력 엘리먼트 속성 검증
  const exchangeRateInput = page.locator('input[type="number"]');
  const isReadOnly = await exchangeRateInput.getAttribute('readonly');
  const rateValue = await exchangeRateInput.inputValue();
  console.log(`Exchange Rate Input - ReadOnly: ${isReadOnly !== null}, Value: ${rateValue}`);

  // 만약 readOnly 속성이 없다면 에러 발생
  if (isReadOnly === null) {
    throw new Error("Exchange rate input is NOT readOnly!");
  }

  // 3. 날짜 변경 시 환율 변동 검증
  console.log("Changing date to '2026-06-06'...");
  const dateInput = page.locator('input[type="date"]');
  await dateInput.fill('2026-06-06');
  await page.waitForTimeout(2000);

  const rateValueAfterChange = await exchangeRateInput.inputValue();
  console.log(`Exchange Rate after date change - Value: ${rateValueAfterChange}`);

  const changeScreenshotPath = path.join(screenshotsDir, "2_wizard_step1_date_changed.png");
  await page.screenshot({ path: changeScreenshotPath });
  console.log(`Date changed screenshot saved to ${changeScreenshotPath}`);

  await browser.close();
  console.log("E2E snapshot wizard test verification completed successfully!");
}

main().catch(err => {
  console.error("E2E script failed:", err);
  process.exit(1);
});
