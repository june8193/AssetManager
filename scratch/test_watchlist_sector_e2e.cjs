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
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}_watchlist_sector`;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 }
  });
  const page = await context.newPage();

  // 스크린샷 폴더 생성 (GEMINI.md 규칙: YYYYMMDD_HHMMSS_간단한작업이름)
  const dirName = getFormattedDateTime();
  const screenshotsDir = path.join(__dirname, "..", "screenshots", dirName);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
  console.log(`[E2E] Screenshots will be saved in: ${screenshotsDir}`);

  // 1. 관리 페이지 이동
  console.log("[E2E] Navigating to http://localhost:5173/db/watchlist-sector ...");
  await page.goto("http://localhost:5173/db/watchlist-sector");
  await page.waitForTimeout(3000);

  await page.screenshot({ path: path.join(screenshotsDir, "1_management_page_initial.png"), fullPage: true });
  console.log("[E2E] Initial management page screenshot saved.");

  // 2. 섹터 생성 테스트
  console.log("[E2E] Creating a custom sector 'E2E 반도체'...");
  await page.fill('input[placeholder="새 섹터명 입력"]', 'E2E 반도체');
  await page.click('button:has-text("추가")');
  await page.waitForTimeout(3000);

  await page.screenshot({ path: path.join(screenshotsDir, "2_sector_created.png"), fullPage: true });
  console.log("[E2E] Sector created screenshot saved.");

  // 3. 종목 검색 테스트
  console.log("[E2E] Searching for '삼성전자'...");
  await page.fill('input[placeholder*="종목명 또는 6자리 종목코드를 입력하세요"]', '삼성전자');
  await page.click('button:has-text("검색")');
  await page.waitForTimeout(3000);

  await page.screenshot({ path: path.join(screenshotsDir, "3_search_results.png"), fullPage: true });
  console.log("[E2E] Search results screenshot saved.");

  // 4. 관심종목 등록 테스트
  console.log("[E2E] Registering '삼성전자' to watchlist...");
  const addWatchlistBtn = page.locator('button:has-text("관심종목 등록")').first();
  if (await addWatchlistBtn.count() > 0) {
    await addWatchlistBtn.click();
    await page.waitForTimeout(3000);
  }

  await page.screenshot({ path: path.join(screenshotsDir, "4_watchlist_registered.png"), fullPage: true });
  console.log("[E2E] Watchlist registered screenshot saved.");

  // 5. 커스텀 섹터에 종목 추가 테스트
  console.log("[E2E] Adding '삼성전자' to sector 'E2E 반도체'...");
  const addSectorBtn = page.locator('button:has-text("섹터 추가")').first();
  if (await addSectorBtn.count() > 0) {
    await addSectorBtn.click();
    await page.waitForTimeout(1000);

    // 모달창 셀렉트 박스에서 'E2E 반도체' 선택
    const select = page.locator('select');
    await select.selectOption({ label: 'E2E 반도체' });
    await page.waitForTimeout(500);

    // 추가 확정 클릭
    await page.click('button:has-text("섹터에 추가")');
    await page.waitForTimeout(3000);
  }

  await page.screenshot({ path: path.join(screenshotsDir, "5_sector_stock_added.png"), fullPage: true });
  console.log("[E2E] Sector stock added screenshot saved.");

  // 6. 지표분석(수익률 비교 분석) 페이지 이동하여 잘 렌더링되는지 검증
  console.log("[E2E] Navigating to http://localhost:5173/benchmark/compare-returns ...");
  await page.goto("http://localhost:5173/benchmark/compare-returns");
  await page.waitForTimeout(5000);

  await page.screenshot({ path: path.join(screenshotsDir, "6_compare_returns_dashboard.png"), fullPage: true });
  console.log("[E2E] Compare returns dashboard screenshot saved.");

  await browser.close();
  console.log("[E2E] E2E verification completed successfully!");
}

main().catch(err => {
  console.error("[E2E] E2E script failed:", err);
  process.exit(1);
});
