// Persistence: private per-person documents in the artifact db
// (data/users/<id>/...), with a this-device copy as cache and fallback.
window.Store = (function () {
  const LS_KEY = 'andy-training-log-v1';
  const docs = {};
  const dirty = new Set();
  let col = null;
  let mode = 'local'; // 'local' | 'cloud'
  let status = 'loading';
  let ready = false; // true once the full data set is loaded (cloud: first server snapshot)
  let flushing = false;
  let timer = null;
  const listeners = [];
  const dataListeners = [];

  function readLocal() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function writeLocal() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(docs)); } catch (e) { /* storage blocked */ }
  }
  function emit() { listeners.forEach((fn) => fn()); }
  function setStatus(s) { status = s; emit(); }

  async function init() {
    Object.assign(docs, readLocal());
    let db = null, uid = null;
    try {
      if (window.claude && window.claude.use) {
        const [d, u] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
        db = d;
        uid = u ? await u.id() : null;
      }
    } catch (e) { db = null; }
    if (!db || !uid) { mode = 'local'; ready = true; setStatus('local'); return; }
    mode = 'cloud';
    col = db.collection('data/users/' + uid);
    let first = true;
    const slow = setTimeout(() => { if (first) setStatus('slow'); }, 10000);
    col.onSnapshot((snap) => {
      let changed = false;
      for (const ch of snap.docChanges()) {
        const id = ch.doc.id;
        if (dirty.has(id)) continue; // local edit wins until it's saved
        if (ch.type === 'removed') { if (docs[id]) { delete docs[id]; changed = true; } continue; }
        const body = JSON.stringify(ch.doc.data());
        if (JSON.stringify(docs[id]) !== body) { docs[id] = JSON.parse(body); changed = true; }
      }
      if (changed) dataListeners.forEach((fn) => fn());
      if (first && !snap.metadata.fromCache) {
        first = false;
        ready = true;
        clearTimeout(slow);
        // First visit on this account: carry anything logged on this device up.
        const local = readLocal();
        for (const id of Object.keys(local)) {
          if (!snap.docs.some((d) => d.id === id)) { docs[id] = local[id]; dirty.add(id); }
        }
        if (dirty.size) schedule();
        dataListeners.forEach((fn) => fn());
      }
      writeLocal();
      setStatus(dirty.size ? 'saving' : 'saved');
    }, () => { clearTimeout(slow); mode = 'local'; ready = true; setStatus('local'); dataListeners.forEach((fn) => fn()); });
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(flush, 700);
  }

  async function flush() {
    writeLocal();
    if (mode !== 'cloud') { setStatus('local'); dirty.clear(); return; }
    if (flushing) return;
    flushing = true;
    setStatus('saving');
    try {
      while (dirty.size) {
        const id = dirty.values().next().value;
        dirty.delete(id);
        const body = docs[id];
        try {
          if (body) await col.doc(id).set(body);
          else await col.doc(id).delete();
        } catch (e) {
          if (e && e.code === 'unavailable') { dirty.add(id); await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000)); }
          else if (e && e.code === 'quota_exceeded') { setStatus('full'); return; }
          else { mode = 'local'; setStatus('local'); return; }
        }
      }
      setStatus('saved');
    } finally { flushing = false; }
  }

  return {
    init,
    get: (id) => docs[id],
    all: () => docs,
    put(id, body) { docs[id] = body; dirty.add(id); writeLocal(); setStatus('saving'); schedule(); },
    remove(id) { delete docs[id]; dirty.add(id); writeLocal(); schedule(); },
    onStatus(fn) { listeners.push(fn); },
    onData(fn) { dataListeners.push(fn); },
    get status() { return status; },
    get mode() { return mode; },
    get ready() { return ready; },
  };
})();
