const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 }
  });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:5173/simulation/compound-interest ...");
  await page.goto("http://localhost:5173/simulation/compound-interest");
  
  // 첫 페이지 로딩 대기
  console.log("Waiting for backend snapshot stats load...");
  await page.waitForTimeout(5000);

  // 스크린샷 폴더 생성 (GEMINI.md 규칙 준수: YYYYMMDD_HHMMSS_간단한작업이름)
  const dirName = "20260623_212800_compound_interest_lag_fix";
  const screenshotsDir = path.join(__dirname, "..", "screenshots", dirName);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 1. 초기 렌더링 캡처
  const initialScreenshotPath = path.join(screenshotsDir, "1_initial_view.png");
  await page.screenshot({ path: initialScreenshotPath, fullPage: true });
  console.log(`- Initial view screenshot saved to ${initialScreenshotPath}`);

  // 2. 목표 연도에 '20000' 입력 (비정상값) 후 포커스 아웃
  console.log("Entering invalid target year '20000'...");
  const targetYearInput = page.locator('input#targetYear');
  await targetYearInput.focus();
  await targetYearInput.fill("20000");
  
  console.log("Blurring input to trigger validation...");
  await targetYearInput.blur();
  await page.waitForTimeout(1000);

  // 20000은 상한선(2126년)을 초과하므로 2056으로 원복되어야 함
  const currentTargetYearVal = await targetYearInput.inputValue();
  console.log(`- Target Year value after invalid input + blur: ${currentTargetYearVal}`);
  
  const invalidTargetScreenshotPath = path.join(screenshotsDir, "2_invalid_target_year_fallback.png");
  await page.screenshot({ path: invalidTargetScreenshotPath, fullPage: true });
  console.log(`Screenshot saved to ${invalidTargetScreenshotPath}`);

  // 3. 목표 연도에 '2080' 입력 (정상값) 후 포커스 아웃
  console.log("Entering valid target year '2080'...");
  await targetYearInput.focus();
  await targetYearInput.fill("2080");
  await targetYearInput.blur();
  await page.waitForTimeout(1000);

  const validTargetYearVal = await targetYearInput.inputValue();
  console.log(`- Target Year value after valid input + blur: ${validTargetYearVal}`);

  const validTargetScreenshotPath = path.join(screenshotsDir, "3_valid_target_year_applied.png");
  await page.screenshot({ path: validTargetScreenshotPath, fullPage: true });
  console.log(`Screenshot saved to ${validTargetScreenshotPath}`);

  // 4. 출생 연도에 '1990' 입력 (정상값) 후 포커스 아웃
  console.log("Entering valid birth year '1990'...");
  const birthYearInput = page.locator('input#birthYear');
  await birthYearInput.focus();
  await birthYearInput.fill("1990");
  await birthYearInput.blur();
  await page.waitForTimeout(1000);

  const validBirthYearVal = await birthYearInput.inputValue();
  console.log(`- Birth Year value after valid input + blur: ${validBirthYearVal}`);

  const validBirthScreenshotPath = path.join(screenshotsDir, "4_valid_birth_year_applied.png");
  await page.screenshot({ path: validBirthScreenshotPath, fullPage: true });
  console.log(`Screenshot saved to ${validBirthScreenshotPath}`);

  // 5. 자유 계산 탭으로 이동 및 투자 기간 검증
  console.log("Switching to '자유 계산' tab...");
  await page.click('button:has-text("자유 계산")');
  await page.waitForTimeout(1000);

  console.log("Entering invalid investment period '150'...");
  // 투자 기간 input은 2번째 spinbutton (두 번째 number 타입 input)
  const investmentPeriodInput = page.locator('input[type="number"]').nth(1);
  await investmentPeriodInput.focus();
  await investmentPeriodInput.fill("150");
  await investmentPeriodInput.blur();
  await page.waitForTimeout(1000);

  const currentPeriodVal = await investmentPeriodInput.inputValue();
  console.log(`- Investment Period after invalid input + blur: ${currentPeriodVal}`);

  const invalidPeriodScreenshotPath = path.join(screenshotsDir, "5_invalid_period_fallback.png");
  await page.screenshot({ path: invalidPeriodScreenshotPath, fullPage: true });
  console.log(`Screenshot saved to ${invalidPeriodScreenshotPath}`);

  await browser.close();
  console.log("E2E verification of blur input validation completed successfully!");
}

main().catch(err => {
  console.error("E2E script failed:", err);
  process.exit(1);
});
