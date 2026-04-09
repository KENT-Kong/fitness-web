// Visual QA tool for fitness-web
// Usage: node screenshot.js [url] [output] [--mobile] [--full]
// Examples:
//   node screenshot.js                          → desktop screenshot of dashboard
//   node screenshot.js --mobile                 → mobile viewport (390x844)
//   node screenshot.js --full                   → full page screenshot
//   node screenshot.js http://localhost:8080 #detail --mobile → specific tab + mobile

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const DEFAULT_URL = 'http://localhost:8080';
const OUTPUT_DIR = path.join(__dirname, 'screenshots');

// Parse args
const args = process.argv.slice(2);
let url = DEFAULT_URL;
let outputPath = null;
let mobile = false;
let fullPage = false;
let hash = '';

for (const arg of args) {
  if (arg === '--mobile') mobile = true;
  else if (arg === '--full') fullPage = true;
  else if (arg.startsWith('http')) url = arg;
  else if (arg.startsWith('#')) hash = arg;
  else outputPath = arg;
}

// Build final URL with hash
const finalUrl = url + hash;

// Auto-generate output path
if (!outputPath) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const suffix = mobile ? 'mobile' : 'desktop';
  const page = hash ? hash.replace('#', '') : 'dashboard';
  outputPath = path.join(OUTPUT_DIR, `${page}-${suffix}-${ts}.png`);
} else {
  outputPath = path.join(OUTPUT_DIR, outputPath);
}

// Ensure output dir exists
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(mobile ? {
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
  } : {
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  // Navigate and wait for content to load
  await page.goto(finalUrl, { waitUntil: 'networkidle' });

  // Wait extra for animations to settle (stat number animations take ~1s)
  await page.waitForTimeout(1200);

  // Scroll to trigger lazy-loaded sections if needed
  if (fullPage) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
  }

  await page.screenshot({
    path: outputPath,
    fullPage,
  });

  await browser.close();
  console.log(outputPath);
})();
