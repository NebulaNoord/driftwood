"""Raids stay within an era: a medieval player doesn't see a modern island, a modern one does."""
from playwright.sync_api import sync_playwright
import json
STORE = {}
def store(raw):
    a = json.loads(raw); op = a['op']
    if op == 'get': return json.dumps({'exists': True, 'data': STORE[a['path']]} if a['path'] in STORE else {'exists': False})
    if op == 'set': STORE[a['path']] = a['data']; return '{}'
    if op == 'delete': STORE.pop(a['path'], None); return '{}'
    if op == 'list': return json.dumps([{'id': p.rsplit('/', 1)[1], 'data': d} for p, d in STORE.items() if p.rsplit('/', 1)[0] == a['coll']])
errs = []
def page(p, uid, era):
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1100, 'height': 700}); pg.route('**/fonts.g*/**', lambda r: r.abort()); pg.expose_function('__mockStore', store)
    pg.on('pageerror', lambda e: errs.append(uid + ': ' + str(e)))
    pg.goto(f'file:///home/claude/colony/dist/mp.html?uid={uid}', wait_until='domcontentloaded', timeout=90000); pg.wait_for_timeout(2500)
    pg.click(f'[data-era={era}]'); pg.click('[data-m=start]'); pg.wait_for_timeout(1500); pg.evaluate("window.__dw.publishIsland(true)"); pg.wait_for_timeout(1500)
    return b, pg
with sync_playwright() as p:
    bA, A = page(p, 'player-one', 'modern'); bB, B = page(p, 'player-two', 'medieval'); bC, C = page(p, 'player-three', 'modern')
    print('stored eras', {k: v.get('era') for k, v in STORE.items()})
    for name, pg in [('medieval B', B), ('modern C', C)]:
        pg.click('[data-act=online]'); pg.wait_for_timeout(1500)
        print(name, 'sees', pg.evaluate("[...document.querySelectorAll('.isl b')].map(e => e.textContent.trim()).join(' | ')"))
    for b in (bA, bB, bC): b.close()
print('ERR', errs[:5])
