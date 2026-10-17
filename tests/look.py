import sys
from playwright.sync_api import sync_playwright
URL = 'file:///home/claude/colony/dist/test.html'
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 1280, 'height': 800})
    pg.on('console', lambda m: errs.append(m.text) if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.goto(URL); pg.wait_for_timeout(3000)
    pg.screenshot(path='shots/01_intro.png')
    if pg.is_visible('[data-m=start]'): pg.click('[data-m=start]')
    pg.wait_for_timeout(1500)
    pg.screenshot(path='shots/02_island.png')
    print('fps', pg.evaluate("new Promise(r => { let n = 0; const t0 = performance.now(); (function f() { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2); })(); })"))
    b.close()
print('\n'.join(errs[:20]))
