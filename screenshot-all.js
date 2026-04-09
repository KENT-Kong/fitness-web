// Screenshot all 4 tabs (desktop + mobile) after injecting data.json into localStorage
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:8080';
const SCREENSHOTS = path.join(__dirname, 'screenshots');

const tabs = ['dashboard', 'detail', 'nutrition', 'settings'];
const modes = [
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'mobile', viewport: { width: 390, height: 844 }, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' }
];

// Ensure dirs
['desktop', 'mobile'].forEach(m => fs.mkdirSync(path.join(SCREENSHOTS, m), { recursive: true }));

(async () => {
  const browser = await chromium.launch({ headless: true });

  for (const mode of modes) {
    const ctx = await browser.newContext({
      viewport: mode.viewport,
      userAgent: mode.ua || undefined,
    });

    for (const tab of tabs) {
      const page = await ctx.newPage();
      
      // Navigate first (loads index.html)
      await page.goto(BASE, { waitUntil: 'networkidle' });
      
      // Inject data.json into localStorage (matching loadData flow)
      await page.evaluate(async () => {
        try {
          const resp = await fetch('/data.json', { cache: 'no-store' });
          if (resp.ok) {
            const data = await resp.json();
            if (Array.isArray(data) && data.length > 0) {
              localStorage.setItem('forge-fitness-data', JSON.stringify(data));
            }
          }
        } catch(e) {}
      });
      
      // Reload to pick up localStorage data
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
      
      // Switch tab via JS
      await page.evaluate((tabName) => {
        if (typeof switchTab === 'function') switchTab(tabName);
      }, tab);
      
      // Wait for animations and lazy content
      await page.waitForTimeout(1500);
      
      // Scroll to bottom for full page
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(600);
      
      // Screenshot
      const outPath = path.join(SCREENSHOTS, mode.name, `${tab}.png`);
      await page.screenshot({ path: outPath, fullPage: true });
      console.log(`✅ ${mode.name}/${tab}.png`);
      
      await page.close();
    }
    
    await ctx.close();
  }

  await browser.close();
  console.log('\nAll screenshots done!');
})();
