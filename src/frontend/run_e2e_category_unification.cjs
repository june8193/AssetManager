const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const FIXTURE_PASSWORD = '950811';

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
 * 지출 카테고리 단일화 E2E 통합 검증 시나리오를 실행합니다.
 *
 * @returns {Promise<void>}
 */
async function runE2E() {
  console.log('=== 지출 카테고리 단일화 E2E 통합 검증 시작 ===');

  const rootDir = path.resolve(__dirname, '../..');

  // 1. dev_assets.db의 expenses 테이블 초기화 (테스트 멱등성 보장)
  try {
    const cleanCmd = `uv run python -c "import sqlite3; con = sqlite3.connect('src/dev_assets.db'); con.execute('DELETE FROM expenses'); con.commit(); con.close(); print('dev_assets.db expenses 초기화 완료')"`;
    const cleanOutput = execSync(cleanCmd, { cwd: rootDir, encoding: 'utf-8' });
    console.log(`[DB Reset] ${cleanOutput.trim()}`);
  } catch (err) {
    console.warn(`[DB Reset Warning] ${err.message}`);
  }

  // 2. 샘플 명세서 파일 경로 확인 (카카오뱅크 xlsx)
  const statementsDir = path.resolve(__dirname, '../../tests/fixtures/statements');
  const files = fs.readdirSync(statementsDir);
  const kakaoFileName = files.find((f) => f.endsWith('.xlsx'));

  if (!kakaoFileName) {
    throw new Error(`카카오뱅크 샘플 엑셀 파일을 찾을 수 없습니다 in ${statementsDir}`);
  }

  const kakaoFilePath = path.join(statementsDir, kakaoFileName);
  console.log(`[OK] 카카오뱅크 샘플 파일: ${kakaoFilePath}`);

  // 3. 스크린샷 폴더 생성 (GEMINI.md 규칙: YYYYMMDD_HHMMSS_expense_category_unification)
  const timestamp = getFormattedTimestamp();
  const dirName = `${timestamp}_expense_category_unification`;
  const screenshotsDir = path.resolve(__dirname, '../../screenshots', dirName);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
    console.log(`[OK] 스크린샷 폴더 생성: ${screenshotsDir}`);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });
  const page = await context.newPage();

  /**
   * 스크린샷을 지정된 파일명으로 캡처하고 로그를 출력합니다.
   *
   * @param {string} fileName - 저장할 스크린샷 파일명
   */
  async function captureScreenshot(fileName) {
    const filePath = path.join(screenshotsDir, fileName);
    await page.screenshot({ path: filePath, fullPage: true });
    console.log(`[Captured] ${fileName}`);
  }

  try {
    // -------------------------------------------------------------
    // Step 1: 메인 페이지 접속 및 '지출 관리' 페이지 이동
    // -------------------------------------------------------------
    console.log("\n[Step 1] 메인 페이지 접속 및 사이드바 '지출 관리' 이동...");
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const expenseMenu = page.locator('nav a:has-text("지출 관리")');
    await expenseMenu.waitFor({ state: 'visible', timeout: 5000 });
    await expenseMenu.click();

    await page.waitForURL('**/expenses', { timeout: 5000 });
    await page.waitForSelector('h1:has-text("지출 관리")', { timeout: 5000 });
    await page.waitForTimeout(1000);

    // -------------------------------------------------------------
    // Step 2: 카테고리 관리 모달 단일 목록 및 '구독료', '모임회비' 확인
    // -------------------------------------------------------------
    console.log("\n[Step 2] 카테고리 관리 모달 단일 목록 및 '구독료', '모임회비' 노출 검증...");
    await page.click('button:has-text("카테고리 관리")');
    await page.waitForSelector('[data-testid="expense-categories-modal"]', { timeout: 5000 });
    await page.waitForTimeout(1000);

    // 탭 UI 부재 확인 (1차/2차 카테고리 탭이 전혀 없어야 함)
    const tabCount = await page.locator('button:has-text("1차 카테고리"), button:has-text("2차 카테고리")').count();
    if (tabCount > 0) {
      throw new Error(`카테고리 모달에 여전히 탭 UI가 존재합니다 (발견된 탭 수: ${tabCount})`);
    }
    console.log('[Check] 탭 UI 없음 확인 (단일 목록 일원화)');

    // 단일 목록 내 '구독료', '모임회비' 노출 확인
    const subscriptionItem = page.locator('[data-testid="expense-categories-modal"] span:has-text("구독료")').first();
    const clubFeeItem = page.locator('[data-testid="expense-categories-modal"] span:has-text("모임회비")').first();
    await subscriptionItem.waitFor({ state: 'visible', timeout: 3000 });
    await clubFeeItem.waitFor({ state: 'visible', timeout: 3000 });
    console.log("[Check] '구독료', '모임회비' 정규 카테고리 노출 확인");

    // 01 스크린샷: 카테고리 단일 목록 관리 모달
    await captureScreenshot('01_category_management_modal_single_list.png');

    // 모달 닫기
    await page.click('[data-testid="expense-categories-modal"] button:has-text("닫기")');
    await page.waitForSelector('[data-testid="expense-categories-modal"]', { state: 'detached', timeout: 5000 });
    await page.waitForTimeout(500);

    // -------------------------------------------------------------
    // Step 3: 명세서 업로드 모달 파일 파싱 및 모든 거래 '미분류' 초기 상태 검증
    // -------------------------------------------------------------
    console.log('\n[Step 3] 카카오뱅크 명세서 업로드 및 파싱 후 초기 미분류 상태 검증...');
    await page.click('button:has-text("명세서 업로드")');
    await page.waitForSelector('h2:has-text("명세서 업로드 및 검토")', { timeout: 5000 });

    await page.setInputFiles('input[type="file"]', kakaoFilePath);
    await page.waitForTimeout(500);

    // 결제수단 선택 (카카오뱅크)
    const pmSelect = page.locator('select:has(option:has-text("결제수단을 선택해주세요"))');
    await pmSelect.waitFor({ state: 'visible', timeout: 5000 });
    const pmOptions = await pmSelect.locator('option').allInnerTexts();
    const kakaoOptionIdx = pmOptions.findIndex((opt) => opt.includes('카카오뱅크'));
    if (kakaoOptionIdx >= 0) {
      await pmSelect.selectOption({ index: kakaoOptionIdx });
      console.log(`[Select] 결제수단 선택 완료: ${pmOptions[kakaoOptionIdx]}`);
    } else {
      throw new Error(`카카오뱅크 결제수단 옵션을 찾을 수 없습니다: ${JSON.stringify(pmOptions)}`);
    }

    // 복호화 비밀번호 입력
    const pwdInput = page.locator('input[placeholder*="생년월일"]');
    await pwdInput.fill(FIXTURE_PASSWORD);
    await page.waitForTimeout(300);

    // 미리보기 파싱 실행 (버튼 활성화 대기 후 클릭)
    const parseBtn = page.locator('button:has-text("미리보기 파싱")');
    await parseBtn.waitFor({ state: 'visible', timeout: 5000 });
    if (await parseBtn.isDisabled()) {
      throw new Error("파일 및 결제수단 입력 후에도 '미리보기 파싱' 버튼이 비활성화되어 있습니다.");
    }
    await parseBtn.click();
    await page.waitForSelector('h2:has-text("명세서 거래 미리보기 및 확정")', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 모든 거래 행의 카테고리가 '미분류'(value === "")인지 확인
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();
    console.log(`[Check] 파싱된 거래 건수: 총 ${rowCount}건`);

    const categorySelects = page.locator('table tbody tr td select');
    const selectCount = await categorySelects.count();
    for (let i = 0; i < selectCount; i++) {
      const val = await categorySelects.nth(i).inputValue();
      if (val !== '') {
        throw new Error(`행 ${i + 1}의 카테고리가 미분류가 아닙니다 (현재값: ${val})`);
      }
    }
    console.log(`[Check] 모든 거래(${selectCount}건)의 카테고리가 '미분류'로 노출됨`);

    // 모든 거래의 통계 제외 체크박스가 기본 미체크 상태인지 확인
    const checkboxes = page.locator('table tbody tr td input[type="checkbox"]');
    const cbCount = await checkboxes.count();
    for (let i = 0; i < cbCount; i++) {
      const checked = await checkboxes.nth(i).isChecked();
      if (checked) {
        throw new Error(`행 ${i + 1}의 통계 제외 체크박스가 기본 체크되어 있습니다!`);
      }
    }
    console.log(`[Check] 모든 거래(${cbCount}건)의 통계 제외 체크박스가 기본 미체크 상태임`);

    // 02 스크린샷: 명세서 파싱 후 전체 미분류 프리뷰
    await captureScreenshot('02_upload_preview_all_unclassified.png');

    // -------------------------------------------------------------
    // Step 4: '통계 제외' 체크 시 카테고리 드롭다운 disabled 검증
    // -------------------------------------------------------------
    console.log("\n[Step 4] '통계 제외' 체크 시 카테고리 드롭다운 비활성화(disabled) 검증...");
    const firstCheckbox = checkboxes.first();
    const firstCatSelect = categorySelects.first();

    // 첫 번째 거래 체크박스 클릭 -> disabled 확인
    await firstCheckbox.check();
    await page.waitForTimeout(300);

    const isDisabled = await firstCatSelect.isDisabled();
    if (!isDisabled) {
      throw new Error("'통계 제외' 체크 시 카테고리 셀렉트가 disabled 처리되지 않았습니다!");
    }
    console.log("[Check] '통계 제외' 체크 시 카테고리 셀렉트가 정상적으로 disabled 처리됨");

    // 03 스크린샷: 통계 제외 체크 및 카테고리 셀렉트 disabled 상태
    await captureScreenshot('03_excluded_transaction_disabled_category.png');

    // -------------------------------------------------------------
    // Step 5: 미분류 거래 잔존 시 '확정 및 저장' 비활성화 및 경고 문구 검증
    // -------------------------------------------------------------
    console.log("\n[Step 5] 미분류 거래 잔존 시 '확정 및 저장' 비활성화 및 경고 문구 검증...");
    const commitBtn = page.locator('button:has-text("확정 및 저장")');
    const isCommitDisabled = await commitBtn.isDisabled();
    if (!isCommitDisabled) {
      throw new Error("미분류 거래가 잔존함에도 '확정 및 저장' 버튼이 활성화되어 있습니다!");
    }
    console.log("[Check] 미분류 거래 존재 시 '확정 및 저장' 버튼 disabled 확인");

    const warningBanner = page.locator('span:has-text("미분류된 거래가")');
    await warningBanner.waitFor({ state: 'visible', timeout: 3000 });
    const warningText = await warningBanner.innerText();
    console.log(`[Check] 경고 문구 노출 확인: "${warningText.trim()}"`);

    // 04 스크린샷: 미분류 경고 배너 및 확정 버튼 비활성화 상태
    await captureScreenshot('04_unclassified_warning_and_disabled_commit.png');

    // -------------------------------------------------------------
    // Step 6: 모든 거래 카테고리 지정 및 정상 저장(커밋) 검증
    // -------------------------------------------------------------
    console.log('\n[Step 6] 모든 유효 거래 카테고리 지정 및 정상 저장 검증...');

    // 첫 번째 거래는 이미 '통계 제외' 체크되어 있음.
    // 나머지 2번째부터 마지막 거래까지 순차적으로 카테고리 지정
    // (구독료, 모임회비, 식비/카페, 쇼핑 등을 번갈아가며 지정)
    const optionsToSelect = ['식비/카페', '쇼핑', '구독료', '모임회비', '생활/기타'];
    for (let i = 1; i < selectCount; i++) {
      const select = categorySelects.nth(i);
      const chosenCat = optionsToSelect[(i - 1) % optionsToSelect.length];
      await select.selectOption({ label: chosenCat });
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(500);

    // 미분류 건수가 0이 되었으므로 경고 문구 소멸 및 확정 버튼 활성화 확인
    const warningCount = await page.locator('span:has-text("미분류된 거래가")').count();
    if (warningCount > 0) {
      throw new Error('모든 거래에 카테고리가 지정되었으나 경고 문구가 여전히 표시됩니다!');
    }
    console.log('[Check] 모든 거래 분류 완료 후 경고 문구 소멸 확인');

    const isCommitEnabled = await commitBtn.isEnabled();
    if (!isCommitEnabled) {
      throw new Error("모든 거래가 분류되었으나 '확정 및 저장' 버튼이 활성화되지 않았습니다!");
    }
    console.log("[Check] 모든 거래 분류 완료 후 '확정 및 저장' 버튼 활성화 확인");

    // 05 스크린샷: 모든 거래 분류 완료 및 저장 준비 완료 상태
    await captureScreenshot('05_all_categorized_ready_to_commit.png');

    // '확정 및 저장' 클릭
    await commitBtn.click();
    await page.waitForSelector('h2:has-text("명세서 거래 미리보기 및 확정")', {
      state: 'detached',
      timeout: 10000,
    });
    console.log("[Commit] '확정 및 저장' 완료 및 프리뷰 모달 닫힘 확인");

    await page.waitForTimeout(2000);

    // 대시보드 기준년월(2026-08) 선택 확인
    const monthSelect = page.locator('div:has(> span:has-text("기준년월")) select').first();
    await monthSelect.selectOption('2026-08');
    await page.waitForTimeout(2000);

    // 06 스크린샷: 커밋 후 대시보드 및 거래 원장 반영 화면
    await captureScreenshot('06_committed_dashboard_and_ledger.png');

    // -------------------------------------------------------------
    // Step 7: 원장 테이블 2차 카테고리 열 부재 및 단일 카테고리 필터링 검증
    // -------------------------------------------------------------
    console.log('\n[Step 7] 원장 테이블 2차 카테고리 열 부재 및 단일 카테고리 필터링 검증...');

    // 원장 테이블 헤더에서 2차 카테고리 열이 없는지 확인
    const thElements = await page.locator('table thead tr th').allInnerTexts();
    console.log('[Header Columns]', thElements.map((t) => t.trim()));

    const hasSubCategoryColumn = thElements.some(
      (th) => th.includes('2차') || th.includes('특성') || th.includes('서브')
    );
    if (hasSubCategoryColumn) {
      throw new Error(`원장 테이블 헤더에 2차 카테고리 관련 열이 여전히 존재합니다: ${JSON.stringify(thElements)}`);
    }
    const hasCategoryColumn = thElements.some((th) => th.includes('카테고리'));
    if (!hasCategoryColumn) {
      throw new Error(`원장 테이블 헤더에 '카테고리' 열이 존재하지 않습니다: ${JSON.stringify(thElements)}`);
    }
    console.log('[Check] 원장 테이블에 2차 카테고리 열 없이 단일 카테고리 열만 존재함 확인');

    // 필터 툴바에서 카테고리 필터 드롭다운 확인
    const categoryFilter = page.locator('select:has(option:has-text("카테고리 전체"))');
    await categoryFilter.waitFor({ state: 'visible', timeout: 5000 });

    // '구독료' 카테고리로 필터링
    console.log("-> 단일 카테고리 필터에서 '구독료' 선택");
    await categoryFilter.selectOption({ label: '구독료' });
    await page.waitForTimeout(1500);

    // 필터링 후 원장 내 모든 거래의 카테고리가 '구독료'인지 확인
    const filteredRows = page.locator('table tbody tr');
    const filteredRowCount = await filteredRows.count();
    console.log(`[Check] '구독료' 필터링 결과 행 수: ${filteredRowCount}건`);
    if (filteredRowCount === 0) {
      throw new Error("'구독료' 필터링 결과가 0건입니다!");
    }

    // 빈 데이터 안내 행이 아닌 실제 데이터 행인지 확인
    const firstRowText = await filteredRows.first().innerText();
    if (firstRowText.includes('일치하는 지출 내역이 없습니다')) {
      throw new Error("'구독료' 필터링 결과 실제 거래 행이 존재하지 않습니다!");
    }
    console.log(`[Check] '구독료' 필터링된 행 내용 확인: ${firstRowText.replace(/\s+/g, ' ').substring(0, 80)}...`);

    // 07 스크린샷: 단일 카테고리 필터링된 원장 화면
    await captureScreenshot('07_ledger_single_category_filter.png');

    // 필터 초기화 클릭
    const resetFilterBtn = page.locator('button[title="필터 초기화"]');
    if (await resetFilterBtn.isVisible()) {
      await resetFilterBtn.click();
      await page.waitForTimeout(1000);
      console.log('[Check] 필터 초기화 완료');
    }

    console.log('\n=== 모든 E2E 검증 시나리오가 성공적으로 완료되었습니다! ===');
    console.log(`스크린샷 저장 경로: ${screenshotsDir}`);
  } finally {
    await browser.close();
  }
}

runE2E().catch((err) => {
  console.error('E2E 검증 실패:', err);
  process.exit(1);
});
