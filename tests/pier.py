from playwright.sync_api import sync_playwright
URL = 'file:///home/claude/colony/dist/test.html'
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1280, 'height': 800})
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script('(() => { let s = 4242; Math.random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })()')
    pg.goto(URL); pg.wait_for_timeout(2500); pg.click('[data-m=start]')
    pg.evaluate("window.__dw.setSpeed(0)")
    info = pg.evaluate(r"""(() => {
      const S = window.__dw.S, N = 96; S.wood = 999; S.gold = 999;
      const rc = []; for (let c = 0; c < N*N; c++) if (S._conn[c]) rc.push([c % N, (c / N) | 0]);
      let placed = 0;
      for (const [i, j] of rc) { for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1]]) if (placed < 5 && Sim.place(S, 'house', i+di, j+dj, 0).building) placed++; }
      const P = window.__dw.world.pierInfo(), hall = S.b[0], [hx, hz] = Sim.center(hall);
      const c = window.__dw.cam;
      c.tx = (P.cx + hx) / 2; c.tz = (P.cz + hz) / 2; c.gdist = c.dist = 20; c.gpitch = c.pitch = 0.62;
      c.gyaw = c.yaw = Math.atan2(P.d[0], P.d[1]) + 0.6;
      S.t = 9.0; S.pending = null;
      return { placed, pier: [P.b.i, P.b.j, P.b.rot, P.b.conn] };
    })()""")
    print(info)
    pg.wait_for_timeout(6000)
    pg.screenshot(path='shots/70_pier.png')
    # force a settler ship and step the sim in small increments
    pg.evaluate("(() => { const S = window.__dw.S; S.pending = { n: 6, arrive: S.t + 1.6 }; S._ev.push({ type: 'boat', n: 6, arrive: S.pending.arrive }); })()")
    pg.evaluate("window.__dw.setSpeed(2)")
    shots = 0
    for k in range(120):
        pg.wait_for_timeout(400)
        st = pg.evaluate("(() => { const S = window.__dw.S, W = window.__dw.world; const bt = W.boatsLive[0]; return [S.t, bt ? bt.pose : null, W.agents.filter(a => !a.hidden && !a.waitUntil && a.path).length, Sim.pop(S)]; })()")
        if st[1] and shots == 0 and st[0] > 9.9: pg.screenshot(path='shots/71_ship.png'); shots = 1
        if st[2] >= 3 and shots == 1: pg.evaluate("window.__dw.setSpeed(1)"); pg.wait_for_timeout(800); pg.screenshot(path='shots/72_walk.png'); shots = 2; print('walkers', st)
        if shots == 2:
            pg.wait_for_timeout(5000); pg.screenshot(path='shots/73_walk2.png')
            # check walkers' heights stay above water and they stay on roads/pier
            print(pg.evaluate("(() => { const S = window.__dw.S, W = window.__dw.world, N = 96; return W.agents.filter(a => !a.hidden && !a.waitUntil).map(a => { const i = Math.floor(a.x + N/2), j = Math.floor(a.z + N/2); const c = j*N+i; return (S.road[c] ? 'road' : S.occ[c] ? S.b.find(b=>b.id===S.occ[c]).type : Sim.cellH(S,i,j) < 0 ? 'water' : 'grass'); }).join(','); })()"))
            break
    print('final', st)
    b.close()
print('ERR', errs)
