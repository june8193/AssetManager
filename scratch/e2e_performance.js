import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function run() {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').split('.')[0];
  const screenshotDir = path.join(process.cwd(), 'screenshots', `${timestamp}_performance_metrics`);
  
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  console.log(`[E2E] Launching Chromium browser...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log(`[E2E] Navigating to http://localhost:5173/performance ...`);
  await page.goto('http://localhost:5173/performance', { waitUntil: 'networkidle' });

  // 1. 대시보드 메인 화면 스크린샷
  await page.screenshot({ path: path.join(screenshotDir, '01_dashboard_main.png'), fullPage: true });
  console.log(`[E2E] Saved 01_dashboard_main.png`);

  // 2. 무위험 수익률 수정 클릭 및 입력
  const editBtn = page.getByRole('button', { name: '설정 변경' });
  if (await editBtn.isVisible()) {
    await editBtn.click();
    const input = page.locator('input[type="number"]');
    await input.fill('4.0');
    const saveBtn = page.getByRole('button', { name: '저장' });
    await saveBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, '02_rate_updated.png'), fullPage: true });
    console.log(`[E2E] Saved 02_rate_updated.png`);
  }

  // 3. 안내 모달 오픈
  const infoBtn = page.getByTitle('AssetManager 상세 산출 공식 보기');
  if (await infoBtn.isVisible()) {
    await infoBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotDir, '03_performance_info_modal.png'), fullPage: true });
    console.log(`[E2E] Saved 03_performance_info_modal.png`);
  }

  await browser.close();
  console.log(`[E2E] All screenshots saved in ${screenshotDir}`);
}

run().catch((err) => {
  console.error('[E2E Error]', err);
  process.exit(1);
});
