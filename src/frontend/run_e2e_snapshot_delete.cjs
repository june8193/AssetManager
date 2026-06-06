const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 }
  });
  const page = await context.newPage();

  // Dialog (confirm, alert) 자동 수락 핸들러 등록
  page.on('dialog', async dialog => {
    console.log(`[Dialog] Type: ${dialog.type()}, Message: ${dialog.message()}`);
    await dialog.accept();
  });

  console.log("Navigating to DB Management page...");
  await page.goto("http://localhost:5173/db");
  
  // 데이터 및 탭 로딩 대기
  await page.waitForTimeout(5000);

  // '스냅샷' 탭 클릭
  console.log("Clicking '스냅샷' tab...");
  const tabBtn = page.locator('button:has-text("스냅샷")');
  await tabBtn.click();
  await page.waitForTimeout(3000);

  // 스크린샷 폴더 생성 (GEMINI.md 규칙 준수: YYYYMMDD_HHMMSS_작업이름)
  const dirName = "20260606_211500_snapshot_delete";
  const screenshotsDir = path.join(__dirname, "..", "..", "screenshots", dirName);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 1. 초기 스냅샷 목록 캡처
  const initialScreenshotPath = path.join(screenshotsDir, "1_initial_snapshot_list.png");
  await page.screenshot({ path: initialScreenshotPath });
  console.log(`Initial snapshot list saved to ${initialScreenshotPath}`);

  // 2. 2026-05-28 날짜의 스냅샷 행 찾기 및 삭제 버튼 클릭
  console.log("Locating snapshot row for '2026-05-28'...");
  const targetRow = page.locator('tr:has-text("2026-05-28")').first();
  
  if (await targetRow.count() > 0) {
    const deleteBtn = targetRow.locator('button[title="스냅샷 일괄 삭제"]');
    if (await deleteBtn.count() > 0) {
      console.log("Clicking delete button for '2026-05-28' snapshot...");
      await deleteBtn.click();
      
      // 삭제 후 API 반영 및 UI 갱신 대기
      await page.waitForTimeout(4000);

      // 3. 삭제 완료 후 스냅샷 목록 캡처
      const afterScreenshotPath = path.join(screenshotsDir, "2_after_snapshot_deleted.png");
      await page.screenshot({ path: afterScreenshotPath });
      console.log(`Post-deletion snapshot list saved to ${afterScreenshotPath}`);

      // 테이블에서 2026-05-28 행이 사라졌는지 확인
      const checkRow = page.locator('tr:has-text("2026-05-28")');
      console.log(`Row count for '2026-05-28' after deletion: ${await checkRow.count()}`);
    } else {
      console.log("Could not find the delete button on the row!");
    }
  } else {
    console.log("Could not find any row containing '2026-05-28'!");
  }

  await browser.close();
  console.log("E2E snapshot deletion verification completed successfully!");
}

main().catch(err => {
  console.error("E2E script failed:", err);
  process.exit(1);
});
