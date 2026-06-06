const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 }
  });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:5173/ ...");
  await page.goto("http://localhost:5173/");
  
  // 데이터 로딩 대기
  console.log("Waiting for backend server initialization...");
  await page.waitForTimeout(5000);

  // 스크린샷 폴더 생성 (GEMINI.md 규칙 준수: YYYYMMDD_HHMMSS_간단한작업이름)
  const dirName = "20260606_205000_remove_watchlist_and_tab_title";
  const screenshotsDir = path.join(__dirname, "..", "screenshots", dirName);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 1. 대시보드 페이지 타이틀 및 화면 검증
  const dashboardTitle = await page.title();
  console.log(`Dashboard Tab Title: "${dashboardTitle}"`);
  if (dashboardTitle !== "AssetManager - 대시보드") {
    throw new Error(`대시보드 탭 타이틀 불일치: ${dashboardTitle}`);
  }
  const dashboardScreenshotPath = path.join(screenshotsDir, "1_dashboard_page.png");
  await page.screenshot({ path: dashboardScreenshotPath, fullPage: true });
  console.log(`Dashboard screenshot saved to ${dashboardScreenshotPath}`);

  // 2. 벤치마크 비교 페이지로 이동
  console.log("Navigating to http://localhost:5173/benchmark ...");
  await page.goto("http://localhost:5173/benchmark");
  await page.waitForTimeout(5000);

  // 벤치마크 페이지 타이틀 검증
  const benchmarkTitle = await page.title();
  console.log(`Benchmark Page Tab Title: "${benchmarkTitle}"`);
  if (benchmarkTitle !== "AssetManager - 벤치마크 비교") {
    throw new Error(`벤치마크 탭 타이틀 불일치: ${benchmarkTitle}`);
  }

  // 관심 종목 토글 버튼 부재 검증
  const samsungToggleBtn = page.locator('button:has-text("관심: 삼성전자")');
  const toggleBtnCount = await samsungToggleBtn.count();
  console.log(`Watchlist stock toggle button count (should be 0): ${toggleBtnCount}`);
  if (toggleBtnCount > 0) {
    throw new Error("벤치마크 비교 차트 아래에 관심 종목 토글 단추가 여전히 노출됩니다.");
  }

  // 관심 종목 트래킹 테이블 부재 검증
  const watchlistTableTitle = page.locator('h3:has-text("관심 종목 트래킹 (Watchlist)")');
  const tableTitleCount = await watchlistTableTitle.count();
  console.log(`Watchlist table title count (should be 0): ${tableTitleCount}`);
  if (tableTitleCount > 0) {
    throw new Error("벤치마크 비교 하단에 관심 종목 트래킹 테이블이 여전히 노출됩니다.");
  }

  // 벤치마크 초과수익률 분석 테이블 존재 검증
  const alphaTableTitle = page.locator('h3:has-text("벤치마크 초과수익률 (Alpha) 분석")');
  const alphaTableCount = await alphaTableTitle.count();
  console.log(`Alpha table title count (should be 1): ${alphaTableCount}`);
  if (alphaTableCount === 0) {
    throw new Error("벤치마크 초과수익률 분석 테이블이 보이지 않습니다.");
  }

  const benchmarkScreenshotPath = path.join(screenshotsDir, "2_benchmark_page.png");
  await page.screenshot({ path: benchmarkScreenshotPath, fullPage: true });
  console.log(`Benchmark screenshot saved to ${benchmarkScreenshotPath}`);

  // 3. API 연결 관리 페이지로 이동
  console.log("Navigating to http://localhost:5173/connection ...");
  await page.goto("http://localhost:5173/connection");
  await page.waitForTimeout(3000);

  const connectionTitle = await page.title();
  console.log(`Connection Page Tab Title: "${connectionTitle}"`);
  if (connectionTitle !== "AssetManager - API 연결 관리") {
    throw new Error(`API 연결 관리 탭 타이틀 불일치: ${connectionTitle}`);
  }

  const connectionScreenshotPath = path.join(screenshotsDir, "3_connection_page.png");
  await page.screenshot({ path: connectionScreenshotPath, fullPage: true });
  console.log(`Connection screenshot saved to ${connectionScreenshotPath}`);

  await browser.close();
  console.log("E2E verification completed successfully!");
}

main().catch(err => {
  console.error("E2E script failed:", err);
  process.exit(1);
});
