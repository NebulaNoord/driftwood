"""Close-ups of just the new modern buildings, by day and at night."""
from playwright.sync_api import sync_playwright
NEW = ['supermarket', 'cafe', 'gasstation', 'hotel', 'cinema', 'sportsfield', 'stadium', 'firestation', 'busdepot', 'windturbine', 'solarfarm', 'powerplant', 'skyscraper', 'airfield']
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1200, 'height': 800}); pg.set_default_timeout(180000); pg.route('**/fonts.g*/**', lambda r: r.abort())
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/colony/dist/test.html', wait_until='domcontentloaded', timeout=90000); pg.wait_for_timeout(3000)
    pg.click('[data-era=modern]'); pg.click('[data-m=start]'); pg.wait_for_timeout(1500); pg.evaluate("window.__dw.setSpeed(0)")
    pg.evaluate("document.querySelectorAll('#goals,#chat,#hint,#dock,#res,#clock').forEach(e => e.style.display = 'none')")
    # flatten a strip of land next to the hall and lay the buildings out in two rows along a road
    placed = pg.evaluate("""(NEW => { const S = window.__dw.S, N = Sim.N; for (const k of Sim.BUILDABLE) S.goals['unlock_' + k] = 1; S.gold = S.wood = S.stone = 1e6;
      const hall = S.b.find(b => b.type === 'hall'); const out = [];
      let seed = 5; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const conn = () => { const o = []; for (let c = 0; c < N * N; c++) if (S._conn[c]) o.push([c % N, (c / N) | 0]); return o; };
      for (let k = 0; k < 40; k++) { const rc = conn(); const [i, j] = rc[Math.floor(rand() * rc.length)]; const d = Sim.DIRS[Math.floor(rand() * 4)]; const cells = Sim.roadPath([i, j], [i + d[0] * 8, j + d[1] * 8]); const q = Sim.roadQuote(S, cells); if (q.n >= 4 && !q.blocked) Sim.buildRoad(S, cells); }
      for (const t of NEW) { const s = Sim.TYPES[t].size; let got = null;
        for (let a = 0; a < 5000 && !got; a++) { const rc = conn(); const [i, j] = rc[Math.floor(rand() * rc.length)]; const o = [[1, 0], [-s, 0], [0, 1], [0, -s]][Math.floor(rand() * 4)]; const r = Sim.place(S, t, i + o[0], j + o[1], Math.floor(rand() * 4)); if (r.building) { got = r.building; got.build = 1; } }
        out.push([t, got ? got.id : null]); }
      Sim.recompute(S); window.__dw.world.syncAgents(); return out; })""", NEW)
    print('placed', [t for t, i in placed if i], 'failed', [t for t, i in placed if not i])
    shots = 0
    for t, bid in placed:
        if not bid: continue
        for hour in (11, 21.5):
            pg.evaluate(f"""(() => {{ const S = window.__dw.S, b = S.b.find(x => x.id === {bid}), [x, z] = Sim.center(b), c = window.__dw.cam, s = Sim.TYPES[b.type].size; S.t = Math.floor(S.t / 24) * 24 + {hour}; if (S.wx) {{ S.wx.now = {{ k: 'clear', from: S.t - 1, to: S.t + 8, wind: 0.3 }}; S.wx.q = []; }}
              c.tx = x; c.tz = z; c.ty = b.y + 0.5; c.gdist = c.dist = 4 + s * 2.6 + (b.type === 'skyscraper' || b.type === 'windturbine' ? 3 : 0); c.gpitch = c.pitch = 0.55; c.gyaw = c.yaw = b.rot * Math.PI / 2 + 0.6; }})()""")
            pg.wait_for_timeout(2500); pg.screenshot(path=f'shots/nm_{t}_{int(hour)}.png')
    b.close()
print('ERR', errs[:5])
