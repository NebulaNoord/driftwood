"""Settlers: real paths around obstacles, wandering, desire paths forming, stone fields and weather visuals; timings."""
from playwright.sync_api import sync_playwright
import json
SETUP = open('tests/life.py').read().split('SETUP = r"""')[1].split('"""')[0]
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1280, 'height': 800}); pg.route('**/fonts.g*/**', lambda r: r.abort())
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script('(() => { let s = 4242; Math.random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })()')
    pg.goto('file:///home/claude/colony/dist/test.html', wait_until='domcontentloaded', timeout=90000); pg.wait_for_timeout(3000)
    pg.click('[data-m=start]'); pg.evaluate("window.__dw.setSpeed(0)"); pg.evaluate(SETUP)
    print('rock cells', pg.evaluate("window.__dw.S.rock.reduce((a, v) => a + (v ? 1 : 0), 0)"), 'wx', pg.evaluate("JSON.stringify(window.__dw.S.wx.now)"))
    # A* speed and a path that must go around the hall
    print(pg.evaluate("""(() => { const W = window.__dw.world, S = window.__dw.S; W.navGrid(); const h = S.b.find(b => b.type === 'hall'); const [x, z] = Sim.center(h);
      const t0 = performance.now(); let n = 0, pts = 0; for (let k = 0; k < 60; k++) { W.navMs = 0; const r = W.routeXZ([x - 20 + k * 0.5, z - 18], -1, [x + 15, z + 14], -1); pts += r.length; n++; }
      const ms = (performance.now() - t0) / n;
      // a straight line through the hall must bend around it
      W.navMs = 0; const r = W.routeXZ([x - 4, z + 0.2], -1, [x + 4, z + 0.2], -1); let hitsHall = false;
      for (let k = 1; k < r.length; k++) for (let u = 0; u <= 1; u += 0.05) { const px = r[k-1][0] + (r[k][0]-r[k-1][0])*u, pz = r[k-1][1] + (r[k][1]-r[k-1][1])*u, i = Math.floor(px + 48), j = Math.floor(pz + 48); if (S.occ[j*96+i] === h.id) hitsHall = true; }
      return 'A* avg ms ' + ms.toFixed(2) + ', avg pts ' + (pts / n).toFixed(1) + ', around-hall pts ' + r.length + ', crosses hall: ' + hitsHall; })()"""))
    pg.evaluate("(() => { const S = window.__dw.S; for (let k = 0; k < 24*6*20; k++) { Sim.step(S, 0.05); if (S.meeting) Sim.meetingChoose(S, 'close'); } S.t = Math.floor(S.t/24)*24 + 7; window.__dw.world.syncAgents(); })()")
    print('pop', pg.evaluate("Sim.pop(window.__dw.S)"), 'agents', pg.evaluate("window.__dw.world.agents.length"))
    for k in range(4):
        print('sim ms', pg.evaluate("(() => { const S = window.__dw.S, W = window.__dw.world, t0 = performance.now(); let worst = 0; for (let f = 0; f < 600; f++) { const a = performance.now(); Sim.step(S, 0.01); if (S.meeting) Sim.meetingChoose(S, 'close'); W.update(1 / 30, 0.01); worst = Math.max(worst, performance.now() - a); } return ((performance.now() - t0) / 600).toFixed(2) + ' per frame, worst ' + worst.toFixed(1); })()"))
        print(pg.evaluate("""(() => { const W = window.__dw.world, S = window.__dw.S, h = S.b.find(b => b.type === 'hall'), [hx, hz] = Sim.center(h);
          const out = W.agents.filter(a => !a.hidden && !a.temp); const far = out.filter(a => Math.hypot(a.x - hx, a.z - hz) > 12).length;
          const wander = W.agents.filter(a => a.act && a.act.wander).length; let worn = 0, path = 0; for (let c = 0; c < 9216; c++) { if (S.wear[c] > 50) worn++; if (S.wear[c] > 130) path++; }
          return 'day ' + Math.floor(S.t / 24) + ' ' + (S.t % 24).toFixed(1) + 'h out ' + out.length + ', >12 from hall ' + far + ', wandering ' + wander + ', worn cells ' + worn + ', footpaths ' + path + ', wx ' + S.wx.now.k; })()"""))
    pg.evaluate("window.__dw.setSpeed(1)")
    pg.evaluate("(() => { const c = window.__dw.cam, S = window.__dw.S; let best = null; for (let c2 = 0; c2 < 9216; c2++) if (S.rock[c2] === 2) { best = c2; break; } c.tx = best % 96 - 48; c.tz = Math.floor(best / 96) - 48; c.gdist = c.dist = 16; })()")
    pg.wait_for_timeout(5000); pg.screenshot(path='shots/p1_stone.png')
    pg.evaluate("(() => { const c = window.__dw.cam, h = window.__dw.S.b.find(b => b.type === 'hall'), [x, z] = Sim.center(h); c.tx = x; c.tz = z; c.gdist = c.dist = 45; c.gpitch = c.pitch = 1.05; })()")
    pg.wait_for_timeout(5000); pg.screenshot(path='shots/p2_paths.png')
    b.close()
print('ERR', errs[:5])
