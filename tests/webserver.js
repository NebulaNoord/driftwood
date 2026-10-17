// Local stand-in for Vercel + Upstash: serves web/public, routes /api/db to the real handler, and fakes the Redis REST API in memory.
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = +(process.argv[2] || 8787);
process.env.UPSTASH_REDIS_REST_URL = `http://127.0.0.1:${PORT}/__redis`; process.env.UPSTASH_REDIS_REST_TOKEN = 'test';
const handler = require('../api/db.js');
const kv = new Map(), zs = new Map(), exp = new Map();
const live = k => { if (exp.has(k) && exp.get(k) < Date.now()) { kv.delete(k); exp.delete(k); } return kv.get(k); };
function cmd(c) {
  const [op, ...a] = c; const k = a[0];
  switch (op.toUpperCase()) {
    case 'GET': return live(k) ?? null;
    case 'SET': kv.set(k, a[1]); if (a[2] === 'EX') exp.set(k, Date.now() + a[3] * 1000); else exp.delete(k); return 'OK';
    case 'MGET': return a.map(x => live(x) ?? null);
    case 'DEL': { const had = kv.delete(k); return had ? 1 : 0; }
    case 'EXISTS': return live(k) != null ? 1 : 0;
    case 'INCR': { const v = (+live(k) || 0) + 1; kv.set(k, String(v)); return v; }
    case 'EXPIRE': exp.set(k, Date.now() + a[1] * 1000); return 1;
    case 'ZADD': { const z = zs.get(k) || new Map(); z.set(a[2], +a[1]); zs.set(k, z); return 1; }
    case 'ZREM': { const z = zs.get(k); let n = 0; if (z) for (const m of a.slice(1)) n += z.delete(m) ? 1 : 0; return n; }
    case 'ZCARD': return (zs.get(k) || new Map()).size;
    case 'ZRANGE': { const z = [...(zs.get(k) || new Map())].sort((x, y) => x[1] - y[1]).map(x => x[0]); if (a.includes('REV')) z.reverse(); const s = +a[1], e = +a[2]; return z.slice(s, e < 0 ? z.length + e + 1 : e + 1); }
    case 'ZREMRANGEBYRANK': { const z = zs.get(k); if (!z) return 0; const arr = [...z].sort((x, y) => x[1] - y[1]); const s = +a[1], e = +a[2] < 0 ? arr.length + +a[2] : +a[2]; let n = 0; for (let i = Math.max(0, s); i <= e && i < arr.length; i++) { z.delete(arr[i][0]); n++; } return n; }
  }
  throw new Error('fake redis: unsupported ' + op);
}
const stats = { calls: 0, bytes: 0 };
http.createServer(async (req, res) => {
  if (req.url.startsWith('/__redis/pipeline')) { let raw = ''; for await (const c of req) raw += c; const out = JSON.parse(raw).map(c => { try { return { result: cmd(c) }; } catch (e) { return { error: e.message }; } }); res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(out)); }
  if (req.url === '/__stats') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ stats, keys: [...kv.keys()].filter(k => !k.startsWith('rl:')), z: Object.fromEntries([...zs].map(([k, z]) => [k, z.size])) })); }
  if (req.url.startsWith('/api/db')) { stats.calls++; const end = res.end.bind(res); res.end = b => { stats.bytes += b ? b.length : 0; return end(b); }; return handler(req, res); }
  const f = path.join(__dirname, '../public', req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if (e) { res.statusCode = 404; return res.end('not found'); } res.setHeader('content-type', f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream'); res.end(d); });
}).listen(PORT, () => console.log('listening', PORT));
