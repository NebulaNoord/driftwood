from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1280, 'height': 800})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/colony/dist/test.html'); pg.wait_for_timeout(2500); pg.click('[data-m=start]')
    pg.click('#res'); pg.wait_for_timeout(1200)
    print('visible', pg.is_visible('#stock'), pg.evaluate("getComputedStyle(document.getElementById('stock')).display"), pg.evaluate("JSON.stringify(document.getElementById('stock').getBoundingClientRect())"))
    pg.screenshot(path='colony/shots/90_stock.png')
    b.close(); print(errs)
