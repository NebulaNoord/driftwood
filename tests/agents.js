// run world agent logic headlessly (no GL) by stubbing the renderer
global.window = global; 
global.Sim = require('../src/sim.js'); 
global.GL = { Builder: class { constructor(){this.p=[];this.n=[];this.c=[];} at(){return this;} tri(){return this;} quad(){return this;} box(){return this;} gable(){return this;} cyl(){return this;} blob(){return this;} beam(){return this;} }, hex: () => [1,1,1], M4: {} };
require('../src/world.js');
const R = { waterMesh: () => ({}), mesh: () => ({}), meshFromData: () => ({}), setHeights(){} };
const W = new World(R);
const S = Sim.newGame(1234);
W.setState(S);
const N = 96;
// simple town: road + houses
const hall = S.b[0];
const conn = () => { const o = []; for (let c = 0; c < N*N; c++) if (S._conn[c]) o.push([c % N, (c / N) | 0]); return o; };
let seed = 3; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
for (let k = 0; k < 6; k++) { const rc = conn(); for (let a = 0; a < 50; a++) { const [i, j] = rc[Math.floor(rand()*rc.length)]; const d = Sim.DIRS[Math.floor(rand()*4)]; const cells = Sim.roadPath([i,j],[i+d[0]*6,j+d[1]*6]); const q = Sim.roadQuote(S, cells); if (q.n >= 5 && !q.blocked) { Sim.buildRoad(S, cells); break; } } }
S.wood = 999; S.gold = 9999;
for (let k = 0; k < 8; k++) { const rc = conn(); for (let a = 0; a < 300; a++) { const [i,j] = rc[Math.floor(rand()*rc.length)]; const r = Sim.place(S, 'house', i + (rand()<.5?1:-1), j, 0); if (r.building) break; } }
S._ev.length = 0;
let frames = 0;
for (let h = 0; h < 48 * 10; h++) {
  Sim.step(S, 0.1);
  const evs = S._ev.splice(0); W.now += 0.1;
  W.handle(evs);
  if (evs.some(e => ['settlers','demolish','leave','build','level'].includes(e.type))) W.syncAgents();
  W.updateAgents(0.1);
  if (h % 40 === 0) {
    const vis = W.agents.filter(a => !a.hidden);
    const moving = W.agents.filter(a => a.path);
    const stuck = vis.filter(a => !a.path && a.goal !== 'market');
    console.log(`t ${S.t.toFixed(1)} pop ${Sim.pop(S)} agents ${W.agents.length} visible ${vis.length} moving ${moving.length} visibleIdleNotMarket ${stuck.length}`, stuck.slice(0,2).map(a => ({goal:a.goal, at:a.at, goalB:a.goalB, x:a.x.toFixed(1), z:a.z.toFixed(1)})));
  }
}
console.log('--- burst test');
for (const t of ['market', 'lumber', 'farm']) { const rc = conn(); for (let a = 0; a < 500; a++) { const [i,j] = rc[Math.floor(rand()*rc.length)]; const r = Sim.place(S, t, i + (rand()<.5?1:-3), j, 0); if (r.building) break; } }
for (let k = 0; k < 10; k++) { const rc = conn(); for (let a = 0; a < 300; a++) { const [i,j] = rc[Math.floor(rand()*rc.length)]; const r = Sim.place(S, 'house', i, j + (rand()<.5?1:-1), 0); if (r.building) break; } }
Sim.step(S, 24 * 4);
const evs = S._ev.splice(0); W.handle(evs); W.syncAgents();
for (let f = 0; f < 200; f++) {
  Sim.step(S, 0.05); const e2 = S._ev.splice(0); W.handle(e2); if (e2.some(e => ['settlers','demolish','leave','build','level'].includes(e.type))) W.syncAgents();
  W.updateAgents(0.05);
  if (f % 25 === 0) {
    const vis = W.agents.filter(a => !a.hidden), stuck = vis.filter(a => !a.path && a.goal !== 'market');
    const pos = {}; for (const a of vis) { const k = Math.round(a.x) + ',' + Math.round(a.z); pos[k] = (pos[k] || 0) + 1; }
    const maxClump = Math.max(0, ...Object.values(pos));
    console.log(`t ${S.t.toFixed(1)} agents ${W.agents.length} visible ${vis.length} moving ${W.agents.filter(a => a.path).length} idleVisible ${stuck.length} maxClump ${maxClump}`, stuck.slice(0, 2).map(a => ({ goal: a.goal, at: a.at, goalB: a.goalB, home: a.home })));
  }
}
