from playwright.sync_api import sync_playwright
SETUP = open('tests/life.py').read().split('SETUP = r"""')[1].split('"""')[0]
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    m = b.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2); errs = []
    m.on('pageerror', lambda e: errs.append(str(e)))
    m.add_init_script('(() => { let s = 777; Math.random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })()')
    m.goto('file:///home/claude/colony/dist/test.html'); m.wait_for_timeout(2500)
    m.tap('[data-m=start]'); m.evaluate("window.__dw.setSpeed(0)"); m.evaluate(SETUP)
    m.evaluate("""(() => { const S = window.__dw.S, W = window.__dw.world; for (let k = 0; k < 24 * 20; k++) { Sim.step(S, 0.05); const ev = S._ev.splice(0); W.handle(ev); if (ev.some(e => ['settlers','build','built'].includes(e.type))) W.syncAgents(); W.update(0.05, 0.05); } const h = S.b[0]; const [x, z] = Sim.center(h); const c = window.__dw.cam; c.tx = x; c.tz = z; c.gdist = c.dist = 14; window.__dw.setSpeed(1); })()""")
    m.wait_for_timeout(6000); m.screenshot(path='shots/110_m.png')
    m.tap('[data-act=chatToggle]'); m.wait_for_timeout(1500); m.screenshot(path='shots/111_m_chat.png')
    print('scrollW', m.evaluate('document.documentElement.scrollWidth'))
    b.close(); print('ERR', errs)
