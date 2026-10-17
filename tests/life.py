from playwright.sync_api import sync_playwright
URL = 'file:///home/claude/colony/dist/test.html'
errs = []
SETUP = r"""
(() => {
  const S = window.__dw.S, N = 96;
  S.wood = 9999; S.gold = 99999; S.stone = 9999;
  for (const k of Sim.BUILDABLE) S.goals['unlock_' + k] = 1;
  let seed = 11; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const conn = () => { const o = []; for (let c = 0; c < N*N; c++) if (S._conn[c]) o.push([c % N, (c / N) | 0]); return o; };
  const hall = S.b[0];
  for (let k = 0; k < 9; k++) { const rc = conn(); for (let a = 0; a < 80; a++) { const [i, j] = rc[Math.floor(rand()*rc.length)]; if (Math.hypot(i - hall.i, j - hall.j) > 12) continue; const d = Sim.DIRS[Math.floor(rand()*4)]; const cells = Sim.roadPath([i,j],[i+d[0]*7,j+d[1]*7]); const q = Sim.roadQuote(S, cells); if (q.n >= 5 && !q.blocked) { Sim.buildRoad(S, cells); break; } } }
  const placed = {};
  const tryPlace = (t, maxD) => { const rc = conn(); const s = Sim.TYPES[t].size; for (let a = 0; a < 1500; a++) { const [i,j] = rc[Math.floor(rand()*rc.length)]; if (Math.hypot(i - hall.i, j - hall.j) > maxD) continue; const o = [[1,0],[-s,0],[0,1],[0,-s]][Math.floor(rand()*4)]; const r = Sim.place(S, t, i+o[0], j+o[1], Math.floor(rand()*4)); if (r.building) { placed[t] = (placed[t]||0)+1; return r.building; } } return null; };
  for (let k = 0; k < 18; k++) tryPlace('house', 11);
  for (const t of ['market', 'tavern', 'garden', 'well', 'stable', 'orchard', 'farm', 'school', 'chapel', 'lumber']) tryPlace(t, 16);
  Sim.step(S, 2);
  return placed;
})()
"""
def shot(pg, name, wait=2500): pg.wait_for_timeout(wait); pg.screenshot(path=f'shots/{name}.png')
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1280, 'height': 800})
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
    pg.add_init_script('(() => { let s = 777; Math.random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })()')
    pg.goto(URL); pg.wait_for_timeout(2500)
    shot(pg, '80_intro', 100)
    pg.click('[data-m=start]'); pg.evaluate("window.__dw.setSpeed(0)")
    # construction scene first: place a tavern near the hall and look at it
    print('placed', pg.evaluate(SETUP))
    pg.evaluate("""(() => { const S = window.__dw.S, b = S.b.find(b => b.type === 'tavern') || S.b.find(b => !Sim.done(b)); const [x, z] = Sim.center(b); const c = window.__dw.cam; c.tx = x; c.tz = z; c.gdist = c.dist = 14; c.gpitch = c.pitch = 0.6; S.t = 9.5; window.__dw.setSpeed(1); })()""")
    shot(pg, '81_construction', 6000)
    # skip ahead a few days so the town fills up
    pg.evaluate("(() => { const S = window.__dw.S; window.__dw.setSpeed(0); for (let d = 0; d < 4 * 24 * 10; d++) { Sim.step(S, 0.1); if (S.meeting) Sim.meetingChoose(S, 'close'); } window.__dw.world.syncAgents(); })()")
    print('after 4 days', pg.evaluate("(() => { const S = window.__dw.S; return { day: Math.floor(S.t/24), pop: Sim.pop(S), happy: S.happy, rates: Object.fromEntries(Object.entries(S.rates).map(([k, v]) => [k, +v.net.toFixed(1)])), agents: window.__dw.world.agents.length }; })()"))
    pg.evaluate("""(() => { const S = window.__dw.S, h = S.b[0]; const [x, z] = Sim.center(h); const c = window.__dw.cam; c.tx = x; c.tz = z; c.gdist = c.dist = 24; c.gpitch = c.pitch = 0.72; S.t = Math.floor(S.t / 24) * 24 + 24 * 1 + 10.5; S.weather = 'sun'; window.__dw.setSpeed(1); })()""")
    shot(pg, '82_town_day', 9000)
    pg.evaluate("""(() => { const c = window.__dw.cam; c.gdist = 11; c.gpitch = 0.5; })()""")
    shot(pg, '83_close', 9000)
    # click a visible settler
    pos = pg.evaluate("""(() => { const W = window.__dw.world; const a = W.agents.find(a => !a.hidden && !a.waitUntil && !a.path && !a.temp) || W.agents.find(a => !a.hidden); if (!a) return null; const q = window.__dw.project(a.x, Math.max(Sim.groundAt(window.__dw.S, a.x, a.z), 0.3) + 0.3, a.z); return q; })()""")
    print('agent screen pos', pos)
    if pos:
        pg.evaluate("window.__dw.setSpeed(0)")
        pg.mouse.click(pos[0], pos[1]); pg.wait_for_timeout(800)
        print('card', pg.inner_text('#insp')[:200].replace('\n', ' | ') if pg.is_visible('#insp') else 'NO CARD')
        shot(pg, '84_card', 500)
        pg.keyboard.press('Escape')
    pg.click('#res'); pg.wait_for_timeout(500)
    print('stock', pg.inner_text('#stock')[:300].replace('\n', ' | '))
    shot(pg, '85_stock', 300)
    pg.click('#res')
    # rain
    pg.evaluate("(() => { const S = window.__dw.S; S.weather = 'rain'; const c = window.__dw.cam; c.gdist = 22; window.__dw.setSpeed(1); })()")
    shot(pg, '86_rain', 9000)
    # night at the tavern
    pg.evaluate("(() => { const S = window.__dw.S; S.weather = 'sun'; S.t = Math.floor(S.t / 24) * 24 + 19.6; const t = S.b.find(b => b.type === 'tavern'); if (t) { const [x, z] = Sim.center(t); const c = window.__dw.cam; c.tx = x; c.tz = z; c.gdist = 14; } })()")
    shot(pg, '87_evening', 9000)
    # sunday meeting
    pg.evaluate("(() => { const S = window.__dw.S; const day = Math.floor(S.t / 24); let d = day + 1; while (d % 7 !== 6) d++; S.t = d * 24 + 15.05; window.__dw.setSpeed(3); })()")
    for k in range(80):
        pg.wait_for_timeout(500)
        if pg.evaluate("!!document.querySelector('#modal.meet') && !document.querySelector('#modal').hidden"): break
    pg.wait_for_timeout(1500)
    print('meeting modal', pg.is_visible('.opts'), pg.evaluate("window.__dw.S.t % 24"))
    shot(pg, '88_meeting', 1500)
    opts = pg.evaluate("[...document.querySelectorAll('[data-meet]')].map(b => b.dataset.meet)")
    print('options', opts)
    if opts:
        pg.click(f'[data-meet="{opts[0]}"]'); pg.wait_for_timeout(800)
        print('after choose: meeting', pg.evaluate("window.__dw.S.meeting"), 'fx', pg.evaluate("JSON.stringify(window.__dw.S.fx)"), 'speed', pg.evaluate("window.__dw.UI.speed"))
    # save + reload keeps everything
    pg.evaluate("(() => { localStorage.setItem('driftwood.save.v1', JSON.stringify(Sim.serialize(window.__dw.S))); })()")
    n0 = pg.evaluate("window.__dw.S.b.length")
    pg.reload(); pg.wait_for_timeout(3000)
    print('reload buildings', n0, pg.evaluate("window.__dw.S.b.length"), 'agents', pg.evaluate("window.__dw.world.agents.length"))
    b.close()
print('ERRORS', errs[:10])
