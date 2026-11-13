import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const TARGET_DIR = path.resolve('docs-site/assets/img');

async function main() {
  console.log('Target directory:', TARGET_DIR);
  if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  
  // Helper to get fresh page with consistent settings
  async function createPage(theme = 'light') {
    const context = await browser.newContext({
      viewport: { width: 1366, height: 800 },
      deviceScaleFactor: 1.5
    });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:47371/', { waitUntil: 'networkidle' });
    await page.evaluate((t) => {
      localStorage.setItem('freegstbill_sidebarAutoHide', '0');
      localStorage.setItem('freegstbill_theme', t);
    }, theme);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    return { page, context };
  }

  // Helper to remove any floating toasts
  async function dismissToasts(page) {
    await page.evaluate(() => {
      document.querySelectorAll('.toast, .toast-container, [role="alert"]').forEach(el => el.remove());
    });
  }

  // 1. Dashboard (Light)
  console.log('Capturing app-dashboard.png...');
  {
    const { page, context } = await createPage('light');
    await dismissToasts(page);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(TARGET_DIR, 'app-dashboard.png') });
    await context.close();
  }

  // 2. Invoice Editor (Light)
  console.log('Capturing app-invoice-editor.png...');
  {
    const { page, context } = await createPage('light');
    await page.click('button[aria-label="Edit"]');
    await page.waitForTimeout(1200);
    await dismissToasts(page);
    await page.screenshot({ path: path.join(TARGET_DIR, 'app-invoice-editor.png') });

    // 3. Invoice Preview element close-up (replacing invoice-lut-export.png)
    console.log('Capturing invoice-lut-export.png (preview)...');
    const previewEl = await page.$('#invoice-preview');
    if (previewEl) {
      await previewEl.screenshot({ path: path.join(TARGET_DIR, 'invoice-lut-export.png') });
    }
    await context.close();
  }

  // 4. GST Returns
  console.log('Capturing app-gstr1.png...');
  {
    const { page, context } = await createPage('light');
    await page.click('button:has-text("GST Returns")');
    await page.waitForTimeout(1200);
    await dismissToasts(page);
    await page.screenshot({ path: path.join(TARGET_DIR, 'app-gstr1.png') });
    await context.close();
  }

  // 5. Cash Book
  console.log('Capturing cash-book.png...');
  {
    const { page, context } = await createPage('light');
    await page.click('button:has-text("Cash book")');
    await page.waitForTimeout(1200);
    await dismissToasts(page);
    await page.screenshot({ path: path.join(TARGET_DIR, 'cash-book.png') });
    await context.close();
  }

  // 6. Invoice Editor (Dark)
  console.log('Capturing invoice-editor-dark.png...');
  {
    const { page, context } = await createPage('dark');
    await page.click('button[aria-label="Edit"]');
    await page.waitForTimeout(1200);
    await dismissToasts(page);
    await page.screenshot({ path: path.join(TARGET_DIR, 'invoice-editor-dark.png') });
    await context.close();
  }

  // 7. Dashboard (Dark)
  console.log('Capturing dashboard-dark.png...');
  {
    const { page, context } = await createPage('dark');
    await dismissToasts(page);
    await page.screenshot({ path: path.join(TARGET_DIR, 'dashboard-dark.png') });
    await context.close();
  }

  // 8. Clients
  console.log('Capturing app-clients.png...');
  {
    const { page, context } = await createPage('light');
    await page.click('button:has-text("Clients")');
    await page.waitForTimeout(1000);
    await dismissToasts(page);
    await page.screenshot({ path: path.join(TARGET_DIR, 'app-clients.png') });
    await context.close();
  }

  // 9. Products
  console.log('Capturing app-products.png...');
  {
    const { page, context } = await createPage('light');
    await page.click('button:has-text("Products")');
    await page.waitForTimeout(1000);
    await dismissToasts(page);
    await page.screenshot({ path: path.join(TARGET_DIR, 'app-products.png') });
    await context.close();
  }

  // 10. Reports
  console.log('Capturing app-reports.png...');
  {
    const { page, context } = await createPage('light');
    await page.click('button:has-text("Reports")');
    await page.waitForTimeout(1000);
    await dismissToasts(page);
    await page.screenshot({ path: path.join(TARGET_DIR, 'app-reports.png') });
    await context.close();
  }

  // 11. Control Panel
  console.log('Capturing app-control-panel.png...');
  {
    const { page, context } = await createPage('light');
    await page.click('button:has-text("Control Panel")');
    await page.waitForTimeout(1000);
    await dismissToasts(page);
    await page.screenshot({ path: path.join(TARGET_DIR, 'app-control-panel.png') });
    await context.close();
  }

  await browser.close();
  console.log('All screenshots generated successfully!');
}

main().catch(console.error);
