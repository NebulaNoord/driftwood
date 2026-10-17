// Driftwood on the open web: stands in for window.claude.use('db' | 'user') with a tiny API (/api/db).
// Each browser gets a secret player key; the server derives the player id from it, so nobody needs an account.
(function () {
  const KEY = 'driftwood.playerKey';
  const mem = {};
  const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return mem[k] || null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } } };
  const valid = k => typeof k === 'string' && /^dw1-[0-9a-f]{48}$/.test(k);
  let key = ls.get(KEY);
  if (!valid(key)) {
    const b = new Uint8Array(24); crypto.getRandomValues(b);
    key = 'dw1-' + [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    ls.set(KEY, key);
  }
  let idP = null;
  async function call(body) {
    const r = await fetch('/api/db', { method: 'POST', headers: { 'content-type': 'application/json', 'x-player-key': key }, body: JSON.stringify(body) });
    let out = null; try { out = await r.json(); } catch (e) {}
    if (!r.ok) { const e = new Error((out && out.error) || 'Request failed'); e.code = (out && out.code) || (r.status === 403 ? 'permission_denied' : r.status === 429 ? 'resource_exhausted' : 'unavailable'); throw e; }
    return out;
  }
  const myId = () => idP || (idP = call({ op: 'me' }).then(r => r.id).catch(e => { idP = null; throw e; }));
  const segs = p => String(p).split('/').length;
  const meta = { fromCache: false, hasPendingWrites: false };
  const snapDoc = (id, exists, data) => ({ id, exists, data: () => data, metadata: meta });
  const jsonClone = v => JSON.parse(JSON.stringify(v));
  // polling stands in for live updates; it slows down while the tab is hidden
  function poll(fn, ms) {
    let dead = false, timer = 0;
    const tick = async () => { if (dead) return; try { await fn(); } catch (e) {} if (!dead) timer = setTimeout(tick, document.hidden ? ms * 4 : ms); };
    tick();
    return () => { dead = true; clearTimeout(timer); };
  }
  function docRef(path) {
    const id = path.slice(path.lastIndexOf('/') + 1);
    const ref = {
      id, path,
      async get() { const r = await call({ op: 'get', path }); return snapDoc(id, !!r.exists, r.data); },
      async set(data) { await call({ op: 'set', path, data: jsonClone(data) }); },
      async update(data) { await call({ op: 'update', path, data: jsonClone(data) }); },
      async delete() { await call({ op: 'delete', path }); },
      onSnapshot(next, err) {
        let last = null;
        return poll(async () => { try { const s = await ref.get(); const sig = JSON.stringify([s.exists, s.data()]); if (sig !== last) { last = sig; next(s); } } catch (e) { if (err) err(e); } }, 6000);
      },
    };
    return ref;
  }
  function query(coll, filters, order, lim) {
    const run = async () => {
      const r = await call({ op: 'list', coll, limit: Math.min(lim || 200, 200), where: filters });
      let rows = r.docs || [];
      for (const [f, op, v] of filters) rows = rows.filter(d => op === '==' ? d.data[f] === v : op === '!=' ? d.data[f] !== v : op === '>' ? d.data[f] > v : op === '>=' ? d.data[f] >= v : op === '<' ? d.data[f] < v : op === '<=' ? d.data[f] <= v : true);
      if (order) rows.sort((a, b) => (a.data[order[0]] > b.data[order[0]] ? 1 : a.data[order[0]] < b.data[order[0]] ? -1 : 0) * (order[1] === 'desc' ? -1 : 1));
      if (lim) rows = rows.slice(0, lim);
      const docs = rows.map(d => snapDoc(d.id, true, d.data));
      return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: meta };
    };
    return {
      where: (f, op, v) => query(coll, filters.concat([[f, op, v]]), order, lim),
      orderBy: (f, d) => query(coll, filters, [f, d || 'asc'], lim),
      limit: n => query(coll, filters, order, n),
      get: run,
      onSnapshot(next, err) {
        let last = null;
        return poll(async () => { try { const s = await run(); const sig = JSON.stringify(s.docs.map(d => [d.id, d.data()])); if (sig !== last) { last = sig; next(s); } } catch (e) { if (err) err(e); } }, coll === 'islands' ? 15000 : 8000);
      },
      doc: id => docRef(coll + '/' + (id || Math.random().toString(36).slice(2, 12))),
      async add(data) { const r = await call({ op: 'add', coll, data: jsonClone(data) }); return docRef(coll + '/' + r.id); },
    };
  }
  const db = {
    doc(p) { if (segs(p) % 2) throw new TypeError('document path needs an even number of segments: ' + p); return docRef(p); },
    collection(c) { if (!(segs(c) % 2)) throw new TypeError('collection path needs an odd number of segments: ' + c); return query(c, [], null, 0); },
  };
  const user = {
    id: myId,
    can: async () => true, canEdit: async () => true, isOwner: async () => false,
    me: async () => ({ id: await myId(), name: '', color: '#888', email: null }),
    async profiles(ids) { const r = await call({ op: 'profiles', ids: [].concat(ids).slice(0, 100) }); return r.profiles || {}; },
  };
  window.claude = {
    web: {
      key: () => key, valid,
      setKey(k) { if (!valid(k)) return false; ls.set(KEY, k); ls.set(KEY + '.switched', '1'); location.reload(); return true; },
      switched() { const v = ls.get(KEY + '.switched') === '1'; if (v) ls.set(KEY + '.switched', ''); return v; },
    },
    use: async name => name === 'db' ? db : name === 'user' ? user : null,
  };
})();
