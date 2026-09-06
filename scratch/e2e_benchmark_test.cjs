const path = require('path');
const fs = require('fs');

// 프론트엔드 모듈 내 playwright 로드
const { chromium } = require(path.resolve(__dirname, '../src/frontend/node_modules/playwright'));

(async () => {
  const projectRoot = path.resolve(__dirname, '..');
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const timeStr = String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
  const timestampStr = `${dateStr}_${timeStr}`;
  const folderName = `${timestampStr}_benchmark_refinement`;
  const outputDir = path.join(projectRoot, 'screenshots', folderName);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('브라우저 실행 중...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  try {
    console.log('1. http://localhost:5173/benchmark 접속 중...');
    await page.goto('http://localhost:5173/benchmark', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // 1. 초기 벤치마크 페이지 스크린샷
    const initialScreenshotPath = path.join(outputDir, '01_benchmark_page_initial.png');
    await page.screenshot({ path: initialScreenshotPath, fullPage: true });
    console.log(`기본 화면 캡처 저장 완료: ${initialScreenshotPath}`);

    // 2. 기준일 캡션 요소 확인
    const snapshotCaption = page.locator('text=최신 스냅샷 기준일:');
    await snapshotCaption.waitFor({ state: 'visible', timeout: 5000 });
    console.log('최신 스냅샷 기준일 캡션 확인 완료');

    // 3. 도움말 아이콘 버튼 확인 및 클릭
    const helpBtn = page.locator('button[aria-label="기준일 안내"]');
    await helpBtn.waitFor({ state: 'visible', timeout: 5000 });
    console.log('도움말 아이콘 버튼 클릭...');
    await helpBtn.click();
    await page.waitForTimeout(500);

    // 4. 팝오버 및 3단 설명 문구 확인
    const popoverHeading = page.locator('text=기준일 및 성과 정규화 안내');
    await popoverHeading.waitFor({ state: 'visible', timeout: 5000 });

    const step1 = page.locator('text=최신 스냅샷 기준일');
    const step2 = page.locator('text=수익률 비교 기준일');
    const step3 = page.locator('text=왜 필요한가요?');
    await step1.first().waitFor({ state: 'visible' });
    await step2.first().waitFor({ state: 'visible' });
    await step3.waitFor({ state: 'visible' });
    console.log('팝오버 3단 설명 구조 및 문구 확인 완료');

    // 5. 팝오버 열림 상태 스크린샷
    const popoverScreenshotPath = path.join(outputDir, '02_benchmark_explanation_popover.png');
    await page.screenshot({ path: popoverScreenshotPath, fullPage: true });
    console.log(`팝오버 열림 화면 캡처 저장 완료: ${popoverScreenshotPath}`);

    // 6. 닫기 버튼 클릭하여 팝오버 닫기
    const closeBtn = page.locator('button[aria-label="닫기"]');
    await closeBtn.click();
    await page.waitForTimeout(500);

    const isPopoverVisible = await popoverHeading.isVisible();
    console.log('닫기 후 팝오버 가시 여부 (false 기대):', isPopoverVisible);

    const closedScreenshotPath = path.join(outputDir, '03_popover_closed.png');
    await page.screenshot({ path: closedScreenshotPath, fullPage: true });
    console.log(`팝오버 닫힘 화면 캡처 저장 완료: ${closedScreenshotPath}`);

    console.log('E2E 검증 시나리오 전체 성공!');
  } catch (error) {
    console.error('E2E 테스트 실행 중 오류 발생:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
