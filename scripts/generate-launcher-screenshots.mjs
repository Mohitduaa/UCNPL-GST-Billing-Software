import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const ROOT = path.resolve('.');
const SVG_ICON = fs.readFileSync(path.join(ROOT, 'public/favicon.svg'), 'utf8');
const SVG_DATA_URI = 'data:image/svg+xml;base64,' + Buffer.from(SVG_ICON).toString('base64');

function generateHtml(state) {
  let stateContent = '';
  let height = 478;

  if (state === 'install') {
    height = 478;
    stateContent = `
      <div id="state" class="warn">
        <p id="stateTitle">Ready to install</p>
        <p id="stateBody">One click. It sets everything up and opens the app by itself &mdash; about a minute.</p>
      </div>
      <div id="primaryWrap">
        <button class="big">Install<span class="sub">Nothing to fill in</span></button>
      </div>
      <div style="margin-top: 18px;">
        <span id="moreToggle">More options &blacktriangledown;</span>
      </div>
    `;
  } else if (state === 'ready') {
    height = 455;
    stateContent = `
      <div id="state" class="ok">
        <p id="stateTitle">Ready</p>
        <p id="stateBody">Your app is installed. It opens in your browser.</p>
      </div>
      <div id="primaryWrap">
        <button class="big">Open App<span class="sub">Starts the app</span></button>
      </div>
      <div style="margin-top: 18px;">
        <span id="moreToggle">More options &blacktriangledown;</span>
      </div>
    `;
  } else if (state === 'zip') {
    height = 666;
    stateContent = `
      <div id="state" class="err">
        <p id="stateTitle">Please extract the ZIP first</p>
        <p id="stateBody">Windows opened this file straight out of the ZIP, so the rest of the app did not come with it.</p>
      </div>
      <div id="primaryWrap">
        <button class="big blue">Open my Downloads folder<span class="sub">The ZIP is in there</span></button>
      </div>
      <div id="steps">
        <ol>
          <li>Close this window.</li>
          <li>Right-click the <b>UCNPL-GST-Billing</b> ZIP and choose <b>Extract All&hellip;</b></li>
          <li>Open the new folder and double-click <b>UCNPL Billing - WINDOWS</b>.</li>
        </ol>
      </div>
      <div style="margin-top: 18px;">
        <span id="moreToggle">More options &blacktriangledown;</span>
      </div>
      <footer>
        <a href="#">Open this folder</a> &nbsp;&middot;&nbsp; <a href="#">Get help</a>
        <span id="where">C:\\Users\\HP\\AppData\\Local\\Temp\\Temp1_UCNPL-GST-Billing.zip\\UCNPL-GST-Billing</span>
      </footer>
    `;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 464px;
      height: ${height}px;
      background: #1c1c1a;
      color: #f5f4ee;
      font-family: "Segoe UI", Arial, sans-serif;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      user-select: none;
      -webkit-font-smoothing: antialiased;
    }

    /* Windows 11 Title Bar */
    .title-bar {
      height: 30px;
      background: #f3f3f3;
      border-bottom: 1px solid #e5e5e5;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 0 0 10px;
      flex-shrink: 0;
    }
    .title-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .title-icon {
      width: 16px;
      height: 16px;
      border-radius: 3px;
    }
    .title-text {
      font-size: 12px;
      color: #1a1a1a;
      font-weight: 400;
    }
    .title-controls {
      display: flex;
      height: 30px;
    }
    .win-btn {
      width: 46px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #1a1a1a;
      font-size: 10px;
    }
    .win-btn.close {
      font-size: 11px;
    }

    /* Launcher Content */
    .content {
      flex: 1;
      text-align: center;
      display: flex;
      flex-direction: column;
    }

    /* ---- brand ---- */
    #brand { padding: 30px 30px 0; }
    #brand .mark {
      width: 64px;
      height: 64px;
      border-radius: 15px;
      display: inline-block;
      box-shadow: 0 4px 16px rgba(201, 100, 66, 0.25);
    }
    h1 {
      margin: 14px 0 0;
      font-size: 27px;
      font-weight: 600;
      letter-spacing: -0.02em;
      color: #f5f4ee;
    }
    #tagline {
      margin: 5px 0 0;
      font-size: 13px;
      color: #a8a29e;
    }

    /* ---- what is going on ---- */
    #state { padding: 26px 34px 0; }
    #stateTitle {
      margin: 0;
      font-size: 19px;
      font-weight: 600;
      line-height: 1.35;
    }
    #stateBody {
      margin: 8px 0 0;
      font-size: 14px;
      line-height: 1.6;
      color: #d6d3d1;
    }
    #stateBody b { color: #fafaf9; font-weight: 600; }
    .ok   #stateTitle { color: #5ee9a0; }
    .warn #stateTitle { color: #fbbf24; }
    .err  #stateTitle { color: #fb7185; }

    /* ---- the one thing to click ---- */
    #primaryWrap { padding: 24px 34px 0; }
    .big {
      display: block;
      width: 100%;
      box-sizing: border-box;
      padding: 20px 16px;
      font-family: inherit;
      font-size: 19px;
      font-weight: 600;
      color: #fff;
      background: #16a34a;
      border: 0;
      border-radius: 13px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .big.blue { background: #c96442; }
    .big .sub {
      display: block;
      margin-top: 5px;
      font-size: 12.5px;
      font-weight: 400;
      color: #e0f5e8;
    }
    .big.blue .sub { color: #f4e3da; }

    /* ---- steps ---- */
    #steps {
      margin: 22px 34px 0;
      padding: 16px 18px;
      background: #262624;
      border: 1px solid #3a3935;
      border-radius: 12px;
      text-align: left;
      font-size: 13.5px;
      line-height: 1.75;
      color: #d6d3d1;
    }
    #steps b { color: #fafaf9; font-weight: 600; }
    #steps ol { margin: 0; padding-left: 20px; }
    #steps li { margin-bottom: 6px; }

    /* ---- everything else ---- */
    #moreToggle {
      display: inline-block;
      font-size: 13px;
      color: #e28e70;
      cursor: pointer;
    }

    /* ---- footer ---- */
    footer {
      margin-top: auto;
      padding: 12px 30px 14px;
      border-top: 1px solid #2d2c29;
      font-size: 11.5px;
      color: #8c8983;
    }
    footer a { color: #e28e70; text-decoration: none; }
    #where {
      display: block;
      margin-top: 6px;
      font-family: Consolas, "Courier New", monospace;
      font-size: 10px;
      color: #716e68;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="title-bar">
    <div class="title-left">
      <img class="title-icon" src="${SVG_DATA_URI}" alt="" />
      <span class="title-text">UCNPL Billing</span>
    </div>
    <div class="title-controls">
      <div class="win-btn">&minus;</div>
      <div class="win-btn">&#9633;</div>
      <div class="win-btn close">&#10005;</div>
    </div>
  </div>
  <div class="content">
    <div id="brand">
      <img class="mark" src="${SVG_DATA_URI}" alt="" />
      <h1>UCNPL Billing</h1>
      <p id="tagline">Offline &amp; private. Your invoices stay on this computer.</p>
    </div>
    ${stateContent}
  </div>
</body>
</html>`;
}

async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  
  const targets = [
    { state: 'install', filename: 'launcher-install.png', width: 464, height: 478 },
    { state: 'ready', filename: 'launcher-ready.png', width: 464, height: 455 },
    { state: 'zip', filename: 'launcher-zip.png', width: 464, height: 666 },
  ];

  for (const t of targets) {
    const context = await browser.newContext({
      viewport: { width: t.width, height: t.height },
      deviceScaleFactor: 1
    });
    const page = await context.newPage();
    const html = generateHtml(t.state);
    await page.setContent(html, { waitUntil: 'networkidle' });
    
    // Save to docs/screenshots/v1.10.69/
    const dest1 = path.join(ROOT, 'docs/screenshots/v1.10.69', t.filename);
    const dest2 = path.join(ROOT, 'docs-site/assets/img', t.filename);

    const buf = await page.screenshot({ type: 'png' });
    fs.writeFileSync(dest1, buf);
    fs.writeFileSync(dest2, buf);
    console.log(`Generated: ${t.filename} (${t.width}x${t.height}) -> saved to docs/screenshots and docs-site`);
    await context.close();
  }

  await browser.close();
  console.log('All launcher screenshots updated successfully.');
}

run().catch(console.error);
