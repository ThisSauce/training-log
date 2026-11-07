// Views: each returns an HTML string for the main area.
window.Views = (function () {
  const C = window.Core, P = C.P, esc = C.esc;

  function pill(pr, optional) {
    if (pr.complete) return '<span class="pill done">Done</span>';
    if (pr.done) return `<span class="pill part">${pr.done}/${pr.total} sets</span>`;
    return `<span class="pill">${optional ? 'Optional' : 'To do'}</span>`;
  }

  function weekStrip(sel) {
    const mon = C.mondayOf(sel), t = C.today();
    let h = `<div class="wnav"><button class="arrow" data-act="shift" data-days="-7" aria-label="Previous week">‹</button>
      <span>${esc(C.fmtDate(mon))} – ${esc(C.fmtDate(C.addDays(mon, 6)))} · week ${C.weekOf(sel)}</span>
      <button class="arrow" data-act="shift" data-days="7" aria-label="Next week">›</button>
      ${sel !== t ? '<button class="btn small" data-act="date" data-date="' + t + '">Today</button>' : ''}</div>`;
    h += '<div class="strip" role="tablist" aria-label="Days of the week">';
    for (let d = 0; d < 7; d++) {
      const date = C.addDays(mon, d);
      const ss = C.sessionsFor(date);
      const prs = ss.filter((s) => !s.optional).map((s) => C.progress(s, C.getLog(date, s.id)));
      const all = prs.length && prs.every((p) => p.complete), some = prs.some((p) => p.done);
      h += `<button class="day${date === sel ? ' sel' : ''}${date === t ? ' now' : ''}" data-act="date" data-date="${date}" role="tab" aria-selected="${date === sel}">
        <span class="dn">${C.DAY_NAMES[d]}</span><span class="dd">${C.parse(date).getDate()}</span>
        <span class="mark ${all ? 'full' : some ? 'half' : ''}"></span>${d === 2 ? '<span class="gm">Game</span>' : ''}</button>`;
    }
    return h + '</div>';
  }

  function banners(date, s) {
    const w = C.weekOf(date);
    let h = '';
    if (s && s.test) h += '<div class="banner test">Test week. Run the test battery before lifting, then finish the lifts at RPE 7.</div>';
    if (P.DELOAD.includes(w)) h += '<div class="banner">Deload week. Sets are cut by about a third; keep the weights and speed.</div>';
    return h;
  }

  function today(st) {
    const date = st.date;
    const ss = C.sessionsFor(date);
    let h = weekStrip(date);
    h += `<h2 class="dayhead">${C.DAY_LONG[C.dayIdx(date)]} <span>${esc(C.fmtDate(date, { month: 'long', day: 'numeric' }))}</span></h2>`;
    h += banners(date, ss.find((s) => s.test));
    h += '<div class="cards">';
    ss.forEach((s) => {
      const pr = C.progress(s, C.getLog(date, s.id));
      h += `<button class="card sess" data-act="open" data-sid="${s.id}">
        <span class="slot">${esc(s.slot)}${s.mins ? ' · ' + s.mins + ' min' : ''}</span>
        <span class="stitle">${esc(s.title)}</span>
        <span class="meter"><span style="width:${Math.round(pr.pct * 100)}%"></span></span>
        ${pill(pr, s.optional)}</button>`;
    });
    h += '</div>';
    h += daily(st, true);
    return h;
  }

  // Placeholder for a set: the set before it today, else the same set last time.
  function hintFor(log, e, i, last) {
    const prev = i > 0 ? C.setOf(log, e.id, i - 1) : null;
    if (prev && C.filled(prev) && (prev.w || prev.r || prev.t || prev.time)) return prev;
    return (last && last.sets[i]) || (last && last.sets[last.sets.length - 1]) || {};
  }

  function setRow(e, i, cur, hint, best) {
    const ph = (f) => (hint[f] ? esc(hint[f]) : '');
    const pr = best && ((e.type === 'w' && best.e1 && C.e1rm(+cur.w, +cur.r) > best.e1 + 0.01) || (e.type === 's' && best.time && +cur.time > 0 && +cur.time < best.time));
    const n = `<span class="sn">${pr ? '<b class="pr">PR</b>' : i + 1}</span>`;
    const tick = `<button class="tick${cur.done ? ' on' : ''}" data-act="tick" data-ex="${e.id}" data-set="${i}" aria-pressed="${!!cur.done}" aria-label="Set ${i + 1} done">✓</button>`;
    const inp = (f, label, step, val, phv) => `<label class="fld"><input id="i-${e.id}-${i}-${f}" type="number" inputmode="decimal" step="${step}" min="0" data-ex="${e.id}" data-set="${i}" data-f="${f}" value="${esc(val || '')}" placeholder="${phv}"><span>${label}</span></label>`;
    if (e.type === 'w') return `<div class="set">${n}${inp('w', 'lb', '0.5', cur.w, ph('w'))}<span class="x">×</span>${inp('r', /s each|s$/.test(e.target) ? 's' : 'reps', '1', cur.r, ph('r'))}${tick}</div>`;
    if (e.type === 'r') return `<div class="set">${n}${inp('r', e.unit || 'reps', '1', cur.r, ph('r'))}${tick}</div>`;
    if (e.type === 't') return `<div class="set">${n}${inp('t', 'sec', '1', cur.t, ph('t'))}${tick}</div>`;
    if (e.type === 's') return `<div class="set">${n}${inp('time', 'sec', '0.01', cur.time, ph('time'))}${tick}</div>`;
    return '';
  }

  function exercise(e, log, date) {
    const last = C.lastFor(e.id, date);
    let suggest = '';
    if (e.type === 'w' && last) {
      const top = C.topOfRange(e.target);
      const lastSets = last.sets.filter((s) => +s.w > 0);
      if (top && lastSets.length >= e.sets && lastSets.every((s) => +s.r >= top)) suggest = '<p class="up">Every set hit the top of the range last time: add 5–10 lb.</p>';
    }
    const lastTxt = last ? `<span class="last">Last (${esc(C.fmtDate(last.date))}): ${esc(last.sets.filter(C.filled).map((s) => s.w ? s.w + '×' + (s.r || '?') : s.time ? s.time + 's' : s.r || s.t || '✓').join(', '))}</span>` : '';
    let body = '';
    if (e.type === 'x') {
      body = '<div class="ticks">';
      for (let i = 0; i < e.sets; i++) {
        const on = !!C.setOf(log, e.id, i).done;
        body += `<button class="tick big${on ? ' on' : ''}" data-act="tick" data-ex="${e.id}" data-set="${i}" aria-pressed="${on}">${e.sets > 1 ? i + 1 : '✓'}</button>`;
      }
      body += '</div>';
    } else {
      const best = C.bestBefore(e.id, date);
      body = '<div class="sets">';
      for (let i = 0; i < e.sets; i++) body += setRow(e, i, C.setOf(log, e.id, i), hintFor(log, e, i, last), best);
      body += '</div>';
    }
    let done = true;
    for (let i = 0; i < e.sets; i++) if (!C.filled(C.setOf(log, e.id, i))) done = false;
    return `<div class="ex${done ? ' complete' : ''}" id="ex-${e.id}">
      <div class="exhead"><button class="exname how" data-act="how" data-key="${e.id}" data-title="${esc(e.name)}" data-sub="${esc(e.sets + ' × ' + e.target + (e.rest ? ' · rest ' + e.rest : ''))}">${done ? '<span class="ok" aria-label="Done">✓</span>' : ''}${esc(e.name)}<span class="hi" aria-hidden="true">?</span></button><span class="dose">${e.sets} × ${esc(e.target)}${e.rest ? ' · rest ' + esc(e.rest) : ''}</span></div>
      ${e.cue ? `<p class="cue">${esc(e.cue)}</p>` : ''}${lastTxt}${suggest}${body}</div>`;
  }

  function session(st) {
    const date = st.date;
    const s = C.sessionsFor(date).find((x) => x.id === st.sid);
    if (!s) return '<p class="empty">That session isn’t on this day.</p>';
    const log = C.getLog(date, s.id), pr = C.progress(s, log);
    const w = C.weekOf(date), ph = P.PHASES[P.phaseOf(w)];
    let h = `<button class="back" data-act="back">‹ ${C.DAY_LONG[C.dayIdx(date)]}</button>
      <div class="shead"><span class="slot">${esc(s.slot)} · Week ${w} · ${esc(ph.name)} phase</span>
      <h2>${esc(s.title)}</h2><p class="intro">${esc(s.intro || '')}</p></div>${banners(date, s)}`;
    s.blocks.forEach((b) => {
      h += `<section class="block"><h3>${esc(b.title)}</h3>${b.note ? `<p class="note">${esc(b.note)}</p>` : ''}`;
      if (b.testLink) h += '<button class="btn" data-act="view" data-view="tests">Open the test battery</button>';
      b.ex.forEach((e) => { h += exercise(e, log, date); });
      h += '</section>';
    });
    let opts = '<option value="">–</option>';
    for (let i = 1; i <= 10; i++) opts += `<option value="${i}"${+log.rpe === i ? ' selected' : ''}>${i}</option>`;
    h += `<section class="block finish"><h3>Finish</h3>
      <label class="row"><span>Session effort (RPE 1–10)</span><select id="rpe-${s.id}" data-act="rpe">${opts}</select></label>
      <label class="stack"><span>Notes</span><textarea id="notes-${s.id}" data-act="notes" rows="3" placeholder="How it felt, what to change next time">${esc(log.notes || '')}</textarea></label>
      <button class="btn primary" data-act="complete">${log.done ? 'Marked complete · undo' : 'Mark session complete'}</button>
      <p class="tiny">${pr.done} of ${pr.total} sets logged.</p></section>`;
    return h;
  }

  function week(st) {
    const w = C.weekOf(st.date), mon = C.mondayOf(st.date), cur = C.weekOf(C.today());
    let map = '<div class="map" aria-label="12-week plan">';
    for (let i = 1; i <= 12; i++) {
      const tags = (P.TEST_WEEKS.includes(i) ? '<i>T</i>' : '') + (P.DELOAD.includes(i) ? '<i>D</i>' : '');
      map += `<button class="wk p${P.phaseOf(i)}${i === w ? ' sel' : ''}${i === cur ? ' now' : ''}" data-act="week" data-week="${i}" aria-label="Week ${i}"><b>${i}</b>${tags}</button>`;
    }
    map += '</div><div class="legend"><span class="lg p1">Muscle 1–4</span><span class="lg p2">Strength 5–8</span><span class="lg p3">Power 9–12</span><span>T test · D deload</span></div>';
    let h = `<h2 class="dayhead">Week ${w} <span>${esc(P.PHASES[P.phaseOf(w)].name)} phase · cycle ${C.cycleOf(st.date)}</span></h2>${map}`;
    h += '<div class="weeklist">';
    for (let d = 0; d < 7; d++) {
      const date = C.addDays(mon, d);
      h += `<div class="wday"><div class="wdh"><b>${C.DAY_NAMES[d]}</b> ${esc(C.fmtDate(date))}${d === 2 ? ' · <span class="gm">Game</span>' : ''}</div>`;
      C.sessionsFor(date).forEach((s) => {
        const pr = C.progress(s, C.getLog(date, s.id));
        h += `<button class="wsess" data-act="open" data-date="${date}" data-sid="${s.id}"><span>${esc(s.title)}</span>${pill(pr, s.optional)}</button>`;
      });
      h += '</div>';
    }
    return h + '</div>';
  }

  function progressView(st) {
    const cat = C.catalogue();
    const keys = Object.keys(cat).filter((k) => C.series(k).pts.length);
    const testKeys = P.TESTS.map((t) => 'test:' + t.id).filter((k) => C.series(k).pts.length);
    const all = keys.concat(testKeys);
    const key = all.includes(st.chart) ? st.chart : all[0];
    const mon = C.mondayOf(st.date);
    let planned = 0, done = 0;
    for (let d = 0; d < 7; d++) {
      const date = C.addDays(mon, d);
      C.sessionsFor(date).filter((s) => !s.optional).forEach((s) => { planned++; if (C.progress(s, C.getLog(date, s.id)).complete) done++; });
    }
    const logs = C.allLogs().filter((l) => Object.values(l.ex).some((e) => e.sets && e.sets.some(C.filled)));
    let vol = 0;
    logs.filter((l) => l.date >= mon && l.date < C.addDays(mon, 7)).forEach((l) => Object.values(l.ex).forEach((e) => (e.sets || []).forEach((s) => { vol += (+s.w || 0) * (+s.r || 0); })));
    let h = `<div class="stats">
      <div class="stat"><b>${done}/${planned}</b><span>sessions done this week</span></div>
      <div class="stat"><b>${logs.length}</b><span>sessions logged in total</span></div>
      <div class="stat"><b>${Math.round(vol).toLocaleString()}</b><span>lb lifted this week</span></div></div>`;
    h += key ? exerciseChart(cat, keys, testKeys, key) : '<p class="empty">Your exercise charts appear here once you log weights, sprint times or test results. Open today’s session to log your first sets.</p>';
    return h + volumeBlock(st) + sleepBlock(st);
  }

  const phaseLegend = (extra) => `<div class="legend"><span class="lg p1">${esc(P.PHASES[1].name)}</span><span class="lg p2">${esc(P.PHASES[2].name)}</span><span class="lg p3">${esc(P.PHASES[3].name)}</span>${extra}</div>`;

  function volumeBlock(st) {
    const cyc = C.cycleOf(st.date), cur = C.weekAbs(C.today()) >= 1 && C.cycleOf(C.today()) === cyc ? C.weekOf(C.today()) : 0;
    const rows = C.weekVolumes(cyc);
    const tbl = rows.filter((r) => r.kg).map((r) => `<tr><td>${r.w}${r.dl ? ' (deload)' : ''}</td><td>${esc(P.PHASES[r.ph].name)}</td><td>${r.kg.toLocaleString()}</td><td>${r.n}</td></tr>`).join('');
    return `<section class="block"><h3>Weekly volume · cycle ${cyc}</h3>
      <p class="note">Total lb × reps across every weighted set. It should build through each phase and come down on deload weeks (D).</p>
      <div class="chartwrap">${C.volumeChart(rows, cur)}</div>${phaseLegend('<span>Faded bar = deload · T = test week</span>')}
      ${tbl ? `<details class="tblwrap"><summary>Show as table</summary><table class="tbl"><thead><tr><th>Week</th><th>Phase</th><th>lb</th><th>Sessions</th></tr></thead><tbody>${tbl}</tbody></table></details>` : ''}</section>`;
  }

  function sleepBlock(st) {
    const rows = C.sleepEffort(st.date, 28);
    const avg = (a) => (a.length ? (a.reduce((s, v) => s + v, 0) / a.length).toFixed(1) : null);
    const hard = avg(rows.filter((r) => r.rpe >= 8 && r.sleep).map((r) => r.sleep));
    const easy = avg(rows.filter((r) => r.rpe && r.rpe < 8 && r.sleep).map((r) => r.sleep));
    const flags = rows.filter(C.isFlag).length;
    let note = '';
    if (hard && easy) note += `Before your hardest sessions (RPE 8+) you slept ${hard} h on average, against ${easy} h before the rest. `;
    if (flags) note += `${flags} hard session${flags === 1 ? '' : 's'} came after under 7 h of sleep (red dots).`;
    return `<section class="block"><h3>Sleep and effort · last 4 weeks</h3>
      <div class="chartwrap">${C.sleepEffortChart(rows)}</div>
      <div class="legend"><span class="lg sl">Sleep</span><span class="lg rp">Session effort</span><span class="lg fl">RPE 8+ after under 7 h sleep</span></div>
      ${note ? `<p class="note chartnote">${esc(note)}</p>` : ''}</section>`;
  }

  function exerciseChart(cat, keys, testKeys, key) {
    let opts = '';
    keys.forEach((k) => { opts += `<option value="${k}"${k === key ? ' selected' : ''}>${esc(cat[k].name)}</option>`; });
    if (testKeys.length) { opts += '<optgroup label="Tests">'; testKeys.forEach((k) => { opts += `<option value="${k}"${k === key ? ' selected' : ''}>${esc(P.TESTS.find((t) => 'test:' + t.id === k).name)}</option>`; }); opts += '</optgroup>'; }
    const ser = C.series(key);
    const first = ser.pts[0], last = ser.pts[ser.pts.length - 1];
    let change = '';
    if (ser.pts.length > 1) {
      const pct = ((last.y - first.y) / first.y) * 100, better = ser.lower ? pct < 0 : pct > 0;
      change = `<span class="chg ${better ? 'good' : pct === 0 ? '' : 'bad'}">${pct > 0 ? '+' : ''}${pct.toFixed(1)}% since ${esc(C.fmtDate(first.date))}</span>`;
    }
    return `<section class="block"><label class="row"><span>Chart</span><select id="chart-pick" data-act="chart">${opts}</select></label>
      <div class="charthead"><b>${esc(last.label)}</b><span>${esc(ser.unit)}${ser.lower ? ' · lower is better' : ''}</span>${change}</div>
      <div class="chartwrap">${C.lineChart(ser)}</div>
      ${phaseLegend('<span class="lg dl">Deload</span><span>T = test week</span>')}
      <table class="tbl"><thead><tr><th>Date</th><th>Best</th><th>${esc(ser.unit)}</th></tr></thead><tbody>
      ${ser.pts.slice(-8).reverse().map((p) => `<tr><td>${esc(C.fmtDate(p.date))}</td><td>${esc(p.label)}</td><td>${p.y}</td></tr>`).join('')}</tbody></table></section>`;
  }

  function tests(st) {
    const date = st.date, id = 'test_' + date;
    const doc = C.S.get(id) || { res: {} };
    const prev = Object.values(C.S.all()).filter((d) => d && d.kind === 'test' && d.date < date).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    let h = `<h2 class="dayhead">Test battery <span>${esc(C.fmtDate(date, { month: 'long', day: 'numeric' }))} · week ${C.weekOf(date)}</span></h2>
      <p class="note">Weeks 1, 6 and 12. Same surface, same shoes, same warm-up. Enter the best of 2–3 tries.</p><div class="tests">`;
    P.TESTS.forEach((t) => {
      const v = doc.res[t.id], pv = prev && prev.res[t.id];
      let d = '';
      if (v && pv) { const diff = v - pv, good = t.lower ? diff < 0 : diff > 0; d = `<span class="chg ${good ? 'good' : diff ? 'bad' : ''}">${diff > 0 ? '+' : ''}${diff.toFixed(t.unit === 's' ? 2 : 1)}</span>`; }
      h += `<div class="trow"><span class="tn"><button class="how" data-act="how" data-key="test:${t.id}" data-title="${esc(t.name)}" data-sub="Best of 2–3 tries, in ${t.unit}">${esc(t.name)}<span class="hi" aria-hidden="true">?</span></button>${pv ? `<small>Last: ${esc(pv)} ${t.unit}</small>` : ''}</span>
        <span class="fld"><input id="t-${t.id}" type="number" inputmode="decimal" step="${t.unit === 's' ? '0.01' : '0.5'}" min="0" data-test="${t.id}" value="${esc(v || '')}" aria-label="${esc(t.name)} in ${t.unit}"><span>${t.unit}</span></span>${d}</div>`;
    });
    h += '</div>';
    const asym = (a, b, label) => {
      const L = +doc.res[a], R = +doc.res[b];
      if (!L || !R) return '';
      const gap = Math.abs(L - R) / Math.max(L, R) * 100;
      return gap > 10 ? `<div class="banner">${label}: ${gap.toFixed(0)}% gap between legs. Over about 10% is worth fixing with extra single-leg work on the weaker side.</div>` : '';
    };
    h += asym('hopL', 'hopR', 'Single-leg hop') + asym('f505L', 'f505R', '5-0-5');
    return h;
  }

  function daily(st, compact) {
    const date = st.date, d = C.dayIdx(date), doc = C.S.get('day_' + date) || { h: {} };
    const bw = +C.profile().bw;
    const habits = P.HABITS.filter((x) => !x.days || x.days.includes(d));
    let h = `<section class="block"><h3>Daily must-dos</h3>`;
    if (bw) h += `<p class="note">Protein today: ${Math.round(bw * 1.4)}–${Math.round(bw * 2)} g, in 20–40 g servings every 3–4 hours.</p>`;
    h += '<div class="habits">';
    habits.forEach((x) => {
      const on = !!doc.h[x.id], g = window.GUIDE && window.GUIDE['habit:' + x.id];
      h += `<div class="hrow"><button class="habit${on ? ' on' : ''}" data-act="habit" data-h="${x.id}" aria-pressed="${on}"><span class="box">✓</span>${esc(x.name)}</button>${g ? `<button class="hbtn" data-act="how" data-key="habit:${x.id}" data-title="${esc(x.name)}" data-sub="" aria-label="How to: ${esc(x.name)}">?</button>` : ''}</div>`;
    });
    h += `</div><label class="row"><span>Hours of sleep last night</span><span class="fld"><input id="sleep-${date}" type="number" inputmode="decimal" step="0.25" min="0" max="14" data-sleep="1" value="${esc(doc.sleep || '')}"><span>h</span></span></label></section>`;
    if (compact) return h;
    let grid = '<div class="hist">';
    for (let i = 27; i >= 0; i--) {
      const dt = C.addDays(date, -i), dd = C.S.get('day_' + dt), n = C.dayIdx(dt);
      const hs = P.HABITS.filter((x) => !x.days || x.days.includes(n));
      const got = dd ? hs.filter((x) => dd.h && dd.h[x.id]).length : 0;
      const lvl = got === 0 ? 0 : got / hs.length < 0.5 ? 1 : got < hs.length ? 2 : 3;
      grid += `<span class="hc l${lvl}" title="${esc(C.fmtDate(dt))}: ${got}/${hs.length}${dd && dd.sleep ? ', ' + dd.sleep + ' h sleep' : ''}"></span>`;
    }
    grid += '</div>';
    const sleeps = []; for (let i = 0; i < 7; i++) { const dd = C.S.get('day_' + C.addDays(date, -i)); if (dd && +dd.sleep) sleeps.push(+dd.sleep); }
    const avg = sleeps.length ? (sleeps.reduce((a, b) => a + b, 0) / sleeps.length).toFixed(1) : null;
    return weekStrip(date) + h + `<section class="block"><h3>Last 4 weeks</h3>${grid}<p class="note">${avg ? `Average sleep over the last 7 days: ${avg} h (aim for 8–9).` : 'Log your sleep each morning to see your weekly average.'}</p></section>`;
  }

  function settings(st) {
    const p = C.profile(), mode = C.S.mode;
    return `<button class="back" data-act="back">‹ Back</button><h2 class="dayhead">Settings</h2>
      <section class="block"><label class="row"><span>Week 1 starts (Monday)</span><input id="set-start" type="date" data-set-profile="start" value="${esc(p.start)}"></label>
      <label class="row"><span>Body weight</span><span class="fld"><input id="set-bw" type="number" inputmode="decimal" step="0.5" min="0" data-set-profile="bw" value="${esc(p.bw || '')}"><span>lb</span></span></label>
      <p class="note">${mode === 'cloud' ? 'Your log is saved privately to your Claude account, so it follows you to any device where you open this page signed in. Nobody else who opens this page can see it.' : window.claude ? 'Your log is saved in this browser only. Open the page signed in to claude.ai to keep it on your account.' : 'Your log is saved on this phone only. Save a backup file every week or two so nothing is lost if the phone is reset or replaced.'}</p></section>
      <section class="block"><h3>Backup file</h3><p class="note">Saves everything (sets, tests, sleep, daily checks, settings) to one file. Restore it here or in your other copy of the app to bring your log across.</p>
      <div class="you"><button class="btn" data-act="backup">Save backup file</button><label class="btn" for="restore-file">Restore from file</label></div>
      <input id="restore-file" type="file" accept=".json,application/json" data-act="restore" hidden><p class="tiny" id="backup-msg" aria-live="polite"></p></section>
      <section class="block" id="export-block"><h3>Spreadsheet</h3><p class="note">Download every logged set as a spreadsheet (CSV) you can open in Excel or Google Sheets.</p>
      <button class="btn" data-act="export">Download my log</button><p class="tiny" id="export-msg"></p></section>
      <section class="block"><h3>Start over</h3><p class="note">Erases every logged set, test and daily check.</p>
      ${st.confirmWipe ? '<div class="confirm"><span>Erase everything? This can’t be undone.</span><button class="btn danger" data-act="wipe-yes">Erase all</button><button class="btn" data-act="wipe-no">Cancel</button></div>' : '<button class="btn" data-act="wipe">Erase all data</button>'}</section>`;
  }

  return { today, session, week, progress: progressView, tests, daily, settings, hintFor };
})();
