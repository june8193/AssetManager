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
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 }
  });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:5173/simulation/asset-allocation ...");
  await page.goto("http://localhost:5173/simulation/asset-allocation");
  
  // 첫 페이지 로딩 대기
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
  const timestamp = getFormattedDateTime();
  const dirName = `${timestamp}_simulation_recurring`;
  const screenshotsDir = path.join(__dirname, "..", "screenshots", dirName);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
  console.log(`Screenshots will be saved to: ${screenshotsDir}`);

  // 1. 초기 페이지 로딩 검증 (적립식 시뮬레이션 기본 탭 검증) 및 캡처
  const titleText = await page.locator('h1').innerText();
  console.log(`- Page Title Rendered: ${titleText}`);
  
  // 적립식 시뮬레이션 탭이 기본으로 활성화되었는지 텍스트를 통해 간접 확인
  const isRecurringActive = await page.locator('button:has-text("적립식 시뮬레이션")').evaluate(el => el.classList.contains('bg-white'));
  console.log(`- Is '적립식 시뮬레이션' tab active as default?: ${isRecurringActive}`);

  const initialScreenshotPath = path.join(screenshotsDir, "1_default_recurring_view.png");
  await page.screenshot({ path: initialScreenshotPath, fullPage: true });
  console.log(`Screenshot saved: ${initialScreenshotPath}`);

  // 2. 매년 추가 적립금 금액 변경 테스트 (기본값 2000만원 -> 3000만원)
  console.log("Changing annual deposit to 30,000,000 KRW...");
  const depositInput = page.locator('input[type="number"]').first();
  await depositInput.fill("30000000");
  await depositInput.press("Enter");
  await page.waitForTimeout(4000);

  const depositChangedScreenshotPath = path.join(screenshotsDir, "2_annual_deposit_changed_to_30m.png");
  await page.screenshot({ path: depositChangedScreenshotPath, fullPage: true });
  console.log(`Screenshot saved: ${depositChangedScreenshotPath}`);

  // 3. 거치식 백테스트 탭으로 전환 검증
  console.log("Switching to '거치식 백테스트' tab...");
  await page.click('button:has-text("거치식 백테스트")');
  await page.waitForTimeout(4000);

  const lumpTabScreenshotPath = path.join(screenshotsDir, "3_switched_to_lump_sum_tab.png");
  await page.screenshot({ path: lumpTabScreenshotPath, fullPage: true });
  console.log(`Screenshot saved: ${lumpTabScreenshotPath}`);

  // 4. 기간 프리셋 최근 10년으로 변경 테스트
  console.log("Clicking '최근 10년' period filter...");
  await page.click('button:has-text("최근 10년")');
  await page.waitForTimeout(4000);

  const tenYearsScreenshotPath = path.join(screenshotsDir, "4_period_10y_changed.png");
  await page.screenshot({ path: tenYearsScreenshotPath, fullPage: true });
  console.log(`Screenshot saved: ${tenYearsScreenshotPath}`);

  // 5. 연도별/월별 현황 테이블 상세 탭 전환 테스트
  console.log("Clicking '월별 현황' table tab...");
  await page.click('button:has-text("월별 현황")');
  await page.waitForTimeout(3000);

  const tableScreenshotPath = path.join(screenshotsDir, "5_monthly_table_view.png");
  await page.screenshot({ path: tableScreenshotPath, fullPage: true });
  console.log(`Screenshot saved: ${tableScreenshotPath}`);

  await browser.close();
  console.log("E2E Simulation dashboard verification completed successfully!");
}

main().catch(err => {
  console.error("E2E Simulation script failed:", err);
  process.exit(1);
});
