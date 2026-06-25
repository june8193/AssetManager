const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
  // 브라우저 실행
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1200 }
  });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:5173/ ...");
  await page.goto("http://localhost:5173/");
  
  // 데이터 로딩 대기
  console.log("Waiting for dashboard to load...");
  await page.waitForTimeout(6000);

  // '다시 시도' 에러 버튼이 있는 경우 클릭 시도
  const retryBtn = page.locator('button:has-text("다시 시도")');
  if (await retryBtn.count() > 0) {
    console.log("Error screen detected. Clicking '다시 시도'...");
    await retryBtn.click();
    await page.waitForTimeout(6000);
  }

  // 오늘 날짜 기반으로 screenshots 폴더명 생성
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const sec = String(now.getSeconds()).padStart(2, '0');
  const folderName = `${yyyy}${mm}${dd}_${hh}${min}${sec}_dashboard_period_filter`;

  const screenshotsDir = path.join(__dirname, "..", "..", "screenshots", folderName);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 대시보드 전체 캡처
  const dashboardScreenshotPath = path.join(screenshotsDir, "1_dashboard_all_data.png");
  await page.screenshot({ path: dashboardScreenshotPath, fullPage: true });
  console.log(`Dashboard screenshot saved to ${dashboardScreenshotPath}`);

  // 화면 제목 및 요소 검증
  const title = await page.title();
  console.log(`Page title: ${title}`);
  if (!title.includes("대시보드")) {
    throw new Error(`대시보드 페이지 로드 실패 (타이틀 오류): ${title}`);
  }

  // 총 평가 자산 표시 확인
  const totalValuation = page.locator('span:has-text("원")');
  console.log(`Total valuation label count: ${await totalValuation.count()}`);

  // 연도별/일간 현황 테이블 렌더링 검사
  const yearlyTable = page.locator('h2:has-text("연도별 현황")');
  const dailyTable = page.locator('h2:has-text("일자별 현황")');
  console.log(`Yearly Performance Table exists: ${await yearlyTable.count() > 0}`);
  console.log(`Daily Performance Table exists: ${await dailyTable.count() > 0}`);

  await browser.close();
  console.log("E2E verification completed successfully!");
}

main().catch(err => {
  console.error("E2E script failed:", err);
  process.exit(1);
});
