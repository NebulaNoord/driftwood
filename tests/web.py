"""The Vercel build end to end against the local stand-in server: two anonymous players, a raid, saves, the player code, and the server's rules."""
from playwright.sync_api import sync_playwright
import json, time, subprocess, urllib.request
SETUP = open('tests/life.py').read().split('SETUP = r"""')[1].split('"""')[0]
TOWN = open('tests/mp.py').read().split('TOWN = """')[1].split('"""')[0]
srv = subprocess.Popen(['node', 'tests/webserver.js', '8787']); time.sleep(1.2)
URL = 'http://127.0.0.1:8787/'
stats = lambda: json.loads(urllib.request.urlopen(URL + '__stats').read())
errs = []
def page(pw, name, seed, key=None):
    b = pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width': 1100, 'height': 700}); ctx.route('**/fonts.g*/**', lambda r: r.abort())
    pg = ctx.new_page(); pg.set_default_timeout(180000); pg.on('pageerror', lambda e: errs.append(name + ': ' + str(e)))
    pg.add_init_script('(() => { let s = ' + str(seed) + '; Math.random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })()')
    if key: pg.add_init_script("localStorage.setItem('driftwood.playerKey', '%s')" % key)
    pg.goto(URL, wait_until='domcontentloaded', timeout=90000); pg.wait_for_timeout(3000)
    return b, pg
def api(pg, body): return pg.evaluate("(async b => { const r = await fetch('/api/db', { method: 'POST', headers: { 'content-type': 'application/json', 'x-player-key': window.claude.web.key() }, body: JSON.stringify(b) }); return [r.status, await r.json()]; })(%s)" % json.dumps(body))
try:
  with sync_playwright() as p:
    bA, A = page(p, 'A', 777); A.click('[data-m=start]'); A.evaluate("window.__dw.setSpeed(0)"); A.evaluate(SETUP)
    print('A built', A.evaluate(TOWN.replace("%s", "'watchtower', 'guardhouse'").replace("%d", "1800")))
    a_id = A.evaluate("window.__dw.Online.me"); print('A id', a_id, 'online', A.evaluate("window.__dw.Online.off"))
    A.evaluate("window.__dw.publishIsland(true)"); A.wait_for_timeout(1500)
    bB, B = page(p, 'B', 999); B.click('[data-m=start]'); B.evaluate("window.__dw.setSpeed(0)"); B.evaluate(SETUP)
    B.evaluate(TOWN.replace("%s", "'tavern'").replace("%d", "300")); B.evaluate("window.__dw.publishIsland(true)")
    b_id = B.evaluate("window.__dw.Online.me"); print('B id', b_id)
    print('store', stats())
    # the rules
    print('B writes A island', api(B, {'op': 'set', 'path': 'islands/' + a_id, 'data': {'name': 'hacked'}})[0])
    print('B reads A saves', api(B, {'op': 'list', 'coll': 'data/users/' + a_id})[0])
    print('B fakes a raid from A', api(B, {'op': 'add', 'coll': 'raids', 'data': {'attacker': a_id, 'target': b_id}})[0])
    print('no key', B.evaluate("fetch('/api/db', { method: 'POST', body: '{\"op\":\"me\"}' }).then(r => r.status)"))
    print('bad path', api(B, {'op': 'get', 'path': 'islands/../x'})[0], 'list lite has z?', 'z' in api(B, {'op': 'list', 'coll': 'islands'})[1]['docs'][0]['data'])
    # B browses and raids A
    B.wait_for_timeout(16000)
    B.click('[data-act=online]'); B.wait_for_timeout(1200); B.screenshot(path='shots/w1_panel.png')
    print('panel rows', B.evaluate("[...document.querySelectorAll('.isl b')].map(e => e.textContent).join(' | ')"))
    B.click(f'[data-ol="raid:{a_id}"]'); B.wait_for_timeout(800); B.click(f'[data-ol="go:{a_id}"]'); B.wait_for_timeout(5000)
    print('raiding', B.evaluate("[window.__dw.Online.mode, !!window.__dw.Online.raid, window.__dw.Online.target && window.__dw.Online.target.ghost]"))
    B.evaluate("window.__dw.Online.raid.time = 40")
    t0 = time.time()
    while B.evaluate("window.__dw.Online.raid && window.__dw.Online.raid.phase !== 'over'") and time.time() - t0 < 200:
        B.evaluate("""(() => { const r = window.__dw.Online.raid; if (!r) return; if (r.phase === 'go') { const o = (r.raiders[0] || {}).order || {}; if (!(o.kind === 'attack' && r.bLive(o.id))) { const c = r.centroid(); let best = null, bd = 1e9; for (const s of r.spots()) { const [x, z] = Sim.center(s.b), d = Math.hypot(x - c[0], z - c[1]) - s.loot * 0.05; if (d < bd) { bd = d; best = s; } } if (best) r.command({ kind: 'attack', id: best.b.id }); else r.command({ kind: 'bank' }); } } for (let k = 0; k < 40 && r.phase !== 'over'; k++) r.update(0.1); })()""")
        B.wait_for_timeout(800)
    B.wait_for_timeout(2000); print('result', B.evaluate("JSON.stringify(window.__dw.Online.result && window.__dw.Online.result.got)"))
    B.click('[data-ol=finish]'); B.wait_for_timeout(2500)
    print('raids stored', [k for k in stats()['keys'] if k.startswith('d:raids/')])
    ga = A.evaluate("window.__dw.S.gold"); A.wait_for_timeout(10000)
    print('A gold', round(ga), '->', round(A.evaluate("window.__dw.S.gold")), 'shield', A.evaluate("!!(window.__dw.S.mp && window.__dw.S.mp.shieldUntil > Date.now())"))
    A.screenshot(path='shots/w2_raided.png')
    # A saves privately, then moves to a new device with the player code
    A.evaluate("document.querySelectorAll('#modal [data-m], #modal [data-ol=close]').forEach(()=>0)")
    A.evaluate("window.__dw.openSaves ? 0 : 0")
    A.keyboard.press('Escape'); A.wait_for_timeout(300)
    A.click('[data-act=menu]'); A.wait_for_timeout(600); A.click('[data-m=saves]'); A.wait_for_timeout(2500)
    A.fill('#slotName', 'Fortress'); A.click('[data-ol=slotSave]'); A.wait_for_timeout(2000)
    A.screenshot(path='shots/w3_page.png')
    print('A cards', A.evaluate("[...document.querySelectorAll('.card-isl b')].map(e => e.textContent).join(' | ')"), 'note', A.evaluate("document.querySelector('.pg-head p').textContent"))
    key = A.evaluate("window.claude.web.key()"); nA = A.evaluate("window.__dw.S.b.length")
    bC, C = page(p, 'C', 31337)
    print('C new id', C.evaluate("window.__dw.Online.me") != a_id)
    C.click('#modal [data-m=saves]'); C.wait_for_timeout(2500); C.fill('#keyIn', key)
    C.on('framenavigated', lambda f: print('nav', f.url))
    C.click('[data-ol=keyUse]')
    for i in range(10):
        C.wait_for_timeout(1000)
        try: print('t', i, C.evaluate("[window.__dw && window.__dw.Online.me, document.readyState, (document.querySelector('#toast')||{}).textContent]"))
        except Exception as e: print('t', i, 'err', str(e)[:60])
    print('C after code', C.evaluate("window.__dw.Online.me") == a_id, 'buildings', C.evaluate("window.__dw.S.b.length"), 'expected', nA, 'name', C.evaluate("document.querySelector('#toast') && document.querySelector('#toast').textContent"))
    print('raf', C.evaluate("new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { if (++n < 10) requestAnimationFrame(f); else r(Math.round(performance.now() - t0)); }; requestAnimationFrame(f); setTimeout(() => r('stuck ' + n), 5000); })"))
    try: C.screenshot(path='shots/w4_switched.png', timeout=60000)
    except Exception as e: print('shot failed')
    print('store', stats()['stats'])
finally:
    srv.kill()
print('ERR', errs[:6])
