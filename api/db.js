// Driftwood's shared store: one small endpoint backed by Upstash Redis (add it from the Vercel Marketplace).
// Players are anonymous. Each browser keeps a secret key; the player id is a hash of it, so the server stores no accounts.
//
// Who can do what (mirrors the rules the Claude artifact version uses):
//   islands/<id>          anyone reads; only player <id> writes or deletes
//   raids/<auto id>       anyone reads; anyone may log a raid they led (attacker must be them); nobody edits
//   data/users/<id>/<doc> only player <id> reads or writes (private saves)
const crypto = require('crypto');

const R_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const R_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const MAX_DOC = 240 * 1024;           // bytes of JSON per document
const MAX_SAVES = 80;                  // private saves per player
const RAID_KEEP = 600;                 // newest raid reports kept
const RAID_TTL = 60 * 60 * 24 * 30;    // raid reports expire after 30 days
const SEG = /^[A-Za-z0-9_-]{1,64}$/;

async function redis(cmds) {
  if (!R_URL || !R_TOKEN) { const e = new Error('The game store isn’t set up yet. Add Upstash Redis to this Vercel project.'); e.status = 503; throw e; }
  const r = await fetch(R_URL.replace(/\/$/, '') + '/pipeline', { method: 'POST', headers: { Authorization: 'Bearer ' + R_TOKEN, 'content-type': 'application/json' }, body: JSON.stringify(cmds) });
  if (!r.ok) { const e = new Error('Store error ' + r.status); e.status = 502; throw e; }
  const out = await r.json();
  return out.map(x => { if (x && x.error) { const e = new Error(x.error); e.status = 502; throw e; } return x ? x.result : null; });
}
const parse = v => { if (v == null) return null; try { return JSON.parse(v); } catch (e) { return null; } };
const fail = (status, error, code) => Object.assign(new Error(error), { status, code });

function playerId(key) {
  if (typeof key !== 'string' || !/^dw1-[0-9a-f]{48}$/.test(key)) return null;
  return 'p' + crypto.createHash('sha256').update('driftwood:' + key).digest('hex').slice(0, 24);
}
function splitPath(p, wantDoc) {
  if (typeof p !== 'string' || p.length > 300) throw fail(400, 'Bad path', 'invalid_argument');
  const s = p.split('/');
  if (!s.every(x => SEG.test(x)) || (s.length % 2 === 0) !== wantDoc) throw fail(400, 'Bad path', 'invalid_argument');
  return s;
}
// read and write rules
function canRead(s, me) {
  if (s[0] === 'islands' && s.length <= 2) return true;
  if (s[0] === 'raids' && s.length <= 2) return true;
  if (s[0] === 'data' && s[1] === 'users' && s[2] === me && s.length <= 4) return true;
  return false;
}
function canWrite(s, me) {
  if (s[0] === 'islands' && s.length === 2) return s[1] === me;
  if (s[0] === 'data' && s[1] === 'users' && s[2] === me && s.length === 4) return true;
  return false;
}
// a few writes a second is plenty for the game; this keeps a runaway script from filling the store
async function limit(me, kind, max, windowS) {
  const k = `rl:${kind}:${me}:${Math.floor(Date.now() / 1000 / windowS)}`;
  const [n] = await redis([['INCR', k], ['EXPIRE', k, windowS * 2]]);
  if (n > max) throw fail(429, 'Slow down a little.', 'resource_exhausted');
}
const docKey = p => 'd:' + p, colKey = c => 'c:' + c;
const collOf = s => s.slice(0, -1).join('/');
// the islands list leaves out the big map so the browse panel stays light; visiting fetches the full island
const lite = (coll, d) => { if (coll !== 'islands' || !d) return d; const o = Object.assign({}, d); delete o.z; delete o.save; return o; };

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  let raw = ''; for await (const c of req) { raw += c; if (raw.length > MAX_DOC * 1.5) throw fail(413, 'Too big', 'invalid_argument'); }
  return raw ? JSON.parse(raw) : {};
}

async function handle(b, me) {
  const op = b.op;
  if (op === 'me') { if (!R_URL || !R_TOKEN) throw fail(503, 'The game store isn’t set up yet. Add Upstash Redis to this Vercel project.', 'unavailable'); return { id: me }; }

  if (op === 'get') {
    const s = splitPath(b.path, true);
    if (!canRead(s, me)) throw fail(403, 'Not allowed', 'permission_denied');
    const [v] = await redis([['GET', docKey(b.path)]]);
    const d = parse(v);
    return d ? { exists: true, data: d } : { exists: false };
  }

  if (op === 'list') {
    const s = splitPath(b.coll, false);
    if (!canRead(s, me)) throw fail(403, 'Not allowed', 'permission_denied');
    const n = Math.max(1, Math.min(200, b.limit | 0 || 200));
    const [ids] = await redis([['ZRANGE', colKey(b.coll), 0, n - 1, 'REV']]);
    if (!ids || !ids.length) return { docs: [] };
    const [vals] = await redis([['MGET', ...ids.map(id => docKey(b.coll + '/' + id))]]);
    const docs = [], gone = [];
    ids.forEach((id, i) => { const d = parse(vals[i]); if (d) docs.push({ id, data: lite(b.coll, d) }); else gone.push(id); });
    if (gone.length) await redis([['ZREM', colKey(b.coll), ...gone]]);
    return { docs };
  }

  if (op === 'set' || op === 'update') {
    const s = splitPath(b.path, true);
    if (!canWrite(s, me)) throw fail(403, 'Not allowed', 'permission_denied');
    if (!b.data || typeof b.data !== 'object' || Array.isArray(b.data)) throw fail(400, 'Bad data', 'invalid_argument');
    await limit(me, 'w', 40, 60);
    let data = b.data;
    if (op === 'update') {
      const [v] = await redis([['GET', docKey(b.path)]]); const cur = parse(v);
      if (!cur) throw fail(404, 'No such document', 'not_found');
      data = Object.assign(cur, b.data);
    }
    const json = JSON.stringify(data);
    if (json.length > MAX_DOC) throw fail(413, 'That island is too big to store.', 'invalid_argument');
    const coll = collOf(s);
    if (s[0] === 'data') {
      const [count, exists] = await redis([['ZCARD', colKey(coll)], ['EXISTS', docKey(b.path)]]);
      if (!exists && count >= MAX_SAVES) throw fail(409, `You can keep up to ${MAX_SAVES} saved islands. Delete one first.`, 'resource_exhausted');
    }
    await redis([['SET', docKey(b.path), json], ['ZADD', colKey(coll), Date.now(), s[s.length - 1]]]);
    return {};
  }

  if (op === 'delete') {
    const s = splitPath(b.path, true);
    if (!canWrite(s, me)) throw fail(403, 'Not allowed', 'permission_denied');
    await redis([['DEL', docKey(b.path)], ['ZREM', colKey(collOf(s)), s[s.length - 1]]]);
    return {};
  }

  if (op === 'add') {
    // only raid reports are added this way
    if (b.coll !== 'raids') throw fail(403, 'Not allowed', 'permission_denied');
    const d = b.data;
    if (!d || typeof d !== 'object' || d.attacker !== me || typeof d.target !== 'string' || !SEG.test(d.target) || d.target === me) throw fail(403, 'You can only report raids you led.', 'permission_denied');
    await limit(me, 'raid', 1, 45);
    const loot = d.loot || {};
    const clean = {
      attacker: me, target: d.target, at: Date.now(),
      loot: { gold: Math.max(0, Math.min(5000, Math.floor(+loot.gold || 0))), wood: Math.max(0, Math.min(5000, Math.floor(+loot.wood || 0))), stone: Math.max(0, Math.min(5000, Math.floor(+loot.stone || 0))) },
      lost: Math.max(0, Math.min(999, Math.floor(+d.lost || 0))), downs: Math.max(0, Math.min(999, Math.floor(+d.downs || 0))),
      burnt: Array.isArray(d.burnt) ? d.burnt.slice(0, 6).map(n => Math.max(0, Math.floor(+n || 0))) : [],
      breaches: Math.max(0, Math.min(999, Math.floor(+d.breaches || 0))),
      attackerName: String(d.attackerName || '').slice(0, 40), targetName: String(d.targetName || '').slice(0, 40),
    };
    const id = crypto.randomBytes(8).toString('hex');
    await redis([
      ['SET', docKey('raids/' + id), JSON.stringify(clean), 'EX', RAID_TTL],
      ['ZADD', colKey('raids'), clean.at, id],
      ['ZREMRANGEBYRANK', colKey('raids'), 0, -RAID_KEEP - 1],
    ]);
    return { id };
  }

  if (op === 'profiles') {
    const ids = (Array.isArray(b.ids) ? b.ids : []).filter(x => typeof x === 'string' && SEG.test(x)).slice(0, 100);
    if (!ids.length) return { profiles: {} };
    const [vals] = await redis([['MGET', ...ids.map(id => docKey('islands/' + id))]]);
    const profiles = {};
    ids.forEach((id, i) => { const d = parse(vals[i]); profiles[id] = { id, name: d && d.name ? String(d.name).slice(0, 40) : '', color: '#888', email: null, guest: true }; });
    return { profiles };
  }

  throw fail(400, 'Unknown request', 'invalid_argument');
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.statusCode = 405; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ error: 'POST only' })); return; }
  const send = (status, obj) => { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); };
  try {
    const me = playerId(req.headers['x-player-key']);
    if (!me) return send(401, { error: 'Missing player key', code: 'unauthenticated' });
    const body = await readBody(req);
    send(200, await handle(body, me));
  } catch (e) {
    send(e.status || 500, { error: e.status ? e.message : 'Server error', code: e.code || 'internal' });
    if (!e.status) console.error(e);
  }
};
module.exports._test = { playerId, canRead, canWrite };
