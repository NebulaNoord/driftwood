from playwright.sync_api import sync_playwright
URL = 'file:///tmp/claude-0/-home-claude/a96d8430-bd1d-5d3f-82a5-89c71e493e7e/scratchpad/t2.html'
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 700, 'height': 450})
    pg.goto(URL); pg.wait_for_timeout(2500)
    pg.click('[data-m=start]')
    pg.evaluate("(() => { const d = window.__dw; d.setSpeed(0); d.S.t = 12; d.cam.gdist = 60; d.cam.gpitch = 1.0; window.__ns = true; })()")
    pg.wait_for_timeout(2500)
    pg.screenshot(path='shots/d2_noshadow.png')
    b.close()
