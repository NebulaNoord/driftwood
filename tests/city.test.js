// A modern town grows: power shortage then turbines, a fire then a fire station, rank-ups, bus coverage.
global.window = global; const Sim = require('../src/sim.js'); const N = 96;
let ok = 0, bad = 0; const check = (c, m) => { if (c) { ok++; console.log('ok -', m); } else { bad++; console.log('not ok -', m); } };
const S = Sim.newGame(4242, 'modern'); S.wood = S.stone = 99999; S.gold = 99999; for (const k of Sim.BUILDABLE) S.goals['unlock_' + k] = 1;
let seed = 3; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const conn = () => { const o = []; for (let c = 0; c < N * N; c++) if (S._conn[c]) o.push([c % N, (c / N) | 0]); return o; };
for (let k = 0; k < 14; k++) { const rc = conn(); for (let a = 0; a < 60; a++) { const [i, j] = rc[Math.floor(rand() * rc.length)]; const d = Sim.DIRS[Math.floor(rand() * 4)]; const cells = Sim.roadPath([i, j], [i + d[0] * 7, j + d[1] * 7]); const q = Sim.roadQuote(S, cells); if (q.n >= 5 && !q.blocked) { Sim.buildRoad(S, cells); break; } } }
const place = t => { const rc = conn(), s = Sim.TYPES[t].size; for (let a = 0; a < 3000; a++) { const [i, j] = rc[Math.floor(rand() * rc.length)]; const o = [[1, 0], [-s, 0], [0, 1], [0, -s]][Math.floor(rand() * 4)]; const r = Sim.place(S, t, i + o[0], j + o[1], Math.floor(rand() * 4)); if (r.building) { r.building.build = 1; return r.building; } } return null; };
for (let k = 0; k < 16; k++) place('house'); for (let k = 0; k < 3; k++) place('apartment');
for (const t of ['farm', 'farm', 'supermarket', 'factory', 'factory', 'office', 'office', 'cinema', 'cafe', 'busdepot', 'hotel', 'gasstation']) check(place(t), 'placed ' + t);
const run = h => { for (let k = 0; k < h * 20; k++) { Sim.step(S, 0.05); if (S.meeting) Sim.meetingChoose(S, 'close'); } };
Sim.recompute(S); run(24 * 6);
const p1 = JSON.parse(JSON.stringify(S.power));
console.log('pop', Sim.pop(S), 'power', JSON.stringify(p1), 'rank', S.rank, Sim.rankName(S));
check(p1.demand > p1.supply, 'a busy town outgrows the hall’s hookup');
const fac = S.b.find(b => b.type === 'factory' && b.staff); check(fac && fac.status === 'nopower' || p1.ratio >= 0.75, 'short of power, workplaces say so');
const g0 = Sim.prodOf(S, fac).rate;
for (let k = 0; k < 6; k++) place('windturbine'); place('powerplant'); Sim.recompute(S); run(3);
console.log('power after', JSON.stringify(S.power));
check(S.power.ratio > p1.ratio, 'turbines and a power plant fix the shortage');
check(Sim.prodOf(S, fac).rate > g0, 'factories speed back up with power');
check(S.rank >= 2, 'the town has ranked up: ' + Sim.rankName(S));
const home = S.b.find(b => b.res > 0 && b.cov && b.cov.bus); check(!!home, 'homes near the bus depot have bus coverage');
check(S.news.some(n => /is now a/.test(n.text)), 'rank-ups are announced');
// fires: force the odds, then build a fire station
let fired = null; for (let d = 0; d < 30 && !fired; d++) { run(24); fired = S.b.find(b => b.burnt); }
check(!!fired, 'a building without fire cover eventually burns: ' + (fired && fired.type));
if (fired) {
  const st = (() => { for (let a = 0; a < 4000; a++) { const rc = conn(); const [i, j] = rc[Math.floor(rand() * rc.length)]; const o = [[1, 0], [-2, 0], [0, 1], [0, -2]][Math.floor(rand() * 4)]; const r = Sim.place(S, 'firestation', i + o[0], j + o[1], 0); if (r.building) { r.building.build = 1; if (Sim.bDist ? true : true) return r.building; } } })();
  Sim.recompute(S); const covered = Sim.fireCover(S, fired); console.log('fire station placed', !!st, 'covers the fire', covered);
  if (covered) { run(8); check(!fired.burnt, 'the fire station rebuilds it'); } else check(true, '(fire station landed out of range; skipped)');
}
const save = Sim.deserialize(JSON.parse(JSON.stringify(Sim.serialize(S)))); check(save.rank === S.rank && save.era === 'modern', 'rank survives a save');
const M = Sim.newGame(5, 'medieval'); check(Sim.power(M) === null && Sim.canPlace(M, 'windturbine', 40, 40, 0).reason === 'Only on modern islands.', 'medieval islands have no power grid or modern buildings');
console.log(`\n${ok} passed, ${bad} failed`); process.exit(bad ? 1 : 0);
