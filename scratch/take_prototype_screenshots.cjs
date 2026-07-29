const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 960 });

  const dir = path.join(__dirname, '..', 'screenshots', '20260729_150400_dividend_prototype');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log('Navigating to Variant A...');
  await page.goto('http://localhost:5173/dividend?variant=A', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(dir, 'variant_A_dashboard.png'), fullPage: true });

  console.log('Navigating to Variant B...');
  await page.goto('http://localhost:5173/dividend?variant=B', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(dir, 'variant_B_tabs.png'), fullPage: true });

  console.log('Navigating to Variant C...');
  await page.goto('http://localhost:5173/dividend?variant=C', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(dir, 'variant_C_split.png'), fullPage: true });

  await browser.close();
  console.log('Screenshots saved successfully to:', dir);
})();
