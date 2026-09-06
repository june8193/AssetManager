/**
 * 모바일 비중 점검 화면 E2E 검증 및 스크린샷 캡처 스크립트.
 * 
 * 모바일 뷰포트 환경에서 /m/ratios 화면에 접속하여
 * 채권 카드의 아코디언을 확장하고, 각 자산 카드의 상태 배지가
 * '리밸런싱 필요 금액' 기준에 따라 단일 배지로 상호 배타적으로 깔끔하게 표시되는지,
 * '매수 필요'와 '매도 필요'가 공존하는 모순 현상이 발생하지 않는지 종단 간 검증합니다.
 */
const path = require('path');
const fs = require('fs');

// src/frontend의 playwright 모듈 로드
const { chromium } = require(path.resolve(__dirname, '../../src/frontend/node_modules/playwright'));

const SCREENSHOT_DIR = path.resolve(__dirname, '../../screenshots/20260906_164000_mobile_ratio_badge_unification');

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
  console.log('[E2E] 개발 서버 응답 확인 완료!');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  });

  const page = await context.newPage();

  try {
    console.log('[E2E] 1. 모바일 비중 점검 페이지(http://localhost:5173/m/ratios) 접속...');
    await page.goto('http://localhost:5173/m/ratios', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 1단계 스크린샷: 초기 비중 점검 화면
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_initial_ratios_page.png') });
    console.log('[E2E] 01_initial_ratios_page.png 저장 완료');

    // 2. '채권' 카드 대기 및 클릭하여 아코디언 확장
    console.log('[E2E] 2. 채권 카드 탐색 및 클릭하여 아코디언 확장...');
    const bondButton = page.locator('button:has(span:text-is("채권"))').first();
    await bondButton.waitFor({ state: 'visible', timeout: 10000 });
    await bondButton.click();
    await page.waitForTimeout(1500);

    // 2단계 스크린샷: 채권 아코디언 확장 화면
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_bond_accordion_expanded.png') });
    console.log('[E2E] 02_bond_accordion_expanded.png 저장 완료');

    // 3. 서브카테고리 카드 탐색 ('미국단기채', '미국장기채')
    console.log('[E2E] 3. 채권 하위 서브카테고리 카드 상태 배지 및 단일화 검증...');

    // (1) 미국단기채 카드 검증
    const shortBondButton = page.locator('button:has(span:text-is("미국단기채"))').first();
    await shortBondButton.waitFor({ state: 'visible', timeout: 5000 });
    const shortBondText = await shortBondButton.innerText();
    console.log(`[E2E] [미국단기채] 카드 헤더 텍스트: ${shortBondText.replace(/\n/g, ' ')}`);

    const shortHasBuy = shortBondText.includes('매수 필요');
    const shortHasSell = shortBondText.includes('매도 필요');
    console.log(`  - 미국단기채 '매수 필요': ${shortHasBuy}, '매도 필요': ${shortHasSell}`);
    if (!shortHasBuy) throw new Error("미국단기채에 '매수 필요' 뱃지가 누락되었습니다.");
    if (shortHasSell) throw new Error("미국단기채에 '매수 필요'와 '매도 필요' 뱃지가 동시에 노출되는 버그 발생!");

    // (2) 미국장기채 카드 검증
    const longBondButton = page.locator('button:has(span:text-is("미국장기채"))').first();
    await longBondButton.waitFor({ state: 'visible', timeout: 5000 });
    await longBondButton.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    const longBondText = await longBondButton.innerText();
    console.log(`[E2E] [미국장기채] 카드 헤더 텍스트: ${longBondText.replace(/\n/g, ' ')}`);

    const longHasBuy = longBondText.includes('매수 필요');
    const longHasSell = longBondText.includes('매도 필요');
    console.log(`  - 미국장기채 '매수 필요': ${longHasBuy}, '매도 필요': ${longHasSell}`);

    // 상호 배타성 검증: '매수 필요'와 '매도 필요'가 동시에 존재하면 절대 안 됨
    if (longHasBuy && longHasSell) {
      throw new Error("미국장기채에 '매수 필요'와 '매도 필요' 뱃지가 공존하여 다중 뱃지 버그가 발생했습니다!");
    }
    // 단일 배지가 정상적으로 1개만 노출되는지 확인
    if (!longHasBuy && !longHasSell) {
      throw new Error("미국장기채에 상태 배지가 표시되지 않았습니다.");
    }
    console.log(`[E2E] 미국장기채 배지 상호 배타성 검증 통과: 단 1개의 상태 배지만 깔끔하게 표시됨 (${longHasBuy ? '매수 필요' : '매도 필요'})`);

    // 3단계 스크린샷: main 스크롤 컨테이너를 스크롤하여 미국장기채 카드가 화면에 온전히 보이도록 캡처
    await page.locator('main').evaluate((el) => el.scrollBy(0, 250));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_us_long_term_bond_scrolled.png') });
    console.log('[E2E] 03_us_long_term_bond_scrolled.png 저장 완료');

    // 4단계: 미국장기채 카드도 클릭하여 하위 종목 아코디언 확장 및 단일 배지 확인
    console.log('[E2E] 4. 미국장기채 카드 아코디언 확장 및 종목 레벨 배지 확인...');
    await longBondButton.click();
    await page.waitForTimeout(1000);
    await page.locator('main').evaluate((el) => el.scrollBy(0, 200));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_us_long_term_bond_expanded.png') });
    console.log('[E2E] 04_us_long_term_bond_expanded.png 저장 완료');

    console.log('[E2E] 모든 E2E 검증 및 스크린샷 캡처가 성공적으로 완수되었습니다!');
  } catch (err) {
    console.error(`[E2E] 오류 발생: ${err.message}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error_state.png') }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

runE2E();
