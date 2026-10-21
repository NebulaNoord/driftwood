"""Modern interface: power meter, rank badge and ladder, rank-up celebration, modern build menu, leaderboard."""
from playwright.sync_api import sync_playwright
import json
STORE = {}
def store(raw):
    a = json.loads(raw); op = a['op']
    if op == 'get': return json.dumps({'exists': True, 'data': STORE[a['path']]} if a['path'] in STORE else {'exists': False})
    if op == 'set': STORE[a['path']] = a['data']; return '{}'
    if op == 'delete': STORE.pop(a['path'], None); return '{}'
    if op == 'list': return json.dumps([{'id': p.rsplit('/', 1)[1], 'data': d} for p, d in STORE.items() if p.rsplit('/', 1)[0] == a['coll']])
for k, (pop, era) in {'player-two': (240, 'modern'), 'player-three': (75, 'modern'), 'player-four': (500, 'medieval')}.items():
    STORE['islands/' + k] = {'v': 1, 'owner': k, 'name': k.replace('player-', '').title() + ' Bay', 'pop': pop, 'era': era, 'at': 1, 'day': 9, 'towers': 1, 'guards': 1}
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1280, 'height': 800}); pg.set_default_timeout(180000); pg.route('**/fonts.g*/**', lambda r: r.abort()); pg.expose_function('__mockStore', store)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/colony/dist/mp.html?uid=player-one', wait_until='domcontentloaded', timeout=90000); pg.wait_for_timeout(3000)
    pg.click('[data-era=modern]'); pg.click('[data-m=start]'); pg.wait_for_timeout(2000)
    print('bar', pg.evaluate("[...document.querySelectorAll('#res .r')].map(e => e.innerText.replace(/\\n/g, ' ')).join(' | ')"))
    print('dock', pg.evaluate("[...document.querySelectorAll('#dock .cat span')].map(e => e.textContent).join(', ')"))
    pg.click('[data-cat=shops]'); pg.wait_for_timeout(800); print('shops', pg.evaluate("[...document.querySelectorAll('#tray .item b')].map(e => e.textContent).join(', ')")); pg.screenshot(path='shots/ui_shops.png')
    pg.click('[data-cat=power]'); pg.wait_for_timeout(800); print('utilities', pg.evaluate("[...document.querySelectorAll('#tray .item b')].map(e => e.textContent).join(', ')"))
    pg.click('[data-cat=select]'); pg.click('#res [data-r=rank]'); pg.wait_for_timeout(1200); print('ranks', pg.evaluate("[...document.querySelectorAll('.ranks li b')].map(e => e.textContent).join(' > ')")); pg.screenshot(path='shots/ui_ranks.png')
    pg.click('#modal [data-m=close]'); pg.wait_for_timeout(500)
    pg.evaluate("(() => { const S = window.__dw.S; S._ev.push({ type: 'rankup', rank: 3, gold: 500 }); })()"); pg.wait_for_timeout(2500)
    print('rankup', pg.evaluate("document.querySelector('.rankup h2') && document.querySelector('.rankup').innerText.replace(/\\n+/g, ' / ')")); pg.screenshot(path='shots/ui_rankup.png')
    pg.click('#modal [data-m=close]'); pg.wait_for_timeout(500)
    pg.click('[data-act=online]'); pg.wait_for_timeout(2500); print('leaderboard', pg.evaluate("[...document.querySelectorAll('.lb li')].map(e => e.innerText.replace(/\\n/g, ' ')).join(' | ')")); pg.screenshot(path='shots/ui_lb.png')
    b.close()
print('ERR', errs[:5])
