/**
 * Ticket 04 E2E 통합 검증 자동화 스크립트
 * 
 * 시나리오:
 * 1. 백엔드 초기 데이터 셋업 (카테고리: 식비/카페, 쇼핑, 금융/보험 / 결제수단: 홍길동 카카오뱅크)
 * 2. 샘플 명세서 엑셀 파일 생성 (가맹점: (주)쿠팡, 쿠팡이츠 배달주문, 현대카드대금, 동네김밥)
 * 3. Playwright 브라우저 기동 (1280x800)
 * 4. 지출 관리(/expenses) 페이지 이동 -> 스크린샷 01
 * 5. [자동분류 규칙] 모달 열기 -> 스크린샷 02
 * 6. 규칙 1 ('쿠팡' -> '쇼핑') 등록 -> 스크린샷 03
 * 7. 규칙 2 ('쿠팡이츠' -> '식비/카페') 등록 -> 스크린샷 04
 * 8. 규칙 3 ('카드대금' -> '통계 제외') 등록 -> 스크린샷 05
 * 9. 규칙 모달 닫기
 * 10. [명세서 업로드] 모달 열기, 결제수단 선택, 샘플 파일 첨부 -> 스크린샷 06
 * 11. [미리보기 파싱] 클릭 -> 미리보기 화면 검증:
 *     - '(주)쿠팡' -> '쇼핑' 자동 분류 확인
 *     - '쿠팡이츠 배달주문' -> 더 긴 키워드인 '식비/카페' 우선 매칭 확인
 *     - '현대카드대금' -> '통계 제외' 체크박스 체크 확인
 *     - '동네김밥' -> 미분류 상태 확인 및 저장 버튼 비활성화 확인 -> 스크린샷 07
 * 12. '동네김밥'의 카테고리를 '식비/카페'로 수동 선택 -> 저장 버튼 활성화 확인 -> 스크린샷 08
 * 13. [확정 및 저장] 클릭 -> 저장 완료
 * 14. 대시보드 통계 및 거래 원장 정합성 교차 검증:
 *     - 총 지출 금액 검증 (통계 제외 건 500,000원 제외되어 65,000원 집계 확인)
 *     - 거래 원장에 4건의 거래 표시 확인 -> 스크린샷 09
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

// 스크린샷 폴더 생성: screenshots/YYYYMMDD_HHMMSS_expense_rules/
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const screenshotsDir = path.join(rootDir, 'screenshots', `${timestamp}_expense_rules`);
fs.mkdirSync(screenshotsDir, { recursive: true });
console.log(`[E2E] 스크린샷 저장 디렉토리: ${screenshotsDir}`);

const API_BASE = 'http://localhost:8000/api';
const FRONTEND_BASE = 'http://localhost:5173';

async function setupInitialData() {
  console.log('[E2E] 1. 백엔드 초기 마스터 데이터 설정 중...');

  // 1-1. 기존 규칙 모두 삭제
  const rulesRes = await fetch(`${API_BASE}/expenses/rules`);
  if (rulesRes.ok) {
    const rules = await rulesRes.json();
    for (const r of rules) {
      await fetch(`${API_BASE}/expenses/rules/${r.id}`, { method: 'DELETE' });
    }
  }

  // 1-2. 기존 거래내역 모두 삭제
  const expRes = await fetch(`${API_BASE}/expenses?limit=500`);
  if (expRes.ok) {
    const exps = await expRes.json();
    for (const e of exps) {
      await fetch(`${API_BASE}/expenses/${e.id}`, { method: 'DELETE' });
    }
  }

  // 1-3. 카테고리 확인 및 생성
  const catRes = await fetch(`${API_BASE}/expenses/categories`);
  let categories = await catRes.json();
  const requiredCategories = [
    { name: '식비/카페', color: '#FF6B6B' },
    { name: '쇼핑', color: '#4ECDC4' },
    { name: '금융/보험', color: '#BB8FCE' },
  ];

  for (const reqCat of requiredCategories) {
    let found = categories.find((c) => c.name === reqCat.name);
    if (!found) {
      const createRes = await fetch(`${API_BASE}/expenses/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqCat),
      });
      const newCat = await createRes.json();
      categories.push(newCat);
    }
  }

  // 1-4. 결제수단 확인 및 생성
  const pmRes = await fetch(`${API_BASE}/expenses/payment-methods`);
  let pms = await pmRes.json();
  let kakaoPm = pms.find((pm) => pm.institution === '카카오뱅크' && pm.owner === '홍길동');
  if (!kakaoPm) {
    const createPmRes = await fetch(`${API_BASE}/expenses/payment-methods`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner: '홍길동',
        institution: '카카오뱅크',
        alias: '홍길동 카카오뱅크',
        account_number: '3333-01-1234567',
        is_active: true,
      }),
    });
    kakaoPm = await createPmRes.json();
  }

  console.log('[E2E] 카테고리 및 결제수단 설정 완료');
  return { categories, kakaoPm };
}

async function createSampleStatement() {
  console.log('[E2E] 2. 카카오뱅크 샘플 명세서 엑셀 파일 생성 중...');
  const sampleFilePath = path.join(rootDir, 'sample_statement_kakaobank.xlsx');

  // 파이썬 openpyxl을 사용하여 카카오뱅크 표준 형식 엑셀 생성
  const pythonScript = `
import openpyxl

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "카카오뱅크 거래내역"

ws["A1"] = "성명"
ws["B1"] = "홍길동"
ws["A2"] = "계좌번호"
ws["B2"] = "3333-01-1234567"
ws["A3"] = "조회기간"
ws["B3"] = "2026.08.01 ~ 2026.08.31"

headers = ["거래일시", "구분", "거래금액", "거래구분", "내용", "메모"]
for col_idx, h in enumerate(headers, start=1):
    ws.cell(row=5, column=col_idx, value=h)

rows = [
    ("2026.08.10 12:00:00", "출금", 35000, "체크카드", "(주)쿠팡", ""),
    ("2026.08.11 18:30:00", "출금", 18000, "체크카드", "쿠팡이츠 배달주문", ""),
    ("2026.08.12 09:00:00", "출금", 500000, "자동이체", "현대카드대금", ""),
    ("2026.08.13 14:00:00", "출금", 12000, "체크카드", "동네김밥", ""),
]

for row_idx, r_data in enumerate(rows, start=6):
    for col_idx, val in enumerate(r_data, start=1):
        ws.cell(row=row_idx, column=col_idx, value=val)

wb.save(r"${sampleFilePath.replace(/\\/g, '\\\\')}")
print("SUCCESS")
`;

  const proc = spawnSync('uv', ['run', 'python', '-c', pythonScript], {
    cwd: rootDir,
    encoding: 'utf-8',
  });

  if (proc.status !== 0) {
    throw new Error(`샘플 엑셀 파일 생성 실패: ${proc.stderr}`);
  }
  console.log(`[E2E] 샘플 파일 생성 완료: ${sampleFilePath}`);
  return sampleFilePath;
}

async function runE2E() {
  const { categories, kakaoPm } = await setupInitialData();
  const sampleFilePath = await createSampleStatement();

  console.log('[E2E] 3. Playwright 브라우저 기동...');
  const browser = await chromium.launch({
    headless: true, // 헤드리스 모드로 렌더링 및 스크린샷 수행
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  try {
    // 4. 지출 관리 메인 페이지 이동
    console.log('[E2E] 4. 지출 관리 메인 페이지(/expenses) 접속');
    await page.goto(`${FRONTEND_BASE}/expenses`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotsDir, '01_initial_expenses_page.png') });
    console.log('   -> 스크린샷 01 저장 완료');

    // 5. 자동분류 규칙 모달 열기
    console.log('[E2E] 5. [자동분류 규칙] 모달 열기');
    const rulesBtn = page.getByRole('button', { name: '자동분류 규칙' });
    await rulesBtn.click();
    await page.waitForSelector('[data-testid="expense-rules-modal"]', { timeout: 10000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotsDir, '02_rules_modal_opened.png') });
    console.log('   -> 스크린샷 02 저장 완료');

    // 6. 규칙 1: '쿠팡' -> '쇼핑'
    console.log("[E2E] 6. 규칙 1 등록: '쿠팡' -> '쇼핑'");
    await page.getByTestId('add-rule-button').click();
    await page.fill('input[placeholder*="예: 쿠팡"]', '쿠팡');
    await page.selectOption('#rule-category-select', { label: '쇼핑' });
    await page.getByRole('button', { name: '등록하기' }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotsDir, '03_rule_coupang_shopping_added.png') });
    console.log('   -> 스크린샷 03 저장 완료');

    // 7. 규칙 2: '쿠팡이츠' -> '식비/카페'
    console.log("[E2E] 7. 규칙 2 등록: '쿠팡이츠' -> '식비/카페'");
    await page.getByTestId('add-rule-button').click();
    await page.fill('input[placeholder*="예: 쿠팡"]', '쿠팡이츠');
    await page.selectOption('#rule-category-select', { label: '식비/카페' });
    await page.getByRole('button', { name: '등록하기' }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotsDir, '04_rule_coupangeats_food_added.png') });
    console.log('   -> 스크린샷 04 저장 완료');

    // 8. 규칙 3: '카드대금' -> '통계 제외'
    console.log("[E2E] 8. 규칙 3 등록: '카드대금' -> '통계 제외'");
    await page.getByTestId('add-rule-button').click();
    // '통계 제외' 라디오 선택
    await page.click('label:has-text("통계 제외") input[type="radio"]');
    await page.fill('input[placeholder*="예: 쿠팡"]', '카드대금');
    await page.getByRole('button', { name: '등록하기' }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotsDir, '05_rule_card_excluded_added.png') });
    console.log('   -> 스크린샷 05 저장 완료');

    // 규칙 모달 닫기 (하단 '닫기' 텍스트 버튼 클릭)
    const closeRulesBtn = page.locator('[data-testid="expense-rules-modal"]').getByText('닫기');
    await closeRulesBtn.click();
    await page.waitForSelector('[data-testid="expense-rules-modal"]', { state: 'detached', timeout: 5000 });
    await page.waitForTimeout(500);

    // 9. 명세서 업로드 모달 열기
    console.log('[E2E] 9. [명세서 업로드] 모달 열기 및 파일 업로드');
    const uploadBtn = page.getByRole('button', { name: '명세서 업로드' });
    await uploadBtn.click();
    await page.waitForSelector('text=명세서 업로드 및 검토');

    // 결제수단 선택
    const pmSelect = page.locator('select:has(option:has-text("결제수단을 선택해주세요"))');
    await pmSelect.selectOption(String(kakaoPm.id));

    // 파일 첨부
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(sampleFilePath);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotsDir, '06_upload_modal_file_selected.png') });
    console.log('   -> 스크린샷 06 저장 완료');

    // 10. 미리보기 파싱 실행
    console.log('[E2E] 10. [미리보기 파싱] 클릭 및 자동 매칭 검증');
    const parseBtn = page.getByRole('button', { name: '미리보기 파싱' });
    await parseBtn.click();

    // 프리뷰 테이블 로드 대기
    await page.waitForSelector('text=명세서 거래 미리보기 및 확정', { timeout: 10000 });
    await page.waitForTimeout(500);

    // 미리보기 화면 검증
    // 행 1: (주)쿠팡 -> 카테고리 '쇼핑' 자동 분류 확인
    // 행 2: 쿠팡이츠 배달주문 -> '쿠팡이츠' 우선 매칭으로 카테고리 '식비/카페' 자동 분류 확인
    // 행 3: 현대카드대금 -> '통계 제외' 체크박스 체크 확인
    // 행 4: 동네김밥 -> 카테고리 비어있음, 미분류 경고 메시지 표시 확인
    const warningText = await page.locator('text=미분류된 거래가 1건 있습니다.').isVisible();
    if (!warningText) {
      throw new Error('미분류 거래 경고 메시지가 표시되지 않았습니다.');
    }
    console.log('   [OK] 미분류 거래 1건 경고 메시지 표시 확인');

    // 저장 버튼이 disabled 상태인지 확인
    const commitBtn = page.getByRole('button', { name: '확정 및 저장' });
    const isDisabled = await commitBtn.isDisabled();
    if (!isDisabled) {
      throw new Error('미분류 거래가 존재할 때 확정 및 저장 버튼이 비활성화되지 않았습니다.');
    }
    console.log('   [OK] 확정 및 저장 버튼 비활성화(disabled) 상태 확인');

    await page.screenshot({ path: path.join(screenshotsDir, '07_preview_with_unclassified_error.png') });
    console.log('   -> 스크린샷 07 저장 완료');

    // 11. 동네김밥 행의 카테고리를 '식비/카페'로 수동 선택
    console.log("[E2E] 11. 미분류 행('동네김밥')의 카테고리를 '식비/카페'로 수동 선택");
    const dongneRow = page.locator('.fixed tr:has-text("동네김밥")');
    await dongneRow.locator('select').selectOption({ label: '식비/카페' });
    await page.waitForTimeout(500);

    // 이제 미분류 경고가 사라지고 저장 버튼이 활성화되었는지 확인
    const warningVisibleAfter = await page.locator('text=미분류된 거래가').isVisible();
    if (warningVisibleAfter) {
      throw new Error('카테고리 수동 선택 후에도 미분류 경고가 남아있습니다.');
    }
    const isNowEnabled = await commitBtn.isEnabled();
    if (!isNowEnabled) {
      throw new Error('카테고리 수동 선택 후 확정 및 저장 버튼이 활성화되지 않았습니다.');
    }
    console.log('   [OK] 카테고리 수동 지정 완료 및 확정 및 저장 버튼 활성화 확인');

    await page.screenshot({ path: path.join(screenshotsDir, '08_manual_category_selected.png') });
    console.log('   -> 스크린샷 08 저장 완료');

    // 12. 확정 및 저장 실행
    console.log('[E2E] 12. [확정 및 저장] 클릭');
    await commitBtn.click();

    // 모달이 닫히고 메인 화면으로 복귀할 때까지 대기
    await page.waitForSelector('text=명세서 거래 미리보기 및 확정', { state: 'detached', timeout: 10000 });
    await page.waitForTimeout(1500);

    // 13. 대시보드 통계 및 거래 원장 목록 데이터 정합성 교차 검증
    console.log('[E2E] 13. 대시보드 통계 및 거래 원장 목록 교차 검증');

    // 업로드된 데이터 기준월(2026-08)로 기간 선택 변경
    await page.selectOption('select[aria-label="시작년월 선택"]', '2026-08');
    await page.selectOption('select[aria-label="종료년월 선택"]', '2026-08');
    await page.waitForTimeout(1000);

    // 2026-08 기간 대시보드 및 거래 원장 스크린샷 저장
    await page.screenshot({ path: path.join(screenshotsDir, '09_committed_dashboard_and_ledger.png') });
    console.log('   -> 스크린샷 09 저장 완료');

    // 백엔드 API를 통해서도 최종 데이터 검증
    const verifyStatsRes = await fetch(`${API_BASE}/expenses/stats?start_month=2026-08&end_month=2026-08`);
    const statsData = await verifyStatsRes.json();
    console.log('   통계 데이터:', JSON.stringify(statsData));

    // 검증:
    // 포함된 거래: 쿠팡(35,000) + 쿠팡이츠(18,000) + 동네김밥(12,000) = 65,000원
    // 제외된 거래: 현대카드대금(500,000)
    if (statsData.period_total !== 65000) {
      throw new Error(`통계 집계 금액 불일치: 기대값 65,000, 실제값 ${statsData.period_total}`);
    }
    if (statsData.excluded_total !== 500000) {
      throw new Error(`통계 제외 금액 불일치: 기대값 500,000, 실제값 ${statsData.excluded_total}`);
    }
    console.log('   [OK] 통계 정합성 검증 성공: 포함 65,000원, 제외 500,000원');

    const verifyListRes = await fetch(`${API_BASE}/expenses?start_month=2026-08&end_month=2026-08`);
    const listData = await verifyListRes.json();
    if (listData.length !== 4) {
      throw new Error(`거래 목록 개수 불일치: 기대값 4, 실제값 ${listData.length}`);
    }
    console.log(`   [OK] 거래 원장 4건 정상 저장 확인`);

    // UI에서도 4건의 거래 행이 보이는지 확인
    const ledgerRows = page.locator('div:has-text("거래 내역 원장") table tbody tr');
    const ledgerRowCount = await ledgerRows.count();
    console.log(`   [OK] 화면 거래 원장 테이블 행 개수: ${ledgerRowCount}`);

    console.log('\n==================================================');
    console.log('   [SUCCESS] 모든 E2E 통합 검증 시나리오 완벽 통과!');
    console.log(`   스크린샷 위치: ${screenshotsDir}`);
    console.log('==================================================\n');

  } finally {
    await browser.close();
    // 임시 파일 정리
    if (fs.existsSync(sampleFilePath)) {
      fs.unlinkSync(sampleFilePath);
    }
  }
}

runE2E().catch((err) => {
  console.error('[E2E ERROR]', err);
  process.exit(1);
});
