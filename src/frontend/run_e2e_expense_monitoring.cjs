const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const FIXTURE_PASSWORD = "950811";

/**
 * 현재 시간을 기반으로 'YYYYMMDD_HHMMSS' 포맷의 타임스탬프 문자열을 반환합니다.
 *
 * @returns {string} 포맷팅된 타임스탬프 문자열
 */
function getFormattedTimestamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
}

/**
 * 지출 모니터링 실데이터 E2E 검증 전체 시나리오를 실행합니다.
 *
 * @returns {Promise<void>}
 */
async function runE2E() {
  console.log("=== 지출 모니터링 E2E 통합 검증 시작 ===");

  // 1. dev_assets.db의 expenses 테이블 초기화 (테스트 멱등성 보장)
  try {
    const rootDir = path.resolve(__dirname, "../..");
    const cleanCmd = `uv run python -c "import sqlite3; con = sqlite3.connect('src/dev_assets.db'); con.execute('DELETE FROM expenses'); con.commit(); con.close(); print('dev_assets.db expenses 초기화 완료')"`;
    const cleanOutput = execSync(cleanCmd, { cwd: rootDir, encoding: "utf-8" });
    console.log(`[DB Reset] ${cleanOutput.trim()}`);
  } catch (err) {
    console.warn(`[DB Reset Warning] ${err.message}`);
  }

  // 2. 샘플 파일 경로 탐색
  const statementsDir = path.resolve(__dirname, "../../tests/fixtures/statements");
  const files = fs.readdirSync(statementsDir);
  const kakaoFileName = files.find(f => f.endsWith(".xlsx"));
  const hyundaiFileName = files.find(f => f.endsWith(".html"));

  if (!kakaoFileName || !hyundaiFileName) {
    throw new Error(`샘플 파일을 찾을 수 없습니다: kakao=${kakaoFileName}, hyundai=${hyundaiFileName}`);
  }

  const kakaoFilePath = path.join(statementsDir, kakaoFileName);
  const hyundaiFilePath = path.join(statementsDir, hyundaiFileName);
  console.log(`[OK] 카카오뱅크 샘플 파일: ${kakaoFilePath}`);
  console.log(`[OK] 현대카드 샘플 파일: ${hyundaiFilePath}`);

  // 3. 스크린샷 폴더 생성 (GEMINI.md 규칙: YYYYMMDD_HHMMSS_expense_monitoring)
  const timestamp = getFormattedTimestamp();
  const dirName = `${timestamp}_expense_monitoring`;
  const screenshotsDir = path.resolve(__dirname, "../../screenshots", dirName);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
    console.log(`[OK] 스크린샷 폴더 생성: ${screenshotsDir}`);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });
  const page = await context.newPage();

  try {
    // -------------------------------------------------------------
    // Step 1: 메인 페이지 접속 및 사이드바에서 '지출 관리' 이동
    // -------------------------------------------------------------
    console.log("\n[Step 1] 메인 페이지 접속 및 사이드바 '지출 관리' 이동...");
    await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    const expenseMenu = page.locator('nav a:has-text("지출 관리")');
    await expenseMenu.waitFor({ state: "visible", timeout: 5000 });
    await expenseMenu.click();

    await page.waitForURL("**/expenses", { timeout: 5000 });
    await page.waitForSelector('h1:has-text("지출 관리")', { timeout: 5000 });
    await page.waitForTimeout(1500);

    // 01 스크린샷: 초기 대시보드 상태
    const sc1 = path.join(screenshotsDir, "01_initial_expenses_page.png");
    await page.screenshot({ path: sc1, fullPage: true });
    console.log(`[Captured] 01_initial_expenses_page.png`);

    // -------------------------------------------------------------
    // Step 2: 카카오뱅크 엑셀 업로드, 비밀번호 "950811" 복호화 및 프리뷰 확인
    // -------------------------------------------------------------
    console.log("\n[Step 2] 카카오뱅크 거래내역 업로드 및 복호화 프리뷰 검토...");
    await page.click('button:has-text("명세서 업로드")');
    await page.waitForSelector('h2:has-text("명세서 업로드 및 검토")', { timeout: 5000 });

    await page.setInputFiles('input[type="file"]', kakaoFilePath);
    await page.waitForTimeout(500);

    const pwdInput = page.locator('input[placeholder*="생년월일"]');
    await pwdInput.fill(FIXTURE_PASSWORD);
    await page.waitForTimeout(300);

    await page.click('button:has-text("미리보기 파싱")');
    await page.waitForSelector('h2:has-text("명세서 거래 미리보기 및 확정")', { timeout: 15000 });
    await page.waitForTimeout(1500);

    // 통계 제외 체크된 항목 확인 (현대카드 대금 등)
    const excludedCount = await page.locator('table tbody tr input[type="checkbox"]:checked').count();
    console.log(`[Check] 카카오뱅크 프리뷰 내 통계 제외 체크 항목: ${excludedCount}건`);

    // 02 스크린샷: 카카오뱅크 프리뷰
    const sc2 = path.join(screenshotsDir, "02_kakaobank_preview.png");
    await page.screenshot({ path: sc2, fullPage: true });
    console.log(`[Captured] 02_kakaobank_preview.png`);

    // -------------------------------------------------------------
    // Step 3: [등록 및 덮어쓰기] 클릭하여 DB 적재 및 대시보드 반영 확인
    // -------------------------------------------------------------
    console.log("\n[Step 3] 카카오뱅크 거래 커밋 및 대시보드 반영 확인...");
    await page.click('button:has-text("등록 및 덮어쓰기")');
    await page.waitForSelector('h2:has-text("명세서 거래 미리보기 및 확정")', { state: "detached", timeout: 10000 });
    await page.waitForTimeout(2000);

    // 03 스크린샷: 카카오뱅크 커밋 후 대시보드
    const sc3 = path.join(screenshotsDir, "03_after_kakaobank_commit.png");
    await page.screenshot({ path: sc3, fullPage: true });
    console.log(`[Captured] 03_after_kakaobank_commit.png`);

    // -------------------------------------------------------------
    // Step 4: 현대카드 명세서 업로드 및 복호화 프리뷰 확인
    // -------------------------------------------------------------
    console.log("\n[Step 4] 현대카드 보안 HTML 업로드 및 복호화 프리뷰 검토...");
    await page.click('button:has-text("명세서 업로드")');
    await page.waitForSelector('h2:has-text("명세서 업로드 및 검토")', { timeout: 5000 });

    await page.setInputFiles('input[type="file"]', hyundaiFilePath);
    await page.waitForTimeout(500);

    const pwdInput2 = page.locator('input[placeholder*="생년월일"]');
    await pwdInput2.fill(FIXTURE_PASSWORD);
    await page.waitForTimeout(300);

    await page.click('button:has-text("미리보기 파싱")');
    await page.waitForSelector('h2:has-text("명세서 거래 미리보기 및 확정")', { timeout: 15000 });
    await page.waitForTimeout(1500);

    // 04 스크린샷: 현대카드 프리뷰
    const sc4 = path.join(screenshotsDir, "04_hyundaicard_preview.png");
    await page.screenshot({ path: sc4, fullPage: true });
    console.log(`[Captured] 04_hyundaicard_preview.png`);

    // -------------------------------------------------------------
    // Step 5: 현대카드 거래 커밋 및 합산 대시보드 확인
    // -------------------------------------------------------------
    console.log("\n[Step 5] 현대카드 거래 커밋 및 합산 대시보드 확인...");
    await page.click('button:has-text("등록 및 덮어쓰기")');
    await page.waitForSelector('h2:has-text("명세서 거래 미리보기 및 확정")', { state: "detached", timeout: 10000 });
    await page.waitForTimeout(2000);

    // 현대카드 청구월(2026-08)로 기준년월 변경하여 상세 데이터 확인
    const monthSelect = page.locator('select').first();
    await monthSelect.selectOption("2026-08");
    await page.waitForTimeout(2000);

    // 05 스크린샷: 현대카드 커밋 후 2026-08 대시보드
    const sc5 = path.join(screenshotsDir, "05_after_hyundaicard_commit.png");
    await page.screenshot({ path: sc5, fullPage: true });
    console.log(`[Captured] 05_after_hyundaicard_commit.png`);

    // -------------------------------------------------------------
    // Step 6: 덮어쓰기(Overwrite) 멱등성 검증 (동일 현대카드 재등록 시 중복 없음)
    // -------------------------------------------------------------
    console.log("\n[Step 6] 덮어쓰기(Overwrite) 멱등성 검증...");
    const ledgerHeader = page.locator('div:has(> h2:has-text("거래 내역 원장")) span').first();
    const txCountBefore = await ledgerHeader.innerText();
    console.log(`[Before Overwrite] 거래 건수 뱃지: ${txCountBefore}`);

    // 동일 현대카드 파일 다시 업로드
    await page.click('button:has-text("명세서 업로드")');
    await page.waitForSelector('h2:has-text("명세서 업로드 및 검토")', { timeout: 5000 });
    await page.setInputFiles('input[type="file"]', hyundaiFilePath);
    await page.waitForTimeout(500);
    await page.locator('input[placeholder*="생년월일"]').fill(FIXTURE_PASSWORD);
    await page.click('button:has-text("미리보기 파싱")');
    await page.waitForSelector('h2:has-text("명세서 거래 미리보기 및 확정")', { timeout: 15000 });
    await page.waitForTimeout(1000);

    await page.click('button:has-text("등록 및 덮어쓰기")');
    await page.waitForSelector('h2:has-text("명세서 거래 미리보기 및 확정")', { state: "detached", timeout: 10000 });
    await page.waitForTimeout(2000);

    // 2026-08 다시 확인
    await monthSelect.selectOption("2026-08");
    await page.waitForTimeout(1500);

    const txCountAfter = await ledgerHeader.innerText();
    console.log(`[After Overwrite] 거래 건수 뱃지: ${txCountAfter}`);

    if (txCountBefore !== txCountAfter) {
      throw new Error(`덮어쓰기 실패! 건수가 달라졌습니다: before=${txCountBefore}, after=${txCountAfter}`);
    }
    console.log(`[Verified] 덮어쓰기 정상 작동: ${txCountBefore} === ${txCountAfter}`);

    // 06 스크린샷: 덮어쓰기 검증 화면
    const sc6 = path.join(screenshotsDir, "06_overwrite_verification.png");
    await page.screenshot({ path: sc6, fullPage: true });
    console.log(`[Captured] 06_overwrite_verification.png`);

    // -------------------------------------------------------------
    // Step 7: 소유주 탭('장준', '성은', '전체') 전환 및 필터링 확인
    // -------------------------------------------------------------
    console.log("\n[Step 7] 소유주 탭 전환 및 필터링 동작 확인...");

    // '장준' 탭 클릭
    console.log("-> '장준' 탭 클릭");
    await page.click('button:has-text("장준")');
    await page.waitForTimeout(1500);

    // 07 스크린샷: 소유주 탭 필터링 화면
    const sc7 = path.join(screenshotsDir, "07_owner_tab_filter.png");
    await page.screenshot({ path: sc7, fullPage: true });
    console.log(`[Captured] 07_owner_tab_filter.png`);

    // '성은' 탭 클릭 (데이터 없는 상태)
    console.log("-> '성은' 탭 클릭");
    await page.click('button:has-text("성은")');
    await page.waitForTimeout(1000);

    // '전체' 탭 클릭 (원복)
    console.log("-> '전체' 탭 클릭");
    await page.click('button:has-text("전체")');
    await page.waitForTimeout(1000);

    console.log("\n=== 모든 E2E 검증 시나리오가 성공적으로 완료되었습니다! ===");
    console.log(`스크린샷 경로: ${screenshotsDir}`);
  } finally {
    await browser.close();
  }
}

runE2E().catch((err) => {
  console.error("E2E 검증 실패:", err);
  process.exit(1);
});
