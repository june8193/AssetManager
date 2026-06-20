const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function run() {
  console.log("--- starting DB page diagnostics (Node.js) ---");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  // Create timestamp-based screenshot directory
  const now = new Date();
  const timestamp = now.getFullYear() + 
    String(now.getMonth() + 1).padStart(2, '0') + 
    String(now.getDate()).padStart(2, '0') + '_' +
    String(now.getHours()).padStart(2, '0') + 
    String(now.getMinutes()).padStart(2, '0') + 
    String(now.getSeconds()).padStart(2, '0');
  
  const screenshotDir = path.join(__dirname, "..", "..", "screenshots", `${timestamp}_check_db_page`);
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
  console.log("Screenshot directory:", screenshotDir);

  const consoleLogs = [];
  const pageErrors = [];

  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(`[${msg.type()}] ${text}`);
    console.log(`BROWSER CONSOLE [${msg.type()}]:`, text);
  });

  page.on('pageerror', err => {
    pageErrors.push(err.message);
    console.error("BROWSER PAGE ERROR:", err.message);
  });

  const url = "http://localhost:5173/db";
  console.log(`Navigating to: ${url}`);
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
  } catch (e) {
    console.log("Network idle wait failed, basic navigation used:", e.message);
    await page.goto(url);
  }

  console.log("Page loaded. Waiting 5 seconds for rendering...");
  await page.waitForTimeout(5000);

  // Take initial screenshot
  const initialPath = path.join(screenshotDir, "0_loaded.png");
  await page.screenshot({ path: initialPath });
  console.log("Saved initial screenshot:", initialPath);

  // Get body text
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log("\n--- BROWSER BODY TEXT (TRUNCATED) ---");
  console.log(bodyText.substring(0, 1000));
  console.log("-------------------------------------\n");

  // Click each tab and take screenshot
  const tabs = ["계좌 관리", "자산 마스터", "거래 내역", "스냅샷", "환율 관리"];
  for (let i = 0; i < tabs.length; i++) {
    const tabName = tabs[i];
    console.log(`\nClicking tab '${tabName}'...`);
    try {
      const btn = page.locator(`button:has-text("${tabName}")`);
      if (await btn.count() > 0) {
        await btn.click();
        await page.waitForTimeout(2000);
        
        const tabPath = path.join(screenshotDir, `${i+1}_tab_${tabName.replace(/\s+/g, '_')}.png`);
        await page.screenshot({ path: tabPath });
        console.log(`Saved screenshot for ${tabName}:`, tabPath);
      } else {
        console.log(`Tab button '${tabName}' not found`);
      }
    } catch (e) {
      console.error(`Error clicking tab '${tabName}':`, e.message);
    }
  }

  await browser.close();
  console.log("\n--- DIAGNOSTICS COMPLETED ---");
  
  if (pageErrors.length > 0) {
    console.log("\n!!! DETECTED BROWSER ERRORS !!!");
    pageErrors.forEach(err => console.log("- " + err));
  } else {
    console.log("\nNo browser-level JavaScript errors caught.");
  }
}

run().catch(err => {
  console.error("Diagnostic execution failed:", err);
  process.exit(1);
});
