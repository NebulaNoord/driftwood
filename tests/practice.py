from playwright.sync_api import sync_playwright
import time
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width': 1100, 'height': 700}); ctx.route('**/fonts.g*/**', lambda r: r.abort())
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/colony/dist/test.html', wait_until='domcontentloaded', timeout=90000); pg.wait_for_timeout(2500)
    pg.click('[data-m=start]')
    pg.click('[data-act=online]'); pg.wait_for_timeout(1000); pg.screenshot(path='shots/pr0_panel.png')
    t = time.time(); pg.click('[data-ol="rival:pirate"]'); pg.wait_for_function("window.__dw.Online.raid", timeout=60000); print('pirate island built in', round(time.time() - t, 1), 's')
    pg.wait_for_timeout(4000); print('errs', errs[:3]); pg.screenshot(path='shots/pr1_land.png')
    print(pg.evaluate("(() => { const r = window.__dw.Online.raid; return JSON.stringify({ phase: r.phase, t: r.t.toFixed(1), units: r.units.map(u => [u.side, u.x.toFixed(1), u.z.toFixed(1)]).slice(0, 4), spots: r.spots().length, total: r.total0 }); })()"))
    t0 = time.time(); n = 0
    while pg.evaluate("window.__dw.Online.raid && window.__dw.Online.raid.phase !== 'over'") and time.time() - t0 < 300:
        pg.evaluate("""(() => { const r = window.__dw.Online.raid; if (r.phase === 'go') { const o = (r.raiders[0] || {}).order || {}; if (!(o.kind === 'attack' && r.bLive(o.id))) {
          const c = r.centroid(); let best = null, bd = 1e9; for (const s of r.spots()) { const [x, z] = Sim.center(s.b), d = Math.hypot(x - c[0], z - c[1]) - s.loot * 0.05; if (d < bd) { bd = d; best = s; } }
          if (!best) { r.command({ kind: 'bank' }); } else { const [x, z] = Sim.center(best.b); const q = window.__dw.project(x, best.b.y + 0.3, z); window.__dw.raidTap(q, window.__dw.pick(q[0], q[1])); } } } for (let k = 0; k < 40 && r.phase !== 'over'; k++) r.update(0.1); })()""")
        pg.wait_for_timeout(1500)
        if n < 4 and time.time() - t0 > 10 + n * 20: pg.screenshot(path=f'shots/pr2_raid{n}.png'); n += 1
        if int(time.time() - t0) % 15 < 2: print(pg.evaluate("(() => { const r = window.__dw.Online.raid; return `t ${r.t.toFixed(0)} left ${r.left.toFixed(0)} raiders ${r.raiders.length} guards ${r.guards.length} loot ${JSON.stringify(r.loot)} order ${(r.raiders[0] || {order: {}}).order.kind}`; })()"))
    pg.wait_for_timeout(2500); pg.screenshot(path='shots/pr3_result.png')
    print('result', pg.evaluate("JSON.stringify(window.__dw.Online.result)"))
    g0 = pg.evaluate("window.__dw.Online.home.gold")
    pg.click('[data-ol=finish]'); pg.wait_for_timeout(2500); pg.screenshot(path='shots/pr4_home.png')
    print('home', pg.evaluate("[window.__dw.Online.mode, Math.round(window.__dw.S.gold), JSON.stringify(window.__dw.S.mp)]"), 'was', round(g0))
    b.close()
print('ERR', errs[:5])
