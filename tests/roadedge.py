"""Modern roads sit exactly on their tiles: close-ups and a top-down view of buildings beside roads."""
from playwright.sync_api import sync_playwright
import sys
era = sys.argv[1] if len(sys.argv) > 1 else 'modern'
hour = float(sys.argv[2]) if len(sys.argv) > 2 else None
src = open('tests/gallery.py').read(); setup = src.split('out = pg.evaluate("""')[1].split('""", era)')[0]
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1200, 'height': 800}); pg.set_default_timeout(180000); pg.route('**/fonts.g*/**', lambda r: r.abort())
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
    pg.goto('file:///home/claude/colony/dist/test.html', wait_until='domcontentloaded', timeout=90000); pg.wait_for_timeout(3000)
    pg.click(f'[data-era={era}]'); pg.click('[data-m=start]'); pg.wait_for_timeout(1500); pg.evaluate("window.__dw.setSpeed(0)")
    print(pg.evaluate(setup, era)); pg.evaluate("window.__dw.setSpeed(0)")
    pg.evaluate("document.querySelectorAll('#goals,#chat,#hint,#dock').forEach(e => e.style.display = 'none')")
    if hour is not None: pg.evaluate(f"(() => {{ const S = window.__dw.S; S.t = Math.floor(S.t / 24) * 24 + {hour}; if (S.wx) {{ S.wx.now = {{ k: 'clear', from: S.t - 1, to: S.t + 8, wind: 0.2 }}; S.wx.q = []; }} }})()")
    for name, d, pitch, yaw in [('top', 22, 1.5, 0.0), ('close1', 11, 0.75, 0.7), ('close2', 11, 0.8, 3.6)]:
        pg.evaluate(f"""(() => {{ const c = window.__dw.cam, h = window.__dw.S.b.find(b => b.type === 'hall'), [x, z] = Sim.center(h); c.tx = x + 2; c.tz = z + 2; c.gdist = c.dist = {d}; c.gpitch = c.pitch = {pitch}; c.gyaw = c.yaw = {yaw}; }})()""")
        pg.wait_for_timeout(4000); pg.screenshot(path=f'shots/re_{era}_{name}' + (f'_h{int(hour)}' if hour is not None else '') + '.png')
    b.close()
print('ERR', errs[:5])
