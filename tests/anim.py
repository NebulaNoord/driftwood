"""Animations: turbine blades, a crane over a site, the stadium crowd, the plane's circuit, power-plant steam."""
from playwright.sync_api import sync_playwright
src = open('tests/newmodels.py').read(); place = src.split('placed = pg.evaluate("""')[1].split('""", NEW)')[0]
NEW = ['windturbine', 'stadium', 'airfield', 'powerplant', 'office']
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1100, 'height': 750}); pg.set_default_timeout(180000); pg.route('**/fonts.g*/**', lambda r: r.abort())
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/colony/dist/test.html', wait_until='domcontentloaded', timeout=90000); pg.wait_for_timeout(3000)
    pg.click('[data-era=modern]'); pg.click('[data-m=start]'); pg.wait_for_timeout(1500); pg.evaluate("window.__dw.setSpeed(0)")
    pg.evaluate("document.querySelectorAll('#goals,#chat,#hint,#dock').forEach(e => e.style.display = 'none')")
    placed = dict(pg.evaluate(place, NEW)); print('placed', placed)
    # crew everything, make it Saturday 15:00, and leave the office half built
    pg.evaluate("""(() => { const S = window.__dw.S; for (const b of S.b) if (Sim.TYPES[b.type].jobs) b.staff = Sim.TYPES[b.type].jobs; const o = S.b.find(b => b.type === 'office'); o.build = 0.45; S.t = (Math.floor(S.t / 24 / 7) * 7 + 12) * 24 + 15; })()""")
    def look(bid, d, pitch, name, wait=3000, dy=0.5):
        pg.evaluate(f"""(() => {{ const S = window.__dw.S, b = S.b.find(x => x.id === {bid}), [x, z] = Sim.center(b), c = window.__dw.cam; c.tx = x; c.tz = z; c.ty = b.y + {dy}; c.gdist = c.dist = {d}; c.gpitch = c.pitch = {pitch}; c.gyaw = c.yaw = b.rot * Math.PI / 2 + 0.7; }})()""")
        pg.wait_for_timeout(wait); pg.screenshot(path=f'shots/an_{name}.png')
    look(placed['windturbine'], 9, 0.35, 'turbine1', dy=1.6); pg.wait_for_timeout(600); pg.screenshot(path='shots/an_turbine2.png')
    look(placed['office'], 9, 0.55, 'crane', dy=1)
    look(placed['stadium'], 9, 0.75, 'stadium')
    look(placed['powerplant'], 8, 0.5, 'steam', wait=5000)
    found = None
    for k in range(30):
        pose = pg.evaluate(f"(() => {{ const W = window.__dw.world; return W.planePose(W.now + {placed['airfield']} * 7); }})()")
        if pose and pose[2] > 1.5 and pose[2] < 7: found = pose; break
        pg.wait_for_timeout(1000)
    print('plane pose', found)
    look(placed['airfield'], 26, 0.6, 'plane', wait=500, dy=3)
    b.close()
print('ERR', errs[:5])
