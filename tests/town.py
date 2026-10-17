from playwright.sync_api import sync_playwright
URL = 'file:///home/claude/colony/dist/test.html'
errs = []
BOT = r"""
(() => {
  const S = window.__dw.S, N = 96;
  S.gold = 99999; S.wood = 9999; S.stone = 9999; S.food = 2000;
  for (const k of ['market','well','quarry','chapel','port','lighthouse']) S.goals['unlock_' + k] = 1;
  let seed = 7; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const conn = () => { const o = []; for (let c = 0; c < N*N; c++) if (S._conn[c]) o.push([c % N, (c / N) | 0]); return o; };
  const ext = (len) => { const rc = conn(); for (let a = 0; a < 80; a++) { const [i, j] = rc[Math.floor(rand() * rc.length)]; const d = Sim.DIRS[Math.floor(rand() * 4)];
      const cells = Sim.roadPath([i, j], [i + d[0]*len, j + d[1]*len]); const q = Sim.roadQuote(S, cells); if (q.n >= len*0.8 && !q.blocked) { Sim.buildRoad(S, cells); return true; } } return false; };
  const near = (type, maxDist) => { const rc = conn(); const hall = S.b[0];
    for (let a = 0; a < 3000; a++) { const [ri, rj] = rc[Math.floor(rand() * rc.length)]; if (Math.hypot(ri - hall.i, rj - hall.j) > maxDist) continue; const s = Sim.TYPES[type].size;
      const offs = [[1,0],[-s,0],[0,1],[0,-s]]; const [oi, oj] = offs[Math.floor(rand()*4)]; const r = Sim.place(S, type, ri+oi, rj+oj, Math.floor(rand()*4)); if (r.building) return r.building; } return null; };
  const coast = (type) => { const hall = S.b[0]; let best = null, bd = 1e9;
    for (let j = 2; j < N-3; j++) for (let i = 2; i < N-3; i++) { const c = Sim.canPlace(S, type, i, j, 0); if (!c.ok) continue;
      const nr = Sim.around({type, i, j, rot: c.rot}).some(([x,y]) => S._conn[y*N+x]); if (!nr) continue; const d = Math.hypot(i - hall.i, j - hall.j); if (d < bd) { bd = d; best = [i, j, c.rot]; } }
    return best ? Sim.place(S, type, best[0], best[1], best[2]).building : null; };
  for (let k = 0; k < 10; k++) ext(6 + Math.floor(rand()*4));
  const got = {};
  for (let k = 0; k < 16; k++) if (near('house', 14)) got.house = (got.house||0)+1;
  for (const t of ['market', 'well', 'chapel', 'farm', 'lumber', 'quarry']) got[t] = !!near(t, t === 'quarry' ? 60 : 20);
  for (const t of ['dock', 'port', 'lighthouse']) { if (!coast(t)) { for (let k = 0; k < 6; k++) ext(8); got[t] = !!coast(t); } else got[t] = true; }
  return got;
})()
"""
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1280, 'height': 800})
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.goto(URL); pg.wait_for_timeout(2500); pg.click('[data-m=start]')
    pg.evaluate("window.__dw.setSpeed(0)")
    print('placed', pg.evaluate(BOT))
    pg.evaluate("(() => { const S = window.__dw.S; for (let d = 0; d < 6; d++) { Sim.step(S, 24); } })()")
    print(pg.evaluate("(() => { const S = window.__dw.S; return { pop: Sim.pop(S), levels: S.b.filter(b => b.type === 'house').map(b => b.level).join(''), happy: S.happy, statuses: S.b.map(b => b.type[0] + (b.status||'')).join(' ') }; })()"))
    pg.evaluate("(() => { const S = window.__dw.S; const h = S.b[0]; const [x, z] = Sim.center(h); const c = window.__dw.cam; c.tx = x; c.tz = z; c.gdist = 30; c.gpitch = 0.75; S.t = Math.floor(S.t / 24) * 24 + 11; window.__dw.setSpeed(1); })()")
    pg.wait_for_timeout(5000)
    pg.screenshot(path='shots/20_town_day.png')
    pg.evaluate("(() => { const c = window.__dw.cam; c.gdist = 15; c.gpitch = 0.6; c.gyaw += 0.8; })()")
    pg.wait_for_timeout(3000)
    pg.screenshot(path='shots/21_town_close.png')
    pg.evaluate("(() => { const S = window.__dw.S; S.t = Math.floor(S.t / 24) * 24 + 21; const c = window.__dw.cam; c.gdist = 30; c.gpitch = 0.75; })()")
    pg.wait_for_timeout(3500)
    pg.screenshot(path='shots/22_town_night.png')
    for t in ['port', 'lighthouse', 'dock', 'farm', 'quarry']:
        ok = pg.evaluate(f"(() => {{ const S = window.__dw.S; const b = S.b.find(b => b.type === '{t}'); if (!b) return false; const [x, z] = Sim.center(b); const c = window.__dw.cam; c.tx = x; c.tz = z; c.gdist = 14; c.gpitch = 0.6; S.t = Math.floor(S.t / 24) * 24 + 33.5; return true; }})()")
        if ok: pg.wait_for_timeout(2500); pg.screenshot(path=f'shots/23_{t}.png')
    b.close()
print('ERRORS', errs[:10])
