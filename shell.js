// shell.js · the shared frame of the Portal remake (step 3 of portal_remake/BUILD_PLAN.md).
//
// A page opts in with <body data-temple="mirror">, temple.css, and this file in the <head> (no defer, so the night skin
// is set before the first paint; pages in a subfolder load ../shell.js). The page keeps its own script, ids, data and
// stores. This file reads and writes no store, and sends nothing anywhere.
//
// What it adds:
//   · the header: back, the temple's name, its director's face, one guide line. A <header class="ts-head"> already
//     in the page is used as it is and only the missing parts are filled in.
//   · THE BACK CONTRACT. The button keeps the id the page's own script binds: an existing #back-btn or #app-back is
//     moved into the header with its listeners. If the page has none, one is made as #back-btn and bound here:
//     embedded it posts 'close-temple' to the parent, exactly as the thirteen pages do; standalone it opens the Portal.
//   · the sky band (sky.js) behind the header.
//   · the bottom bar: Today · Temples · Mirror · Village, and the temple's director as the fifth.
//   · the Temples sheet: every door, plainly (thirteen since step 8: Baby).
//   · moving sideways: TempleShell.go('body'). Standalone it is a plain link. Embedded it posts
//     {action:'goto', app:'body'} to the parent; a parent that handles it answers {action:'goto-ack'}. Today's Portal
//     does not yet (step 4), so with no answer in 250 ms the frame opens the page itself.
//   · the night skin by the clock (never by a tap): <html data-night> from 21:00 to 06:00.
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
    mirror:      { name: 'The Weekly Mirror', short: 'Mirror', word: 'the mirror', sub: 'what was there', file: 'mirror.html', dir: 'a' },   // becomes Patterns in step 7
    kaching:     { name: 'Kaching', short: 'Kaching', word: 'the ledger', sub: 'leave sums, the tally', file: 'kaching.html', dir: 'ngoen' },
    baby:        { name: 'Baby', short: 'Baby', word: 'the lit window', sub: 'the night-shift board', file: 'baby.html', dir: 'malee' },   // step 8
    magnetic:    { name: 'Magnetic Temple', short: 'Magnetic', word: 'fire', sub: 'the older cut', file: 'magnetic_temple.html', dir: 'rak', hidden: true },
  };
  const GRID = ['body', 'inner', 'breath', 'beast', 'observatory', 'village', 'healing', 'vocal', 'strings', 'hibrations', 'mirror', 'kaching', 'baby'];
  const BAR = ['portal', 'temples', 'mirror', 'village'];               // and the director's face as the fifth (Lek, 11-14)
  const DIRECTORS = {
    a: { name: 'A', house: null }, garr: { name: 'Garr', house: 'fitness' }, hekka: { name: 'Hekka', house: 'esoteric' },
    rak: { name: 'Rak', house: 'cupidity' }, thorn: { name: 'Thorn', house: 'halohorns' }, nokka: { name: 'Nokka', house: 'hibrations' },
    ngoen: { name: 'Ngoen', house: 'kaching' }, paa: { name: 'Paa', house: 'hobby' }, malee: { name: 'Malee', house: 'baby' },
  };

  // ── before the first paint: where am I, when am I ──
  html.setAttribute(EMBEDDED ? 'data-embedded' : 'data-standalone', '');
  const isNight = (d) => { const h = (d || new Date()).getHours(); return h >= NIGHT_FROM || h < NIGHT_TO; };
  function setNight() {
    const n = isNight();
    if (n !== html.hasAttribute('data-night')) { html.toggleAttribute('data-night', n); if (window.TempleSky) window.TempleSky.redraw(); }
  }
  setNight();
  setInterval(setNight, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setNight(); });

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
      b.appendChild(sig(k === 'temples' ? 'grid' : k, 22));
      b.appendChild(document.createTextNode(k === 'temples' ? 'Temples' : TEMPLES[k].short));
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
      for (const k of GRID) {
        const t = TEMPLES[k], b = el('button', 'ts-tile' + (k === KEY ? ' ts-here' : '')); b.type = 'button'; b.dataset.temple = k; b.dataset.go = k;
        b.appendChild(sig(k, 28));
        const d = el('div', '', t.name); d.appendChild(el('small', '', t.word + (t.note ? ' · ' + t.note : '')));
        b.appendChild(d);
        b.addEventListener('click', () => { if (k === KEY) closeSheet(); else go(k); });
        tiles.appendChild(b);
      }
      bodyEl.appendChild(tiles);
      sheet.appendChild(head); sheet.appendChild(bodyEl);
      document.body.appendChild(scrim); document.body.appendChild(sheet);
    }
    lastFocus = document.activeElement;
    scrim.hidden = false; sheet.hidden = false;
    html.style.overflow = 'hidden';
    const x = sheet.querySelector('.ts-x'); if (x) x.focus({ preventScroll: true });
  }
  function closeSheet() {
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true; scrim.hidden = true; html.style.overflow = '';
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) {} }
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

  const api = window.TempleShell = { ROOT, EMBEDDED, TEMPLES, DIRECTORS, GRID, host, go, back, openTemples, closeSheet, openDirector, sig, face, isNight, temple: null };

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
    html.setAttribute('data-shell', 'ready');
    // offline: one service worker for the whole site, at the apps/ root. It never touches localStorage.
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register(ROOT + 'sw.js').catch(() => {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
