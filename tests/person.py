from playwright.sync_api import sync_playwright
SETUP = open('tests/life.py').read().split('SETUP = r"""')[1].split('"""')[0]
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 900, 'height': 600})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script('(() => { let s = 777; Math.random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })()')
    pg.goto('file:///home/claude/colony/dist/test.html'); pg.wait_for_timeout(2500)
    pg.click('[data-m=start]'); pg.evaluate("window.__dw.setSpeed(0)")
    pg.evaluate(SETUP)
    pg.evaluate("(() => { const S = window.__dw.S; for (let d = 0; d < 2 * 24 * 10; d++) { Sim.step(S, 0.1); if (S.meeting) Sim.meetingChoose(S, 'close'); } S.t = Math.floor(S.t / 24) * 24 + 24 + 12; window.__dw.world.syncAgents(); window.__dw.setSpeed(1); })()")
    pg.wait_for_timeout(15000)
    pg.evaluate("(() => { window.__dw.setSpeed(0); const W = window.__dw.world; const vis = W.agents.filter(a => !a.hidden && !a.waitUntil && !a.temp); const a = vis.find(a => a.anim === 'chop' || a.anim === 'dig') || vis.find(a => !a.path) || vis[0]; window.__pa = a; const c = window.__dw.cam; c.tx = a.x; c.tz = a.z; c.gdist = c.dist = 2.4; c.gpitch = c.pitch = 0.22; c.gyaw = c.yaw = a.ry + 0.6; return a.anim; })()")
    pg.wait_for_timeout(4000); pg.screenshot(path='shots/d9_person.png')
    print(pg.evaluate("(() => { const a = window.__pa; return [a.name, a.anim, a.tool, a.x, a.z, Sim.groundAt(window.__dw.S, a.x, a.z)]; })()"), errs)
    b.close()
