from playwright.sync_api import sync_playwright
SETUP = open('tests/life.py').read().split('SETUP = r"""')[1].split('"""')[0]
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1200, 'height': 760})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script('(() => { let s = 777; Math.random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })()')
    pg.goto('file:///home/claude/colony/dist/test.html'); pg.wait_for_timeout(2500)
    pg.click('[data-m=start]'); pg.evaluate("window.__dw.setSpeed(0)")
    pg.evaluate(SETUP)
    pg.evaluate("(() => { const S = window.__dw.S; for (let d = 0; d < 2 * 24 * 10; d++) { Sim.step(S, 0.1); if (S.meeting) Sim.meetingChoose(S, 'close'); } S.t = Math.floor(S.t / 24) * 24 + 24 + 11; S.weather = 'rain'; window.__dw.world.syncAgents(); const h = S.b[0], [x, z] = Sim.center(h), c = window.__dw.cam; c.tx = x; c.tz = z; c.gdist = c.dist = 20; window.__dw.setSpeed(1); })()")
    pg.wait_for_timeout(25000)
    pg.screenshot(path='shots/d10_rain_chat.png')
    print('chat lines', pg.evaluate("window.__dw.world.chat.length"), pg.inner_text('#chat')[:300].replace('\n', ' | '))
    # click a chat line -> selects that settler
    if pg.evaluate("document.querySelectorAll('[data-chat]').length"):
        pg.click('[data-chat]'); pg.wait_for_timeout(800)
        print('selected from chat:', pg.evaluate("window.__dw.UI.selAgent && window.__dw.UI.selAgent.name"))
    b.close(); print('ERR', errs)
