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
  await page.waitForTimeout(6000);

  // 에러 화면 발생 시 '다시 시도' 자동 클릭 처리
  const retryBtn = page.locator('button:has-text("다시 시도")');
  if (await retryBtn.count() > 0) {
    console.log("Detected error screen. Clicking '다시 시도'...");
    await retryBtn.click();
    await page.waitForTimeout(5000);
  }

  // 스크린샷 폴더 생성 (GEMINI.md 규칙 준수: screenshots/YYYYMMDD_HHMMSS_이름)
  const now = new Date();
  const format2 = (n) => String(n).padStart(2, '0');
  const dirName = `${now.getFullYear()}${format2(now.getMonth()+1)}${format2(now.getDate())}_` +
                  `${format2(now.getHours())}${format2(now.getMinutes())}${format2(now.getSeconds())}_dashboard_refresh`;
  
  const screenshotsDir = path.join(__dirname, "..", "..", "screenshots", dirName);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 1. 초기 화면 캡처
  const initialScreenshotPath = path.join(screenshotsDir, "1_dashboard_loaded.png");
  await page.screenshot({ path: initialScreenshotPath, fullPage: true });
  console.log(`Initial dashboard loaded screenshot saved to ${initialScreenshotPath}`);

  // 새로고침 버튼 확인
  const refreshBtn = page.locator('button:has-text("실시간 시세 새로고침")');
  const count = await refreshBtn.count();
  console.log(`Refresh Button Count: ${count}`);
  if (count === 0) {
    throw new Error("Could not find '실시간 시세 새로고침' button on dashboard!");
  }

  // 2. 새로고침 클릭
  console.log("Clicking '실시간 시세 새로고침' button...");
  await refreshBtn.click();

  // 클릭 직후 '시세 최신화 중...'으로 바뀌는지 확인 및 캡처
  await page.waitForTimeout(500);
  const refreshingBtn = page.locator('button:has-text("시세 최신화 중")');
  console.log(`Is button state '시세 최신화 중...': ${await refreshingBtn.count() > 0}`);
  
  const activeScreenshotPath = path.join(screenshotsDir, "2_refreshing_active.png");
  await page.screenshot({ path: activeScreenshotPath, fullPage: true });
  console.log(`Refreshing active screenshot saved to ${activeScreenshotPath}`);

  // 3. 완료 대기 (최대 15초 대기)
  console.log("Waiting for refresh api call to finish...");
  await page.waitForSelector('button:has-text("실시간 시세 새로고침")', { timeout: 15000 });

  // 토스트 메시지나 완료 상태 확인을 위해 1초 추가 대기
  await page.waitForTimeout(1000);

  // 완료 후 캡처
  const completeScreenshotPath = path.join(screenshotsDir, "3_refresh_complete.png");
  await page.screenshot({ path: completeScreenshotPath, fullPage: true });
  console.log(`Refresh complete screenshot saved to ${completeScreenshotPath}`);

  // 토스트 메시지 텍스트 파싱 시도
  const toastSuccess = page.locator('div:has-text("최신화되었습니다")').last();
  const toastSkipped = page.locator('div:has-text("1분 이내")').last();
  
  if (await toastSuccess.count() > 0) {
    console.log(`Toast Success Detected: ${await toastSuccess.innerText()}`);
  } else if (await toastSkipped.count() > 0) {
    console.log(`Toast Skipped (Rate Limit) Detected: ${await toastSkipped.innerText()}`);
  } else {
    console.log("No specific toast message text found, but button restored.");
  }

  await browser.close();
  console.log("E2E dashboard refresh verification completed successfully!");
}

main().catch(err => {
  console.error("E2E script failed:", err);
  process.exit(1);
});
