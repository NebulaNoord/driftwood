"""Sound channels: measures each bus (music / world / effects) with analysers in a few situations, and checks the Sound panel."""
from playwright.sync_api import sync_playwright
import subprocess, time
srv = subprocess.Popen(['node', 'tests/webserver.js', '8791']); time.sleep(1)
errs = []
TAP = """(() => { const X = window.__dw, c = X.Sfx.ctx; window.__an = {};
  for (const [k, node] of [['music', X.Music.bus], ['world', X.Sfx.world], ['fx', X.Sfx.master]]) { const a = c.createAnalyser(); a.fftSize = 2048; node.connect(a); window.__an[k] = a; } })()"""
RMS = """new Promise(r => { const out = {}, n = {}; let i = 0; const buf = new Float32Array(2048);
  const tick = () => { for (const k in window.__an) { window.__an[k].getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; out[k] = (out[k] || 0) + s / buf.length; } if (++i < 30) setTimeout(tick, 100); else { for (const k in out) out[k] = +(10 * Math.log10(out[k] / 30 + 1e-12)).toFixed(1); r(out); } }; tick(); })"""
try:
  with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 1100, 'height': 700}); pg.route('**/fonts.g*/**', lambda r: r.abort())
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8791/', wait_until='domcontentloaded'); pg.wait_for_timeout(3000)
    pg.click('[data-m=start]'); pg.wait_for_timeout(5000); pg.evaluate(TAP)
    def at(label, js, wait=4000):
        if js: pg.evaluate(js)
        pg.wait_for_timeout(wait); print(f'{label:28s}', pg.evaluate(RMS), 'dB')
    at('day, default view', "window.__dw.S.t = Math.floor(window.__dw.S.t/24)*24 + 11; window.__dw.S.weather = 'sun'")
    at('day, zoomed right in', "window.__dw.cam.gdist = 10")
    at('day, zoomed far out', "window.__dw.cam.gdist = 100")
    at('rain, zoomed out', "window.__dw.S.weather = 'rain'")
    at('night, mid zoom', "window.__dw.S.weather = 'sun'; window.__dw.cam.gdist = 30; window.__dw.S.t = Math.floor(window.__dw.S.t/24)*24 + 23")
    at('world slider 0', "window.__dw.UI.world = 0; window.__dw.Sfx.levels()", 2500)
    at('music slider 0', "window.__dw.UI.world = 0.7; window.__dw.Sfx.levels(); window.__dw.UI.music = 0", 2500)
    # effects: play a sound right before measuring
    pg.evaluate("window.__dw.UI.music = 0.5; window.__dw.UI.fx = 0.7; window.__dw.Sfx.levels()"); pg.wait_for_timeout(1500)
    print('fx while building', pg.evaluate("(async () => { const X = window.__dw; const p = " + RMS + "; for (let i = 0; i < 6; i++) setTimeout(() => X.Sfx.play('build'), i * 450); return p; })()"))
    pg.evaluate("window.__dw.UI.fx = 0; window.__dw.Sfx.levels()"); pg.wait_for_timeout(800)
    print('fx slider 0, building', pg.evaluate("(async () => { const X = window.__dw; const p = " + RMS + "; for (let i = 0; i < 6; i++) setTimeout(() => X.Sfx.play('build'), i * 450); return p; })()"))
    pg.evaluate("window.__dw.UI.fx = 0.7; window.__dw.Sfx.levels()")
    # the panel
    pg.click('[data-act=menu]'); pg.wait_for_selector('[data-m=sound]'); pg.click('[data-m=sound]'); pg.wait_for_selector('#vol-world'); pg.wait_for_timeout(1200)
    pg.screenshot(path='shots/snd1_panel.png')
    pg.fill('#vol-world', '35'); pg.dispatch_event('#vol-world', 'change'); pg.fill('#vol-fx', '0'); pg.dispatch_event('#vol-fx', 'change'); pg.wait_for_timeout(500)
    print('panel', pg.inner_text('#pct-world'), pg.inner_text('#pct-fx'), pg.evaluate("[window.__dw.UI.world, window.__dw.UI.fx]"))
    pg.click('[data-m=menu]'); pg.wait_for_timeout(800); print('back to menu', pg.evaluate("!!document.querySelector('[data-m=sound]')"))
    pg.reload(); pg.wait_for_timeout(2500); print('kept after reload', pg.evaluate("[window.__dw.UI.music, window.__dw.UI.world, window.__dw.UI.fx]"))
    b.close()
finally: srv.kill()
print('ERR', errs[:5])
