from playwright.sync_api import sync_playwright
import json
SETUP = open('tests/life.py').read().split('SETUP = r"""')[1].split('"""')[0]
STORE = {}
def store(raw):
    a = json.loads(raw); op = a['op']
    if op == 'get': return json.dumps({'exists': True, 'data': STORE[a['path']]} if a['path'] in STORE else {'exists': False})
    if op == 'set': STORE[a['path']] = a['data']; return '{}'
    if op == 'delete': STORE.pop(a['path'], None); return '{}'
    if op == 'list': return json.dumps([{'id': p.rsplit('/', 1)[1], 'data': d} for p, d in STORE.items() if p.rsplit('/', 1)[0] == a['coll']])
errs = []
def open_page(p):
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width': 1100, 'height': 700}, accept_downloads=True); ctx.route('**/fonts.g*/**', lambda r: r.abort())
    pg = ctx.new_page(); pg.expose_function('__mockStore', store); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and errs.append('console: ' + m.text))
    pg.goto('file:///home/claude/colony/dist/mp.html?uid=player-one', wait_until='domcontentloaded', timeout=90000); pg.wait_for_timeout(2500)
    return b, pg
cards = lambda pg: pg.evaluate("[...document.querySelectorAll('.card-isl')].map(c => (c.querySelector('.tag')||{}).textContent + '|' + c.querySelector('b').textContent).join(' ; ')")
with sync_playwright() as p:
    b, pg = open_page(p)
    pg.click('[data-m=start]'); pg.evaluate("window.__dw.setSpeed(0)"); pg.evaluate(SETUP)
    n0 = pg.evaluate("window.__dw.S.b.length"); print('buildings', n0)
    pg.click('[data-act=menu]'); pg.wait_for_timeout(800); pg.click('[data-m=saves]'); pg.wait_for_timeout(2500)
    print('page open', pg.evaluate("!document.querySelector('#isles').hidden"), 'modal hidden', pg.evaluate("document.querySelector('#modal').hidden"))
    pg.fill('#slotName', 'My first town'); pg.click('[data-ol=slotSave]'); pg.wait_for_timeout(2500)
    print('cloud saves', [k for k in STORE if k.startswith('data/users/')])
    print('cards', cards(pg)); pg.screenshot(path='shots/s1_page.png')
    with pg.expect_download() as dl: pg.click('[data-ol=export]')
    path = '/tmp/claude-0/-home-claude/a96d8430-bd1d-5d3f-82a5-89c71e493e7e/scratchpad/export.json'; dl.value.save_as(path); print('exported', dl.value.suggested_filename, len(open(path).read()))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(400); print('closed by esc', pg.evaluate("document.querySelector('#isles').hidden"))
    # build a bit more, then start a new island: the old one is kept automatically
    pg.evaluate("window.__dw.S.gold += 777"); g_old = pg.evaluate("Math.round(window.__dw.S.gold)")
    pg.click('[data-act=menu]'); pg.wait_for_timeout(600); pg.click('[data-m=new]'); pg.wait_for_timeout(300); pg.click('[data-m=new]'); pg.wait_for_timeout(2000)
    print('auto kept', [k for k in STORE if 'save-auto' in k])
    # the intro has a Your islands button
    pg.click('#modal [data-m=saves]'); pg.wait_for_timeout(2500)
    print('cards after new', cards(pg)); pg.screenshot(path='shots/s2_page.png')
    # load the auto save (two taps) -> the old island with the extra gold
    pg.click('.card-isl:has(.tag:text("Auto")) [data-ol^="slotLoad:"]'); pg.wait_for_timeout(300)
    print('armed', pg.evaluate("document.querySelector('.card-isl [data-ol^=slotLoad].primary').textContent"))
    pg.click('.card-isl:has(.tag:text("Auto")) [data-ol^="slotLoad:"]'); pg.wait_for_timeout(2500)
    print('after load', pg.evaluate("window.__dw.S.b.length"), 'expected', n0, 'gold', pg.evaluate("Math.round(window.__dw.S.gold)"), 'expected', g_old)
    print('modal after load', pg.evaluate("document.querySelector('#modal').hidden"), 'page hidden', pg.evaluate("document.querySelector('#isles').hidden"))
    pg.screenshot(path='shots/s3_loaded.png')
    b.close()
    # a fresh browser session sees the same saves and can delete one
    b, pg = open_page(p)
    pg.click('#modal [data-m=saves]'); pg.wait_for_timeout(3000); print('fresh session cards', cards(pg))
    pg.click('.card-isl:has(b:text("My first town")) [data-ol^="slotDel:"]'); pg.wait_for_timeout(300)
    pg.click('.card-isl:has(b:text("My first town")) [data-ol^="slotDel:"]'); pg.wait_for_timeout(1500)
    print('after delete', cards(pg), [k for k in STORE if k.startswith('data/users/')])
    pg.click('[data-ol=pageClose]'); pg.wait_for_timeout(300)
    pg.click('[data-m=start]'); pg.click('[data-act=menu]'); pg.wait_for_timeout(600); pg.click('[data-m=saves]'); pg.wait_for_timeout(2000)
    print('state', pg.evaluate("[document.querySelector('#isles').innerHTML.length, getComputedStyle(document.querySelector('#isles')).display, getComputedStyle(document.querySelector('#isles')).opacity, document.querySelector('#isles').getBoundingClientRect().height, !!document.querySelector('#olFile'), document.querySelector('#isles').hidden, document.querySelector('#modal').hidden, (document.querySelector('#modal h2')||{}).textContent]")); pg.screenshot(path='shots/s_dbg.png')
    with pg.expect_file_chooser() as fc: pg.click('[data-ol=import]')
    fc.value.set_files(path); pg.wait_for_timeout(2500)
    print('after import buildings', pg.evaluate("window.__dw.S.b.length"), 'expected', n0)
    pg.set_viewport_size({'width': 390, 'height': 800}); pg.click('[data-act=menu]'); pg.wait_for_timeout(500); pg.click('[data-m=saves]'); pg.wait_for_timeout(2500)
    pg.screenshot(path='shots/s4_mobile.png'); print('mobile overflow', pg.evaluate("document.querySelector('#isles').scrollWidth > innerWidth"))
    b.close()
print('ERR', errs[:6])
