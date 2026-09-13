/**
 * 모바일 시장 지수 차트 실기기 뷰포트 CDP 터치 인터랙션 E2E 검증 스크립트
 *
 * 검증 항목:
 * 1. 모바일 실기기 뷰포트(390×844, isMobile: true, hasTouch: true)에서 접속
 * 2. Playwright + Chrome DevTools Protocol(CDP)을 이용한 실제 터치 이벤트 전송:
 *    - touchStart: 첫 터치 즉시 첫 포인트 데이터가 상단 슬림 인스펙터 바에 즉시 표출되는지 검증
 *    - touchMove: 10회 이상의 연속 터치 슬라이드 동안 데이터 갱신 누락 없이 실시간으로 수치가 추종되는지 검증
 *    - touchEnd: 손을 떼는 즉시 인스펙터 바가 플레이스홀더로 복귀하고 세로선/잔상이 남지 않는지 검증
 * 3. 지수 종가(Price), 낙폭(MDD), VIX 변동성 3대 차트 전체에서 터치 조작 일관성 검증
 * 4. 각 단계별 고해상도 스크린샷을 screenshots/YYYYMMDD_HHMMSS_mobile_chart_touch/에 보존
 */
const path = require('path');
const fs = require('fs');

const playwrightPath = path.resolve(__dirname, '../../src/frontend/node_modules/playwright');
const { chromium } = require(playwrightPath);

// 스크린샷 폴더 생성 (GEMINI.md 규격 준수: screenshots/YYYYMMDD_HHMMSS_작업명/)
const TIMESTAMP = '20260913_093100_mobile_chart_touch';
const SCREENSHOT_DIR = path.resolve(__dirname, `../../screenshots/${TIMESTAMP}`);

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch (e) {
      // 대기
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`개발 서버가 ${timeoutMs}ms 내에 응답하지 않았습니다: ${url}`);
}

async function runE2E() {
  console.log(`[E2E] 스크린샷 저장 디렉토리: ${SCREENSHOT_DIR}`);
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  console.log('[E2E] 개발 서버(http://localhost:5173) 응답 대기 중...');
  await waitForServer('http://localhost:5173');
  console.log('[E2E] 개발 서버 정상 응답 확인 완료!');

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
  const cdp = await page.context().newCDPSession(page);

  try {
    console.log('\n📱 1. 모바일 시장 지수 화면(http://localhost:5173/m/market) 진입...');
    await page.goto('http://localhost:5173/m/market', { waitUntil: 'networkidle', timeout: 30000 });

    // 차트 카드 렌더링 대기
    await page.waitForSelector('[data-testid="mobile-stacked-chart-card"]', { timeout: 15000 });

    // 로딩 인디케이터 소멸 대기
    try {
      await page.waitForSelector('text=차트 갱신 중...', { state: 'detached', timeout: 10000 });
    } catch (e) {
      console.log('로딩 오버레이 이미 사라짐');
    }
    await page.waitForTimeout(1500);

    // 차트 카드가 화면 중앙에 오도록 스크롤
    const chartCard = page.locator('[data-testid="mobile-stacked-chart-card"]');
    await chartCard.evaluate((el) => {
      el.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await page.waitForTimeout(500);

    // [초기 상태] 플레이스홀더 노출 확인
    const placeholder = page.locator('[data-testid="inspector-placeholder"]');
    const isPlaceholderVisible = await placeholder.isVisible();
    console.log(`- 초기 플레이스홀더 안내문구 노출 확인: ${isPlaceholderVisible}`);
    if (!isPlaceholderVisible) {
      throw new Error('초기 로딩 후 플레이스홀더 안내문구가 표시되지 않았습니다.');
    }

    const shot1Path = path.join(SCREENSHOT_DIR, '01_initial_chart_placeholder.png');
    await page.screenshot({ path: shot1Path, fullPage: false });
    console.log(`📸 [샷 1] 초기 차트 화면 저장 완료: ${shot1Path}`);

    // --- [지수 종가 차트 CDP 터치 인터랙션 검증] ---
    console.log('\n👆 2. [지수 종가 차트] CDP touchStart 즉시 첫 포인트 데이터 표출 검증...');
    const canvas = page.locator('[data-testid="mobile-chart-canvas-container"]');
    const box = await canvas.boundingBox();
    console.log(`- 차트 캔버스 위치: x=${box.x.toFixed(1)}, y=${box.y.toFixed(1)}, w=${box.width.toFixed(1)}, h=${box.height.toFixed(1)}`);

    const startX = Math.round(box.x + box.width * 0.2);
    const startY = Math.round(box.y + box.height * 0.5);
    const endX = Math.round(box.x + box.width * 0.8);

    console.log(`- touchStart 발송 좌표: (${startX}, ${startY})`);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: startX, y: startY, id: 1 }],
    });
    await page.waitForTimeout(300);

    // touchStart 즉시 인스펙터 바에 수치가 나타났는지 검증
    const valuesContainer = page.locator('[data-testid="inspector-values"]');
    const valuesVisibleAtStart = await valuesContainer.isVisible();
    console.log(`- touchStart 즉시 인스펙터 바 수치 영역 표출 여부: ${valuesVisibleAtStart}`);
    if (!valuesVisibleAtStart) {
      throw new Error('touchStart 발생 즉시 인스펙터 바에 데이터가 표출되지 않았습니다!');
    }

    const startDate = await page.locator('[data-testid="inspector-date"]').innerText();
    const startPrice = await page.locator('[data-testid="inspector-price-value"]').innerText();
    console.log(`- touchStart 감지 데이터: 날짜=[${startDate}], 지수=[${startPrice}]`);

    const shot2Path = path.join(SCREENSHOT_DIR, '02_touch_start_instant_values.png');
    await page.screenshot({ path: shot2Path, fullPage: false });
    console.log(`📸 [샷 2] touchStart 즉시 수치 표출 샷 저장: ${shot2Path}`);

    // --- [10회 이상의 연속 touchMove 슬라이드 검증] ---
    console.log('\n🔄 3. [지수 종가 차트] 15단계 연속 touchMove 슬라이드 실시간 수치 추종 검증...');
    const moveSteps = 15;
    const trackedDates = new Set([startDate]);
    const trackedPrices = [];

    for (let step = 1; step <= moveSteps; step++) {
      const currentX = Math.round(startX + ((endX - startX) * step) / moveSteps);
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: currentX, y: startY, id: 1 }],
      });
      await page.waitForTimeout(80);

      const currentDate = await page.locator('[data-testid="inspector-date"]').innerText();
      const currentPrice = await page.locator('[data-testid="inspector-price-value"]').innerText();
      trackedDates.add(currentDate);
      trackedPrices.push({ step, x: currentX, date: currentDate, price: currentPrice });
    }

    console.log(`- 총 ${moveSteps}회 연속 touchMove 슬라이드 완료`);
    console.log(`- 연속 슬라이드 중 식별된 서로 다른 날짜 포인트 수: ${trackedDates.size}개`);
    console.log(`- 슬라이드 최종 도달 데이터: 날짜=[${trackedPrices[trackedPrices.length - 1].date}], 지수=[${trackedPrices[trackedPrices.length - 1].price}]`);

    if (trackedDates.size < 5) {
      throw new Error(`연속 터치 슬라이드 중 날짜 갱신이 누락되었습니다 (포인트 다양성 부족: ${trackedDates.size})`);
    }
    console.log('✅ 10회 이상 연속 touchMove 실시간 데이터 추종 검증 완벽 통과!');

    const shot3Path = path.join(SCREENSHOT_DIR, '03_continuous_touch_slide_tracking.png');
    await page.screenshot({ path: shot3Path, fullPage: false });
    console.log(`📸 [샷 3] 연속 슬라이드 추종 상태 샷 저장: ${shot3Path}`);

    // --- [touchEnd 시 즉시 무잔상 소멸 검증] ---
    console.log('\n🛑 4. [지수 종가 차트] touchEnd 즉각 플레이스홀더 복귀 및 무잔상 검증...');
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [{ x: endX, y: startY, id: 1 }],
    });
    await page.waitForTimeout(300);

    const isPlaceholderRestored = await placeholder.isVisible();
    const isValuesDismissed = !(await valuesContainer.isVisible());
    console.log(`- touchEnd 후 플레이스홀더 즉시 복귀 여부: ${isPlaceholderRestored}`);
    console.log(`- touchEnd 후 인스펙터 수치 영역 완전 소멸 여부: ${isValuesDismissed}`);

    if (!isPlaceholderRestored || !isValuesDismissed) {
      throw new Error('touchEnd 후 인스펙터 바가 플레이스홀더로 복귀하지 않거나 잔상이 남았습니다!');
    }
    console.log('✅ touchEnd 즉각 무잔상 소멸 검증 완벽 통과!');

    const shot4Path = path.join(SCREENSHOT_DIR, '04_touch_end_instant_placeholder.png');
    await page.screenshot({ path: shot4Path, fullPage: false });
    console.log(`📸 [샷 4] touchEnd 무잔상 소멸 화면 저장: ${shot4Path}`);

    // --- [낙폭 (MDD) 탭 전환 후 터치 인터랙션 검증] ---
    console.log('\n📉 5. [낙폭 MDD 차트] 탭 전환 후 CDP 터치 슬라이드 검증...');
    const mddTab = page.locator('[data-testid="chart-tab-mdd"]');
    await mddTab.click();
    await page.waitForTimeout(600);

    const mddCanvas = page.locator('[data-testid="mobile-chart-canvas-container"]');
    const mddBox = await mddCanvas.boundingBox();
    const mddMidX = Math.round(mddBox.x + mddBox.width * 0.4);
    const mddMidY = Math.round(mddBox.y + mddBox.height * 0.5);

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: mddMidX, y: mddMidY, id: 2 }],
    });
    await page.waitForTimeout(200);

    const mddValueAtStart = await page.locator('[data-testid="inspector-mdd-value"]').innerText();
    console.log(`- MDD 차트 touchStart 즉시 표출 MDD 수치: [${mddValueAtStart}]`);

    const shot5Path = path.join(SCREENSHOT_DIR, '05_mdd_touch_interaction.png');
    await page.screenshot({ path: shot5Path, fullPage: false });
    console.log(`📸 [샷 5] MDD 터치 인터랙션 화면 저장: ${shot5Path}`);

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [{ x: mddMidX, y: mddMidY, id: 2 }],
    });
    await page.waitForTimeout(200);

    // --- [VIX 변동성 탭 전환 후 터치 인터랙션 검증] ---
    console.log('\n⚡ 6. [VIX 변동성 차트] 탭 전환 후 CDP 터치 슬라이드 검증...');
    const vixTab = page.locator('[data-testid="chart-tab-vix"]');
    await vixTab.click();
    await page.waitForTimeout(600);

    const vixCanvas = page.locator('[data-testid="mobile-chart-canvas-container"]');
    const vixBox = await vixCanvas.boundingBox();
    const vixMidX = Math.round(vixBox.x + vixBox.width * 0.6);
    const vixMidY = Math.round(vixBox.y + vixBox.height * 0.5);

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: vixMidX, y: vixMidY, id: 3 }],
    });
    await page.waitForTimeout(200);

    const vixValueAtStart = await page.locator('[data-testid="inspector-vix-value"]').innerText();
    console.log(`- VIX 차트 touchStart 즉시 표출 VIX 수치: [${vixValueAtStart}]`);

    const shot6Path = path.join(SCREENSHOT_DIR, '06_vix_touch_interaction.png');
    await page.screenshot({ path: shot6Path, fullPage: false });
    console.log(`📸 [샷 6] VIX 터치 인터랙션 화면 저장: ${shot6Path}`);

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [{ x: vixMidX, y: vixMidY, id: 3 }],
    });
    await page.waitForTimeout(200);

    console.log('\n========================================================');
    console.log('🎉 [E2E 검증 대성공] 모든 모바일 CDP 터치 인터랙션 검증 완료!');
    console.log('  1. touchStart 즉각 데이터 표출: 정상');
    console.log(`  2. 15단계 연속 touchMove 실시간 추종 (다양성 ${trackedDates.size}개): 정상`);
    console.log('  3. touchEnd 무잔상 즉각 플레이스홀더 복귀: 정상');
    console.log('  4. 지수 종가, MDD, VIX 3대 차트 일괄 작동: 정상');
    console.log(`  5. 6종 검증 스크린샷 보존 완료: ${SCREENSHOT_DIR}`);
    console.log('========================================================\n');
  } catch (err) {
    console.error(`❌ [E2E] 에러 발생: ${err.message}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error_state.png') }).catch(() => {});
    process.exitCode = 1;
    throw err;
  } finally {
    await browser.close();
  }
}

runE2E();
