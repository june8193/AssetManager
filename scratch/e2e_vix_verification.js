const path = require('path');
const fs = require('fs');
const { chromium } = require(path.resolve(__dirname, '../src/frontend/node_modules/playwright'));

async function run() {
  const screenshotDir = path.resolve(__dirname, '../screenshots/20260906_210600_vix_verification');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 }
  });
  const page = await context.newPage();

  console.log('1. http://localhost:5173/market/analysis 접속 중...');
  
  // 첫 로딩 historical 응답 대기
  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().includes('/api/market/analysis/historical') && res.status() === 200, { timeout: 60000 }),
    page.goto('http://localhost:5173/market/analysis', { waitUntil: 'domcontentloaded' })
  ]);
  console.log('첫 데이터 로딩 성공:', response.url());

  // VIX 차트 컨테이너 및 Info 버튼 대기
  console.log('2. VIX 차트 및 Info 버튼 확인 중...');
  await page.waitForSelector('[data-testid="vix-info-button"]', { timeout: 15000 });
  const vixContainer = page.locator('[data-testid="vix-info-container"]');
  await vixContainer.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  // 1) S&P 500 VIX 차트 캡처
  console.log('3. S&P 500 VIX 차트 캡처');
  await page.screenshot({ path: path.join(screenshotDir, '01_sp500_vix.png'), fullPage: true });

  // 2) Info 버튼 클릭 -> 팝오버 확인 및 캡처
  console.log('4. Info 버튼 클릭 및 팝오버 확인');
  const infoButton = page.locator('[data-testid="vix-info-button"]');
  await infoButton.click();
  await page.waitForSelector('[data-testid="vix-info-popover"]', { timeout: 5000 });
  await page.waitForTimeout(500);
  await vixContainer.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(screenshotDir, '02_vix_info_popover.png'), fullPage: true });

  // 팝오버 바깥 클릭으로 닫기
  console.log('5. 외부 클릭으로 팝오버 닫기');
  await page.mouse.click(50, 50);
  await page.waitForTimeout(500);

  // 3) 4대 지수 전환 검증 함수
  const switchIndex = async (nameRegex, filename) => {
    console.log(`지수 전환: ${filename}`);
    await Promise.all([
      page.waitForResponse(res => res.url().includes('/api/market/analysis/historical') && res.status() === 200, { timeout: 45000 }),
      page.getByRole('button', { name: nameRegex }).click()
    ]);
    await page.waitForTimeout(1000);
    await vixContainer.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(screenshotDir, filename), fullPage: true });
  };

  // NASDAQ
  await switchIndex(/NASDAQ/i, '03_nasdaq_vix.png');

  // KOSPI
  await switchIndex(/KOSPI/i, '04_kospi_vix.png');

  // KOSDAQ
  await switchIndex(/KOSDAQ/i, '05_kosdaq_vix.png');

  // 4) S&P 500 복귀 후 기간 필터 전환 검증
  console.log('S&P 500 복귀');
  await switchIndex(/S&P 500/i, '05_back_to_sp500.png');

  const switchPeriod = async (periodText, filename) => {
    console.log(`기간 필터 전환: ${periodText}`);
    await Promise.all([
      page.waitForResponse(res => res.url().includes('/api/market/analysis/historical') && res.status() === 200, { timeout: 45000 }),
      page.getByRole('button', { name: new RegExp(`^${periodText}$`) }).click()
    ]);
    await page.waitForTimeout(1000);
    await vixContainer.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(screenshotDir, filename), fullPage: true });
  };

  // 1년
  await switchPeriod('1년', '06_period_1y.png');

  // 5년
  await switchPeriod('5년', '07_period_5y.png');

  // 10년
  await switchPeriod('10년', '08_period_10y.png');

  // 전체
  await switchPeriod('전체', '09_period_all.png');

  console.log('=== 모든 E2E 브라우저 검증 및 스크린샷 캡처 완료! ===');
  await browser.close();
}

run().catch(err => {
  console.error('E2E 검증 오류:', err);
  process.exit(1);
});
