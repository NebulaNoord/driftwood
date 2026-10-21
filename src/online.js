/* ---------- Online: share your island, visit friends, raid them ---------- */
// Islands live in the artifact's shared store as islands/<player id>; raids are logged in raids/<auto id>.
// While you visit or raid, your own island is parked in Online.home and never saved over.
const HOUR = 3600e3;
const Online = { off: 'starting', db: null, user: null, me: null, can: null, islands: [], raids: [], names: {}, mode: null, home: null, target: null, raid: null,
  pubBusy: false, pubAt: 0, pubT: -1, pending: [], mark: null, dragAt: 0, practice: null, busy: false };
const fmtAgo = ms => { const m = Math.max(0, Math.round(ms / 60000)); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 60 * 24 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };
const fmtLeft = ms => { const m = Math.ceil(ms / 60000); return m < 60 ? m + ' min' : Math.ceil(m / 60) + ' h'; };
const safeInt = (v, max) => clamp(Math.floor(+v || 0), 0, max);
const ico = (k, px) => RES_ICON[k].replace('width="22" height="22"', `width="${px}" height="${px}"`);
function homeS() { return Online.home || S; }
function myName() { const H = homeS(); return (H.mp && H.mp.name) || islandNameOf(H); }
function islandNameOf(X) { const a = ['Gull', 'Saltmoss', 'Cinder', 'Bramble', 'Pebble', 'Hollow', 'Kelp', 'Juniper', 'Larkspur', 'Tidewell'], b = [' Isle', ' Cay', ' Island', ' Key']; return a[X.seed % a.length] + b[(X.seed >> 4) % b.length]; }
function crewSize() { return clamp(4 + Math.floor(Sim.pop(homeS()) / 25), 4, 9); }
function mp() { const H = homeS(); if (!H.mp) H.mp = {}; return H.mp; }

async function onlineInit() {
  const C = window.claude;
  if (!C || typeof C.use !== 'function') { Online.off = 'local'; return; }
  let db = null, user = null;
  try { [db, user] = await Promise.all([C.use('db'), C.use('user')]); } catch (e) { db = null; }
  if (!db || !user) { Online.off = 'nodb'; renderClock(); return; }
  Online.db = db; Online.user = user;
  try { Online.me = await user.id(); } catch (e) { Online.me = null; }
  if (!Online.me) { Online.off = C.web ? 'offline' : 'signedout'; renderClock(); return; }
  try { Online.can = await user.can('data.write'); } catch (e) { Online.can = null; }
  Online.off = null;
  if (C.web && C.web.switched && C.web.switched()) await adoptOnline();
  db.collection('islands').onSnapshot(snap => {
    Online.islands = snap.docs.filter(d => d.exists).map(d => ({ id: d.id, data: d.data() }));
    fetchNames(Online.islands.map(x => x.id));
    if (UI.onlineOpen) renderOnline();
  }, e => { Online.err = e.code; });
  db.collection('raids').orderBy('at', 'desc').limit(120).onSnapshot(snap => {
    Online.raids = snap.docs.filter(d => d.exists).map(d => Object.assign({ id: d.id }, d.data()));
    fetchNames(Online.raids.flatMap(r => [r.attacker, r.target]));
    checkIncoming();
    if (UI.onlineOpen) renderOnline();
  }, e => { Online.err = e.code; });
  renderClock();
  publishIsland(true);
}
// after pasting a player code on a new device: pick up that player's newest island
async function adoptOnline() {
  try {
    const slots = (await listSlots()).filter(s => s.where === 'cloud');
    const d = await Online.db.doc('islands/' + Online.me).get(), x = d.exists ? d.data() : null;
    let best = slots[0] || null;
    if (x && (x.z || x.save) && (!best || (+x.at || 0) >= best.at)) best = { where: 'shared', z: x.z || x.save, name: String(x.name || 'your island').slice(0, 40) };
    if (!best) { toast('Player code switched. No islands saved under it yet.'); return; }
    const T = Sim.deserialize(await readSlot(best));
    swapIsland(T); toast(`Welcome back! Loaded “${best.name}”.`);
  } catch (e) { toast('Couldn’t load the islands for that code.', 'bad'); }
}
async function fetchNames(ids) {
  const want = [...new Set(ids.filter(id => typeof id === 'string' && id && !(id in Online.names)))];
  if (!want.length || !Online.user || !Online.user.profiles) return;
  for (const id of want) Online.names[id] = '';
  try { const ps = await Online.user.profiles(want); for (const id of want) Online.names[id] = (ps[id] && ps[id].name) || ''; if (UI.onlineOpen) renderOnline(); } catch (e) {}
}
const who = id => id === Online.me ? 'You' : Online.names[id] || 'A sailor';

/* --- your island in the shared store --- */
function canShare() { return !Online.off && Online.can !== false; }
async function publishIsland(force) {
  if (!canShare() || Online.mode || Online.pubBusy) return;
  const H = S;
  if (!force && (Math.abs(H.t - Online.pubT) < 0.5 || performance.now() - Online.pubAt < 60e3)) return;
  Online.pubBusy = true;
  try {
    const def = Sim.defenseOf(H), m = mp();
    const save = Sim.serialize(H); save.news = []; save.meeting = null; save.stats = Object.assign({}, save.stats, { days: [] });
    const z = await packSave(save);
    await Online.db.doc('islands/' + Online.me).set({ v: 1, owner: Online.me, name: myName(), pop: Sim.pop(H), happy: H.happy, day: Math.floor(H.t / 24) + 1,
      gold: Math.floor(H.gold), wood: Math.floor(H.wood), stone: Math.floor(H.stone), towers: def.towers, guards: def.guards, troops: Sim.TROOP_KEYS.reduce((n, t) => n + (def.troops[t] || 0), 0), walls: def.walls,
      shieldUntil: m.shieldUntil || 0, won: m.won || 0, lost: m.lost || 0, at: Date.now(), era: Sim.eraOf(H), z });
    Online.pubAt = performance.now(); Online.pubT = H.t;
  } catch (e) {
    if (e && e.code === 'invalid_argument') Online.can = false;
  }
  Online.pubBusy = false;
}

/* --- raids against you while you were away --- */
function checkIncoming() {
  if (Online.mode || !Online.me) return;
  const m = mp(), since = m.lastRaidAt || 0;
  const fresh = Online.raids.filter(r => r.target === Online.me && typeof r.at === 'number' && r.at > since && r.at < Date.now() + 5 * 60e3 && r.attacker !== Online.me).sort((a, b) => a.at - b.at);
  if (!fresh.length) return;
  const total = { gold: 0, wood: 0, stone: 0, burnt: 0 }, from = [];
  for (const r of fresh) {
    const l = r.loot || {}, lost = Sim.applyRaid(S, { gold: safeInt(l.gold, Sim.RAID.cap.gold), wood: safeInt(l.wood, Sim.RAID.cap.wood), stone: safeInt(l.stone, Sim.RAID.cap.stone) });
    for (const k in total) total[k] += lost[k];
    total.burnt = (total.burnt || 0) + Sim.burnBuildings(S, Array.isArray(r.burnt) ? r.burnt.slice(0, 6) : []);
    from.push(r);
    m.lastRaidAt = r.at; m.shieldUntil = Math.max(m.shieldUntil || 0, r.at + Sim.RAID.shieldH * HOUR); m.lost = (m.lost || 0) + 1;
  }
  save(); publishIsland(true); renderRes();
  Online.pending.push({ total, from });
  if ($('#modal').hidden && !UI.introOpen && !UI.meetingOpen) showRaidedReport();
}
function showRaidedReport() {
  const p = Online.pending.shift(); if (!p) return;
  const r = p.from[p.from.length - 1], names = [...new Set(p.from.map(x => who(x.attacker)))];
  const lostTxt = ['gold', 'wood', 'stone'].filter(k => p.total[k]).map(k => `<span class="cost">${ico(k, 18)} ${p.total[k]}</span>`).join(' ');
  const guards = p.from.reduce((a, x) => a + safeInt(x.downs, 99), 0), fell = p.from.reduce((a, x) => a + safeInt(x.lost, 99), 0);
  Sfx.play('alarm');
  openModal(`<h2>You were raided!</h2>
    <p class="lead">${esc(names.join(' and '))} landed on ${esc(myName())} ${fmtAgo(Date.now() - r.at)} and ${lostTxt ? 'carried off ' + lostTxt : 'sailed away empty-handed'}.</p>
    ${p.total.burnt ? `<p class="lead">${glyph('fire')} ${p.total.burnt} ${p.total.burnt === 1 ? 'building was' : 'buildings were'} burned. Tap them to repair.</p>` : ''}
    <p class="lead">Your defenders fought back: ${fell} ${fell === 1 ? 'raider' : 'raiders'} fell, and ${guards} of your ${guards === 1 ? 'guard was' : 'guards were'} knocked out (they’re fine now).</p>
    <p class="lead">Your island is shielded from raids for ${Sim.RAID.shieldH} hours. Watchtowers and guardhouses make the next raid harder.</p>
    <div class="row2"><button class="btn primary" data-ol="revenge:${esc(r.attacker)}">Raid them back</button><button class="btn" data-m="close">Fair enough</button></div>`);
}

/* --- the islands panel --- */
function openOnline() { UI.onlineOpen = true; renderOnline(); }
function renameIsland(v) {
  v = String(v || '').replace(/\s+/g, ' ').trim().slice(0, 28);
  const m = mp(); if (!v || v === myName()) return;
  m.name = v; save(); publishIsland(true); toast('Renamed to ' + v);
}
function shieldOf(id, data) {
  const last = Online.raids.filter(r => r.target === id).reduce((a, r) => Math.max(a, +r.at || 0), 0);
  return Math.max(+data.shieldUntil || 0, last ? last + Sim.RAID.shieldH * HOUR : 0);
}
function raidBlock(id, data) {
  if (id === Online.me) return 'That’s you';
  if (data && (data.era || 'medieval') !== Sim.eraOf(homeS())) return data.era === 'modern' ? 'A modern island' : 'A medieval island';
  const sh = shieldOf(id, data); if (sh > Date.now()) return 'Shielded · ' + fmtLeft(sh - Date.now());
  if (!canShare()) { const g = ((mp().ghostAt || {})[id] || 0) + Sim.RAID.shieldH * HOUR; if (g > Date.now()) return 'Shielded · ' + fmtLeft(g - Date.now()); }
  return null;
}
function renderOnline() {
  if (!UI.onlineOpen) return;
  const H = homeS(), m = mp(), def = Sim.defenseOf(H), now = Date.now();
  const status = {
    starting: 'Connecting to the harbour…',
    local: 'Computer islands are open to everyone. Other players’ islands show up in the game on claude.ai.',
    nodb: 'Computer islands are open to everyone. Sign in to claude.ai to see other players’ islands.',
    signedout: 'Computer islands are open to everyone. Sign in to claude.ai to see and raid other players’ islands.',
    offline: 'Computer islands are open to everyone. The harbour can’t be reached right now, so other players’ islands are hidden. Try again in a bit.',
  }[Online.off];
  let h = `<div class="ol-head"><h2>Sail the seas</h2><button class="x" data-m="close" aria-label="Close">×</button></div>`;
  if (status) h += `<p class="ol-note">${esc(status)}</p>`;
  else if (Online.can === false) h += `<p class="ol-note">You joined through a public link, so your raids on other players are <b>ghost raids</b>: you keep half the loot and they lose nothing. To share your own island and do full raids, ask the game’s owner to invite you as an <b>Editor</b>.</p>`;
  // your island
  const sh = (m.shieldUntil || 0) > now;
  h += `<section class="ol-me"><div class="ol-row"><label class="ol-name"><span>Your island</span><input id="olName" maxlength="28" value="${esc(myName())}" aria-label="Island name"></label>
    <div class="ol-stats"><span title="Watchtowers">${glyph('bow')} ${def.towers}</span><span title="Guards">${glyph('shield')} ${def.guards}</span><span title="Raids won / lost">${glyph('swords')} ${m.won || 0}/${m.lost || 0}</span></div></div>
    <p class="ol-sub">${sh ? `Shielded from raids for ${fmtLeft(m.shieldUntil - now)}.` : 'Open to raids.'} You sail with ${partyText()}.${canShare() ? ' Your island is shared automatically.' : ''}</p>
    <button class="btn" data-ol="army">${glyph('swords')} Manage your army</button></section>`;
  // computer islands: always there, for everyone
  h += `<h3 class="ol-h">Computer islands</h3>`;
  for (const R of RIVALS) {
    const wait = Math.max(0, ((m.rivalAt || {})[R.id] || 0) + R.cd * HOUR - now);
    h += `<div class="isl"><div class="isl-main"><b>${esc(rivalName(R))} <em class="stars">${stars(R.stars, 4)}</em></b><span>${esc(rivalDesc(R))} Half loot.</span></div>
      <div class="isl-btns"><button class="btn primary" data-ol="rival:${R.id}" ${wait ? 'disabled' : ''}>${wait ? 'Ready in ' + fmtLeft(wait) : 'Raid'}</button></div></div>`;
  }
  // other players
  if (!Online.off) {
    const myEra = Sim.eraOf(homeS());
    const others = Online.islands.filter(x => x.id !== Online.me && (x.data.era || 'medieval') === myEra).sort((a, b) => (+b.data.at || 0) - (+a.data.at || 0));
    // the leaderboard: the biggest islands in this era, you included
    const ranked = Online.islands.filter(x => (x.data.era || 'medieval') === myEra && (+x.data.pop || 0) > 0).sort((a, b) => (+b.data.pop || 0) - (+a.data.pop || 0)).slice(0, 10);
    if (ranked.length >= 2) {
      const E = { era: myEra };
      h += `<h3 class="ol-h">Biggest islands</h3><ol class="lb">` + ranked.map(x => { const pp = safeInt(x.data.pop, 1e6); return `<li class="${x.id === Online.me ? 'me' : ''}"><span>${esc(String(x.data.name || 'An island').slice(0, 28))}${x.id === Online.me ? ' (you)' : ''}</span><small>${esc(Sim.rankName(E, Sim.rankOf(E, pp)))} · ${pp}</small></li>`; }).join('') + `</ol>`;
    }
    h += `<h3 class="ol-h">Players’ islands</h3>`;
    if (!others.length && window.claude && window.claude.web) h += `<p class="ol-sub">No one else has built a ${myEra} island yet. Share the game’s link with friends: anyone can play straight away, no account needed.</p>`;
    else if (!others.length) h += `<p class="ol-sub">No one else has set sail yet. Invite friends from the <b>Share</b> menu, by email, as <b>Editors</b> (each needs a Claude account) and keep the public link off: people who join through a public link can visit but can’t raid. A friend’s island appears here the first time they open the game.</p>`;
    for (const x of others) {
      const d = x.data, block = raidBlock(x.id, d);
      h += `<div class="isl"><div class="isl-main"><b>${esc(String(d.name || 'An island').slice(0, 28))}</b><span>${esc(who(x.id))} · ${safeInt(d.pop, 1e6)} settlers · ${glyph('bow')} ${safeInt(d.towers, 99)} ${glyph('shield')} ${safeInt(d.guards, 99)}${safeInt(d.troops, 999) ? ' ' + glyph('swords') + ' ' + safeInt(d.troops, 999) : ''}${safeInt(d.walls, 9999) ? ' ' + glyph('wall') + ' ' + safeInt(d.walls, 9999) : ''} · ${fmtAgo(now - (+d.at || 0))}</span></div>
        <div class="isl-btns"><button class="btn" data-ol="visit:${esc(x.id)}">Visit</button><button class="btn ${block ? '' : 'primary'}" data-ol="raid:${esc(x.id)}" ${block ? 'disabled' : ''} title="${esc(block || 'Raid this island')}">${esc(block && block.startsWith('Shielded') ? block : block ? 'Can’t raid' : 'Raid')}</button></div></div>`;
    }
    const mine = Online.raids.filter(r => r.attacker === Online.me || r.target === Online.me).slice(0, 6);
    if (mine.length) {
      h += `<h3 class="ol-h">Recent raids</h3><div class="ol-log">`;
      for (const r of mine) {
        const l = r.loot || {}, got = ['gold', 'wood', 'stone'].map(k => safeInt(l[k], 1e5) ? safeInt(l[k], 1e5) + ' ' + k : '').filter(Boolean).join(', ') || 'nothing';
        h += r.attacker === Online.me ? `<div>${glyph('swords')} You raided ${esc(who(r.target))} and took ${got} · ${fmtAgo(now - r.at)}</div>` : `<div>${glyph('fire')} ${esc(who(r.attacker))} raided you and took ${got} · ${fmtAgo(now - r.at)}</div>`;
      }
      h += `</div>`;
    }
  }
  openModal(h); $('#modal').classList.add('ol');
}
async function onlineAct(a) {
  if (Online.busy) return;
  const [k, id] = a.split(':');
  if (k === 'practice') return startRival('pirate');
  if (k === 'rival') return startRival(id);
  if (k === 'army') { UI.onlineOpen = false; return openArmy(); }
  if (['slotSave', 'slotLoad', 'slotDel', 'export', 'import', 'pageClose', 'keyCopy', 'keyUse'].includes(k)) return savesAct(k, a.slice(k.length + 1));
  if (k === 'visit') return goTo(id, 'visit');
  if (k === 'raid' || k === 'revenge') return confirmRaid(id);
  if (k === 'go') return goTo(id, 'raid');
  if (k === 'home') return sailHome();
  if (k === 'finish') return finishRaid();
  if (k === 'bank' && Online.raid) { Online.raid.command({ kind: 'bank' }); Online.mark = { x: Online.raid.bank[0], z: Online.raid.bank[1], t0: world.now, col: [0.6, 0.9, 1] }; return; }
  if (k === 'raidHere' && Online.target) return confirmRaid(Online.target.id);
  if (k === 'endRaid' && Online.raid) { Online.raid.sailHome(); return; }
  if (k === 'sel' && Online.raid) { Online.raid.sel = id; renderAway(); return; }
  if (k === 'aim' && Online.raid) { Online.aim = !Online.aim; renderAway(); return; }
  if (k === 'train' || k === 'atk' || k === 'research' || k === 'boat') { const parts = a.split(':'); armyAct(parts[0], parts[1], parts[2]); return; }
}
function partyText() {
  const P = landingParty(), parts = [`${P.militia} volunteers`];
  for (const t of Sim.TROOP_KEYS) if (P.army[t]) parts.push(`${P.army[t]} ${Sim.TROOPS[t].name.toLowerCase()}`);
  return '<b>' + esc(parts.join(', ')) + '</b>';
}
function confirmRaid(id) {
  const x = Online.islands.find(i => i.id === id);
  if (!x) { toast('That island hasn’t been shared yet.', 'bad'); return; }
  const block = raidBlock(id, x.data); if (block) { toast(block, 'bad'); return; }
  UI.onlineOpen = false;
  openModal(`<h2>Raid ${esc(String(x.data.name || 'this island').slice(0, 28))}?</h2>
    <p class="lead">Your ${esc(Sim.BOATS[landingParty().boat].name.toLowerCase())} lands ${partyText()}. Tap buildings to smash and burn them; loot spills out and has to be carried back to the ship before the 2½ minutes run out.</p>
    <p class="lead">They have ${glyph('bow')} ${safeInt(x.data.towers, 99)} watchtowers, ${glyph('shield')} ${safeInt(x.data.guards, 99)} guards${safeInt(x.data.troops, 999) ? `, ${glyph('swords')} ${safeInt(x.data.troops, 999)} troops` : ''}${safeInt(x.data.walls, 9999) ? ` and ${glyph('wall')} ${safeInt(x.data.walls, 9999)} wall sections` : ''}.</p>
    ${canShare() ? '' : '<p class="lead"><b>Ghost raid:</b> you joined through a public link, so their island won’t lose anything. You keep half the loot.</p>'}
    <div class="row2"><button class="btn primary" data-ol="go:${esc(id)}">Set sail</button><button class="btn" data-m="close">Not now</button></div>`);
}

/* --- leaving home and coming back --- */
function leaveHome(T, mode, target) {
  if (!Online.mode) { save(); Online.home = S; Online.homeSpeed = UI.speed; }
  else if (Online.raid) { Online.raid.dispose(); Online.raid = null; }
  S = T; Online.mode = mode; Online.target = target;
  world.setState(S); world.panic = false; world.raidBoat = null;
  UI.sel = null; UI.selAgent = null; UI.follow = null; UI.cat = null; UI.stockOpen = false; setTool('select'); renderStock();
  $('#modal').classList.remove('ol'); closeModal(); UI.onlineOpen = false;
  frameHall(); renderAll(); renderAway();
}
async function goTo(id, mode) {
  Online.busy = true;
  try {
    let data = null;
    try { const d = await Online.db.doc('islands/' + id).get(); if (d.exists) data = d.data(); } catch (e) {}
    if (!data) { const x = Online.islands.find(i => i.id === id); data = x && x.data; }
    if (!data || !(data.save || data.z)) { toast('Couldn’t reach that island.', 'bad'); return; }
    if (mode === 'raid') { const block = raidBlock(id, data); if (block) { toast(block, 'bad'); return; } }
    let T; try { T = Sim.deserialize(await unpackSave(data.z || data.save)); } catch (e) { toast('That island’s map is damaged.', 'bad'); return; }
    T.t = Math.floor(T.t / 24) * 24 + 10; T.weather = 'sun'; T.meeting = null; T.mp = undefined;
    const target = { id, name: String(data.name || 'An island').slice(0, 28), owner: id, practice: false, ghost: !canShare() };
    leaveHome(T, mode, target);
    if (mode === 'raid') startRaid(); else { toast(`Welcome to ${target.name}!`); setSpeed(1); }
  } finally { Online.busy = false; }
}
function sailHome() {
  if (!Online.mode) return;
  if (Online.raid) { Online.raid.dispose(); Online.raid = null; }
  S = Online.home; Online.home = null; Online.mode = null; Online.target = null;
  world.setState(S); world.panic = false; world.raidBoat = null;
  UI.sel = null; UI.selAgent = null; UI.follow = null; setTool('select'); setSpeed(Online.homeSpeed || 1);
  closeModal(); frameHall(); renderAll(); renderAway(); save();
  if (Online.pending.length) setTimeout(showRaidedReport, 600); else checkIncoming();
  publishIsland(true);
}

/* --- computer islands: four rivals from sleepy to fortress, rebuilt every couple of hours --- */
// what the computer islands are called in the modern era
const RIVALS_MODERN = { cove: ['Rum Runner Bay', 'A sleepy harbour town with a couple of police officers and no walls.'], pirate: ['Cartel Key', 'Smugglers with a garrison that grows with your army.'],
  iron: ['Fort Granite', 'A fenced town with guard towers, riflemen and marksmen.'], fort: ['Iron Citadel', 'A concrete fortress with tanks, armoured cars and towers. Bring a fleet.'] };
const rivalName = R => Sim.eraOf(homeS()) === 'modern' ? RIVALS_MODERN[R.id][0] : R.name;
const rivalDesc = R => Sim.eraOf(homeS()) === 'modern' ? RIVALS_MODERN[R.id][1] : R.desc;
const RIVALS = [
  { id: 'cove', name: 'Smuggler’s Cove', stars: 1, cd: 0.5, desc: 'A sleepy fishing village with a couple of guards and no walls.', houses: 8, build: ['farm', 'market', 'lumber'], stores: [500, 250, 150] },
  { id: 'pirate', name: 'Pirate Cove', stars: 2, cd: 1, desc: 'Pirates with a garrison that grows with your army.', houses: 12, build: ['farm', 'market', 'lumber', 'tavern', 'orchard', 'barracks', 'quarry'], stores: [900, 400, 300], scale: true },
  { id: 'iron', name: 'Ironhold', stars: 3, cd: 1, desc: 'A palisaded town with watchtowers, infantry and archers.', houses: 14, build: ['farm', 'market', 'quarry', 'barracks', 'archery', 'watchtower', 'blacksmith', 'tavern'], stores: [1400, 600, 800], troops: { inf: 3, arc: 2 }, wall: 1 },
  { id: 'fort', name: 'Dragon’s Teeth', stars: 4, cd: 2, desc: 'A stone fortress with cannons, cavalry and towers. Bring a fleet.', houses: 16, build: ['farm', 'market', 'barracks', 'archery', 'cavyard', 'foundry', 'watchtower', 'watchtower', 'guardhouse', 'tavern'], stores: [2600, 900, 1100], troops: { inf: 6, arc: 4, cav: 2, can: 1 }, wall: 2 },
];
function makeRivalIsland(R) {
  const seed = ((Math.floor(Date.now() / (2 * HOUR)) * 7919) + R.stars * 104729) >>> 0;
  const T = Sim.newGame(seed, Sim.eraOf(homeS()));
  T.wood = T.gold = T.stone = T.food = 99999; for (const k of Sim.BUILDABLE) T.goals['unlock_' + k] = 1; T.goals.unlock_wall1 = T.goals.unlock_wall2 = 1;
  let s = seed % 2147483646 + 1; const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const conn = () => { const o = []; for (let c = 0; c < N * N; c++) if (T._conn[c]) o.push([c % N, (c / N) | 0]); return o; };
  for (let k = 0; k < 7 + R.stars * 2; k++) { const rc = conn(); for (let a = 0; a < 60; a++) { const [i, j] = rc[Math.floor(rand() * rc.length)]; const d = Sim.DIRS[Math.floor(rand() * 4)]; const cells = Sim.roadPath([i, j], [i + d[0] * 7, j + d[1] * 7]); const q = Sim.roadQuote(T, cells); if (q.n >= 5 && !q.blocked) { Sim.buildRoad(T, cells); break; } } }
  const place = t => { const rc = conn(), sz = TYPES[t].size; for (let a = 0; a < 600; a++) { const [i, j] = rc[Math.floor(rand() * rc.length)]; const o = [[1, 0], [-sz, 0], [0, 1], [0, -sz]][Math.floor(rand() * 4)]; if (Sim.place(T, t, i + o[0], j + o[1], Math.floor(rand() * 4)).building) return; } };
  for (let k = 0; k < R.houses; k++) place('house');
  const mine = landingParty().troops;
  const extra = R.scale && mine >= 4 ? ['watchtower'] : [];
  for (const t of R.build.concat(extra)) place(t);
  const wall = R.wall || (R.scale && mine >= 4 ? 1 : 0);
  if (wall) {
    const hall = T.b.find(b => b.type === 'hall'), ring = [], r = 5 + R.stars;
    for (let a = 0; a < 360; a += 2) ring.push([Math.round(hall.i + 1 + Math.cos(a * Math.PI / 180) * r), Math.round(hall.j + 1 + Math.sin(a * Math.PI / 180) * r)]);
    Sim.buildWall(T, ring, wall);
  }
  for (const b of T.b) b.build = 1;
  for (let k = 0; k < 24 * 3 * 4; k++) { Sim.step(T, 0.25); T.meeting = null; }
  const A = Sim.army(T);
  const tr = R.scale ? { inf: Math.min(6, Math.floor(mine / 3)), arc: Math.min(4, Math.floor(mine / 5)) } : (R.troops || {});
  for (const t of Sim.TROOP_KEYS) { A.n[t] = tr[t] || 0; A.atk[t] = 0; }
  [T.gold, T.wood, T.stone] = R.stores; T._ev.length = 0; T.goals = {};
  T.t = Math.floor(T.t / 24) * 24 + 10; T.weather = 'sun';
  return T;
}
function startRival(id) {
  const R = RIVALS.find(x => x.id === id); if (!R) return;
  const m = mp(); if (((m.rivalAt || {})[R.id] || 0) + R.cd * HOUR > Date.now()) { toast(`${rivalName(R)} is still rebuilding.`, 'bad'); return; }
  Online.busy = true; toast(`Charting a course to ${rivalName(R)}…`);
  setTimeout(() => {
    try { const T = makeRivalIsland(R); leaveHome(T, 'raid', { id: null, name: rivalName(R), practice: true, rival: R.id }); startRaid(); }
    finally { Online.busy = false; }
  }, 50);
}

/* --- the raid itself --- */
// who sails: your attack team, plus a few volunteers (more volunteers if you have no army yet)
function landingParty() {
  const H = homeS(), A = Sim.army(H), army = {}; let n = 0;
  for (const t of Sim.TROOP_KEYS) { army[t] = A.atk[t]; n += A.atk[t]; }
  return { army, militia: n ? 3 : crewSize(), lv: Object.assign({}, A.lv), boat: A.boat, troops: n };
}
function startRaid() {
  const P = landingParty();
  const r = new Raid(S, world, { militia: P.militia, army: P.army, lv: P.lv, boat: P.boat, sfx: k => Sfx.play(k),
    onEnd: res => setTimeout(() => showRaidResult(res), 1400),
    onAlarm: () => toast('The bell is ringing! The defenders are coming.', 'bad'),
    onWarn: () => toast('20 seconds! Get the loot back to the ship!', 'goal') });
  Online.raid = r; Online.aim = false;
  setSpeed(1);
  cam.fly = [r.bank[0], r.bank[1]]; cam.gdist = cssW < 700 ? 22 : 19; cam.gpitch = 0.85;
  cam.gyaw = Math.atan2(r.boat.x - r.bank[0], r.boat.z - r.bank[1]);
  renderAway();
}
const TROOP_ICON = { all: glyph('swords'), mil: glyph('axe'), inf: glyph('shield'), arc: glyph('bow'), cav: glyph('horse'), can: glyph('cannon') };
// group names follow the era: Sim.TROOPS is renamed when a modern island loads
const TROOP_LABEL = new Proxy({ all: 'All', mil: 'Volunteers' }, { get: (o, k) => k in o ? o[k] : Sim.TROOPS[k] ? Sim.TROOPS[k].name : k });
function showRaidResult(res) {
  if (!Online.raid) return;
  const l = res.loot, half = Online.target && (Online.target.practice || Online.target.ghost);
  const got = { gold: Math.floor(l.gold * (half ? 0.5 : 1)), wood: Math.floor(l.wood * (half ? 0.5 : 1)), stone: Math.floor(l.stone * (half ? 0.5 : 1)) };
  Online.result = { got, res };
  const any = got.gold + got.wood + got.stone > 0;
  const chips = ['gold', 'wood', 'stone'].map(k => `<div><b>${got[k]}</b><span>${k}</span></div>`).join('');
  const sent = Object.values(res.sent).reduce((a, n) => a + n, 0), lost = Object.values(res.lost).reduce((a, n) => a + n, 0);
  const fell = Sim.TROOP_KEYS.filter(t => res.lost[t]).map(t => `${res.lost[t]} ${TROOP_LABEL[t].toLowerCase()}`).join(', ');
  const head = res.why === 'wiped' ? 'Your landing party was beaten back' : any ? 'A fine haul!' : 'Empty-handed';
  openModal(`<h2>${head}</h2>
    <p class="lead">${res.why === 'sailed' ? 'You called everyone back to the ship.' : res.why === 'time' ? 'Time’s up. The ship weighs anchor.' : 'The defenders held the island.'}${half ? (Online.target.ghost ? ' Ghost raids pay half.' : ' Computer islands pay half.') : ''}</p>
    <div class="week">${chips}<div><b>${res.destroyed.length}</b><span>burned</span></div><div><b>${sent - lost}/${sent}</b><span>home safe</span></div><div><b>${res.downs}</b><span>foes down</span></div></div>
    ${fell ? `<p class="lead">Lost in battle: ${esc(fell)}. Train more at your army buildings.</p>` : ''}
    <button class="btn primary" data-ol="finish">Sail home</button>`);
}
// bank the loot on your own island, bury the fallen, log the raid for the defender
async function finishRaid() {
  const R0 = Online.result; Online.result = null;
  const target = Online.target;
  sailHome();
  if (!R0) return;
  const m = mp(), g = R0.got;
  S.gold += g.gold; S.wood += g.wood; S.stone += g.stone;
  Sim.loseTroops(S, R0.res.lost);
  if (g.gold + g.wood + g.stone > 0) { m.won = (m.won || 0) + 1; Sfx.play('goal'); toast(`Loot unloaded: +${g.gold} gold, +${g.wood} wood, +${g.stone} stone`, 'goal'); }
  if (target && target.rival) { m.rivalAt = Object.assign({}, m.rivalAt); m.rivalAt[target.rival] = Date.now(); }
  if (target && target.ghost && target.id) { m.ghostAt = Object.assign({}, m.ghostAt); m.ghostAt[target.id] = Date.now(); }
  save(); renderRes();
  if (target && !target.practice && !target.ghost && target.id && canShare()) {
    const r = R0.res;
    try { await Online.db.collection('raids').add({ attacker: Online.me, target: target.id, at: Date.now(), loot: r.loot, lost: Object.values(r.lost).reduce((a, n) => a + n, 0), downs: r.downs, burnt: r.destroyed.slice(0, 6), breaches: r.breaches, attackerName: myName(), targetName: target.name }); }
    catch (e) { toast('Couldn’t send the raid report.', 'bad'); }
  }
  publishIsland(true);
}

/* --- HUD while away --- */
function renderAway() {
  const el = $('#away'), mode = Online.mode;
  document.body.classList.toggle('away', !!mode);
  document.body.classList.toggle('raiding', mode === 'raid');
  if (!mode) { el.hidden = true; el._h = ''; $('#raidui').innerHTML = ''; hpPool.length = 0; stPool.length = 0; return; }
  el.hidden = false; el.classList.toggle('raid', mode === 'raid');
  let h;
  if (mode === 'visit') {
    const t = Online.target, block = t && t.id ? raidBlock(t.id, (Online.islands.find(i => i.id === t.id) || {}).data || {}) : 'x';
    h = `<div class="aw-t"><small>Visiting</small><b>${esc(t ? t.name : '')}</b><span>${esc(t && t.id ? who(t.id) : '')}</span></div>
      <div class="aw-b">${block ? '' : '<button class="btn primary" data-ol="raidHere">Raid</button>'}<button class="btn" data-ol="home">Sail home</button></div>`;
  } else {
    const r = Online.raid; if (!r) return;
    const s = Math.ceil(r.phase === 'land' ? r.time : r.left), mm = Math.floor(s / 60), ss = String(s % 60).padStart(2, '0');
    const carry = r.raiders.reduce((a, u) => a + u.carryN, 0), cnt = r.counts(), over = r.phase === 'over';
    const groups = ['all', 'mil', 'inf', 'arc', 'cav', 'can'].filter(g => g === 'all' || cnt[g]);
    if (r.sel !== 'all' && !cnt[r.sel]) r.sel = 'all';
    const gun = r.guns ? `<button class="btn gun ${Online.aim ? 'on' : ''}" data-ol="aim" ${over || r.gunCd > 0 ? 'disabled' : ''}>${glyph('cannon')} ${r.gunCd > 0 ? 'Reloading ' + Math.ceil(r.gunCd) : Online.aim ? 'Tap a target' : 'Broadside'}</button>` : '';
    h = `<div class="aw-row"><div class="aw-t"><small>Raiding ${esc(Online.target ? Online.target.name : '')}</small><b class="${r.left < 20 && r.phase === 'go' ? 'hot' : ''}">${mm}:${ss}</b><span>${glyph('swords')} ${r.raiders.length} · ${glyph('shield')} ${r.guards.length} · ${glyph('fire')} ${r.destroyed.length}${carry ? ` · carrying ${Math.round(carry)}` : ''}</span></div>
      <div class="aw-loot">${['gold', 'wood', 'stone'].map(k => `<span>${ico(k, 18)}<b>${r.loot[k]}</b></span>`).join('')}</div></div>
      <div class="aw-groups" role="group" aria-label="Who to command">${groups.map(g => `<button class="grp ${r.sel === g ? 'on' : ''}" data-ol="sel:${g}" title="${TROOP_LABEL[g]}">${TROOP_ICON[g]}<span>${g === 'all' ? 'All ' + r.raiders.length : TROOP_LABEL[g] + ' ' + cnt[g]}</span></button>`).join('')}</div>
      <div class="aw-b">${gun}<button class="btn" data-ol="bank" ${over ? 'disabled' : ''}>${Sim.eraOf(S) === 'modern' ? 'To the boat' : 'To the ship'}</button><button class="btn danger" data-ol="endRaid" ${over ? 'disabled' : ''}>Sail home</button></div>`;
  }
  if (el._h !== h) { el.innerHTML = eraH(h); el._h = h; }
}
// health bars over fighters, damage bars over buildings
const hpPool = [], stPool = [];
function renderRaidLabels() {
  const r = Online.raid, box = $('#raidui');
  let k = 0, q = 0;
  if (r) {
    for (const u of r.units) {
      if (u.dead || (u.hp >= u.max && u.side === 'g' && !u.alarmed)) continue;
      if (u.side === 'r' && r.sel !== 'all' && u.kind !== r.sel && u.hp >= u.max) continue;
      const p = project(u.x, agentY(u.a) + (u.kind === 'cav' ? 1.5 : u.kind === 'can' ? 0.7 : 1.05) * world.pscale / 1.15, u.z); if (!p) continue;
      let el = hpPool[k]; if (!el) { el = document.createElement('div'); el.innerHTML = '<i></i>'; box.appendChild(el); hpPool[k] = el; }
      el.className = 'hp ' + (u.side === 'r' ? 'hp-raider' : 'hp-guard') + (u.carryN > 0 ? ' loaded' : '') + (u.side === 'r' && (r.sel === 'all' || u.kind === r.sel) ? ' picked' : ''); el.hidden = false;
      el.firstChild.style.width = Math.round(100 * u.hp / u.max) + '%';
      el.style.left = p[0] + 'px'; el.style.top = p[1] + 'px'; k++;
    }
    const tg = new Set(r.raiders.filter(u => u.order.kind === 'attack').map(u => u.order.id));
    for (const s of r.spots()) {
      if (s.st.hp >= s.st.max && s.loot < 20 && !tg.has(s.b.id)) continue;
      const [x, z] = Sim.center(s.b), p = project(x, s.b.y + (s.b.type === 'hall' ? 2.2 : TYPES[s.b.type].size > 1 ? 1.6 : 1.2), z); if (!p) continue;
      let el = stPool[q]; if (!el) { el = document.createElement('div'); el.innerHTML = '<div class="bb"><i></i></div><span></span>'; box.appendChild(el); stPool[q] = el; }
      el.className = 'stash' + (s.st.fire > 0.2 || s.st.hp < s.st.max * 0.5 ? ' burning' : ''); el.hidden = false;
      el.firstChild.firstChild.style.width = Math.round(100 * s.st.hp / s.st.max) + '%';
      const txt = s.loot ? ['gold', 'wood', 'stone'].filter(k2 => s.st.loot[k2] >= 1).map(k2 => ico(k2, 14) + Math.floor(s.st.loot[k2])).join(' ') : '';
      if (el._t !== txt) { el.lastChild.innerHTML = txt; el._t = txt; }
      el.style.left = p[0] + 'px'; el.style.top = p[1] + 'px'; q++;
    }
    const bp = project(r.boat.x, 2.2, r.boat.z);
    let be = box.querySelector('.boatlbl'); if (!be) { be = document.createElement('div'); be.className = 'boatlbl'; box.appendChild(be); }
    be.textContent = 'Your ' + Sim.BOATS[r.boatLv].name.toLowerCase();
    if (bp) { be.hidden = false; be.style.left = bp[0] + 'px'; be.style.top = bp[1] + 'px'; } else be.hidden = true;
  }
  for (; k < hpPool.length; k++) hpPool[k].hidden = true;
  for (; q < stPool.length; q++) stPool[q].hidden = true;
}
function raidTap(p, h) {
  const r = Online.raid; if (!r || r.phase === 'over') return;
  const mark = (o, col) => { Online.mark = Object.assign({ t0: world.now, col }, o); Sfx.play('click'); };
  if (Online.aim) {
    Online.aim = false; if (!h) return;
    const ok = r.broadside(h.x, h.z);
    if (ok === 'far') toast('Out of range of the ship’s guns.', 'bad'); else if (ok) mark({ x: h.x, z: h.z, big: true }, [1, 0.45, 0.2]);
    renderAway(); return;
  }
  let best = null, bd = 36;
  for (const u of r.guards) { const q = project(u.x, agentY(u.a) + 0.3, u.z); if (!q) continue; const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; best = u; } }
  if (best) { r.command({ kind: 'hit', u: best }); mark({ x: best.x, z: best.z }, [1, 0.4, 0.35]); return; }
  if (!h) return;
  const b = buildingAt(h.i, h.j);
  if (b && r.bLive(b.id)) { r.command({ kind: 'attack', id: b.id }); mark({ b }, [1, 0.6, 0.25]); return; }
  const c = Sim.inB(h.i, h.j) ? Sim.ci(h.i, h.j) : -1;
  if (c >= 0 && r.wallHp[c] > 0) { r.command({ kind: 'wall', c }); mark({ x: h.i - N / 2 + 0.5, z: h.j - N / 2 + 0.5 }, [1, 0.6, 0.25]); return; }
  if (Math.hypot(h.x - r.boat.x, h.z - r.boat.z) < 2.5 || Math.hypot(h.x - r.bank[0], h.z - r.bank[1]) < 1.2) { r.command({ kind: 'bank' }); mark({ x: r.bank[0], z: r.bank[1] }, [0.6, 0.9, 1]); return; }
  r.command({ kind: 'move', x: h.x, z: h.z }); mark({ x: h.x, z: h.z }, [1, 1, 1]);
}
function onlineFrame(dt) {
  const r = Online.raid;
  if (r) {
    r.update(dt);
    if (performance.now() - Online.dragAt > 2500 && r.phase !== 'over') { const c = r.centroid(); if (Math.hypot(c[0] - cam.tx, c[1] - cam.tz) > 3) cam.fly = c; }
  }
  if (Online.mode) { Online.hudT = (Online.hudT || 0) + dt; if (Online.hudT > 0.2) { Online.hudT = 0; renderAway(); } renderRaidLabels(); }
  else { Online.pubTick = (Online.pubTick || 0) + dt; if (Online.pubTick > 30) { Online.pubTick = 0; publishIsland(false); } }
}
function onlineOverlay() {
  const r = Online.raid, m = Online.mark;
  if (r && r.phase !== 'over') {
    const tgt = new Set(r.raiders.filter(u => u.order.kind === 'attack').map(u => u.order.id));
    for (const id of tgt) { const b = S._byId[id]; if (b && r.bLive(id)) ovRect(b.i, b.j, TYPES[b.type].size, [1, 0.6, 0.25], 0.08); }
    ovRing(r.bank[0], r.bank[1], 1.2 + Math.sin(world.now * 3) * 0.05, 0.08, [0.6, 0.9, 1], 40);
    if (Online.aim) ovRing(r.boat.x, r.boat.z, 16, 0.12, [1, 0.5, 0.25], 90);
    for (const u of r.units) if (!u.dead && (u.side === 'r' || u.alarmed)) {
      const picked = u.side === 'r' && (r.sel === 'all' || u.kind === r.sel);
      ovRing(u.x, u.z, u.kind === 'cav' || u.kind === 'can' ? 0.34 : 0.24, picked ? 0.07 : 0.035, u.side === 'r' ? (u.carryN > 0 ? [1, 0.85, 0.3] : [1, 0.4, 0.3]) : [0.4, 0.65, 1], 14);
    }
  }
  if (m && world.now - m.t0 < 1) {
    const u = (world.now - m.t0), col = m.col;
    if (m.b) ovRect(m.b.i, m.b.j, TYPES[m.b.type].size, col, 0.12 * (1 - u) + 0.02);
    else ovRing(m.x, m.z, (m.big ? 1.2 : 0.25) + u * 0.6, 0.08 * (1 - u) + 0.02, col, 28);
  }
}

/* --- the army panel: train, split into attack and defence teams, research, upgrade the ship --- */
function openArmy() { UI.armyOpen = true; renderArmy(); }
function renderArmy() {
  if (!UI.armyOpen) return;
  const H = homeS(), A = Sim.army(H), boat = Sim.BOATS[A.boat], next = Sim.BOATS[A.boat + 1], slots = Sim.boatSlots(H);
  const school = H.b.some(b => b.type === 'warschool' && Sim.done(b) && !b.burnt && b.staff > 0);
  let h = `<div class="ol-head"><h2>Your army</h2><button class="x" data-m="close" aria-label="Close">×</button></div>
    <p class="ol-sub">Troops on the <b>attack team</b> sail with you on raids. Everyone else stays home and defends when your island is raided. Troops eat like settlers.</p>`;
  h += `<div class="ship"><div class="ship-main"><b>${esc(boat.name)}</b><span>${slots}/${boat.cap} troop slots${boat.guns ? ` · ${boat.guns * 2}-gun broadside` : ''}. Infantry and archers take 1 slot, cavalry 2, cannons 3.</span>
    <div class="bar"><i style="width:${Math.min(100, 100 * slots / boat.cap)}%"></i></div></div>
    ${next ? `<button class="btn ${Sim.affordable(H, next.cost) ? 'primary' : ''}" data-ol="boat" title="${esc(next.need ? 'Needs a ' + TYPES[next.need].name : '')}">Build a ${esc(next.name)}<small>${next.cap} slots${next.guns ? ', cannons' : ''} · ${esc(Sim.costText(next.cost))}${next.need ? ' · needs ' + esc(TYPES[next.need].name) : ''}</small></button>` : '<span class="ol-sub">The finest ship afloat.</span>'}</div>`;
  for (const t of Sim.TROOP_KEYS) {
    const T = Sim.TROOPS[t], n = A.n[t], atk = A.atk[t], cap = Sim.armyCap(H, t), q = Sim.queued(H, t), lv = A.lv[t];
    const home = TYPES[T.home], has = cap > 0, rc = lv < 3 ? Sim.RESEARCH[lv + 1] : null;
    const next = A.q.filter(x => x.type === t).reduce((m, x) => Math.min(m, x.end), 1e9);
    h += `<div class="trp"><div class="trp-ico">${TROOP_ICON[t]}</div><div class="trp-main"><b>${T.name} <em>${stars(lv)}</em></b>
      <span>${has ? `${n}/${cap} trained${q ? ` · ${q} in training, next in ${fmtHours(next - H.t)}` : ''}` : `Build ${/^[AEIOU]/.test(home.name) ? 'an' : 'a'} ${esc(home.name)} to train ${T.name.toLowerCase()}.`}</span>
      ${n ? `<div class="split"><button data-ol="atk:${t}:-1" aria-label="Fewer attacking" ${atk ? '' : 'disabled'}>−</button><span><b>${atk}</b> attack · <b>${n - atk}</b> defend</span><button data-ol="atk:${t}:1" aria-label="More attacking" ${atk < n ? '' : 'disabled'}>+</button></div>` : ''}</div>
      <div class="trp-btns">${has ? `<button class="btn" data-ol="train:${t}:1">Train 1<small>${esc(Sim.costText(T.cost))}</small></button><button class="btn" data-ol="train:${t}:5">×5</button>` : ''}
      ${rc ? `<button class="btn" data-ol="research:${t}" ${school ? '' : 'disabled'} title="${school ? '' : 'Needs a Military School with workers'}">${glyph('star', 14)} Level ${lv + 1}<small>${esc(Sim.costText(rc))}</small></button>` : ''}</div></div>`;
  }
  if (!school) h += `<p class="ol-sub">Build a <b>Military School</b> to research stronger troops (+25% health and damage per level).</p>`;
  openModal(h); $('#modal').classList.add('ol');
}
const fmtHours = h => h <= 0 ? 'moments' : h < 1 ? Math.max(1, Math.round(h * 60)) + ' min' : (Math.round(h * 10) / 10) + ' h';
function armyAct(k, a, b) {
  const H = homeS(); let r;
  if (k === 'train') r = Sim.train(H, a, +b);
  else if (k === 'atk') r = Sim.assign(H, a, Sim.army(H).atk[a] + (+b));
  else if (k === 'research') r = Sim.research(H, a);
  else if (k === 'boat') r = Sim.upgradeBoat(H);
  if (r && r.error) { toast(r.error, 'bad'); Sfx.play('err'); }
  else if (k === 'train') toast(`Training ${r.n} ${Sim.TROOPS[a].name.toLowerCase()}.`);
  if (k === 'atk' && r && !r.error && r.atk === Sim.army(H).atk[a] && +b > 0 && Sim.boatSlots(H) >= Sim.BOATS[Sim.army(H).boat].cap) toast('The ship is full. Upgrade it to carry more.');
  processEvents(); renderRes(); renderArmy(); save();
}

/* ---------- Saves: named slots on your Claude account (or this browser), plus files ---------- */
const SLOT_KEY = 'driftwood.slots.v2';
async function packSave(obj) {
  const json = JSON.stringify(obj);
  if (typeof CompressionStream === 'undefined') return 'j:' + json;
  const buf = new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return 'z:' + btoa(s);
}
async function unpackSave(str) {
  if (str && typeof str === 'object') return str;
  if (typeof str !== 'string') throw new Error('Save file is damaged.');
  if (str.startsWith('j:')) return JSON.parse(str.slice(2));
  if (!str.startsWith('z:') || typeof DecompressionStream === 'undefined') throw new Error('Save file is damaged.');
  const bin = atob(str.slice(2)), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const reader = new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip')).getReader(), parts = []; let n = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; n += value.length; if (n > 8e6) throw new Error('Save file is too large.'); parts.push(value); }
  return JSON.parse(new TextDecoder().decode(await new Blob(parts).arrayBuffer()));
}
const localSlots = () => { try { const o = JSON.parse(localStorage.getItem(SLOT_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } };
// your private saves live in your own corner of the store: data/users/<you> (a collection), one document per save
function cloudSlots() { return Online.db && Online.me && Online.can !== false ? Online.db.collection('data/users/' + Online.me) : null; }
const slotMeta = (id, where, x) => ({ id, where, name: String(x.name || 'Island').slice(0, 40), day: x.day | 0, pop: x.pop | 0, at: +x.at || 0, z: x.z });
async function listSlots() {
  const out = [], col = cloudSlots();
  Online.slotErr = null;
  if (col) { try { const snap = await col.limit(200).get(); for (const d of snap.docs) if (d.exists && d.id.startsWith('save-')) out.push(slotMeta(d.id, 'cloud', d.data())); } catch (e) { Online.slotErr = (e && e.code) || 'error'; } }
  const L = localSlots(); for (const id in L) out.push(slotMeta(id, 'local', L[id]));
  // your island as other players see it, in case it isn't saved anywhere else
  const pub = Online.me && Online.islands.find(x => x.id === Online.me);
  if (!out.length && pub) out.push({ id: 'shared', where: 'shared', name: String(pub.data.name || 'Your shared island').slice(0, 40) + ' (shared copy)', day: pub.data.day | 0, pop: pub.data.pop | 0, at: +pub.data.at || 0, z: pub.data.z || pub.data.save });
  return out.sort((a, b) => b.at - a.at);
}
async function writeSlot(id, name, X, where) {
  const meta = { name: String(name || 'Island').slice(0, 40), day: Math.floor(X.t / 24) + 1, pop: Sim.pop(X), at: Date.now(), seed: X.seed };
  const z = await packSave(Sim.serialize(X));
  const col = where !== 'local' && cloudSlots();
  if (col) { try { await col.doc(id).set(Object.assign({ z }, meta)); return 'cloud'; } catch (e) { Online.slotErr = (e && e.code) || 'error'; } }
  const L = localSlots(); L[id] = Object.assign({ z }, meta);
  try { localStorage.setItem(SLOT_KEY, JSON.stringify(L)); return 'local'; } catch (e) { return null; }
}
async function readSlot(s) {
  if (s.z) return unpackSave(s.z);
  if (s.where === 'shared') { const d = await Online.db.doc('islands/' + Online.me).get(); if (!d.exists) throw new Error('That island is gone.'); return unpackSave(d.data().z || d.data().save); }
  if (s.where === 'cloud') { const d = await cloudSlots().doc(s.id).get(); if (!d.exists) throw new Error('That save is gone.'); return unpackSave(d.data().z); }
  const x = localSlots()[s.id]; if (!x) throw new Error('That save is gone.'); return unpackSave(x.z);
}
async function deleteSlot(s) {
  if (s.where === 'cloud') await cloudSlots().doc(s.id).delete();
  else if (s.where === 'local') { const L = localSlots(); delete L[s.id]; localStorage.setItem(SLOT_KEY, JSON.stringify(L)); }
}
// every island gets its own automatic save, keyed by its seed, so starting over or loading never loses one
async function keepCurrent() {
  if (!S || Online.mode || !S.b.length || S.t < 3) return;
  try { await writeSlot('save-auto-' + (S.seed >>> 0).toString(36), myName(), S); } catch (e) {}
}
// your raid history and shield belong to you, not to one island
function carryMp(from, to) {
  const a = (from && from.mp) || {}, b = Object.assign({}, to.mp || {});
  for (const k of ['lastRaidAt', 'shieldUntil', 'won', 'lost', 'practiceAt']) b[k] = Math.max(+a[k] || 0, +b[k] || 0);
  for (const k of ['rivalAt', 'ghostAt']) b[k] = Object.assign({}, b[k] || {}, a[k] || {});
  to.mp = b;
}
function swapIsland(T) {
  carryMp(S, T); S = T;
  world.setState(S); UI.sel = null; UI.selAgent = null; UI.cat = null; setTool('select'); frameHall(); save(); renderAll();
  publishIsland(true);
}
/* --- the Your islands page --- */
async function openSaves() {
  if (Online.mode) { toast('Sail home first.', 'bad'); return; }
  UI.savesOpen = true; UI.slots = null; closeModal(); renderSaves();
  UI.slots = await listSlots(); renderSaves();
}
function closeSaves(loaded) { UI.savesOpen = false; UI.confirm = null; const p = $('#isles'); p.hidden = true; p.innerHTML = ''; const back = UI.fromIntro && !loaded; UI.fromIntro = false; if (back) showIntro(); else renderHint(); }
function renderSaves() {
  const page = $('#isles');
  if (!UI.savesOpen) { page.hidden = true; return; }
  const cloud = !!cloudSlots() && !Online.slotErr, now = Date.now(), slots = UI.slots, arm = UI.confirm;
  let h = `<header class="pg-head"><button class="btn" data-ol="pageClose">← Back to the island</button><div><h1>Your islands</h1>
    <p>${cloud ? (window.claude && window.claude.web ? 'Saved online under your player code (below), so you can pick them up on any device.' : 'Saved to your Claude account, so they follow you to any device.') : 'Saved in this browser.'} Each island also keeps its own automatic save.</p></div></header>
    <section class="pg-now"><canvas class="mm" data-mm="now" width="192" height="192"></canvas><div class="pg-now-main"><small>Playing now</small><b>${esc(myName())}</b>
    <span>Day ${Math.floor(S.t / 24) + 1} · ${Sim.pop(S)} settlers · ${Math.floor(S.gold)} gold</span>
    <div class="ol-row"><label class="ol-name"><span>Save a copy as</span><input id="slotName" maxlength="40" value="${esc(myName() + ' · day ' + (Math.floor(S.t / 24) + 1))}"></label><button class="btn primary" data-ol="slotSave">Save</button></div>
    <div class="row2"><button class="btn" data-ol="export">Export to a file</button><button class="btn" data-ol="import">Import a file</button></div></div></section>
    <input type="file" id="olFile" accept=".json,application/json" hidden>
    ${window.claude && window.claude.web ? `<section class="pg-key"><div><b>Your secret player code</b><span>Your islands and raids are tied to this code. Paste it on another device to play there. Anyone with it can play as you, so keep it to yourself.</span></div>
      <div class="ol-row"><input id="keyIn" placeholder="Paste a player code" maxlength="80" autocomplete="off" spellcheck="false"><button class="btn" data-ol="keyUse">Use code</button><button class="btn" data-ol="keyCopy">Copy my code</button></div></section>` : ''}
    <h2 class="pg-h">Saved islands</h2>`;
  if (!slots) h += `<p class="pg-empty">Loading your islands…</p>`;
  else if (!slots.length) h += `<p class="pg-empty">No saved islands yet. Save a copy above, or start a new island and this one will be kept here automatically.</p>`;
  else {
    h += `<div class="pg-grid">`;
    slots.forEach((s, n) => {
      const k = s.where + ':' + s.id, tag = s.where === 'shared' ? 'Shared copy' : s.id.startsWith('save-auto-') ? 'Auto' : s.where === 'local' && cloud ? 'This browser' : '';
      h += `<article class="card-isl"><canvas class="mm" data-mm="${n}" width="192" height="192"></canvas>${tag ? `<em class="tag">${tag}</em>` : ''}
        <div class="ci-body"><b>${esc(s.name)}</b><span>Day ${s.day} · ${s.pop} settlers · ${fmtAgo(now - s.at)}</span>
        <div class="ci-btns"><button class="btn ${arm === 'load:' + k ? 'primary' : ''}" data-ol="slotLoad:${esc(k)}">${arm === 'load:' + k ? 'Tap again to load' : 'Load'}</button>
        ${s.where === 'shared' ? '' : `<button class="btn danger ${arm === 'del:' + k ? 'arm' : ''}" data-ol="slotDel:${esc(k)}" aria-label="Delete ${esc(s.name)}">${arm === 'del:' + k ? 'Delete' : '×'}</button>`}</div></div></article>`;
    });
    h += `</div>`;
  }
  page.innerHTML = eraH(h); page.hidden = false; hint(null);
  drawMinimap(page.querySelector('[data-mm=now]'), S);
  if (slots) slots.forEach((s, n) => { const cv = page.querySelector(`[data-mm="${n}"]`); if (!cv) return; (s.mini ? Promise.resolve(s.mini) : readSlot(s).then(o => (s.mini = Sim.deserialize(o)))).then(T => drawMinimap(cv, T)).catch(() => {}); });
}
// a little painted map of an island: sea, beaches, fields, hills, roads, walls and buildings
function drawMinimap(cv, X) {
  if (!cv || !X) return;
  const g = cv.getContext('2d'), sc = cv.width / N, img = g.createImageData(N, N), V = N + 1;
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const h = (X.h[j * V + i] + X.h[j * V + i + 1] + X.h[(j + 1) * V + i] + X.h[(j + 1) * V + i + 1]) / 4, c = j * N + i;
    let col = h < -0.3 ? mix([143, 208, 232], [42, 110, 150], Math.min(1, (-h - 0.3) / 3)) : h < 0.05 ? [205, 185, 138] : h < 0.5 ? [236, 217, 163] : h > 8.5 ? [242, 242, 238] : h > 5.5 ? [163, 157, 147] : mix([128, 178, 90], [92, 140, 70], Math.min(1, h / 6));
    if (X.tree[c] && h > 0.05) col = [62, 110, 64];
    if (X.road[c]) col = X.road[c] === 4 ? [196, 187, 169] : X.road[c] === 3 ? [170, 164, 152] : [220, 198, 156];
    if (X.wall && X.wall[c]) col = X.wall[c] === 2 ? [110, 104, 96] : [94, 59, 40];
    img.data.set([col[0], col[1], col[2], 255], c * 4);
  }
  const off = document.createElement('canvas'); off.width = off.height = N; off.getContext('2d').putImageData(img, 0, 0);
  g.imageSmoothingEnabled = false; g.drawImage(off, 0, 0, cv.width, cv.height);
  for (const b of X.b) {
    const T = TYPES[b.type]; if (!T) continue;
    g.fillStyle = b.burnt ? '#3b2f2a' : b.type === 'hall' ? '#3d6b8c' : T.home ? '#c8553d' : T.army || T.guard || b.type === 'warschool' ? '#5a5f6e' : '#8b5a3c';
    g.fillRect(b.i * sc + 0.5, b.j * sc + 0.5, T.size * sc - 1, T.size * sc - 1);
  }
}
const slotOf = k => { const i = k.indexOf(':'); return (UI.slots || []).find(s => s.where === k.slice(0, i) && s.id === k.slice(i + 1)); };
async function savesAct(k, arg) {
  if (k === 'pageClose') { closeSaves(); return; }
  if (Online.busy) return;
  Online.busy = true;
  try {
    if (k === 'slotSave') {
      const name = ($('#slotName') && $('#slotName').value.trim()) || myName();
      const where = await writeSlot('save-' + Date.now().toString(36), name, S);
      toast(where ? `Saved “${name}”${where === 'cloud' ? ' to your account' : ' in this browser'}.` : 'Couldn’t save. Storage is full.', where ? '' : 'bad');
      UI.slots = await listSlots(); renderSaves(); return;
    }
    if (k === 'slotLoad' || k === 'slotDel') {
      const s = slotOf(arg); if (!s) return;
      const key = (k === 'slotLoad' ? 'load:' : 'del:') + arg;
      if (UI.confirm !== key) { UI.confirm = key; renderSaves(); return; }
      UI.confirm = null;
      if (k === 'slotDel') { await deleteSlot(s); toast('Deleted.'); UI.slots = await listSlots(); renderSaves(); return; }
      const T = s.mini ? Sim.deserialize(Sim.serialize(s.mini)) : Sim.deserialize(await readSlot(s));
      await keepCurrent();
      closeSaves(true); swapIsland(T); toast(`Loaded “${s.name}”.`); return;
    }
    if (k === 'export') {
      const data = JSON.stringify({ driftwood: 1, name: myName(), day: Math.floor(S.t / 24) + 1, pop: Sim.pop(S), save: Sim.serialize(S) });
      const file = (myName().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'island') + '-day' + (Math.floor(S.t / 24) + 1) + '.json';
      const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
      if (dl) { try { const r = await dl.save({ filename: file, data }); if (r && r.status === 'saved') toast('Island exported.'); } catch (e) { if (!e || e.code !== 'cancelled') toast('Couldn’t export the file.', 'bad'); } }
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = file; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
      return;
    }
    if (k === 'import') { const f = $('#olFile'); if (f) f.click(); return; }
    if (k === 'keyCopy') { const key = window.claude.web.key(); try { await navigator.clipboard.writeText(key); toast('Player code copied.'); } catch (e) { const i = $('#keyIn'); i.value = key; i.select(); toast('Copy the code from the box.'); } return; }
    if (k === 'keyUse') { const v = ($('#keyIn').value || '').trim(); if (!window.claude.web.valid(v)) { toast('That isn’t a player code.', 'bad'); return; } await keepCurrent(); save(); window.claude.web.setKey(v); return; }
  } catch (e) { toast((e && e.message) || 'Something went wrong.', 'bad'); }
  finally { Online.busy = false; }
}
async function importFile(file) {
  if (!file) return;
  if (file.size > 8e6) { toast('That file is too large to be an island.', 'bad'); return; }
  try {
    const o = JSON.parse(await file.text()), raw = o && o.driftwood ? o.save : o;
    const T = Sim.deserialize(raw);
    await keepCurrent(); closeSaves(true); swapIsland(T); toast(`Imported ${o && o.name ? '“' + String(o.name).slice(0, 40) + '”' : 'an island'}.`);
  } catch (e) { toast('That isn’t a Driftwood island file.', 'bad'); }
}
