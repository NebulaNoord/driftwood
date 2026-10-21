"""Traffic in a modern town: vehicle mix, cars waiting at lights and in queues, a fire truck to a fire, day and night."""
from playwright.sync_api import sync_playwright
import sys, json
src = open('tests/gallery.py').read(); setup = src.split('out = pg.evaluate("""')[1].split('""", era)')[0]
errs = []
COUNT = """(() => { const W = window.__dw.world, o = {}; for (const v of W.vehicles || []) o[v.kind] = (o[v.kind] || 0) + 1;
  const cars = W.agents.filter(a => a.riding && a.path && !a.hidden);
  return { vehicles: o, residentCars: cars.length, waiting: (W.vehicles || []).concat(cars).filter(v => v.waitSince).length, lights: (W.streets || {}).tl ? W.streets.tl.length : 0, lamps: (W.streets || {}).lamps ? W.streets.lamps.length : 0, stops: (W.streets || {}).stops ? W.streets.stops.length : 0 }; })()"""
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1200, 'height': 800}); pg.set_default_timeout(180000); pg.route('**/fonts.g*/**', lambda r: r.abort())
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/colony/dist/test.html', wait_until='domcontentloaded', timeout=90000); pg.wait_for_timeout(3000)
    pg.click('[data-era=modern]'); pg.click('[data-m=start]'); pg.wait_for_timeout(1500); pg.evaluate("window.__dw.setSpeed(0)")
    print(pg.evaluate(setup, 'modern'))
    pg.evaluate("document.querySelectorAll('#goals,#chat,#hint,#dock').forEach(e => e.style.display = 'none')")
    # run the clock in small steps so the vehicles get going (the page itself is slow here)
    for k in range(40): pg.evaluate("(() => { const W = window.__dw.world, S = window.__dw.S; for (let i = 0; i < 6; i++) { Sim.step(S, 0.02); W.update(0.25, 0.02); } })()")
    print('after a while', pg.evaluate(COUNT))
    # set a fire away from any fire station and watch for a truck
    print('fire', pg.evaluate("""(() => { const S = window.__dw.S, W = window.__dw.world; const b = S.b.find(x => x.type === 'house' && Sim.done(x)); b.burnt = 1; b.fireAt = S.t; W.handle([{ type: 'fire', id: b.id }]); return (W.vehicles || []).filter(v => v.kind === 'firetruck').length; })()"""))
    for k in range(10): pg.evaluate("(() => { const W = window.__dw.world, S = window.__dw.S; for (let i = 0; i < 6; i++) { Sim.step(S, 0.02); W.update(0.25, 0.02); } })()")
    pg.evaluate("window.__dw.setSpeed(1)")
    for name, hour in [('day', 9.5), ('night', 21.5)]:
        pg.evaluate(f"""(() => {{ const S = window.__dw.S, c = window.__dw.cam, h = S.b.find(b => b.type === 'hall'), [x, z] = Sim.center(h); S.t = Math.floor(S.t / 24) * 24 + {hour}; c.tx = x + 1; c.tz = z + 1; c.gdist = c.dist = 13; c.gpitch = c.pitch = 0.78; c.gyaw = c.yaw = 0.9; }})()""")
        pg.wait_for_timeout(6000); pg.screenshot(path=f'shots/tr_{name}.png')
        print(name, pg.evaluate(COUNT))
    b.close()
print('ERR', errs[:5])
