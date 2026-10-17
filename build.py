import pathlib
root = pathlib.Path(__file__).parent
html = (root/'src/index.html').read_text()
parts = {k: (root/f'src/{f}').read_text() for k, f in [('SIM','sim.js'),('GL','gl.js'),('WORLD','world.js'),('RAID','raid.js'),('APP','app.js')]}
parts['WORLD'] = parts['WORLD'].replace('/*MODERN_MODELS*/', (root/'src/modern_models.js').read_text())
parts['APP'] = parts['APP'].replace('/*ONLINE*/', (root/'src/online.js').read_text())
for k, v in parts.items():
    assert '</script' not in v, k
    html = html.replace(f'/*{k}*/', v)
# background music: embedded in the single-file builds, served as files on the web build
import base64, json, shutil
TRACKS = ['spring', 'tavern', 'brew', 'night', 'rain', 'lounge']
embedded = json.dumps({t: 'data:audio/mp4;base64,' + base64.b64encode((root/f'music/{t}.m4a').read_bytes()).decode() for t in TRACKS})
linked = json.dumps({t: [f'/music/{t}.m4a', f'/music/{t}.webm'] for t in TRACKS})
web_html = html.replace('/*MUSIC*/null', linked)
html = html.replace('/*MUSIC*/null', embedded)
(root/'dist').mkdir(exist_ok=True)
(root/'dist/driftwood.html').write_text(html)
mock = (root/'tests/mockclaude.js').read_text()
(root/'dist/test.html').write_text('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body style="margin:0">' + html + '</body></html>')
(root/'dist/mp.html').write_text('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><script>' + mock + '</script></head><body style="margin:0">' + html + '</body></html>')
print('built', len(html)//1024, 'KB')
# the open-web build for Vercel: same game, with web/adapter.js standing in for the Claude store
adapter = (root/'web/adapter.js').read_text()
assert '</script' not in adapter
head = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<title>Driftwood</title><meta name="description" content="Build an island colony, raise an army and raid other players’ islands. No account needed.">'
        '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2290%22%3E%E2%9B%B5%3C/text%3E%3C/svg%3E">'
        '<script>' + adapter + '</script></head><body style="margin:0">')
(root/'public').mkdir(exist_ok=True)
(root/'public/index.html').write_text(head + web_html + '</body></html>')
(root/'public/music').mkdir(exist_ok=True)
for t in TRACKS:
    for ext in ('m4a', 'webm'): shutil.copy(root/f'music/{t}.{ext}', root/f'public/music/{t}.{ext}')
shutil.copy(root/'music/LICENSE.txt', root/'public/music/LICENSE.txt')
print('web build', len(head + web_html)//1024, 'KB')
