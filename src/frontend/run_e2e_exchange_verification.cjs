const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 }
  });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:5173/db-management ...");
  await page.goto("http://localhost:5173/db-management");
  
  await page.waitForTimeout(3000);

  // '거래 내역' 탭 클릭
  console.log("Clicking '거래 내역' tab...");
  const txTabBtn = page.locator('button:has-text("거래 내역")');
  await txTabBtn.click();
  await page.waitForTimeout(2000);

  const dirName = "20260730_221800_exchange_form";
  const screenshotsDir = path.join(__dirname, "..", "..", "screenshots", dirName);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 1. 초기 거래 내역 화면 스크린샷
  const screenshot1 = path.join(screenshotsDir, "1_transactions_initial.png");
  await page.screenshot({ path: screenshot1, fullPage: true });
  console.log(`Saved initial screenshot: ${screenshot1}`);

  // 2. 유형 드롭다운에서 '환전 (EXCHANGE)' 선택
  console.log("Selecting '환전 (EXCHANGE)' in type dropdown...");
  const typeSelect = page.locator('select[name="type"]');
  await typeSelect.selectOption('EXCHANGE');
  await page.waitForTimeout(1000);

  // 3. 환전 폼 노출 상태 스크린샷
  const screenshot2 = path.join(screenshotsDir, "2_exchange_form_rendered.png");
  await page.screenshot({ path: screenshot2, fullPage: true });
  console.log(`Saved exchange form screenshot: ${screenshot2}`);

  await browser.close();
  console.log("E2E Verification script completed successfully.");
}

main().catch(err => {
  console.error("E2E script error:", err);
  process.exit(1);
});
