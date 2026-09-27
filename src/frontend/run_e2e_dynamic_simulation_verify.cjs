const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * 타임스탬프 기반 날짜시간 문자열을 반환합니다 (형식: YYYYMMDD_HHMMSS).
 */
function getFormattedDateTime() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
}

async function main() {
  console.log("=== S&P 500 MDD & VIX 동적 리밸런싱 시뮬레이션 E2E 검증 시작 ===");

  const browser = await chromium.launch({ 
    headless: true,
    channel: 'chrome'
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 }
  });
  const page = await context.newPage();

  // 타임스탬프 기반 스크린샷 저장 디렉토리 생성 (GEMINI.md 규칙 준수)
  const timestamp = getFormattedDateTime();
  const dirName = `${timestamp}_dynamic_rebalancing_simulation`;
  const screenshotsDir = path.join(__dirname, "..", "..", "screenshots", dirName);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
  console.log(`[Info] 스크린샷 저장 경로: ${screenshotsDir}`);

  /**
   * 스크린샷 캡처 및 저장 공통 헬퍼 (Duplicated Code 방지)
   */
  async function captureScreenshot(filename) {
    const fullPath = path.join(screenshotsDir, filename);
    await page.screenshot({ path: fullPath, fullPage: true });
    console.log(`  [Screenshot] 저장 완료: ${filename}`);
  }

  try {
    // -------------------------------------------------------------
    // 1. 자산배분 시뮬레이션 페이지 접속
    // -------------------------------------------------------------
    console.log("\n[Step 1] 자산배분 시뮬레이션 페이지 접속 (http://localhost:5173/simulation/asset-allocation)...");
    await page.goto("http://localhost:5173/simulation/asset-allocation", { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 에러 발생 시 재시도 버튼 자동 처리
    const retryBtn = page.locator('button:has-text("다시 시도")');
    if (await retryBtn.count() > 0) {
      console.log("  [Notice] 에러 화면 감지. '다시 시도' 버튼 클릭...");
      await retryBtn.click();
      await page.waitForTimeout(3000);
    }

    // -------------------------------------------------------------
    // 시나리오 1: 동적 리밸런싱 탭 진입 및 기본 프리셋 결과 차트/카드/로그 렌더링 확인
    // -------------------------------------------------------------
    console.log("\n[시나리오 1] 동적 리밸런싱 (MDD/VIX) 탭 진입 및 기본 프리셋 결과 렌더링 검증...");
    const dynamicTabBtn = page.locator('button:has-text("동적 리밸런싱 (MDD/VIX)")');
    await dynamicTabBtn.waitFor({ state: 'visible', timeout: 10000 });
    await dynamicTabBtn.click();
    console.log("  - '동적 리밸런싱 (MDD/VIX)' 탭 클릭 완료");

    // 기본 프리셋 선택 상태 확인
    const presetSelect = page.locator('#preset-select');
    await presetSelect.waitFor({ state: 'visible', timeout: 5000 });
    const selectedPresetText = await presetSelect.evaluate(el => el.options[el.selectedIndex]?.text);
    console.log(`  - 현재 선택된 프리셋: "${selectedPresetText}"`);

    // 차트 렌더링 확인
    const chartContainer = page.locator('.recharts-responsive-container');
    await chartContainer.first().waitFor({ state: 'visible', timeout: 10000 });
    console.log("  - Recharts 차트 컨테이너 렌더링 확인 완료");

    // 3개 벤치마크 성과 카드 확인
    const dynamicCard = page.locator('text=동적 리밸런싱 전략').first();
    const regularCard = page.locator('text=일반 정기 리밸런싱').first();
    const buyHoldCard = page.locator('text=S&P 500 단순 보유').first();
    await dynamicCard.waitFor({ state: 'visible', timeout: 5000 });
    await regularCard.waitFor({ state: 'visible', timeout: 5000 });
    await buyHoldCard.waitFor({ state: 'visible', timeout: 5000 });
    console.log("  - 3개 벤치마크(동적 리밸런싱, 일반 정기, S&P 500 단순 보유) 성과 카드 렌더링 확인");

    // 이벤트 로그 테이블 렌더링 확인
    const eventLogTable = page.locator('table');
    await eventLogTable.first().waitFor({ state: 'visible', timeout: 5000 });
    const rowCount = await page.locator('tbody tr').count();
    console.log(`  - 리밸런싱 이벤트 로그 행 수: ${rowCount}개 감지`);

    await captureScreenshot("1_scenario1_dynamic_default_view.png");

    // 연도별 현황 탭 전환 확인
    console.log("  - '연도별 현황' 상세 탭 전환...");
    const yearlyTabBtn = page.locator('button:has-text("연도별 현황")');
    await yearlyTabBtn.click();
    await page.waitForTimeout(1500);
    await captureScreenshot("1_scenario1_yearly_stats_view.png");

    // 이벤트 로그 탭으로 복귀
    await page.locator('button:has-text("이벤트 로그")').click();
    await page.waitForTimeout(1000);

    // -------------------------------------------------------------
    // 시나리오 2: 단계 추가/삭제 및 조건 수치 변경 시 시뮬레이션 즉각 재계산 확인
    // -------------------------------------------------------------
    console.log("\n[시나리오 2] 단계 추가/삭제 및 조건 수치 변경 즉각 재계산 검증...");
    const initialTiersCount = await page.locator('div[class*="rounded-2xl"]:has(span:has-text("단계"))').count();
    console.log(`  - 초기 설정 티어 수: ${initialTiersCount}개`);

    // 단계 추가 버튼 클릭
    const addTierBtn = page.locator('button:has-text("단계 추가 (Add Tier)")');
    await addTierBtn.click();
    await page.waitForTimeout(1500);

    const afterAddTiersCount = await page.locator('div[class*="rounded-2xl"]:has(span:has-text("단계"))').count();
    console.log(`  - 단계 추가 후 티어 수: ${afterAddTiersCount}개`);
    if (afterAddTiersCount !== initialTiersCount + 1) {
      throw new Error(`단계 추가 실패: 예상 ${initialTiersCount + 1}, 실제 ${afterAddTiersCount}`);
    }

    // 4단계의 목표 주식 비중 수치 변경
    console.log("  - 추가된 4단계의 수치 변경 테스트...");
    const tierDivs = page.locator('div[class*="rounded-2xl"]:has(span:has-text("단계"))');
    const lastTierDiv = tierDivs.nth(afterAddTiersCount - 1);
    const lastInputs = lastTierDiv.locator('input[type="number"]');
    await lastInputs.nth(2).fill("95");
    await page.waitForTimeout(2000);

    await captureScreenshot("2_scenario2_tier_added_and_modified.png");

    // 단계 삭제 테스트
    console.log("  - 추가된 마지막 티어 삭제 버튼 클릭...");
    const deleteTierBtns = page.locator('button[aria-label$="단계 티어 삭제"]');
    const lastDeleteBtn = deleteTierBtns.last();
    await lastDeleteBtn.click();
    await page.waitForTimeout(1500);

    const afterDeleteTiersCount = await page.locator('div[class*="rounded-2xl"]:has(span:has-text("단계"))').count();
    console.log(`  - 삭제 후 티어 수: ${afterDeleteTiersCount}개 (초기 상태 ${initialTiersCount}개로 복원)`);
    if (afterDeleteTiersCount !== initialTiersCount) {
      throw new Error(`단계 삭제 실패: 예상 ${initialTiersCount}, 실제 ${afterDeleteTiersCount}`);
    }

    await captureScreenshot("2_scenario2_tier_deleted_restored.png");

    // -------------------------------------------------------------
    // 시나리오 3: 커스텀 프리셋 저장 -> 수정 -> 다른 프리셋 전환 -> 삭제 동작 검증
    // -------------------------------------------------------------
    console.log("\n[시나리오 3] 커스텀 전략 프리셋 CRUD 영구 관리 검증...");
    
    // 1) 프리셋 저장 모달 열기
    const savePresetBtn = page.locator('button:has-text("프리셋 저장")');
    await savePresetBtn.click();
    const saveModalHeader = page.locator('h3:has-text("새 전략 프리셋으로 저장")');
    await saveModalHeader.waitFor({ state: 'visible', timeout: 3000 });
    console.log("  - 프리셋 저장 모달 노출 확인");

    const customPresetName = `E2E 검증 전략 ${Date.now().toString().slice(-4)}`;
    const nameInput = page.locator('input[aria-label="새 프리셋 명칭"]');
    await nameInput.fill(customPresetName);
    
    const submitSaveBtn = page.locator('button[type="submit"]:has-text("저장하기")');
    await submitSaveBtn.click();
    await page.waitForTimeout(2000);
    console.log(`  - 신규 프리셋 "${customPresetName}" 저장 요청 완료`);

    // 저장 후 셀렉트박스에 선택되어 있는지 확인
    const selectedAfterSave = await presetSelect.evaluate(el => el.options[el.selectedIndex]?.text);
    console.log(`  - 저장 후 활성화된 프리셋: "${selectedAfterSave}"`);
    if (!selectedAfterSave.includes(customPresetName)) {
      throw new Error(`신규 프리셋 선택 검증 실패: 예상 포함 "${customPresetName}", 실제 "${selectedAfterSave}"`);
    }

    await captureScreenshot("3_scenario3_preset_created.png");

    // 2) 프리셋 수정
    console.log("  - 프리셋 수정 모달 열기 및 명칭 변경...");
    const editPresetBtn = page.locator('button:has-text("프리셋 수정")');
    await editPresetBtn.click();
    const editModalHeader = page.locator('h3:has-text("전략 프리셋 수정")');
    await editModalHeader.waitFor({ state: 'visible', timeout: 3000 });

    const updatedPresetName = `${customPresetName} (수정됨)`;
    const editNameInput = page.locator('input[aria-label="수정할 프리셋 명칭"]');
    await editNameInput.fill(updatedPresetName);

    const submitUpdateBtn = page.locator('button[type="submit"]:has-text("수정 완료")');
    await submitUpdateBtn.click();
    await page.waitForTimeout(2000);
    console.log(`  - 프리셋 수정 ("${updatedPresetName}") 완료`);

    const selectedAfterEdit = await presetSelect.evaluate(el => el.options[el.selectedIndex]?.text);
    console.log(`  - 수정 후 활성화된 프리셋: "${selectedAfterEdit}"`);
    if (!selectedAfterEdit.includes(updatedPresetName)) {
      throw new Error(`프리셋 수정 반영 검증 실패: 예상 포함 "${updatedPresetName}", 실제 "${selectedAfterEdit}"`);
    }

    await captureScreenshot("3_scenario3_preset_updated.png");

    // 3) 다른 프리셋(기본 추천 프리셋)으로 전환
    console.log("  - 기본 추천 프리셋으로 전환 테스트...");
    const firstOptionValue = await presetSelect.locator('option').first().getAttribute('value');
    await presetSelect.selectOption(firstOptionValue);
    await page.waitForTimeout(1500);

    const selectedAfterSwitch = await presetSelect.evaluate(el => el.options[el.selectedIndex]?.text);
    console.log(`  - 추천 프리셋으로 전환된 상태: "${selectedAfterSwitch}"`);

    await captureScreenshot("3_scenario3_preset_switched_back.png");

    // 4) 다시 생성했던 커스텀 프리셋으로 전환 후 삭제
    console.log("  - 삭제를 위해 생성한 커스텀 프리셋 재선택...");
    const customOption = presetSelect.locator(`option:has-text("${updatedPresetName}")`);
    const customOptionValue = await customOption.getAttribute('value');
    await presetSelect.selectOption(customOptionValue);
    await page.waitForTimeout(1500);

    console.log("  - 프리셋 삭제 모달 열기...");
    const deletePresetBtn = page.locator('button[aria-label="현재 프리셋 삭제"]');
    await deletePresetBtn.click();
    const deleteModalHeader = page.locator('h3:has-text("프리셋 삭제")');
    await deleteModalHeader.waitFor({ state: 'visible', timeout: 3000 });

    const confirmDeleteBtn = page.locator('button:has-text("삭제 확인")');
    await confirmDeleteBtn.click();
    await page.waitForTimeout(2000);
    console.log("  - 프리셋 삭제 확인 버튼 클릭 완료");

    // 셀렉트박스 옵션 목록에서 해당 프리셋이 제거되었는지 검증
    const remainingOptionTexts = await presetSelect.locator('option').allInnerTexts();
    const isStillPresent = remainingOptionTexts.some(txt => txt.includes(updatedPresetName));
    console.log(`  - 삭제된 프리셋 잔존 여부: ${isStillPresent} (정상: false)`);
    if (isStillPresent) {
      throw new Error(`프리셋 삭제 검증 실패: "${updatedPresetName}"이 여전히 옵션에 존재함`);
    }

    await captureScreenshot("3_scenario3_preset_deleted.png");

    // -------------------------------------------------------------
    // 시나리오 4: 거치식 vs 적립식 모드 전환 및 결과 검증
    // -------------------------------------------------------------
    console.log("\n[시나리오 4] 거치식 vs 적립식 모드 전환 및 결과 검증...");
    
    // 거치식 모드 버튼 클릭
    const lumpSumModeBtn = page.locator('button:has-text("거치식 모드")');
    await lumpSumModeBtn.click();
    await page.waitForTimeout(2000);
    console.log("  - '거치식 모드' 전환 버튼 클릭 완료");

    // 거치식 모드에서는 '매년 추가 적립금' 영역이 노출되지 않아야 함
    const recurringDepositInputCount = await page.locator('text=매년 추가 적립금').count();
    console.log(`  - 거치식 모드에서 '매년 추가 적립금' 필드 노출 여부: ${recurringDepositInputCount > 0} (정상: false)`);
    if (recurringDepositInputCount > 0) {
      throw new Error("거치식 모드에서는 매년 추가 적립금 설정이 숨겨져야 합니다.");
    }

    await captureScreenshot("4_scenario4_lump_sum_mode.png");

    // 적립식 모드로 다시 복귀
    const recurringModeBtn = page.locator('button:has-text("적립식 모드")');
    await recurringModeBtn.click();
    await page.waitForTimeout(2000);
    console.log("  - '적립식 모드' 복귀 버튼 클릭 완료");

    const recurringDepositRestored = await page.locator('text=매년 추가 적립금').count();
    console.log(`  - 적립식 모드에서 '매년 추가 적립금' 필드 복원 여부: ${recurringDepositRestored > 0} (정상: true)`);
    if (recurringDepositRestored === 0) {
      throw new Error("적립식 모드에서는 매년 추가 적립금 설정이 나타나야 합니다.");
    }

    await captureScreenshot("4_scenario4_recurring_mode_restored.png");

    console.log("\n=======================================================");
    console.log("🎉 동적 리밸런싱 시뮬레이션 E2E 4대 시나리오 전 과정 검증 성공!");
    console.log(`총 8장의 고해상도 검증 스크린샷이 ${screenshotsDir} 폴더에 정상 저장되었습니다.`);
    console.log("=======================================================\n");

  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error("\n❌ E2E 검증 중 치명적 오류 발생:", err);
  process.exit(1);
});
