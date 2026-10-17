from playwright.sync_api import sync_playwright
import time
SETUP = open('tests/life.py').read().split('SETUP = r"""')[1].split('"""')[0]
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width': 1100, 'height': 700}); ctx.route('**/fonts.g*/**', lambda r: r.abort())
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script('(() => { let s = 4321; Math.random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })()')
    pg.goto('file:///home/claude/colony/dist/test.html', wait_until='domcontentloaded', timeout=90000); pg.wait_for_timeout(2500)
    pg.click('[data-m=start]'); pg.evaluate("window.__dw.setSpeed(0)")
    pg.evaluate(SETUP)
    print(pg.evaluate("""(() => { const S = window.__dw.S, N = 96; let seed = 9; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const conn = () => { const o = []; for (let c = 0; c < N*N; c++) if (S._conn[c]) o.push([c % N, (c / N) | 0]); return o; };
      for (let k = 0; k < 6; k++) { const rc = conn(); for (let a = 0; a < 200; a++) { const [i, j] = rc[Math.floor(rand()*rc.length)]; const d = Sim.DIRS[Math.floor(rand()*4)]; const cells = Sim.roadPath([i,j],[i+d[0]*7,j+d[1]*7]); const q = Sim.roadQuote(S, cells); if (q.n >= 5 && !q.blocked) { Sim.buildRoad(S, cells); break; } } }
      const place = t => { const rc = conn(), s = Sim.TYPES[t].size; for (let a = 0; a < 3000; a++) { const [i,j] = rc[Math.floor(rand()*rc.length)]; const o = [[1,0],[-s,0],[0,1],[0,-s]][Math.floor(rand()*4)]; const r = Sim.place(S, t, i+o[0], j+o[1], Math.floor(rand()*4)); if (r.building) return t; } return 'fail:' + t; };
      const out = ['barracks', 'archery', 'cavyard', 'foundry', 'warschool', 'watchtower', 'guardhouse'].map(place);
      for (const b of S.b) b.build = 1;
      const hall = S.b.find(b => b.type === 'hall'), ring = []; for (let a = 0; a < 360; a += 3) ring.push([Math.round(hall.i + 1 + Math.cos(a * Math.PI / 180) * 5), Math.round(hall.j + 1 + Math.sin(a * Math.PI / 180) * 5)]);
      S.goals.unlock_wall2 = 1; S.goals.unlock_wall1 = 1; const w = Sim.buildWall(S, ring.slice(0, 60), 2); const w2 = Sim.buildWall(S, ring.slice(60), 1);
      for (let k = 0; k < 24 * 6; k++) { Sim.step(S, 0.1); if (S.meeting) Sim.meetingChoose(S, 'close'); }
      Sim.recompute(S);
      const tr = ['inf', 'arc', 'cav', 'can'].map(t => JSON.stringify(Sim.train(S, t, 8)));
      for (let k = 0; k < 24 * 10 * 2; k++) { Sim.step(S, 0.05); if (S.meeting) Sim.meetingChoose(S, 'close'); }
      const A = Sim.army(S); A.n = { inf: 10, arc: 8, cav: 4, can: 2 }; A.atk = { inf: 0, arc: 0, cav: 0, can: 0 }; A.boat = 3; A.lv.inf = 2; Sim.assign(S, 'inf', 6); Sim.assign(S, 'arc', 4); Sim.assign(S, 'cav', 1); Sim.assign(S, 'can', 1);
      S.gold = 3000; S.wood = 800; S.stone = 600; window.__dw.world.syncAgents();
      S.t = Math.floor(S.t / 24) * 24 + 24 + 10;
      return JSON.stringify({ out, w, w2, tr, army: A.n, atk: A.atk, slots: Sim.boatSlots(S), pop: Sim.pop(S) }); })()"""))
    pg.evaluate("window.__dw.setSpeed(1)"); pg.wait_for_timeout(4000)
    cam = lambda t, d, pitch=0.5, yaw=None: f"""(() => {{ const S = window.__dw.S, b = S.b.find(b => b.type === '{t}'); if (!b) return 'none'; const [x, z] = Sim.center(b); const c = window.__dw.cam; c.tx = x; c.tz = z; c.gdist = c.dist = {d}; c.gpitch = c.pitch = {pitch}; {'' if yaw is None else f'c.gyaw = c.yaw = {yaw};'} return 'ok'; }})()"""
    for t, d in [('barracks', 6), ('archery', 6), ('cavyard', 6), ('foundry', 6), ('warschool', 6), ('hall', 14)]:
        pg.evaluate(cam(t, d)); pg.wait_for_timeout(3000); pg.screenshot(path=f'shots/a_{t}.png')
    pg.click('[data-act=army]'); pg.wait_for_timeout(6000); pg.screenshot(path='shots/a_panel.png')
    pg.click('[data-m=close]'); pg.wait_for_timeout(500)
    pg.click('[data-cat=army]'); pg.wait_for_timeout(4000); pg.screenshot(path='shots/a_tray.png')
    pg.keyboard.press('Escape')
    # practice raid with the army
    pg.evaluate("window.__dw.onlineAct('practice')"); pg.wait_for_function("window.__dw.Online.raid", timeout=60000)
    print('party', pg.evaluate("JSON.stringify(window.__dw.Online.raid.counts())"), 'defenders', pg.evaluate("window.__dw.Online.raid.guards.length"))
    pg.wait_for_timeout(3000); pg.screenshot(path='shots/a_land.png')
    t0 = time.time(); n = 0
    while pg.evaluate("window.__dw.Online.raid && window.__dw.Online.raid.phase !== 'over'") and time.time() - t0 < 300:
        pg.evaluate("""(() => { const r = window.__dw.Online.raid; if (r.phase === 'go') { const o = (r.raiders[0] || {}).order || {};
          if (!(o.kind === 'attack' && r.bLive(o.id))) { const c = r.centroid(); let best = null, bd = 1e9; for (const s of r.spots()) { const [x, z] = Sim.center(s.b), d = Math.hypot(x - c[0], z - c[1]) - s.loot * 0.05; if (d < bd) { bd = d; best = s; } }
            if (best) { const [x, z] = Sim.center(best.b); const q = window.__dw.project(x, best.b.y + 0.3, z); r.sel = 'all'; window.__dw.raidTap(q, window.__dw.pick(q[0], q[1])); } }
          if (r.guns && r.gunCd <= 0 && r.hall && r.bLive(r.hall.id)) { const [x, z] = Sim.center(r.hall); r.broadside(x, z); } }
          for (let k = 0; k < 25 && r.phase !== 'over'; k++) r.update(0.1); })()""")
        pg.wait_for_timeout(2500)
        if n < 4: pg.screenshot(path=f'shots/a_raid{n}.png'); n += 1
        print(pg.evaluate("(() => { const r = window.__dw.Online.raid; return `t ${r.t.toFixed(0)} raiders ${r.raiders.length} guards ${r.guards.length} loot ${JSON.stringify(r.loot)} destroyed ${r.destroyed.length} breaches ${r.breaches} piles ${r.piles.length}`; })()"))
    pg.wait_for_timeout(2500); pg.screenshot(path='shots/a_result.png')
    print('result', pg.evaluate("JSON.stringify(window.__dw.Online.result && window.__dw.Online.result.res)"))
    pg.click('[data-ol=finish]'); pg.wait_for_timeout(2000)
    print('home', pg.evaluate("JSON.stringify([window.__dw.Online.mode, Math.round(window.__dw.S.gold), window.__dw.S.army.n])"))
    b.close()
print('ERR', errs[:6])
