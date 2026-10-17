from playwright.sync_api import sync_playwright
URL = 'file:///home/claude/colony/dist/test.html'
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    m = b.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    m.on('pageerror', lambda e: errs.append(str(e)))
    m.goto(URL); m.wait_for_timeout(3000)
    m.screenshot(path='shots/30_m_intro.png')
    m.tap('[data-m=start]'); m.wait_for_timeout(1500)
    m.screenshot(path='shots/31_m_island.png')
    m.tap('[data-cat=work]'); m.wait_for_timeout(800)
    m.screenshot(path='shots/32_m_tray.png')
    m.tap('[data-cat=work]'); m.wait_for_timeout(300)
    m.evaluate("(() => { window.__dw.UI.sel = window.__dw.S.b[0].id; })()"); m.wait_for_timeout(800)
    m.screenshot(path='shots/33_m_insp.png')
    print('scrollW', m.evaluate('document.documentElement.scrollWidth'), 'tool', m.evaluate('window.__dw.UI.tool'))
    b.close()
print('ERR', errs)
