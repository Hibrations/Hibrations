// shell.js · the shared frame of the Portal remake (step 3 of portal_remake/BUILD_PLAN.md).
//
// A page opts in with <body data-temple="mirror">, temple.css, and this file in the <head> (no defer, so the night skin
// is set before the first paint; pages in a subfolder load ../shell.js). The page keeps its own script, ids, data and
// stores. This file sends nothing anywhere. Since step 11 it keeps one store of its own, portal_modes_v1 (below), and
// reads three it never writes: body_watch_v1 and body_extras_v1 (hours slept, as Body Temple reads them) and
// baby_board_v1 (tonight's line of the board).
//
// Step 11 · the modes. One store, written only by a tap in the Settings sheet or on the three lines:
//   portal_modes_v1 { v:1, baby:false, night:'auto'|'on'|'off', oneHand:false, largeType:false,
//                     nightFrom:21, nightTo:6,                       optional; the hours "auto" uses
//                     day:{ date:'YYYY-MM-DD', sleep:'yes'|'no', block:'yes'|'no', ate:'yes'|'no' } }
//   · baby season  <html data-baby>     never set by the app itself and never by a date. Home shows one thing and the
//                                       three lines; a Today card with a minimum shows the minimum first.
//   · night skin   <html data-night>    by the clock (21:00 to 06:00), or always, or never. Darker, a size larger, the
//                                       sky a still picture, nothing moving longer than 200 ms, and no sound.
//   · one hand     <html data-onehand>  the page starts a third of the way down, back is mirrored in the bar, sheets stay low.
//   · large type   <html data-large>    --ts-type, the one scale every size on the page is drawn at.
//   `day` is the three lines of the minimum (did you sleep, did she get her block, did anyone eat). They are today's
//   only: a new day starts blank, yesterday's are dropped, and nothing ever adds them up.
//
// What it adds:
//   · the header: back, the temple's name, its director's face, one guide line. A <header class="ts-head"> already
//     in the page is used as it is and only the missing parts are filled in.
//   · THE BACK CONTRACT. The button keeps the id the page's own script binds: an existing #back-btn or #app-back is
//     moved into the header with its listeners. If the page has none, one is made as #back-btn and bound here:
//     embedded it posts 'close-temple' to the parent, exactly as the thirteen pages do; standalone it opens the Portal.
//   · the sky band (sky.js) behind the header.
//   · the bottom bar: Today · Temples · Patterns · Village, and the temple's director as the fifth.
//   · the Temples sheet: every door, plainly (thirteen since step 8: Baby), and since step 12 "Search the house" on top.
//   · step 12: the temple's sigil beside its name in the header and on the bar's Temples button; TempleShell.openSearch()
//     (search.js, loaded on first use). sky.js rests under <html data-covered>, which home sets while its overlay is open.
//   · moving sideways: TempleShell.go('body'). Standalone it is a plain link. Embedded it posts
//     {action:'goto', app:'body'} to the parent; a parent that handles it answers {action:'goto-ack'}. Today's Portal
//     does not yet (step 4), so with no answer in 250 ms the frame opens the page itself.
//   · the night skin: <html data-night> from 21:00 to 06:00 by the clock, or by the override in Settings (step 11).
(function () {
  'use strict';
  if (window.TempleShell) return;
  const me = document.currentScript;
  const ROOT = new URL('.', (me && me.src) || location.href).href;      // the apps/ root, wherever the page sits
  const html = document.documentElement;
  const EMBEDDED = window.parent !== window;                             // as Body Temple tells its two homes apart
  const NIGHT_FROM = 21, NIGHT_TO = 6;

  // file: from the apps/ root. portal: the name the Portal's own Shell.goTo knows (healing is 'grimoire' there).
  const TEMPLES = {
    portal:      { name: 'Portal', short: 'Today', word: 'the crossroads', file: 'index.html', dir: 'a' },
    body:        { name: 'Body Temple', short: 'Body', word: 'earth', sub: 'the vessel', file: 'body/index.html', dir: 'garr' },
    inner:       { name: 'Inner Temple', short: 'Inner', word: 'sun', sub: 'the witness', file: 'inner_temple.html', dir: 'hekka' },
    breath:      { name: 'Breath Temple', short: 'Breath', word: 'air', sub: 'breath and energy', file: 'breath_temple.html', dir: 'hekka' },
    healing:     { name: 'Healing Temple', short: 'Healing', word: 'repair', sub: 'qi, reiki, prana', file: 'healing_temple.html', portal: 'grimoire', dir: 'hekka' },
    beast:       { name: 'Beast Temple', short: 'Beast', word: 'fire', sub: 'primal, field, charge', file: 'beast_temple.html', dir: 'rak', note: 'this phone only' },
    observatory: { name: 'Observatory', short: 'Observatory', word: 'night', sub: 'the chart, the draw', file: 'observatory/index.html', dir: 'hekka' },
    village:     { name: 'Village', short: 'Village', word: 'hearth', sub: 'Nagavar', file: 'village/index.html', dir: 'a' },
    vocal:       { name: 'Vocal Temple', short: 'Vocal', word: 'steadiness', sub: 'the throat', file: 'vocal.html', dir: 'garr' },
    strings:     { name: 'Strings', short: 'Strings', word: 'play', sub: 'the hands learn', file: 'strings.html', dir: 'paa' },
    hibrations:  { name: 'Hibrations', short: 'Hibrations', word: 'the page', sub: 'being seen', file: 'hibrations.html', dir: 'nokka' },
    mirror:      { name: 'Patterns', short: 'Patterns', word: 'the mirror', sub: 'what was there', file: 'mirror.html', dir: 'a' },   // step 7: the Weekly Mirror became Patterns; the key and the file keep their names
    kaching:     { name: 'Kaching', short: 'Kaching', word: 'the ledger', sub: 'leave sums, the tally', file: 'kaching.html', dir: 'ngoen' },
    pulse:       { name: 'Pulse', short: 'Pulse', word: 'rhythm', sub: 'kegel, breath, tone', file: 'pulse/index.html', dir: 'garr' },   // 2026-11-20: the timers, in the frame
    baby:        { name: 'Baby', short: 'Baby', word: 'the lit window', sub: 'the night-shift board', file: 'baby.html', dir: 'malee' },   // step 8
    magnetic:    { name: 'Magnetic Temple', short: 'Magnetic', word: 'fire', sub: 'the older cut', file: 'magnetic_temple.html', dir: 'rak', hidden: true },
  };
  const GRID = ['body', 'inner', 'breath', 'beast', 'observatory', 'village', 'healing', 'vocal', 'pulse', 'strings', 'hibrations', 'mirror', 'kaching', 'baby'];
  const BAR = ['portal', 'temples', 'mirror', 'village'];               // and the director's face as the fifth (Lek, 11-14)
  const DIRECTORS = {
    a: { name: 'A', house: null }, garr: { name: 'Garr', house: 'fitness' }, hekka: { name: 'Hekka', house: 'esoteric' },
    rak: { name: 'Rak', house: 'cupidity' }, thorn: { name: 'Thorn', house: 'halohorns' }, nokka: { name: 'Nokka', house: 'hibrations' },
    ngoen: { name: 'Ngoen', house: 'kaching' }, paa: { name: 'Paa', house: 'hobby' }, malee: { name: 'Malee', house: 'baby' },
  };

  // ── before the first paint: where am I, when am I ──
  html.setAttribute(EMBEDDED ? 'data-embedded' : 'data-standalone', '');

  // ── step 11: the modes (the store is described at the top of this file) ──
  const MODES = 'portal_modes_v1';
  let booted = false;                                                    // true once the page's frame is built
  const readJSON = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const hourOr = (v, d) => (typeof v === 'number' && v >= 0 && v < 24 ? Math.floor(v) : d);
  const localDay = (d) => { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function modes() {
    const o = readJSON(MODES), m = isObj(o) ? o : {};
    return { v: 1, baby: m.baby === true, night: m.night === 'on' || m.night === 'off' ? m.night : 'auto', oneHand: m.oneHand === true, largeType: m.largeType === true,
      nightFrom: hourOr(m.nightFrom, NIGHT_FROM), nightTo: hourOr(m.nightTo, NIGHT_TO), day: isObj(m.day) && m.day.date === localDay() ? m.day : null };
  }
  function writeModes(m) {
    const out = { v: 1, baby: m.baby, night: m.night, oneHand: m.oneHand, largeType: m.largeType };
    if (m.nightFrom !== NIGHT_FROM || m.nightTo !== NIGHT_TO) { out.nightFrom = m.nightFrom; out.nightTo = m.nightTo; }
    if (m.day && Object.keys(m.day).length > 1) out.day = m.day;       // only today's, and only when something was tapped
    try { localStorage.setItem(MODES, JSON.stringify(out)); } catch (e) { return false; }
    return true;
  }
  const SWITCHES = { baby: 1, oneHand: 1, largeType: 1 };
  function setMode(key, value) {
    const m = modes();
    if (SWITCHES[key]) m[key] = value === true;
    else if (key === 'night') m.night = value === 'on' || value === 'off' ? value : 'auto';
    else return false;
    writeModes(m); applyModes(); announce();
    return true;
  }
  // the three lines. v: 'yes' | 'no' | null (a second tap on the same answer takes it back)
  function minimum() { const d = modes().day; return d ? { sleep: d.sleep || null, block: d.block || null, ate: d.ate || null } : { sleep: null, block: null, ate: null }; }
  function setMinimum(key, v) {
    if (['sleep', 'block', 'ate'].indexOf(key) < 0) return false;
    const m = modes(), d = m.day || { date: localDay() };
    if (v === 'yes' || v === 'no') d[key] = v; else delete d[key];
    m.day = d; writeModes(m); announce();
    return true;
  }
  const announce = () => { try { window.dispatchEvent(new CustomEvent('temple-modes')); } catch (e) {} };

  // night: by the override first, then by the clock
  const isNight = (d) => {
    const m = modes();
    if (m.night === 'on') return true;
    if (m.night === 'off') return false;
    const h = (d || new Date()).getHours();
    return m.nightFrom > m.nightTo ? (h >= m.nightFrom || h < m.nightTo) : (h >= m.nightFrom && h < m.nightTo);
  };
  function applyModes() {
    const m = modes(), n = isNight(), was = html.hasAttribute('data-night');
    html.toggleAttribute('data-night', n);
    html.toggleAttribute('data-baby', m.baby);
    html.toggleAttribute('data-onehand', m.oneHand);
    html.toggleAttribute('data-large', m.largeType);
    if (n !== was && window.TempleSky) window.TempleSky.redraw();
    const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = n ? '#0D0C12' : '#15131B';
    if (booted) { seasonCards(); placeSleepLine(); syncBack(); paintSettings(); }
  }
  applyModes();                                                          // before the first paint
  setInterval(applyModes, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) applyModes(); });
  // a switch tapped in another page of the house (the Portal over a temple, or the other way round) lands here too
  window.addEventListener('storage', (e) => { if (e.key === MODES || e.key === null) { applyModes(); announce(); } });

  // Quiet hours are quiet. While the night skin is on, nothing a page plays reaches the speaker: no bell, no tick,
  // no spoken cue, no buzz. Asked at the moment of playing, so it follows the skin and its override.
  (function quiet() {
    const on = () => html.hasAttribute('data-night');
    try {
      const AN = window.AudioNode && window.AudioNode.prototype;
      if (AN && AN.connect) { const connect = AN.connect; AN.connect = function (dest) { if (on() && dest && this.context && dest === this.context.destination) return dest; return connect.apply(this, arguments); }; }
    } catch (e) {}
    try { const ME = window.HTMLMediaElement && window.HTMLMediaElement.prototype; if (ME && ME.play) { const play = ME.play; ME.play = function () { if (on()) this.muted = true; return play.apply(this, arguments); }; } } catch (e) {}
    try { const ss = window.speechSynthesis; if (ss && ss.speak) { const speak = ss.speak.bind(ss); ss.speak = function (u) { if (on()) return; return speak(u); }; } } catch (e) {}
    try { if (navigator.vibrate) { const vib = navigator.vibrate.bind(navigator); navigator.vibrate = function (p) { if (on()) return false; return vib(p); }; } } catch (e) {}
  })();

  // ── step 11: sleep sets the day. The same reading Body Temple makes: the watch when it wrote last night, otherwise
  // the number he typed there. Where neither exists, the first of the three lines stands in. One line, never a score. ──
  function sleep() {
    const day = localDay(), w = readJSON('body_watch_v1'), x = readJSON('body_extras_v1');
    let h = null, from = null;
    const wd = w && Array.isArray(w.days) ? w.days.filter((d) => d && d.day === day)[0] : null;
    if (wd && typeof wd.sleep === 'number' && wd.sleep > 0) { h = wd.sleep; from = 'watch'; }
    else if (isObj(x) && isObj(x.sleep) && typeof x.sleep[day] === 'number' && x.sleep[day] > 0) { h = x.sleep[day]; from = 'typed'; }
    const tap = minimum().sleep;
    return { h: h, from: from, tap: tap, short: h != null ? h < 6 : tap === 'no' };
  }
  const SLEEP_SAYS = {
    portal: 'The minimum of each comes first today. The full ones are still yours.',
    beast: 'The five-minute door comes first today. The charged ones keep for a longer night.',
    body: 'The lighter version comes first today. The full session is still yours.',
  };
  function sleepLine(key) {
    const s = sleep(); if (!s.short) return null;
    const lead = s.h != null ? 'Slept ' + (Math.round(s.h * 10) / 10) + ' h' + (s.from === 'watch' ? ', from the watch' : '') + '.' : 'A short night.';
    return lead + ' ' + (SLEEP_SAYS[key || KEY] || SLEEP_SAYS.portal);
  }
  // drawn by this file on Beast; home and Body place the same line themselves, inside their own Today
  function placeSleepLine() {
    if (KEY !== 'beast') return;
    const body = document.querySelector('.ts-body'); if (!body) return;
    let p = document.getElementById('ts-sleepline');
    const txt = sleepLine(KEY);
    if (!txt) { if (p) p.remove(); return; }
    if (!p) { p = el('p', 'ts-sleepline'); p.id = 'ts-sleepline'; body.insertBefore(p, body.firstChild); }
    p.textContent = txt;
  }

  // ── step 11: baby season ──
  // The dates of the Baby page's strip, kept here so home and the Baby page read one list.
  // SOURCE: Baby/barsel/barsel_timeline.md (Malee, 2026-11-01, updated 2026-11-04), copied on 2026-11-14. The seven dates
  // are the ones Malee's board lists for the strip (night_shift_board.md §5), in the timeline's own words. The file wins:
  // if it changes, change these. "until" is the last day a line is still the next one; the two "about" lines have no day
  // in the file, so they stand until their month is over. Left out, as on Malee's strip: the dagpenge application day
  // (8 weeks after the first leave day, which moves) and 5 Jan 2036.
  const BABY_DATES = [
    { until: '2026-12-08', when: 'by 8 Dec 2026', what: 'Employer must know about the 2 weeks. Already planned at work: only check it is written down and that the 2 weeks are the standard barsel weeks.' },
    { until: '2027-01-04', when: '4 Jan 2027', what: 'Lek’s planned leave start, a day before the due date. If the baby comes early or late, ask work whether the plan bends.' },
    { until: '2027-01-05', when: '5 Jan 2027', what: 'Due date, a Tuesday.' },
    { until: '2027-03-16', when: '16 Mar 2027', what: 'The 2 weeks must be used by this date (the first 10 weeks).' },
    { until: '2027-05-31', when: 'about May 2027', what: 'Notice for the second leave, about 8 weeks before it starts. The exact date once Lek knows the start.' },
    { until: '2027-07-31', when: 'about July 2027', what: 'Second leave, when Patrick is about 6 months and his mum starts work. It needs the weeks left over and an agreement with work.' },
    { until: '2028-01-05', when: '5 Jan 2028', what: 'All 9 earmarked weeks used (the child turns 1).' },
  ];
  function nextDate(d) { const t = localDay(d); for (const x of BABY_DATES) if (x.until >= t) return x; return null; }
  // The one thing on top of home: tonight's line of the board when something is written for tonight, otherwise the
  // next date. Before 06:00 "tonight" is still the night that began yesterday evening. Only the grid's rows are read;
  // her six lines never leave the Baby page.
  function babyTop(now) {
    now = now || new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getHours() < 6 ? 1 : 0)), ix = (d.getDay() + 6) % 7;
    const mon = localDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ix));
    const b = readJSON('baby_board_v1'), w = isObj(b) && isObj(b.weeks) && isObj(b.weeks[mon]) ? b.weeks[mon] : {};
    const cell = (r) => (Array.isArray(w[r]) && typeof w[r][ix] === 'string' ? w[r][ix].trim() : '');
    const parts = [['up', 'Up tonight'], ['mum', 'Her block'], ['swap', 'Swap']].filter((r) => cell(r[0])).map((r) => r[1] + ': ' + cell(r[0]));
    if (parts.length) return { kind: 'board', eyebrow: 'tonight, from the board', head: parts[0], text: parts.slice(1).join(' · ') };
    const n = nextDate(now);
    return n ? { kind: 'date', eyebrow: 'the next date', head: n.when, text: n.what } : { kind: 'none', eyebrow: 'the board', head: 'Nothing is written for tonight', text: '' };
  }
  // The three lines, as a card. Each is two optional taps; a tap on the lit one takes it back. Nothing is summed.
  const LINES = [['sleep', 'Did you sleep?', 'Yes', 'Not really'], ['block', 'Did she get her block?', 'Yes', 'Not yet'], ['ate', 'Did anyone eat?', 'Yes', 'Not yet']];
  function minimumCard(onChange) {
    const card = el('section', 'ts-card ts-min3'); card.dataset.min3 = '';
    card.appendChild(el('div', 'ts-eyebrow', 'the minimum · three lines'));
    const paint = () => {
      const cur = minimum();
      card.querySelectorAll('.ts-minrow').forEach((r) => r.remove());
      const foot = card.querySelector('.ts-minfoot');
      LINES.forEach(([k, q, yes, no]) => {
        const row = el('div', 'ts-minrow'); row.dataset.line = k;
        row.appendChild(el('span', '', q));
        [['yes', yes], ['no', no]].forEach(([v, t]) => {
          const b = el('button', 'ts-btn' + (cur[k] === v ? ' ts-on' : ''), t); b.type = 'button'; b.dataset.answer = v;
          b.setAttribute('aria-pressed', cur[k] === v ? 'true' : 'false'); b.setAttribute('aria-label', q + ' ' + t);
          b.addEventListener('click', () => { setMinimum(k, cur[k] === v ? null : v); paint(); if (onChange) onChange(k); });
          row.appendChild(b);
        });
        card.insertBefore(row, foot);
      });
    };
    card.appendChild(el('p', 'ts-minfoot', 'Optional. Kept for today only, and never added up.'));
    paint();
    return card;
  }
  // A Today card that names a minimum and a full: in baby season the minimum is what is read first, and the full one
  // is a step behind (the card's own link where it has one, otherwise one small link that shows its line).
  function seasonCards() {
    const baby = html.hasAttribute('data-baby');
    document.querySelectorAll('.ts-minfull').forEach((mf) => {
      if (!mf.dataset.split) {
        const bs = mf.querySelectorAll(':scope > b');
        if (bs.length !== 2) { mf.dataset.split = 'no'; return; }
        const a = el('span', 'ts-minpart'), b = el('span', 'ts-fullpart');
        let to = a; Array.from(mf.childNodes).forEach((n) => { if (n === bs[1]) to = b; if (n.nodeName !== 'BR') to.appendChild(n); else n.remove(); });
        mf.appendChild(a); mf.appendChild(document.createTextNode(' ')); mf.appendChild(b); mf.dataset.split = 'yes';
      }
      if (mf.dataset.split !== 'yes') return;
      const card = mf.closest('.ts-card'); let link = mf.parentNode.querySelector(':scope > .ts-fullshow');
      if (baby && !link && card && !card.querySelector('.ts-link')) {
        link = el('button', 'ts-link ts-fullshow', 'The full version'); link.type = 'button';
        link.addEventListener('click', () => { mf.classList.add('ts-showfull'); link.hidden = true; });
        mf.parentNode.appendChild(link);
      }
      if (!baby) { mf.classList.remove('ts-showfull'); if (link && link.classList.contains('ts-fullshow')) link.remove(); }
    });
  }

  // which page holds this one, if any: the Portal, the village, or something else (Body's own surface overlay)
  function host() {
    if (!EMBEDDED) return null;
    try {
      const p = new URL(window.parent.location.href), at = (f) => p.href.split(/[?#]/)[0] === ROOT + f;
      if (at('') || at('index.html')) return 'portal';
      if (at('village/') || at('village/index.html')) return 'village';
    } catch (e) { /* another origin: treat it as unknown */ }
    return 'other';
  }
  const url = (key, query) => ROOT + TEMPLES[key].file + (query || '');
  const post = (msg) => { try { window.parent.postMessage(msg, '*'); return true; } catch (e) { return false; } };

  // ── moving ──
  function back() {
    if (EMBEDDED) post('close-temple'); else location.href = url('portal');
  }
  let waiting = null;
  window.addEventListener('message', (e) => {
    if (waiting && e.source === window.parent && e.data && e.data.action === 'goto-ack') { clearTimeout(waiting); waiting = null; }
  });
  function go(key, query) {
    if (!TEMPLES[key]) return false;
    closeSheet();
    if (!EMBEDDED) { location.href = url(key, query); return true; }
    if (host() === key) { post('close-temple'); return true; }          // the page that holds this one is the one asked for
    post({ action: 'goto', app: TEMPLES[key].portal || key });
    if (waiting) clearTimeout(waiting);
    waiting = setTimeout(() => {
      waiting = null;
      // nobody answered. The Portal and the village are apps of their own, so they take the whole window;
      // a temple opens in this same frame, and its back still closes the frame.
      if (key === 'portal' || key === 'village') { try { window.top.location.href = url(key, query); return; } catch (e) { /* fall through */ } }
      location.replace(url(key, query));
    }, 250);
    return true;
  }
  // the director: director.js (step 5) sets TempleShell.openDirector to its sheet. This is what a tap does if that
  // file has not loaded: the temple's own ask sheet where it has one (temple_link.js), otherwise their door in the village.
  function openDirector() {
    const d = DIRECTORS[T.dir]; if (!d) return;
    if (window.TempleLink && typeof window.TempleLink.open === 'function') { window.TempleLink.open(null); return; }
    go('village', d.house ? '?house=' + encodeURIComponent(d.house) : '');
  }

  // ── small builders. Everything is made as elements and text, never as HTML from outside. ──
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const NS = 'http://www.w3.org/2000/svg';
  function sig(name, size) {
    const s = document.createElementNS(NS, 'svg'), u = document.createElementNS(NS, 'use');
    s.setAttribute('class', 'ts-sig'); s.setAttribute('width', size || 24); s.setAttribute('height', size || 24); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    u.setAttribute('href', ROOT + 'sigils.svg#sig-' + name); s.appendChild(u);
    return s;
  }
  function face(id, tag, cls) {
    const d = DIRECTORS[id] || { name: '?' }, f = el(tag || 'span', 'ts-face' + (cls ? ' ' + cls : '')), img = el('img');
    img.alt = ''; img.decoding = 'async'; img.width = 132; img.height = 132;
    img.addEventListener('error', () => { f.textContent = ''; f.appendChild(el('em', '', d.name[0])); });
    img.src = ROOT + 'faces/' + id + '.webp';
    f.appendChild(img);
    return f;
  }
  const directorName = () => { try { if (window.TempleLink && window.TempleLink.who) return window.TempleLink.who(); } catch (e) {} return (DIRECTORS[T.dir] || {}).name || ''; };

  // ── the page ──
  let KEY = null, T = null, sheet = null, scrim = null, lastFocus = null;

  function buildHeader() {
    const body = document.body;
    let head = document.querySelector('header.ts-head');
    if (!head) { head = el('header', 'ts-head'); body.insertBefore(head, body.firstChild); }
    let row = head.querySelector('.ts-hrow');
    if (!row) { row = el('div', 'ts-hrow'); head.insertBefore(row, head.firstChild); }

    // the back button keeps the id the page's own script already bound
    let btn = document.getElementById('back-btn') || document.getElementById('app-back');
    const own = !!btn;
    if (!btn) { btn = el('button'); btn.id = 'back-btn'; btn.addEventListener('click', back); }
    else if (document.body.hasAttribute('data-shell-back')) btn.addEventListener('click', back);
    btn.type = 'button';
    btn.classList.add('ts-back');
    btn.textContent = ''; btn.appendChild(sig('back'));
    btn.setAttribute('aria-label', EMBEDDED ? 'Back' : 'Back to the Portal');
    btn.dataset.shell = own ? 'kept' : 'made';
    if (btn.parentNode !== row) row.insertBefore(btn, row.firstChild);

    let tt = row.querySelector('.ts-tt');
    if (!tt) { tt = el('div', 'ts-tt'); row.appendChild(tt); }
    if (!tt.querySelector('b')) tt.appendChild(el('b', '', body.dataset.name || T.name));
    if (!tt.querySelector('span')) { const sub = body.dataset.sub || T.sub || T.word; if (sub) tt.appendChild(el('span', '', sub)); }

    // step 12: the temple's own sigil beside its name, in its colour (the same drawing as on home, in the bar and in search).
    // Not on home itself: its header is full (the bridge light, A's face), and its sigil is the bar's Today.
    if (KEY !== 'portal' && !row.querySelector('.ts-hsig')) { const hs = sig(KEY === 'magnetic' ? 'beast' : KEY, 26); hs.classList.add('ts-hsig'); hs.dataset.sig = KEY; row.insertBefore(hs, tt); }

    if (T.dir && !row.querySelector('.ts-face')) {
      const f = face(T.dir, 'button'); f.type = 'button'; f.dataset.director = T.dir;
      f.setAttribute('aria-label', directorName());
      f.addEventListener('click', () => api.openDirector());
      row.appendChild(f);
    }
    if (!head.querySelector('.ts-guide') && body.dataset.guide) head.appendChild(el('p', 'ts-guide', body.dataset.guide));
    return head;
  }

  function buildSky() {
    if (document.body.dataset.sky === 'off' || document.querySelector('canvas.ts-sky')) return;
    const c = el('canvas', 'ts-sky'), g = el('div', 'ts-grain');
    document.body.insertBefore(g, document.body.firstChild);
    document.body.insertBefore(c, g);
    const mount = () => { if (window.TempleSky) window.TempleSky.mount(c); };
    if (window.TempleSky) mount();
    else { const s = el('script'); s.src = ROOT + 'sky.js'; s.addEventListener('load', mount); document.head.appendChild(s); }
  }

  function buildBar() {
    const nav = el('nav', 'ts-bar'); nav.setAttribute('aria-label', 'The house');
    const lit = BAR.includes(KEY) ? KEY : 'temples';
    for (const k of BAR) {
      const b = el('button', k === lit ? 'ts-on' : ''); b.type = 'button'; b.dataset.go = k;
      const here = k === 'temples' && lit === 'temples';                 // step 12: in a temple, Temples wears that temple's sigil
      const bs = sig(k === 'temples' ? (here ? (KEY === 'magnetic' ? 'beast' : KEY) : 'grid') : k, 22); bs.dataset.sig = k === 'temples' ? (here ? KEY : 'grid') : k;
      b.appendChild(bs);
      b.appendChild(document.createTextNode(k === 'temples' ? 'Temples' : TEMPLES[k].short));
      if (here) b.setAttribute('aria-label', 'Temples. This is ' + T.name);
      if (k === lit) b.setAttribute('aria-current', 'page');
      b.addEventListener('click', () => { if (k === 'temples') openTemples(); else if (k === KEY) { closeSheet(); window.scrollTo(0, 0); } else go(k); });
      nav.appendChild(b);
    }
    if (T.dir && DIRECTORS[T.dir]) {
      const b = el('button'); b.type = 'button'; b.dataset.director = T.dir;
      b.appendChild(face(T.dir)); b.appendChild(document.createTextNode(directorName()));
      b.addEventListener('click', () => api.openDirector());
      nav.appendChild(b);
    }
    document.body.appendChild(nav);
  }

  function openTemples() {
    if (!sheet) {
      scrim = el('div', 'ts-scrim'); scrim.hidden = true; scrim.addEventListener('click', closeSheet);
      sheet = el('div', 'ts-sheet'); sheet.hidden = true; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-label', 'The temples');
      const head = el('div', 'ts-sheet-head'), nm = el('div');
      nm.appendChild(el('b', '', 'The temples')); nm.appendChild(el('span', '', 'every door, plainly'));
      const x = el('button', 'ts-x'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.appendChild(sig('x', 20)); x.addEventListener('click', closeSheet);
      head.appendChild(nm); head.appendChild(x);
      const bodyEl = el('div', 'ts-sheet-body'), tiles = el('div', 'ts-tiles');
      const sb = el('button', 'ts-searchbtn'); sb.type = 'button'; sb.dataset.open = 'search';     // step 12
      sb.appendChild(sig('search', 22)); sb.appendChild(el('span', '', 'Search the house'));
      sb.addEventListener('click', () => { closeSheet(); openSearch(); });
      bodyEl.appendChild(sb);
      for (const k of GRID) {
        const t = TEMPLES[k], b = el('button', 'ts-tile' + (k === KEY ? ' ts-here' : '')); b.type = 'button'; b.dataset.temple = k; b.dataset.go = k;
        b.appendChild(sig(k, 28));
        const d = el('div', '', t.name); d.appendChild(el('small', '', t.word + (t.note ? ' · ' + t.note : '')));
        b.appendChild(d);
        b.addEventListener('click', () => { if (k === KEY) closeSheet(); else go(k); });
        tiles.appendChild(b);
      }
      bodyEl.appendChild(tiles);
      const st = el('button', 'ts-link', 'Settings: night, one hand, type, baby season'); st.type = 'button'; st.dataset.open = 'settings';
      st.addEventListener('click', () => { closeSheet(); openSettings(); });
      bodyEl.appendChild(st);
      sheet.appendChild(head); sheet.appendChild(bodyEl);
      document.body.appendChild(scrim); document.body.appendChild(sheet);
    }
    lastFocus = document.activeElement;
    scrim.hidden = false; sheet.hidden = false;
    html.style.overflow = 'hidden';
    const x = sheet.querySelector('.ts-x'); if (x) x.focus({ preventScroll: true });
  }
  function closeSheet() {
    if (setSheet && !setSheet.hidden) { setSheet.hidden = true; setScrim.hidden = true; html.style.overflow = ''; }
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true; scrim.hidden = true; html.style.overflow = '';
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) {} }
  }

  // ── step 12: search. search.js and its index are fetched the first time it is opened, never before, so a page that
  // is only looked at carries none of it. Offline they come from the service worker's cache (both are in SHELL). ──
  let searchLoad = null;
  function loadOne(f) { return new Promise((ok, no) => { const s = el('script'); s.src = ROOT + f; s.addEventListener('load', ok); s.addEventListener('error', no); document.head.appendChild(s); }); }
  function openSearch(q) {
    if (!KEY) return Promise.resolve(false);
    if (window.TempleSearch) { window.TempleSearch.open(q); return Promise.resolve(true); }
    if (!searchLoad) searchLoad = loadOne('search_index.js').catch(() => {}).then(() => loadOne('search.js'));
    return searchLoad.then(() => { if (window.TempleSearch) window.TempleSearch.open(q); return !!window.TempleSearch; }, () => { searchLoad = null; return false; });
  }
  // "/" opens it from a keyboard, unless something is being typed
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || !booted) return;
    const a = document.activeElement; if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return;
    e.preventDefault(); openSearch();
  });

  // ── step 11: the Settings sheet. Four things, each said plainly; a tap is the only thing that changes one. ──
  let setSheet = null, setScrim = null;
  function paintSettings() {
    if (!setSheet) return;
    const m = modes(), box = setSheet.querySelector('.ts-sheet-body'), stamp = JSON.stringify([m.baby, m.night, m.oneHand, m.largeType, m.nightFrom, m.nightTo]);
    if (box.dataset.stamp === stamp) return;                             // nothing changed: leave the sheet, and his focus, alone
    box.dataset.stamp = stamp; box.textContent = '';
    const block = (title, say) => { const c = el('div', 'ts-set'); const t = el('div', 'ts-setrow'); const tx = el('span'); tx.appendChild(el('b', '', title)); tx.appendChild(el('small', '', say)); t.appendChild(tx); c.appendChild(t); box.appendChild(c); return t; };
    const sw = (key, title, say) => {
      const row = block(title, say), b = el('button', 'ts-btn' + (m[key] ? ' ts-on' : ''), m[key] ? 'On' : 'Off'); b.type = 'button'; b.dataset.mode = key;
      b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', m[key] ? 'true' : 'false'); b.setAttribute('aria-label', title);
      b.addEventListener('click', () => { setMode(key, !modes()[key]); const again = setSheet.querySelector('[data-mode="' + key + '"]'); if (again) again.focus({ preventScroll: true }); });
      row.appendChild(b);
    };
    sw('baby', 'Baby season', 'Home shows one thing on top and the three lines. A temple with a short road offers it first. Only this switch turns it on or off, never the app and never a date.');
    const hh = (h) => String(h).padStart(2, '0') + ':00';
    const nrow = block('Night skin', 'Darker, a size larger, still and silent. By the clock it is ' + hh(m.nightFrom) + ' to ' + hh(m.nightTo) + '. Always is for a night shift; never leaves the day skin on.').parentNode;
    const pills = el('div', 'ts-pills ts-nightset'); pills.setAttribute('role', 'group'); pills.setAttribute('aria-label', 'Night skin');
    [['auto', 'By the clock'], ['on', 'Always'], ['off', 'Never']].forEach(([v, t]) => {
      const b = el('button', m.night === v ? 'ts-on' : '', t); b.type = 'button'; b.dataset.nightSet = v; b.setAttribute('aria-pressed', m.night === v ? 'true' : 'false');
      b.addEventListener('click', () => { setMode('night', v); const again = setSheet.querySelector('[data-night-set="' + v + '"]'); if (again) again.focus({ preventScroll: true }); });
      pills.appendChild(b);
    });
    nrow.appendChild(pills);
    sw('oneHand', 'One hand', 'The page starts a third of the way down, back sits in the bar, and sheets stay low.');
    sw('largeType', 'Large type', 'Everything a size larger.');
    box.appendChild(el('p', 'ts-quiet', 'These are kept on this phone. Nothing here is counted, and nothing is sent.'));
  }
  function openSettings() {
    if (!KEY) return;
    if (!setSheet) {
      setScrim = el('div', 'ts-scrim'); setScrim.hidden = true; setScrim.addEventListener('click', closeSheet);
      setSheet = el('div', 'ts-sheet ts-setsheet'); setSheet.hidden = true; setSheet.setAttribute('role', 'dialog'); setSheet.setAttribute('aria-modal', 'true'); setSheet.setAttribute('aria-label', 'Settings');
      const head = el('div', 'ts-sheet-head'), nm = el('div');
      nm.appendChild(el('b', '', 'Settings')); nm.appendChild(el('span', '', 'how the house is lit'));
      const x = el('button', 'ts-x'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.appendChild(sig('x', 20)); x.addEventListener('click', closeSheet);
      head.appendChild(nm); head.appendChild(x);
      setSheet.appendChild(head); setSheet.appendChild(el('div', 'ts-sheet-body'));
      document.body.appendChild(setScrim); document.body.appendChild(setSheet);
    }
    paintSettings();
    lastFocus = document.activeElement;
    setScrim.hidden = false; setSheet.hidden = false; html.style.overflow = 'hidden';
    const x = setSheet.querySelector('.ts-x'); if (x) x.focus({ preventScroll: true });
  }
  // one hand: the bar's back shows only while the header's own back does (Body's doors, opened alone, have none)
  // It is the header's back, mirrored where the thumb is: it presses the real one, so it means what that means. Out of
  // one-hand mode it is not in the bar at all.
  function syncBack() {
    const nav = document.querySelector('nav.ts-bar'); if (!nav) return;
    const b = document.querySelector('.ts-head .ts-back');
    let mb = nav.querySelector('.ts-barback'), shown = false;
    if (b && html.hasAttribute('data-onehand')) { const cs = getComputedStyle(b); shown = !b.hidden && cs.display !== 'none' && cs.visibility !== 'hidden'; }
    if (shown && !mb) {
      mb = el('button', 'ts-barback'); mb.type = 'button'; mb.dataset.mirror = 'back';
      mb.appendChild(sig('back', 22)); mb.appendChild(document.createTextNode('Back'));
      mb.addEventListener('click', () => { const real = document.querySelector('.ts-head .ts-back'); if (real) real.click(); });
      nav.insertBefore(mb, nav.firstChild);
    } else if (!shown && mb) mb.remove();
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

  const api = window.TempleShell = { ROOT, EMBEDDED, TEMPLES, DIRECTORS, GRID, host, go, back, openTemples, closeSheet, openDirector, openSearch, sig, face, isNight, temple: null,
    MODES, modes, setMode, openSettings, minimum, setMinimum, minimumCard, sleep, sleepLine, babyTop, babyDates: BABY_DATES, nextDate, localDay, refreshModes: applyModes };

  // ── step 12: what a screen reader needs and the pages' own scripts do not say. Nothing visible changes. ──
  //   · the temple's name in the header is the page's first heading; a section line (.ts-sec) and a sheet's title are
  //     second-level headings, so the headings are in order on every page without touching a page's markup;
  //   · a field whose only name is its placeholder gets that as its label.
  // Run once at boot and again, a moment later, whenever a page redraws itself.
  function polish() {
    const h = document.querySelector('.ts-head .ts-tt b'); if (h && !h.hasAttribute('role')) { h.setAttribute('role', 'heading'); h.setAttribute('aria-level', '1'); }
    document.querySelectorAll('.ts-sec:not([role]), .ts-sheet-head b:not([role])').forEach((e) => { if (/^H[1-6]$/.test(e.tagName)) return; e.setAttribute('role', 'heading'); e.setAttribute('aria-level', '2'); });
    document.querySelectorAll('input[placeholder]:not([aria-label]):not([aria-labelledby]), textarea[placeholder]:not([aria-label]):not([aria-labelledby])').forEach((e) => {
      if (e.type === 'hidden' || e.closest('label') || (e.id && document.querySelector('label[for="' + e.id.replace(/"/g, '') + '"]'))) return;
      if (e.placeholder.trim()) e.setAttribute('aria-label', e.placeholder.trim());
    });
  }
  let polishing = null;
  const polishSoon = () => { if (!polishing) polishing = setTimeout(() => { polishing = null; polish(); }, 120); };

  function boot() {
    KEY = document.body && document.body.dataset.temple;
    if (!KEY || !TEMPLES[KEY]) return;                                    // not a page of the new frame: do nothing at all
    T = TEMPLES[KEY]; api.temple = KEY;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = el('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
    meta.content = html.hasAttribute('data-night') ? '#0D0C12' : '#15131B';
    if (!document.querySelector('link[rel~="icon"]')) { const l = el('link'); l.rel = 'icon'; l.type = 'image/svg+xml'; l.href = ROOT + 'icon.svg'; document.head.appendChild(l); }   // standalone, a tab or a shortcut gets the house's icon
    buildHeader(); buildSky(); buildBar();
    // step 5: the directors in every page of the frame. Four files, in this order; a page that loaded them itself (home) is left alone.
    if (!window.TempleDirector) for (const f of ['appblock.js', 'talk.js', 'dayplan.js', 'director.js']) {
      if ((f === 'appblock.js' && window.TempleAppBlock) || (f === 'talk.js' && window.TempleTalk) || (f === 'dayplan.js' && window.TemplePlan)) continue;
      const s = el('script'); s.src = ROOT + f; s.async = false; document.head.appendChild(s);
    }
    booted = true; applyModes();                                         // step 11: the minimum first, the sleep line, the bar's back
    { const b = document.querySelector('.ts-head .ts-back'); if (b && window.MutationObserver) new MutationObserver(syncBack).observe(b, { attributes: true }); }
    document.addEventListener('click', () => setTimeout(syncBack, 0));
    polish(); if (window.MutationObserver) new MutationObserver(polishSoon).observe(document.body, { childList: true, subtree: true });   // step 12
    html.setAttribute('data-shell', 'ready');
    // offline: one service worker for the whole site, at the apps/ root. It never touches localStorage.
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register(ROOT + 'sw.js').catch(() => {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
