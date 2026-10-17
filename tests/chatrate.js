global.window = global; global.Sim = require('../src/sim.js');
global.GL = { Builder: class { constructor(){this.p=[];this.n=[];this.c=[];} at(){return this;} tri(){return this;} quad(){return this;} box(){return this;} gable(){return this;} cyl(){return this;} blob(){return this;} beam(){return this;} }, hex: () => [1,1,1], M4: {} };
require('../src/world.js');
const R = { waterMesh: () => ({}), mesh: () => ({}), meshFromData: () => ({}), setHeights(){} };
const W = new World(R); W.sfx = () => {};
const S = Sim.newGame(4242); W.setState(S); const N = 96;
let seed = 3; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const conn = () => { const o = []; for (let c = 0; c < N*N; c++) if (S._conn[c]) o.push([c % N, (c / N) | 0]); return o; };
S.wood = 9999; S.gold = 99999; S.stone = 9999; for (const k of Sim.BUILDABLE) S.goals['unlock_' + k] = 1;
for (let k = 0; k < 8; k++) { const rc = conn(); for (let a = 0; a < 60; a++) { const [i, j] = rc[Math.floor(rand()*rc.length)]; const d = Sim.DIRS[Math.floor(rand()*4)]; const cells = Sim.roadPath([i,j],[i+d[0]*7,j+d[1]*7]); const q = Sim.roadQuote(S, cells); if (q.n >= 5 && !q.blocked) { Sim.buildRoad(S, cells); break; } } }
const tryPlace = t => { const rc = conn(); const s = Sim.TYPES[t].size; for (let a = 0; a < 800; a++) { const [i,j] = rc[Math.floor(rand()*rc.length)]; const o = [[1,0],[-s,0],[0,1],[0,-s]][Math.floor(rand()*4)]; if (Sim.place(S, t, i+o[0], j+o[1], Math.floor(rand()*4)).building) return; } };
for (let k = 0; k < 14; k++) tryPlace('house'); for (const t of ['farm','market','tavern','garden']) tryPlace(t);
// warm up 3 days fast
for (let f = 0; f < 72 * 20; f++) { Sim.step(S, 0.05); if (S.meeting) Sim.meetingChoose(S, 'close'); const e = S._ev.splice(0); W.handle(e); if (e.some(x => ['settlers','build','built','level','leave'].includes(x.type))) W.syncAgents(); W.update(0.05, 0.05); }
// then 3 real minutes at normal speed (0.1 game hours per second), 30 fps
const c0 = W.chat.length; let maxRate = 0;
for (let f = 0; f < 180 * 30; f++) { const dt = 1 / 30; Sim.step(S, dt * 0.1); const e = S._ev.splice(0); W.handle(e); if (e.some(x => ['settlers','build','built','level','leave'].includes(x.type))) W.syncAgents(); W.update(dt, dt * 0.1); }
console.log('pop', Sim.pop(S), 'chat lines in 3 real minutes at 1x:', W.chat.length - c0 + (W.chat.length >= 60 ? '+' : ''), 'last:', W.chat.slice(-4).map(c => c.name + ': ' + c.text).join(' / '));
