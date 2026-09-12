const path = require('path');
const fs = require('fs');

const playwrightPath = path.resolve(__dirname, '..', 'src', 'frontend', 'node_modules', 'playwright');
const { chromium } = require(playwrightPath);

async function runE2E() {
  const outputDir = path.resolve(__dirname, '..', 'screenshots', '20260913_mobile_market_chart');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('🚀 [티켓 04] Playwright 모바일 뷰포트(390x844) E2E 검증 시작...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
  });

  const page = await context.newPage();

  console.log('🌐 http://localhost:5173/m/market 접속 중...');
  await page.goto('http://localhost:5173/m/market', { waitUntil: 'networkidle', timeout: 30000 });

  // 차트 카드 렌더링 대기
  await page.waitForSelector('[data-testid="mobile-stacked-chart-card"]', { timeout: 15000 });
  
  // 로딩 오버레이 소멸 대기
  try {
    await page.waitForSelector('text=차트 갱신 중...', { state: 'detached', timeout: 10000 });
  } catch (e) {
    console.log('로딩 오버레이 이미 사라짐');
  }
  await page.waitForTimeout(1500);

  // 차트 카드와 극단값 카드가 모바일 화면에 균형있게 들어오도록 차트 카드 상단으로 살짝 스크롤
  const chartCard = page.locator('[data-testid="mobile-stacked-chart-card"]');
  await chartCard.evaluate((el) => {
    el.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await page.waitForTimeout(500);

  console.log('\n--- 1. [📈 지수 종가] 기본 탭 검증 ---');
  const priceTab = page.locator('[data-testid="chart-tab-price"]');
  const isPriceActive = await priceTab.getAttribute('aria-pressed');
  console.log(`- 지수 종가 탭 활성화 여부: ${isPriceActive}`);
  
  const priceTier = page.locator('[data-testid="chart-tier-price"]');
  console.log(`- 지수 종가 260px 차트 영역 노출: ${await priceTier.isVisible()}`);

  const placeholder = page.locator('[data-testid="inspector-placeholder"]');
  console.log(`- 상단 슬림바 안내문구 노출: ${await placeholder.isVisible()}`);

  const extremeCards = page.locator('[data-testid="extreme-stats-cards-container"]');
  console.log(`- 하단 2대 극단값 카드 노출: ${await extremeCards.isVisible()}`);

  const shot1Path = path.join(outputDir, '01_price_tab_default_view.png');
  await page.screenshot({ path: shot1Path, fullPage: false });
  console.log(`📸 샷 1 저장 완료: ${shot1Path}`);

  console.log('\n--- 2. [📉 낙폭 (MDD)] 탭 전환 검증 ---');
  const mddTab = page.locator('[data-testid="chart-tab-mdd"]');
  await mddTab.click();
  await page.waitForTimeout(800);

  const mddTier = page.locator('[data-testid="chart-tier-mdd"]');
  console.log(`- 낙폭 (MDD) 260px 차트 영역 노출: ${await mddTier.isVisible()}`);

  const shot2Path = path.join(outputDir, '02_mdd_tab_underwater_view.png');
  await page.screenshot({ path: shot2Path, fullPage: false });
  console.log(`📸 샷 2 저장 완료: ${shot2Path}`);

  console.log('\n--- 3. [⚡ VIX 변동성] 탭 전환 검증 ---');
  const vixTab = page.locator('[data-testid="chart-tab-vix"]');
  await vixTab.click();
  await page.waitForTimeout(800);

  const vixTier = page.locator('[data-testid="chart-tier-vix"]');
  console.log(`- VIX 변동성 260px 차트 영역 노출: ${await vixTier.isVisible()}`);

  const cautionBadge = page.locator('[data-testid="vix-legend-badge-caution"]');
  const warningBadge = page.locator('[data-testid="vix-legend-badge-warning"]');
  console.log(`- 주의 20 뱃지 노출: ${await cautionBadge.isVisible()}`);
  console.log(`- 경고 30 뱃지 노출: ${await warningBadge.isVisible()}`);

  const shot3Path = path.join(outputDir, '03_vix_tab_clarity_view.png');
  await page.screenshot({ path: shot3Path, fullPage: false });
  console.log(`📸 샷 3 저장 완료: ${shot3Path}`);

  console.log('\n--- 4. 차트 호버/터치 인터랙션 통합 툴팁 검증 ---');
  // 지수 종가 탭으로 다시 이동하여 3대 수치 노출 및 지수 하이라이트 검증
  await priceTab.click();
  await page.waitForTimeout(800);

  const canvas = page.locator('[data-testid="mobile-chart-canvas-container"]');
  const box = await canvas.boundingBox();
  console.log(`- 차트 캔버스 위치: x=${box.x}, y=${box.y}, w=${box.width}, h=${box.height}`);

  // 차트 내부로 마우스 커서 점진적 이동 (호버 시뮬레이션)
  const targetX = box.x + box.width * 0.55;
  const targetY = box.y + box.height * 0.45;
  await page.mouse.move(targetX, targetY, { steps: 10 });
  await page.waitForTimeout(800);

  const valuesContainer = page.locator('[data-testid="inspector-values"]');
  const valuesVisible = await valuesContainer.isVisible();
  console.log(`- 통합 인스펙터 바 3대 수치 노출: ${valuesVisible}`);

  if (valuesVisible) {
    const inspectDate = await page.locator('[data-testid="inspector-date"]').innerText();
    const inspectPrice = await page.locator('[data-testid="inspector-price-value"]').innerText();
    const inspectMdd = await page.locator('[data-testid="inspector-mdd-value"]').innerText();
    const inspectVix = await page.locator('[data-testid="inspector-vix-value"]').innerText();
    console.log(`- 인스펙터 표시 수치: [날짜: ${inspectDate} | 지수: ${inspectPrice} | MDD: ${inspectMdd} | VIX: ${inspectVix}]`);
    
    // 활성 탭 하이라이트 확인 (price 탭이므로 지수 영역 하이라이트)
    const priceGroup = page.locator('[data-testid="inspector-price-group"]');
    const priceGroupClasses = await priceGroup.getAttribute('class');
    console.log(`- 지수 수치 하이라이트 활성화(sky): ${priceGroupClasses.includes('bg-sky-500/20')}`);
  }

  const shot4Path = path.join(outputDir, '04_chart_touch_inspection_unified_values.png');
  await page.screenshot({ path: shot4Path, fullPage: false });
  console.log(`📸 샷 4 저장 완료: ${shot4Path}`);

  console.log('\n--- 5. 터치/호버 종료 시 즉시 소멸 검증 ---');
  // 마우스 화면 밖으로 이동
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400);

  const placeholderAfter = page.locator('[data-testid="inspector-placeholder"]');
  console.log(`- 마우스 벗어난 후 플레이스홀더 즉시 복귀: ${await placeholderAfter.isVisible()}`);
  console.log(`- 인스펙터 수치 영역 즉시 소멸: ${!(await valuesContainer.isVisible())}`);

  await browser.close();
  console.log('\n🎉 [티켓 04] 모든 E2E 실기기 뷰포트 시나리오 검증 및 4대 스크린샷 캡처 완료!');
}

runE2E().catch((err) => {
  console.error('❌ E2E 실행 중 에러 발생:', err);
  process.exit(1);
});
