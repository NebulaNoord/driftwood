/* Driftwood — real-time raids. Your warship lands troops; buildings take damage, catch fire and collapse,
   loot spills out and has to be carried back aboard before the clock runs out. */
(function (root) {
'use strict';
const Sim = root.Sim, N = Sim.N;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const cc = c => [c % N - N / 2 + 0.5, ((c / N) | 0) - N / 2 + 0.5];
const cellAt = (x, z) => { const i = Math.floor(x + N / 2), j = Math.floor(z + N / 2); return i < 0 || j < 0 || i >= N || j >= N ? -1 : j * N + i; };
const NAMES = ['Bjorn', 'Sigrid', 'Ulf', 'Astrid', 'Ragnar', 'Hilda', 'Torvald', 'Ingrid', 'Sven', 'Runa', 'Erik', 'Freydis', 'Gunnar', 'Liv'];
const RES = ['gold', 'wood', 'stone'];
// stats for units that aren't trained troops
const BASE = {
  mil: { name: 'Volunteer', hp: 100, dmg: 13, rate: 0.8, range: 1.15, spd: 2.7, carry: 35 },
  guard: { name: 'Guard', hp: 70, dmg: 9, rate: 0.9, range: 1.15, spd: 2.35, carry: 0 },
};
const VS_B = { mil: 0.5, inf: 0.6, arc: 0.3, cav: 0.45, can: 2, guard: 0 }; // damage multipliers against buildings
const VS_W = { mil: 0.8, inf: 1, arc: 0.25, cav: 0.7, can: 3, guard: 0 };  // ...and against walls
function bHp(b) {
  const T = Sim.TYPES[b.type], s = T.size;
  let hp = b.type === 'hall' ? 2000 : T.home ? 300 * s : s === 1 ? 450 : s === 2 ? 900 : 1200;
  if (T.army || T.guard || b.type === 'warschool') hp *= 1.3;
  return Math.round(hp);
}

class Raid {
  constructor(S, world, opt) {
    opt = opt || {};
    this.S = S; this.W = world; this.opt = opt; this.sfx = opt.sfx || (() => {});
    this.time = opt.time || 150; this.left = this.time; this.t = 0; this.phase = 'land';
    this.loot = { gold: 0, wood: 0, stone: 0 }; this.lost = { mil: 0, inf: 0, arc: 0, cav: 0, can: 0 }; this.downs = 0; this.extra = 0;
    this.alarm = false; this.warned = false; this.destroyed = []; this.breaches = 0;
    this.units = []; this.shots = []; this.piles = []; this.sel = 'all'; this.gunCd = 0;
    this.boatLv = clamp(opt.boat || 1, 1, 4); this.guns = Sim.BOATS[this.boatLv].guns;
    this.buildGrid();
    this.land();
    // every building has hit points; the ones with stores spill loot as they're damaged
    this.bs = {};
    for (const b of S.b) if (b.type !== 'pier' && Sim.done(b)) { const hp = bHp(b); this.bs[b.id] = { hp, max: hp, dead: false, fire: 0, loot: { gold: 0, wood: 0, stone: 0 }, loot0: 0 }; }
    for (const s of Sim.raidStash(S)) { const st = this.bs[s.id]; if (st) { st.loot[s.res] += s.amt; st.loot0 += s.amt; } }
    this.total0 = Object.values(this.bs).reduce((a, st) => a + st.loot0, 0);
    world.bState = this.bs;
    this.wallHp = new Float32Array(N * N);
    for (let c = 0; c < N * N; c++) if (S.wall && S.wall[c]) this.wallHp[c] = Sim.WALLS[S.wall[c]].hp;
    // the landing party
    const army = opt.army || {}, lv = opt.lv || {};
    const list = [];
    for (let k = 0; k < (opt.militia || 0); k++) list.push('mil');
    for (const t of ['cav', 'inf', 'arc', 'can']) for (let k = 0; k < (army[t] | 0); k++) list.push(t);
    list.forEach((kind, k) => {
      const a = (k / list.length) * 6.283, p = [this.boat.x + Math.cos(a) * 0.4, this.boat.z + Math.sin(a) * 0.4];
      const u = this.unit('r', kind, p[0], p[1], k, lv[kind] || 1);
      u.walkIn = [this.bank[0] + Math.cos(a) * (0.5 + (k % 3) * 0.25), this.bank[1] + Math.sin(a) * (0.5 + (k % 3) * 0.25)];
      u.path = [[this.bank[0], this.bank[1]], u.walkIn]; u.pi = 0; u.goalKey = 'in';
      u.order = { kind: 'move', x: u.walkIn[0], z: u.walkIn[1] };
    });
    // the defenders: hall guards, guardhouse guards, and whatever troops stayed home
    const def = Sim.defenseOf(S), hall = S.b.find(b => b.type === 'hall');
    const ghouses = S.b.filter(b => b.type === 'guardhouse' && Sim.done(b));
    const atHall = Math.max(0, def.guards - ghouses.length * 3);
    let k = 0;
    for (const b of ghouses) for (let n = 0; n < 3; n++) { const p = this.near(b, k), g = this.unit('g', 'guard', p[0], p[1], k++, 1); g.post = p; g.local = true; }
    for (let n = 0; n < atHall && hall; n++) { const p = this.near(hall, k), g = this.unit('g', 'guard', p[0], p[1], k++, 1); g.post = p; }
    const dlv = (S.army && S.army.lv) || {}, dt = def.troops || {};
    for (const t of ['inf', 'arc', 'cav', 'can']) {
      const homes = S.b.filter(b => Sim.TYPES[b.type].army === t && Sim.done(b));
      for (let n = 0; n < Math.min(16, dt[t] | 0); n++) {
        const b = homes[n % Math.max(1, homes.length)] || hall; if (!b) break;
        const p = this.near(b, k), g = this.unit('g', t, p[0], p[1], k++, dlv[t] || 1); g.post = p;
      }
    }
    this.towers = S.b.filter(b => b.type === 'watchtower' && Sim.done(b)).map(b => { const [x, z] = Sim.center(b); return { b, x, z, y: b.y + 1.72, cd: 1 + Math.random() }; });
    this.hall = hall;
    // reinforcements only come from islands that keep a guardhouse or barracks
    this.extraMax = Math.min(4, S.b.filter(b => (b.type === 'guardhouse' || b.type === 'barracks') && Sim.done(b)).length * 2);
    world.raidBoat = { x: this.boat.x, z: this.boat.z, ry: this.boat.ry, level: this.boatLv };
    world.noDrill = true;
    world.drawHook = (R, B, t, groundY) => this.draw(R, B, t, groundY);
    this.sfx('horn');
  }
  /* --- map --- */
  buildGrid() {
    const S = this.S, g = new Uint8Array(N * N);
    for (let c = 0; c < N * N; c++) {
      const i = c % N, j = (c / N) | 0, id = S.occ[c];
      if (id) { const b = S._byId ? S._byId[id] : null; g[c] = b && b.type === 'pier' ? 1 : 0; continue; }
      g[c] = S.road[c] || Sim.cellH(S, i, j) >= 0.05 ? 1 : 0;
    }
    this.walk = g;
    this.dist = new Float32Array(N * N); this.prev = new Int32Array(N * N); this.seen = new Int32Array(N * N); this.gen = 1;
  }
  land() {
    const S = this.S, hall = S.b.find(b => b.type === 'hall'), pier = S.b.find(b => b.type === 'pier');
    const [hx, hz] = hall ? Sim.center(hall) : [0, 0], [px, pz] = pier ? Sim.center(pier) : [hx, hz];
    let best = null, bs = 1e9;
    for (let c = 0; c < N * N; c++) {
      if (!this.walk[c] || S.occ[c] || (S.wall && S.wall[c])) continue;
      const i = c % N, j = (c / N) | 0, h = Sim.cellH(S, i, j); if (h > 1.4) continue;
      let wet = null, wd = 1e9;
      for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {
        const x = i + di, y = j + dj; if (!Sim.inB(x, y) || S.occ[y * N + x] || S.road[y * N + x] || Sim.cellH(S, x, y) > -0.5) continue;
        const d = di * di + dj * dj; if (d < wd) { wd = d; wet = y * N + x; }
      }
      if (wet === null) continue;
      const [x, z] = cc(c), dh = Math.hypot(x - hx, z - hz), dp = Math.hypot(x - px, z - pz);
      const score = Math.abs(dh - 13) * 1.5 + dp * 0.12 + (dh < 8 ? 40 : 0) + wd * 0.6;
      if (score < bs) { bs = score; best = { c, wet }; }
    }
    if (!best) { const c = cellAt(px, pz); best = { c: c < 0 ? 0 : c, wet: c < 0 ? 0 : c }; }
    const [x, z] = cc(best.c), [wx, wz] = cc(best.wet);
    this.bank = [x, z];
    const d = Math.hypot(wx - x, wz - z) || 1, out = 0.6 + (this.boatLv - 1) * 0.5, bx = wx + (wx - x) / d * out, bz = wz + (wz - z) / d * out;
    this.boat = { x: bx, z: bz, ry: Math.atan2(x - bx, z - bz) };
  }
  near(b, k) {
    const [x, z] = Sim.center(b), s = Sim.TYPES[b.type].size / 2 + 0.45, a = k * 2.1 + b.id;
    for (let r = 0; r < 5; r++) { const p = [x + Math.cos(a) * (s + r * 0.4), z + Math.sin(a) * (s + r * 0.4)], c = cellAt(p[0], p[1]); if (c >= 0 && this.walk[c] && !this.wallHp[c]) return p; }
    const d = b.door; return d !== null && d !== undefined ? cc(d) : [x, z + s];
  }
  /* --- units --- */
  unit(side, kind, x, z, k, lv) {
    const W = this.W, r = side === 'r', T = Sim.TROOPS[kind] || BASE[kind], m = 1 + 0.25 * ((lv || 1) - 1);
    const a = W.newAgent({ id: (r ? 7000 : 8000) + k * 3 + this.units.length }, x, z, k);
    const tool = kind === 'arc' ? 'bow' : kind === 'can' ? null : kind === 'cav' ? 'sword' : r ? 'axe' : 'spear';
    Object.assign(a, { temp: 'raid', hidden: false, kid: false, path: null, anim: 'idle', helm: r ? 'horn' : 'guard', tool, job: (T.name || 'Raider').replace(/s$/, '') + (lv > 1 ? ' (level ' + lv + ')' : ''), pop: W.now, waitUntil: 0, mounted: kind === 'cav' });
    if (r) { a.color = kind === 'mil' ? [0.55, 0.3, 0.2] : [[0.62, 0.17, 0.14], [0.55, 0.22, 0.12], [0.5, 0.15, 0.18]][k % 3]; a.pants = [0.3, 0.24, 0.2]; a.name = NAMES[k % NAMES.length] + (kind === 'mil' ? ' the Bold' : ' of the ' + Sim.BOATS[this.boatLv].name); }
    else { a.color = kind === 'guard' ? [0.22, 0.34, 0.58] : [0.2, 0.42, 0.42]; a.pants = [0.25, 0.25, 0.3]; a.name = a.name.split(' ')[0] + ' the ' + (kind === 'guard' ? 'guard' : (Sim.TROOPS[kind].one)); }
    W.agents.push(a);
    const u = { side, kind, k, x, z, a, lv: lv || 1, hp: Math.round(T.hp * m), max: Math.round(T.hp * m), spd: T.spd, dmg: T.dmg * m, rate: T.rate, range: T.range, cap: T.carry || 0,
      cd: Math.random() * 0.6, path: null, pi: 0, repath: 0, goalKey: '', carry: { gold: 0, wood: 0, stone: 0 }, carryN: 0, dead: false, post: null, alarmed: false, wander: 0, order: { kind: 'idle' }, recoil: 0 };
    if (kind === 'can') a.tool = null;
    this.units.push(u);
    return u;
  }
  get raiders() { return this.units.filter(u => u.side === 'r' && !u.dead); }
  get guards() { return this.units.filter(u => u.side === 'g' && !u.dead); }
  counts() { const c = {}; for (const u of this.raiders) c[u.kind] = (c[u.kind] || 0) + 1; return c; }
  /* --- orders --- */
  command(o) {
    if (this.phase === 'over') return;
    for (const u of this.raiders) {
      if (this.sel !== 'all' && u.kind !== this.sel) continue;
      u.order = o; u.path = null; u.goalKey = ''; u.breach = -1;
    }
  }
  bLive(id) { const st = this.bs[id]; return st && !st.dead; }
  stashLeft(id) { const st = this.bs[id]; return st ? st.loot.gold + st.loot.wood + st.loot.stone : 0; }
  /* --- paths: Dijkstra where walls are expensive for raiders and solid for defenders (except gates) --- */
  cost(c, side) {
    if (!this.walk[c]) return -1;
    if (this.wallHp[c] > 0) { if (side === 'g') return this.S.road[c] ? 1 : -1; return 6 + this.wallHp[c] / 60; }
    return 1;
  }
  findPath(fx, fz, tx, tz, side) {
    const from = cellAt(fx, fz); let to = cellAt(tx, tz);
    if (from < 0 || to < 0) return [[tx, tz]];
    if (this.cost(to, side) < 0 || (side === 'r' && this.wallHp[to] > 0)) {
      let best = -1, bd = 1e9; const ti = to % N, tj = (to / N) | 0;
      for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) { const x = ti + di, y = tj + dj; if (!Sim.inB(x, y)) continue; const k = y * N + x; if (this.cost(k, side) !== 1) continue; const d = di * di + dj * dj; if (d < bd) { bd = d; best = k; } }
      if (best < 0) return null; to = best; const p = cc(to); tx = p[0]; tz = p[1];
    }
    if (from === to || this.clear(fx, fz, tx, tz, side)) return [[tx, tz]];
    const dist = this.dist, prev = this.prev, seen = this.seen, g = ++this.gen;
    const ti = to % N, tj = (to / N) | 0, hh = c => Math.hypot(c % N - ti, ((c / N) | 0) - tj);
    const heap = [[hh(from), from]]; seen[from] = g; dist[from] = 0; prev[from] = from;
    const push = (d, c) => { heap.push([d, c]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    let found = false, iter = 0;
    while (heap.length && iter++ < 60000) {
      const [f, c] = pop(), d = dist[c]; if (f > d + hh(c) + 1e-6) continue;
      if (c === to) { found = true; break; }
      const i = c % N, j = (c / N) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const x = i + di, y = j + dj; if (x < 0 || y < 0 || x >= N || y >= N) continue;
        const k = y * N + x, w = this.cost(k, side); if (w < 0) continue;
        if (di && dj && (this.cost(j * N + x, side) !== 1 || this.cost(y * N + i, side) !== 1)) continue;
        const nd = d + w * (di && dj ? 1.414 : 1);
        if (seen[k] === g && nd >= dist[k]) continue;
        seen[k] = g; dist[k] = nd; prev[k] = c; push(nd + hh(k), k);
      }
    }
    if (!found) return null;
    const cells = []; for (let c = to; c !== from; c = prev[c]) cells.push(c); cells.reverse();
    const pts = cells.map(c => { const p = cc(c); p.c = c; return p; }); pts[pts.length - 1] = Object.assign([tx, tz], { c: to });
    const out = []; let cx = fx, cz = fz, k = 0;
    while (k < pts.length) {
      let far = k;
      if (!this.wallHp[pts[k].c]) for (let m = Math.min(pts.length - 1, k + 10); m > k; m--) if (this.clear(cx, cz, pts[m][0], pts[m][1], side)) { far = m; break; }
      out.push(pts[far]); cx = pts[far][0]; cz = pts[far][1]; k = far + 1;
    }
    return out;
  }
  clear(ax, az, bx, bz, side) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.3);
    for (let s = 1; s <= n; s++) { const c = cellAt(ax + (bx - ax) * s / n, az + (bz - az) * s / n); if (c < 0 || this.cost(c, side) !== 1) return false; }
    return true;
  }
  moveTo(u, tx, tz, dt, key) {
    const k = key || (Math.round(tx * 2) + ',' + Math.round(tz * 2));
    u.repath -= dt;
    if (!u.path || u.goalKey !== k || (u.repath <= 0 && u.side === 'g')) { u.path = this.findPath(u.x, u.z, tx, tz, u.side) || [[u.x, u.z]]; u.pi = 0; u.goalKey = k; u.repath = 0.7 + Math.random() * 0.3; }
    let step = u.spd * dt; const s0 = step;
    while (step > 0 && u.pi < u.path.length) {
      const p = u.path[u.pi];
      // a wall in the way: knock it down first
      if (u.side === 'r' && p.c !== undefined && this.wallHp[p.c] > 0) { u.breach = p.c; break; }
      const dx = p[0] - u.x, dz = p[1] - u.z, d = Math.hypot(dx, dz);
      if (d > 1e-4) u.a.ry = Math.atan2(dx, dz);
      if (d <= step) { u.x = p[0]; u.z = p[1]; u.pi++; step -= d; }
      else { u.x += dx / d * step; u.z += dz / d * step; step = 0; }
    }
    const moved = s0 - step;
    u.a.phase += moved * (u.kind === 'cav' ? 9 : 24); u.a.path = moved > 1e-4 ? [] : null;
    if (moved > 1e-4) u.a.anim = u.kind === 'can' ? 'push' : 'walk';
    return u.pi >= u.path.length;
  }
  face(u, x, z) { u.a.ry = Math.atan2(x - u.x, z - u.z); }
  distToB(u, b) {
    const s = Sim.TYPES[b.type].size, x0 = b.i - N / 2, z0 = b.j - N / 2;
    return Math.hypot(Math.max(x0 - u.x, 0, u.x - (x0 + s)), Math.max(z0 - u.z, 0, u.z - (z0 + s)));
  }
  nearestEnemy(u, range) {
    let best = null, bd = range;
    for (const v of this.units) { if (v.dead || v.side === u.side) continue; const d = Math.hypot(v.x - u.x, v.z - u.z); if (d < bd) { bd = d; best = v; } }
    return best;
  }
  /* --- damage --- */
  hitUnit(v, dmg, from) {
    if (v.dead) return;
    v.hp -= dmg; v.a.hitAt = this.W.now;
    const y = Sim.groundAt(this.S, v.x, v.z) + 0.45;
    for (let k = 0; k < 3; k++) this.W.addPart({ x: v.x, y, z: v.z, vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random(), vz: (Math.random() - 0.5) * 2, life: 0, max: 0.35, size: 0.035, col: v.side === 'g' ? [1, 0.85, 0.5] : [1, 1, 1], e: 0.6, g: 5, drag: 1 });
    if (v.hp <= 0) this.kill(v);
  }
  kill(v) {
    v.dead = true; v.hp = 0; v.a.anim = 'down'; v.a.downAt = this.W.now; v.a.path = null; v.a.mounted = false; v.goneAt = this.t + 1.3;
    this.sfx('down');
    if (v.side === 'r') {
      this.lost[v.kind] = (this.lost[v.kind] || 0) + 1;
      if (v.carryN > 0) { this.drop(v.x, v.z, v.carry); this.W.floatAt(v.x, Sim.groundAt(this.S, v.x, v.z) + 1, v.z, 'Loot dropped!', 'bad'); }
      v.carry = { gold: 0, wood: 0, stone: 0 }; v.carryN = 0;
    } else this.downs++;
  }
  drop(x, z, res) {
    const n = RES.reduce((a, k) => a + (res[k] || 0), 0); if (n < 1) return;
    let p = this.piles.find(q => Math.hypot(q.x - x, q.z - z) < 0.6);
    if (!p) { p = { x: x + (Math.random() - 0.5) * 0.3, z: z + (Math.random() - 0.5) * 0.3, res: { gold: 0, wood: 0, stone: 0 }, t0: this.W.now }; this.piles.push(p); }
    for (const k of RES) p.res[k] += res[k] || 0;
  }
  hitBuilding(b, dmg, u, burn) {
    const st = this.bs[b.id]; if (!st || st.dead) return;
    dmg = Math.min(dmg, st.hp); st.hp -= dmg; st.hitAt = this.W.now;
    if (burn) st.fire = Math.min(3, st.fire + burn);
    // stores spill out as the building is wrecked
    if (st.loot0 > 0) {
      const f = dmg / st.max, out = {};
      for (const k of RES) { const n = Math.min(st.loot[k], st.loot0 * f * (st.loot[k] / Math.max(1e-6, st.loot.gold + st.loot.wood + st.loot.stone))); st.loot[k] -= n; out[k] = n; }
      if (u && u.cap > u.carryN) { for (const k of RES) { const n = Math.min(out[k], u.cap - u.carryN); u.carry[k] += n; u.carryN += n; out[k] -= n; } }
      const [cx, cz] = Sim.center(b); const sp = Sim.TYPES[b.type].size / 2 + 0.3, a = Math.random() * 6.28;
      this.drop(cx + Math.cos(a) * sp, cz + Math.sin(a) * sp, out);
    }
    if (st.hp <= 0) this.collapse(b, st);
  }
  collapse(b, st) {
    st.dead = true; st.fire = 0;
    const [cx, cz] = Sim.center(b), sp = Sim.TYPES[b.type].size / 2 + 0.35;
    const rest = {}; for (const k of RES) { rest[k] = st.loot[k]; st.loot[k] = 0; }
    this.drop(cx + sp, cz, rest);
    this.W.debris(b); this.sfx('collapse');
    if (b.type !== 'hall' && b.type !== 'pier') this.destroyed.push(b.id);
    this.W.floatAt(cx, b.y + 1.4, cz, Sim.TYPES[b.type].name + ' destroyed!', 'lvl');
  }
  hitWall(c, dmg) {
    if (!(this.wallHp[c] > 0)) return;
    this.wallHp[c] -= dmg;
    const [x, z] = cc(c), y = Sim.groundAt(this.S, x, z) + 0.4;
    for (let k = 0; k < 3; k++) this.W.addPart({ x, y, z, vx: (Math.random() - 0.5) * 2, vy: 1.5 + Math.random(), vz: (Math.random() - 0.5) * 2, life: 0, max: 0.6, size: 0.05, col: this.S.wall[c] === 1 ? [0.45, 0.32, 0.22] : [0.72, 0.69, 0.64], g: 8, drag: 0.6, bounce: true });
    if (this.wallHp[c] <= 0) {
      this.wallHp[c] = 0; this.S.wall[c] = 0; this.S._dirty.walls = true; this.breaches++;
      for (let k = 0; k < 14; k++) this.W.addPart({ x: x + (Math.random() - 0.5) * 0.6, y, z: z + (Math.random() - 0.5) * 0.6, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 2, vz: (Math.random() - 0.5) * 3, life: 0, max: 1, size: 0.07, col: [0.7, 0.66, 0.6], g: 9, drag: 0.4, bounce: true });
      this.sfx('collapse');
      for (const u of this.units) if (u.breach === c) { u.breach = -1; u.path = null; }
    }
  }
  /* --- projectiles: arrows and cannonballs --- */
  shoot(u, tx, tz, what, yo) {
    const W = this.W, y0 = yo !== undefined ? yo : Sim.groundAt(this.S, u.x, u.z) + (u.kind === 'can' ? 0.3 : 0.5), d = Math.hypot(tx - u.x, tz - u.z);
    const ty = Math.max(0, Sim.groundAt(this.S, tx, tz)) + 0.35, ball = u.kind === 'can' || u.kind === 'ship';
    const dur = ball ? 0.5 + d * 0.06 : 0.25 + d * 0.05, g = ball ? 9 : 7;
    const s = { x: u.x, y: y0, z: u.z, tx, ty, tz, t0: this.t, dur, g, vy: (ty - y0 + 0.5 * g * dur * dur) / dur, ball, what, side: u.side, dmg: u.dmg, kind: u.kind, from: u };
    this.shots.push(s);
    if (!ball) W.addPart({ x: s.x, y: y0, z: s.z, vx: (tx - u.x) / dur, vy: s.vy, vz: (tz - u.z) / dur, life: 0, max: dur, size: 0.03, col: u.side === 'r' && what && what.b ? [1, 0.6, 0.2] : [0.35, 0.25, 0.15], e: what && what.b ? 1 : 0, g, drag: 0 });
    else { u.recoil = 1; this.sfx('cannon'); for (let k = 0; k < 6; k++) W.addPart({ x: u.x + Math.sin(u.a.ry) * 0.3, y: y0 + 0.05, z: u.z + Math.cos(u.a.ry) * 0.3, vx: Math.sin(u.a.ry) * (1 + Math.random()) + (Math.random() - 0.5), vy: 0.5 + Math.random() * 0.5, vz: Math.cos(u.a.ry) * (1 + Math.random()) + (Math.random() - 0.5), life: 0, max: 1.2, size: 0.14, col: [0.85, 0.85, 0.82], g: -0.2, drag: 1.5, smoke: true }); }
    if (!ball) this.sfx('arrow');
  }
  land2(s) {
    const W = this.W;
    if (s.ball) {
      this.sfx('boom');
      for (let k = 0; k < 10; k++) W.addPart({ x: s.tx, y: s.ty, z: s.tz, vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2.5, vz: (Math.random() - 0.5) * 3, life: 0, max: 0.6, size: 0.1 + Math.random() * 0.06, col: Math.random() < 0.5 ? [1, 0.7, 0.3] : [0.5, 0.45, 0.4], e: Math.random() < 0.5 ? 1.5 : 0, g: 4, drag: 1.2, soft: true });
      // splash: units, buildings and walls near the impact
      for (const v of this.units) if (!v.dead && v.side !== s.side && Math.hypot(v.x - s.tx, v.z - s.tz) < 1.0) this.hitUnit(v, s.dmg * 0.6, s.from);
      const c = cellAt(s.tx, s.tz);
      if (s.side === 'r') {
        if (c >= 0 && this.S.occ[c]) { const b = this.S._byId[this.S.occ[c]]; if (b) this.hitBuilding(b, s.dmg * VS_B.can, null, 0.6); }
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const k = c + dj * N + di; if (k >= 0 && k < N * N && this.wallHp[k] > 0) this.hitWall(k, s.dmg * VS_W.can * (di || dj ? 0.4 : 1)); }
      }
      return;
    }
    const w = s.what || {};
    if (w.u) { if (!w.u.dead && Math.hypot(w.u.x - s.tx, w.u.z - s.tz) < 1.2 && Math.random() < 0.85) this.hitUnit(w.u, s.dmg, s.from); }
    else if (w.b) this.hitBuilding(w.b, s.dmg * VS_B.arc, s.from && !s.from.dead ? s.from : null, 0.35);
    else if (w.c !== undefined) this.hitWall(w.c, s.dmg * VS_W.arc);
  }
  /* --- one frame --- */
  update(dt) {
    if (this.phase === 'over') return;
    this.t += dt; this.gunCd = Math.max(0, this.gunCd - dt);
    const W = this.W;
    if (this.phase === 'land') {
      let done = true;
      for (const u of this.raiders) if (u.walkIn) { if (!this.moveTo(u, u.walkIn[0], u.walkIn[1], dt, 'in')) done = false; else { u.walkIn = null; u.a.anim = 'idle'; u.a.path = null; } u.a.x = u.x; u.a.z = u.z; }
      for (const u of this.guards) { u.a.anim = 'idle'; u.a.x = u.x; u.a.z = u.z; }
      this.syncCrew();
      if (done || this.t > 5) { this.phase = 'go'; this.t0 = this.t; }
      return;
    }
    this.left = Math.max(0, this.time - (this.t - this.t0));
    if (!this.warned && this.left < 20) { this.warned = true; this.sfx('warn'); this.opt.onWarn && this.opt.onWarn(); }
    if (!this.alarm && this.t - this.t0 > 10) this.raiseAlarm();
    if (this.alarm && this.hall && this.bLive(this.hall.id) && this.extra < this.extraMax && this.t - this.alarmAt > 22 * (this.extra + 1)) { this.extra++; const p = this.near(this.hall, 20 + this.extra); const g = this.unit('g', 'guard', p[0], p[1], 20 + this.extra, 1); g.alarmed = true; g.post = p; }
    for (const u of this.units) {
      if (u.dead) { if (u.goneAt && this.t > u.goneAt) { u.goneAt = 0; W.removeAgent(u.a, true); if (u.crew) W.removeAgent(u.crew, true); } continue; }
      u.cd -= dt; u.recoil = Math.max(0, u.recoil - dt * 3);
      if (u.side === 'r') this.raider(u, dt); else this.defender(u, dt);
      u.a.x = u.x; u.a.z = u.z;
    }
    this.syncCrew();
    // keep a crowd from stacking on one spot
    const live = this.units.filter(u => !u.dead);
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), want = (a.kind === 'cav' || b.kind === 'cav' || a.kind === 'can' || b.kind === 'can') ? 0.5 : 0.32;
      if (d > 0.001 && d < want) {
        const push = (want - d) * 0.5, px = dx / d * push, pz = dz / d * push;
        if (this.cost(cellAt(a.x - px, a.z - pz), a.side) === 1) { a.x -= px; a.z -= pz; }
        if (this.cost(cellAt(b.x + px, b.z + pz), b.side) === 1) { b.x += px; b.z += pz; }
      }
    }
    // towers
    for (const tw of this.towers) {
      if (!this.bLive(tw.b.id)) continue;
      tw.cd -= dt; if (tw.cd > 0) continue;
      let tgt = null, bd = 6.5; for (const u of this.raiders) { const d = Math.hypot(u.x - tw.x, u.z - tw.z); if (d < bd) { bd = d; tgt = u; } }
      if (!tgt) { tw.cd = 0.3; continue; }
      tw.cd = 1.6; this.raiseAlarm();
      this.shoot({ x: tw.x, z: tw.z, kind: 'tower', side: 'g', dmg: 12, a: { ry: 0 } }, tgt.x, tgt.z, { u: tgt }, tw.y);
    }
    // projectiles in flight
    for (const s of this.shots) if (this.t - s.t0 >= s.dur) { s.done = true; this.land2(s); }
    this.shots = this.shots.filter(s => !s.done);
    // burning buildings keep burning
    for (const id in this.bs) { const st = this.bs[id]; if (st.fire > 0 && !st.dead) { const b = this.S._byId[id]; if (b) this.hitBuilding(b, st.fire * 5 * dt, null, 0); st.fire = Math.max(0, st.fire - dt * 0.05); } }
    // loot on the ground is picked up by anyone passing with room in their sack
    for (const p of this.piles) {
      const n = RES.reduce((a, k) => a + p.res[k], 0); if (n < 0.5) { p.gone = true; continue; }
      for (const u of this.raiders) {
        if (u.cap <= u.carryN || Math.hypot(u.x - p.x, u.z - p.z) > 0.7) continue;
        for (const k of RES) { const m = Math.min(p.res[k], u.cap - u.carryN); p.res[k] -= m; u.carry[k] += m; u.carryN += m; }
      }
    }
    this.piles = this.piles.filter(p => !p.gone);
    if (this.left <= 0 || !this.raiders.length) this.end(this.left <= 0 ? 'time' : 'wiped');
  }
  raiseAlarm() {
    if (this.alarm) return;
    this.alarm = true; this.alarmAt = this.t; this.W.panic = true;
    for (const g of this.guards) if (!g.local) g.alarmed = true;
    this.sfx('alarm'); this.opt.onAlarm && this.opt.onAlarm();
  }
  // attack whatever is in reach: enemies first, then the order's target
  strike(u, dt, target) {
    const a = u.a;
    if (u.cd > 0) { if (u.kind === 'arc') a.anim = 'shoot'; else if (u.kind !== 'can') a.anim = u.side === 'g' && u.kind !== 'cav' ? 'stab' : 'chop'; a.path = null; a.phase += dt * 8; return; }
    u.cd = u.rate * (0.9 + Math.random() * 0.2);
    if (target.u) this.face(u, target.u.x, target.u.z); else if (target.b) { const [x, z] = Sim.center(target.b); this.face(u, x, z); } else if (target.c !== undefined) { const p = cc(target.c); this.face(u, p[0], p[1]); }
    a.path = null; a.anim = u.kind === 'arc' ? 'shoot' : u.kind === 'can' ? 'idle' : u.side === 'g' && u.kind !== 'cav' ? 'stab' : 'chop';
    if (u.kind === 'arc' || u.kind === 'can') {
      const [tx, tz] = target.u ? [target.u.x, target.u.z] : target.b ? Sim.center(target.b) : cc(target.c);
      const jit = u.kind === 'can' ? 0.4 : 0;
      this.shoot(u, tx + (Math.random() - 0.5) * jit, tz + (Math.random() - 0.5) * jit, target);
      return;
    }
    if (target.u) { this.hitUnit(target.u, u.dmg * (0.85 + Math.random() * 0.3), u); this.sfx('clash'); }
    else if (target.b) { this.hitBuilding(target.b, u.dmg * VS_B[u.kind], u, 0); this.sfx('chop'); }
    else if (target.c !== undefined) { this.hitWall(target.c, u.dmg * VS_W[u.kind]); this.sfx('chop'); }
  }
  raider(u, dt) {
    if (Math.hypot(u.x - this.bank[0], u.z - this.bank[1]) < 2.4) u.hp = Math.min(u.max, u.hp + 6 * dt);
    const reach = u.kind === 'arc' ? 5 : u.kind === 'can' ? 7.5 : 1.2;
    // cannons only turn on troops that get close; everyone else fights back first
    const foe = this.nearestEnemy(u, u.kind === 'can' ? 3.5 : reach);
    if (foe) { this.strike(u, dt, { u: foe }); return; }
    if (u.breach >= 0 && this.wallHp[u.breach] > 0) {
      const p = cc(u.breach), d = Math.hypot(p[0] - u.x, p[1] - u.z);
      if (d <= (u.kind === 'arc' ? 4 : u.kind === 'can' ? 7 : 0.95)) { this.strike(u, dt, { c: u.breach }); return; }
      // step right up to the wall
      const st = Math.min(u.spd * dt, d - 0.8), nx = u.x + (p[0] - u.x) / d * st, nz = u.z + (p[1] - u.z) / d * st;
      if (st > 0 && this.cost(cellAt(nx, nz), 'r') === 1) { u.x = nx; u.z = nz; u.a.ry = Math.atan2(p[0] - u.x, p[1] - u.z); u.a.path = []; u.a.anim = u.kind === 'can' ? 'push' : 'walk'; u.a.phase += st * 24; return; }
      this.strike(u, dt, { c: u.breach }); return;
    }
    const o = u.order, dry = o.kind === 'idle' || (o.kind === 'attack' && !this.stashLeft(o.id) && !this.pileNear(u, 4));
    const home = (this.left < 12 && u.carryN > 0) || o.kind === 'bank' && u.carryN > 0 || (u.cap && u.carryN >= u.cap) || (dry && u.carryN >= 8);
    if (home) {
      if (this.moveTo(u, this.bank[0] + Math.cos(u.k) * 0.4, this.bank[1] + Math.sin(u.k) * 0.4, dt, 'bank')) this.bankAll(u);
      return;
    }
    if (o.kind === 'attack') {
      let b = this.S._byId[o.id];
      if (!b || !this.bLive(o.id)) {
        // that one's down: carry on to the next building close by
        let best = null, bd = 6; for (const x of this.S.b) { if (!this.bLive(x.id)) continue; const d = this.distToB(u, x); if (d < bd) { bd = d; best = x; } }
        if (best) { u.order = { kind: 'attack', id: best.id }; u.path = null; } else { u.order = { kind: 'idle' }; }
        this.idle(u); return;
      }
      const r = u.kind === 'arc' ? 4.2 : u.kind === 'can' ? 6.8 : 0.8;
      if (u.cap > u.carryN + 1) { const pl = this.pileNear(u, 1.6); if (pl) { this.moveTo(u, pl.x, pl.z, dt, 'pile' + pl.x.toFixed(1)); return; } }
      if (this.distToB(u, b) <= r) { this.strike(u, dt, { b }); return; }
      const p = this.near(b, u.k + 3); this.moveTo(u, p[0], p[1], dt, 'b' + b.id + ':' + u.k); return;
    }
    if (o.kind === 'wall') {
      if (!(this.wallHp[o.c] > 0)) { u.order = { kind: 'idle' }; this.idle(u); return; }
      const p = cc(o.c), d = Math.hypot(p[0] - u.x, p[1] - u.z);
      if (d <= (u.kind === 'arc' ? 4 : u.kind === 'can' ? 7 : 1.1)) { this.strike(u, dt, { c: o.c }); return; }
      this.moveTo(u, p[0], p[1], dt, 'w' + o.c); return;
    }
    if (o.kind === 'hit') {
      if (!o.u || o.u.dead) { u.order = { kind: 'idle' }; return; }
      this.moveTo(u, o.u.x, o.u.z, dt, 'h' + Math.round(o.u.x) + ',' + Math.round(o.u.z)); return;
    }
    if (o.kind === 'move' && o.x !== undefined) {
      const ang = u.k * 2.4, rr = u.k ? 0.3 + (u.k % 4) * 0.14 : 0;
      if (this.moveTo(u, o.x + Math.cos(ang) * rr, o.z + Math.sin(ang) * rr, dt, 'm' + o.x.toFixed(1) + o.z.toFixed(1) + u.k)) this.idle(u);
      return;
    }
    if (o.kind === 'bank') { if (this.moveTo(u, this.bank[0] + Math.cos(u.k) * 0.6, this.bank[1] + Math.sin(u.k) * 0.6, dt, 'bank')) this.idle(u); return; }
    // pick up spilled loot lying close by
    if (u.cap > u.carryN + 1) { const p = this.pileNear(u, 5); if (p) { this.moveTo(u, p.x, p.z, dt, 'pile' + p.x.toFixed(1)); return; } }
    // idle cannons pound the nearest building in range
    if (u.kind === 'can') { let best = null, bd = 7; for (const x of this.S.b) { if (!this.bLive(x.id)) continue; const d = this.distToB(u, x); if (d < bd) { bd = d; best = x; } } if (best) { this.strike(u, dt, { b: best }); return; } }
    this.idle(u);
  }
  pileNear(u, r) { let best = null, bd = r; for (const p of this.piles) { const d = Math.hypot(p.x - u.x, p.z - u.z); if (d < bd && p.res.gold + p.res.wood + p.res.stone >= 1) { bd = d; best = p; } } return best; }
  idle(u) { u.a.path = null; u.a.anim = 'idle'; if (u.carryN > 0 && u.kind !== 'cav') u.a.tool = 'loot'; else if (u.kind === 'arc') u.a.tool = 'bow'; }
  bankAll(u) {
    if (!u.carryN) return;
    const W = this.W, y = Sim.groundAt(this.S, u.x, u.z) + 1;
    let k = 0;
    for (const r of RES) if (u.carry[r] >= 1) { const n = Math.floor(u.carry[r]); this.loot[r] += n; W.floatAt(u.x, y + k * 0.35, u.z, '+' + n, r); k++; }
    u.carry = { gold: 0, wood: 0, stone: 0 }; u.carryN = 0;
    u.a.tool = u.kind === 'arc' ? 'bow' : u.kind === 'cav' ? 'sword' : u.kind === 'can' ? null : 'axe';
    this.sfx('coins');
  }
  defender(u, dt) {
    const a = u.a;
    const near = this.raiders.reduce((d, r) => Math.min(d, Math.hypot(r.x - u.post[0], r.z - u.post[1])), 1e9);
    if (u.local) u.alarmed = near < (u.alarmed ? 13 : 9);
    if (u.kind === 'can') {
      // home cannons stay put and fire at anything in range
      const foe = this.nearestEnemy(u, u.range); if (foe && (this.alarm || near < 8)) { this.raiseAlarm(); this.strike(u, dt, { u: foe }); } else { a.anim = 'idle'; a.path = null; }
      return;
    }
    if (!u.alarmed) {
      for (const r of this.raiders) if (Math.hypot(r.x - u.x, r.z - u.z) < 7) { this.raiseAlarm(); if (u.local) u.alarmed = true; break; }
      u.wander -= dt;
      if (u.wander <= 0) { u.wander = 3 + Math.random() * 4; u.wgoal = [u.post[0] + (Math.random() - 0.5) * 1.2, u.post[1] + (Math.random() - 0.5) * 1.2]; }
      if (u.local && Math.hypot(u.x - u.post[0], u.z - u.post[1]) > 1.5) { this.moveTo(u, u.post[0], u.post[1], dt, 'post'); return; }
      if (u.wgoal && this.cost(cellAt(u.wgoal[0], u.wgoal[1]), 'g') === 1) { if (this.moveTo(u, u.wgoal[0], u.wgoal[1], dt * 0.4, 'w' + u.wgoal.join())) { a.anim = 'idle'; a.path = null; } }
      return;
    }
    const foe = this.nearestEnemy(u, u.kind === 'arc' ? 5 : u.range);
    if (foe) { this.strike(u, dt, { u: foe }); return; }
    const tgt = this.nearestEnemy(u, 60);
    if (!tgt) { a.anim = 'idle'; a.path = null; return; }
    this.moveTo(u, tgt.x, tgt.z, dt, 'chase' + this.units.indexOf(tgt));
  }
  // a gunner walks behind each cannon
  syncCrew() {
    for (const u of this.units) {
      if (u.kind !== 'can' || u.dead) continue;
      if (!u.crew) { u.crew = this.W.newAgent({ id: 9000 + this.units.indexOf(u) }, u.x, u.z, 1); Object.assign(u.crew, { temp: 'raid', hidden: false, kid: false, helm: u.side === 'r' ? 'horn' : 'guard', color: u.a.color, pants: u.a.pants, tool: null, job: 'Gunner', pop: this.W.now }); this.W.agents.push(u.crew); u.a.hidden = true; }
      const ry = u.a.ry, back = 0.42 + u.recoil * 0.12;
      u.crew.x = u.x - Math.sin(ry) * back; u.crew.z = u.z - Math.cos(ry) * back; u.crew.ry = ry;
      u.crew.path = u.a.path; u.crew.anim = u.a.path ? 'push' : 'idle'; u.crew.phase = u.a.phase;
    }
  }
  /* --- ship's guns: a broadside on whatever you point at --- */
  broadside(x, z) {
    if (!this.guns || this.gunCd > 0 || this.phase !== 'go') return false;
    if (Math.hypot(x - this.boat.x, z - this.boat.z) > 16) return 'far';
    this.gunCd = 14;
    const n = this.guns * 2;
    for (let k = 0; k < n; k++) {
      const s = { x: this.boat.x + (Math.random() - 0.5) * 0.8, z: this.boat.z + (Math.random() - 0.5) * 1.6, kind: 'ship', side: 'r', dmg: 50, a: { ry: this.boat.ry } };
      setTimeout(() => { if (this.phase === 'over') return; this.shoot(s, x + (Math.random() - 0.5) * 1.6, z + (Math.random() - 0.5) * 1.6, {}, 0.6); }, k * 160);
    }
    return true;
  }
  /* --- extra things to draw: cannons, cannonballs, loot piles --- */
  draw(R, B, t, groundY) {
    const W = this.W, sc = W.pscale / 1.15;
    for (const u of this.units) {
      if (u.kind !== 'can' || (u.dead && !u.goneAt)) continue;
      const k = u.recoil, y = groundY(u.x, u.z), s = 1.25 * sc;
      R.push(B(W.cannon), u.x - Math.sin(u.a.ry) * k * 0.08, y, u.z - Math.cos(u.a.ry) * k * 0.08, u.a.ry, s, s, s, u.dead ? 0.4 : 1, u.dead ? 0.4 : 1, u.dead ? 0.4 : 1, 0);
    }
    for (const s of this.shots) {
      if (!s.ball) continue;
      const u = (this.t - s.t0), f = u / s.dur, x = s.x + (s.tx - s.x) * f, z = s.z + (s.tz - s.z) * f, y = s.y + s.vy * u - 0.5 * s.g * u * u;
      R.push(B(W.ball), x, y, z, 0, 1.2, 1.2, 1.2);
    }
    for (const p of this.piles) { const y = groundY(p.x, p.z), b = 1 + Math.sin(t * 4 + p.x) * 0.05; R.push(B(W.pile), p.x, y, p.z, p.x * 3, b * 1.2, b * 1.2, b * 1.2); }
  }
  sailHome() { if (this.phase !== 'over') this.end('sailed'); }
  end(why) {
    if (this.phase === 'over') return;
    this.phase = 'over'; this.why = why;
    for (const u of this.raiders) {
      if (Math.hypot(u.x - this.bank[0], u.z - this.bank[1]) < 2.6) this.bankAll(u);
      else if (u.carryN > 0) { this.W.floatAt(u.x, Sim.groundAt(this.S, u.x, u.z) + 1, u.z, 'Too far from the boat', 'bad'); u.carry = { gold: 0, wood: 0, stone: 0 }; u.carryN = 0; }
      if (u.kind !== 'can') { u.a.anim = 'cheer'; u.a.path = null; if (!u.a.mounted) u.a.tool = null; }
    }
    for (const g of this.guards) { g.a.anim = 'idle'; g.a.path = null; }
    this.sfx(this.loot.gold + this.loot.wood + this.loot.stone > 0 ? 'victory' : 'defeat');
    const sent = {}; for (const u of this.units) if (u.side === 'r') sent[u.kind] = (sent[u.kind] || 0) + 1;
    this.result = { loot: Object.assign({}, this.loot), lost: Object.assign({}, this.lost), sent, downs: this.downs, destroyed: this.destroyed.slice(), breaches: this.breaches, why };
    this.opt.onEnd && this.opt.onEnd(this.result);
  }
  // HUD helpers
  spots() {
    const out = [];
    for (const id in this.bs) { const st = this.bs[id], b = this.S._byId[id]; if (!b || st.dead) continue; out.push({ b, st, loot: Math.floor(st.loot.gold + st.loot.wood + st.loot.stone) }); }
    return out;
  }
  centroid() {
    const r = this.raiders.filter(u => this.sel === 'all' || u.kind === this.sel); const L = r.length ? r : this.raiders;
    if (!L.length) return [this.bank[0], this.bank[1]];
    return [L.reduce((a, u) => a + u.x, 0) / L.length, L.reduce((a, u) => a + u.z, 0) / L.length];
  }
  dispose() {
    for (const u of this.units) { this.W.removeAgent(u.a, false); if (u.crew) this.W.removeAgent(u.crew, false); }
    this.W.raidBoat = null; this.W.panic = false; this.W.bState = null; this.W.drawHook = null; this.W.noDrill = false;
  }
}
Raid.bHp = bHp;
root.Raid = Raid;
})(typeof window !== 'undefined' ? window : globalThis);
