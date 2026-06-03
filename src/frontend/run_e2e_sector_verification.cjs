const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function getFormattedDateTime() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}_compare_returns`;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 }
  });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:5173/benchmark/compare-returns ...");
  await page.goto("http://localhost:5173/benchmark/compare-returns");
  
  // 데이터 로딩 대기
  console.log("Waiting for backend server initialization and initial loading...");
  await page.waitForTimeout(6000);

  // 에러 화면 발생 시 '다시 시도' 자동 클릭 처리
  const retryBtn = page.locator('button:has-text("다시 시도")');
  if (await retryBtn.count() > 0) {
    console.log("Detected error screen. Clicking '다시 시도'...");
    await retryBtn.click();
    await page.waitForTimeout(5000);
  }

  // 스크린샷 폴더 생성 (GEMINI.md 규칙 준수)
  const dirName = getFormattedDateTime();
  const screenshotsDir = path.join(__dirname, "..", "..", "screenshots", dirName);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
  console.log(`Screenshots will be saved in: ${screenshotsDir}`);

  // 1. 초기 화면 캡처
  const initialScreenshotPath = path.join(screenshotsDir, "1_compare_initial.png");
  await page.screenshot({ path: initialScreenshotPath, fullPage: true });
  console.log(`Initial page screenshot saved to ${initialScreenshotPath}`);

  // 2. 대표 ETF 추가 테스트
  console.log("Adding a representative ETF (KODEX 레버리지 / 122630)...");
  const addEtfBtn = page.locator('button:has-text("추가")').first();
  if (await addEtfBtn.count() > 0) {
    await addEtfBtn.click();
    await page.waitForTimeout(1000);
    
    // 모달 폼 채우기
    await page.fill('input[placeholder="예: 069500"]', '122630');
    await page.fill('input[placeholder="누락 시 자동으로 조회합니다"]', 'KODEX 레버리지');
    
    // 모달 내 '추가하기' 버튼 클릭
    const submitBtn = page.locator('button[type="submit"]:has-text("추가하기")').first();
    await submitBtn.click();
    await page.waitForTimeout(3000); // API 등록 대기
    
    console.log("ETF added successfully.");
  }

  // 3. 국가 탭 전환 검증
  console.log("Switching tab to US stocks...");
  const usTabBtn = page.locator('button:has-text("미국 주식 (USD)")');
  if (await usTabBtn.count() > 0) {
    await usTabBtn.click();
    await page.waitForTimeout(3000);
    
    const usTabScreenshotPath = path.join(screenshotsDir, "2_us_tab.png");
    await page.screenshot({ path: usTabScreenshotPath, fullPage: true });
    console.log(`US tab screenshot saved to ${usTabScreenshotPath}`);
    
    // 한국 탭으로 다시 원상태 복귀
    console.log("Switching back to KR stocks...");
    const krTabBtn = page.locator('button:has-text("한국 주식 (KRW)")');
    await krTabBtn.click();
    await page.waitForTimeout(3000);
  }

  // 4. 커스텀 섹터 생성 및 종목 관리 검증
  console.log("Creating a custom sector (반도체 선도)...");
  const createSectorBtn = page.locator('button:has-text("섹터 생성")');
  if (await createSectorBtn.count() > 0) {
    await createSectorBtn.click();
    await page.waitForTimeout(1000);
    
    await page.fill('input[placeholder="예: 자동차 및 모빌리티"]', '반도체 선도');
    const submitSectorBtn = page.locator('button[type="submit"]:has-text("섹터 생성")');
    await submitSectorBtn.click();
    await page.waitForTimeout(3000); // 생성 완료 대기
    
    console.log("Sector created.");
    
    // 새로 만든 섹터 클릭하여 활성화
    console.log("Clicking '반도체 선도' sector to manage (Dropdown toggled)...");
    const newSectorRow = page.locator('tr:has-text("반도체 선도")');
    if (await newSectorRow.count() > 0) {
      // 행 클릭하여 드롭다운 토글
      await newSectorRow.first().click();
      await page.waitForTimeout(2000);

      // 드롭다운 화면 캡처
      const dropdownScreenshotPath = path.join(screenshotsDir, "2_sector_dropdown.png");
      await page.screenshot({ path: dropdownScreenshotPath, fullPage: true });
      console.log(`Dropdown sector details screenshot saved to ${dropdownScreenshotPath}`);

      // 종목 구성을 관리하기 위해 기어 버튼 클릭
      console.log("Clicking gear button to open sector manager...");
      const gearBtn = newSectorRow.locator('button[title="종목 구성 관리"]');
      if (await gearBtn.count() > 0) {
        await gearBtn.click();
        await page.waitForTimeout(2000);
      }
      
      // 5. 섹터 이름 수정 검증 ('반도체 선도' -> '반도체 선도 대장')
      console.log("Editing sector name to '반도체 선도 대장'...");
      const editNameBtn = page.locator('button[title="이름 수정"]');
      if (await editNameBtn.count() > 0) {
        await editNameBtn.click();
        await page.waitForTimeout(1000);
        
        // 인라인 폼 채우기 및 저장
        await page.fill('input#sector-name-edit-input', '반도체 선도 대장');
        const saveNameBtn = page.locator('button:has-text("저장")');
        await saveNameBtn.click();
        await page.waitForTimeout(3000);
        console.log("Sector name updated successfully.");
      }
      
      // 종목 추가
      console.log("Adding stock to custom sector (삼성전자 / 005930)...");
      await page.fill('input[placeholder="예: 005930"]', '005930');
      await page.fill('input[placeholder="누락 시 자동 수집"]', '삼성전자');
      await page.fill('input[placeholder="누락 시 API 자동 수집"]', '5969782550'); // 발행주식수 직접 지정
      
      const addStockBtn = page.locator('button:has-text("종목 추가")');
      await addStockBtn.click();
      await page.waitForTimeout(4000); // 종목 추가 API 연동 대기
      console.log("Stock added to custom sector.");
    }
  }

  // 6. 관심종목 추가 검증
  console.log("Adding a watchlist item (SK하이닉스 / 000660)...");
  // 두 번째 '추가' 버튼(인덱스 1)이 관심종목 테이블의 추가 버튼입니다.
  const addWatchlistBtn = page.locator('button:has-text("추가")').nth(1);
  if (await addWatchlistBtn.count() > 0) {
    await addWatchlistBtn.click();
    await page.waitForTimeout(1000);
    
    await page.fill('input[placeholder="예: 005930"]', '000660');
    await page.fill('input[placeholder="누락 시 자동으로 조회합니다"]', 'SK하이닉스');
    
    const submitWatchlistBtn = page.locator('button[type="submit"]:has-text("추가하기")').last();
    await submitWatchlistBtn.click();
    await page.waitForTimeout(4000); // API 등록 대기
    console.log("Watchlist item added successfully.");
  }

  // 7. 최종 대시보드 화면 캡처
  const finalScreenshotPath = path.join(screenshotsDir, "3_final_dashboard.png");
  await page.screenshot({ path: finalScreenshotPath, fullPage: true });
  console.log(`Final dashboard screenshot saved to ${finalScreenshotPath}`);

  await browser.close();
  console.log("E2E verification for Compare Returns Dashboard completed successfully!");
}

main().catch(err => {
  console.error("E2E script failed:", err);
  process.exit(1);
});
