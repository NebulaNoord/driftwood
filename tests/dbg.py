from playwright.sync_api import sync_playwright
URL = 'file:///home/claude/colony/dist/test.html'
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 900, 'height': 600})
    pg.on('pageerror', lambda e: print('ERR', e))
    pg.goto(URL); pg.wait_for_timeout(2500)
    pg.click('[data-m=start]')
    pg.evaluate("(() => { const d = window.__dw; d.setSpeed(0); d.S.t = 12; d.cam.gdist = 70; d.cam.gpitch = 1.0; })()")
    pg.wait_for_timeout(2500)
    pg.screenshot(path='shots/d1_noon.png')
    pg.evaluate("(() => { const R = window.__dw.world; const gl = document.getElementById('gl').getContext('webgl2'); window.__noShadow = true; })()")
    b.close()
