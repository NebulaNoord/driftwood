from playwright.sync_api import sync_playwright
SETUP = open('tests/life.py').read().split('SETUP = r"""')[1].split('"""')[0]
errs = []
def look(pg, js, name, wait=7000):
    pg.evaluate(js); pg.wait_for_timeout(wait); pg.screenshot(path=f'shots/{name}.png')
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1100, 'height': 700})
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script('(() => { let s = 777; Math.random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })()')
    pg.goto('file:///home/claude/colony/dist/test.html'); pg.wait_for_timeout(2500)
    pg.click('[data-m=start]'); pg.evaluate("window.__dw.setSpeed(0)")
    pg.evaluate(SETUP)
    pg.evaluate("(() => { const S = window.__dw.S; for (let d = 0; d < 3 * 24 * 10; d++) { Sim.step(S, 0.1); if (S.meeting) Sim.meetingChoose(S, 'close'); } S.t = Math.floor(S.t / 24) * 24 + 24 + 8.5; S.weather = 'sun'; window.__dw.world.syncAgents(); window.__dw.setSpeed(1); })()")
    pg.wait_for_timeout(12000)  # let people walk out to work
    cam = lambda t, d, pitch=0.42, yaw=None: f"""(() => {{ const S = window.__dw.S, b = S.b.find(b => b.type === '{t}'); if (!b) return; const [x, z] = Sim.center(b); const c = window.__dw.cam; c.tx = x; c.tz = z; c.gdist = c.dist = {d}; c.gpitch = c.pitch = {pitch}; {'' if yaw is None else f'c.gyaw = c.yaw = {yaw};'} }})()"""
    look(pg, cam('farm', 9), 'd1_farm')
    look(pg, cam('stable', 7), 'd2_stable')
    look(pg, cam('tavern', 6), 'd3_tavern')
    look(pg, cam('market', 5, 0.35), 'd4_market')
    look(pg, cam('lumber', 7), 'd5_lumber')
    # force a cart and follow it
    pg.evaluate("(() => { const S = window.__dw.S, W = window.__dw.world, f = S.b.find(b => b.type === 'farm'); for (let k = 0; k < 6 && !W.carts.length; k++) W.haul(f, 'food'); const c = W.carts[0]; if (c) { c.d = c.L * 0.4; const p = W.cartPose(c, c.d); const cam = window.__dw.cam; cam.tx = p[0]; cam.tz = p[1]; cam.gdist = cam.dist = 4.5; cam.gpitch = cam.pitch = 0.35; } window.__dw.setSpeed(0); })()")
    pg.wait_for_timeout(4000); pg.screenshot(path='shots/d6_cart.png')
    # a settler up close
    pg.evaluate("(() => { const W = window.__dw.world, a = W.agents.find(a => !a.hidden && !a.temp && a.anim !== 'walk' && !a.path) || W.agents.find(a => !a.hidden); const c = window.__dw.cam; c.tx = a.x; c.tz = a.z; c.gdist = c.dist = 3.2; c.gpitch = c.pitch = 0.25; window.__dw.setSpeed(1); })()")
    pg.wait_for_timeout(5000); pg.screenshot(path='shots/d7_people.png')
    # coast with gulls and waves
    pg.evaluate("(() => { const W = window.__dw.world, P = W.pierInfo(); const c = window.__dw.cam; c.tx = P.tip[0]; c.tz = P.tip[1]; c.gdist = c.dist = 12; c.gpitch = c.pitch = 0.35; })()")
    pg.wait_for_timeout(6000); pg.screenshot(path='shots/d8_coast.png')
    print('gulls', pg.evaluate("(window.__dw.world.gulls || []).length"), 'grass', pg.evaluate("(window.__dw.world.grass || window.__dw.world.tufts || []).length"))
    b.close()
print('ERR', errs)
