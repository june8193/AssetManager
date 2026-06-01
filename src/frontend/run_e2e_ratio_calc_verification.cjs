const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 }
  });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:5173/ratios/check ...");
  await page.goto("http://localhost:5173/ratios/check");
  
  // 데이터 로딩 대기
  console.log("Waiting for backend server initialization...");
  await page.waitForTimeout(6000);

  // 에러 화면 발생 시 '다시 시도' 자동 클릭 처리
  const retryBtn = page.locator('button:has-text("다시 시도")');
  if (await retryBtn.count() > 0) {
    console.log("Detected error screen. Clicking '다시 시도'...");
    await retryBtn.click();
    await page.waitForTimeout(5000);
  }

  // 오늘 날짜 및 시간 기반으로 스크린샷 폴더 생성 (GEMINI.md 규칙 준수: YYYYMMDD_HHMMSS_간단한작업이름)
  const now = new Date();
  const timestamp = now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') + '_' +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
  
  const dirName = `${timestamp}_ratio_check_calc`;
  const screenshotsDir = path.join(__dirname, "..", "..", "screenshots", dirName);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 1. 초기 구성 비중 화면 캡처
  const initialScreenshotPath = path.join(screenshotsDir, "1_initial_ratio_check.png");
  await page.screenshot({ path: initialScreenshotPath, fullPage: true });
  console.log(`Initial ratio check page screenshot saved to ${initialScreenshotPath}`);

  // 2. 투자 계산기 탭 클릭
  console.log("Switching to '투자 계산기' tab...");
  const calcTab = page.locator('button:has-text("투자 계산기")');
  await calcTab.click();
  await page.waitForTimeout(1000);

  const calcTabScreenshotPath = path.join(screenshotsDir, "2_calc_tab_active.png");
  await page.screenshot({ path: calcTabScreenshotPath, fullPage: true });
  console.log(`Calc tab active screenshot saved to ${calcTabScreenshotPath}`);

  // 3. 추가 투자금 입력 (예: 50,000,000원)
  console.log("Entering additional investment cash...");
  const cashInput = page.locator('[data-testid="additional-cash-input"]');
  await cashInput.fill("50000000");
  await page.waitForTimeout(1000);

  const cashInputScreenshotPath = path.join(screenshotsDir, "3_additional_cash_entered.png");
  await page.screenshot({ path: cashInputScreenshotPath, fullPage: true });
  console.log(`Additional cash entered screenshot saved to ${cashInputScreenshotPath}`);

  // 4. 첫 번째 항목 목표 비중 수정 (예: '주식' 70%)
  console.log("Modifying target percentage for the first major category...");
  const firstPercentInput = page.locator('input[type="number"]').nth(1); // 0번째는 additional cash
  await firstPercentInput.fill("70");
  await page.waitForTimeout(1000);

  const weightModifiedScreenshotPath = path.join(screenshotsDir, "4_weight_modified_not_100.png");
  await page.screenshot({ path: weightModifiedScreenshotPath, fullPage: true });
  console.log(`Weight modified (invalid sum) screenshot saved to ${weightModifiedScreenshotPath}`);

  // 5. 두 번째 항목 자동채우기 클릭
  console.log("Clicking '자동채우기' on the second category to balance target to 100%...");
  const autoFillButton = page.locator('button:has-text("자동채우기")').nth(1);
  await autoFillButton.click();
  await page.waitForTimeout(1000);

  const balancedScreenshotPath = path.join(screenshotsDir, "5_balanced_target_100.png");
  await page.screenshot({ path: balancedScreenshotPath, fullPage: true });
  console.log(`Balanced target percentage screenshot saved to ${balancedScreenshotPath}`);

  // 6. 목표 비중 저장
  console.log("Clicking '목표 비중 저장'...");
  page.once('dialog', async dialog => {
    console.log(`Dialog message: ${dialog.message()}`);
    await dialog.accept();
  });
  
  const saveBtn = page.locator('button:has-text("목표 비중 저장")');
  await saveBtn.click();
  await page.waitForTimeout(2000);

  const savedScreenshotPath = path.join(screenshotsDir, "6_targets_saved.png");
  await page.screenshot({ path: savedScreenshotPath, fullPage: true });
  console.log(`Targets saved screenshot saved to ${savedScreenshotPath}`);

  await browser.close();
  console.log("E2E Ratio calculation verification completed successfully!");
}

main().catch(err => {
  console.error("E2E Ratio calculation script failed:", err);
  process.exit(1);
});
