// App shell: state, rendering and input handling.
(function () {
  const C = window.Core, V = window.Views, S = window.Store;
  const app = document.getElementById('app');
  const st = { view: 'today', date: C.today(), sid: null, chart: null, confirmWipe: false };
  const VIEWS = ['today', 'week', 'progress', 'tests', 'daily']; // hash-routable views
  let pending = false;

  function header() {
    const w = C.weekOf(st.date), abs = C.weekAbs(C.today());
    const ph = C.P.PHASES[C.P.phaseOf(w)];
    document.getElementById('wk').textContent = abs < 1 ? 'Starts ' + C.fmtDate(C.profile().start) : 'Week ' + w + ' of 12';
    document.getElementById('ph').textContent = ph.name + ' phase';
    document.documentElement.dataset.phase = C.P.phaseOf(w); // tints the glass backdrop
    document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-current', b.dataset.view === st.view || (st.view === 'session' && b.dataset.view === 'today') ? 'page' : 'false'));
  }

  function badge() {
    const el = document.getElementById('save');
    const map = { loading: 'Loading…', saving: 'Saving…', saved: 'Saved', local: 'Saved on this device', slow: 'Can’t reach your account yet', full: 'Storage full' };
    el.textContent = map[S.status] || '';
    el.className = 'save ' + S.status;
  }

  function render() {
    pending = false;
    const y = window.scrollY;
    const fn = st.view === 'session' ? V.session : V[st.view];
    app.innerHTML = fn(st);
    header();
    badge();
    return y;
  }
  function go(view, keepScroll) {
    st.view = view; st.confirmWipe = false;
    wake(view === 'session');
    render();
    if (!keepScroll) window.scrollTo(0, 0);
    try { if (VIEWS.includes(view)) location.hash = view; } catch (e) { /* ignore */ }
  }

  function currentEx(exId) {
    const s = C.sessionsFor(st.date).find((x) => x.id === st.sid);
    if (!s) return null;
    for (const b of s.blocks) for (const e of b.ex) if (e.id === exId) return e;
    return null;
  }

  // Rest timer: starts when a set is ticked, lives outside the re-rendered area.
  const Rest = (function () {
    const box = document.getElementById('rest'), txt = document.getElementById('rest-t'), bar = document.getElementById('rest-bar');
    let end = 0, total = 0, tick = null, audio = null;
    const fmt = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    function beep() {
      try {
        audio = audio || new (window.AudioContext || window.webkitAudioContext)();
        [0, 0.25].forEach((d) => {
          const o = audio.createOscillator(), g = audio.createGain();
          o.frequency.value = 880; g.gain.value = 0.15;
          o.connect(g); g.connect(audio.destination);
          o.start(audio.currentTime + d); o.stop(audio.currentTime + d + 0.15);
        });
      } catch (e) { /* no audio */ }
      try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { /* no vibration */ }
    }
    function draw() {
      const left = Math.max(0, Math.round((end - Date.now()) / 1000));
      txt.textContent = left ? 'Rest ' + fmt(left) : 'Go: next set';
      bar.style.width = (total ? (left / total) * 100 : 0) + '%';
      box.classList.toggle('over', !left);
      if (!left) { clearInterval(tick); tick = null; beep(); setTimeout(() => { if (!tick) box.hidden = true; }, 8000); }
    }
    function start(sec, name) {
      if (!sec) return;
      try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* no audio */ }
      total = sec; end = Date.now() + sec * 1000;
      document.getElementById('rest-n').textContent = name;
      box.hidden = false;
      clearInterval(tick); tick = setInterval(draw, 250); draw();
    }
    document.getElementById('rest-add').addEventListener('click', () => { end += 15000; total += 15; if (!tick) { box.hidden = false; tick = setInterval(draw, 250); } draw(); });
    document.getElementById('rest-skip').addEventListener('click', () => { clearInterval(tick); tick = null; box.hidden = true; });
    return { start };
  })();

  // How-to sheet: steps for an exercise, test or daily routine.
  const Sheet = (function () {
    const box = document.getElementById('sheet');
    let opener = null;
    function close() { box.hidden = true; document.body.classList.remove('locked'); if (opener) opener.focus(); }
    function open(key, title, sub, from) {
      const g = (window.GUIDE || {})[key] || ['No guide for this one yet. Follow the cue under its name.'];
      const e = currentEx(key);
      document.getElementById('sheet-title').textContent = title || '';
      document.getElementById('sheet-sub').textContent = sub || '';
      const cue = document.getElementById('sheet-cue');
      cue.textContent = e && e.cue ? 'Coach’s cue: ' + e.cue : '';
      cue.hidden = !(e && e.cue);
      const ol = document.getElementById('sheet-steps');
      ol.textContent = '';
      const warn = g.find((s) => s.startsWith('!'));
      g.filter((s) => !s.startsWith('!')).forEach((s) => { const li = document.createElement('li'); li.textContent = s; ol.appendChild(li); });
      const w = document.getElementById('sheet-warn');
      w.hidden = !warn;
      w.textContent = warn ? warn.slice(1) : '';
      opener = from || null;
      box.hidden = false;
      document.body.classList.add('locked');
      document.getElementById('sheet-close').focus();
    }
    box.addEventListener('click', (ev) => { if (ev.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !box.hidden) close(); });
    return { open };
  })();

  // Keep the screen on while a session is open.
  let lock = null;
  async function wake(on) {
    try {
      if (on && !lock && navigator.wakeLock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); }
      if (!on && lock) { await lock.release(); lock = null; }
    } catch (e) { lock = null; }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && st.view === 'session') wake(true); });

  async function exportCsv() {
    const msg = document.getElementById('export-msg');
    const cat = {};
    C.P.DAYS.forEach((d) => d.forEach((s) => s.blocks.forEach((b) => b.ex.forEach((e) => { cat[e.id] = e.name; }))));
    const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const rows = [['date', 'week', 'session', 'exercise', 'set', 'lb', 'reps', 'seconds', 'sprint_time_s', 'done', 'session_rpe', 'notes']];
    C.allLogs().forEach((l) => {
      const sname = (C.P.DAYS.flat().find((s) => s.id === l.sid) || {}).title || l.sid;
      Object.keys(l.ex).forEach((id) => (l.ex[id].sets || []).forEach((s, i) => {
        if (C.filled(s)) rows.push([l.date, l.week, sname, cat[id] || id, i + 1, s.w, s.r, s.t, s.time, s.done ? 'yes' : '', l.rpe, l.notes]);
      }));
    });
    Object.values(S.all()).filter((d) => d && d.kind === 'test').forEach((d) => Object.keys(d.res || {}).forEach((k) => {
      const t = C.P.TESTS.find((x) => x.id === k);
      rows.push([d.date, d.week, 'Test battery', t ? t.name + ' (' + t.unit + ')' : k, 1, '', '', '', d.res[k], 'yes', '', '']);
    }));
    const csv = rows.map((r) => r.map(q).join(',')).join('\r\n');
    const r = await saveFile('training-log-' + C.today() + '.csv', csv, 'text/csv');
    msg.textContent = r === 'saved' ? 'Saved ' + (rows.length - 1) + ' rows.' : r === 'cancelled' ? 'Download cancelled.' : 'Couldn’t save the file right now. Try again in a moment.';
  }

  // Save a text file: Claude downloads inside claude.ai, the share sheet on a phone
  // ("Save to Files"), otherwise a normal browser download.
  async function saveFile(name, text, type) {
    try {
      if (window.claude && window.claude.use) {
        const dl = await window.claude.use('downloads');
        if (dl) { await dl.save({ filename: name, data: text }); return 'saved'; }
      }
    } catch (e) { return e && e.code === 'declined' ? 'cancelled' : 'error'; }
    try {
      const file = new File([text], name, { type });
      if (matchMedia('(pointer: coarse)').matches && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return 'saved';
      }
      const url = URL.createObjectURL(file), a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return 'saved';
    } catch (e) { return e && e.name === 'AbortError' ? 'cancelled' : 'error'; }
  }

  // Units: weights were logged in kg until Nov 2026, now lb. profile.unit === 'lb' marks
  // data that is already converted; anything without it is converted once.
  const LB = 2.20462, toLb = (v) => Math.round(+v * LB * 2) / 2;
  function docToLb(d) {
    if (!d || typeof d !== 'object') return d;
    const c = JSON.parse(JSON.stringify(d));
    if (c.kind === 'log' && c.ex) Object.values(c.ex).forEach((e) => (e && e.sets || []).forEach((s) => { if (s && +s.w > 0) s.w = toLb(s.w); }));
    if (c.kind === 'test' && c.res && +c.res.rm > 0) c.res.rm = toLb(c.res.rm);
    if (c.kind === 'profile') { if (+c.bw > 0) c.bw = toLb(c.bw); c.unit = 'lb'; }
    return c;
  }
  function migrateUnits() {
    if (!S.ready) return false;
    const p = S.get('profile');
    if (p && p.unit === 'lb') return false;
    Object.keys(S.all()).forEach((id) => {
      if (id === 'profile') return;
      const d = S.get(id), c = docToLb(d);
      if (JSON.stringify(c) !== JSON.stringify(d)) S.put(id, c);
    });
    S.put('profile', docToLb(Object.assign({}, C.profile(), { kind: 'profile' })));
    return true;
  }

  // Full backup: every stored document as one JSON file.
  const BACKUP_APP = 'andy-training-log';
  const DOC_ID = /^(profile|log_\d{4}-\d{2}-\d{2}_[\w-]{1,40}|test_\d{4}-\d{2}-\d{2}|day_\d{4}-\d{2}-\d{2}|sprint_\d{4}-\d{2}-\d{2}_[\w-]{1,40})$/;
  async function backup() {
    const msg = document.getElementById('backup-msg');
    const docs = S.all(), n = Object.keys(docs).length;
    const text = JSON.stringify({ app: BACKUP_APP, version: 1, saved: new Date().toISOString(), docs });
    const r = await saveFile('training-log-backup-' + C.today() + '.json', text, 'application/json');
    msg.textContent = r === 'saved' ? 'Backup saved (' + n + ' entries).' : r === 'cancelled' ? 'Backup cancelled.' : 'Couldn’t save the backup. Try again in a moment.';
  }
  async function restore(input) {
    const msg = document.getElementById('backup-msg'), f = input.files && input.files[0];
    input.value = '';
    if (!f) return;
    if (f.size > 5e6) { msg.textContent = 'That file is too big to be a Training Log backup.'; return; }
    let data;
    try { data = JSON.parse(await f.text()); } catch (e) { msg.textContent = 'That file isn’t a Training Log backup.'; return; }
    if (!data || data.app !== BACKUP_APP || !data.docs || typeof data.docs !== 'object') { msg.textContent = 'That file isn’t a Training Log backup.'; return; }
    let added = 0, kept = 0;
    const kg = !(data.docs.profile && data.docs.profile.unit === 'lb'); // backup made before the switch to lb
    Object.keys(data.docs).forEach((id) => {
      let d = data.docs[id];
      if (!DOC_ID.test(id) || !d || typeof d !== 'object' || Array.isArray(d) || typeof d.kind !== 'string') return;
      if (kg || id === 'profile') d = kg ? docToLb(d) : Object.assign({}, d, { unit: 'lb' });
      const cur = S.get(id);
      if (cur && +cur.updated > (+d.updated || 0)) { kept++; return; } // newer edit on this device wins
      S.put(id, d); added++;
    });
    render();
    const m = document.getElementById('backup-msg');
    if (m) m.textContent = added ? 'Restored ' + added + ' entries' + (kept ? ' (kept ' + kept + ' newer ones already here).' : '.') : 'Nothing to restore from that file.';
  }

  // Log editing --------------------------------------------------------------
  function editLog(fn) {
    const log = JSON.parse(JSON.stringify(C.getLog(st.date, st.sid)));
    fn(log);
    log.week = C.weekOf(st.date);
    log.updated = Date.now();
    S.put(C.logId(st.date, st.sid), log);
    return log;
  }
  function setField(log, ex, i, f, v) {
    log.ex[ex] = log.ex[ex] || { sets: [] };
    const sets = log.ex[ex].sets;
    while (sets.length <= i) sets.push({});
    if (v === '' || v == null) delete sets[i][f]; else sets[i][f] = v;
  }

  app.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-act]');
    if (!b || b.tagName === 'SELECT' || b.tagName === 'TEXTAREA') return;
    const a = b.dataset.act;
    if (a === 'date') { st.date = b.dataset.date; render(); }
    else if (a === 'open') { if (b.dataset.date) st.date = b.dataset.date; st.sid = b.dataset.sid; go('session'); }
    else if (a === 'back') { go(st.view === 'settings' ? (st.prev || 'today') : 'today'); }
    else if (a === 'view') go(b.dataset.view);
    else if (a === 'week') { st.date = C.dateFor(+b.dataset.week + (C.cycleOf(st.date) - 1) * 12, C.dayIdx(st.date)); render(); }
    else if (a === 'tick') {
      const exId = b.dataset.ex, i = +b.dataset.set, e = currentEx(exId);
      let turnedOn = false;
      editLog((log) => {
        const cur = C.setOf(log, exId, i);
        turnedOn = !cur.done;
        setField(log, exId, i, 'done', turnedOn ? true : '');
        // Empty set ticked: fill it from the hint shown in its boxes.
        if (turnedOn && e && e.type !== 'x' && !(cur.w || cur.r || cur.t || cur.time)) {
          const hint = V.hintFor(log, e, i, C.lastFor(exId, st.date));
          ['w', 'r', 't', 'time'].forEach((f) => { if (hint[f]) setField(log, exId, i, f, hint[f]); });
        }
      });
      render();
      if (turnedOn && e) Rest.start(C.restSeconds(e.rest), e.name);
    }
    else if (a === 'how') Sheet.open(b.dataset.key, b.dataset.title, b.dataset.sub, b);
    else if (a === 'shift') { st.date = C.addDays(st.date, +b.dataset.days); render(); }
    else if (a === 'export') exportCsv();
    else if (a === 'backup') backup();
    else if (a === 'complete') { editLog((log) => { log.done = !log.done; }); render(); }
    else if (a === 'habit') {
      const id = 'day_' + st.date, doc = Object.assign({ kind: 'day', date: st.date, h: {} }, S.get(id));
      doc.h = Object.assign({}, doc.h); doc.h[b.dataset.h] = !doc.h[b.dataset.h];
      S.put(id, doc);
      b.classList.toggle('on', !!doc.h[b.dataset.h]); b.setAttribute('aria-pressed', !!doc.h[b.dataset.h]);
    }
    else if (a === 'wipe') { st.confirmWipe = true; render(); }
    else if (a === 'wipe-no') { st.confirmWipe = false; render(); }
    else if (a === 'wipe-yes') { Object.keys(S.all()).forEach((id) => S.remove(id)); S.put('profile', { kind: 'profile', start: C.mondayOf(C.today()), bw: null, unit: 'lb' }); st.confirmWipe = false; render(); }
  });

  app.addEventListener('input', (ev) => {
    const t = ev.target, d = t.dataset;
    if (d.ex && d.f) {
      const v = t.value === '' ? '' : Math.max(0, +t.value);
      editLog((log) => setField(log, d.ex, +d.set, d.f, v));
    } else if (d.act === 'notes') editLog((log) => { log.notes = t.value.slice(0, 2000); });
    else if (d.test) {
      const id = 'test_' + st.date, doc = Object.assign({ kind: 'test', date: st.date, res: {} }, S.get(id));
      doc.res = Object.assign({}, doc.res);
      if (t.value === '') delete doc.res[d.test]; else doc.res[d.test] = Math.max(0, +t.value);
      doc.week = C.weekOf(st.date);
      S.put(id, doc);
    } else if (d.sleep) {
      const id = 'day_' + st.date, doc = Object.assign({ kind: 'day', date: st.date, h: {} }, S.get(id));
      doc.sleep = t.value === '' ? null : Math.min(14, Math.max(0, +t.value));
      S.put(id, doc);
    }
  });

  app.addEventListener('change', (ev) => {
    const t = ev.target, d = t.dataset;
    if (d.act === 'restore') restore(t);
    else if (d.act === 'rpe') editLog((log) => { log.rpe = t.value ? +t.value : null; });
    else if (d.act === 'chart') { st.chart = t.value; render(); }
    else if (d.setProfile) {
      const p = Object.assign({}, C.profile());
      if (d.setProfile === 'start' && /^\d{4}-\d{2}-\d{2}$/.test(t.value)) p.start = C.mondayOf(t.value);
      if (d.setProfile === 'bw') p.bw = t.value ? Math.max(0, +t.value) : null;
      S.put('profile', p);
      render();
    } else if (d.test) render();
  });

  // Re-render for remote changes only when nobody is typing.
  app.addEventListener('focusout', () => { setTimeout(() => { if (pending && !isTyping()) render(); }, 0); });
  const isTyping = () => { const a = document.activeElement; return a && /INPUT|TEXTAREA|SELECT/.test(a.tagName); };

  document.querySelector('.tabs').addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-view]');
    if (b) go(b.dataset.view);
  });
  document.getElementById('gear').addEventListener('click', () => { st.prev = st.view === 'settings' ? st.prev : st.view; go('settings'); });

  S.onStatus(badge);
  S.onData(() => { migrateUnits(); if (isTyping()) pending = true; else render(); });

  const h = (location.hash || '').slice(1);
  if (VIEWS.includes(h)) st.view = h;
  window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (VIEWS.includes(v) && v !== st.view) go(v); });
  render();
  S.init().then(() => { if (migrateUnits()) render(); });
})();
