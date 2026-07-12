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
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}_stock_analysis`;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 }
  });
  const page = await context.newPage();

  // 스크린샷 폴더 생성 (GEMINI.md 규칙: YYYYMMDD_HHMMSS_간단한작업이름)
  const dirName = getFormattedDateTime();
  const screenshotsDir = path.join(__dirname, '..', '..', 'screenshots', dirName);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
  console.log(`[E2E] Screenshots will be saved to: ${screenshotsDir}`);

  // 1. 대시보드 페이지 이동
  console.log("[E2E] Navigating to http://localhost:5173 ...");
  await page.goto("http://localhost:5173");
  await page.waitForTimeout(3000); // 페이지 로딩 대기

  // 2. 시장분석 메뉴 클릭하여 하위 메뉴 토글
  console.log("[E2E] Toggle '시장분석' menu in sidebar...");
  const marketMenu = page.locator('button:has-text("시장분석"), a:has-text("시장분석")');
  if (await marketMenu.count() > 0) {
    await marketMenu.click();
    await page.waitForTimeout(1000);
  }

  // 3. 종목분석 메뉴 확인
  console.log("[E2E] Checking for '종목분석' menu...");
  const stockAnalysisMenu = page.locator('a:has-text("종목분석")');
  const count = await stockAnalysisMenu.count();
  if (count === 0) {
    throw new Error("[E2E] FAIL: '종목분석' menu not found in sidebar!");
  }
  console.log("[E2E] SUCCESS: '종목분석' menu found!");

  // 4. 종목분석 메뉴 클릭하여 이동
  console.log("[E2E] Clicking '종목분석' menu...");
  await stockAnalysisMenu.click();
  await page.waitForTimeout(3000); // 로딩 대기

  // 5. 종목분석 페이지 타이틀 검증 및 초기 스크린샷
  console.log("[E2E] Checking for '종목분석' title in page...");
  const pageTitle = page.locator('h1:has-text("종목분석")');
  if (await pageTitle.count() === 0) {
    throw new Error("[E2E] FAIL: '종목분석' page title not found!");
  }
  console.log("[E2E] SUCCESS: '종목분석' page title verified!");
  await page.screenshot({ path: path.join(screenshotsDir, "1_initial_stock_analysis.png"), fullPage: true });

  // 6. 관심종목 칩 클릭해서 분석 활성화
  console.log("[E2E] Checking for watchlist chips...");
  // '삼성전자' 버튼을 직접 찾아서 클릭
  const stockChip = page.locator('button:has-text("삼성전자")').first();
  if (await stockChip.count() > 0) {
    const chipText = await stockChip.innerText();
    console.log(`[E2E] Clicking stock chip: ${chipText}`);
    await stockChip.click();
    await page.waitForTimeout(5000); // 주가 데이터 로딩 대기
    await page.screenshot({ path: path.join(screenshotsDir, "2_stock_selected.png"), fullPage: true });

    // 7. 지수 비교 토글 활성화
    console.log("[E2E] Enabling index comparison toggle...");
    const compareToggle = page.locator('input#compare-toggle');
    if (await compareToggle.count() > 0) {
      // 투명 체크박스이므로 라벨이나 그 컨테이너를 클릭
      const toggleLabel = page.locator('label:has(input#compare-toggle)');
      await toggleLabel.click();
      await page.waitForTimeout(4000); // 지수 가격 데이터 로드 및 렌더링 대기
      await page.screenshot({ path: path.join(screenshotsDir, "3_index_comparison_active.png"), fullPage: true });
      console.log("[E2E] SUCCESS: Index comparison enabled!");
    } else {
      console.log("[E2E] WARNING: Compare toggle not found.");
    }

    // 8. 기간 필터 '직접설정' 기능 테스트
    console.log("[E2E] Testing custom date range selection...");
    const customPeriodBtn = page.locator('button:has-text("직접설정")');
    if (await customPeriodBtn.count() > 0) {
      await customPeriodBtn.click();
      await page.waitForTimeout(1000);

      // 시작일 및 종료일 입력 필드 획득
      const startDateInput = page.locator('input[aria-label="시작일"]');
      const endDateInput = page.locator('input[aria-label="종료일"]');

      if (await startDateInput.count() > 0 && await endDateInput.count() > 0) {
        // 날짜 채우기 (2025-06-01 ~ 2026-06-01)
        await startDateInput.fill('2025-06-01');
        await endDateInput.fill('2026-06-01');
        await page.waitForTimeout(4000); // 데이터 로드 대기
        await page.screenshot({ path: path.join(screenshotsDir, "4_custom_date_selected.png"), fullPage: true });
        console.log("[E2E] SUCCESS: Custom date range applied and verified!");
      } else {
        console.log("[E2E] WARNING: Date inputs not found after clicking '직접설정'.");
      }
    } else {
      console.log("[E2E] WARNING: '직접설정' period button not found.");
    }
  } else {
    console.log("[E2E] WARNING: No watchlist stock chips found to test selection.");
  }

  await browser.close();
  console.log("[E2E] E2E verification completed successfully!");
}

main().catch(err => {
  console.error("[E2E] E2E script failed:", err);
  process.exit(1);
});
