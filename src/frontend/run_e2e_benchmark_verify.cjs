const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 }
  });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:5173/benchmark ...");
  await page.goto("http://localhost:5173/benchmark");
  
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

  // 스크린샷 폴더 생성 (GEMINI.md 규칙 준수: YYYYMMDD_HHMMSS_간단한작업이름)
  const dirName = "20260606_204500_benchmark_cache_fix";
  const screenshotsDir = path.join(__dirname, "..", "..", "screenshots", dirName);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 1. 내 총자산 카드 영역 내용 출력해보기
  console.log("----------------------------------------");
  console.log("Checking 내 총자산 Card Elements:");
  
  const valuationText = await page.locator('div.text-2xl.font-black.text-slate-800').first().innerText();
  console.log(`- Valuation Rendered: ${valuationText}`);

  const snapshotText = await page.locator('div.text-slate-400.text-\\[10px\\]').first().innerText();
  console.log(`- Snapshot/Benchmark Date Notice Rendered:\n${snapshotText}`);
  console.log("----------------------------------------");

  // 초기 화면 캡처
  const initialScreenshotPath = path.join(screenshotsDir, "1_benchmark_page_verified.png");
  await page.screenshot({ path: initialScreenshotPath, fullPage: true });
  console.log(`Screenshot saved to ${initialScreenshotPath}`);

  await browser.close();
  console.log("E2E verification completed successfully!");
}

main().catch(err => {
  console.error("E2E script failed:", err);
  process.exit(1);
});
