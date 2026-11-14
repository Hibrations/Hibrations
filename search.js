// search.js · one search for the whole house (Portal remake, step 12 of portal_remake/BUILD_PLAN.md).
//
// It finds temples, sheets, practices and his own entries. Everything happens on this phone: no network call, nothing
// sent, and the words typed are kept nowhere. It only reads. The stores it reads, and never writes:
//   body_temple_v1, inner_temple_v1, breath_temple_v1, beast_temple_v1, magnetic_temple_v1, grimoire_v1, vocal_v1
//   (sessions and their notes), healing_felt_v1, inner_extras_v1, portal_capture_v1, portal_shelf_v1, portal_plan_v1,
//   strings_shelf_v1, hibrations_v1, kaching_tally_v1, astro_people_v1.
// Left out on purpose: baby_board_v1 (her lines never leave the Baby page), the directors' threads and advice
// (they are theirs, and live behind the director's face), and every number (weights, kroner, hours).
// The one thing a tap may write is the pages' own handoff, portal_auto_start_v1, exactly as home writes it when a
// practice is opened from the day: the temple reads it once and removes it.
// Beast Temple shows whole here, like everything else inside the app. Nothing of this leaves the page.
//
// Loaded only when search is first opened (shell.js, TempleShell.openSearch), together with search_index.js.
(function () {
  'use strict';
  if (window.TempleSearch) return;
  const TS = window.TempleShell; if (!TS) return;
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const readJ = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const obj = (v) => (isObj(v) ? v : {});
  const arr = (v) => (Array.isArray(v) ? v : []);
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[‐-―·]/g, '-');
  const noon = (d) => { const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(d || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12).getTime() : 0; };
  const tsOf = (s) => (typeof s.at === 'number' ? s.at : s.at ? Date.parse(s.at) || 0 : s.date ? noon(s.date) : typeof s.createdAt === 'number' ? s.createdAt : 0);
  const dayOf = (ms) => (ms ? new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const nameOf = (k) => (TS.TEMPLES[k] ? TS.TEMPLES[k].name : k);

  // ── what can be found ──
  // the sheets: places inside a temple that have a name of their own. `at` is a hash or query the page already answers.
  const SHEETS = [
    ['portal', 'Today', 'the day arc and what is on offer'], ['portal', 'Schedule', 'the week, slot by slot'], ['portal', 'History', 'what was marked'],
    ['portal', 'Sleep on it', 'the shelf: set down, with no date'], ['portal', 'Quick capture', 'a line for A'],
    ['portal', 'Settings', 'night skin, one hand, large type, baby season', 'settings'],
    ['body', 'Backup and restore', 'save a backup file, restore from one', '#backup'], ['body', 'Training', 'today, the session, plans, library'],
    ['body', 'Fuel', 'food, protein, energy'], ['body', 'History and graphs', 'top sets, weight, the weeks, sleep'], ['body', 'Weigh-in', 'bodyweight'],
    ['mirror', 'The weekly read', 'A can read the week, if asked'], ['mirror', 'Ribbons and the stack', 'the year, the week, the moon, the river'],
    ['kaching', 'Leave sums', 'barsel, the cap, the gap'], ['kaching', 'The village cost tally', 'in and out'],
    ['baby', 'The night-shift board', 'who is up, her block, the swap'], ['baby', 'The next date', 'the barsel timeline'],
    ['observatory', 'Astrolabe', 'the chart, today’s sky, transits'], ['observatory', 'Tarot', 'the draw, the deck'],
    ['strings', 'The bench', 'chords, drills, metronome, tuner'], ['hibrations', 'The draft shelf', 'drafted, seen, yes, let go'],
    ['inner', 'The protective egg', 'a colour, a mark'], ['inner', 'Evening wind-down', 'the calm evening slot'],
    ['breath', 'Slow down', 'five in, five out, no clock'], ['beast', 'The five-minute door', 'rooting, the seal, the pool'], ['beast', 'The massage alcove', 'solo and partnered'],
    ['vocal', 'Twelve weeks', 'steadiness, which weeks'], ['healing', 'Felt lines', 'what was kept after a practice'],
    ['village', 'Nagavar', 'the houses, the directors, the meeting table'],
  ];

  function staticRows() {
    const out = [];
    TS.GRID.concat(['portal']).forEach((k) => {
      const t = TS.TEMPLES[k], d = TS.DIRECTORS[t.dir];
      out.push({ group: 'temples', temple: k, sig: k, title: t.name, line: [t.word, t.sub, t.note].filter(Boolean).join(' · '), hay: fold([t.name, t.short, t.word, t.sub, d && d.name, k].join(' ')), go: { key: k } });
    });
    SHEETS.forEach(([k, title, line, at]) => out.push({ group: 'sheets', temple: k, sig: k, title: title, line: nameOf(k) + ' · ' + line, hay: fold(title + ' ' + line + ' ' + nameOf(k)), go: { key: k, at: at || '' } }));
    arr(window.TempleSearchIndex).forEach((r) => {
      if (!Array.isArray(r) || !TS.TEMPLES[r[0]]) return;
      out.push({ group: 'practices', temple: r[0], sig: r[0], title: r[2], line: (r[3] === 'm' ? 'a movement in ' : 'a practice in ') + nameOf(r[0]), hay: fold(r[2]), go: { key: r[0], auto: r[4] || '', id: r[1] } });
    });
    return out;
  }

  // his own entries, read fresh each time search opens. Text only; never a number, never anything of hers.
  function ownRows() {
    const out = [];
    const push = (temple, title, text, at, what, sig) => {
      title = str(title); text = str(text); if (!title && !text) return;
      out.push({ group: 'yours', temple: temple, sig: sig || temple, title: title || text, text: title ? text : '', at: at || 0,
        line: [what, nameOf(temple), dayOf(at)].filter(Boolean).join(' · '), hay: fold(title + ' ' + text), go: { key: temple } });
    };
    const sessions = (key) => arr(obj(readJ(key)).sessions).filter(isObj);
    sessions('body_temple_v1').forEach((s) => {
      const ex = arr(s.exercises).filter(isObj);
      push('body', s.planName || (s.rest ? 'Rest day' : 'A session'), ex.map((e) => str(e.name)).filter(Boolean).join(', '), tsOf(s), 'a session');
      ex.forEach((e) => { if (str(e.notes)) push('body', str(e.name) || 'A note', e.notes, tsOf(s), 'a note'); });
      if (str(s.finalNotes)) push('body', s.planName || 'A session', s.finalNotes, tsOf(s), 'a closing note');
    });
    sessions('inner_temple_v1').forEach((s) => push('inner', s.practiceName, s.finalNotes, tsOf(s), 'marked'));
    [['breath_temple_v1', 'breath'], ['beast_temple_v1', 'beast'], ['grimoire_v1', 'healing'], ['vocal_v1', 'vocal']].forEach(([k, t]) =>
      sessions(k).forEach((s) => push(t, s.name, s.notes, tsOf(s), 'marked')));
    sessions('magnetic_temple_v1').forEach((s) => push('magnetic', s.name, s.notes, tsOf(s), 'marked', 'beast'));
    arr(obj(readJ('healing_felt_v1')).lines).filter(isObj).forEach((l) => push('healing', l.text, '', +l.at || 0, 'a felt line' + (str(l.name) ? ', after ' + str(l.name) : '')));
    arr(obj(readJ('inner_extras_v1')).marks).filter(isObj).forEach((m) => { if (str(m.text)) push('inner', m.text, '', +m.at || 0, 'a felt line, the protective egg'); });
    arr(obj(readJ('portal_capture_v1')).lines).filter(isObj).forEach((l) => push('portal', l.text, '', tsOf(l), 'a line for A'));
    arr(obj(readJ('portal_shelf_v1')).items).filter(isObj).forEach((it) => push('portal', it.name, '', 0, 'set down on the shelf', TS.TEMPLES[it.star] ? it.star : 'portal'));
    const plan = obj(readJ('portal_plan_v1'));
    Object.keys(plan).forEach((day) => arr(obj(plan[day]).activities).filter(isObj).forEach((a) => push('portal', a.name, '', noon(day), 'placed in the plan')));
    const shelf = obj(readJ('strings_shelf_v1')); if (str(shelf.text)) push('strings', shelf.text, '', 0, 'the shelf');
    arr(obj(readJ('hibrations_v1')).pieces).filter(isObj).forEach((p) => push('hibrations', p.title || p.text || p.body, p.title ? (p.body || p.text) : '', +p.updatedAt || +p.createdAt || 0, str(p.stage) ? 'a piece, ' + str(p.stage) : 'a piece'));
    arr(obj(readJ('kaching_tally_v1')).extra).filter(isObj).forEach((x) => push('kaching', x.label, '', 0, 'a line in the tally'));
    arr(readJ('astro_people_v1')).filter(isObj).forEach((p) => push('observatory', p.name, '', 0, 'a chart'));
    return out.sort((a, b) => b.at - a.at);
  }

  // every word typed must be somewhere in the row; a title that starts with the words comes first
  function find(rows, q) {
    const words = fold(q).split(/\s+/).filter(Boolean); if (!words.length) return [];
    const first = words.join(' ');
    return rows.filter((r) => words.every((w) => r.hay.indexOf(w) >= 0))
      .map((r, i) => { const t = fold(r.title); return { r: r, i: i, rank: t.indexOf(first) === 0 ? 0 : t.indexOf(first) > 0 ? 1 : words.every((w) => t.indexOf(w) >= 0) ? 2 : 3 }; })
      .sort((a, b) => a.rank - b.rank || a.i - b.i).map((x) => x.r);
  }

  // ── going there ──
  function goTo(g) {
    close();
    if (g.at === 'settings') { TS.openSettings(); return; }
    if (g.auto && g.id) { try { localStorage.setItem('portal_auto_start_v1', JSON.stringify({ temple: g.auto, practiceId: g.id, openOnly: true, timestamp: Date.now() })); } catch (e) {} }
    if (typeof TS.homeOpen === 'function') { TS.homeOpen(g.key, g.at || ''); return; }     // home holds the overlay: it opens the door itself
    if (g.key === TS.temple && !g.auto && !g.at) { window.scrollTo(0, 0); return; }          // already here
    TS.go(g.key, g.at || '');
  }

  // ── the sheet ──
  const GROUPS = [['temples', 'Temples'], ['sheets', 'Sheets'], ['practices', 'Practices'], ['yours', 'Yours']];
  const SHOW = 12;
  let sheet = null, scrim = null, input = null, box = null, rows = [], lastFocus = null, lastId = '', more = {};

  function row(r) {
    const b = el('button', 'ts-found'); b.type = 'button'; b.dataset.temple = r.temple === 'magnetic' ? 'beast' : r.temple; b.dataset.group = r.group; b.dataset.sig = r.sig;
    b.appendChild(TS.sig(r.sig, 26));
    const d = el('span', 'ts-foundtx');
    d.appendChild(el('b', '', r.title.length > 220 ? r.title.slice(0, 220) + '…' : r.title));
    if (r.text) d.appendChild(el('span', 'ts-foundmore', r.text.length > 320 ? r.text.slice(0, 320) + '…' : r.text));
    d.appendChild(el('small', '', r.line));
    b.appendChild(d);
    b.addEventListener('click', () => goTo(r.go));
    return b;
  }
  function paint() {
    const q = input.value.trim();
    box.textContent = '';
    if (fold(q).replace(/\s/g, '').length < 2) {
      box.appendChild(el('p', 'ts-quiet', 'Temples, sheets, practices, and what you have written: notes, felt lines, sessions, what you set down. Two letters are enough.'));
      box.appendChild(el('p', 'ts-quiet', 'It looks only on this phone. Nothing typed here is kept or sent.'));
      status.textContent = '';
      return;
    }
    const hits = find(rows, q);
    if (!hits.length) { box.appendChild(el('p', 'ts-quiet', 'Nothing here by that name.')); status.textContent = 'Nothing found.'; return; }
    GROUPS.forEach(([g, title]) => {
      const mine = hits.filter((r) => r.group === g); if (!mine.length) return;
      const sec = el('section', 'ts-foundsec'); sec.dataset.group = g; sec.setAttribute('aria-label', title);
      sec.appendChild(el('h2', 'ts-sec', title));
      const n = more[g] ? mine.length : Math.min(mine.length, SHOW);
      mine.slice(0, n).forEach((r) => sec.appendChild(row(r)));
      if (n < mine.length) {
        const m = el('button', 'ts-link', 'Show the rest of these'); m.type = 'button'; m.dataset.more = g;
        m.addEventListener('click', () => { more[g] = true; paint(); const f = box.querySelectorAll('[data-group="' + g + '"] .ts-found')[n]; if (f) f.focus({ preventScroll: true }); });
        sec.appendChild(m);
      }
      box.appendChild(sec);
    });
    status.textContent = 'Results below.';
  }
  let status = null;
  function build() {
    scrim = el('div', 'ts-scrim'); scrim.hidden = true; scrim.addEventListener('click', close);
    sheet = el('div', 'ts-sheet ts-searchsheet'); sheet.hidden = true; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-label', 'Search');
    const head = el('div', 'ts-sheet-head'), nm = el('div');
    nm.appendChild(el('b', '', 'Search')); nm.appendChild(el('span', '', 'the whole house, on this phone'));
    const x = el('button', 'ts-x'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.appendChild(TS.sig('x', 20)); x.addEventListener('click', close);
    head.appendChild(nm); head.appendChild(x);
    const lab = el('label', 'ts-felt ts-searchlab'); lab.appendChild(el('span', 'ts-sr', 'Search for'));
    input = el('input'); input.type = 'search'; input.id = 'ts-search-input'; input.autocomplete = 'off'; input.spellcheck = false; input.enterKeyHint = 'search';
    input.setAttribute('autocapitalize', 'off'); input.placeholder = 'a temple, a practice, a word you wrote';
    input.addEventListener('input', () => { more = {}; paint(); });
    lab.appendChild(input);
    status = el('p', 'ts-sr'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    box = el('div', 'ts-sheet-body ts-foundbox');
    sheet.appendChild(head); sheet.appendChild(lab); sheet.appendChild(status); sheet.appendChild(box);
    sheet.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    document.body.appendChild(scrim); document.body.appendChild(sheet);
  }
  function open(q) {
    if (!sheet) build();
    TS.closeSheet();
    rows = staticRows().concat(ownRows()); more = {};
    lastFocus = document.activeElement; lastId = lastFocus && lastFocus.id ? lastFocus.id : '';
    input.value = typeof q === 'string' ? q : '';
    scrim.hidden = false; sheet.hidden = false; document.documentElement.style.overflow = 'hidden';
    paint();
    input.focus({ preventScroll: true });
  }
  function close() {
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true; scrim.hidden = true; document.documentElement.style.overflow = '';
    input.value = ''; box.textContent = ''; rows = [];                   // what was typed and found is not kept, even in memory
    const back = lastFocus && lastFocus.isConnected ? lastFocus : (lastId && document.getElementById(lastId)) || null;
    if (back && back.focus) { try { back.focus({ preventScroll: true }); } catch (e) {} }
  }

  window.TempleSearch = { open, close, find: (q) => find(staticRows().concat(ownRows()), q), isOpen: () => !!sheet && !sheet.hidden };
})();
