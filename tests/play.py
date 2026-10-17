import json
from playwright.sync_api import sync_playwright
URL = 'file:///home/claude/colony/dist/test.html'
errs = []
def J(pg, js): return pg.evaluate(js)
def scr(pg, x, y, z): return J(pg, f"window.__dw.project({x},{y},{z})")
def cellxz(i, j): return (i - 48 + 0.5, j - 48 + 0.5)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1280, 'height': 800})
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(URL); pg.wait_for_timeout(2500)
    pg.click('[data-m=start]'); pg.wait_for_timeout(300)
    J(pg, "window.__dw.setSpeed(0)")
    info = J(pg, """(() => { const S = window.__dw.S, N = 96; const roads = []; for (let c = 0; c < N*N; c++) if (S.road[c]) roads.push([c % N, (c / N) | 0]);
      const h = S.b[0]; return { roads, hall: [h.i, h.j, h.rot] }; })()""")
    roads = info['roads']; hi, hj, hrot = info['hall']
    d = [[0,1],[1,0],[0,-1],[-1,0]][hrot]
    end = max(roads, key=lambda r: (r[0]-hi)*d[0] + (r[1]-hj)*d[1])
    print('hall', info['hall'], 'road end', end)
    # zoom camera onto the road end
    x, z = cellxz(*end)
    J(pg, f"(() => {{ const c = window.__dw.cam; c.tx = {x}; c.tz = {z}; c.gdist = 26; c.gpitch = 0.85; }})()")
    pg.wait_for_timeout(1800)
    # Road tool: drag sideways 7 cells (perpendicular to the hall direction)
    pg.click('[data-cat=road]')
    pd = [d[1], -d[0]]
    for sgn in (1, -1):
        a = cellxz(*end); bcell = (end[0] + pd[0]*7*sgn, end[1] + pd[1]*7*sgn); bb = cellxz(*bcell)
        ya = J(pg, f"Sim.heightAt(window.__dw.S,{a[0]},{a[1]})"); yb = J(pg, f"Sim.heightAt(window.__dw.S,{bb[0]},{bb[1]})")
        sa = scr(pg, a[0], ya, a[1]); sb = scr(pg, bb[0], yb, bb[1])
        pg.mouse.move(*sa); pg.mouse.down(); 
        for k in range(1, 9): pg.mouse.move(sa[0] + (sb[0]-sa[0])*k/8, sa[1] + (sb[1]-sa[1])*k/8); pg.wait_for_timeout(40)
        if sgn == 1: pg.screenshot(path='shots/10_road_drag.png')
        pg.mouse.up(); pg.wait_for_timeout(200)
    print('roads now', J(pg, "window.__dw.S.road.reduce((a,x)=>a+x,0)"), 'gold', J(pg, "Math.round(window.__dw.S.gold)"))
    # Homes: place cottages on valid cells next to connected road
    pg.click('[data-cat=homes]'); pg.wait_for_timeout(300)
    spots = J(pg, """(() => { const S = window.__dw.S, N = 96, out = [];
      for (let c = 0; c < N*N && out.length < 6; c++) { if (!S._conn[c]) continue; const i = c % N, j = (c / N) | 0;
        for (const [di, dj] of [[0,1],[0,-1],[1,0],[-1,0]]) { const r = Sim.canPlace(S, 'house', i+di, j+dj, 0); if (r.ok && !out.some(o => Math.abs(o[0]-i-di) + Math.abs(o[1]-j-dj) < 2)) { out.push([i+di, j+dj]); break; } } }
      return out; })()""")
    print('house spots', spots)
    for (i, j) in spots[:4]:
        x, z = cellxz(i, j); y = J(pg, f"Sim.heightAt(window.__dw.S,{x},{z})")
        s = scr(pg, x, y, z); pg.mouse.move(*s); pg.wait_for_timeout(150); pg.mouse.click(*s); pg.wait_for_timeout(150)
    pg.wait_for_timeout(200)
    pg.screenshot(path='shots/11_houses_bounce.png')
    pg.wait_for_timeout(2500)
    # lumber camp near a forest + connected road
    pg.click('[data-cat=work]'); pg.wait_for_timeout(300)
    spot = J(pg, """(() => { const S = window.__dw.S, N = 96; let best = null, bs = -1;
      for (let c = 0; c < N*N; c++) { if (!S._conn[c]) continue; const i = c % N, j = (c / N) | 0;
        for (const [di, dj] of [[0,1],[0,-1],[1,0],[-1,0]]) { const r = Sim.canPlace(S, 'lumber', i+di, j+dj, 0); if (!r.ok) continue;
          let t = 0; for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) if (Sim.inB(i+di+x, j+dj+y) && S.tree[(j+dj+y)*N + i+di+x]) t++;
          if (t > bs) { bs = t; best = [i+di, j+dj]; } } }
      return best; })()""")
    x, z = cellxz(*spot); y = J(pg, f"Sim.heightAt(window.__dw.S,{x},{z})"); s = scr(pg, x, y, z)
    pg.mouse.move(*s); pg.wait_for_timeout(200); pg.screenshot(path='shots/12_ghost.png'); pg.mouse.click(*s); pg.wait_for_timeout(300)
    print('buildings', J(pg, "window.__dw.S.b.map(b => b.type + (b.conn ? '' : '(x)')).join(',')"))
    # Land: raise brush on open ground away from buildings
    pg.click('[data-cat=land]'); pg.wait_for_timeout(300)
    hx, hz = cellxz(hi + 1, hj + 1)
    tx, tz = hx + d[0]*4 + pd[0]*9, hz + d[1]*4 + pd[1]*9
    ty = J(pg, f"Sim.heightAt(window.__dw.S,{tx},{tz})"); s = scr(pg, tx, ty, tz)
    h0 = ty
    pg.mouse.move(*s); pg.mouse.down(); pg.wait_for_timeout(2500); pg.screenshot(path='shots/13_raise.png'); pg.mouse.up()
    print('raised from', round(h0, 2), 'to', round(J(pg, f"Sim.heightAt(window.__dw.S,{tx},{tz})"), 2))
    pg.keyboard.press('Escape')
    # run time forward
    J(pg, "window.__dw.setSpeed(3)")
    for k in range(12):
        pg.wait_for_timeout(1000)
        st = J(pg, "(() => { const S = window.__dw.S, W = window.__dw.world; return [Math.round(S.t*10)/10, Sim.pop(S), W.boatsLive.length, W.agents.length, W.agents.filter(a => !a.hidden).length]; })()")
        if st[2]: print('boat!', st); pg.screenshot(path='shots/14_boat.png'); break
    J(pg, "window.__dw.S.t = Math.max(window.__dw.S.t, 7.8)")
    # step sim directly for a while then view people
    J(pg, "(() => { Sim.step(window.__dw.S, 30); })()")
    J(pg, "window.__dw.setSpeed(1)")
    pg.wait_for_timeout(4000)
    print('after 30h', J(pg, "(() => { const S = window.__dw.S, W = window.__dw.world; return { t: S.t, pop: Sim.pop(S), agents: W.agents.length, visible: W.agents.filter(a => !a.hidden).length, wood: S.wood, gold: Math.round(S.gold), goals: Object.keys(S.goals) }; })()"))
    pg.screenshot(path='shots/15_people.png')
    # inspector
    hid = J(pg, "window.__dw.S.b.find(b => b.type === 'house').id")
    J(pg, f"(() => {{ window.__dw.UI.sel = {hid}; }})()"); pg.wait_for_timeout(600)
    pg.screenshot(path='shots/16_inspect.png')
    # night
    J(pg, "(() => { const S = window.__dw.S; S.t = Math.floor(S.t/24)*24 + 21.5; window.__dw.setSpeed(0); const c = window.__dw.cam; c.gdist = 34; })()")
    pg.wait_for_timeout(2500)
    pg.screenshot(path='shots/17_night.png')
    # demolish animation
    J(pg, "window.__dw.S.t = Math.floor(window.__dw.S.t/24)*24 + 36")
    J(pg, f"(() => {{ window.__dw.UI.sel = {hid}; window.__dw.act('demolish'); window.__dw.act('demolish'); }})()")
    pg.wait_for_timeout(250)
    pg.screenshot(path='shots/18_demolish.png')
    b.close()
print('ERRORS', errs[:10])
