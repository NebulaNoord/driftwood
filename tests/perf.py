"""How much JavaScript time a frame costs in a busy town (the drawing itself depends on the graphics card)."""
from playwright.sync_api import sync_playwright
import sys
src = open('tests/gallery.py').read(); setup = src.split('out = pg.evaluate("""')[1].split('""", era)')[0]
with sync_playwright() as p:
    for era in ['medieval', 'modern']:
        b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = b.new_context(viewport={'width': 1200, 'height': 800}).new_page(); pg.set_default_timeout(180000); pg.route('**/fonts.g*/**', lambda r: r.abort())
        pg.goto('file:///home/claude/colony/dist/test.html', wait_until='domcontentloaded', timeout=90000); pg.wait_for_timeout(3000)
        pg.click(f'[data-era={era}]'); pg.click('[data-m=start]'); pg.wait_for_timeout(1500); pg.evaluate("window.__dw.setSpeed(0)")
        pg.evaluate(setup, era)
        for k in range(20): pg.evaluate("(() => { const W = window.__dw.world, S = window.__dw.S; for (let i = 0; i < 6; i++) { Sim.step(S, 0.02); W.update(0.25, 0.02); } })()")
        print(era, pg.evaluate("""(() => { const W = window.__dw.world, S = window.__dw.S, cam = window.__dw.cam; const h = S.b.find(b => b.type === 'hall'), [x, z] = Sim.center(h); cam.tx = x; cam.tz = z; cam.gdist = cam.dist = 30;
          let up = 0, n = 30; for (let i = 0; i < n; i++) { const t0 = performance.now(); Sim.step(S, 0.01); W.update(1 / 60, 0.01); up += performance.now() - t0; }
          const st = W.streets || {}; return { updateMs: +(up / n).toFixed(2), buildings: S.b.length, agents: W.agents.length, vehicles: (W.vehicles || []).length, lamps: (st.lamps || []).length, trees: (st.trees || []).length, signals: (st.tl || []).length }; })()"""))
        # time whole frames with the renderer included
        print(era, 'frame ms', pg.evaluate("""new Promise(r => { const ts = []; let last = performance.now(), n = 0; const f = () => { const now = performance.now(); ts.push(now - last); last = now; if (++n < 12) requestAnimationFrame(f); else r(ts.slice(2).reduce((a, b) => a + b, 0) / (ts.length - 2)); }; requestAnimationFrame(f); })"""))
        b.close()
