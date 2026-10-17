from playwright.sync_api import sync_playwright
URL = 'file:///home/claude/colony/dist/test.html'
errs = []
SETUP = r"""
(() => {
  const S = window.__dw.S, N = 96, hall = S.b[0];
  S.gold = 99999; S.wood = 9999; S.stone = 9999;
  for (const k of ['market','well','chapel','port','lighthouse','quarry']) S.goals['unlock_' + k] = 1;
  const d = Sim.DIRS[hall.rot], p = [d[1], -d[0]];
  // front road end
  const fr = Sim.frontCells(hall)[0];
  const base = [fr[0] + d[0] * 5, fr[1] + d[1] * 5];
  // hill to the side of the road
  const [hx, hz] = [base[0] + p[0] * 6 - N / 2, base[1] + p[1] * 6 - N / 2];
  for (let k = 0; k < 7; k++) Sim.brush(S, 'raise', hx, hz, 5.5, 0.35);
  // clear trees around
  Sim.clearTrees(S, hx, hz, 9);
  // road climbing the hill
  const r1 = Sim.buildRoad(S, Sim.roadPath(base, [base[0] + p[0] * 11, base[1] + p[1] * 11]));
  const placed = [];
  for (let k = 1; k <= 10; k++) {
    const ri = base[0] + p[0] * k, rj = base[1] + p[1] * k;
    for (const side of [1, -1]) {
      const rot = side > 0 ? [0,1,2,3].find(q => Sim.DIRS[q][0] === -d[0] && Sim.DIRS[q][1] === -d[1]) : hall.rot;
      const type = k === 5 && side > 0 ? 'market' : k === 8 && side < 0 ? 'chapel' : 'house';
      const s = Sim.TYPES[type].size;
      const i = ri + d[0] * (side > 0 ? 1 : -s), j = rj + d[1] * (side > 0 ? 1 : -s);
      const ii = d[0] ? (side > 0 ? ri + d[0] : ri + d[0] * s) : ri, jj = d[1] ? (side > 0 ? rj + d[1] : rj + d[1] * s) : rj;
      const fi = Math.min(ii, ii - (d[0] < 0 ? s - 1 : 0)), fj = Math.min(jj, jj - (d[1] < 0 ? s - 1 : 0));
      const r = Sim.place(S, type, d[0] ? (side > 0 ? (d[0] > 0 ? ri + 1 : ri - s) : (d[0] > 0 ? ri - s : ri + 1)) : ri, d[1] ? (side > 0 ? (d[1] > 0 ? rj + 1 : rj - s) : (d[1] > 0 ? rj - s : rj + 1)) : rj, rot);
      if (r.building) placed.push([type, r.building.y]);
    }
  }
  const c = window.__dw.cam; c.tx = hx; c.tz = hz; c.gdist = 15; c.gpitch = 0.5; c.gyaw = Math.atan2(-p[0] * 0.3 + d[0], -p[1] * 0.3 + d[1]) + 0.9; c.yaw = c.gyaw; c.dist = c.gdist; c.pitch = c.gpitch;
  S.t = 10.5;
  return { road: r1, placed };
})()
"""
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1280, 'height': 800})
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script('(() => { let s = 99; Math.random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })()')
    pg.goto(URL); pg.wait_for_timeout(2500); pg.click('[data-m=start]'); pg.evaluate("window.__dw.setSpeed(0)")
    print(pg.evaluate(SETUP))
    pg.wait_for_timeout(16000)
    pg.screenshot(path='shots/60_hill_a.png')
    pg.evaluate("(() => { const c = window.__dw.cam; c.gyaw += 2.3; c.gdist = 18; c.yaw = c.gyaw; c.dist = c.gdist; })()"); pg.wait_for_timeout(3000)
    pg.screenshot(path='shots/61_hill_b.png')
    pg.evaluate("(() => { const c = window.__dw.cam; c.gyaw += 1.4; c.gpitch = 0.4; c.gdist = 11; c.yaw = c.gyaw; c.dist = c.gdist; c.pitch = c.gpitch; })()"); pg.wait_for_timeout(3000)
    pg.screenshot(path='shots/62_hill_c.png')
    b.close()
print('ERR', errs)
