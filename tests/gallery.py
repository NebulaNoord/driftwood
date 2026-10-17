"""Every building in both eras, side by side, plus traffic in the modern town."""
from playwright.sync_api import sync_playwright
import sys
era = sys.argv[1] if len(sys.argv) > 1 else 'modern'
errs = []
GAL = """(era => { const X = window.__dw; const S = Sim.newGame(777, era); X.S; window.__setS(S);
  for (const k of Sim.BUILDABLE) S.goals['unlock_' + k] = 1; S.gold = S.wood = S.stone = 1e6;
  const types = Sim.BUILDABLE.filter(t => !Sim.TYPES[t].era || Sim.TYPES[t].era === era);
  // flatten a big square and lay a grid of roads, then one building per plot
  const N = Sim.N, V = N + 1, hall = S.b.find(b => b.type === 'hall'), ci = hall.i + 1, cj = hall.j + 1;
  return { types: types.length, hall: [ci, cj] }; })""".strip()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1400, 'height': 900}); pg.route('**/fonts.g*/**', lambda r: r.abort())
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/colony/dist/test.html', wait_until='domcontentloaded', timeout=90000); pg.wait_for_timeout(3000)
    pg.click(f'[data-era={era}]'); pg.click('[data-m=start]'); pg.wait_for_timeout(1500); pg.evaluate("window.__dw.setSpeed(0)")
    out = pg.evaluate("""(era => { const X = window.__dw, S = X.S;
      for (const k of Sim.BUILDABLE) S.goals['unlock_' + k] = 1; S.gold = S.wood = S.stone = 1e6;
      const types = Sim.BUILDABLE.filter(t => !Sim.TYPES[t].era || Sim.TYPES[t].era === era);
      const placed = [], failed = [];
      const conn = () => { const o = []; for (let c = 0; c < Sim.N * Sim.N; c++) if (S._conn[c]) o.push([c % Sim.N, (c / Sim.N) | 0]); return o; };
      let seed = 9; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      // a grid of roads around the hall first
      const hall = S.b.find(b => b.type === 'hall');
      for (let k = 0; k < 40; k++) { const rc = conn(); const [i, j] = rc[Math.floor(rand() * rc.length)]; const d = Sim.DIRS[Math.floor(rand() * 4)]; const cells = Sim.roadPath([i, j], [i + d[0] * 6, j + d[1] * 6]); const q = Sim.roadQuote(S, cells); if (q.n >= 4 && !q.blocked) Sim.buildRoad(S, cells); }
      for (const t of types) { const s = Sim.TYPES[t].size; let ok = false;
        for (let a = 0; a < 3000 && !ok; a++) { const rc = conn(); const [i, j] = rc[Math.floor(rand() * rc.length)]; const o = [[1, 0], [-s, 0], [0, 1], [0, -s]][Math.floor(rand() * 4)]; const r = Sim.place(S, t, i + o[0], j + o[1], Math.floor(rand() * 4)); if (r.building) { ok = true; r.building.build = 1; if (Sim.TYPES[t].home) r.building.level = Math.floor(rand() * 3); } }
        (ok ? placed : failed).push(t); }
      for (let k = 0; k < 24 * 6 * 20; k++) { Sim.step(S, 0.05); if (S.meeting) Sim.meetingChoose(S, 'close'); }
      S.t = Math.floor(S.t / 24) * 24 + 8.5; if (S.wx) { S.wx.now = { k: 'clear', from: S.t - 1, to: S.t + 8, wind: 0.2 }; S.wx.q = []; } S._ev.length = 0; X.world.syncAgents();
      return { placed: placed.length, failed, pop: Sim.pop(S) }; })""", era)
    print(era, out)
    pg.evaluate("window.__dw.setSpeed(1)"); pg.wait_for_timeout(6000)
    for name, d, pitch, yaw in [('wide', 46, 0.9, 0.7), ('close1', 16, 0.72, 0.7), ('close2', 16, 0.72, 2.6), ('close3', 18, 0.7, 4.4)]:
        pg.evaluate(f"""(() => {{ const c = window.__dw.cam, h = window.__dw.S.b.find(b => b.type === 'hall'), [x, z] = Sim.center(h); c.tx = x; c.tz = z; c.gdist = c.dist = {d}; c.gpitch = c.pitch = {pitch}; c.gyaw = c.yaw = {yaw}; }})()""")
        pg.wait_for_timeout(4500); pg.screenshot(path=f'shots/g_{era}_{name}.png')
    print('moving', pg.evaluate("(() => { const A = window.__dw.world.agents; return { total: A.length, walking: A.filter(a => a.path && !a.riding && !a.hidden).length, driving: A.filter(a => a.path && a.riding && !a.hidden).length }; })()"))
    b.close()
print('ERR', errs[:6])
