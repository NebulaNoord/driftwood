"""Two players in separate browsers sharing one mock store: A builds and shares, B visits and raids, A gets the report."""
from playwright.sync_api import sync_playwright
import json, time
SETUP = open('tests/life.py').read().split('SETUP = r"""')[1].split('"""')[0]
STORE = {}
def store(raw):
    a = json.loads(raw); op = a['op']
    if op == 'get': return json.dumps({'exists': True, 'data': STORE[a['path']]} if a['path'] in STORE else {'exists': False})
    if op == 'set': STORE[a['path']] = a['data']; return '{}'
    if op == 'delete': STORE.pop(a['path'], None); return '{}'
    if op == 'list': return json.dumps([{'id': p.rsplit('/', 1)[1], 'data': d} for p, d in STORE.items() if p.rsplit('/', 1)[0] == a['coll']])
errs = []
def page(pw, uid, seed):
    b = pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width': 1100, 'height': 700})
    ctx.route('**/fonts.g*/**', lambda r: r.abort()); pg = ctx.new_page(); pg.expose_function('__mockStore', store)
    pg.on('pageerror', lambda e: errs.append(uid + ': ' + str(e)))
    pg.add_init_script('(() => { let s = ' + str(seed) + '; Math.random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })()')
    pg.goto(f'file:///home/claude/colony/dist/mp.html?uid={uid}' + ('&can=0' if uid == 'player-two' else ''), wait_until='domcontentloaded', timeout=90000); pg.wait_for_timeout(2500)
    pg.click('[data-m=start]'); pg.evaluate("window.__dw.setSpeed(0)")
    return pg
TOWN = """(() => { const S = window.__dw.S, N = 96; let seed = 5; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const conn = () => { const o = []; for (let c = 0; c < N*N; c++) if (S._conn[c]) o.push([c % N, (c / N) | 0]); return o; };
  const place = t => { const rc = conn(), s = Sim.TYPES[t].size; for (let a = 0; a < 2000; a++) { const [i,j] = rc[Math.floor(rand()*rc.length)]; const o = [[1,0],[-s,0],[0,1],[0,-s]][Math.floor(rand()*4)]; const r = Sim.place(S, t, i+o[0], j+o[1], Math.floor(rand()*4)); if (r.building) return r.building.type; } return 'fail:' + t; };
  const out = [%s].map(place); for (const b of S.b) b.build = 1;
  for (let k = 0; k < 24 * 10 * 2; k++) { Sim.step(S, 0.05); if (S.meeting) Sim.meetingChoose(S, 'close'); }
  S.gold = %d; S.wood = 500; S.stone = 300; window.__dw.world.syncAgents(); return out.join(','); })()"""
with sync_playwright() as p:
    A = page(p, 'player-one', 777); A.evaluate(SETUP)
    print('A built', A.evaluate(TOWN.replace("%s", "'watchtower', 'guardhouse'").replace("%d", "1800")))
    A.evaluate("window.__dw.publishIsland(true)"); A.wait_for_timeout(1500)
    B = page(p, 'player-two', 999); B.evaluate(SETUP)
    print('B built', B.evaluate(TOWN.replace("%s", "'tavern'").replace("%d", "300")))
    B.evaluate("window.__dw.publishIsland(true)"); B.wait_for_timeout(1500)
    print('store', sorted(STORE.keys()), 'A pop', STORE['islands/player-one']['pop'], 'size', len(json.dumps(STORE['islands/player-one'])))
    # B opens the islands panel
    B.click('[data-act=online]'); B.wait_for_timeout(1200); B.screenshot(path='shots/mp1_panel.png')
    print('panel rows', B.evaluate("[...document.querySelectorAll('.isl b')].map(e => e.textContent).join(' | ')"))
    print('B note', B.evaluate("(document.querySelector('.ol-note') || {}).textContent"))
    # visit A
    B.click('[data-ol="visit:player-one"]'); B.wait_for_timeout(5000); B.screenshot(path='shots/mp2_visit.png')
    print('visiting', B.evaluate("[window.__dw.Online.mode, window.__dw.S.b.length, window.__dw.Online.home.b.length]"))
    # raid from the visit banner
    B.click('#away [data-ol=raidHere]'); B.wait_for_timeout(800); B.screenshot(path='shots/g3_confirm.png'); print('ghost note', B.evaluate("[...document.querySelectorAll('#modal .lead')].map(e => e.textContent).filter(t => t.includes('Ghost')).join('')"))
    B.click('[data-ol="go:player-one"]'); B.wait_for_timeout(5000); B.screenshot(path='shots/mp4_landing.png')
    B.evaluate("window.__dw.Online.raid.time = 60")
    # play: plunder the nearest building, by tapping it on screen
    t0 = time.time(); shots = 0
    while B.evaluate("window.__dw.Online.raid && window.__dw.Online.raid.phase !== 'over'") and time.time() - t0 < 240:
        B.evaluate("""(() => { const O = window.__dw.Online, r = O.raid; if (!r) return; if (r.phase === 'go') { const o = (r.raiders[0] || {}).order || {}; if (!(o.kind === 'attack' && r.bLive(o.id))) {
          const c = r.centroid(); let best = null, bd = 1e9; for (const s of r.spots()) { const [x, z] = Sim.center(s.b), d = Math.hypot(x - c[0], z - c[1]) - s.loot * 0.05; if (d < bd) { bd = d; best = s; } }
          if (!best) { r.command({ kind: 'bank' }); } else { const [x, z] = Sim.center(best.b); const q = window.__dw.project(x, best.b.y + 0.3, z); const h = window.__dw.pick(q[0], q[1]); window.__dw.raidTap(q, h); } } } for (let k = 0; k < 40 && r.phase !== 'over'; k++) r.update(0.1); })()""")
        B.wait_for_timeout(1500)
        if shots < 3 and time.time() - t0 > 12 + shots * 14: B.screenshot(path=f'shots/mp5_raid{shots}.png'); shots += 1
    B.wait_for_timeout(2500); B.screenshot(path='shots/mp6_result.png')
    res = B.evaluate("JSON.stringify(window.__dw.Online.result)"); print('result', res)
    g0 = B.evaluate("window.__dw.Online.home.gold")
    B.click('[data-ol=finish]'); B.wait_for_timeout(2500)
    print('B home', B.evaluate("[window.__dw.Online.mode, Math.round(window.__dw.S.gold)]"), 'was', round(g0))
    print('raids', [ (k, v['loot']) for k, v in STORE.items() if k.startswith('raids/')])
    ga = A.evaluate('window.__dw.S.gold'); A.wait_for_timeout(3000); print('A gold unchanged', round(ga), round(A.evaluate('window.__dw.S.gold')), 'burnt', A.evaluate("window.__dw.S.b.filter(b => b.burnt).length"))
    B.click('[data-act=online]'); B.wait_for_timeout(1500); print('B sees', B.evaluate("[...document.querySelectorAll('[data-ol^=\"raid:\"]')].map(e => e.textContent).join(' | ')"))
print('ERR', errs[:6])
