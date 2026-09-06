const path = require('path');
const fs = require('fs');
const { chromium } = require(path.resolve(__dirname, '../src/frontend/node_modules/playwright'));

async function run() {
  const screenshotDir = path.resolve(__dirname, '../screenshots/20260906_214100_market_chart_integration');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 }
  });
  const page = await context.newPage();

  console.log('1. 페이지 접속 및 초기 로딩...');
  await page.goto('http://localhost:5173/market/analysis', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="integrated-market-chart"]', { timeout: 60000 });
  const chartContainer = page.locator('[data-testid="integrated-market-chart"]');
  await chartContainer.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  console.log('2. 기본 화면 캡처 완료 (01, 02, 03은 이미 확보됨)');

  console.log('3. 기간 1년으로 변경');
  await page.getByRole('button', { name: '1년' }).click();
  await page.waitForSelector('[data-testid="integrated-market-chart"]', { timeout: 60000 });
  await page.waitForTimeout(3000);
  await chartContainer.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(screenshotDir, '04_period_1year_stats.png'), fullPage: true });

  console.log('E2E 검증 전체 완료!');
  await browser.close();
}

run().catch(err => {
  console.error('E2E 실패:', err);
  process.exit(1);
});
