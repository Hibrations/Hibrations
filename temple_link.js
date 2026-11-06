// Lysningen step 8, part two: the temple links for Hekka, Paa, Nokka, Ngoen and Rak, the way Garr's works.
//
// One file, loaded by the temples (<script src="temple_link.js" data-app="breath">) and by the village (no data-app).
//   Level 1  snapshot(app): what the village sends the PC for that temple's director. The village only reads the stores.
//   Level 2  After Lek's yes a proposal waits in link_inbox_v1, and the temple lands it itself:
//            - on a shelf (link_<app>_v1), its own store, so it can't touch Lek's sessions or notes;
//            - or, in Inner and Hibrations, as a new version with the old one kept (a separate one if Lek changed his
//              since the director looked). Those two pages lend their store through window.templeLinkHost.
//   Level 3  The button: a question or a note goes straight to the PC with the village's pairing, and the answer comes
//            back here and in the village.
//
// Never on an empty store, never mid-edit, never twice. Strings logs nothing on purpose (Paa's rule) and Kaching's numbers
// are demo, so those two have no snapshot. The Observatory sends only the tarot draw: the chart people stay on the phone.
(function () {
  'use strict';

  const APPS = {
    breath: { who: 'Hekka', house: 'esoteric', name: 'the Breath Temple' },
    inner: { who: 'Hekka', house: 'esoteric', name: 'the Inner Temple' },
    healing: { who: 'Hekka', house: 'esoteric', name: 'the Healing Temple' },
    observatory: { who: 'Hekka', house: 'esoteric', name: 'the Observatory' },
    strings: { who: 'Paa', house: 'hobby', name: 'Strings' },
    hibrations: { who: 'Nokka', house: 'hibrations', name: 'Hibrations' },
    kaching: { who: 'Ngoen', house: 'kaching', name: 'Kaching' },
    beast: { who: 'Rak', house: 'cupidity', name: 'the Beast Temple' },
    magnetic: { who: 'Rak', house: 'cupidity', name: 'the Magnetic Temple' },
  };
  const INBOX = 'link_inbox_v1';
  const has = (app) => Object.prototype.hasOwnProperty.call(APPS, app);
  const storeKey = (app) => 'link_' + app + '_v1';

  function read(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  const cut = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(36); }

  // ── the fingerprints: if these differ when a proposal lands, Lek changed his since the director looked ──
  function practiceHash(p) {
    return hash(JSON.stringify([p.name || '', p.subtitle || '', p.duration || '', p.intro || '', p.closing || '',
      (p.steps || []).map((s) => [s.letter || '', s.name || '', s.libraryId || '', s.duration || 0, s.cues || ''])]));
  }
  function pieceHash(p) { return hash(JSON.stringify([p.title || '', p.body || ''])); }

  // ── level 1: what the village sends. Cut to size; never more than MAX for one temple. ──
  const MAX = 250000;
  const size = (o) => { const s = JSON.stringify(o); try { return new TextEncoder().encode(s).length; } catch (e) { return s.length; } };
  function fit(snap, field) { // fewer rows rather than none: the PC keeps the sessions it already has
    while (size(snap) > MAX && snap[field].length > 5) snap = Object.assign({}, snap, { [field]: snap[field].slice(0, Math.floor(snap[field].length / 2)) });
    return size(snap) > MAX ? null : snap;
  }
  function plainSessions(st) {
    if (!st || !Array.isArray(st.sessions)) return null;
    return fit({ sessions: st.sessions.slice(0, 200).map((s) => ({ id: s.id, practiceId: s.practiceId, name: cut(s.name, 80), stack: cut(s.stack, 40), at: s.at, notes: cut(s.notes, 800) })) }, 'sessions');
  }
  const SNAP = {
    breath: () => plainSessions(read('breath_temple_v1', null)),
    beast: () => plainSessions(read('beast_temple_v1', null)),
    magnetic: () => plainSessions(read('magnetic_temple_v1', null)),
    inner: () => {
      const st = read('inner_temple_v1', null); if (!st || !Array.isArray(st.practices)) return null;
      return fit({
        sessions: (st.sessions || []).slice(0, 150).map((s) => ({ id: s.id, date: s.date, practiceId: s.practiceId, practiceName: cut(s.practiceName, 80), finalNotes: cut(s.finalNotes, 800),
          steps: (s.steps || []).slice(0, 30).map((x) => ({ name: cut(x.name, 80), done: !!x.done, notes: cut(x.notes, 300) })) })),
        practices: st.practices.slice(0, 40).map((p) => ({ id: p.id, name: cut(p.name, 80), subtitle: cut(p.subtitle, 160), duration: cut(p.duration, 30), intro: cut(p.intro, 500), closing: cut(p.closing, 300), by: cut(p.by, 20), versions: (p.history || []).length, hash: practiceHash(p),
          steps: (p.steps || []).slice(0, 30).map((x) => ({ letter: cut(x.letter, 3), name: cut(x.name, 80), libraryId: cut(x.libraryId, 60), duration: x.duration, cues: cut(x.cues, 300) })) })),
        schedule: st.schedule && typeof st.schedule === 'object' ? st.schedule : {},
      }, 'sessions');
    },
    healing: () => {
      const st = read('grimoire_v1', null); if (!st || !Array.isArray(st.sessions)) return null;
      const notes = {}; for (const [k, v] of Object.entries(st.notes || {}).slice(0, 80)) if (typeof v === 'string' && v.trim()) notes[cut(k, 60)] = cut(v, 1500);
      return fit({ sessions: st.sessions.slice(0, 60).map((s) => ({ id: s.id, name: cut(s.name, 80), at: s.at })), notes }, 'sessions');
    },
    observatory: () => {
      const st = read('tarot_v1', null); if (!st || (!st.dailyDate && !st.spread)) return null;
      return { dailyDate: st.dailyDate || null, dailyCardN: st.dailyCardN == null ? null : st.dailyCardN, spread: Array.isArray(st.spread) ? st.spread.slice(0, 3) : null };
    },
    hibrations: () => {
      const st = read('hibrations_v1', null); if (!st || !Array.isArray(st.pieces)) return null;
      const pieces = st.pieces.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 300).map((p) => ({ id: p.id, title: cut(p.title, 160), body: cut(p.body, 12000), cutShort: (p.body || '').length > 12000 || undefined, stage: cut(p.stage, 20), tags: Array.isArray(p.tags) ? p.tags.slice(0, 12) : [], medium: cut(p.medium, 40),
        by: cut(p.by, 20), versions: (p.versions || []).length, updatedAt: p.updatedAt, shippedAt: p.shippedAt, hash: pieceHash(p) }));
      return fit({ pieces }, 'pieces');
    },
  };
  function snapshot(app) { try { return SNAP[app] ? SNAP[app]() : null; } catch (e) { return null; } }

  // the village, after Lek's yes: into the inbox, once (the card id is the key)
  function offerIn(d) {
    if (!d || typeof d.id !== 'string' || !has(d.app) || !d.item || typeof d.item !== 'object') return false;
    const box = read(INBOX, { items: [] }); if (!Array.isArray(box.items)) box.items = [];
    if (box.items.some((x) => x && x.id === d.id)) return false;
    box.items.push({ id: d.id, app: d.app, kind: d.kind, targetId: d.targetId || null, base: d.base || null, item: d.item, why: d.why || '', by: d.by || APPS[d.app].who, at: d.at || new Date().toISOString(), status: 'waiting' });
    return write(INBOX, box);
  }

  window.TempleLink = { APPS, INBOX, has, storeKey, snapshot, snaps: Object.keys(SNAP), offerIn, practiceHash, pieceHash, str, size };

  // ─────────────── the temple's side: only when loaded with a data-app ───────────────
  const me = document.currentScript;
  const APP = me && me.dataset.app;
  if (!APP || !has(APP)) return;
  const A = APPS[APP], KEY = storeKey(APP);

  function who() { // the name from the PC's content, once the village has it
    const v = read('village_v1', null), c = v && v.content && v.content.data && v.content.data.villagers && v.content.data.villagers[A.house + '.d'];
    return (c && c.name) || A.who;
  }
  const bridge = () => { const v = read('village_v1', null); return v && v.bridge && v.bridge.url && v.bridge.token ? v.bridge : null; };
  function loadStore() { const s = read(KEY, null) || {}; return { asks: Array.isArray(s.asks) ? s.asks : [], shelf: Array.isArray(s.shelf) ? s.shelf : [], landed: s.landed && typeof s.landed === 'object' ? s.landed : {}, seen: s.seen || 0 }; }
  const saveStore = (s) => write(KEY, s);
  const rid = () => 'link-' + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 6);

  // ── level 2: landing ──
  function land() {
    const box = read(INBOX, null); if (!box || !Array.isArray(box.items)) return 0;
    const mine = box.items.filter((x) => x && x.app === APP && x.status === 'waiting' && typeof x.id === 'string');
    if (!mine.length) return 0;
    const st = loadStore(), host = window.templeLinkHost, now = new Date().toISOString();
    let n = 0, hostLanded = false;
    for (const x of mine) {
      if (st.landed[x.id]) { x.status = 'landed:' + st.landed[x.id]; continue; }
      if (x.kind === 'shelf') {
        const it = x.item || {}, title = str(it.title, 100), text = str(it.text, 4000);
        if (!title && !text) { x.status = 'refused'; continue; }
        st.shelf.push({ id: x.id, title: title || 'a suggestion', text, why: str(x.why, 500), by: str(x.by, 30), at: now });
        st.shelf = st.shelf.slice(-200);
        x.status = 'landed:shelf'; st.landed[x.id] = 'shelf'; n++;
      } else {
        if (!host || !host.land || (host.busy && host.busy())) continue; // Lek's own edit goes first
        let r; try { r = host.land(x); } catch (e) { r = null; }
        if (r === 'wait') continue;
        if (!r) { x.status = 'refused'; continue; }
        x.status = 'landed:' + r.how; x.landedName = r.name; x.landedAt = now; st.landed[x.id] = r.how; n++; hostLanded = true;
      }
    }
    saveStore(st);
    write(INBOX, box);
    if (n) { const v = document.getElementById('tl-btn'); if (v) v.classList.add('dot'); if (hostLanded && host.refresh) host.refresh(); paint(); }
    return n;
  }

  // ── level 3: the button ──
  let busy = false;
  async function syncAsks() {
    const br = bridge(); if (!br || busy || !navigator.onLine) return;
    const pending = loadStore().asks.filter((a) => !a.answer && Date.now() - Date.parse(a.at) < 14 * 864e5);
    if (!pending.length) return;
    busy = true;
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 10000);
    try {
      const res = await fetch(br.url + '/temple', { method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + br.token },
        body: JSON.stringify({ app: APP, asks: pending.map((a) => ({ id: a.id, text: a.text, at: a.at, ref: a.ref })) }) });
      if (!res.ok) return;
      const data = await res.json(), s = loadStore(); let got = 0; // read again: another window may have added a note
      for (const a of s.asks) {
        if ((data.acked || []).includes(a.id)) a.acked = true;
        const ans = data.answers && data.answers[a.id];
        if (ans && !a.answer && typeof ans.text === 'string') { a.answer = ans.text.slice(0, 6000); a.answeredAt = ans.at; got++; }
      }
      saveStore(s);
      if (got) { const v = document.getElementById('tl-btn'); if (v) v.classList.add('dot'); }
      paint();
    } catch (e) { /* the PC isn't reachable: the note waits */ } finally { clearTimeout(t); busy = false; }
  }
  const NOTE_MAX = 5000; // the bridge drops a longer one (validItem), so the box refuses it and keeps the words
  function send(text, ref) {
    text = String(text || '').trim(); if (!text || text.length > NOTE_MAX) return false;
    const s = loadStore();
    s.asks.push({ id: rid(), text, at: new Date().toISOString(), ref: ref || undefined });
    s.asks = s.asks.slice(-60);
    if (!saveStore(s)) return false;
    syncAsks();
    return true;
  }

  // ── the sheet. Everything from outside goes in as text, never as HTML. ──
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  let openRef = null, isOpen = false, showAway = false;
  function paint() {
    const root = document.getElementById('tl-sheet'); if (!root || !isOpen) return;
    const keep = root.querySelector('textarea'), draft = keep ? keep.value : '', st = loadStore(), name = who();
    root.textContent = '';
    const head = el('div', 'tl-head');
    head.appendChild(el('div', 'tl-title', 'to ' + name));
    const x = el('button', 'tl-x', '×'); x.setAttribute('aria-label', 'close'); x.addEventListener('click', closeSheet); head.appendChild(x);
    root.appendChild(head);
    if (openRef) root.appendChild(el('div', 'tl-sub', 'about ' + (openRef.name || 'this')));
    const ta = el('textarea', 'tl-text'); ta.rows = 3; ta.placeholder = 'a question or a note'; ta.value = draft; root.appendChild(ta);
    const row = el('div', 'tl-row');
    row.appendChild(el('div', 'tl-hint', bridge() ? 'The answer comes back here and in the village.' : 'The village isn’t paired with the PC yet. The note waits here and goes when it is.'));
    const go = el('button', 'tl-send', 'send');
    const hint = row.firstChild, usual = hint.textContent;
    const fits = () => { const over = ta.value.trim().length - NOTE_MAX; hint.textContent = over > 0 ? `Too long to send: ${over.toLocaleString('en-GB')} characters over. A note holds ${NOTE_MAX.toLocaleString('en-GB')}. Your words stay here.` : usual; hint.style.color = over > 0 ? '#e8c37e' : ''; return over <= 0; };
    ta.addEventListener('input', fits); fits();
    go.addEventListener('click', () => { if (fits() && send(ta.value, openRef)) { ta.value = ''; openRef = null; paint(); } });
    row.appendChild(go); root.appendChild(row);

    const here = st.shelf.filter((i) => !i.away), away = st.shelf.filter((i) => i.away);
    if (here.length || away.length) root.appendChild(el('div', 'tl-sec', 'from ' + name));
    for (const i of here.slice().reverse()) root.appendChild(shelfItem(i));
    if (away.length) {
      const t = el('button', 'tl-link', (showAway ? 'hide' : 'show') + ' what’s put away');
      t.addEventListener('click', () => { showAway = !showAway; paint(); }); root.appendChild(t);
      if (showAway) for (const i of away.slice().reverse()) root.appendChild(shelfItem(i));
    }
    const asks = st.asks.slice(-6).reverse();
    if (asks.length) {
      const box = el('div', 'tl-thread');
      for (const a of asks) {
        box.appendChild(el('div', 'tl-q', a.text));
        box.appendChild(el('div', a.answer ? 'tl-a' : 'tl-wait', a.answer ? name + ': ' + a.answer : a.acked ? 'with ' + name + '…' : 'waiting for the PC'));
      }
      root.appendChild(box);
    }
  }
  function shelfItem(i) {
    const c = el('div', 'tl-item' + (i.away ? ' tl-away' : ''));
    c.appendChild(el('div', 'tl-item-t', i.title));
    if (i.text) c.appendChild(el('div', 'tl-item-b', i.text));
    if (i.why) c.appendChild(el('div', 'tl-item-w', i.why));
    const acts = el('div', 'tl-acts');
    const ask = el('button', 'tl-link', 'ask about this');
    ask.addEventListener('click', () => { openRef = { kind: 'shelf', id: String(i.id).slice(0, 60), name: String(i.title).slice(0, 80) }; paint(); });
    const put = el('button', 'tl-link', i.away ? 'bring back' : 'put away');
    put.addEventListener('click', () => { const s = loadStore(), m = s.shelf.find((y) => y.id === i.id); if (m) { m.away = !m.away; saveStore(s); } paint(); });
    acts.appendChild(ask); acts.appendChild(put); c.appendChild(acts);
    return c;
  }
  function openSheet(ref) {
    mount();
    openRef = ref || null; isOpen = true;
    document.getElementById('tl-wrap').classList.add('open');
    const b = document.getElementById('tl-btn'); if (b) b.classList.remove('dot');
    paint(); syncAsks();
  }
  function closeSheet() { isOpen = false; document.getElementById('tl-wrap').classList.remove('open'); }

  const CSS = `
#tl-btn{position:fixed;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + var(--tl-bottom,76px));z-index:9000;font:500 12px/1 Inter,system-ui,sans-serif;letter-spacing:.04em;color:#e9dfcf;background:rgba(20,17,13,.88);border:1px solid rgba(232,195,126,.45);border-radius:18px;padding:9px 13px;cursor:pointer;-webkit-tap-highlight-color:transparent}
#tl-btn.dot::after{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:#e8c37e;margin-left:6px;vertical-align:1px}
#tl-wrap{display:none;position:fixed;inset:0;z-index:9001;background:rgba(0,0,0,.45)}
#tl-wrap.open{display:block}
#tl-sheet{position:absolute;left:0;right:0;bottom:0;max-height:82vh;overflow-y:auto;box-sizing:border-box;background:#14110d;color:#e9dfcf;border-top:1px solid rgba(232,195,126,.35);border-radius:16px 16px 0 0;padding:14px 16px calc(env(safe-area-inset-bottom,0px) + 18px);font:14px/1.45 Inter,system-ui,sans-serif;max-width:560px;margin:0 auto}
#tl-sheet button{font:inherit;cursor:pointer}
.tl-head{display:flex;justify-content:space-between;align-items:center}
.tl-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:21px}
.tl-x{background:none;border:0;color:#a79f90;font-size:24px!important;line-height:1;padding:2px 6px}
.tl-sub{color:#a79f90;font-size:12px;margin:2px 0 4px}
.tl-text{display:block;width:100%;box-sizing:border-box;margin-top:8px;background:#0c0a07;color:#e9dfcf;border:1px solid rgba(232,195,126,.25);border-radius:10px;padding:10px;font:16px/1.4 Inter,system-ui,sans-serif;resize:vertical}
.tl-row{display:flex;gap:12px;align-items:center;justify-content:space-between;margin-top:8px}
.tl-hint{color:#a79f90;font-size:12px;line-height:1.35}
.tl-send{flex:none;background:#e8c37e;color:#14110d;border:0;border-radius:10px;padding:9px 18px;font-weight:600!important}
.tl-sec{margin-top:16px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#a79f90}
.tl-item{margin-top:8px;border:1px solid rgba(232,195,126,.2);border-radius:10px;padding:10px 12px}
.tl-away{opacity:.65}
.tl-item-t{font-weight:600}
.tl-item-b{white-space:pre-wrap;margin-top:4px}
.tl-item-w{margin-top:6px;color:#a79f90;font-style:italic;font-size:13px}
.tl-acts{display:flex;gap:16px;margin-top:6px}
.tl-link{background:none;border:0;padding:4px 0;color:#e8c37e;font-size:12px!important}
.tl-thread{margin-top:16px;display:flex;flex-direction:column;gap:4px}
.tl-q{margin-top:6px}
.tl-a{color:#c9c0b0;border-left:2px solid rgba(232,195,126,.45);padding-left:8px;white-space:pre-wrap}
.tl-wait{color:#a79f90;font-size:11px;letter-spacing:.06em}
.tl-from{font-size:12px;color:#a79f90;font-style:italic;line-height:1.45;margin-top:4px}`;
  function mount() {
    if (document.getElementById('tl-btn')) return;
    const style = el('style'); style.textContent = CSS; document.head.appendChild(style);
    if (me.dataset.bottom) document.documentElement.style.setProperty('--tl-bottom', me.dataset.bottom);
    const b = el('button', '', who()); b.id = 'tl-btn'; b.type = 'button'; b.addEventListener('click', () => openSheet(null));
    const wrap = el('div'); wrap.id = 'tl-wrap'; wrap.addEventListener('click', (e) => { if (e.target === wrap) closeSheet(); });
    const sheet = el('div'); sheet.id = 'tl-sheet'; wrap.appendChild(sheet);
    document.body.appendChild(b); document.body.appendChild(wrap);
  }
  // a link a host page puts beside one of its own things (a practice, a piece)
  function linkTo(ref, label) {
    const b = el('button', 'tl-link', label || 'ask ' + who());
    b.style.cssText = 'background:none;border:0;padding:4px 0;color:inherit;opacity:.8;font-size:12px;cursor:pointer';
    b.addEventListener('click', (e) => { e.stopPropagation(); openSheet(ref); });
    return b;
  }
  Object.assign(window.TempleLink, { app: APP, who, open: openSheet, linkTo, land });

  function boot() { mount(); land(); syncAsks(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  setInterval(() => { if (document.visibilityState === 'visible') { land(); syncAsks(); } }, 20000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { land(); syncAsks(); paint(); } });
  window.addEventListener('storage', (e) => { if (e.key === INBOX) land(); else if (e.key === KEY) paint(); });
})();
