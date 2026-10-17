global.window = global;
global.Sim = require('../src/sim.js');
global.GL = { Builder: class { constructor(){this.p=[];this.n=[];this.c=[];} at(){return this;} tri(){return this;} quad(){return this;} box(){return this;} gable(){return this;} cyl(){return this;} blob(){return this;} beam(){return this;} }, hex: () => [1,1,1], M4: {} };
require('../src/world.js');
const R = { waterMesh: () => ({}), mesh: () => ({}), meshFromData: () => ({}), setHeights(){} };
const W = new World(R); W.sfx = () => {};
const S = Sim.newGame(4242); W.setState(S);
const N = 96;
let seed = 3; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const conn = () => { const o = []; for (let c = 0; c < N*N; c++) if (S._conn[c]) o.push([c % N, (c / N) | 0]); return o; };
S.wood = 9999; S.gold = 99999; S.stone = 9999;
for (const k of Sim.BUILDABLE) S.goals['unlock_' + k] = 1;
for (let k = 0; k < 8; k++) { const rc = conn(); for (let a = 0; a < 60; a++) { const [i, j] = rc[Math.floor(rand()*rc.length)]; const d = Sim.DIRS[Math.floor(rand()*4)]; const cells = Sim.roadPath([i,j],[i+d[0]*7,j+d[1]*7]); const q = Sim.roadQuote(S, cells); if (q.n >= 5 && !q.blocked) { Sim.buildRoad(S, cells); break; } } }
const placed = {};
const tryPlace = t => { const rc = conn(); const s = Sim.TYPES[t].size; for (let a = 0; a < 800; a++) { const [i,j] = rc[Math.floor(rand()*rc.length)]; const o = [[1,0],[-s,0],[0,1],[0,-s]][Math.floor(rand()*4)]; const r = Sim.place(S, t, i+o[0], j+o[1], Math.floor(rand()*4)); if (r.building) { placed[t] = (placed[t]||0)+1; return true; } } return false; };
for (let k = 0; k < 14; k++) tryPlace('house');
for (const t of ['farm','orchard','lumber','market','well','garden','tavern','stable','school','chapel']) tryPlace(t);
console.log('placed', JSON.stringify(placed));
const stats = { maxVis: 0, bubbles: 0, carts: 0, riders: 0, builders: 0, porters: 0, kinds: {}, meetVisible: 0 };
const texts = new Set();
for (let f = 0; f < 24 * 9 * 20; f++) {
  Sim.step(S, 0.05);
  if (S.meeting) { const m = S.meeting; console.log('meeting day', m.day, 'opts', m.opts.map(o => o.id).join(','), 'report', JSON.stringify(m.report)); Sim.meetingChoose(S, m.opts[0].id); }
  const evs = S._ev.splice(0); W.handle(evs);
  if (evs.some(e => ['settlers','demolish','leave','build','level','built'].includes(e.type))) W.syncAgents();
  W.update(0.05, 0.05);
  const vis = W.agents.filter(a => !a.hidden && !a.waitUntil);
  stats.maxVis = Math.max(stats.maxVis, vis.length);
  for (const a of vis) { const k = (a.act && a.act.kind) || a.temp || '?'; stats.kinds[k] = (stats.kinds[k]||0) + 1; if (a.riding) stats.riders++; }
  stats.carts = Math.max(stats.carts, W.carts.length);
  stats.builders = Math.max(stats.builders, W.agents.filter(a => a.temp === 'builder').length);
  stats.porters = Math.max(stats.porters, W.agents.filter(a => a.temp === 'porter').length);
  for (const b of W.bubbles) texts.add(b.text);
  if (W.lastCtx && W.lastCtx.meeting && S.t % 24 > 16.5) stats.meetVisible = Math.max(stats.meetVisible, vis.filter(a => a.act && a.act.kind === 'meet' && !a.path).length);
  for (const a of W.agents) if (!isFinite(a.x) || !isFinite(a.z)) { console.log('NaN agent', a); process.exit(1); }
}
console.log('pop', Sim.pop(S), 'agents', W.agents.length, 'weather', S.weather, 'happy', S.happy);
console.log(JSON.stringify(stats));
console.log('sample bubbles:', [...texts].slice(0, 25).join(' | '));
const a0 = W.agents.find(a => !a.temp && !a.kid), k0 = W.agents.find(a => a.kid);
console.log('card:', a0.name, '-', W.jobOf(a0), '-', W.doingOf(a0), '|', k0 && (k0.name + ' - ' + W.jobOf(k0) + ' - ' + W.doingOf(k0)));
// who is where at noon on a weekday
S.t = Math.floor(S.t / 24) * 24 + 24 * 2 + 9; while (Math.floor(S.t / 24) % 7 >= 5) S.t += 24;
for (let f = 0; f < 80; f++) { Sim.step(S, 0.05); const ev2 = S._ev.splice(0); W.handle(ev2); W.update(0.05, 0.05); }
const vis = W.agents.filter(a => !a.hidden && !a.waitUntil);
const by = {}; for (const a of vis) { const k = (a.act && a.act.kind) + (a.path ? '(walking)' : '') + (a.act && a.act.b ? ':' + a.act.b.type : ''); by[k] = (by[k] || 0) + 1; }
console.log('t', (S.t % 24).toFixed(1), 'visible', vis.length, 'of', W.agents.length, JSON.stringify(by));
const m = S.b.find(b => b.type === 'market'); const [mx, mz] = Sim.center(m);
console.log('near market', vis.filter(a => Math.hypot(a.x - mx, a.z - mz) < 3).length);
