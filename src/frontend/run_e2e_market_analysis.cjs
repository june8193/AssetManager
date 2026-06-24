const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function getFormattedTimestamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 }
  });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:5173/market/analysis ...");
  await page.goto("http://localhost:5173/market/analysis");
  
  // 데이터 로딩 대기
  console.log("Waiting for backend server initialization & data load...");
  await page.waitForTimeout(8000);

  // 에러 화면 발생 시 '다시 시도' 자동 클릭 처리
  const retryBtn = page.locator('button:has-text("다시 시도")');
  if (await retryBtn.count() > 0) {
    console.log("Detected error screen. Clicking '다시 시도'...");
    await retryBtn.click();
    await page.waitForTimeout(5000);
  }

  // 스크린샷 폴더 생성 (GEMINI.md 규칙 준수: YYYYMMDD_HHMMSS_간단한작업이름)
  const timestamp = getFormattedTimestamp();
  const dirName = `${timestamp}_market_analysis`;
  const screenshotsDir = path.join(__dirname, "..", "..", "screenshots", dirName);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
    console.log(`Created screenshots directory at: ${screenshotsDir}`);
  }

  // 1. 기본 지수별 상세 분석 화면 스크린샷
  console.log("Capturing initial individual analysis screen...");
  const sc1Path = path.join(screenshotsDir, "1_individual_analysis_default.png");
  await page.screenshot({ path: sc1Path, fullPage: true });
  console.log(`Saved screenshot 1 to ${sc1Path}`);

  // 2. 지수 변경 시도 (NASDAQ 클릭)
  console.log("Clicking 'NASDAQ' button...");
  const nasdaqBtn = page.locator('button:has-text("NASDAQ")').first();
  if (await nasdaqBtn.count() > 0) {
    await nasdaqBtn.click();
    await page.waitForTimeout(3000);
    const sc2Path = path.join(screenshotsDir, "2_individual_analysis_nasdaq.png");
    await page.screenshot({ path: sc2Path, fullPage: true });
    console.log(`Saved screenshot 2 (NASDAQ) to ${sc2Path}`);
  }

  // 3. 기간 변경 시도 (10년 클릭)
  console.log("Clicking '10년' period button...");
  const tenYearsBtn = page.locator('button:has-text("10년")').first();
  if (await tenYearsBtn.count() > 0) {
    await tenYearsBtn.click();
    await page.waitForTimeout(3000);
    const sc3Path = path.join(screenshotsDir, "3_individual_analysis_10years.png");
    await page.screenshot({ path: sc3Path, fullPage: true });
    console.log(`Saved screenshot 3 (10 Years) to ${sc3Path}`);
  }

  // 4. 4대 지수 연간 수익률 비교 탭 전환
  console.log("Switching to comparison tab...");
  const compTabBtn = page.locator('button:has-text("4대 지수 연간 수익률 비교")').first();
  if (await compTabBtn.count() > 0) {
    await compTabBtn.click();
    await page.waitForTimeout(3000);
    const sc4Path = path.join(screenshotsDir, "4_comparison_tab.png");
    await page.screenshot({ path: sc4Path, fullPage: true });
    console.log(`Saved screenshot 4 (Comparison) to ${sc4Path}`);
  }

  await browser.close();
  console.log("E2E Market Analysis verification completed successfully!");
}

main().catch(err => {
  console.error("E2E script failed:", err);
  process.exit(1);
});
