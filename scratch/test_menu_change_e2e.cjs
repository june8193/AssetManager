const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function getFormattedDateTime() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}_index_analysis`;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 }
  });
  const page = await context.newPage();

  // 스크린샷 폴더 생성 (GEMINI.md 규칙: YYYYMMDD_HHMMSS_간단한작업이름)
  const dirName = getFormattedDateTime();
  const screenshotsDir = path.join(__dirname, '..', 'screenshots', dirName);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
  console.log(`[E2E] Screenshots will be saved to: ${screenshotsDir}`);

  // 1. 대시보드 페이지 이동
  console.log("[E2E] Navigating to http://localhost:5173 ...");
  await page.goto("http://localhost:5173");
  await page.waitForTimeout(3000); // 페이지 로딩 대기

  // 2. 시장분석 메뉴 클릭하여 하위 메뉴 토글 (필요시)
  console.log("[E2E] Toggle '시장분석' menu in sidebar...");
  const marketMenu = page.locator('button:has-text("시장분석"), a:has-text("시장분석")');
  if (await marketMenu.count() > 0) {
    await marketMenu.click();
    await page.waitForTimeout(1000);
  }

  // 3. 지수분석 메뉴 확인 및 스크린샷
  console.log("[E2E] Checking for '지수분석' menu...");
  const indexAnalysisMenu = page.locator('a:has-text("지수분석")');
  const count = await indexAnalysisMenu.count();
  if (count === 0) {
    throw new Error("[E2E] FAIL: '지수분석' menu not found in sidebar!");
  }
  console.log("[E2E] SUCCESS: '지수분석' menu found!");
  await page.screenshot({ path: path.join(screenshotsDir, "1_sidebar_menu.png"), fullPage: true });

  // 4. 지수분석 메뉴 클릭하여 이동
  console.log("[E2E] Clicking '지수분석' menu...");
  await indexAnalysisMenu.click();
  await page.waitForTimeout(5000); // 데이터 로딩 대기

  // 5. 지수분석 페이지 타이틀 검증 및 스크린샷
  console.log("[E2E] Checking for '지수분석' title in page...");
  const pageTitle = page.locator('h1:has-text("지수분석")');
  if (await pageTitle.count() === 0) {
    throw new Error("[E2E] FAIL: '지수분석' page title not found!");
  }
  console.log("[E2E] SUCCESS: '지수분석' page title verified!");
  await page.screenshot({ path: path.join(screenshotsDir, "2_index_analysis_page.png"), fullPage: true });

  await browser.close();
  console.log("[E2E] E2E verification completed successfully!");
}

main().catch(err => {
  console.error("[E2E] E2E script failed:", err);
  process.exit(1);
});
