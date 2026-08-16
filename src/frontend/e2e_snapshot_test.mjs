import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function runE2ETest() {
  const screenshotDir = path.resolve(process.cwd(), '../../screenshots/20260816_110500_snapshot_wizard');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log('1. 대시보드 페이지 접속 (http://localhost:5173)...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(screenshotDir, '01_dashboard.png') });
  console.log('대시보드 캡처 완료');

  console.log('2. 스냅샷 마법사 페이지로 이동 (/snapshot-wizard)...');
  await page.goto('http://localhost:5173/snapshot-wizard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(screenshotDir, '02_snapshot_wizard_step1.png') });
  console.log('스냅샷 마법사 Step 1 캡처 완료');

  console.log('3. DB 관리 페이지로 이동 (/db)...');
  await page.goto('http://localhost:5173/db', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(screenshotDir, '03_db_management.png') });
  console.log('DB 관리 페이지 캡처 완료');

  await browser.close();
  console.log('E2E 테스트 성공 완료! 모든 스크린샷이 저장되었습니다.');
}

runE2ETest().catch(err => {
  console.error('E2E 테스트 실패:', err);
  process.exit(1);
});
