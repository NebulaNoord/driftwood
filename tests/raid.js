// Headless raid: build a defended island, then let a simple "player" raid it
global.window = global; global.Sim = require('../src/sim.js');
global.GL = { Builder: class { constructor(){this.p=[];this.n=[];this.c=[];} at(){return this;} tri(){return this;} quad(){return this;} box(){return this;} gable(){return this;} cyl(){return this;} blob(){return this;} beam(){return this;} }, hex: () => [1,1,1], M4: {} };
require('../src/world.js'); require('../src/raid.js');
const R = { waterMesh: () => ({}), mesh: () => ({}), meshFromData: () => ({}), setHeights(){} };
const towers = +(process.argv[2] || 1), houses = +(process.argv[3] || 1), crew = +(process.argv[4] || 5), seedArg = +(process.argv[5] || 4242);
const ATK = JSON.parse(process.argv[6] || '{}'), DEF = JSON.parse(process.argv[7] || '{}'), WALL = +(process.argv[8] || 0), BOAT = +(process.argv[9] || 1);
const W = new World(R); W.sfx = () => {};
const S = Sim.newGame(seedArg); const N = 96;
let seed = 3; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const conn = () => { const o = []; for (let c = 0; c < N*N; c++) if (S._conn[c]) o.push([c % N, (c / N) | 0]); return o; };
S.wood = 9999; S.gold = 99999; S.stone = 9999; for (const k of Sim.BUILDABLE) S.goals['unlock_' + k] = 1;
for (let k = 0; k < 10; k++) { const rc = conn(); for (let a = 0; a < 60; a++) { const [i, j] = rc[Math.floor(rand()*rc.length)]; const d = Sim.DIRS[Math.floor(rand()*4)]; const cells = Sim.roadPath([i,j],[i+d[0]*7,j+d[1]*7]); const q = Sim.roadQuote(S, cells); if (q.n >= 5 && !q.blocked) { Sim.buildRoad(S, cells); break; } } }
const tryPlace = t => { const rc = conn(); const s = Sim.TYPES[t].size; for (let a = 0; a < 800; a++) { const [i,j] = rc[Math.floor(rand()*rc.length)]; const o = [[1,0],[-s,0],[0,1],[0,-s]][Math.floor(rand()*4)]; if (Sim.place(S, t, i+o[0], j+o[1], Math.floor(rand()*4)).building) return; } };
for (let k = 0; k < 14; k++) tryPlace('house'); for (const t of ['farm','market','lumber','tavern']) tryPlace(t);
for (let k = 0; k < towers; k++) tryPlace('watchtower'); for (let k = 0; k < houses; k++) tryPlace('guardhouse');
for (const t of ['barracks','archery','cavyard','foundry']) if (DEF[{barracks:'inf',archery:'arc',cavyard:'cav',foundry:'can'}[t]]) tryPlace(t);
const A = Sim.army(S); for (const t in DEF) { A.n[t] = DEF[t]; A.atk[t] = 0; }
if (WALL) { const hall0 = S.b.find(b => b.type === 'hall'); const r = 7, cells = []; for (let a = 0; a < 360; a += 2) { const i = Math.round(hall0.i + 1 + Math.cos(a * Math.PI / 180) * r), j = Math.round(hall0.j + 1 + Math.sin(a * Math.PI / 180) * r); cells.push([i, j]); } S.goals.unlock_wall2 = 1; S.goals.unlock_wall1 = 1; console.log('walls', JSON.stringify(Sim.buildWall(S, cells, WALL))); }
for (const b of S.b) b.build = 1;
for (let f = 0; f < 24 * 4 * 10; f++) { Sim.step(S, 0.1); if (S.meeting) Sim.meetingChoose(S, 'close'); }
S.gold = 1500; S.wood = 600; S.stone = 400;
W.setState(S); W.update(0.1, 0.1);
const sounds = {};
const raid = new Raid(S, W, { militia: crew, army: ATK, boat: BOAT, sfx: k => sounds[k] = (sounds[k] || 0) + 1 });
console.log('pop', Sim.pop(S), 'def', JSON.stringify(Sim.defenseOf(S)), 'stash', raid.total0, 'units', raid.raiders.length + 'v' + raid.guards.length, 'boat', raid.boat.x.toFixed(1), raid.boat.z.toFixed(1), 'bank', raid.bank.map(v => v.toFixed(1)).join(','));
const hall = S.b.find(b => b.type === 'hall'); console.log('hall dist', Math.hypot(Sim.center(hall)[0] - raid.bank[0], Sim.center(hall)[1] - raid.bank[1]).toFixed(1));
let lastCmd = -9, f = 0;
while (raid.phase !== 'over' && f < 30 * 200) {
  const dt = 1 / 30; f++;
  raid.update(dt); W.update(dt, dt * 0.1);
  if (raid.phase === 'go' && raid.t - lastCmd > 2) {
    lastCmd = raid.t;
    const o = raid.raiders[0] && raid.raiders[0].order || {};
    if (!(o.kind === 'attack' && raid.bLive(o.id) && raid.stashLeft(o.id) > 0)) {
      const c = raid.centroid(); let best = null, bd = 1e9;
      for (const s of raid.spots()) { const [x, z] = Sim.center(s.b), d = Math.hypot(x - c[0], z - c[1]) - s.loot * 0.05; if (d < bd) { bd = d; best = s; } }
      if (best) raid.command({ kind: 'attack', id: best.b.id }); else raid.command({ kind: 'bank' });
    }
    if (raid.guns && raid.gunCd <= 0 && raid.hall) { const [x, z] = Sim.center(raid.hall); raid.broadside(x, z); }
  }
  if (f % (30 * 15) === 0) console.log(`t ${raid.t.toFixed(0)} left ${raid.left.toFixed(0)} raiders ${raid.raiders.length} guards ${raid.guards.length} carry ${raid.raiders.map(u => Math.round(u.carryN)).join('/')} loot ${JSON.stringify(raid.loot)} piles ${raid.piles.length} destroyed ${raid.destroyed.length} breaches ${raid.breaches} shots ${raid.shots.length} alarm ${raid.alarm} panicHidden ${W.agents.filter(a => !a.temp && a.hidden).length}/${W.agents.filter(a => !a.temp).length}`);
}
console.log('RESULT', JSON.stringify(raid.result), 'sounds', JSON.stringify(sounds));
raid.dispose();
console.log('agents left with temp raid', W.agents.filter(a => a.temp === 'raid').length);
