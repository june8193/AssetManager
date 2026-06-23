const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 }
  });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:5173/simulation/asset-allocation ...");
  await page.goto("http://localhost:5173/simulation/asset-allocation");
  
  // 첫 페이지 로딩 대기 (백엔드 계산 및 yfinance API 연동 시간 고려)
  console.log("Waiting for backend simulation initialization...");
  await page.waitForTimeout(8000);

  // 에러 화면 발생 시 '다시 시도' 자동 클릭 처리
  const retryBtn = page.locator('button:has-text("다시 시도")');
  if (await retryBtn.count() > 0) {
    console.log("Detected error screen. Clicking '다시 시도'...");
    await retryBtn.click();
    await page.waitForTimeout(6000);
  }

  // 스크린샷 폴더 생성 (GEMINI.md 규칙 준수: YYYYMMDD_HHMMSS_간단한작업이름)
  const dirName = "20260623_200800_simulation_dashboard";
  const screenshotsDir = path.join(__dirname, "..", "..", "screenshots", dirName);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 1. 페이지 로딩 검증 및 캡처
  const titleText = await page.locator('h1').innerText();
  console.log(`- Page Title Rendered: ${titleText}`);
  
  const initialScreenshotPath = path.join(screenshotsDir, "1_initial_simulation_view.png");
  await page.screenshot({ path: initialScreenshotPath, fullPage: true });
  console.log(`Screenshot saved to ${initialScreenshotPath}`);

  // 2. 기간 프리셋 최근 10년으로 변경 테스트
  console.log("Clicking '최근 10년' period filter...");
  await page.click('button:has-text("최근 10년")');
  await page.waitForTimeout(4000);

  const tenYearsScreenshotPath = path.join(screenshotsDir, "2_period_10y_changed.png");
  await page.screenshot({ path: tenYearsScreenshotPath, fullPage: true });
  console.log(`Screenshot saved to ${tenYearsScreenshotPath}`);

  // 3. 커스텀 비중 조합 추가 테스트 (주식 50% / 현금 50%)
  console.log("Adding new custom allocation ratio (50/50)...");
  await page.fill('input[placeholder="예: 70/30 포트폴리오"]', "주식 50% / 현금 50%");
  await page.fill('input[placeholder="주식 비중 (0-100)"]', "50");
  await page.click('button:has-text("조합 추가")');
  await page.waitForTimeout(4000);

  const customAddedScreenshotPath = path.join(screenshotsDir, "3_custom_ratio_added.png");
  await page.screenshot({ path: customAddedScreenshotPath, fullPage: true });
  console.log(`Screenshot saved to ${customAddedScreenshotPath}`);

  // 4. 연도별/월별 현황 테이블 상세 탭 전환 테스트
  console.log("Clicking '월별 현황' table tab...");
  await page.click('button:has-text("월별 현황")');
  await page.waitForTimeout(3000);

  const tableScreenshotPath = path.join(screenshotsDir, "4_monthly_table_view.png");
  await page.screenshot({ path: tableScreenshotPath, fullPage: true });
  console.log(`Screenshot saved to ${tableScreenshotPath}`);

  await browser.close();
  console.log("E2E Simulation dashboard verification completed successfully!");
}

main().catch(err => {
  console.error("E2E Simulation script failed:", err);
  process.exit(1);
});
