const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 }
  });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:5173/allocation/studio ...");
  await page.goto("http://localhost:5173/allocation/studio");
  
  // 최초 시뮬레이션 완료 대기 (여유있게 12초 대기)
  console.log("Waiting for backend server simulation calculations to complete (12s)...");
  await page.waitForTimeout(12000);

  // 오늘 날짜 및 시간 기반으로 스크린샷 폴더 생성 (GEMINI.md 규칙 준수: YYYYMMDD_HHMMSS_간단한작업이름)
  const now = new Date();
  const timestamp = now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') + '_' +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
  
  const dirName = `${timestamp}_allocation_studio_e2e`;
  const screenshotsDir = path.join(__dirname, "..", "screenshots", dirName);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 1. 초기 S&P500 백테스트 화면 캡처
  const initialScreenshotPath = path.join(screenshotsDir, "1_sp500_default.png");
  await page.screenshot({ path: initialScreenshotPath, fullPage: true });
  console.log(`Initial SP500 screenshot saved to ${initialScreenshotPath}`);

  // 2. 대상 지수를 KOSPI로 변경
  console.log("Selecting KOSPI from target index dropdown...");
  const select = page.locator('select#target-index-select');
  await select.selectOption('KOSPI');
  
  // KOSPI 로딩 및 VIX 공고 배너 대기 (6초)
  console.log("Waiting for KOSPI simulation calculations & warning banner display (6s)...");
  await page.waitForTimeout(6000);

  // KOSPI 백테스트 화면 캡처 (VIX 공고 배너 노출 확인)
  const kospiScreenshotPath = path.join(screenshotsDir, "2_kospi_with_vix_alert.png");
  await page.screenshot({ path: kospiScreenshotPath, fullPage: true });
  console.log(`KOSPI screenshot with VIX alert banner saved to ${kospiScreenshotPath}`);

  // 3. 파라미터 조절 및 기간 설정 시나리오 테스트
  console.log("Setting start date to '2000-01-01'...");
  const dateInputs = page.locator('input[type="date"]');
  await dateInputs.first().fill('2000-01-01');
  
  // [시뮬레이션 실행] 버튼 클릭
  console.log("Clicking '시뮬레이션 실행' button...");
  const runBtn = page.locator('button:has-text("시뮬레이션 실행")');
  await runBtn.click();
  
  // 버튼 클릭 후 8초 대기 (기간이 길어 연산시간을 넉넉히 줌)
  console.log("Waiting for simulation recalculation (8s)...");
  await page.waitForTimeout(8000);
 
  // 최종 화면 캡처
  const finalScreenshotPath = path.join(screenshotsDir, "3_final_simulation.png");
  await page.screenshot({ path: finalScreenshotPath, fullPage: true });
  console.log(`Final simulation screenshot saved to ${finalScreenshotPath}`);


  // UI 상에 핵심 텍스트 렌더링 검증
  const bodyText = await page.innerText('body');
  const hasTitle = bodyText.includes("자산배분 스튜디오");
  const hasCagr = bodyText.includes("연평균 수익률 (CAGR)");
  const hasMdd = bodyText.includes("최대 낙폭 (MDD)");
  const hasVixAlert = bodyText.includes("변동성 지수(VIX) 일괄 적용 안내");

  console.log(`E2E Validation check:`);
  console.log(`- Title exists: ${hasTitle}`);
  console.log(`- CAGR label exists: ${hasCagr}`);
  console.log(`- MDD label exists: ${hasMdd}`);
  console.log(`- VIX Alert banner exists: ${hasVixAlert}`);

  await browser.close();
  
  if (hasTitle && hasCagr && hasMdd && hasVixAlert) {
    console.log("E2E Allocation Studio verification completed successfully!");
  } else {
    console.error("E2E Validation failed: some elements are missing in UI.");
    process.exit(1);
  }
}

main().catch(err => {
  console.error("E2E Allocation script failed:", err);
  process.exit(1);
});
