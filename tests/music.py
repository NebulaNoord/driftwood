"""Background music: starts after the first tap, rotates by day, switches at night and in rain, ducks for raids, and the menu slider works."""
from playwright.sync_api import sync_playwright
import subprocess, time
srv = subprocess.Popen(['node', 'tests/webserver.js', '8790']); time.sleep(1)
errs = []
ST = "(() => { const M = window.__dw.Music, c = window.__dw.Sfx.ctx; return { cur: M.cur && M.cur.name, want: M.want, mood: M.mood, fmt: M.fmt, level: +M.level.toFixed(3), loopEnd: M.cur && +M.cur.src.loopEnd.toFixed(3), dur: M.cur && +M.cur.src.buffer.duration.toFixed(3), state: c && c.state, decoded: Object.keys(M.buffers) }; })()"
try:
  with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 1100, 'height': 700}); pg.route('**/fonts.g*/**', lambda r: r.abort())
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8790/', wait_until='domcontentloaded'); pg.wait_for_timeout(3000)
    print('aac decodes here?', pg.evaluate("(async () => { const c = new AudioContext(); try { await c.decodeAudioData(await (await fetch('/music/spring.m4a')).arrayBuffer()); return true; } catch (e) { return false; } })()"))
    print('before tap', pg.evaluate(ST))
    pg.click('[data-m=start]'); pg.wait_for_timeout(4000)
    print('after tap', pg.evaluate(ST))
    pg.evaluate("window.__dw.S.t = Math.floor(window.__dw.S.t / 24) * 24 + 22; window.__dw.Music.moodAt = -1e9"); pg.wait_for_timeout(4000)
    print('night', pg.evaluate(ST))
    pg.evaluate("window.__dw.S.t = Math.floor(window.__dw.S.t / 24) * 24 + 34; window.__dw.S.weather = 'rain'; window.__dw.Music.moodAt = -1e9"); pg.wait_for_timeout(4000)
    print('rain', pg.evaluate(ST))
    pg.evaluate("window.__dw.S.weather = 'sun'; window.__dw.Music.moodAt = -1e9"); pg.wait_for_timeout(4000)
    print('day again', pg.evaluate(ST))
    pg.evaluate("window.__dw.Music.cur.start -= 200"); pg.wait_for_timeout(4000)
    print('rotated', pg.evaluate(ST))
    pg.click('[data-act=menu]'); pg.wait_for_timeout(500); pg.screenshot(path='shots/m1_menu.png')
    pg.fill('#musicVol', '0'); pg.wait_for_timeout(1500); print('slider 0', pg.evaluate(ST), pg.inner_text('#musicPct'))
    pg.fill('#musicVol', '80'); pg.wait_for_timeout(3000); print('slider 80', pg.evaluate(ST), pg.inner_text('#musicPct'))
    pg.evaluate("window.__dw.UI.meetingOpen = true"); pg.wait_for_timeout(4000); print('meeting duck', pg.evaluate(ST)['level']); pg.evaluate("window.__dw.UI.meetingOpen = false")
    pg.reload(); pg.wait_for_timeout(2500); print('pref kept', pg.evaluate("window.__dw.UI.music"))
    b.close()
finally: srv.kill()
print('ERR', errs[:5])
