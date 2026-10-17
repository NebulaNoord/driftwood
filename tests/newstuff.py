from playwright.sync_api import sync_playwright
import json, sys
SETUP = open('tests/life.py').read().split('SETUP = r"""')[1].split('"""')[0]
EXTRA = r"""(() => {
  const S = window.__dw.S, N = 96, hall = S.b[0];
  let seed = 23; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const conn = () => { const o = []; for (let c = 0; c < N*N; c++) if (S._conn[c]) o.push([c % N, (c / N) | 0]); return o; };
  for (let k = 0; k < 8; k++) { const rc = conn(); for (let a = 0; a < 200; a++) { const [i, j] = rc[Math.floor(rand()*rc.length)]; if (Math.hypot(i - hall.i, j - hall.j) > 18) continue; const d = Sim.DIRS[Math.floor(rand()*4)]; const cells = Sim.roadPath([i,j],[i+d[0]*7,j+d[1]*7]); const q = Sim.roadQuote(S, cells); if (q.n >= 5 && !q.blocked) { Sim.buildRoad(S, cells); break; } } }
  const placed = {}, fail = [];
  const tryPlace = (t, maxD) => { const rc = conn(); const s = Sim.TYPES[t].size; let last; for (let a = 0; a < 3000; a++) { const [i,j] = rc[Math.floor(rand()*rc.length)]; if (Math.hypot(i - hall.i, j - hall.j) > maxD) continue; const o = [[1,0],[-s,0],[0,1],[0,-s]][Math.floor(rand()*4)]; const r = Sim.place(S, t, i+o[0], j+o[1], Math.floor(rand()*4)); if (r.building) { placed[t] = (placed[t]||0)+1; return r.building; } last = r.error || r.reason; } fail.push(t + ':' + last); return null; };
  const tryCoastal = (t) => { for (let j = 2; j < N - 3; j++) for (let i = 2; i < N - 3; i++) { const c = Sim.canPlace(S, t, i, j, 0); if (!c.ok) continue; if (Sim.inB(i, j) && false) continue; if (!Sim.around({ type: t, i, j, rot: c.rot }).some(([x, y]) => S._conn[Sim.ci(x, y)])) continue; const r = Sim.place(S, t, i, j, c.rot); if (r.building) { placed[t] = 1; return r.building; } } for (let j = 2; j < N - 3; j++) for (let i = 2; i < N - 3; i++) { const c = Sim.canPlace(S, t, i, j, 0); if (c.ok) { placed[t] = 'far'; return Sim.place(S, t, i, j, c.rot).building; } } fail.push(t); return null; };
  for (const t of ['fishhut', 'fishhut', 'rowhouse', 'rowhouse', 'villa', 'apartment', 'bakery', 'sawmill', 'blacksmith', 'plaza', 'clinic', 'library', 'school', 'academy']) tryPlace(t, t === 'fishhut' ? 30 : 20);
  tryPlace('mine', 40); tryCoastal('shipyard'); tryCoastal('dock');
  // quay: shore cells next to the network near the pier
  const pier = S.b.find(b => b.type === 'pier'); const [px, pz] = Sim.center(pier);
  const ok = (i, j) => Sim.inB(i, j) && !Sim.roadOk(S, i, j, 4) && Sim.cellH(S, i, j) > -0.6;
  let start = null;
  for (let r = 1; r < 20 && !start; r++) for (let dj = -r; dj <= r && !start; dj++) for (let di = -r; di <= r && !start; di++) { const i = pier.i + di, j = pier.j + dj; if (ok(i, j) && Sim.DIRS.some(([a, b]) => Sim.inB(i+a, j+b) && S._conn[Sim.ci(i+a, j+b)])) start = [i, j]; }
  const q = []; if (start) { const seen = new Set([start.join()]); const qq = [start]; while (qq.length && q.length < 14) { const c = qq.shift(); q.push(c); for (const [a, b] of Sim.DIRS) { const n = [c[0]+a, c[1]+b]; if (!seen.has(n.join()) && ok(...n)) { seen.add(n.join()); qq.push(n); } } } }
  const rq = Sim.buildRoad(S, q, 4);
  // cobble over a stretch of road near the hall, and a footpath spur
  const rc = conn().filter(([i, j]) => S.road[Sim.ci(i, j)] === 1 && Math.hypot(i - hall.i, j - hall.j) < 9);
  const rcb = Sim.buildRoad(S, rc.slice(0, 22), 3);
  let rp = null; for (let a = 0; a < 200 && !rp; a++) { const rr = conn(); const [i, j] = rr[Math.floor(rand()*rr.length)]; const d = Sim.DIRS[Math.floor(rand()*4)]; const cells = Sim.roadPath([i,j],[i+d[0]*5,j+d[1]*5]); const qt = Sim.roadQuote(S, cells, 2); if (qt.n >= 4 && !qt.blocked) rp = Sim.buildRoad(S, cells, 2); }
  const up = Sim.upgradePier(S);
  for (const b of S.b) b.build = 1;
  Sim.step(S, 1);
  return { placed, fail, quay: q.length, rq, rcb, rp, up, roads: [1,2,3,4].map(t => S.road.filter(x => x === t).length) };
})()"""
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1100, 'height': 700})
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
    pg.add_init_script('(() => { let s = 777; Math.random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })()')
    pg.goto('file:///home/claude/colony/dist/test.html'); pg.wait_for_timeout(2500)
    pg.click('[data-m=start]'); pg.evaluate("window.__dw.setSpeed(0)")
    pg.evaluate(SETUP)
    print(json.dumps(pg.evaluate(EXTRA)))
    pg.evaluate("(() => { const S = window.__dw.S; for (let d = 0; d < 2 * 24 * 10; d++) { Sim.step(S, 0.1); if (S.meeting) Sim.meetingChoose(S, 'close'); } S.t = Math.floor(S.t / 24) * 24 + 24 + 11; S.weather = 'sun'; window.__dw.world.syncAgents(); window.__dw.setSpeed(1); })()")
    pg.wait_for_timeout(14000)
    print(pg.evaluate("(() => { const S = window.__dw.S; const o = {}; for (const b of S.b) if (['bakery','sawmill','mine','blacksmith','shipyard','clinic','library','academy','villa','apartment','rowhouse','fishhut','plaza'].includes(b.type)) o[b.type + b.id] = [b.staff, b.res, b.status, Math.round(b.happy)]; return JSON.stringify({ o, pop: Sim.pop(S), happy: S.happy, r: S.rates.gold.make.toFixed(1) }); })()"))
    cam = lambda t, d, pitch=0.42, yaw=None: f"""(() => {{ const S = window.__dw.S, b = S.b.find(b => b.type === '{t}'); if (!b) return 'none'; const [x, z] = Sim.center(b); const c = window.__dw.cam; c.tx = x; c.tz = z; c.gdist = c.dist = {d}; c.gpitch = c.pitch = {pitch}; {'' if yaw is None else f'c.gyaw = c.yaw = {yaw};'} return 'ok'; }})()"""
    only = sys.argv[1:] 
    for t, d in [('rowhouse', 6), ('villa', 6), ('apartment', 7), ('fishhut', 4), ('bakery', 4), ('sawmill', 6), ('mine', 6), ('blacksmith', 4), ('shipyard', 7), ('plaza', 6), ('clinic', 4), ('library', 6), ('academy', 7), ('pier', 8)]:
        if only and t not in only: continue
        r = pg.evaluate(cam(t, d)); pg.wait_for_timeout(2500); pg.screenshot(path=f'shots/n_{t}.png'); print(t, r)
    # quay close-up
    pg.evaluate("(() => { const S = window.__dw.S; let c = -1; for (let k = 0; k < 96*96; k++) if (S.road[k] === 4) { c = k; break; } if (c < 0) return; const cam = window.__dw.cam; cam.tx = c % 96 - 48; cam.tz = ((c / 96) | 0) - 48; cam.gdist = cam.dist = 8; cam.gpitch = cam.pitch = 0.5; })()")
    pg.wait_for_timeout(2500); pg.screenshot(path='shots/n_quay.png')
    pg.evaluate("(() => { const S = window.__dw.S, h = S.b[0]; const [x, z] = Sim.center(h); const cam = window.__dw.cam; cam.tx = x; cam.tz = z; cam.gdist = cam.dist = 9; cam.gpitch = cam.pitch = 0.7; })()")
    pg.wait_for_timeout(2500); pg.screenshot(path='shots/n_cobble.png')
    # night
    pg.evaluate("(() => { const S = window.__dw.S; S.t = Math.floor(S.t / 24) * 24 + 21.5; let c = -1; for (let k = 0; k < 96*96; k++) if (S.road[k] === 4) { c = k; break; } const cam = window.__dw.cam; cam.tx = c % 96 - 48; cam.tz = ((c / 96) | 0) - 48; cam.gdist = cam.dist = 16; cam.gpitch = cam.pitch = 0.6; })()")
    pg.wait_for_timeout(4000); pg.screenshot(path='shots/n_night.png')
    # UI: road tray and harbour inspector
    pg.evaluate("window.__dw.setSpeed(0)")
    pg.click('[data-cat=road]'); pg.wait_for_timeout(2500); pg.screenshot(path='shots/n_tray_roads.png')
    pg.click('[data-road="3"]'); pg.wait_for_timeout(300)
    print('roadType', pg.evaluate("window.__dw.UI.roadType"), pg.evaluate("window.__dw.UI.tool"))
    pg.click('[data-cat=homes]'); pg.wait_for_timeout(800); pg.screenshot(path='shots/n_tray_homes.png')
    pg.click('[data-cat=work]'); pg.wait_for_timeout(800); pg.screenshot(path='shots/n_tray_industry.png')
    b.close()
print('ERR', errs[:8])
