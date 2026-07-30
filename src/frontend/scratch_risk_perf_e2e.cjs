const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const screenshotDir = path.join(__dirname, '..', '..', 'screenshots', '20260730_171800_risk_performance');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  console.log('Navigating to http://localhost:5173/performance ...');
  await page.goto('http://localhost:5173/performance', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 메인 대시보드 스크린샷 (메뉴명 및 종목 성과 테이블)
  await page.screenshot({ path: path.join(screenshotDir, '01_risk_performance_dashboard.png'), fullPage: true });
  console.log('Saved 01_risk_performance_dashboard.png');

  await browser.close();
})();
