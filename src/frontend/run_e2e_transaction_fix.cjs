const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 }
  });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:5173/db ...");
  await page.goto("http://localhost:5173/db");
  
  // 데이터 로딩 대기
  console.log("Waiting for backend server and DB initialization...");
  await page.waitForTimeout(5000);

  // '거래 내역' 탭 클릭
  console.log("Switching to '거래 내역' tab...");
  const txTabBtn = page.locator('button:has-text("거래 내역")');
  await txTabBtn.click();
  await page.waitForTimeout(2000);

  // 스크린샷 폴더 생성 (GEMINI.md 규칙 준수: YYYYMMDD_HHMMSS_간단한작업이름)
  const dirName = "20260606_213000_transaction_comma_fix";
  const screenshotsDir = path.join(__dirname, "..", "..", "screenshots", dirName);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 1. 숫자 입력 쉼표 포맷 검증
  console.log("Testing number input comma formatting...");
  const quantityInput = page.locator('input[name="quantity"]');
  const priceInput = page.locator('input[name="price"]');
  const totalInput = page.locator('input[name="total_amount"]');

  // 수량 입력
  await quantityInput.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await quantityInput.fill('1250.5');
  
  // 단가 입력
  await priceInput.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await priceInput.fill('5000');
  
  await page.waitForTimeout(1000);

  const formattedQuantity = await quantityInput.inputValue();
  const formattedPrice = await priceInput.inputValue();
  const formattedTotal = await totalInput.inputValue();

  console.log(`- Entered Quantity '1250.5' -> Renders: '${formattedQuantity}'`);
  console.log(`- Entered Price '5000' -> Renders: '${formattedPrice}'`);
  console.log(`- Auto calculated Total -> Renders: '${formattedTotal}'`);

  if (formattedQuantity === '1,250.5' && formattedPrice === '5,000' && formattedTotal === '6,252,500') {
    console.log(">>> [PASS] Comma formatting and auto calculation check");
  } else {
    console.log(">>> [FAIL] Comma formatting and auto calculation check");
  }

  // 첫 번째 스크린샷 저장
  const step1ScreenshotPath = path.join(screenshotsDir, "1_comma_formatting.png");
  await page.screenshot({ path: step1ScreenshotPath, fullPage: false });
  console.log(`Saved screenshot to ${step1ScreenshotPath}`);

  // 2. 예수금 자산 선택 시 제약 조건 검증
  console.log("Testing cash asset type (KRW) constraints...");
  const assetSelect = page.locator('select[name="asset_id"]');
  const typeSelect = page.locator('select[name="type"]');
  const currencySelect = page.locator('select[name="currency"]');

  // 원화예수금(id: 1) 선택
  await assetSelect.selectOption('1');
  await page.waitForTimeout(1000);

  // 제약 확인
  const isPriceReadOnly = await priceInput.getAttribute('readonly') !== null;
  const priceValue = await priceInput.inputValue();
  const currencyValue = await currencySelect.inputValue();
  const isCurrencyDisabled = await currencySelect.isDisabled();

  console.log(`- Price input readOnly: ${isPriceReadOnly}`);
  console.log(`- Price value (should be 1): ${priceValue}`);
  console.log(`- Currency value (should be KRW): ${currencyValue}`);
  console.log(`- Currency select disabled: ${isCurrencyDisabled}`);

  const typeOptionsCount = await typeSelect.locator('option').count();
  const typeOptions = [];
  for (let i = 0; i < typeOptionsCount; i++) {
    typeOptions.push(await typeSelect.locator('option').nth(i).getAttribute('value'));
  }
  console.log(`- Type select options: ${typeOptions.join(', ')}`);

  if (isPriceReadOnly && priceValue === '1' && currencyValue === 'KRW' && isCurrencyDisabled && typeOptions.includes('DEPOSIT') && typeOptions.includes('WITHDRAW') && !typeOptions.includes('BUY')) {
    console.log(">>> [PASS] Cash asset constraint check");
  } else {
    console.log(">>> [FAIL] Cash asset constraint check");
  }

  // 두 번째 스크린샷 저장
  const step2ScreenshotPath = path.join(screenshotsDir, "2_cash_asset_constraints.png");
  await page.screenshot({ path: step2ScreenshotPath, fullPage: false });
  console.log(`Saved screenshot to ${step2ScreenshotPath}`);

  // 3. 일반 주식 자산 선택 시 통화 자동 고정 검증 (예: 미국 코카콜라 - id: 4)
  console.log("Testing stock asset type (KO - US) currency mapping...");
  
  // KO(id: 4) 선택
  await assetSelect.selectOption('4');
  await page.waitForTimeout(1000);

  const stockCurrencyValue = await currencySelect.inputValue();
  const isStockCurrencyDisabled = await currencySelect.isDisabled();
  const isStockPriceReadOnly = await priceInput.getAttribute('readonly') !== null;

  console.log(`- Coca-Cola (US) Currency (should be USD): ${stockCurrencyValue}`);
  console.log(`- Currency select disabled: ${isStockCurrencyDisabled}`);
  console.log(`- Price input readOnly (should be false): ${isStockPriceReadOnly}`);

  if (stockCurrencyValue === 'USD' && isStockCurrencyDisabled && !isStockPriceReadOnly) {
    console.log(">>> [PASS] Stock asset currency mapping check");
  } else {
    console.log(">>> [FAIL] Stock asset currency mapping check");
  }

  // 세 번째 스크린샷 저장
  const step3ScreenshotPath = path.join(screenshotsDir, "3_stock_asset_currency_mapping.png");
  await page.screenshot({ path: step3ScreenshotPath, fullPage: false });
  console.log(`Saved screenshot to ${step3ScreenshotPath}`);

  await browser.close();
  console.log("E2E manual verification script completed.");
}

main().catch(err => {
  console.error("E2E script failed:", err);
  process.exit(1);
});
