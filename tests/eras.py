"""Eras: picking Modern on a new island, modern buildings and names, saves, and a modern raid on a computer island."""
from playwright.sync_api import sync_playwright
import json
SETUP = open('tests/life.py').read().split('SETUP = r"""')[1].split('"""')[0]
TOWN = open('tests/mp.py').read().split('TOWN = """')[1].split('"""')[0]
errs = []
def page(p, w=1280, h=800):
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': w, 'height': h}); pg.route('**/fonts.g*/**', lambda r: r.abort())
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script('(() => { let s = 4242; Math.random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })()')
    pg.goto('file:///home/claude/colony/dist/test.html', wait_until='domcontentloaded', timeout=90000); pg.wait_for_timeout(3000)
    return b, pg
with sync_playwright() as p:
    b, pg = page(p)
    pg.screenshot(path='shots/e0_picker.png')
    pg.click('[data-era=modern]'); pg.wait_for_timeout(500); print('picked', pg.evaluate("window.__dw.UI.eraPick"), pg.inner_text('#modal .btn.primary'))
    seed0 = pg.evaluate("window.__dw.S.seed")
    pg.click('[data-m=start]'); pg.wait_for_timeout(1500)
    print('era', pg.evaluate("[window.__dw.S.era, Sim.eraOf(window.__dw.S), window.__dw.S.seed === %d, Sim.TYPES.house.name, Sim.TYPES.hall.name, window.__dw.world.era]" % seed0))
    pg.evaluate("window.__dw.setSpeed(0)"); pg.evaluate(SETUP)
    print('town', pg.evaluate(TOWN.replace("%s", "'office', 'factory', 'store', 'market', 'tavern', 'clinic', 'school', 'apartment', 'guardhouse', 'watchtower', 'chapel', 'stable'").replace("%d", "3000")))
    pg.evaluate("(() => { const S = window.__dw.S; for (let k = 0; k < 24*6*10; k++) { Sim.step(S, 0.05); if (S.meeting) Sim.meetingChoose(S, 'close'); } S.t = Math.floor(S.t/24)*24 + 11; S.wx.now = { k: 'clear', from: S.t - 1, to: S.t + 8, wind: 0.2 }; S.wx.q = []; S._ev.length = 0; window.__dw.world.syncAgents(); })()")
    pg.evaluate("window.__dw.setSpeed(1)"); pg.wait_for_timeout(4000)
    for name, d, pitch in [('close', 15, 0.75), ('mid', 32, 0.85)]:
        pg.evaluate(f"(() => {{ const c = window.__dw.cam, h = window.__dw.S.b.find(b => b.type === 'hall'), [x, z] = Sim.center(h); c.tx = x; c.tz = z; c.gdist = c.dist = {d}; c.gpitch = c.pitch = {pitch}; }})()")
        pg.wait_for_timeout(5000); pg.screenshot(path=f'shots/e1_modern_{name}.png')
    print('news', pg.evaluate("window.__dw.S.news.slice(0, 3).map(n => n.text).join(' | ')"))
    print('medieval office?', pg.evaluate("(() => { const T = Sim.newGame(5, 'medieval'); return Sim.canPlace(T, 'office', 40, 40, 0).reason; })()"))
    # a modern save survives a reload, and the town stays modern
    s1 = pg.evaluate("JSON.stringify(Sim.serialize(window.__dw.S)).length"); print('save size', s1)
    print('reload keeps era', pg.evaluate("(() => { const T = Sim.deserialize(JSON.parse(JSON.stringify(Sim.serialize(window.__dw.S)))); return [T.era, Sim.eraOf(T)]; })()"),
          'old ages save', pg.evaluate("(() => { const o = Sim.serialize(window.__dw.S); o.era = 'ages'; o.age = 1; const a = Sim.deserialize(JSON.parse(JSON.stringify(o))).era; o.age = 0; return [a, Sim.deserialize(JSON.parse(JSON.stringify(o))).era]; })()"))
    print('picker cards', pg.evaluate("Sim.ERAS"))
    # a raid on a computer island in the modern era: tanks, armoured cars, rifles
    pg.evaluate("(() => { const A = Sim.army(window.__dw.S); A.n.inf = A.atk.inf = 4; A.n.cav = A.atk.cav = 2; A.n.can = A.atk.can = 1; })()")
    pg.click('[data-act=online]'); pg.wait_for_timeout(1500)
    print('rivals', pg.evaluate("[...document.querySelectorAll('.isl b')].map(e => e.textContent.trim()).join(' | ')"))
    pg.click('[data-ol^="rival:cove"]'); pg.wait_for_timeout(1500)
    go = pg.query_selector('[data-ol^="go:"]')
    if go: go.click()
    pg.wait_for_timeout(9000); pg.screenshot(path='shots/e4_modern_raid.png')
    print('raid', pg.evaluate("[window.__dw.Online.mode, window.__dw.Online.raid && window.__dw.Online.raid.raiders.length, window.__dw.world.cannon === window.__dw.world.mod.cannon]"))
    b.close()
print('ERR', errs[:6])
