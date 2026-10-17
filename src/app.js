/* Driftwood — interface, input and main loop */
(function () {
'use strict';
const { M4, Builder, hex } = window.GL;
const Sim = window.Sim, World = window.World;
const { N, TYPES } = Sim;
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SAVE_KEY = 'driftwood.save.v1', PREF_KEY = 'driftwood.prefs.v1';
const SPEEDS = [0, 0.1, 0.3, 0.8];

/* ---------- Icons ---------- */
const I = {
  gold: '<svg width="22" height="22" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#f4c95d" stroke="#c9952b" stroke-width="2"/><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 010 3h-3a1.5 1.5 0 000 3h4" stroke="#a8761b" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
  wood: '<svg width="22" height="22" viewBox="0 0 24 24"><rect x="3" y="11" width="16" height="7" rx="3.5" fill="#a06a43"/><ellipse cx="19" cy="14.5" rx="2.6" ry="3.5" fill="#e3bc8d" stroke="#a06a43" stroke-width="1.4"/><rect x="5" y="5" width="13" height="6.5" rx="3.2" fill="#8b5a3c"/><ellipse cx="18" cy="8.25" rx="2.4" ry="3.2" fill="#e3bc8d" stroke="#8b5a3c" stroke-width="1.4"/></svg>',
  stone: '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 17l3-8 5-3 6 2 3 7-3 4H7z" fill="#a8a29a" stroke="#7d776f" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 10l3 3 4-2" stroke="#7d776f" stroke-width="1.4" fill="none"/></svg>',
  food: '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 21V9" stroke="#b7862c" stroke-width="2" stroke-linecap="round"/><g fill="#e9b949" stroke="#b7862c" stroke-width="1.2"><ellipse cx="9.5" cy="9" rx="2" ry="3" transform="rotate(-25 9.5 9)"/><ellipse cx="14.5" cy="9" rx="2" ry="3" transform="rotate(25 14.5 9)"/><ellipse cx="9.5" cy="14" rx="2" ry="3" transform="rotate(-25 9.5 14)"/><ellipse cx="14.5" cy="14" rx="2" ry="3" transform="rotate(25 14.5 14)"/><ellipse cx="12" cy="5" rx="1.8" ry="2.8"/></g></svg>',
  pop: '<svg width="22" height="22" viewBox="0 0 24 24"><circle cx="12" cy="7.5" r="3.5" fill="#f1c9a5" stroke="#b98a68" stroke-width="1.4"/><path d="M5 20c0-4 3-7 7-7s7 3 7 7z" fill="#2a9d8f"/></svg>',
  face(h) { const c = h >= 70 ? '#8ac06a' : h >= 45 ? '#f4c95d' : '#f08a6c', m = h >= 70 ? 'M8 13.5q4 4 8 0' : h >= 45 ? 'M8.5 14.5h7' : 'M8 16q4-3.5 8 0'; return `<svg width="22" height="22" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="${c}" stroke="rgba(0,0,0,.18)" stroke-width="1.5"/><circle cx="9" cy="10" r="1.3" fill="#3b2f2a"/><circle cx="15" cy="10" r="1.3" fill="#3b2f2a"/><path d="${m}" stroke="#3b2f2a" stroke-width="1.7" fill="none" stroke-linecap="round"/></svg>`; },
  sun: '<svg width="26" height="26" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="#f4c95d"/><g stroke="#f4a261" stroke-width="2" stroke-linecap="round"><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></g></svg>',
  cloud: '<svg width="26" height="26" viewBox="0 0 24 24"><circle cx="9" cy="9" r="4" fill="#f4c95d"/><path d="M6 19h11a4 4 0 000-8 5 5 0 00-9.6 1.5A3.3 3.3 0 006 19z" fill="#e8eef4" stroke="#9fb0c2" stroke-width="1.4"/></svg>',
  rain: '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M6 15h11a4 4 0 000-8 5 5 0 00-9.6 1.5A3.3 3.3 0 006 15z" fill="#d5dee8" stroke="#8597aa" stroke-width="1.4"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3" stroke="#3d7cc9" stroke-width="1.8" stroke-linecap="round"/></svg>',
  overcast: '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M5.5 18h12a4.2 4.2 0 000-8.4 5.4 5.4 0 00-10.3 1.6A3.4 3.4 0 005.5 18z" fill="#dde4ea" stroke="#8b99a8" stroke-width="1.4"/><path d="M14 8.2a4 4 0 017.2 2.6" fill="none" stroke="#a9b5c1" stroke-width="1.4" stroke-linecap="round"/></svg>',
  drizzle: '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M6 14h11a4 4 0 000-8 5 5 0 00-9.6 1.5A3.3 3.3 0 006 14z" fill="#e2e8ee" stroke="#8b99a8" stroke-width="1.4"/><g stroke="#5f8fc4" stroke-width="1.6" stroke-linecap="round"><path d="M9 17.5v1.2M13 18.5v1.2M16.5 17v1.2"/></g></svg>',
  storm: '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M6 14h11a4 4 0 000-8 5 5 0 00-9.6 1.5A3.3 3.3 0 006 14z" fill="#b8c2cc" stroke="#6b7785" stroke-width="1.4"/><path d="M12.5 13l-2.5 4.5h3l-2 4.5" fill="none" stroke="#f2b33d" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  fog: '<svg width="26" height="26" viewBox="0 0 24 24"><g stroke="#9aa7b4" stroke-width="2" stroke-linecap="round"><path d="M4 9h12M7 13h13M3 17h10M15 17h4"/></g></svg>',
  moon: '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M15 3a8 8 0 100 18 9 9 0 010-18z" fill="#c9d4f2" stroke="#7f8fbf" stroke-width="1.4"/></svg>',
  pause: '<svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="1" width="3.5" height="12" rx="1" fill="currentColor"/><rect x="8.5" y="1" width="3.5" height="12" rx="1" fill="currentColor"/></svg>',
  play: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 1l10 6-10 6z" fill="currentColor"/></svg>',
  fast: '<svg width="18" height="14" viewBox="0 0 18 14"><path d="M1 1l8 6-8 6zM9 1l8 6-8 6z" fill="currentColor"/></svg>',
  faster: '<svg width="22" height="14" viewBox="0 0 22 14"><path d="M1 1l7 6-7 6zM8 1l7 6-7 6zM15 1l6 6-6 6z" fill="currentColor"/></svg>',
  army: '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M5 3l11 11M19 3L8 14" stroke="#8e9aa6" stroke-width="2.6" stroke-linecap="round"/><path d="M5 3l11 11M19 3L8 14" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity=".5"/><path d="M14 13l-3 3M10 13l3 3" stroke="#8b5a3c" stroke-width="2.6" stroke-linecap="round"/><path d="M15 16l3 3M9 16l-3 3" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  ship: '<svg width="20" height="20" viewBox="0 0 24 24"><path d="M3 15h18l-3 5H6z" fill="#8b5a3c" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 3v12" stroke="currentColor" stroke-width="1.8"/><path d="M12 4l7 9h-7z" fill="#f2ece2" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 6L6 13h6z" fill="#c0504d" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  menu: '<svg width="18" height="18" viewBox="0 0 18 18"><path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  select: '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M6 3l12 8-5.5 1.2L15 19l-2.6 1.3-2.6-6.8L6 17z" fill="currentColor"/></svg>',
  land: '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M2 19l6-9 3.5 5 3-4 7.5 8z" fill="#8ac06a" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 10l1.6 2.3-1.6 1-1.5-1z" fill="#fff"/></svg>',
  nature: '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M12 2l6 9h-3.5l4.5 6H5l4.5-6H6z" fill="#5d9b4f" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><rect x="10.8" y="17" width="2.4" height="4.5" fill="#8b5a3c"/></svg>',
  road: '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M8 2L3 22M16 2l5 20" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M12 3v3M12 10v4M12 18v3" stroke="#e9b949" stroke-width="2.2" stroke-linecap="round"/></svg>',
  homes: '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M3 11l9-7 9 7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linejoin="round" stroke-linecap="round"/><path d="M6 10v10h12V10" fill="#f3e3c3" stroke="currentColor" stroke-width="2"/><rect x="10" y="14" width="4" height="6" fill="#c8553d"/></svg>',
  work: '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M14 4l6 6-3 1-4-4z" fill="#a8a29a" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M15 8L4 19" stroke="#8b5a3c" stroke-width="3" stroke-linecap="round"/></svg>',
  services: '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M3 9l9-5 9 5z" fill="#f5f1e8" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M6 10v8M10 10v8M14 10v8M18 10v8" stroke="currentColor" stroke-width="2"/><path d="M3 20h18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="6.8" r="1" fill="#c8553d"/></svg>',
  town: '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M6 21V8l6-5 6 5v13z" fill="#f5f1e8" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 3v-1" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="2" fill="#3e5c76"/><rect x="10" y="15" width="4" height="6" fill="#8b5a3c"/></svg>',
  demolish: '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 20l9-9" stroke="#8b5a3c" stroke-width="3" stroke-linecap="round"/><path d="M11 5l4-2 6 6-2 4z" fill="#a8a29a" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M15 18l2 2M19 15l2 1M13 21l1 1" stroke="var(--coral)" stroke-width="2" stroke-linecap="round"/></svg>',
  raise: '<svg width="56" height="48" viewBox="0 0 56 48"><path d="M4 40l18-22 10 12 6-6 14 16z" fill="#8ac06a" stroke="#3b2f2a" stroke-width="2.4" stroke-linejoin="round"/><path d="M28 4v14M22 10l6-6 6 6" stroke="#2a9d8f" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lower: '<svg width="56" height="48" viewBox="0 0 56 48"><path d="M4 30h14l10 10 10-10h14v12H4z" fill="#8ac06a" stroke="#3b2f2a" stroke-width="2.4" stroke-linejoin="round"/><path d="M28 4v14M22 12l6 6 6-6" stroke="#e76f51" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  flatten: '<svg width="56" height="48" viewBox="0 0 56 48"><path d="M4 30h48v12H4z" fill="#8ac06a" stroke="#3b2f2a" stroke-width="2.4" stroke-linejoin="round"/><path d="M14 22h28" stroke="#3b2f2a" stroke-width="3" stroke-linecap="round"/><path d="M14 12h28" stroke="#2a9d8f" stroke-width="3" stroke-dasharray="4 4" stroke-linecap="round"/></svg>',
  smooth: '<svg width="56" height="48" viewBox="0 0 56 48"><path d="M4 40C14 40 16 22 28 22s14 18 24 18v4H4z" fill="#8ac06a" stroke="#3b2f2a" stroke-width="2.4" stroke-linejoin="round"/><path d="M12 12c6-6 10 6 16 0s10 6 16 0" stroke="#2a9d8f" stroke-width="3" fill="none" stroke-linecap="round"/></svg>',
  plant: '<svg width="56" height="48" viewBox="0 0 56 48"><path d="M20 6l9 13h-5l7 9H9l7-9h-5z" fill="#5d9b4f" stroke="#3b2f2a" stroke-width="2.2" stroke-linejoin="round"/><path d="M38 14l7 10h-4l5 7H30l5-7h-4z" fill="#6aa84f" stroke="#3b2f2a" stroke-width="2.2" stroke-linejoin="round"/><path d="M4 42h48" stroke="#3b2f2a" stroke-width="2.4" stroke-linecap="round"/><path d="M20 28v14M38 31v11" stroke="#8b5a3c" stroke-width="3"/></svg>',
  clear: '<svg width="56" height="48" viewBox="0 0 56 48"><path d="M8 42h40" stroke="#3b2f2a" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="26" cy="38" rx="7" ry="3" fill="#e3bc8d" stroke="#8b5a3c" stroke-width="2"/><path d="M36 8l10 10-4 2-8-8z" fill="#a8a29a" stroke="#3b2f2a" stroke-width="2" stroke-linejoin="round"/><path d="M38 14L24 30" stroke="#8b5a3c" stroke-width="3.4" stroke-linecap="round"/></svg>',
};
const RES_ICON = { gold: I.gold, wood: I.wood, stone: I.stone, food: I.food };
const costChips = (cost, have) => Object.keys(cost).map(k => `<span class="cost ${have && S[k] < cost[k] ? 'no' : ''}">${RES_ICON[k].replace(/width="22" height="22"/, 'width="14" height="14"')}${cost[k]}</span>`).join('');

/* ---------- Tools ---------- */
const LAND = [
  { id: 'raise', name: 'Raise', note: 'Build hills' }, { id: 'lower', name: 'Lower', note: 'Dig coves' },
  { id: 'flatten', name: 'Flatten', note: 'Level ground' }, { id: 'smooth', name: 'Smooth', note: 'Soften edges' },
];
const NATURE = [{ id: 'plant', name: 'Plant trees', note: '1 gold each' }, { id: 'clear', name: 'Clear trees', note: '+wood from grown trees' }];
const ROADT = [
  { road: 2, name: 'Footpath', note: '1 gold · walkers only', sw: 'linear-gradient(90deg,#8cbb60 0 30%,#d2bd95 30% 70%,#8cbb60 70%)' },
  { road: 1, name: 'Road', note: '2 gold · carts too', sw: '#dcc69c' },
  { road: 3, name: 'Cobblestone', note: '3 gold 1 stone · faster, homes like it', sw: 'repeating-linear-gradient(90deg,#a7a196 0 7px,#6f6a62 7px 9px)' },
  { road: 4, name: 'Quay', note: '2 gold 4 stone · along the shore', sw: 'repeating-linear-gradient(0deg,#d4cbbb 0 9px,#a39d93 9px 11px)' },
];
const CATS = [
  { id: 'select', label: 'Select', tool: 'select' },
  { id: 'land', label: 'Land', items: LAND.concat(NATURE), size: true },
  { id: 'road', label: 'Roads', items: ROADT },
  { id: 'homes', label: 'Homes', items: ['house', 'fishhut', 'rowhouse', 'villa', 'apartment'] },
  { id: 'food', label: 'Food', items: ['farm', 'orchard', 'dock', 'bakery'] },
  { id: 'work', label: 'Work', items: ['lumber', 'sawmill', 'quarry', 'mine', 'blacksmith', 'stable', 'shipyard'] },
  { id: 'town', label: 'Town', items: ['market', 'well', 'garden', 'plaza', 'tavern', 'port', 'lighthouse'] },
  { id: 'services', label: 'Civic', items: ['chapel', 'clinic', 'school', 'library', 'academy'] },
  { id: 'army', label: 'Army', items: ['barracks', 'archery', 'cavyard', 'foundry', 'warschool', 'watchtower', 'guardhouse', { wall: 1, name: 'Palisade', note: '3 wood a tile', sw: 'repeating-linear-gradient(90deg,#7b5235 0 5px,#5e3b28 5px 7px)' }, { wall: 2, name: 'Stone wall', note: '4 stone, 2 gold a tile', sw: 'repeating-linear-gradient(0deg,#c9c0b0 0 6px,#a39d93 6px 8px)' }] },
  { id: 'demolish', label: 'Remove', tool: 'demolish' },
];
const BRUSH_TOOLS = ['raise', 'lower', 'flatten', 'smooth', 'plant', 'clear'];
const HOUSE_NAMES = ['Cottage', 'Townhouse', 'Manor'];

/* ---------- State ---------- */
let S = null, R = null, world = null;
const cam = { tx: 0, tz: 0, ty: 1, yaw: 0.7, pitch: 0.82, dist: 40, gyaw: 0.7, gpitch: 0.82, gdist: 40, vp: M4.ident(), eye: [0, 30, 30], fly: null };
const UI = { tool: 'select', cat: null, brush: 3, rot: 0, sel: null, speed: 1, hover: null, fx: 0.7, world: 0.7, music: 0.5, confirm: null, flattenH: 0,
  introOpen: false, goalsMin: false, painting: false, paintAcc: 0, road: null, lastRes: {} };
let lastTs = 0, uiTick = 0, saveTick = 0, thumbs = {}, cssW = 1, cssH = 1;

/* ---------- Sound ---------- */
/* ---------- Background music ----------
   "Cozy Music Sampler" by Spaceyyy (aquumgifts.itch.io), CC BY 4.0. Each file is an exact number of bars, so it loops on the beat.
   Daytime rotates three tracks, nights and rainy days have their own, and everything fades under raids and town meetings. */
const Music = {
  TRACKS: { spring: 55.384615, tavern: 51.428571, brew: 55.384615, night: 53.333333, rain: 55.384615 },
  DAY: ['spring', 'tavern', 'brew'],
  bus: null, cur: null, buffers: {}, fmt: 0, want: null, mood: null, moodAt: -1e9, day: 0, level: -1, hidden: false,
  ok() { return !!(window.DW_MUSIC && Sfx.ctx); },
  async load(name) {
    if (this.buffers[name]) return this.buffers[name];
    // each track can come in more than one format (AAC first, Opus as a fallback); remember which one this browser decodes
    const list = [].concat(window.DW_MUSIC[name] || []);
    for (let i = this.fmt || 0; i < list.length; i++) {
      try {
        const src = list[i]; let bytes;
        if (src.startsWith('data:')) { const b = atob(src.slice(src.indexOf(',') + 1)); bytes = new Uint8Array(b.length); for (let k = 0; k < b.length; k++) bytes[k] = b.charCodeAt(k); bytes = bytes.buffer; }
        else { const r = await fetch(src); if (!r.ok) throw new Error('missing'); bytes = await r.arrayBuffer(); }
        const buf = await new Promise((res, rej) => { const p = Sfx.ctx.decodeAudioData(bytes, res, rej); if (p && p.catch) p.catch(rej); });
        this.fmt = i; this.buffers[name] = buf; return buf;
      } catch (e) {}
    }
    throw new Error('can’t play this track here');
  },
  pick(mood) { return mood === 'night' ? 'night' : mood === 'rain' ? 'rain' : this.DAY[this.day % this.DAY.length]; },
  async go(name, fade) {
    if (this.want === name) return;
    this.want = name;
    let buf; try { buf = await this.load(name); } catch (e) { if (this.want === name) this.want = null; return; }
    if (this.want !== name || !UI.music) return;
    const c = Sfx.ctx, now = c.currentTime, len = this.TRACKS[name];
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true; src.loopStart = 0; src.loopEnd = Math.min(buf.duration, len);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(1, now + fade);
    src.connect(g); g.connect(this.bus); src.start(now);
    const old = this.cur;
    if (old) { old.g.gain.cancelScheduledValues(now); old.g.gain.setValueAtTime(old.g.gain.value, now); old.g.gain.linearRampToValueAtTime(0, now + fade); try { old.src.stop(now + fade + 0.2); } catch (e) {} }
    this.cur = { name, src, g, start: now, len };
    // keep only the playing track decoded, phones don't have memory to spare
    for (const k in this.buffers) if (k !== name) delete this.buffers[k];
  },
  stop() { if (!this.cur) return; const c = Sfx.ctx, now = c.currentTime; this.cur.g.gain.setTargetAtTime(0, now, 0.4); try { this.cur.src.stop(now + 2); } catch (e) {} this.cur = null; this.want = null; this.mood = null; this.buffers = {}; },
  update() {
    if (!this.ok()) return;
    const c = Sfx.ctx;
    if (!this.bus) { this.bus = c.createGain(); this.bus.gain.value = 0; this.bus.connect(c.destination); }
    const duck = Online.raid ? 0.3 : Online.mode ? 0.7 : UI.meetingOpen ? 0.55 : 1;
    const level = this.hidden ? 0 : UI.music * UI.music * 1.4 * duck;
    if (Math.abs(level - this.level) > 0.001) { this.bus.gain.setTargetAtTime(level, c.currentTime, 0.5); this.level = level; }
    if (!UI.music) { this.stop(); return; }
    if (c.state !== 'running') return;
    const h = S.t % 24, mood = Online.mode ? 'day' : h < 6 || h >= 19.5 ? 'night' : S.weather === 'rain' ? 'rain' : 'day', now = c.currentTime;
    if (!this.cur && !this.want) { this.mood = mood; this.moodAt = now; this.go(this.pick(mood), 3); return; }
    if (!this.cur) return;
    // change mood at most every 30 s, so a quick game night doesn't flip the music back and forth
    if (mood !== this.mood && now - this.moodAt > 30) { this.mood = mood; this.moodAt = now; if (mood === 'day') this.day++; this.go(this.pick(mood), 5); return; }
    // daytime: after two times through, drift into the next track right on the loop
    if (this.mood === 'day' && this.cur.name === this.pick('day') && now - this.cur.start >= this.cur.len * 2 - 4) { this.day++; this.go(this.pick('day'), 4); }
  },
};
document.addEventListener('visibilitychange', () => { Music.hidden = Sfx.hidden = document.hidden; Sfx.levels(); Music.update(); });

/* ---------- Sound: three channels, each with its own volume ----------
   effects (Sfx.master): clicks, building, battles · world (Sfx.world): waves, wind, rain, birds, the colony · music (Music.bus) */
/* ---------- World ambience: everything here is synthesized, no sound files ----------
   Steady layers (surf, wind, rain, the colony's hum) fade with the camera, weather and time of day;
   one-off sounds (gulls, songbirds, crickets, hammering) are scheduled at random. */
const Amb = {
  L: null, next: {}, t: 0, swell: 0, swellV: 0, hum: 0,
  noiseBuf(secs, brown) {
    const c = Sfx.ctx, n = Math.floor(c.sampleRate * secs), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    let b = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (brown) { b = b * 0.985 + w * 0.015; d[i] = b * 6; } else d[i] = w * 0.5; }
    return buf;
  },
  layer(buf, type, freq, q) {
    const c = Sfx.ctx, src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7;
    const g = c.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(Sfx.world); src.start(c.currentTime + Math.random() * 0.5);
    return { f, g };
  },
  init() {
    const brown = this.noiseBuf(6, true), white = this.noiseBuf(4, false);
    this.L = {
      surf: this.layer(brown, 'lowpass', 520), wash: this.layer(white, 'bandpass', 1100, 0.5),
      wind: this.layer(white, 'bandpass', 520, 0.9), rain: this.layer(white, 'highpass', 2600, 0.5),
      hum: this.layer(white, 'bandpass', 620, 1.4),
    };
    this.next = { gull: 4, bird: 2, cricket: 1, hammer: 1.5, cart: 12, foghorn: 15 };
  },
  set(l, v, k) { l.g.gain.setTargetAtTime(Math.max(0, v), Sfx.ctx.currentTime, k || 0.6); },
  update(dt) {
    if (!this.L || !Sfx.ctx || UI.world <= 0 || Sfx.hidden) return;
    this.t += dt;
    const WV = world.wxv || { rain: 0, wind: 0.3, storm: 0, fog: 0, cloud: 0 };
    const h = S.t % 24, night = h < 5.8 || h >= 19.8, dawn = h >= 5.5 && h < 10, rain = WV.rain > 0.2, cloud = WV.cloud > 0.6;
    const far = clamp((cam.dist - 14) / 70, 0, 1), near = 1 - far, pop = Sim.pop(S), town = clamp(pop / 50, 0, 1);
    // surf: a slow swell with the odd bigger wave, louder when you pull back to see the sea
    this.swellV += (Math.random() - 0.5) * dt * 0.9 - this.swell * dt * 0.35; this.swellV *= 1 - dt * 0.4; this.swell = clamp(this.swell + this.swellV * dt, -1, 1);
    const wave = 0.5 + 0.5 * Math.sin(this.t * 0.62 + Math.sin(this.t * 0.17) * 2) * 0.6 + this.swell * 0.25;
    this.set(this.L.surf, (0.09 + 0.07 * far) * (0.55 + 0.6 * wave), 0.25);
    this.set(this.L.wash, (0.012 + 0.012 * far) * Math.max(0, wave - 0.45) * 2.2, 0.15);
    // wind: picks up when zoomed out, in cloud and rain, and a little at night
    const gust = 0.6 + 0.4 * Math.sin(this.t * 0.21) * Math.sin(this.t * 0.083 + 1);
    this.set(this.L.wind, (0.008 + 0.045 * far + WV.wind * 0.07 + WV.storm * 0.04 + (night ? 0.01 : 0)) * gust, 0.8);
    this.L.wind.f.frequency.setTargetAtTime(360 + 380 * gust + WV.wind * 250, Sfx.ctx.currentTime, 1.2);
    this.set(this.L.rain, Math.min(1.4, WV.rain) * (0.045 + 0.02 * near), 1.5);
    // the colony's hum: footsteps, voices and work, from the settlers when you're close in
    this.hum += ((Math.random() - 0.5) * 3 - this.hum) * Math.min(1, dt * 2);
    const busy = night ? 0.25 : 1;
    this.set(this.L.hum, town * near * busy * (0.02 + 0.008 * this.hum), 0.3);
    // one-off sounds
    const due = k => (this.next[k] -= dt) <= 0, W = Sfx.world;
    if (due('gull')) { this.next.gull = 6 + Math.random() * 14; if (!night && !rain && Math.random() < 0.4 + 0.5 * far) this.gull(0.022 + 0.02 * far); }
    if (due('bird')) { this.next.bird = (dawn ? 2 : 5) + Math.random() * 7; if (!night && !rain && S.tree && Math.random() < 0.8) this.songbird(0.012 + 0.02 * near * (dawn ? 1.4 : 1)); }
    if (due('cricket')) { this.next.cricket = 0.35 + Math.random() * 0.9; if (night && !rain) for (let i = 0; i < 3; i++) Sfx.tone(4600 + Math.random() * 120, 4500, 0.035, 'sine', 0.018 + 0.012 * near, i * 0.06, W); }
    if (due('hammer')) {
      this.next.hammer = 1.2 + Math.random() * 2.2;
      if (!night && near > 0.15 && S.b.some(b => b.build < 1)) { const n = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) { Sfx.noise(0.03, 2400, 0.05 * near, i * 0.2, W); Sfx.tone(620, 380, 0.05, 'triangle', 0.03 * near, i * 0.2, W); } }
    }
    if (due('foghorn')) { this.next.foghorn = 22 + Math.random() * 25; if (WV.fog > 0.6) { Sfx.tone(196, 194, 2.6, 'sine', 0.035, 0, W); Sfx.tone(392, 390, 2.2, 'sine', 0.01, 0.02, W); } }
    if (due('cart')) { this.next.cart = 10 + Math.random() * 18; if (!night && town > 0.2 && near > 0.3) for (let i = 0; i < 6; i++) Sfx.noise(0.05, 500 + Math.random() * 200, 0.03 * near * town, i * 0.13, W); }
  },
  gull(v) {
    const W = Sfx.world, p = 0.9 + Math.random() * 0.25, n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) { const d = i * (0.32 + Math.random() * 0.1); Sfx.tone(1500 * p, 950 * p, 0.28, 'triangle', v, d, W); Sfx.tone(3000 * p, 1900 * p, 0.22, 'sine', v * 0.25, d + 0.01, W); }
  },
  // a crack for close strikes, then a long low roll
  thunder(delay, strength) {
    if (!Sfx.ctx || UI.world <= 0) return;
    const W = Sfx.world, s = strength || 0.7;
    if (s > 0.8) Sfx.noise(0.25, 1400, 0.12 * s, delay, W);
    Sfx.noise(2.8, 80, 0.55 * s, delay + 0.05, W); Sfx.noise(2.2, 160, 0.25 * s, delay + 0.25, W); Sfx.tone(55, 32, 2.4, 'sine', 0.2 * s, delay + 0.1, W);
  },
  songbird(v) {
    const W = Sfx.world, base = 2600 + Math.random() * 1400, n = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) { const f = base * (0.85 + Math.random() * 0.35); Sfx.tone(f, f * (Math.random() < 0.5 ? 1.25 : 0.8), 0.07 + Math.random() * 0.05, 'sine', v, i * 0.11, W); }
  },
};

const Sfx = {
  ctx: null, master: null, world: null, hidden: false,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0; this.master.connect(c.destination);
    this.world = c.createGain(); this.world.gain.value = 0; this.world.connect(c.destination);
    this.levels(); Amb.init();
  },
  // volume curve: sliders feel even when the gain follows the square of the slider
  levels() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, h = this.hidden;
    this.master.gain.setTargetAtTime(h ? 0 : UI.fx * UI.fx * 1.1, t, 0.08);
    this.world.gain.setTargetAtTime(h ? 0 : UI.world * UI.world * 1.4, t, 0.3);
  },
  on(dest) { return dest === this.world ? UI.world > 0 : UI.fx > 0; },
  tone(f0, f1, dur, type, vol, delay, dest) {
    const c = this.ctx; dest = dest || this._d || this.master; if (!c || !this.on(dest)) return;
    const t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, freq, vol, delay, dest) {
    const c = this.ctx; dest = dest || this._d || this.master; if (!c || !this.on(dest)) return;
    const t = c.currentTime + (delay || 0), n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
    const g = c.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(dest); s.start(t);
  },
  play(k, dest) {
    if (!this.ctx) return;
    this._d = dest || null; try { this.fx(k); } finally { this._d = null; }
  },
  fx(k) {
    if (k === 'build') { this.tone(140, 55, 0.25, 'sine', 0.35); this.tone(520, 880, 0.12, 'triangle', 0.12, 0.05); }
    else if (k === 'demolish') { this.noise(0.45, 700, 0.5); this.tone(110, 40, 0.35, 'sine', 0.3); }
    else if (k === 'chop') { this.noise(0.06, 2200, 0.12); this.tone(300, 180, 0.08, 'triangle', 0.05); }
    else if (k === 'level') { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, f * 1.01, 0.25, 'triangle', 0.12, i * 0.07)); }
    else if (k === 'goal') { [392, 523, 659, 784].forEach((f, i) => this.tone(f, f, 0.32, 'triangle', 0.14, i * 0.11)); this.tone(1046, 1046, 0.6, 'sine', 0.1, 0.44); }
    else if (k === 'built') { [659, 784, 988].forEach((f, i) => this.tone(f, f, 0.18, 'triangle', 0.1, i * 0.06)); this.tone(120, 60, 0.2, 'sine', 0.25); }
    else if (k === 'meeting') { for (let i = 0; i < 3; i++) { this.tone(660, 655, 1.1, 'sine', 0.14, i * 0.5); this.tone(990, 985, 0.8, 'sine', 0.05, i * 0.5 + 0.02); } }
    else if (k === 'bell') { this.tone(880, 870, 1.2, 'sine', 0.12); this.tone(1320, 1310, 0.9, 'sine', 0.05, 0.02); }
    else if (k === 'click') this.tone(900, 1200, 0.05, 'triangle', 0.05);
    else if (k === 'horn') { this.tone(110, 108, 1.4, 'sawtooth', 0.08); this.tone(165, 160, 1.4, 'triangle', 0.1, 0.05); }
    else if (k === 'clash') { this.noise(0.07, 3200 + Math.random() * 1500, 0.16); this.tone(1400 + Math.random() * 600, 900, 0.08, 'square', 0.025); }
    else if (k === 'arrow') this.noise(0.18, 1800, 0.06);
    else if (k === 'down') this.tone(260, 90, 0.35, 'triangle', 0.12);
    else if (k === 'coins') { [1320, 1760, 1568].forEach((f, i) => this.tone(f, f, 0.09, 'triangle', 0.07, i * 0.05)); }
    else if (k === 'alarm') { for (let i = 0; i < 4; i++) this.tone(880, 860, 0.35, 'sine', 0.12, i * 0.3); }
    else if (k === 'warn') { for (let i = 0; i < 3; i++) this.tone(660, 660, 0.12, 'square', 0.05, i * 0.18); }
    else if (k === 'emptied') this.tone(500, 300, 0.2, 'triangle', 0.08);
    else if (k === 'cannon') { this.noise(0.5, 180, 0.5); this.tone(90, 40, 0.4, 'sine', 0.35); }
    else if (k === 'boom') { this.noise(0.6, 120, 0.45); this.tone(70, 30, 0.5, 'sine', 0.3); }
    else if (k === 'collapse') { this.noise(1.1, 260, 0.45); this.tone(60, 30, 0.9, 'sine', 0.25); }
    else if (k === 'victory') { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, f, 0.3, 'triangle', 0.12, i * 0.09)); }
    else if (k === 'defeat') { [392, 330, 262].forEach((f, i) => this.tone(f, f * 0.98, 0.4, 'triangle', 0.1, i * 0.18)); }
    else if (k === 'err') this.tone(180, 140, 0.18, 'square', 0.05);
    else if (k === 'road') this.noise(0.08, 900, 0.18);
    else if (k === 'brush') this.noise(0.05, 300 + Math.random() * 200, 0.05);
    else if (k === 'plant') this.tone(700 + Math.random() * 200, 1100, 0.07, 'sine', 0.06);
  },
};

/* ---------- Toasts & hint ---------- */
function toast(text, kind) {
  const el = document.createElement('div'); el.className = 'toast ' + (kind || ''); el.textContent = text;
  const box = $('#toasts'); box.appendChild(el); while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { el.style.transition = 'opacity .3s, transform .3s'; el.style.opacity = '0'; el.style.transform = 'translateY(-8px)'; setTimeout(() => el.remove(), 320); }, kind === 'goal' ? 4800 : 3200);
}
function hint(html) { const h = $('#hint'); if (!html) { h.hidden = true; return; } h.hidden = false; if (h._h !== html) { h.innerHTML = html; h._h = html; } h.classList.toggle('up', !$('#tray').hidden); }

/* ---------- Camera ---------- */
function updateCamera(dt) {
  const k = 1 - Math.pow(0.0005, dt);
  if (cam.fly) { cam.tx += (cam.fly[0] - cam.tx) * k * 0.6; cam.tz += (cam.fly[1] - cam.tz) * k * 0.6; if (Math.hypot(cam.fly[0] - cam.tx, cam.fly[1] - cam.tz) < 0.05) cam.fly = null; }
  cam.yaw += (cam.gyaw - cam.yaw) * k; cam.pitch += (cam.gpitch - cam.pitch) * k; cam.dist += (cam.gdist - cam.dist) * k;
  cam.tx = clamp(cam.tx, -N / 2, N / 2); cam.tz = clamp(cam.tz, -N / 2, N / 2);
  const gy = Math.max(0, Sim.heightAt(S, cam.tx, cam.tz));
  cam.ty += (gy - cam.ty) * Math.min(1, dt * 3);
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  cam.eye = [cam.tx + cam.dist * cp * Math.sin(cam.yaw), cam.ty + cam.dist * sp, cam.tz + cam.dist * cp * Math.cos(cam.yaw)];
  const groundAtEye = Sim.heightAt(S, cam.eye[0], cam.eye[2]);
  if (cam.eye[1] < Math.max(0, groundAtEye) + 1.5) cam.eye[1] = Math.max(0, groundAtEye) + 1.5;
  const view = M4.lookAt(cam.eye, [cam.tx, cam.ty, cam.tz], [0, 1, 0]);
  const proj = M4.persp(0.62, R.canvas.width / R.canvas.height, 0.4, 900);
  cam.vp = M4.mul(proj, view);
  cam.inv = M4.invert(cam.vp);
}
function pick(sx, sy) {
  const x = sx / cssW * 2 - 1, y = 1 - sy / cssH * 2, m = cam.inv;
  const un = (z) => { const v = [x, y, z, 1], o = [0, 0, 0, 0]; for (let r = 0; r < 4; r++) o[r] = m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * v[3]; return [o[0] / o[3], o[1] / o[3], o[2] / o[3]]; };
  const a = un(-1), b = un(1);
  let dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2]; const L = Math.hypot(dx, dy, dz); dx /= L; dy /= L; dz /= L;
  const g = (px, pz) => Math.abs(px) > N / 2 || Math.abs(pz) > N / 2 ? 0 : Math.max(0, Sim.groundAt(S, px, pz));
  let t = 0, prev = 0;
  for (let i = 0; i < 2000; i++) {
    const px = a[0] + dx * t, py = a[1] + dy * t, pz = a[2] + dz * t;
    if (py <= g(px, pz)) {
      let lo = prev, hi = t;
      for (let k = 0; k < 10; k++) { const mid = (lo + hi) / 2; const qx = a[0] + dx * mid, qy = a[1] + dy * mid, qz = a[2] + dz * mid; if (qy <= g(qx, qz)) hi = mid; else lo = mid; }
      const px2 = a[0] + dx * hi, pz2 = a[2] + dz * hi;
      return { x: px2, y: a[1] + dy * hi, z: pz2, i: Math.floor(px2 + N / 2), j: Math.floor(pz2 + N / 2) };
    }
    prev = t; t += 0.3 + t * 0.004;
    if (t > 900) break;
  }
  return null;
}
function project(x, y, z) {
  const m = cam.vp, cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (cw <= 0.01) return null;
  return [(cx / cw * 0.5 + 0.5) * cssW, (1 - (cy / cw * 0.5 + 0.5)) * cssH];
}
function panBy(dxPix, dyPix) {
  const k = cam.dist * 0.0021, c = Math.cos(cam.yaw), s = Math.sin(cam.yaw);
  cam.tx += (-dxPix * c - dyPix * s / Math.max(0.5, Math.sin(cam.pitch)) * 0.9) * k;
  cam.tz += (dxPix * s - dyPix * c / Math.max(0.5, Math.sin(cam.pitch)) * 0.9) * k;
  cam.fly = null;
}

/* ---------- Building helpers ---------- */
function buildingAt(i, j) { if (!Sim.inB(i, j)) return null; const id = S.occ[Sim.ci(i, j)]; return id ? S.b.find(b => b.id === id) : null; }
function bName(b) { return b.type === 'house' ? HOUSE_NAMES[b.level] : b.type === 'pier' && b.level >= 1 ? 'Harbour' : TYPES[b.type].name; }
function placeSpot(type, p) {
  const s = TYPES[type].size;
  return { i: Math.round(p.x + N / 2 - s / 2), j: Math.round(p.z + N / 2 - s / 2) };
}
const fmtRate = v => (v >= 0 ? '+' : '−') + (Math.abs(v) < 10 ? Math.abs(v).toFixed(1) : Math.round(Math.abs(v)));
function perHour(b) { const p = Sim.prodOf(S, b); return p ? [p.rate, p.res] : null; }

/* ---------- Overlay geometry ---------- */
const OV = { data: [], push(p, col) { this.data.push(p[0], p[1], p[2], 0, 1, 0, col[0], col[1], col[2]); } };
function ovTri(a, b, c, col) { OV.push(a, col); OV.push(b, col); OV.push(c, col); }
function ovY(x, z, lift) { return Math.max(0.04, Sim.groundAt(S, x, z)) + (lift || 0.1); }
function ovRing(cx, cz, r, w, col, seg) {
  seg = seg || Math.max(24, Math.round(r * 10));
  for (let k = 0; k < seg; k++) {
    const a = k / seg * 6.283, b = (k + 1) / seg * 6.283;
    const p = (ang, rr) => { const x = cx + Math.cos(ang) * rr, z = cz + Math.sin(ang) * rr; return [x, ovY(x, z, 0.12), z]; };
    const a0 = p(a, r - w / 2), a1 = p(a, r + w / 2), b0 = p(b, r - w / 2), b1 = p(b, r + w / 2);
    ovTri(a0, a1, b1, col); ovTri(a0, b1, b0, col);
  }
}
function ovCell(i, j, col, inset) {
  const e = inset || 0.04, x0 = i - N / 2 + e, z0 = j - N / 2 + e, x1 = i - N / 2 + 1 - e, z1 = j - N / 2 + 1 - e;
  const P = (x, z) => [x, ovY(x, z, 0.09), z];
  const c = [(x0 + x1) / 2, (z0 + z1) / 2];
  const pts = [P(x0, z0), P(x1, z0), P(x1, z1), P(x0, z1)], m = P(c[0], c[1]);
  for (let k = 0; k < 4; k++) ovTri(m, pts[k], pts[(k + 1) % 4], col);
}
function ovRect(i, j, s, col, w) {
  const x0 = i - N / 2 - 0.08, z0 = j - N / 2 - 0.08, x1 = i + s - N / 2 + 0.08, z1 = j + s - N / 2 + 0.08;
  const seg = (ax, az, bx, bz) => {
    const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) * 3));
    const nx = -(bz - az), nz = bx - ax, l = Math.hypot(nx, nz); const ox = nx / l * w / 2, oz = nz / l * w / 2;
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n, x = ax + (bx - ax) * t0, z = az + (bz - az) * t0, X = ax + (bx - ax) * t1, Z = az + (bz - az) * t1;
      const A = [x - ox, ovY(x, z, 0.14), z - oz], B = [x + ox, ovY(x, z, 0.14), z + oz], C = [X + ox, ovY(X, Z, 0.14), Z + oz], D = [X - ox, ovY(X, Z, 0.14), Z - oz];
      ovTri(A, B, C, col); ovTri(A, C, D, col);
    }
  };
  seg(x0, z0, x1, z0); seg(x1, z0, x1, z1); seg(x1, z1, x0, z1); seg(x0, z1, x0, z0);
}
let ovMesh = null;
function drawOverlay(R, P, gl, W) {
  OV.data.length = 0;
  const hv = UI.hover, t = W.now;
  let ghost = null;
  if (hv && BRUSH_TOOLS.includes(UI.tool)) {
    const col = { raise: [0.75, 1, 0.8], lower: [1, 0.72, 0.62], flatten: [1, 1, 1], smooth: [0.75, 0.95, 1], plant: [0.7, 1, 0.6], clear: [1, 0.85, 0.6] }[UI.tool];
    ovRing(hv.x, hv.z, UI.brush, 0.13, col);
    ovRing(hv.x, hv.z, UI.brush * 0.5 * (1 + Math.sin(t * 4) * 0.08), 0.06, col);
  }
  if (UI.tool === 'road' && hv) {
    const cells = UI.road ? Sim.roadPath(UI.road.a, [hv.i, hv.j]) : [[hv.i, hv.j]];
    for (const [i, j] of cells) {
      if (!Sim.inB(i, j)) continue;
      const c = Sim.ci(i, j), rt = UI.roadType || 1, cur = S.road[c];
      const same = cur && (cur === rt || Sim.ROADS[cur].rank >= Sim.ROADS[rt].rank), bad = !same && Sim.roadOk(S, i, j, rt);
      ovCell(i, j, same ? [0.85, 0.85, 0.85] : bad ? [1, 0.4, 0.35] : cur ? [0.7, 0.9, 1] : [1, 0.96, 0.82]);
    }
  }
  if (UI.tool === 'wall' && hv) {
    const cells = UI.road ? Sim.roadPath(UI.road.a, [hv.i, hv.j]) : [[hv.i, hv.j]], wt = UI.wallType || 1;
    for (const [i, j] of cells) { if (!Sim.inB(i, j)) continue; const c = Sim.ci(i, j), cur = S.wall[c]; ovCell(i, j, cur >= wt ? [0.85, 0.85, 0.85] : Sim.wallOk(S, i, j) ? [1, 0.4, 0.35] : S.road[c] ? [0.7, 0.9, 1] : [0.95, 0.8, 0.6]); }
  }
  if (UI.tool === 'demolish' && hv) {
    const b = buildingAt(hv.i, hv.j);
    if (b) ovRect(b.i, b.j, TYPES[b.type].size, [1, 0.35, 0.3], 0.12);
    else if (Sim.inB(hv.i, hv.j) && (S.road[Sim.ci(hv.i, hv.j)] || S.wall[Sim.ci(hv.i, hv.j)])) ovCell(hv.i, hv.j, [1, 0.4, 0.35]);
  }
  if (UI.tool.startsWith('build:') && hv) {
    const type = UI.tool.slice(6), T = TYPES[type], sp = placeSpot(type, hv);
    const c = Sim.canPlace(S, type, sp.i, sp.j, UI.rot);
    const okc = c.ok ? [0.6, 1, 0.65] : [1, 0.45, 0.4];
    for (let dj = 0; dj < T.size; dj++) for (let di = 0; di < T.size; di++) if (Sim.inB(sp.i + di, sp.j + dj)) ovCell(sp.i + di, sp.j + dj, okc, 0.02);
    if (T.radius) { const [x, z] = Sim.center({ type, i: sp.i, j: sp.j }); ovRing(x, z, T.radius, 0.1, [1, 1, 1], 64); }
    const gRot = c.rot !== undefined ? c.rot : UI.rot;
    const y = Sim.inB(sp.i, sp.j) && Sim.inB(sp.i + T.size - 1, sp.j + T.size - 1) ? Sim.padHeight(S, type, sp.i, sp.j, gRot) : 0.3;
    ghost = { type, i: sp.i, j: sp.j, rot: c.rot !== undefined ? c.rot : UI.rot, y, ok: c.ok, level: 0, variant: (UI.ghostVar || 0) };
    UI.ghostCheck = c;
  } else UI.ghostCheck = null;
  if (UI.sel) {
    const b = S.b.find(x => x.id === UI.sel);
    if (b) {
      ovRect(b.i, b.j, TYPES[b.type].size, [1, 0.95, 0.6], 0.1);
      const T = TYPES[b.type];
      if (T.radius && b.type !== 'quarry') { const [x, z] = Sim.center(b); ovRing(x, z, T.radius, 0.08, [1, 1, 1], 72); }
    }
  }
  onlineOverlay();
  if (OV.data.length) {
    ovMesh = R.meshFromData(new Float32Array(OV.data), true, ovMesh);
    R.begin(ovMesh); R.push(ovMesh, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0.9); R.upload(ovMesh);
    gl.uniform1f(P.u.uAlpha, 0.62); R.draw(ovMesh);
  }
  if (ghost) {
    const m = W.getModel(ghost.type, 0, ghost.variant);
    const [x, z] = Sim.center(ghost), bob = 0.12 + Math.sin(t * 5) * 0.05, tint = ghost.ok ? [0.85, 1.1, 0.9] : [1.25, 0.6, 0.55];
    for (const mesh of [m.body, m.win]) {
      R.begin(mesh); R.push(mesh, x, ghost.y + bob, z, ghost.rot * Math.PI / 2, 1, 1, 1, tint[0], tint[1], tint[2], 0.25); R.upload(mesh);
      gl.uniform1f(P.u.uAlpha, 0.62); R.draw(mesh);
    }
  }
}

/* ---------- Thumbnails rendered from the real models ---------- */
function renderThumbs() {
  const gl = R.gl, SZ = 160;
  const fb = gl.createFramebuffer(), tex = gl.createTexture(), depth = gl.createRenderbuffer();
  gl.bindTexture(gl.TEXTURE_2D, tex); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, SZ, SZ);
  gl.bindRenderbuffer(gl.RENDERBUFFER, depth); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, SZ, SZ);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
  const px = new Uint8Array(SZ * SZ * 4), cv = document.createElement('canvas'); cv.width = cv.height = SZ;
  const c2 = cv.getContext('2d'), img = c2.createImageData(SZ, SZ);
  const env = World.envAt(11), P = R.main;
  gl.useProgram(P.p);
  gl.uniform3fv(P.u.uSunDir, [0.55, 0.75, 0.4].map(v => v / Math.hypot(0.55, 0.75, 0.4))); gl.uniform3fv(P.u.uSunCol, [0.95, 0.9, 0.82]);
  gl.uniform3fv(P.u.uSky, [0.62, 0.66, 0.7]); gl.uniform3fv(P.u.uGround, [0.35, 0.3, 0.25]);
  gl.uniform3fv(P.u.uFog, env.hor); gl.uniform2f(P.u.uFogR, 500, 600); gl.uniform1f(P.u.uShadowOn, 0); gl.uniform1f(P.u.uAlpha, 1);
  gl.uniform1f(P.u.uSway, 0); gl.uniform1f(P.u.uTime, 0); gl.uniform3f(P.u.uFlat, 0, 0, 0);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, R.shadowTex); gl.uniform1i(P.u.uShadow, 0);
  gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
  for (const type of Sim.BUILDABLE) {
    const T = TYPES[type], m = world.getModel(type, type === 'house' ? 1 : 0, 6);
    const s = T.size, hgt = { lighthouse: 3.1, chapel: 2.2, port: 1.4, hall: 2, tavern: 1.9, school: 1.8, stable: 1.3, orchard: 1.0, garden: 0.8, apartment: 2.0, academy: 2.2, library: 1.6, rowhouse: 1.5, villa: 1.3, plaza: 0.8, shipyard: 1.0, mine: 1.1, fishhut: 1.0, watchtower: 2.4, guardhouse: 1.2, barracks: 1.3, archery: 1.0, cavyard: 1.0, foundry: 1.8, warschool: 2.2 }[type] || (s === 1 ? 1.1 : 1.3);
    const tgt = [0, hgt * 0.42, type === 'port' || type === 'dock' || type === 'shipyard' ? 0.5 : 0], d = Math.max(s * 1.9, hgt * 1.65) + 1.2;
    const eye = [tgt[0] + Math.sin(0.65) * Math.cos(0.5) * d, tgt[1] + Math.sin(0.5) * d, tgt[2] + Math.cos(0.65) * Math.cos(0.5) * d];
    const vp = M4.mul(M4.persp(0.62, 1, 0.1, 100), M4.lookAt(eye, tgt, [0, 1, 0]));
    gl.uniformMatrix4fv(P.u.uVP, false, vp); gl.uniformMatrix4fv(P.u.uLightVP, false, vp); gl.uniform3fv(P.u.uEye, eye);
    gl.viewport(0, 0, SZ, SZ); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    for (const mesh of [m.body, m.win]) { R.begin(mesh); R.push(mesh, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0); R.upload(mesh); R.draw(mesh); }
    gl.readPixels(0, 0, SZ, SZ, gl.RGBA, gl.UNSIGNED_BYTE, px);
    for (let y = 0; y < SZ; y++) img.data.set(px.subarray((SZ - 1 - y) * SZ * 4, (SZ - y) * SZ * 4), y * SZ * 4);
    c2.putImageData(img, 0, 0);
    thumbs[type] = cv.toDataURL();
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(fb); gl.deleteTexture(tex); gl.deleteRenderbuffer(depth);
}

/* ---------- UI rendering ---------- */
function renderRes() {
  const p = Sim.pop(S), cap = Sim.capacity(S, true), Rt = S.rates || Sim.rates(S);
  const vals = { gold: Math.floor(S.gold), wood: Math.floor(S.wood), stone: Math.floor(S.stone), food: Math.floor(S.food), pop: p };
  const low = { food: S.starving || (Rt.food.net < 0 && S.food < p * Sim.EAT * 24), wood: S.wood < 10, stone: false, gold: S.gold < 20 };
  const names = { gold: 'Gold', wood: 'Wood', stone: 'Stone', food: 'Food' };
  let h = '';
  for (const k of ['gold', 'wood', 'stone', 'food']) {
    const net = Rt[k].net, cls = net > 0.05 ? 'up' : net < -0.05 ? 'down' : '';
    h += `<div class="r ${low[k] ? 'low' : ''}" data-r="${k}" title="${names[k]}: ${fmtRate(net)} per hour">${RES_ICON[k]}<div><b>${vals[k]}</b><small class="rate ${cls}">${Math.abs(net) < 0.05 ? '±0' : fmtRate(net)}/h</small></div></div>`;
  }
  h += `<div class="sep"></div><div class="r" data-r="pop" title="Settlers / beds">${I.pop}<div><b>${p}<span style="font-size:13px;color:var(--ink-soft)">/${cap}</span></b><small class="rate">settlers</small></div></div>`;
  h += `<div class="r" title="Happiness">${I.face(S.happy)}<div><b>${S.happy}</b><small class="rate">happy</small></div></div>`;
  const el = $('#res');
  if (el._h !== h) {
    el.innerHTML = h; el._h = h;
    for (const k in vals) {
      if (UI.lastRes[k] !== undefined && vals[k] > UI.lastRes[k]) { const r = el.querySelector(`[data-r="${k}"]`); if (r) { r.classList.add('bump'); } }
      UI.lastRes[k] = vals[k];
    }
  }
  renderStock();
}
// tap the resource bar for a breakdown of where things come from and what drives happiness
function renderStock() {
  const el = $('#stock');
  if (!UI.stockOpen) { el.hidden = true; el._h = ''; return; }
  const Rt = S.rates || Sim.rates(S), p = Sim.pop(S);
  const src = {};
  for (const b of S.b) { const pr = Sim.prodOf(S, b); if (pr) { src[pr.res] = src[pr.res] || {}; src[pr.res][b.type] = (src[pr.res][b.type] || 0) + 1; } }
  const list = k => Object.keys(src[k] || {}).map(t => `${src[k][t]} ${TYPES[t].name.toLowerCase()}${src[k][t] > 1 ? 's' : ''}`).join(', ') || 'nothing yet';
  const row = (k, name, extra) => `<tr><td>${RES_ICON[k].replace(/width="22" height="22"/, 'width="18" height="18"')} ${name}</td><td>${Math.floor(S[k])}</td><td class="${Rt[k].net >= 0 ? 'up' : 'down'}">${fmtRate(Rt[k].net)}/h</td></tr><tr class="sub"><td colspan="3">${extra}</td></tr>`;
  const daysLeft = Rt.food.net < 0 ? S.food / -Rt.food.net / 24 : null;
  let h = `<h3>Stores <button data-act="stockClose" aria-label="Close">×</button></h3><table>
    ${row('food', 'Food', `Made ${Rt.food.make.toFixed(1)}/h by ${list('food')}. ${p} settlers eat ${Rt.food.use.toFixed(1)}/h.${daysLeft !== null ? ` <b class="down">Runs out in ${daysLeft < 1 ? Math.max(1, Math.round(daysLeft * 24)) + ' hours' : daysLeft.toFixed(1) + ' days'}.</b>` : ''}`)}
    ${row('wood', 'Wood', `From ${list('wood')}. Spent when you build.`)}
    ${row('stone', 'Stone', `From ${list('stone')}. Spent when you build and when houses grow.`)}
    ${row('gold', 'Gold', `Taxes from ${p} settlers. Happier homes and markets pay more.`)}</table>`;
  const fac = [];
  const fm = S.foodMood || 0; fac.push([fm, fm >= 8 ? 'Plenty of food' : fm >= 0 ? 'Food is fine' : S.starving ? 'Starving' : 'Food running low']);
  if (S.weather === 'rain') fac.push([-2, 'Rainy day']); else if (S.weather === 'sun') fac.push([1, 'Sunny day']);
  const labels = { feast: 'Harvest feast', fund: 'Building fund', fishing: 'Fishing contest', cleanup: 'Clean-up day', harvest: 'Sunday shifts', promise: 'Promise kept', broken: 'Broken promise', close: 'Town meeting', whale: 'Whale sighting', minstrel: 'Minstrel in town', cold: 'Cold snap' };
  for (const f of S.fx || []) if (f.kind === 'happy' && f.until > S.t) fac.push([f.amt, `${labels[f.label] || 'Event'} (${Math.ceil(f.until - S.t)}h left)`]);
  const homes = S.b.filter(b => Sim.TYPES[b.type].home && b.res > 0), pct = k => homes.length ? Math.round(100 * homes.filter(b => b.cov && b.cov[k]).length / homes.length) : 0;
  h += `<h3 style="margin-top:12px">Happiness ${S.happy}</h3><div class="facs">${fac.map(([v, t]) => `<div><span class="${v >= 0 ? 'up' : 'down'}">${v >= 0 ? '+' : '−'}${Math.abs(v)}</span>${esc(t)}</div>`).join('')}</div>
    <p class="desc">Homes near a market: ${pct('market')}% · well: ${pct('well')}% · tavern: ${pct('tavern')}% · chapel: ${pct('chapel')}%</p>
    <p class="desc">One hour on the clock is 10 seconds at normal speed.</p>`;
  el.hidden = false;
  if (el._h !== h) { el.innerHTML = h; el._h = h; }
}
function renderClock() {
  const h = S.t % 24, day = Math.floor(S.t / 24) + 1, night = h < 6 || h >= 19.5, wd = Sim.WEEKDAYS[(day - 1) % 7];
  const wk = Sim.wxKind(S), wIcon = { clear: night ? I.moon : I.sun, fair: night ? I.moon : I.cloud, cloudy: I.overcast, drizzle: I.drizzle, rain: I.rain, storm: I.storm, fog: I.fog }[wk] || I.sun;
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 10) * 10;
  const html = `<div class="time" data-act="forecast" role="button" tabindex="0" title="${esc(Sim.WX[wk].name)} · tap for the forecast">${wIcon}<div><small>${wd.slice(0, 3)} · Day ${day}</small><b>${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}</b></div></div>
    <div class="speeds" role="group" aria-label="Speed">${[I.pause, I.play, I.fast, I.faster].map((ic, k) => `<button data-speed="${k}" class="${UI.speed === k ? 'on' : ''}" title="${['Pause (Space)', 'Normal (1)', 'Fast (2)', 'Fastest (3)'][k]}" aria-label="${['Pause', 'Normal speed', 'Fast', 'Fastest'][k]}">${ic}</button>`).join('')}</div>
    ${Online.mode ? '' : `<button class="round" data-act="army" title="Your army" aria-label="Your army">${I.army.replace(/26/g, '20')}</button>`}${Online.mode ? '' : `<button class="round sea" data-act="online" title="Other islands: visit and raid" aria-label="Other islands">${I.ship}</button>`}<button class="round" data-act="menu" title="Menu" aria-label="Menu">${I.menu}</button>`;
  const el = $('#clock'); if (el._h !== html) { el.innerHTML = html; el._h = html; }
}
function renderGoals() {
  const open = Sim.GOALS.filter(g => !S.goals[g.id]);
  let h = `<h3>Goals <button data-act="goalsMin">${UI.goalsMin ? 'Show' : 'Hide'}</button></h3>`;
  if (!open.length) h += `<div class="goal"><b>Every goal complete!</b><p>Your island is thriving. Keep building.</p></div>`;
  for (const g of open.slice(0, 2)) {
    const p = clamp(g.prog(S), 0, 1);
    h += `<div class="goal"><b>${esc(g.title)}</b><p>${esc(g.desc)}</p><div class="bar"><i style="width:${(p * 100).toFixed(0)}%"></i></div><div class="reward">Reward: ${Sim.costText(g.reward)}</div></div>`;
  }
  if (open.length > 2) h += `<div class="more">${open.length - 2} more after these</div>`;
  const el = $('#goals'); el.classList.toggle('min', UI.goalsMin);
  if (el._h !== h) { el.innerHTML = h; el._h = h; }
}
function renderDock() {
  const icon = { select: I.select, land: I.land, nature: I.nature, road: I.road, homes: I.homes, food: I.food.replace('width="22" height="22"', 'width="26" height="26"'), work: I.work, town: I.town, services: I.services, army: I.army, demolish: I.demolish };
  const active = c => (c.tool && UI.tool === c.tool) || UI.cat === c.id;
  $('#dock').innerHTML = CATS.map(c => `<button class="cat ${active(c) ? 'on' : ''}" data-cat="${c.id}" aria-label="${c.label}">${icon[c.id]}<span>${c.label}</span></button>`).join('');
}
function renderTray() {
  const tray = $('#tray'), cat = CATS.find(c => c.id === UI.cat);
  if (!cat || !cat.items) { tray.hidden = true; return; }
  tray.hidden = false;
  const p = Sim.pop(S);
  let h = '<div class="items">';
  for (const it of cat.items) {
    if (it.wall) {
      const on = UI.tool === 'wall' && UI.wallType === it.wall;
      h += `<button class="item ${on ? 'on' : ''}" data-wall="${it.wall}"><span class="ico"><i class="sw" style="background:${it.sw}"></i></span><b>${it.name}</b><span class="cost" style="color:var(--ink-soft)">${it.note}</span></button>`;
    } else if (it.road) {
      const on = UI.tool === 'road' && UI.roadType === it.road;
      h += `<button class="item ${on ? 'on' : ''}" data-road="${it.road}"><span class="ico"><i class="sw" style="background:${it.sw}"></i></span><b>${it.name}</b><span class="cost" style="color:var(--ink-soft)">${it.note}</span></button>`;
    } else if (typeof it === 'string') {
      const T = TYPES[it], locked = T.unlock && p < T.unlock && !S.goals['unlock_' + it];
      const on = UI.tool === 'build:' + it;
      h += `<button class="item ${on ? 'on' : ''} ${locked ? 'locked' : ''}" data-build="${it}" title="${esc(T.desc)}">${locked ? `<span class="lock">${T.unlock} settlers</span>` : ''}${thumbs[it] ? `<img src="${thumbs[it]}" alt="">` : '<span class="ico"></span>'}<b>${esc(T.name)}</b><span class="costs">${costChips(T.cost, true)}</span></button>`;
    } else {
      const on = UI.tool === it.id;
      h += `<button class="item ${on ? 'on' : ''}" data-tool="${it.id}"><span class="ico">${I[it.id]}</span><b>${it.name}</b><span class="cost" style="color:var(--ink-soft)">${it.note}</span></button>`;
    }
  }
  h += '</div>';
  if (UI.tool.startsWith('build:') && !TYPES[UI.tool.slice(6)].coastal && TYPES[UI.tool.slice(6)].size >= 1) h += `<div class="size"><button class="btn" data-act="rotate" style="padding:6px 12px">↻ Rotate</button><span>Coastal buildings face the water by themselves.</span></div>`;
  if (cat.size) h += `<label class="size">Brush size <input type="range" id="brush" min="1" max="8" step="0.5" value="${UI.brush}" aria-label="Brush size"><output id="brushOut">${UI.brush}</output></label>`;
  if (tray._h !== h) { tray.innerHTML = h; tray._h = h; }
}
function statusOf(b) {
  const T = TYPES[b.type];
  if (b.type === 'pier') return b.conn ? ['ok', b.level >= 1 ? 'A stone harbour. Bigger ships bring more settlers, more often.' : 'Settler ships dock here. New arrivals walk the roads to their homes.'] : ['bad', 'No road to the Colony Hall. Settler ships can’t land until you connect it.'];
  if (b.burnt) return ['bad', `Burnt in a raid. Nothing works here until it’s repaired.`];
  if (!Sim.done(b)) return ['warn', `Under construction: ${Math.round(b.build * 100)}%. Builders are on site.`];
  if (b.type !== 'hall' && !b.conn) return ['bad', 'No road back to the Colony Hall. Nobody can live or work here until you connect it.'];
  if (T.home) {
    const room = T.home[b.level] - b.res;
    if (b.status === 'upgradeCost') { const c = Sim.UPGRADE[b.level + 1]; return ['warn', `Ready to grow. Waits until you have ${(c.wood || 0) + Sim.RESERVE.wood} wood and ${(c.stone || 0) + Sim.RESERVE.stone} stone, so you always keep some for building.`]; }
    if (b.happy < 30) return ['bad', 'Unhappy. Families may leave.'];
    if (room > 0) return ['ok', `${room} ${room === 1 ? 'bed' : 'beds'} free. New settlers will move in.`];
    return ['ok', 'Full house.'];
  }
  if (T.jobs) {
    if (b.staff === 0) return ['warn', 'No workers yet. More settlers will fill these jobs.'];
    if (b.status === 'notrees') return ['warn', 'No grown trees within reach. Plant some nearby or wait for saplings.'];
    if (T.army) { const A = Sim.army(S), k = T.army, q = Sim.queued(S, k); if (b.staff === 0) return ['warn', 'No workers yet. Training needs a few staff.']; return ['ok', `${A.n[k]}/${Sim.armyCap(S, k)} ${Sim.TROOPS[k].name.toLowerCase()} trained${q ? `, ${q} in training` : ''}.`]; }
    if (b.type === 'warschool') return ['ok', 'Officers are ready. Research stronger troops from the Army panel.'];
    if (b.status === 'nofarm') return ['bad', 'No flour! Needs a farm with workers somewhere on the island.'];
    if (b.status === 'nolumber') return ['bad', 'No logs coming in. Build a lumber camp within 8 tiles.'];
    const pd = perHour(b);
    if (pd) return ['ok', `Working: ${fmtRate(pd[0])} ${pd[1]} per hour.`];
    return ['ok', { market: 'Open for business.', clinic: 'The doctor is in. Homes nearby are happier.', library: 'Open for readers. Homes nearby pay 10% more taxes.', academy: 'Lectures every day. Homes within 22 tiles pay 20% more taxes.', port: 'A merchant calls every other morning.', tavern: 'Pouring drinks. Settlers drop by in the evening.', school: 'Lessons on weekdays, 8 to 2.', stable: 'Horses ready. Carts haul goods and all production is up 15%.', chapel: 'Sunday service at 9:30.' }[b.type] || 'Running.'];
  }
  return ['ok', { well: 'Supplying fresh water nearby.', plaza: 'The fountain’s running. Settlers gather here.', lighthouse: 'Shining for the whole island.', garden: 'A lovely spot. Homes nearby are happier.', hall: 'Town meetings every Sunday at 5 PM.' }[b.type] || 'Ready.'];
}
function renderAgent(el, a) {
  const home = S.b.find(b => b.id === a.home), hh = home ? Math.round(home.happy) : S.happy;
  let h = `<button class="x" data-act="closeInsp" aria-label="Close">×</button>
    <div class="who"><span class="av" style="background:rgb(${a.color.map(v => Math.round(v * 255)).join(',')})">${esc(a.name[0])}</span><div><h2>${esc(a.name)}</h2><div class="sub">${esc(world.jobOf(a))}${a.kid ? ' · child' : ''}</div></div></div>
    <div class="status ok">${esc(world.doingOf(a))}</div>`;
  if (a.thought) h += `<div class="quote">“${esc(a.thought)}”</div>`;
  h += `<div class="kv"><div><span>Home</span><b style="font-size:15px">${home ? esc(bName(home)) : 'The Colony Hall'}</b></div><div><span>Mood</span><b>${hh}</b></div></div>
    <div class="happy">${I.face(hh)}<div class="bar"><i style="width:${hh}%"></i></div></div>
    <div class="row2"><button class="btn" data-act="follow">${UI.follow === a ? 'Stop following' : 'Follow'}</button>${home && !a.temp ? '<button class="btn" data-act="showHome">Show home</button>' : ''}</div>`;
  el.hidden = false;
  if (el._h !== h) { el.innerHTML = h; el._h = h; }
}
function renderInsp() {
  const el = $('#insp');
  if (UI.selAgent) { if (world.agents.includes(UI.selAgent)) { renderAgent(el, UI.selAgent); return; } UI.selAgent = null; UI.follow = null; }
  const b = UI.sel ? S.b.find(x => x.id === UI.sel) : null;
  if (!b) { el.hidden = true; el._h = ''; return; }
  const T = TYPES[b.type], st = statusOf(b);
  let h = `<button class="x" data-act="closeInsp" aria-label="Close">×</button><div><h2>${esc(bName(b))}</h2><div class="sub">${b.type === 'house' ? 'Home · level ' + (b.level + 1) + ' of 3' : esc(T.desc)}</div></div>`;
  h += `<div class="status ${st[0]}">${esc(st[1])}</div><div class="kv">`;
  if (b.type === 'pier') h += `<div><span>Kind</span><b style="font-size:15px">${b.level >= 1 ? 'Stone harbour' : 'Wooden pier'}</b></div>`;
  if (T.home) h += `<div><span>Residents</span><b>${b.res}/${T.home[b.level]}</b></div><div><span>Happiness</span><b>${b.happy}</b></div>`;
  if (T.jobs) h += `<div><span>Workers</span><b>${b.staff}/${T.jobs}</b></div>`;
  const pd = perHour(b); if (pd) h += `<div><span>Per hour</span><b>${fmtRate(pd[0])} ${pd[1]}</b></div>`;
  if ((b.type === 'farm' || b.type === 'orchard') && Sim.done(b)) h += `<div><span>Next harvest</span><b>${Math.round((b.prog || 0) * 100)}%</b></div>`;
  if (!Sim.done(b)) h += `<div><span>Built</span><b>${Math.round(b.build * 100)}%</b></div>`;
  h += '</div>';
  if (T.home) {
    const c = b.cov || {};
    const row = (ok, txt) => `<div><span class="dot ${ok ? 'y' : 'n'}">${ok ? '✓' : ''}</span>${txt}</div>`;
    const extra = (c.plaza ? row(1, 'Plaza nearby') : '') + (c.clinic ? row(1, 'Clinic nearby') : '') + (c.library ? row(1, 'Library nearby') : '') + (c.quay ? row(1, 'Harbour walk') : '') + (c.cobble ? row(1, 'Cobbled street') : '');
    if (b.type === 'villa') h += `<div class="checks">${row(c.garden || c.plaza, 'Garden or plaza nearby (villas insist)')}</div>`;
    if (b.type === 'apartment') h += `<div class="checks">${row(c.market, 'Market nearby (tenants insist)')}</div>`;
    h += `<div class="checks">${extra}${row(c.market, 'Market nearby')}${row(c.well, 'Well nearby')}${row(c.chapel, 'Chapel nearby')}${row(c.tavern, 'Tavern nearby')}${row(c.school, 'School nearby')}${row(c.garden, 'Garden nearby')}${row((b.trees || 0) >= 3, `Trees nearby (${b.trees || 0})`)}${row(!S.starving, 'Food in the stores')}</div>`;
    const fam = world.agents.filter(a => a.home === b.id && !a.temp).map(a => a.name.split(' ')[0]);
    if (fam.length) h += `<p class="desc">Living here: ${esc(fam.join(', '))}${b.res > fam.length ? ` and ${b.res - fam.length} more` : ''}.</p>`;
    if (b.type === 'house' && b.level < 2) h += `<p class="desc">${b.level === 0 ? 'Grows into a townhouse when full, happy (55+) and near a market.' : 'Grows into a manor when full, very happy (66+) and near a market, a well and a chapel.'} Costs ${Sim.costText(Sim.UPGRADE[b.level + 1])}, and only while you’d still have ${Sim.RESERVE.wood} wood and ${Sim.RESERVE.stone} stone left.</p>`;
  } else h += `<p class="desc">${esc(T.desc)}</p>`;
  if (b.burnt && !Online.mode) { const rc = Sim.repairCost(b), can = Sim.affordable(S, rc); h += `<button class="btn ${can ? 'primary' : ''}" data-act="repair" style="width:100%">Repair · ${esc(Sim.costText(rc))}</button>`; }
  if (T.army && Sim.done(b) && !b.burnt && !Online.mode) { const k = T.army, TR = Sim.TROOPS[k]; h += `<div class="row2"><button class="btn primary" data-act="train1">Train 1 ${esc(TR.one)}<br><small>${esc(Sim.costText(TR.cost))}</small></button><button class="btn" data-act="train5">Train 5</button></div><button class="btn" data-act="army">⚔️ Army panel</button>`; }
  if (b.type === 'warschool' && Sim.done(b) && !Online.mode) h += `<button class="btn primary" data-act="army">⚔️ Research in the Army panel</button>`;
  if (b.type === 'pier' && b.level < 1 && !Online.mode) {
    const can = Sim.affordable(S, Sim.HARBOUR);
    h += `<p class="desc">Rebuild in stone: ships carry 60% more settlers and call more often.</p><button class="btn ${can ? "primary" : ""}" data-act="harbour" style="width:100%;margin-bottom:6px" ${can ? '' : 'disabled'}>Upgrade to harbour · ${Sim.costText(Sim.HARBOUR)}</button>`;
  }
  if (b.type !== 'hall' && b.type !== 'pier' && !Online.mode) {
    const arm = UI.confirm === 'demo:' + b.id;
    const refund = Object.keys(T.cost).map(k => Math.floor(T.cost[k] / 2) + ' ' + k).join(', ');
    h += `<button class="btn danger ${arm ? 'arm' : ''}" data-act="demolish">${arm ? 'Tap again to remove' + (refund ? ` (refund ${refund})` : '') : 'Remove building'}</button>`;
  }
  el.hidden = false;
  if (el._h !== h) { el.innerHTML = h; el._h = h; }
}
function renderHint() {
  const tool = UI.tool;
  if (UI.introOpen || UI.savesOpen || !$('#modal').hidden) { hint(null); return; }
  const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (Online.mode === 'raid') { hint(touch ? 'Tap a building to smash it · tap a guard to fight · tap the ship to unload' : 'Click a building to smash and loot it · click a guard or a wall to attack · click the ship to unload'); return; }
  if (Online.mode === 'visit' && tool === 'select') { hint(UI.sel ? null : 'Look around · tap buildings and settlers to see what’s going on'); return; }
  if (tool === 'select') { hint(UI.sel ? null : touch ? 'Drag to move · pinch to zoom · tap a building or a settler' : 'Drag to look around · right-drag to turn · scroll to zoom · click a building or a settler'); return; }
  if (BRUSH_TOOLS.includes(tool)) {
    const t = { raise: 'Hold to raise the land', lower: 'Hold to lower the land; dig below the sea to make coves', flatten: 'Hold to level the land to where you started', smooth: 'Hold to soften slopes', plant: 'Hold to plant trees, 1 gold each', clear: 'Hold to clear trees; grown trees give wood' }[tool];
    hint(`${t}${touch ? '' : ' · [ ] change size'}${tool !== 'plant' && tool !== 'clear' ? ' · costs a little gold' : ''}`); return;
  }
  if (tool === 'road') {
    const rt = UI.roadType || 1, RD = Sim.ROADS[rt];
    if (UI.road && UI.hover) {
      const q = Sim.roadQuote(S, Sim.roadPath(UI.road.a, [UI.hover.i, UI.hover.j]), rt), parts = [];
      if (q.n) parts.push(`${q.n} new`); if (q.up) parts.push(`${q.up} upgraded`);
      hint(`<b>${RD.name}</b> · ${parts.join(', ') || 'nothing new'} · ${q.cost} gold${q.stone ? ` ${q.stone} stone` : ''}${q.blocked ? ` · <span class="err">red tiles ${rt === 4 ? 'aren’t on the shore' : 'are blocked'}</span>` : ''}`);
    }
    else hint({ 1: 'Drag to lay a road · horse carts use these · roads must link back to the Colony Hall', 2: 'Drag to lay a footpath · cheap alleys for walkers; carts won’t use them', 3: 'Drag to pave with cobblestones · settlers walk faster and homes beside them are happier · drag over old roads to upgrade', 4: 'Drag along the shore to build a stone quay · settlers love a harbour walk, and docks beside it fish 25% more' }[rt]);
    return;
  }
  if (tool === 'wall') {
    const wt = UI.wallType || 1, W = Sim.WALLS[wt];
    if (UI.road && UI.hover) { const q = Sim.wallQuote(S, Sim.roadPath(UI.road.a, [UI.hover.i, UI.hover.j]), wt); hint(`<b>${W.name}</b> · ${q.n + q.up} tiles · ${Sim.costText(q.cost) || 'nothing'}${q.blocked ? ' · <span class="err">red tiles are blocked</span>' : ''}`); }
    else hint(`Drag to build a ${W.name.toLowerCase()} · where it crosses a road it becomes a gate · raiders have to break through`);
    return;
  }
  if (tool === 'demolish') { hint('Click a building to remove it, or drag across roads to pull them up'); return; }
  if (tool.startsWith('build:')) {
    const type = tool.slice(6), T = TYPES[type], c = UI.ghostCheck;
    hint(`<b>${esc(T.name)}</b> · ${Sim.costText(T.cost) || 'free'}${c && !c.ok ? ` · <span class="err">${esc(c.reason)}</span>` : ' · click to build'}${!touch && !T.coastal ? ' · R to rotate' : ''}`);
  }
}
function renderAll() { renderRes(); renderClock(); renderGoals(); renderDock(); renderTray(); renderInsp(); renderHint(); }

/* ---------- Labels and badges ---------- */
const labelPool = [];
// settlers' chatter goes to a small feed in the corner instead of over their heads
function renderChat() {
  const el = $('#chat'), list = world.chat;
  const mini = !UI.chatOpen || (!$('#insp').hidden && window.innerWidth > 700 && window.innerHeight < 1000);
  el.classList.toggle('mini', mini);
  const last = list[list.length - 1];
  const sig = (last ? last.id : 0) + ':' + mini + ':' + (UI.selAgent ? UI.selAgent.id : '');
  if (el._sig === sig) return;
  el._sig = sig;
  const newest = last ? last.id : 0, fresh = el._last !== newest; el._last = newest;
  const line = c => `<button class="ln ${UI.selAgent === c.a ? 'sel' : ''} ${fresh && c.id === newest ? 'new' : ''}" data-chat="${c.id}" title="Find ${esc(c.name)}"><i style="background:rgb(${c.col.map(v => Math.round(v * 255)).join(',')})"></i><span><b>${esc(c.name.split(' ')[0])}</b><em>${esc(c.job)}</em> ${esc(c.text)}</span></button>`;
  const shown = mini ? (last ? [last] : []) : list.slice(-8);
  el.innerHTML = `<div class="ch-head"><b>Island chatter</b><button data-act="chatToggle" aria-label="${mini ? 'Expand chat' : 'Collapse chat'}">${mini ? '▴' : '▾'}</button></div>
    <div class="ch-list">${shown.length ? shown.map(line).join('') : '<p class="ch-empty">Settlers will chat here as they go about their day.</p>'}</div>`;
  const box = el.querySelector('.ch-list'); box.scrollTop = box.scrollHeight;
}
function renderBubbles() {
  renderChat();
  const mk = $('#mark');
  const a = UI.hoverAgent && world.agents.includes(UI.hoverAgent) ? UI.hoverAgent : UI.selAgent;
  if (a && !a.hidden && world.agents.includes(a)) { const q = project(a.x, agentY(a) + (a.kid ? 0.75 : 0.98), a.z); if (q) { mk.hidden = false; mk.style.left = q[0] + 'px'; mk.style.top = q[1] + 'px'; } else mk.hidden = true; }
  else mk.hidden = true;
}
function renderLabels() {
  renderBubbles();
  const box = $('#labels');
  for (const l of world.labels) {
    if (!l.el) {
      const el = document.createElement('div'); el.className = 'fl';
      const icon = RES_ICON[l.kind];
      el.innerHTML = (icon ? icon.replace(/width="22" height="22"/, 'width="18" height="18"') : '') + esc(l.text);
      box.appendChild(el); l.el = el;
    }
    const p = project(l.x, l.y, l.z);
    if (p) { l.el.style.left = p[0] + 'px'; l.el.style.top = p[1] + 'px'; l.el.style.display = ''; } else l.el.style.display = 'none';
  }
  for (const el of [...box.querySelectorAll('.fl')]) if (!world.labels.some(l => l.el === el)) el.remove();
  // status badges
  let k = 0;
  const icons = { noroad: 'No road', nostaff: 'No workers', notrees: 'No trees', burnt: '🔥 Repair' };
  if (cam.dist < 75 && !Online.mode) for (const b of S.b) {
    let st = b.burnt ? 'burnt' : !Sim.done(b) ? 'building' : b.type !== 'hall' && !b.conn ? 'noroad' : TYPES[b.type].jobs && b.staff === 0 ? 'nostaff' : b.status === 'notrees' ? 'notrees' : null;
    if (!st) continue;
    const [x, z] = Sim.center(b), p = project(x, b.y + (b.type === 'lighthouse' ? 3.3 : 1.6), z);
    if (!p || p[0] < -50 || p[1] < -50 || p[0] > cssW + 50 || p[1] > cssH + 50) continue;
    let el = labelPool[k];
    if (!el) { el = document.createElement('div'); el.className = 'badge'; box.appendChild(el); labelPool[k] = el; }
    el.hidden = false; el.className = 'badge ' + (st === 'noroad' || st === 'burnt' ? 'bad' : st === 'building' ? 'bld' : '');
    const txt = st === 'building' ? `Building ${Math.round(b.build * 100)}%` : icons[st];
    if (el._t !== txt) { el.textContent = txt; el._t = txt; }
    el.style.left = p[0] + 'px'; el.style.top = p[1] + 'px';
    if (++k > 40) break;
  }
  for (let q = k; q < labelPool.length; q++) labelPool[q].hidden = true;
}

/* ---------- Actions ---------- */
function setTool(tool) {
  UI.tool = tool; UI.road = null; UI.confirm = null;
  if (tool.startsWith('build:')) UI.ghostVar = Math.floor(Math.random() * 20);
  if (tool !== 'select') UI.sel = null;
  $('#gl').className = tool === 'select' ? '' : 'paint';
  renderAll();
}
function openCat(id) {
  const cat = CATS.find(c => c.id === id); if (!cat) return;
  Sfx.play('click');
  if (cat.tool) { UI.cat = null; setTool(cat.tool); return; }
  if (UI.cat === id) { UI.cat = null; setTool('select'); return; }
  UI.cat = id;
  const first = cat.items[0];
  if (first.road) { UI.roadType = UI.roadType || 1; setTool('road'); return; }
  setTool(typeof first === 'string' ? 'build:' + first : first.id);
}
function act(a, el) {
  const b = UI.sel ? S.b.find(x => x.id === UI.sel) : null;
  if (a === 'menu') { showMenu(); return; }
  if (a === 'forecast') { showForecast(); return; }
  if (a === 'online') { Sfx.play('click'); openOnline(); return; }
  if (a === 'goalsMin') { UI.goalsMin = !UI.goalsMin; savePrefs(); renderGoals(); return; }
  if (a === 'closeInsp') { UI.sel = null; UI.selAgent = null; UI.follow = null; renderInsp(); return; }
  if (a === 'follow') { UI.follow = UI.follow === UI.selAgent ? null : UI.selAgent; if (UI.follow) cam.gdist = Math.min(cam.gdist, 16); renderInsp(); return; }
  if (a === 'showHome' && UI.selAgent) { const hb = S.b.find(x => x.id === UI.selAgent.home); UI.selAgent = null; UI.follow = null; if (hb) { UI.sel = hb.id; cam.fly = Sim.center(hb); } renderInsp(); return; }
  if (a === 'stockClose') { UI.stockOpen = false; renderStock(); return; }
  if (a === 'chatToggle') { UI.chatOpen = !UI.chatOpen; savePrefs(); renderChat(); return; }
  if (a === 'army') { Sfx.play('click'); openArmy(); return; }
  if (a === 'repair' && b) { const r = Sim.repair(S, b.id); if (r.error) { toast(r.error, 'bad'); Sfx.play('err'); } else { Sfx.play('build'); afterChange(); } return; }
  if ((a === 'train1' || a === 'train5') && b && TYPES[b.type].army) { const r = Sim.train(S, TYPES[b.type].army, a === 'train5' ? 5 : 1); if (r.error) { toast(r.error, 'bad'); Sfx.play('err'); } else { toast(`Training ${r.n} ${Sim.TROOPS[TYPES[b.type].army].name.toLowerCase()}.`); Sfx.play('click'); } afterChange(); return; }
  if (a === 'harbour') { const r = Sim.upgradePier(S); if (r.error) { toast(r.error, 'bad'); Sfx.play('err'); } else afterChange(); return; }
  if (a === 'demolish' && b) {
    if (UI.confirm === 'demo:' + b.id) { doDemolish(b); }
    else { UI.confirm = 'demo:' + b.id; renderInsp(); }
  }
}
function doDemolish(b) {
  const r = Sim.demolish(S, b.id);
  if (r.error) { toast(r.error, 'bad'); Sfx.play('err'); return; }
  if (UI.sel === b.id) UI.sel = null; UI.confirm = null;
  afterChange();
}
function afterChange() { processEvents(); renderAll(); }

function processEvents() {
  const evs = S._ev.splice(0);
  if (!evs.length) return;
  world.handle(evs);
  if (Online.mode) { if (evs.some(e => ['settlers', 'build', 'built', 'level', 'leave', 'demolish'].includes(e.type))) world.syncAgents(); return; }
  let resync = false;
  for (const e of evs) {
    if (e.type === 'toast') toast(e.text, e.kind === 'goal' ? 'goal' : e.kind === 'bad' ? 'bad' : e.kind === 'unlock' ? 'unlock' : '');
    if (e.type === 'goal') Sfx.play('goal');
    if (e.type === 'settlers') { Sfx.play('bell'); resync = true; }
    if (e.type === 'boat') Sfx.play('bell');
    if (e.type === 'unlock') renderTray();
    if (e.type === 'demolish' || e.type === 'leave' || e.type === 'build' || e.type === 'level' || e.type === 'built') resync = true;
    if (e.type === 'meetingSoon') Sfx.play('meeting');
    if (e.type === 'meeting') startMeeting();
    if (e.type === 'hint') toast(e.text);
    if (e.type === 'trained') { toast(`${e.n} new ${e.n === 1 ? Sim.TROOPS[e.troop].one : Sim.TROOPS[e.troop].name.toLowerCase()} ready for duty.`, 'unlock'); Sfx.play('level'); if (UI.armyOpen) renderArmy(); }
  }
  if (resync) world.syncAgents();
}

/* ---------- Pointer input ---------- */
const ptr = new Map();
let gesture = null, drag = null;
function cpos(e) { const r = $('#gl').getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
function setHover(p) {
  const h = pick(p[0], p[1]);
  UI.hover = h;
  return h;
}
function startTool(h, e) {
  const tool = UI.tool;
  if (BRUSH_TOOLS.includes(tool)) { UI.painting = true; UI.flattenH = h ? Sim.heightAt(S, h.x, h.z) : 0; UI.paintAcc = 1; return true; }
  if (tool === 'road' || tool === 'wall') { if (h) UI.road = { a: [h.i, h.j] }; return true; }
  if (tool === 'demolish') { UI.erasing = true; return true; }
  return false;
}
function applyBrush(dt) {
  const h = UI.hover; if (!UI.painting || !h) return;
  const tool = UI.tool;
  if (tool === 'plant' || tool === 'clear') {
    UI.paintAcc += dt;
    if (UI.paintAcc < 0.09) return;
    UI.paintAcc = 0;
    if (tool === 'plant') { const r = Sim.plantTrees(S, h.x, h.z, UI.brush, Math.max(1, Math.round(UI.brush * 0.8))); if (r.planted) Sfx.play('plant'); else if (S.gold < 1) { stopPaint(); toast('Out of gold.', 'bad'); } }
    else { const r = Sim.clearTrees(S, h.x, h.z, UI.brush); if (r.n) Sfx.play('chop'); }
    processEvents();
    return;
  }
  const amt = { raise: 2.6, lower: 2.6, flatten: 3, smooth: 3 }[tool] * dt * (0.6 + UI.brush * 0.08);
  const r = Sim.brush(S, tool, h.x, h.z, UI.brush, amt, UI.flattenH);
  if (r.error) { stopPaint(); toast(r.error, 'bad'); Sfx.play('err'); }
  else { UI.paintAcc += dt; if (UI.paintAcc > 0.12) { UI.paintAcc = 0; Sfx.play('brush'); } }
  processEvents();
}
function stopPaint() { UI.painting = false; UI.erasing = false; }
function finishTool(h, moved) {
  const tool = UI.tool;
  if (BRUSH_TOOLS.includes(tool)) { stopPaint(); return; }
  if (tool === 'road') {
    if (UI.road && h) {
      const r = Sim.buildRoad(S, Sim.roadPath(UI.road.a, [h.i, h.j]), UI.roadType || 1);
      if (r.error) { toast(r.error, 'bad'); Sfx.play('err'); } else Sfx.play('road');
    }
    UI.road = null; afterChange(); return;
  }
  if (tool === 'wall') {
    if (UI.road && h) {
      const r = Sim.buildWall(S, Sim.roadPath(UI.road.a, [h.i, h.j]), UI.wallType || 1);
      if (r.error) { toast(r.error, 'bad'); Sfx.play('err'); } else Sfx.play('build');
    }
    UI.road = null; afterChange(); return;
  }
  if (tool === 'demolish') {
    UI.erasing = false;
    if (!moved && h) { const b = buildingAt(h.i, h.j); if (b) doDemolish(b); else if (Sim.inB(h.i, h.j) && S.wall[Sim.ci(h.i, h.j)]) { Sim.removeWall(S, [[h.i, h.j]]); Sfx.play('demolish'); afterChange(); } else if (Sim.inB(h.i, h.j) && S.road[Sim.ci(h.i, h.j)]) { Sim.removeRoad(S, [[h.i, h.j]]); Sfx.play('road'); afterChange(); } }
    return;
  }
  if (tool.startsWith('build:') && h && !moved) {
    const type = tool.slice(6), sp = placeSpot(type, h);
    const r = Sim.place(S, type, sp.i, sp.j, UI.rot);
    if (r.error) { toast(r.error, 'bad'); Sfx.play('err'); }
    else { r.building.variant = UI.ghostVar || r.building.variant; UI.ghostVar = Math.floor(Math.random() * 20); }
    afterChange(); return;
  }
  if (tool === 'select' && !moved) {
    if (Online.mode === 'raid') { raidTap(UI.lastClick, h); return; }
    const ag = pickAgent(UI.lastClick);
    if (ag) { UI.selAgent = ag; UI.sel = null; UI.follow = null; Sfx.play('click'); if (!ag.thought) ag.thought = world.phrase(ag, null); renderInsp(); renderHint(); return; }
    UI.selAgent = null; UI.follow = null;
    const b = h ? buildingAt(h.i, h.j) : null;
    UI.sel = b ? b.id : null; UI.confirm = null;
    if (b) Sfx.play('click');
    renderInsp(); renderHint();
  }
}
function agentY(a) { const k = world.pscale / 1.7; return Math.max(Sim.groundAt(S, a.x, a.z), 0.3) + (a.riding && a.path ? 0.3 * k : 0) - (1 - k) * 0.5; }
function pickAgent(p) {
  if (!p) return null;
  let best = null, bd = 26;
  for (const a of world.agents) {
    if (a.hidden || a.waitUntil) continue;
    const q = project(a.x, agentY(a) + 0.3, a.z); if (!q) continue;
    const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; best = a; }
  }
  return best;
}
function bindInput() {
  const cv = $('#gl');
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    Sfx.init();
    cv.setPointerCapture(e.pointerId);
    const p = cpos(e); ptr.set(e.pointerId, p);
    if (ptr.size === 2) {
      stopPaint(); UI.road = null; drag = null;
      const [a, b] = [...ptr.values()];
      gesture = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), ang: Math.atan2(b[1] - a[1], b[0] - a[0]), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], dist: cam.gdist, yaw: cam.gyaw };
      return;
    }
    const h = setHover(p);
    let mode = 'tool';
    if (e.button === 2) mode = 'rotate'; else if (e.button === 1) mode = 'pan';
    else if (UI.tool === 'select' || (UI.tool.startsWith('build:'))) mode = 'pan-or-click';
    drag = { x: p[0], y: p[1], lx: p[0], ly: p[1], mode, moved: false, type: e.pointerType };
    if (mode === 'tool') startTool(h, e);
  });
  cv.addEventListener('pointermove', e => {
    const p = cpos(e);
    if (ptr.has(e.pointerId)) ptr.set(e.pointerId, p);
    if (gesture && ptr.size === 2) {
      const [a, b] = [...ptr.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      cam.gdist = clamp(gesture.dist * gesture.d / Math.max(10, d), 9, 110);
      cam.gyaw = gesture.yaw - (ang - gesture.ang);
      panBy(mid[0] - gesture.mid[0], mid[1] - gesture.mid[1]); gesture.mid = mid;
      return;
    }
    setHover(p);
    if (drag) {
      const dx = p[0] - drag.lx, dy = p[1] - drag.ly;
      if (!drag.moved && Math.hypot(p[0] - drag.x, p[1] - drag.y) > (drag.type === 'touch' ? 10 : 5)) drag.moved = true;
      if (drag.mode !== 'tool' && drag.moved) Online.dragAt = performance.now();
      if (drag.mode === 'rotate') { cam.gyaw -= dx * 0.007; cam.gpitch = clamp(cam.gpitch + dy * 0.005, 0.3, 1.45); }
      else if (drag.mode === 'pan' || (drag.mode === 'pan-or-click' && drag.moved)) { panBy(dx, dy); cv.className = 'grab'; }
      else if (drag.mode === 'tool' && UI.tool === 'demolish' && UI.erasing && drag.moved && UI.hover) {
        const h = UI.hover; if (Sim.inB(h.i, h.j) && S.wall[Sim.ci(h.i, h.j)]) { Sim.removeWall(S, [[h.i, h.j]]); Sfx.play('demolish'); processEvents(); } else if (Sim.inB(h.i, h.j) && S.road[Sim.ci(h.i, h.j)]) { Sim.removeRoad(S, [[h.i, h.j]]); Sfx.play('road'); processEvents(); }
      }
      drag.lx = p[0]; drag.ly = p[1];
    }
  });
  const end = e => {
    const p = cpos(e);
    if (gesture) { ptr.delete(e.pointerId); if (ptr.size < 2) gesture = null; drag = null; return; }
    if (drag) {
      UI.lastClick = p;
      const h = setHover(p);
      if (drag.mode === 'tool' || drag.mode === 'pan-or-click') finishTool(h, drag.moved);
      cv.className = UI.tool === 'select' ? '' : 'paint';
    }
    drag = null; ptr.delete(e.pointerId); stopPaint();
    if (e.pointerType !== 'mouse') UI.hover = null;
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', e => { ptr.delete(e.pointerId); gesture = null; drag = null; stopPaint(); UI.road = null; });
  cv.addEventListener('pointerleave', e => { if (!drag && e.pointerType === 'mouse') UI.hover = null; });
  cv.addEventListener('wheel', e => { e.preventDefault(); cam.gdist = clamp(cam.gdist * Math.exp(e.deltaY * (e.deltaMode === 1 ? 0.04 : 0.0012)), 9, 110); }, { passive: false });

  $('#dock').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (b) { Sfx.init(); openCat(b.dataset.cat); } });
  $('#tray').addEventListener('click', e => {
    if (e.target.closest('[data-act=rotate]')) { UI.rot = (UI.rot + 1) % 4; Sfx.play('click'); return; }
    const rd = e.target.closest('[data-road]'); if (rd) { Sfx.play('click'); UI.roadType = +rd.dataset.road; setTool('road'); return; }
    const wl = e.target.closest('[data-wall]'); if (wl) { Sfx.play('click'); UI.wallType = +wl.dataset.wall; setTool('wall'); return; }
    const b = e.target.closest('[data-build],[data-tool]'); if (!b) return;
    Sfx.play('click');
    setTool(b.dataset.build ? 'build:' + b.dataset.build : b.dataset.tool);
  });
  $('#tray').addEventListener('input', e => { if (e.target.id === 'brush') { UI.brush = +e.target.value; $('#brushOut').textContent = UI.brush; } });
  $('#chat').addEventListener('click', e => {
    const t = e.target.closest('[data-act]'); if (t) { act(t.dataset.act, t); return; }
    const ln = e.target.closest('[data-chat]'); if (!ln) return;
    const c = world.chat.find(x => x.id === +ln.dataset.chat);
    if (c && world.agents.includes(c.a)) {
      Sfx.play('click'); UI.selAgent = c.a; UI.sel = null; UI.follow = null;
      if (c.a.hidden) toast(`${c.a.name.split(' ')[0]} is indoors right now.`); else { cam.fly = [c.a.x, c.a.z]; cam.gdist = Math.min(cam.gdist, 18); }
      renderInsp(); renderChat();
    } else toast('They’ve wandered off somewhere.');
  });
  $('#chat').addEventListener('pointerover', e => { const ln = e.target.closest('[data-chat]'); const c = ln && world.chat.find(x => x.id === +ln.dataset.chat); UI.hoverAgent = c ? c.a : null; });
  $('#chat').addEventListener('pointerleave', () => { UI.hoverAgent = null; });
  $('#res').addEventListener('click', () => { UI.stockOpen = !UI.stockOpen; Sfx.init(); Sfx.play('click'); renderStock(); });
  $('#stock').addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (a) act(a.dataset.act, a); });
  $('#clock').addEventListener('click', e => { Sfx.init(); const b = e.target.closest('[data-speed]'); if (b) setSpeed(+b.dataset.speed); const a = e.target.closest('[data-act]'); if (a) act(a.dataset.act, a); });
  $('#goals').addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (a) act(a.dataset.act, a); });
  $('#insp').addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (a) act(a.dataset.act, a); });
  $('#modal').addEventListener('click', e => {
    const mb = e.target.closest('[data-meet]');
    if (mb) { Sfx.init(); chooseMeeting(mb.dataset.meet); return; }
    if (UI.meetingOpen) return;
    const ob = e.target.closest('[data-ol]');
    if (ob && !ob.disabled) { Sfx.init(); Sfx.play('click'); onlineAct(ob.dataset.ol); return; }
    const b = e.target.closest('[data-m]');
    if (!b) { if (e.target.id === 'modal' && !UI.introOpen && !Online.result) closeModal(); return; }
    Sfx.init(); Sfx.play('click');
    const m = b.dataset.m;
    if (m === 'start' || m === 'close') closeModal();
    else if (m === 'save') { save(true); closeModal(); }
    else if (m === 'saves') { UI.fromIntro = UI.introOpen; UI.introOpen = false; openSaves(); }
    else if (m === 'sound') showSound();
    else if (m === 'menu') showMenu();
    else if (m === 'help') showHelp();
    else if (m === 'new') { if (UI.confirm === 'new') { UI.confirm = null; newIsland(); } else { UI.confirm = 'new'; showMenu(); } }
  });
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (UI.savesOpen) { if (e.key === 'Escape') closeSaves(); return; }
    if (!$('#modal').hidden) { if (e.key === 'Escape') { if (UI.meetingOpen) chooseMeeting('close'); else if (!UI.introOpen && !Online.result) closeModal(); } return; }
    if (Online.mode === 'raid' && [' ', '1', '2', '3', 'Delete', 'Backspace'].includes(e.key)) return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); setSpeed(UI.speed ? 0 : (UI.lastSpeed || 1)); }
    else if (k === '1' || k === '2' || k === '3') setSpeed(+k);
    else if (k === 'escape') { UI.cat = null; setTool('select'); UI.sel = null; UI.selAgent = null; UI.follow = null; UI.stockOpen = false; renderStock(); renderInsp(); }
    else if (k === 'r') { UI.rot = (UI.rot + 1) % 4; Sfx.play('click'); }
    else if (k === '[') { UI.brush = clamp(UI.brush - 0.5, 1, 8); renderTray(); }
    else if (k === ']') { UI.brush = clamp(UI.brush + 0.5, 1, 8); renderTray(); }
    else if (k === 'q') cam.gyaw += 0.35;
    else if (k === 'e') cam.gyaw -= 0.35;
    else if (k === 'delete' || k === 'backspace') { const b = UI.sel && S.b.find(x => x.id === UI.sel); if (b) act('demolish'); }
    else if (k === '=' || k === '+') cam.gdist = clamp(cam.gdist * 0.85, 9, 110);
    else if (k === '-') cam.gdist = clamp(cam.gdist * 1.18, 9, 110);
  });
  const keys = new Set();
  window.addEventListener('keydown', e => { if (e.target.tagName !== 'INPUT') keys.add(e.key.toLowerCase()); });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());
  UI.keys = keys;
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('pagehide', () => save());
}
function keyPan(dt) {
  const k = UI.keys; if (!k || !k.size || !$('#modal').hidden) return;
  let x = 0, y = 0;
  if (k.has('w') || k.has('arrowup')) y -= 1; if (k.has('s') || k.has('arrowdown')) y += 1;
  if (k.has('a') || k.has('arrowleft')) x -= 1; if (k.has('d') || k.has('arrowright')) x += 1;
  if (x || y) panBy(-x * 700 * dt, -y * 700 * dt);
}
function setSpeed(i) { if (i) UI.lastSpeed = i; UI.speed = i; renderClock(); }
function resize() { cssW = $('#gl').clientWidth; cssH = $('#gl').clientHeight; R.resize(window.innerWidth < 700 ? 1.5 : 2); }

/* ---------- Modals ---------- */
function openModal(html) { const m = $('#modal'); m.classList.remove('ol'); if (!html.includes('Your army')) UI.armyOpen = false;  m.innerHTML = `<div class="card panel" role="dialog" aria-modal="true">${html}</div>`; m.hidden = false; hint(null); }
function closeModal() { $('#modal').hidden = true; $('#modal').classList.remove('ol'); UI.onlineOpen = false; UI.armyOpen = false; UI.introOpen = false; if (UI.confirm === 'new') UI.confirm = null; renderHint(); }
function islandName() { const a = ['Gull', 'Saltmoss', 'Cinder', 'Bramble', 'Pebble', 'Hollow', 'Kelp', 'Juniper', 'Larkspur', 'Tidewell'], b = [' Isle', ' Cay', ' Island', ' Key']; return a[S.seed % a.length] + b[(S.seed >> 4) % b.length]; }
function startMeeting() {
  if (!S.meeting || UI.meetingOpen) return;
  UI.meetingOpen = true; UI.preMeetSpeed = UI.speed || UI.lastSpeed || 1; setSpeed(0);
  const hall = S.b.find(b => b.type === 'hall');
  if (hall) { const [x, z] = Sim.center(hall), d = Sim.DIRS[hall.rot]; cam.fly = [x + d[0] * 2.5, z + d[1] * 2.5]; cam.gdist = Math.min(cam.gdist, 22); cam.gyaw = Math.atan2(d[0], d[1]); }
  setTimeout(showMeeting, 900);
}
function showMeeting() {
  const m = S.meeting; if (!m) { UI.meetingOpen = false; return; }
  const r = m.report, dh = r.happy - r.happy0;
  const stat = (v, l) => `<div><b>${v}</b><span>${l}</span></div>`;
  openModal(`<div class="mt-head"><h2>Town meeting</h2><span class="sub">${Sim.WEEKDAYS[6]} · Day ${m.day + 1}</span></div>
    <p class="lead">The settlers have gathered at the Colony Hall. Here’s how the week went.</p>
    <div class="week">${stat((r.newSettlers >= 0 ? '+' : '') + r.newSettlers, 'settlers')}${stat(r.food, 'food made')}${stat(r.wood, 'wood')}${stat(r.stone, 'stone')}${stat(r.gold, 'gold')}${stat((dh >= 0 ? '+' : '') + dh, 'happiness')}</div>
    <p class="lead"><b style="color:var(--ink)">What should the town do this week?</b></p>
    <div class="opts">${m.opts.map(o => `<button class="opt ${o.wish ? 'wish' : ''}" data-meet="${esc(o.id)}"><b>${esc(o.title)}</b><span>${esc(o.desc)}</span>${o.cost || o.gain ? `<span class="tr">${o.cost ? `<em class="down">${esc(o.cost)}</em>` : ''}${o.gain ? `<em class="up">${esc(o.gain)}</em>` : ''}</span>` : ''}</button>`).join('')}</div>`);
  $('#modal').classList.add('meet');
}
function chooseMeeting(id) {
  Sim.meetingChoose(S, id);
  UI.meetingOpen = false; $('#modal').classList.remove('meet'); $('#modal').hidden = true;
  setSpeed(UI.preMeetSpeed || 1); Sfx.play('goal'); processEvents(); renderAll();
}
function showIntro() {
  UI.introOpen = true;
  openModal(`<h1>Drift<span>wood</span></h1>
    <p class="lead">Your ship has docked at ${esc(islandName())} with four settlers. You have a Colony Hall and a Landing Pier where new settlers will arrive. Shape the land, lay roads and grow a town.</p>
    <ul>
      <li><i>${I.road.replace(/26/g, '22')}</i><span><b>Roads first.</b> Everything must connect back to the Colony Hall by road.</span></li>
      <li><i>${I.homes.replace(/26/g, '22')}</i><span><b>Build cottages</b> along your roads. Boats bring new settlers to fill them.</span></li>
      <li><i>${I.work.replace(/26/g, '22')}</i><span><b>Give them work.</b> A lumber camp by the forest, and a farm, orchard or fishing dock for food. Tap the resource bar to see what you make each hour.</span></li>
      <li><i>${I.land.replace(/26/g, '22')}</i><span><b>Shape the island.</b> Raise hills, dig coves, plant forests. It’s your island.</span></li>
      <li><i>${I.town.replace(/26/g, '22')}</i><span><b>Every Sunday</b> the town meets at the hall and you decide what happens next.</span></li>
    </ul>
    <div class="row2"><button class="btn primary" data-m="start">Start the colony</button><button class="btn" data-m="saves">Your islands</button></div>`);
}
function showHelp() {
  openModal(`<h2>Controls</h2><div class="keys">
    <kbd>Drag</kbd><span>Move around (Select tool)</span><kbd>Right-drag</kbd><span>Turn and tilt the view</span>
    <kbd>Scroll</kbd><span>Zoom; on touch, pinch to zoom and twist to turn</span><kbd>W A S D</kbd><span>Pan · Q and E turn</span>
    <kbd>R</kbd><span>Rotate the building you are placing</span><kbd>[ ]</kbd><span>Brush size</span>
    <kbd>Space</kbd><span>Pause · 1 2 3 change speed</span><kbd>Esc</kbd><span>Back to Select</span></div>
    <p class="lead">Coastal buildings turn to face the water by themselves. Ground under a new building is levelled for free.</p>
    <button class="btn" data-m="close">Back to the island</button>`);
}
const WX_EFFECT = { clear: 'Settlers are a little happier in the sun.', fair: 'A good day for everything.', cloudy: 'Nothing special.', drizzle: 'Farms +10%, fishing −15%.',
  rain: 'Farms +15%, fishing −30%, building is slower.', storm: 'Fishing −65%, building at half speed, and settlers are miserable. Expect lightning.', fog: 'Fishing −20%. The world goes quiet and grey.' };
const windWord = w => w < 0.12 ? 'calm' : w < 0.35 ? 'a light breeze' : w < 0.6 ? 'breezy' : w < 0.85 ? 'windy' : 'a gale';
const clockStr = t => { const h = Math.floor(t % 24); return String(h).padStart(2, '0') + ':00'; };
function showForecast() {
  if (!S.wx) return;
  const ico = k => ({ clear: I.sun, fair: I.cloud, cloudy: I.overcast, drizzle: I.drizzle, rain: I.rain, storm: I.storm, fog: I.fog }[k]);
  const dayOff = t => { const d = Math.floor(t / 24) - Math.floor(S.t / 24); return d <= 0 ? '' : d === 1 ? 'tomorrow ' : 'in ' + d + ' days '; };
  const rows = [S.wx.now, ...S.wx.q].map((f, n) => `<div class="fc ${n ? '' : 'now'}">${ico(f.k)}<div><b>${n ? 'From ' + dayOff(f.from) + clockStr(f.from) : 'Now, until ' + dayOff(f.to) + clockStr(f.to)}: ${esc(Sim.WX[f.k].name)}</b>
    <span>${esc(WX_EFFECT[f.k])} Wind: ${windWord(f.wind)}.</span></div></div>`).join('');
  openModal(`<div class="ol-head"><h2>Weather</h2><button class="x" data-m="close" aria-label="Close">×</button></div><p class="lead">The harbourmaster’s forecast for the next few fronts.</p>${rows}
    <div class="row2"><button class="btn primary" data-m="close">Back to the island</button></div>`);
}
function showMenu() {
  const arm = UI.confirm === 'new';
  openModal(`<h2>${esc(islandName())}</h2><p class="lead">Day ${Math.floor(S.t / 24) + 1} · ${Sim.pop(S)} settlers. Your island saves itself in this browser.</p>
    <div class="menu"><button class="btn primary" data-m="close">Back to the island</button><button class="btn" data-m="saves">Your islands · save &amp; load</button>
    <button class="btn" data-m="help">Controls</button><button class="btn" data-m="sound">Sound settings</button>
    <button class="btn danger ${arm ? 'arm' : ''}" data-m="new">${arm ? 'Tap again to start over on a new island' : 'New island'}</button></div>
    <p class="credit">Music: “Cozy Music Sampler” by Spaceyyy (aquumgifts.itch.io), CC BY 4.0</p>`);
}
const VOLS = [
  ['music', 'Background music', 'The soundtrack. Changes with the time of day and the weather.'],
  ['world', 'World sounds', 'Waves, wind, rain, birds, crickets and the bustle of your colony.'],
  ['fx', 'Game effects', 'Clicks, building, goals, bells and battles.'],
];
const pctText = v => v ? Math.round(v * 100) + '%' : 'Off';
function showSound() {
  let h = `<div class="ol-head"><h2>Sound</h2><button class="x" data-m="close" aria-label="Close">×</button></div><div class="vols">`;
  for (const [k, name, desc] of VOLS) h += `<label class="vol2"><span class="vt"><b>${name}</b><em id="pct-${k}">${pctText(UI[k])}</em></span><small>${desc}</small>
    <input type="range" id="vol-${k}" min="0" max="100" step="5" value="${Math.round(UI[k] * 100)}" aria-label="${name} volume"></label>`;
  h += `</div><div class="row2"><button class="btn" data-m="menu">Back to the menu</button><button class="btn primary" data-m="close">Done</button></div>
    <p class="credit">Music: “Cozy Music Sampler” by Spaceyyy (aquumgifts.itch.io), CC BY 4.0</p>`;
  openModal(h);
}

/* ---------- Persistence ---------- */
function save(announce) {
  if (!S || Online.mode) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(Sim.serialize(S))); if (announce) toast('Island saved'); }
  catch (e) { if (announce) toast('Saving isn’t available in this browser window.', 'bad'); }
}
function readSave() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify({ fx: UI.fx, world: UI.world, music: UI.music, goalsMin: UI.goalsMin, chatOpen: UI.chatOpen })); } catch (e) {} }
function loadPrefs() { try { const p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); for (const k of ['fx', 'world', 'music']) if (typeof p[k] === 'number' && p[k] >= 0 && p[k] <= 1) UI[k] = p[k]; if (p.sound === false && p.fx === undefined) { UI.fx = 0; UI.world = 0; } if (typeof p.goalsMin === 'boolean') UI.goalsMin = p.goalsMin; if (typeof p.chatOpen === 'boolean') UI.chatOpen = p.chatOpen; } catch (e) {} }
function frameHall() {
  const hall = S.b.find(b => b.type === 'hall'); if (!hall) return;
  const [x, z] = Sim.center(hall);
  cam.tx = x * 0.85; cam.tz = z * 0.85; cam.gdist = cam.dist = cssW < 700 ? 34 : 30;
  // look from the sea toward the island
  cam.gyaw = cam.yaw = Math.atan2(x, z);
  cam.gpitch = cam.pitch = 0.78;
}
async function newIsland() {
  await keepCurrent(); toast('Your old island is kept in Your islands.');
  const old = S; S = Sim.newGame((Math.random() * 2 ** 31) >>> 0); carryMp(old, S);
  world.setState(S); UI.sel = null; UI.cat = null; setTool('select'); frameHall(); save(); showIntro(); renderAll();
}

/* ---------- Main loop ---------- */
function frame(ts) {
  const dt = Math.min(0.1, (ts - (lastTs || ts)) / 1000); lastTs = ts;
  const hNow = S.t % 24, nightBoost = hNow >= 21 || hNow < 5.5 ? 2.5 : 1;
  const simH = UI.introOpen || UI.savesOpen || !$('#modal').hidden ? 0 : SPEEDS[UI.speed] * dt * nightBoost;
  if (simH > 0) { const dayBefore = Math.floor(S.t / 24); Sim.step(S, simH); if (Math.floor(S.t / 24) !== dayBefore) save(); }
  if (UI.painting) applyBrush(dt);
  Music.update(); Amb.update(dt);
  processEvents();
  keyPan(dt);
  if (UI.follow) { if (world.agents.includes(UI.follow) && !UI.follow.hidden) cam.fly = [UI.follow.x, UI.follow.z]; else if (!world.agents.includes(UI.follow)) UI.follow = null; }
  onlineFrame(dt);
  world.focus = [cam.tx, cam.tz];
  updateCamera(dt);
  world.update(dt, simH);
  world.render(R, { vp: cam.vp, eye: cam.eye, dist: cam.dist }, { selected: UI.sel, draw: drawOverlay });
  renderLabels();
  uiTick += dt; saveTick += dt;
  if (uiTick > 0.2) {
    uiTick = 0; renderRes(); renderClock(); renderGoals(); renderInsp(); renderHint();
    if (!$('#tray').hidden) renderTray();
    if (Math.random() < 0.05) world.syncAgents();
  }
  if (saveTick > 30) { saveTick = 0; save(); }
  requestAnimationFrame(frame);
}

function start(data) {
  data = data || {};
  UI.chatOpen = window.innerWidth > 700;
  loadPrefs();
  try { R = new GL.Renderer($('#gl')); }
  catch (e) {
    document.body.insertAdjacentHTML('beforeend', `<div id="err"><div class="card panel"><h2>Can’t start the 3D view</h2><p class="lead">${esc(e.message)}</p><p>Driftwood needs WebGL 2. Try a recent version of Chrome, Edge, Firefox or Safari.</p></div></div>`);
    return;
  }
  world = new World(R);
  // settlers felling trees is part of the world; everything else the world reports is a game effect
  world.sfx = (k, ev) => k === 'chop' && ev === 'work' ? Sfx.play(k, Sfx.world) : Sfx.play(k);
  world.onThunder = (delay, strength) => Amb.thunder(delay, strength);
  let loaded = false;
  const src = data.save || readSave();
  if (src) { try { S = Sim.deserialize(src); loaded = true; } catch (e) { console.warn(e); S = null; } }
  if (!S) S = Sim.newGame((Math.random() * 2 ** 31) >>> 0);
  world.setState(S);
  cssW = $('#gl').clientWidth; cssH = $('#gl').clientHeight;
  resize();
  if (data.cam) Object.assign(cam, data.cam); else frameHall();
  if (typeof data.speed === 'number') UI.speed = data.speed;
  renderThumbs();
  bindInput();
  setTool('select');
  if (!loaded) showIntro();
  else if (S.meeting) startMeeting();
  if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
    window.claude.hot.snapshot(() => ({ save: Sim.serialize(Online.home || S), cam: { tx: cam.tx, tz: cam.tz, yaw: cam.yaw, gyaw: cam.gyaw, pitch: cam.pitch, gpitch: cam.gpitch, dist: cam.dist, gdist: cam.gdist }, speed: UI.speed }));
  }
  window.__dw = { get S() { return S; }, UI, cam, world, setTool, setSpeed, pick, project, act, Online, onlineAct, raidTap, publishIsland, Music, Sfx, Amb, cam };
  requestAnimationFrame(frame);
  $('#isles').addEventListener('click', e => { const b = e.target.closest('[data-ol]'); if (b && !b.disabled) { Sfx.init(); Sfx.play('click'); onlineAct(b.dataset.ol); } });
  $('#isles').addEventListener('change', e => { if (e.target.id === 'olFile') importFile(e.target.files && e.target.files[0]); });
  $('#away').addEventListener('click', e => { const b = e.target.closest('[data-ol]'); if (b && !b.disabled) { Sfx.init(); Sfx.play('click'); onlineAct(b.dataset.ol); } });
  $('#modal').addEventListener('input', e => {
    const k = e.target.id.startsWith('vol-') && e.target.id.slice(4); if (!k || !(k in UI)) return;
    UI[k] = clamp(+e.target.value / 100, 0, 1); Sfx.init(); Sfx.levels(); Music.update();
    const pct = $('#pct-' + k); if (pct) pct.textContent = pctText(UI[k]);
  });
  // a short sample when you let go of a slider, so you can hear the new level
  $('#modal').addEventListener('change', e => {
    const k = e.target.id.startsWith('vol-') && e.target.id.slice(4); if (!k) return;
    savePrefs();
    if (k === 'fx') Sfx.play('built'); else if (k === 'world' && Sfx.ctx && UI.world) Amb.gull(0.05);
  });
  $('#modal').addEventListener('change', e => { if (e.target.id === 'olName') renameIsland(e.target.value); if (e.target.id === 'olFile') importFile(e.target.files && e.target.files[0]); });
  onlineInit();
}
/*ONLINE*/
const hot = window.claude && window.claude.hot;
if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
