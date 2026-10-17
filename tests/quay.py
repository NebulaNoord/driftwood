from playwright.sync_api import sync_playwright
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1000, 'height': 650})
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/colony/dist/test.html'); pg.wait_for_timeout(2000)
    pg.click('[data-m=start]'); pg.evaluate("window.__dw.setSpeed(0)")
    print(pg.evaluate("""(() => { const S = window.__dw.S, N = 96; S.gold = S.stone = S.wood = 9999; const pier = S.b.find(b => b.type === 'pier');
      // walk along the coastline from the pier
      const ok = (i, j) => Sim.inB(i, j) && !Sim.roadOk(S, i, j, 4) && Sim.cellH(S, i, j) > -0.3 && Sim.cellH(S, i, j) < 0.6;
      let best = null; for (let r = 2; r < 9 && !best; r++) for (let dj = -r; dj <= r && !best; dj++) for (let di = -r; di <= r && !best; di++) if (ok(pier.i + di, pier.j + dj)) best = [pier.i + di, pier.j + dj];
      const cells = [], seen = new Set([best.join()]), q = [best]; while (q.length && cells.length < 16) { const c = q.shift(); cells.push(c); for (const [a, bb] of Sim.DIRS) { const n = [c[0] + a, c[1] + bb]; if (!seen.has(n.join()) && ok(...n)) { seen.add(n.join()); q.push(n); } } }
      const r = Sim.buildRoad(S, cells, 4);
      const [x, z] = [best[0] - 48, best[1] - 48]; const cam = window.__dw.cam; cam.tx = x; cam.tz = z; cam.gdist = cam.dist = 11; cam.gpitch = cam.pitch = 0.55; cam.gyaw = cam.yaw = 2.6;
      return JSON.stringify(r); })()"""))
    pg.wait_for_timeout(5000); pg.screenshot(path='shots/q1.png')
    pg.evaluate("(() => { const c = window.__dw.cam; c.gyaw = c.yaw = 4.2; c.gdist = c.dist = 7; c.gpitch = c.pitch = 0.4; })()")
    pg.wait_for_timeout(3000); pg.screenshot(path='shots/q2.png')
    b.close()
print('ERR', errs)
