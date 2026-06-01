const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function capture() {
  console.log("Starting screenshot capture script...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  // 이 파일은 src/frontend 폴더에 복사되어 실행됩니다.
  // 따라서 __dirname은 c:\localrepo\AssetManager\src\frontend 이며, 
  // 프로젝트 루트인 c:\localrepo\AssetManager\docs\guide\images 에 저장하기 위해 
  // 상위 경로를 두 번 올라갑니다.
  const imagesDir = path.join(__dirname, "..", "..", "docs", "guide", "images");
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
    console.log(`Created directory: ${imagesDir}`);
  } else {
    console.log(`Using directory: ${imagesDir}`);
  }

  const targets = [
    { url: "http://localhost:5173/", filename: "dashboard.png", name: "대시보드" },
    { url: "http://localhost:5173/benchmark", filename: "market_analysis.png", name: "시장분석" },
    { url: "http://localhost:5173/watchlist", filename: "watchlist.png", name: "관심종목" },
    { url: "http://localhost:5173/ratios/check", filename: "ratio_check.png", name: "비중 점검" },
    { url: "http://localhost:5173/db", filename: "db_master.png", name: "마스터 관리" },
    { url: "http://localhost:5173/db/snapshots/new", filename: "db_snapshot_wizard.png", name: "스냅샷 생성 마법사" },
    { url: "http://localhost:5173/connection", filename: "api_connection.png", name: "API 연결 관리" }
  ];

  for (const target of targets) {
    console.log(`\nNavigating to ${target.name} (${target.url}) ...`);
    try {
      await page.goto(target.url, { waitUntil: 'networkidle' });
    } catch (e) {
      console.log(`Initial navigation to ${target.url} failed or timed out. Trying standard navigation.`);
      await page.goto(target.url);
    }
    
    // 차트 로딩 및 렌더링 애니메이션 대기
    console.log("Waiting 5 seconds for charts and data rendering...");
    await page.waitForTimeout(5000);

    // 에러 발생시 '다시 시도' 버튼 자동 클릭
    const retryBtn = page.locator('button:has-text("다시 시도")');
    if (await retryBtn.count() > 0) {
      console.log("Detected '다시 시도' button. Clicking to retry fetching data...");
      await retryBtn.click();
      await page.waitForTimeout(5000);
    }

    const savePath = path.join(imagesDir, target.filename);
    await page.screenshot({ path: savePath });
    console.log(`Saved: ${savePath}`);
  }

  await browser.close();
  console.log("\nAll screenshots captured successfully!");
}

capture().catch(err => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
