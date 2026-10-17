from playwright.sync_api import sync_playwright
import time, json
errs = []
FF = """(() => { const r = window.__dw.Online.raid; if (!r) return; if (r.phase === 'go') { const o = (r.raiders[0] || {}).order || {};
  if (!(o.kind === 'attack' && r.bLive(o.id))) { const c = r.centroid(); let best = null, bd = 1e9; for (const s of r.spots()) { const [x, z] = Sim.center(s.b), d = Math.hypot(x - c[0], z - c[1]) - s.loot * 0.05; if (d < bd) { bd = d; best = s; } }
    if (best) { const [x, z] = Sim.center(best.b); const q = window.__dw.project(x, best.b.y + 0.3, z); window.__dw.raidTap(q, window.__dw.pick(q[0], q[1])); } }
  if (r.guns && r.gunCd <= 0 && r.hall && r.bLive(r.hall.id)) { const [x, z] = Sim.center(r.hall); r.broadside(x, z); } }
  for (let k = 0; k < 30 && r.phase !== 'over'; k++) r.update(0.1); })()"""
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width': 1100, 'height': 700}); ctx.route('**/fonts.g*/**', lambda r: r.abort())
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/colony/dist/test.html', wait_until='domcontentloaded', timeout=90000); pg.wait_for_timeout(2500)
    pg.click('[data-m=start]')
    pg.click('[data-act=online]'); pg.wait_for_timeout(5000); pg.screenshot(path='shots/r_panel.png')
    print('rows', pg.evaluate("[...document.querySelectorAll('.isl b')].map(e => e.textContent).join(' | ')"))
    pg.click('[data-m=close]')
    # a decent army for the fortress
    pg.evaluate("(() => { const S = window.__dw.S, A = Sim.army(S); A.n = { inf: 10, arc: 6, cav: 3, can: 2 }; A.atk = { inf: 8, arc: 4, cav: 2, can: 1 }; A.boat = 3; })()")
    for rid in ['iron', 'fort']:
        pg.evaluate("(() => { const A = Sim.army(window.__dw.S); A.n = { inf: 10, arc: 6, cav: 3, can: 2 }; A.atk = { inf: 8, arc: 4, cav: 2, can: 1 }; A.boat = 3; })()")
        t = time.time(); pg.evaluate(f"window.__dw.onlineAct('rival:{rid}')"); pg.wait_for_function("window.__dw.Online.raid", timeout=60000)
        info = pg.evaluate("(() => { const S = window.__dw.S, r = window.__dw.Online.raid; return JSON.stringify({ b: S.b.length, walls: S.wall.filter(x => x).length, def: r.guards.length, towers: r.towers.length, atk: r.raiders.length, stash: Math.round(r.total0) }); })()")
        print(rid, 'built in', round(time.time() - t, 1), 's', info)
        pg.wait_for_timeout(2500); pg.screenshot(path=f'shots/r_{rid}_land.png')
        n = 0
        while pg.evaluate("window.__dw.Online.raid && window.__dw.Online.raid.phase !== 'over'"):
            pg.evaluate(FF); pg.wait_for_timeout(1200); n += 1
            if n == 3: pg.screenshot(path=f'shots/r_{rid}_mid.png')
        pg.wait_for_timeout(2000)
        print(' result', pg.evaluate("JSON.stringify(window.__dw.Online.result.res)"))
        pg.click('[data-ol=finish]'); pg.wait_for_timeout(2000)
    pg.click('[data-act=online]'); pg.wait_for_timeout(4000); print('cooldowns', pg.evaluate("[...document.querySelectorAll('[data-ol^=\"rival:\"]')].map(e => e.textContent).join(' | ')"))
    b.close()
print('ERR', errs[:5])
