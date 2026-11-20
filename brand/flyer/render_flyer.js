// Render flyer-dark.html and flyer-light.html to print-ready PDFs (US Letter) and PNG previews.
// Run from the repo root after build_flyer.py:  node brand/flyer/render_flyer.js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: 2.5 });
  for (const name of ['dark', 'light']) {
    await p.goto('file://' + path.join(__dirname, `flyer-${name}.html`));
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(300);
    await p.pdf({ path: path.join(__dirname, `flyer-${name}.pdf`), width: '8.5in', height: '11in', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    await p.screenshot({ path: path.join(__dirname, `flyer-${name}.png`), fullPage: false });
    console.log('rendered', name);
  }
  await b.close();
})();
