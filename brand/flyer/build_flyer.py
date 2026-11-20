"""Build the Boston Drumming Co. QR-code flyer (US Letter) as HTML, in a dark and a light (ink-saver) version.

Run:  python3 brand/flyer/build_flyer.py      (needs: pip install qrcode)
Then: node brand/flyer/render_flyer.js        (makes the PDFs and PNGs with Playwright)
Change URL / PRICE_LINE below and re-run both to update the flyer.
"""
import pathlib
import qrcode
import qrcode.image.svg

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
URL = 'https://bostondrumming.com'
SHOWN_URL = 'bostondrumming.com'
PRICE_LINE = 'Lessons from <b>$20</b> &middot; Weekly plans save <b>10%</b>'

# QR code: high error correction so it still scans if the flyer gets creased or a corner is torn
qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, border=0, box_size=10)
qr.add_data(URL)
qr.make(fit=True)
n = qr.modules_count
cells = []
for y, row in enumerate(qr.modules):
    for x, on in enumerate(row):
        if on:
            cells.append(f'M{x} {y}h1v1h-1z')
QR_SVG = f'<svg viewBox="0 0 {n} {n}" shape-rendering="crispEdges" aria-label="QR code to {SHOWN_URL}"><path d="{"".join(cells)}" fill="#120c0c"/></svg>'

LOGO = (ROOT / 'brand' / 'logo-mark.svg').read_text()
FONTS = (ROOT / 'assets' / 'fonts').as_uri()

THEMES = {
    'dark': dict(bg='#120c0c', fg='#f7f1e8', muted='#c9bdb6', line='rgba(255,255,255,.14)', accent='#f97316', red='#ef4444', gold='#fbbf24',
                 card='rgba(255,255,255,.05)', glow='radial-gradient(120% 70% at 85% 105%, rgba(249,115,22,.55), transparent 60%), radial-gradient(90% 60% at 0% 100%, rgba(220,38,38,.45), transparent 60%)'),
    'light': dict(bg='#ffffff', fg='#1d1515', muted='#5f5452', line='#e2d9d6', accent='#c2410c', red='#dc2626', gold='#b45309',
                  card='#faf6f4', glow='none'),
}

TAB = f'<div class="tab"><b>{SHOWN_URL}</b><span>Drum lessons · from $20</span></div>'

PAGE = """<!doctype html><html><head><meta charset="utf-8"><title>Boston Drumming Co. flyer</title>
<style>
@font-face {{ font-family: 'Instrument Serif'; src: url({fonts}/instrument-serif-latin-400-normal.woff2) format('woff2'); font-style: normal; }}
@font-face {{ font-family: 'Instrument Serif'; src: url({fonts}/instrument-serif-latin-400-italic.woff2) format('woff2'); font-style: italic; }}
@font-face {{ font-family: 'Plus Jakarta Sans'; src: url({fonts}/plus-jakarta-sans-latin-400-normal.woff2) format('woff2'); font-weight: 400; }}
@font-face {{ font-family: 'Plus Jakarta Sans'; src: url({fonts}/plus-jakarta-sans-latin-600-normal.woff2) format('woff2'); font-weight: 600; }}
@font-face {{ font-family: 'Plus Jakarta Sans'; src: url({fonts}/plus-jakarta-sans-latin-800-normal.woff2) format('woff2'); font-weight: 800; }}
@page {{ size: 8.5in 11in; margin: 0; }}
:root {{ --bg:{bg}; --fg:{fg}; --muted:{muted}; --line:{line}; --accent:{accent}; --red:{red}; --gold:{gold}; --card:{card}; }}
* {{ box-sizing: border-box; }}
html, body {{ margin: 0; }}
body {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
.page {{ width: 8.5in; height: 11in; position: relative; overflow: hidden; background: var(--bg); color: var(--fg);
  font-family: 'Plus Jakarta Sans', Helvetica, Arial, sans-serif; display: grid; grid-template-rows: 1fr auto; }}
.page::before {{ content: ""; position: absolute; inset: 0; background: {glow}; pointer-events: none; }}
.main {{ position: relative; padding: .5in .65in .25in; display: grid; grid-template-rows: auto auto 1fr auto; gap: .16in; min-height: 0; }}
.brand {{ display: flex; align-items: center; gap: .18in; }}
.brand svg {{ width: .78in; height: .78in; }}
.brand .name {{ font-weight: 800; letter-spacing: .22em; font-size: 15pt; color: var(--red); }}
.brand .tag {{ font-size: 11pt; color: var(--muted); margin-top: 2pt; }}
h1 {{ font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; font-size: 58pt; line-height: .92; margin: 0; letter-spacing: -.01em; }}
h1 em {{ color: var(--gold); }}
.lede {{ font-size: 15.5pt; line-height: 1.35; margin: .1in 0 0; max-width: 6.8in; }}
.lede b {{ font-weight: 800; }}
.row {{ display: grid; grid-template-columns: 1fr 2.75in; gap: .4in; align-items: center; }}
ul {{ list-style: none; margin: 0; padding: 0; display: grid; gap: .13in; font-size: 14pt; line-height: 1.28; }}
li {{ display: grid; grid-template-columns: .3in 1fr; align-items: start; }}
li::before {{ content: ""; width: .15in; height: .15in; margin-top: .06in; border-radius: 50%; background: linear-gradient(135deg, var(--red), var(--gold)); }}
li small {{ display: block; color: var(--muted); font-size: 11.5pt; }}
.qr {{ background: #fff; border-radius: .2in; padding: .2in .2in .16in; text-align: center; color: #120c0c;
  box-shadow: 0 0 0 .05in rgba(249,115,22,.9), 0 .15in .4in rgba(0,0,0,.35); }}
.qr svg {{ width: 2.2in; height: 2.2in; display: block; margin: 0 auto; }}
.qr .scan {{ font-weight: 800; letter-spacing: .14em; font-size: 13pt; margin-top: .12in; color: #c2410c; }}
.qr .url {{ font-weight: 600; font-size: 13pt; margin-top: 2pt; }}
.price {{ display: flex; flex-wrap: wrap; justify-content: space-between; gap: .1in .3in; align-items: center;
  border-top: 1.5pt solid var(--line); padding-top: .18in; font-size: 13pt; }}
.price .main-price {{ font-size: 16pt; }}
.price b {{ color: var(--accent); }}
.price .soon {{ color: var(--muted); }}
.tabs {{ position: relative; display: grid; grid-template-columns: repeat(8, 1fr); height: 1.75in; padding-bottom: .28in; /* home printers can't print the last ~1/4 inch */ border-top: 1.5pt dashed var(--muted); }}
.tab {{ border-left: 1pt dashed var(--muted); display: flex; flex-direction: column; justify-content: center; align-items: center;
  writing-mode: vertical-rl; transform: rotate(180deg); gap: 3pt; padding: .1in 0; }}
.tab:last-child {{ border-right: 0; }}
.tab:first-child {{ border-left: 0; }}
.tab b {{ font-size: 8.5pt; font-weight: 800; white-space: nowrap; }}
.tab span {{ font-size: 7pt; color: var(--muted); white-space: nowrap; }}
.cut {{ position: absolute; top: -9pt; left: .3in; font-size: 8pt; color: var(--muted); background: var(--bg); padding: 0 4pt; }}
</style></head><body><div class="page">
  <div class="main">
    <div class="brand">{logo}<div><div class="name">BOSTON DRUMMING CO.</div><div class="tag">Drumline coaching &middot; Learn. Practice. Play.</div></div></div>
    <div>
      <h1>Learn.<br>Practice.<br><em>Play.</em></h1>
      <p class="lede"><b>Online drumline lessons</b> for snare, tenors, bass and cymbals. One&#8209;on&#8209;one over Zoom or FaceTime.</p>
    </div>
    <div class="row">
      <ul>
        <li><span>Beginners to audition prep<small>Technique, reading, cadences, tryouts</small></span></li>
        <li><span>A practice pad is all you need<small>Lessons from anywhere, at home</small></span></li>
        <li><span>Weekday evenings &amp; weekends<small>Pick your time online</small></span></li>
        <li><span>Book in under a minute<small>Pay securely online</small></span></li>
      </ul>
      <div class="qr">{qr}<div class="scan">SCAN TO BOOK</div><div class="url">{shown}</div></div>
    </div>
    <div class="price"><span class="main-price">{price}</span><span class="soon">In-person lessons in Chicagoland coming soon</span></div>
  </div>
  <div class="tabs"><span class="cut">✂ tear off</span>{tabs}</div>
</div></body></html>
"""

for name, t in THEMES.items():
    html = PAGE.format(fonts=FONTS, logo=LOGO, qr=QR_SVG, shown=SHOWN_URL, price=PRICE_LINE, tabs=TAB * 8, **t)
    (HERE / f'flyer-{name}.html').write_text(html)
    print('wrote', HERE / f'flyer-{name}.html', f'(QR {n}x{n} modules)')
