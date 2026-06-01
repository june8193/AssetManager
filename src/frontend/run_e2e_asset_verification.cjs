const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 }
  });
  const page = await context.newPage();

  console.log("Navigating to DB Management page...");
  await page.goto("http://localhost:5173/db");
  
  // 데이터 및 탭 로딩 대기
  await page.waitForTimeout(5000);

  // '자산 마스터' 탭 클릭
  console.log("Clicking '자산 마스터' tab...");
  const tabBtn = page.locator('button:has-text("자산 마스터")');
  await tabBtn.click();
  await page.waitForTimeout(2000);

  // 스크린샷 폴더 생성 (GEMINI.md 규칙 준수)
  const dirName = "20260601_235500_asset_verification";
  const screenshotsDir = path.join(__dirname, "..", "..", "screenshots", dirName);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 1. 초기 화면 캡처
  const initialScreenshotPath = path.join(screenshotsDir, "1_initial_form.png");
  await page.screenshot({ path: initialScreenshotPath });
  console.log(`Initial form screenshot saved to ${initialScreenshotPath}`);

  // 2. 신규 자산 추가 시나리오 (성공 케이스: 미국 주식 TSLA)
  console.log("Entering asset details for TSLA...");
  await page.fill('#ticker', 'TSLA');
  await page.selectOption('#major_category', '일반주식');
  await page.waitForTimeout(500); // 중분류 드롭다운 갱신 대기
  await page.selectOption('#sub_category', '해외주식');
  await page.selectOption('#country', 'US');

  // 조회 버튼 클릭
  const verifyBtn = page.locator('button:has-text("조회")');
  console.log("Clicking '조회' button...");
  await verifyBtn.click();
  
  // 검증 및 자산명 채워질 때까지 대기 (yfinance 조회시간 대기)
  console.log("Waiting for verification response...");
  await page.waitForTimeout(6000);

  // 자산명이 잘 채워졌는지 확인
  const assetNameInput = page.locator('#name');
  const assetNameValue = await assetNameInput.inputValue();
  console.log(`Verified Asset Name: ${assetNameValue}`);

  // 2. 조회 성공 화면 캡처
  const verifiedScreenshotPath = path.join(screenshotsDir, "2_verified_success.png");
  await page.screenshot({ path: verifiedScreenshotPath });
  console.log(`Verified success screenshot saved to ${verifiedScreenshotPath}`);

  // 추가 버튼 클릭
  const addBtn = page.locator('button:has-text("추가")');
  console.log("Clicking '추가' button to save to DB...");
  await addBtn.click();
  await page.waitForTimeout(2000);

  // 3. 자산 추가 후 목록 확인 및 캡처
  const afterAddScreenshotPath = path.join(screenshotsDir, "3_add_success.png");
  await page.screenshot({ path: afterAddScreenshotPath });
  console.log(`Asset add success screenshot saved to ${afterAddScreenshotPath}`);

  // 4. 에러 시나리오 (실패 케이스: 유효하지 않은 티커)
  console.log("Testing failure scenario with invalid ticker...");
  await page.fill('#ticker', 'INVALID999');
  await page.selectOption('#major_category', '일반주식');
  await page.waitForTimeout(500);
  await page.selectOption('#sub_category', '해외주식');
  await page.selectOption('#country', 'US');

  // 조회 버튼 클릭
  console.log("Clicking '조회' for invalid ticker...");
  const verifyBtn2 = page.locator('button:has-text("조회")');
  await verifyBtn2.click();
  await page.waitForTimeout(6000);

  // 4. 에러 메시지 확인 및 캡처
  const errorMsgScreenshotPath = path.join(screenshotsDir, "4_verified_failure.png");
  await page.screenshot({ path: errorMsgScreenshotPath });
  console.log(`Failure scenario screenshot saved to ${errorMsgScreenshotPath}`);

  // 5. 수정 모드 제약 조건 검증
  console.log("Testing edit mode constraints...");
  // 추가 폼 초기화
  const resetBtn = page.locator('button:has-text("초기화")');
  if (await resetBtn.count() > 0) {
    await resetBtn.click();
    await page.waitForTimeout(500);
  }

  // TSLA 자산 행의 수정(연필) 아이콘 클릭
  const rowLocator = page.locator('tr:has-text("TSLA")');
  if (await rowLocator.count() > 0) {
    const editBtn = rowLocator.locator('button[title="수정"]').first();
    await editBtn.click();
    await page.waitForTimeout(1000);

    // 티커, 국가, 자산명이 비활성화(disabled/readonly)인지 확인
    const tickerDisabled = await page.locator('#ticker').isDisabled();
    const countryDisabled = await page.locator('#country').isDisabled();
    const nameReadOnly = await page.locator('#name').getAttribute('readonly');
    console.log(`Edit Mode Constraints Check - Ticker Disabled: ${tickerDisabled}, Country Disabled: ${countryDisabled}, Name ReadOnly: ${nameReadOnly !== null}`);

    // 5. 수정 폼 캡처
    const editFormScreenshotPath = path.join(screenshotsDir, "5_edit_form_constraints.png");
    await page.screenshot({ path: editFormScreenshotPath });
    console.log(`Edit form screenshot saved to ${editFormScreenshotPath}`);

    // 대분류를 '배당주'로 변경
    await page.selectOption('#major_category', '배당주');
    await page.waitForTimeout(500);
    // 중분류가 '해외배당주'로 바뀌었는지 확인
    const selectedSub = await page.locator('#sub_category').inputValue();
    console.log(`Automatically selected sub category on major change: ${selectedSub}`);

    // 저장 버튼 클릭
    const saveBtn = page.locator('button:has-text("저장")');
    await saveBtn.click();
    await page.waitForTimeout(2000);

    // 6. 수정 반영 완료 캡처
    const afterEditScreenshotPath = path.join(screenshotsDir, "6_edit_save_success.png");
    await page.screenshot({ path: afterEditScreenshotPath });
    console.log(`Edit save success screenshot saved to ${afterEditScreenshotPath}`);
  } else {
    console.log("Could not find TSLA asset row in table!");
  }

  await browser.close();
  console.log("E2E asset master verification completed successfully!");
}

main().catch(err => {
  console.error("E2E script failed:", err);
  process.exit(1);
});
