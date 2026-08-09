import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

function findProjectRoot(dir) {
  if (fs.existsSync(path.join(dir, 'GEMINI.md'))) return dir;
  const parent = path.dirname(dir);
  if (parent === dir) return process.cwd();
  return findProjectRoot(parent);
}

(async () => {
  const projectRoot = findProjectRoot(process.cwd());
  const now = new Date();
  const timestampStr = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') + '_' +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
  const folderName = process.env.SCREENSHOT_FOLDER || `${timestampStr}_exchange_ui_verification`;
  const outputDir = path.join(projectRoot, 'screenshots', folderName);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('Starting E2E browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 960 } });
  const page = await context.newPage();

  try {
    console.log('Navigating to http://localhost:5173/db ...');
    await page.goto('http://localhost:5173/db', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // 거래 내역 탭 클릭
    console.log('Clicking 거래 내역 tab...');
    const txTab = page.locator('button', { hasText: '거래 내역' });
    await txTab.click();
    await page.waitForTimeout(1000);

    // 거래 유형 선택: EXCHANGE
    console.log('Selecting EXCHANGE type...');
    const typeSelect = page.locator('select[name="type"]');
    await typeSelect.waitFor({ state: 'visible', timeout: 10000 });
    await typeSelect.selectOption('EXCHANGE');
    await page.waitForTimeout(1000);

    // 라벨 노출 확인
    const sourceAssetLabel = await page.locator('text=출발 자산').isVisible();
    const targetAssetLabel = await page.locator('text=도착 자산').isVisible();
    console.log(`Labels visible - 출발 자산: ${sourceAssetLabel}, 도착 자산: ${targetAssetLabel}`);

    // 수량 및 환율 입력
    const quantityInput = page.locator('input[name="quantity"]');
    await quantityInput.fill('1000');

    const priceInput = page.locator('input[name="price"]');
    await priceInput.fill('1350');
    await page.waitForTimeout(500);

    // 지불 금액 자동 계산 및 readOnly 확인
    const totalInput = page.locator('input[name="total_amount"]');
    const totalVal = await totalInput.inputValue();
    const isEditable = await totalInput.isEditable();
    console.log(`Calculated Total Amount: ${totalVal}, isEditable: ${isEditable}`);

    // 스크린샷 1 캡처: 폼 입력 상태
    const screenshot1Path = path.join(outputDir, '01_exchange_form_filled.png');
    await page.screenshot({ path: screenshot1Path, fullPage: true });
    console.log(`Saved screenshot 1: ${screenshot1Path}`);

    // 거래 기록 추가 클릭
    const submitBtn = page.locator('button:has-text("거래 기록 추가")');
    await submitBtn.click();
    await page.waitForTimeout(2000);

    // 스크린샷 2 캡처: 거래 추가 후 목록 상태
    const screenshot2Path = path.join(outputDir, '02_exchange_transaction_added.png');
    await page.screenshot({ path: screenshot2Path, fullPage: true });
    console.log(`Saved screenshot 2: ${screenshot2Path}`);

    console.log('E2E Test completed successfully!');
  } catch (err) {
    console.error('E2E Test Error:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
