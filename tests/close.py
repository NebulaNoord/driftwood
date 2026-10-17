from playwright.sync_api import sync_playwright
import sys
sys.path.insert(0, 'tests')
SETUP = open('tests/life.py').read().split('SETUP = r"""')[1].split('"""')[0]
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    errs = []
    for vp, name, mob in [((1280, 800), '91_close', False), ((390, 844), '92_mobile', True)]:
        pg = b.new_page(viewport={'width': vp[0], 'height': vp[1]}, is_mobile=mob, has_touch=mob)
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.add_init_script('(() => { let s = 777; Math.random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })()')
        pg.goto('file:///home/claude/colony/dist/test.html'); pg.wait_for_timeout(2500)
        pg.click('[data-m=start]'); pg.evaluate("window.__dw.setSpeed(0)")
        pg.evaluate(SETUP)
        pg.evaluate("(() => { const S = window.__dw.S; for (let d = 0; d < 3 * 24 * 10; d++) { Sim.step(S, 0.1); if (S.meeting) Sim.meetingChoose(S, 'close'); } window.__dw.world.syncAgents(); const m = S.b.find(b => b.type === 'market') || S.b[0]; const [x, z] = Sim.center(m); const c = window.__dw.cam; c.tx = x; c.tz = z; c.gdist = c.dist = 9; c.gpitch = c.pitch = 0.45; S.t = Math.floor(S.t / 24) * 24 + 24 + 12.2; window.__dw.setSpeed(1); })()")
        pg.wait_for_timeout(9000)
        pg.screenshot(path=f'shots/{name}.png')
        if mob:
            pg.evaluate("(() => { const S = window.__dw.S; let d = Math.floor(S.t / 24) + 1; while (d % 7 !== 6) d++; S.t = d * 24 + 16.95; })()")
            for k in range(60):
                pg.wait_for_timeout(500)
                if pg.is_visible('.opts'): break
            pg.wait_for_timeout(1500)
            pg.screenshot(path='shots/93_mobile_meeting.png')
            print('mobile scrollW', pg.evaluate('document.documentElement.scrollWidth'))
        pg.close()
    b.close(); print('ERR', errs)
