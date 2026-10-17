const Sim = require('../src/sim.js');
const { N } = Sim;
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok -', m); };
const seed = +(process.argv[2] || 7), days = +(process.argv[3] || 20), showMap = process.argv[4] !== 'nomap';
const S = Sim.newGame(seed);

function ascii() {
  const rows = [];
  for (let j = 0; j < N; j += 2) {
    let s = '';
    for (let i = 0; i < N; i++) {
      const c = Sim.ci(i, j), k = Sim.cellKind(S, i, j);
      s += S.occ[c] ? '#' : S.road[c] ? '=' : S.tree[c] ? (S.treeG[c] >= 255 ? 'T' : 't') : '~.,^'[k];
    }
    rows.push(s);
  }
  return rows.join('\n');
}
if (showMap) console.log(ascii());
const hall = S.b[0];
console.log('hall', hall.i, hall.j, 'rot', hall.rot, 'pop', Sim.pop(S), 'landing', S.landing);

// bot helpers
function roadCells() { const out = []; for (let c = 0; c < N * N; c++) if (S._conn[c]) out.push([c % N, (c / N) | 0]); return out; }
function tryPlaceNearRoad(type, tries = 400) {
  const rc = roadCells();
  for (let a = 0; a < tries; a++) {
    const [ri, rj] = rc[Math.floor(Math.random() * rc.length)];
    const s = Sim.TYPES[type].size;
    const offs = [[1, 0], [-s, 0], [0, 1], [0, -s]];
    const [oi, oj] = offs[Math.floor(Math.random() * 4)];
    const r = Sim.place(S, type, ri + oi, rj + oj, Math.floor(Math.random() * 4));
    if (r.building) return r.building;
  }
  return null;
}
function extendRoad(len) {
  const rc = roadCells();
  for (let a = 0; a < 50; a++) {
    const [i, j] = rc[Math.floor(Math.random() * rc.length)];
    const d = Sim.DIRS[Math.floor(Math.random() * 4)];
    const cells = Sim.roadPath([i, j], [i + d[0] * len, j + d[1] * len]);
    const q = Sim.roadQuote(S, cells);
    if (q.n >= len * 0.7 && !q.blocked) { const r = Sim.buildRoad(S, cells); if (!r.error) return true; }
  }
  return false;
}
function tryCoastal(type) {
  for (let j = 2; j < N - 3; j++) for (let i = 2; i < N - 3; i++) {
    const c = Sim.canPlace(S, type, i, j, 0);
    if (!c.ok) continue;
    // only if close to road
    const near = Sim.around({ type, i, j, rot: c.rot }).some(([x, y]) => S._conn[Sim.ci(x, y)]);
    if (!near) continue;
    return Sim.place(S, type, i, j, c.rot).building;
  }
  return null;
}
Math.random = (() => { let s = 12345; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();

extendRoad(8); extendRoad(8);
for (let k = 0; k < 3; k++) tryPlaceNearRoad('house');
tryPlaceNearRoad('lumber');
tryPlaceNearRoad('farm');
console.log('goals', Object.keys(S.goals).join(','), 'gold', Math.round(S.gold), 'wood', Math.round(S.wood));
for (let d = 1; d <= days; d++) {
  for (let h = 0; h < 24; h++) {
    Sim.step(S, 1);
    if (S.meeting) { console.log('  meeting day', S.meeting.day, JSON.stringify(S.meeting.report), S.meeting.opts.map(o => o.id).join('|')); Sim.meetingChoose(S, S.meeting.opts[0].id); }
    if (S.gold > 40 && Math.random() < 0.15) extendRoad(5 + Math.floor(Math.random() * 5));
    if (S.wood > 25 && Math.random() < 0.3 && Sim.capacity(S, true) - Sim.pop(S) < 6) tryPlaceNearRoad('house');
    if (Sim.pop(S) > 12 * (S.b.filter(b => b.type === 'farm' || b.type === 'dock').length) && S.wood > 30 && S.gold > 30 && Math.random() < 0.2) {
      if (!tryCoastal('dock')) tryPlaceNearRoad('farm');
    }
    if (S.b.filter(b => b.type === 'lumber').length < 1 + Sim.pop(S) / 30 && S.gold > 30 && Math.random() < 0.1) tryPlaceNearRoad('lumber');
    if (Sim.pop(S) >= 20 && S.b.filter(b => b.type === 'market').length < 1 + Sim.pop(S) / 60 && Math.random() < 0.2) tryPlaceNearRoad('market');
    if (Sim.pop(S) >= 25 && S.b.filter(b => b.type === 'quarry').length < 1 && Math.random() < 0.3) tryPlaceNearRoad('quarry', 2000);
    if (Sim.pop(S) >= 30 && S.b.filter(b => b.type === 'well').length < Sim.pop(S) / 25 && Math.random() < 0.2) tryPlaceNearRoad('well');
    if (Sim.pop(S) >= 60 && S.b.filter(b => b.type === 'chapel').length < 1 && Math.random() < 0.2) tryPlaceNearRoad('chapel');
    if (Sim.pop(S) >= 80 && S.b.filter(b => b.type === 'port').length < 1 && Math.random() < 0.2) tryCoastal('port');
  }
  const counts = {}; for (const b of S.b) counts[b.type] = (counts[b.type] || 0) + 1;
  const lv = S.b.filter(b => b.type === 'house').map(b => b.level);
  const R = S.rates; console.log(`day ${d} ${Sim.WEEKDAYS[(d-1)%7].slice(0,3)} ${S.weather}: food ${R.food.make.toFixed(1)}-${R.food.use.toFixed(1)}/h wood +${R.wood.make.toFixed(1)}/h stone +${R.stone.make.toFixed(1)}/h gold +${R.gold.make.toFixed(1)}/h | pop ${Sim.pop(S)}/${Sim.capacity(S, true)} happy ${S.happy} gold ${Math.round(S.gold)} wood ${Math.round(S.wood)} stone ${Math.round(S.stone)} food ${Math.round(S.food)} starving ${S.starving} idle ${S.idle} lv ${[0, 1, 2].map(l => lv.filter(x => x === l).length).join('/')} ${JSON.stringify(counts)} goals ${Object.keys(S.goals).filter(k => !k.startsWith('unlock')).length}`);
}
const lumber = S.b.filter(b => b.type === 'lumber').map(b => b.status || 'ok');
console.log('lumber status', lumber.join(','), 'trees', S.tree.reduce((a, x) => a + (x ? 1 : 0), 0));
const statuses = {}; for (const b of S.b) if (b.status) statuses[b.status] = (statuses[b.status] || 0) + 1;
console.log('statuses', statuses);
const s1 = JSON.stringify(Sim.serialize(S));
const S2 = Sim.deserialize(JSON.parse(s1));
assert(JSON.stringify(Sim.serialize(S2)) === s1, 'save round trip');
Sim.step(S, 30); Sim.step(S2, 30);
assert(Math.abs(S.gold - S2.gold) < 1e-6 && Sim.pop(S) === Sim.pop(S2), 'reloaded game continues identically');
// brushes
const g0 = S.gold;
const [hx, hz] = Sim.center(hall);
const r1 = Sim.brush(S, 'raise', hx + 10, hz + 10, 3, 0.5);
assert(!r1.error && S.gold < g0, 'raise brush costs gold');
const before = Sim.cellH(S, hall.i, hall.j);
Sim.brush(S, 'lower', hx, hz, 4, 2);
assert(Sim.cellH(S, hall.i, hall.j) === before, 'buildings lock the ground beneath them');
let bad = false; try { Sim.deserialize({ v: 1, seed: 3, h: 'xx' }); } catch (e) { bad = true; }
assert(bad, 'rejects damaged saves');
if (showMap) console.log(ascii());
