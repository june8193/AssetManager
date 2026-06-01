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
  await page.waitForTimeout(8000);

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
  
  const dirName = `${timestamp}_ratio_check_accounts`;
  const screenshotsDir = path.join(__dirname, "..", "..", "screenshots", dirName);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 1. 초기 대분류 화면 캡처
  const initialScreenshotPath = path.join(screenshotsDir, "1_initial_major_level.png");
  await page.screenshot({ path: initialScreenshotPath, fullPage: true });
  console.log(`Initial major level screenshot saved to ${initialScreenshotPath}`);

  // 대분류 첫 번째 항목 클릭
  console.log("Clicking the first major category to drill down...");
  const majorRow = page.locator('div[data-testid="ratio-row"]');
  if (await majorRow.count() > 0) {
    await majorRow.first().click();
    await page.waitForTimeout(2000);
  } else {
    console.log("Error: No major categories found!");
    await browser.close();
    process.exit(1);
  }

  // 2. 중분류 화면 캡처
  const subLevelScreenshotPath = path.join(screenshotsDir, "2_sub_level.png");
  await page.screenshot({ path: subLevelScreenshotPath, fullPage: true });
  console.log(`Sub level screenshot saved to ${subLevelScreenshotPath}`);

  // 중분류 첫 번째 항목 클릭
  console.log("Clicking the first sub category to drill down to stocks...");
  const subRow = page.locator('div[data-testid="ratio-row"]');
  if (await subRow.count() > 0) {
    await subRow.first().click();
    await page.waitForTimeout(2000);
  } else {
    console.log("Error: No sub categories found!");
    await browser.close();
    process.exit(1);
  }

  // 3. 종목 화면 (아코디언 닫힘 상태) 캡처
  const stockLevelClosedScreenshotPath = path.join(screenshotsDir, "3_stock_level_accordion_closed.png");
  await page.screenshot({ path: stockLevelClosedScreenshotPath, fullPage: true });
  console.log(`Stock level accordion closed screenshot saved to ${stockLevelClosedScreenshotPath}`);

  // 첫 번째 종목을 클릭하여 아코디언 펼침
  console.log("Clicking the first stock item to expand the accordion and show accounts...");
  const stockRow = page.locator('div[data-testid="ratio-row"]');
  if (await stockRow.count() > 0) {
    await stockRow.first().click();
    await page.waitForTimeout(1000);
  } else {
    console.log("Error: No stocks found!");
    await browser.close();
    process.exit(1);
  }

  // 여러 자산이 동시에 열려 있는지 검증하기 위해 두 번째 종목도 클릭해보기 (있을 경우)
  const stockCount = await stockRow.count();
  console.log(`Found ${stockCount} stock items.`);
  if (stockCount > 1) {
    console.log("Clicking the second stock item to verify multiple expansions (both should stay open)...");
    await stockRow.nth(1).click();
    await page.waitForTimeout(2000);

    // 4. 종목 화면 (다중 아코디언 펼침 상태 - 계좌 정보 노출) 캡처
    const stockLevelOpenedScreenshotPath = path.join(screenshotsDir, "4_stock_level_accordion_opened_multiple.png");
    await page.screenshot({ path: stockLevelOpenedScreenshotPath, fullPage: true });
    console.log(`Multiple accordions opened screenshot saved to ${stockLevelOpenedScreenshotPath}`);
  } else {
    // 4. 종목 화면 (아코디언 펼침 상태 - 계좌 정보 노출) 캡처
    const stockLevelOpenedScreenshotPath = path.join(screenshotsDir, "4_stock_level_accordion_opened.png");
    await page.screenshot({ path: stockLevelOpenedScreenshotPath, fullPage: true });
    console.log(`Stock level accordion opened screenshot saved to ${stockLevelOpenedScreenshotPath}`);
  }

  // 화면 우측 하단의 종목들이 렌더링되었는지 확인하고 계좌 상세 텍스트가 표시되는지 체크
  console.log("Verifying account listings in UI...");
  const bodyText = await page.innerText('body');
  
  // 데이터베이스에 등록된 실제 증권사명(예: 키움, 미래, 테스트증권 등)이 화면 텍스트에 포함되어 있는지 확인
  const hasKiwoom = bodyText.includes("키움");
  const hasMirae = bodyText.includes("미래");
  const hasTest = bodyText.includes("테스트증권");
  const hasKB = bodyText.includes("KB");
  const hasKorea = bodyText.includes("한국투자");
  const hasToss = bodyText.includes("토스");
  const hasShinhan = bodyText.includes("신한");

  console.log(`Accounts display validation:`);
  console.log(`- Contains '키움': ${hasKiwoom}`);
  console.log(`- Contains '미래': ${hasMirae}`);
  console.log(`- Contains '테스트증권': ${hasTest}`);
  console.log(`- Contains 'KB': ${hasKB}`);
  console.log(`- Contains '한국투자': ${hasKorea}`);
  console.log(`- Contains '토스': ${hasToss}`);
  console.log(`- Contains '신한': ${hasShinhan}`);

  // 5. 다시 한 번 클릭하여 아코디언을 닫는 시나리오 검증
  console.log("Clicking the first stock item again to collapse the accordion...");
  await stockRow.first().click();
  await page.waitForTimeout(1500);

  const stockLevelCollapsedScreenshotPath = path.join(screenshotsDir, "5_stock_level_accordion_collapsed.png");
  await page.screenshot({ path: stockLevelCollapsedScreenshotPath, fullPage: true });
  console.log(`Stock level accordion collapsed screenshot saved to ${stockLevelCollapsedScreenshotPath}`);

  await browser.close();
  console.log("E2E Ratio accounts verification completed successfully!");
}

main().catch(err => {
  console.error("E2E Ratio script failed:", err);
  process.exit(1);
});
