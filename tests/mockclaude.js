// Test-only stand-in for window.claude.use('db' | 'user'). Two browser contexts share one store through
// window.__mockStore (exposed by the test harness); opened by hand it falls back to localStorage.
(function () {
  const params = new URLSearchParams(location.search);
  const uid = params.get('uid') || 'player-one';
  const NAMES = { 'player-one': 'Kayden', 'player-two': 'Freya', 'player-three': 'Ollie' };
  const local = { load() { try { return JSON.parse(localStorage.getItem('mockdb') || '{}'); } catch (e) { return {}; } }, save(o) { localStorage.setItem('mockdb', JSON.stringify(o)); } };
  async function call(op, arg) {
    if (window.__mockStore) return JSON.parse(await window.__mockStore(JSON.stringify(Object.assign({ op }, arg))));
    const st = local.load();
    if (op === 'get') return st[arg.path] ? { exists: true, data: st[arg.path] } : { exists: false };
    if (op === 'set') { st[arg.path] = arg.data; local.save(st); return {}; }
    if (op === 'delete') { delete st[arg.path]; local.save(st); return {}; }
    if (op === 'list') return Object.keys(st).filter(p => p.slice(0, p.lastIndexOf('/')) === arg.coll).map(p => ({ id: p.slice(p.lastIndexOf('/') + 1), data: st[p] }));
  }
  const snapDoc = (id, r) => ({ id, exists: !!r.exists, data: () => r.data, metadata: { fromCache: false, hasPendingWrites: false } });
  const kick = new Set();
  function query(coll, filters, order, lim) {
    const run = async () => {
      let rows = await call('list', { coll });
      for (const [f, op, v] of filters) rows = rows.filter(r => op === '==' ? r.data[f] === v : op === '!=' ? r.data[f] !== v : true);
      if (order) rows.sort((a, b) => (a.data[order[0]] > b.data[order[0]] ? 1 : -1) * (order[1] === 'desc' ? -1 : 1));
      if (lim) rows = rows.slice(0, lim);
      const docs = rows.map(r => snapDoc(r.id, { exists: true, data: r.data }));
      return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } };
    };
    return {
      where: (f, op, v) => query(coll, filters.concat([[f, op, v]]), order, lim),
      orderBy: (f, d) => query(coll, filters, [f, d || 'asc'], lim),
      limit: n => query(coll, filters, order, n),
      get: run,
      onSnapshot(next) {
        let last = '', dead = false;
        const tick = async () => { if (dead) return; const s = await run(); const sig = JSON.stringify(s.docs.map(d => [d.id, d.data()])); if (sig !== last) { last = sig; next(s); } };
        tick(); const iv = setInterval(tick, 500); kick.add(tick);
        return () => { dead = true; clearInterval(iv); kick.delete(tick); };
      },
      doc: id => docRef(coll + '/' + (id || Math.random().toString(36).slice(2, 12))),
      add: async data => { const r = docRef(coll + '/' + Math.random().toString(36).slice(2, 12)); await r.set(data); return r; },
    };
  }
  const poke = () => kick.forEach(f => f());
  function docRef(path) {
    return {
      id: path.slice(path.lastIndexOf('/') + 1), path,
      get: async () => snapDoc(path.slice(path.lastIndexOf('/') + 1), await call('get', { path })),
      set: async data => { if (window.__mockDeny && path.startsWith('islands/')) throw { code: 'invalid_argument', message: 'denied' }; await call('set', { path, data: JSON.parse(JSON.stringify(data)) }); poke(); },
      update: async data => { const cur = await call('get', { path }); if (!cur.exists) throw { code: 'invalid_argument' }; await call('set', { path, data: Object.assign({}, cur.data, data) }); poke(); },
      delete: async () => { await call('delete', { path }); poke(); },
      onSnapshot(next) { let last = ''; const tick = async () => { const r = await call('get', { path }); const s = JSON.stringify(r); if (s !== last) { last = s; next(snapDoc(path, r)); } }; tick(); const iv = setInterval(tick, 500); return () => clearInterval(iv); },
    };
  }
  const segs = p => String(p).split('/').length;
  const db = { doc: p => { if (segs(p) % 2) throw new TypeError('document path needs an even number of segments: ' + p); return docRef(p); },
    collection: c => { if (!(segs(c) % 2)) throw new TypeError('collection path needs an odd number of segments: ' + c); return query(c, [], null, 0); } };
  const user = {
    id: async () => uid, isOwner: async () => uid === 'player-one', canEdit: async () => true, can: async () => params.get('can') === '0' ? false : true,
    me: async () => ({ id: uid, name: NAMES[uid] || uid, color: '#888', email: null }),
    profiles: async ids => { const o = {}; for (const id of [].concat(ids)) o[id] = { id, name: NAMES[id] || '', color: '#888', email: null, guest: false }; return o; },
  };
  window.claude = { use: async name => name === 'db' ? db : name === 'user' ? user : null };
})();
