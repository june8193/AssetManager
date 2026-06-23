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
  const dirName = "20260623_205700_compound_interest";
  const screenshotsDir = path.join(__dirname, "..", "..", "screenshots", dirName);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 1. 기본 탭 (현재 자산기반 계산) 로딩 검증 및 캡처
  const titleText = await page.locator('h1').innerText();
  console.log(`- Page Title Rendered: ${titleText}`);
  
  const initialScreenshotPath = path.join(screenshotsDir, "1_current_asset_tab_view.png");
  await page.screenshot({ path: initialScreenshotPath, fullPage: true });
  console.log(`Screenshot saved to ${initialScreenshotPath}`);

  // 2. 현재 자산기반 계산 탭: 출생 연도 변경 (1995 -> 1990)
  console.log("Changing birth year to 1990...");
  const birthYearInput = page.locator('input#birthYear');
  await birthYearInput.fill("1990");
  await page.waitForTimeout(2000);

  const birthYearChangedScreenshotPath = path.join(screenshotsDir, "2_birth_year_changed_to_1990.png");
  await page.screenshot({ path: birthYearChangedScreenshotPath, fullPage: true });
  console.log(`Screenshot saved to ${birthYearChangedScreenshotPath}`);

  // 3. 현재 자산기반 계산 탭: 목표 연도 변경 (2056 -> 2060)
  console.log("Changing target year to 2060...");
  const targetYearInput = page.locator('input#targetYear');
  await targetYearInput.fill("2060");
  await page.waitForTimeout(2000);

  const targetYearChangedScreenshotPath = path.join(screenshotsDir, "3_target_year_changed_to_2060.png");
  await page.screenshot({ path: targetYearChangedScreenshotPath, fullPage: true });
  console.log(`Screenshot saved to ${targetYearChangedScreenshotPath}`);

  // 4. 자유 계산 탭으로 전환 검증
  console.log("Switching to '자유 계산' tab...");
  await page.click('button:has-text("자유 계산")');
  await page.waitForTimeout(2000);

  const freeCalcTabScreenshotPath = path.join(screenshotsDir, "4_free_calc_tab_view.png");
  await page.screenshot({ path: freeCalcTabScreenshotPath, fullPage: true });
  console.log(`Screenshot saved to ${freeCalcTabScreenshotPath}`);

  await browser.close();
  console.log("E2E Compound interest calculator verification completed successfully!");
}

main().catch(err => {
  console.error("E2E Compound Interest script failed:", err);
  process.exit(1);
});
