// Shared helpers: dates, program lookups, log data, charts.
window.Core = (function () {
  const P = window.PROGRAM;
  const S = window.Store;
  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const DAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const dayIdx = (s) => (parse(s).getDay() + 6) % 7;
  const mondayOf = (s) => addDays(s, -dayIdx(s));
  const today = () => iso(new Date());
  const fmtDate = (s, opts) => parse(s).toLocaleDateString(undefined, opts || { month: 'short', day: 'numeric' });
  const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);

  function profile() {
    return S.get('profile') || { kind: 'profile', start: mondayOf(today()), bw: null };
  }
  // Absolute week number since start (can be < 1 or > 12).
  function weekAbs(date) { return Math.floor(diffDays(profile().start, mondayOf(date)) / 7) + 1; }
  // Week inside the 12-week cycle (1–12); before the start, preview week 1.
  function weekOf(date) { const w = weekAbs(date); return w < 1 ? 1 : ((w - 1) % 12) + 1; }
  function cycleOf(date) { const w = weekAbs(date); return w < 1 ? 1 : Math.floor((w - 1) / 12) + 1; }
  function dateFor(week, d) { return addDays(profile().start, (week - 1) * 7 + d); }

  function sessionsFor(date) {
    const w = weekOf(date), d = dayIdx(date);
    const o = (P.DATE_OVERRIDES || {})[date];
    if (!o) return withRun(P.DAYS[d].map((s) => P.resolve(s, w, d, date)), date, d);
    const out = [];
    if (o.use) {
      for (const u of o.use) {
        const src = P.DAYS.findIndex((day) => day.some((s) => s.id === u.id));
        const base = P.DAYS[src].find((s) => s.id === u.id);
        const r = P.resolve(base, w, src, date);
        if (u.drop) r.blocks = r.blocks.map((b) => Object.assign({}, b, { ex: b.ex.filter((e) => !u.drop.includes(e.id)) })).filter((b) => b.ex.length || !b.title || b.testLink || b.note);
        if (u.slot) r.slot = u.slot;
        out.push(r);
      }
    } else {
      for (const s of P.DAYS[d]) if (!(o.skip || []).includes(s.id)) out.push(P.resolve(s, w, d, date));
    }
    if (o.note) out.forEach((r) => { r.blocks = [{ title: 'Schedule change', note: o.note, ex: [] }].concat(r.blocks); });
    return withRun(out, date, d);
  }

  // 100 km run challenge: km logged on the planned run sessions so far.
  function runKm(upTo) {
    const rc = P.RUN_CHALLENGE;
    if (!rc) return 0;
    let km = 0;
    for (const doc of Object.values(S.all())) {
      if (!doc || doc.kind !== 'log' || doc.sid !== 'run' || doc.date < rc.from || doc.date > rc.to || (upTo && doc.date > upTo)) continue;
      const e = doc.ex && doc.ex.easyrun;
      for (const st of (e && e.sets) || []) km += +(st && st.r) || 0;
    }
    return Math.round(km * 10) / 10;
  }
  // Adds the planned run to a day's sessions (and drops what it replaces).
  function withRun(list, date, d) {
    const rc = P.RUN_CHALLENGE, km = rc && rc.plan[date], sl = rc && rc.slots[d];
    if (!km || !sl) return list;
    let out = list.filter((s) => !(sl.skip || []).includes(s.id));
    if (sl.drop) out = out.map((s) => sl.drop[s.id] ? Object.assign({}, s, { blocks: s.blocks.filter((b) => !b.ex.length || b.ex.some((e) => !sl.drop[s.id].includes(e.id))).map((b) => Object.assign({}, b, { ex: b.ex.filter((e) => !sl.drop[s.id].includes(e.id)) })) }) : s);
    if (sl.oneSet) out = out.map((s) => sl.oneSet[s.id] ? Object.assign({}, s, { blocks: s.blocks.map((b) => Object.assign({}, b, { ex: b.ex.map((e) => sl.oneSet[s.id].includes(e.id) ? Object.assign({}, e, { sets: 1, cue: (e.cue ? e.cue + '. ' : '') + '1 set during the run challenge' }) : e) })) }) : s);
    const planned = Object.entries(rc.plan).filter(([k]) => k < date).reduce((a, [, v]) => a + v, 0);
    const done = runKm();
    const run = {
      id: 'run', slot: sl.slot, title: `Easy run, ${km} km (100 km challenge)`, mins: Math.round(km * 6),
      intro: `Frat philanthropy: ${rc.goal} km by Nov 30, tracked on Strava (walking doesn't count). ${sl.when}. Conversational pace only, about 6 min/km.`,
      blocks: [{
        title: 'Run',
        note: `Logged so far: ${done} of ${rc.goal} km (plan before today: ${planned} km). Missed a run? Spread the km over the next few runs; never on a Saturday or game day. Sharp shin or Achilles pain: stop and walk home.`,
        ex: [{ id: 'easyrun', name: 'Easy run (copy the km from Strava)', sets: 1, target: `${km} km`, type: 'r', unit: 'km', step: '0.01', cue: 'Easy enough to talk in full sentences. Short, quick steps.' }],
      }],
    };
    const at = sl.after ? out.findIndex((s) => s.id === sl.after) + 1 : 0;
    if (at > 0) return out.slice(0, at).concat([run], out.slice(at));
    return sl.first ? [run].concat(out) : out.concat([run]);
  }
  const isGameDay = (date) => dayIdx(date) === 2 && !(((P.DATE_OVERRIDES || {})[date] || {}).noGame);
  const logId = (date, sid) => 'log_' + date + '_' + sid;
  function getLog(date, sid) {
    return S.get(logId(date, sid)) || { kind: 'log', date, sid, week: weekOf(date), ex: {}, rpe: null, notes: '', done: false };
  }
  function setOf(log, exId, i) {
    const e = log.ex[exId];
    return (e && e.sets && e.sets[i]) || {};
  }
  const filled = (st) => !!(st && (st.done || st.w || st.r || st.t || st.time));
  function progress(session, log) {
    let total = 0, done = 0;
    for (const b of session.blocks) for (const e of b.ex) for (let i = 0; i < e.sets; i++) { total++; if (filled(setOf(log, e.id, i))) done++; }
    return { total, done, pct: total ? done / total : 0, complete: log.done || (total > 0 && done === total) };
  }

  function allLogs() {
    return Object.values(S.all()).filter((d) => d && d.kind === 'log').sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }
  // Most recent earlier log with data for this exercise.
  function lastFor(exId, beforeDate) {
    const logs = allLogs();
    for (let i = logs.length - 1; i >= 0; i--) {
      const l = logs[i];
      if (l.date >= beforeDate) continue;
      const e = l.ex[exId];
      if (e && e.sets && e.sets.some(filled)) return { date: l.date, sets: e.sets };
    }
    return null;
  }
  // Best result before a date: highest est. 1RM for lifts, fastest time for sprints.
  function bestBefore(exId, beforeDate) {
    let e1 = 0, time = 0;
    for (const l of allLogs()) {
      if (l.date >= beforeDate) break;
      const e = l.ex[exId];
      if (!e || !e.sets) continue;
      e.sets.forEach((s) => {
        const v = e1rm(+s.w, +s.r); if (v > e1) e1 = v;
        if (+s.time > 0 && (!time || +s.time < time)) time = +s.time;
      });
    }
    return { e1, time };
  }
  // "2–2.5 min" → 120, "90 s" → 90, "3–4 min" → 180.
  function restSeconds(rest) {
    const m = String(rest || '').match(/([\d.]+)/);
    if (!m) return 0;
    return Math.round(+m[1] * (/min/.test(rest) ? 60 : 1));
  }
  const topOfRange =(target) => { const m = String(target).match(/(\d+)\s*[–-]\s*(\d+)/); return m ? +m[2] : (String(target).match(/^\d+/) ? +String(target).match(/^\d+/)[0] : null); };
  const e1rm = (w, r) => (w > 0 && r > 0 ? w * (1 + Math.min(r, 12) / 30) : 0);

  // Exercise catalogue for charts: every weighted lift, sprint and rep drill.
  function catalogue() {
    const seen = {};
    P.DAYS.forEach((day) => day.forEach((s) => s.blocks.forEach((b) => b.ex.forEach((e) => {
      if (!seen[e.id] && (e.type === 'w' || e.type === 's' || e.id === 'jumpcheck')) seen[e.id] = e;
    }))));
    return seen;
  }

  // One point per logged session for an exercise or a test.
  function series(key) {
    if (key.startsWith('test:')) {
      const id = key.slice(5), t = P.TESTS.find((x) => x.id === id);
      const pts = Object.values(S.all()).filter((d) => d && d.kind === 'test' && d.res && +d.res[id] > 0)
        .sort((a, b) => (a.date < b.date ? -1 : 1)).map((d) => ({ date: d.date, y: +d.res[id], label: d.res[id] + ' ' + t.unit }));
      return { name: t.name, unit: t.unit, lower: !!t.lower, pts };
    }
    const e = catalogue()[key];
    const pts = [];
    for (const l of allLogs()) {
      const x = l.ex[key];
      if (!x || !x.sets) continue;
      if (e.type === 'w') {
        let best = null;
        x.sets.forEach((st) => { const v = e1rm(+st.w, +st.r); if (v && (!best || v > best.v)) best = { v, st }; });
        if (best) pts.push({ date: l.date, y: Math.round(best.v * 10) / 10, label: best.st.w + ' lb × ' + best.st.r });
      } else if (e.type === 's') {
        const times = x.sets.map((st) => +st.time).filter((v) => v > 0);
        if (times.length) pts.push({ date: l.date, y: Math.min(...times), label: Math.min(...times).toFixed(2) + ' s' });
      } else {
        const v = Math.max(0, ...x.sets.map((st) => +st.r || 0));
        if (v) pts.push({ date: l.date, y: v, label: v + ' ' + (e.unit || '') });
      }
    }
    const unit = e.type === 'w' ? 'lb est. 1RM' : e.type === 's' ? 's best rep' : (e.unit || 'reps');
    return { name: e.name, unit, lower: e.type === 's', pts };
  }

  const DAY_MS = 864e5;
  let uid = 0;
  const hatch = (id) => `<defs><pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" class="hl"/></pattern></defs>`;
  const weekInfo = (w) => ({ ph: P.phaseOf(w), dl: P.DELOAD.includes(w), test: P.TEST_WEEKS.includes(w) });

  // Phase colour behind each week of a time axis; deload weeks hatched, D/T tags on top.
  function phaseBands(t0, t1, xt, top, bottom, pid) {
    let s = '';
    const w0 = weekAbs(iso(new Date(t0))), w1 = weekAbs(iso(new Date(t1 - 1)));
    for (let w = Math.max(1, w0); w <= w1; w++) {
      const cw = ((w - 1) % 12) + 1, k = weekInfo(cw);
      const a = parse(addDays(profile().start, (w - 1) * 7)).getTime();
      const xa = xt(Math.max(a, t0)), xb = xt(Math.min(a + 7 * DAY_MS, t1));
      if (xb - xa < 0.5) continue;
      const tip = `Week ${cw} · ${P.PHASES[k.ph].name} phase${k.dl ? ' · deload' : ''}${k.test ? ' · test week' : ''}`;
      s += `<rect x="${xa.toFixed(1)}" y="${top}" width="${(xb - xa).toFixed(1)}" height="${bottom - top}" class="band p${k.ph}"><title>${esc(tip)}</title></rect>`;
      if (k.dl) s += `<rect x="${xa.toFixed(1)}" y="${top}" width="${(xb - xa).toFixed(1)}" height="${bottom - top}" fill="url(#${pid})" pointer-events="none"/>`;
      const tag = (k.dl ? 'D' : '') + (k.test ? 'T' : '');
      if (tag && xb - xa > 12) s += `<text x="${((xa + xb) / 2).toFixed(1)}" y="${top - 4}" class="tick" text-anchor="middle">${tag}</text>`;
    }
    return s;
  }

  function lineChart(ser) {
    const pts = ser.pts;
    if (!pts.length) return '<p class="empty">No entries yet. Log a session with this exercise and its line starts here.</p>';
    const W = 640, H = 240, L = 48, R = 16, T = 22, B = 34, pid = 'h' + (++uid);
    const ys = pts.map((p) => p.y);
    let lo = Math.min(...ys), hi = Math.max(...ys);
    if (lo === hi) { lo -= 1; hi += 1; }
    const padY = (hi - lo) * 0.15; lo -= padY; hi += padY;
    // Whole weeks on the x axis so the phase bands line up with the plan.
    const t0 = parse(mondayOf(pts[0].date)).getTime(), t1 = parse(addDays(mondayOf(pts[pts.length - 1].date), 7)).getTime();
    const xt = (t) => L + ((t - t0) / (t1 - t0)) * (W - L - R);
    const x = (p) => xt(parse(p.date).getTime() + DAY_MS / 2);
    const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    const ticks = [0, 0.5, 1].map((f) => lo + f * (hi - lo));
    const dec = hi - lo < 5 ? 2 : 0;
    const line = pts.map((p, i) => (i ? 'L' : 'M') + x(p).toFixed(1) + ' ' + y(p.y).toFixed(1)).join(' ');
    const last = pts[pts.length - 1];
    let svg = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(ser.name)} over time, shaded by training phase">${hatch(pid)}`;
    svg += phaseBands(t0, t1, xt, T, H - B, pid);
    ticks.forEach((v) => { svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 8}" y="${y(v) + 4}" class="tick" text-anchor="end">${v.toFixed(dec)}</text>`; });
    svg += `<text x="${L}" y="${H - 10}" class="tick">${esc(fmtDate(pts[0].date))}</text>`;
    if (pts.length > 1) svg += `<text x="${W - R}" y="${H - 10}" class="tick" text-anchor="end">${esc(fmtDate(last.date))}</text>`;
    if (pts.length > 1) svg += `<path d="${line}" class="line"/>`;
    pts.forEach((p) => {
      const cx = x(p).toFixed(1), cy = y(p.y).toFixed(1), w = weekOf(p.date);
      svg += `<g><circle cx="${cx}" cy="${cy}" r="14" class="hit"/><circle cx="${cx}" cy="${cy}" r="${p === last ? 5 : 4}" class="${p === last ? 'dot end' : 'dot'}"/><title>${esc(fmtDate(p.date))} · week ${w}: ${esc(p.label)}</title></g>`;
    });
    return svg + '</svg>';
  }

  // Tonnage (lb × reps over every weighted set) and sessions per plan week of a cycle.
  function weekVolumes(cycle) {
    const logs = allLogs(), out = [];
    for (let w = 1; w <= 12; w++) {
      const mon = dateFor(w + (cycle - 1) * 12, 0), end = addDays(mon, 7);
      let kg = 0, n = 0;
      logs.forEach((l) => {
        if (l.date < mon || l.date >= end) return;
        let any = false;
        Object.values(l.ex).forEach((e) => (e.sets || []).forEach((s) => { const v = (+s.w || 0) * (+s.r || 0); if (v) { kg += v; any = true; } }));
        if (any) n++;
      });
      out.push(Object.assign({ w, mon, kg: Math.round(kg), n }, weekInfo(w)));
    }
    return out;
  }
  const niceCeil = (v) => { const p = Math.pow(10, Math.floor(Math.log10(v))); return Math.ceil((v / p) * 2) / 2 * p; };
  const kfmt = (v) => (v >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + 'k' : String(Math.round(v)));
  // Bar with 4px rounded top, flat on the baseline.
  const barPath = (x, y, w, h) => { const r = Math.min(4, h, w / 2); return `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z`; };

  function volumeChart(rows, curWeek) {
    const max = Math.max(...rows.map((r) => r.kg));
    if (!max) return '<p class="empty">No weighted sets in this cycle yet. Each week gets a bar once you log weight and reps.</p>';
    const W = 640, H = 220, L = 48, R = 12, T = 16, B = 44, hi = niceCeil(max);
    const slot = (W - L - R) / 12, bw = Math.min(34, slot - 8), y = (v) => T + (1 - v / hi) * (H - T - B);
    let svg = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Weekly volume for weeks 1 to 12, coloured by phase">`;
    [0, 0.5, 1].forEach((f) => { const v = f * hi; svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 8}" y="${y(v) + 4}" class="tick" text-anchor="end">${kfmt(v)}</text>`; });
    const top = rows.reduce((a, r) => (r.kg > a.kg ? r : a), rows[0]);
    rows.forEach((r, i) => {
      const cx = L + slot * i + slot / 2, now = r.w === curWeek;
      if (r.kg) svg += `<path d="${barPath(cx - bw / 2, y(r.kg), bw, y(0) - y(r.kg))}" class="bar p${r.ph}${r.dl ? ' dl' : ''}"/>`;
      if (r === top) svg += `<text x="${cx}" y="${y(r.kg) - 5}" class="tick now" text-anchor="middle">${kfmt(r.kg)}</text>`;
      svg += `<text x="${cx}" y="${H - 24}" class="tick${now ? ' now' : ''}" text-anchor="middle">${r.w}</text>`;
      const tag = (r.dl ? 'D' : '') + (r.test ? 'T' : '');
      if (tag) svg += `<text x="${cx}" y="${H - 3}" class="tick" text-anchor="middle">${tag}</text>`;
      const tip = `Week ${r.w} · ${P.PHASES[r.ph].name}${r.dl ? ' · deload' : ''}: ${r.kg.toLocaleString()} lb over ${r.n} session${r.n === 1 ? '' : 's'}`;
      svg += `<rect x="${(cx - slot / 2).toFixed(1)}" y="${T}" width="${slot.toFixed(1)}" height="${H - T - 4}" class="hit"><title>${esc(tip)}</title></rect>`;
    });
    return svg + '</svg>';
  }

  // Sleep the night before and the hardest session effort, one column per day.
  function sleepEffort(endDate, days) {
    const rpe = {};
    allLogs().forEach((l) => { if (+l.rpe > 0) rpe[l.date] = Math.max(rpe[l.date] || 0, +l.rpe); });
    const rows = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = addDays(endDate, -i), dd = S.get('day_' + d);
      rows.push({ date: d, sleep: dd && +dd.sleep > 0 ? +dd.sleep : null, rpe: rpe[d] || null });
    }
    return rows;
  }
  const isFlag = (r) => r.rpe >= 8 && r.sleep != null && r.sleep < 7;

  function sleepEffortChart(rows) {
    if (!rows.some((r) => r.sleep || r.rpe)) return '<p class="empty">Log your sleep each morning and a session effort (RPE) when you finish, and both show up here day by day.</p>';
    const W = 640, L = 48, R = 12, H = 268, sT = 30, sB = 120, rT = 160, rB = 236;
    const slot = (W - L - R) / rows.length, bw = Math.max(4, slot - 6);
    const ys = (v) => sB - (v / 12) * (sB - sT), yr = (v) => rB - ((v - 1) / 9) * (rB - rT);
    let svg = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Sleep hours and session effort for the last ${rows.length} days">`;
    svg += `<text x="${L}" y="16" class="ptitle">Sleep the night before (h)</text><text x="${L}" y="${rT - 14}" class="ptitle">Hardest session that day (RPE)</text>`;
    [0, 6, 12].forEach((v) => { svg += `<line x1="${L}" x2="${W - R}" y1="${ys(v)}" y2="${ys(v)}" class="grid"/><text x="${L - 8}" y="${ys(v) + 4}" class="tick" text-anchor="end">${v}</text>`; });
    svg += `<line x1="${L}" x2="${W - R}" y1="${ys(8)}" y2="${ys(8)}" class="ref"/><text x="${W - R}" y="${ys(8) - 4}" class="tick" text-anchor="end">8 h goal</text>`;
    [1, 5, 10].forEach((v) => { svg += `<line x1="${L}" x2="${W - R}" y1="${yr(v)}" y2="${yr(v)}" class="grid"/><text x="${L - 8}" y="${yr(v) + 4}" class="tick" text-anchor="end">${v}</text>`; });
    rows.forEach((r, i) => {
      const x0 = L + slot * i, cx = x0 + slot / 2;
      if (r.sleep) svg += `<path d="${barPath(cx - bw / 2, ys(r.sleep), bw, sB - ys(r.sleep))}" class="sleep"/>`;
      if (r.rpe) svg += `<circle cx="${cx.toFixed(1)}" cy="${yr(r.rpe)}" r="5" class="rpe${isFlag(r) ? ' warn' : ''}"/>`;
      const tip = `${fmtDate(r.date, { weekday: 'short', month: 'short', day: 'numeric' })}: ${r.sleep ? r.sleep + ' h sleep' : 'no sleep logged'} · ${r.rpe ? 'RPE ' + r.rpe : 'no session effort'}${isFlag(r) ? ' · hard session on short sleep' : ''}`;
      svg += `<rect x="${x0.toFixed(1)}" y="${sT}" width="${slot.toFixed(1)}" height="${rB - sT + 6}" class="hit"><title>${esc(tip)}</title></rect>`;
    });
    svg += `<text x="${L}" y="${H - 8}" class="tick">${esc(fmtDate(rows[0].date))}</text><text x="${W - R}" y="${H - 8}" class="tick" text-anchor="end">${esc(fmtDate(rows[rows.length - 1].date))}</text>`;
    return svg + '</svg>';
  }

  return { P, S, DAY_NAMES, DAY_LONG, esc, iso, parse, addDays, dayIdx, mondayOf, today, fmtDate, diffDays,
    profile, weekAbs, weekOf, cycleOf, dateFor, sessionsFor, runKm, isGameDay, logId, getLog, setOf, filled, progress,
    allLogs, lastFor, bestBefore, restSeconds, topOfRange, e1rm, catalogue, series, lineChart, weekVolumes, volumeChart, sleepEffort, sleepEffortChart, isFlag };
})();
