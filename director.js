// director.js · the directors inside the temples (Portal remake step 5; portal_remake/BUILD_PLAN.md §3).
//
// Loaded by shell.js on every page that wears the frame, after appblock.js, talk.js and dayplan.js.
//   · the state line under the header and the face in the bar open the director's sheet: Talk, Advice, Shelf
//   · TALK is the village's own thread: the same IndexedDB records (talk.js), the same drafts and read marks, and the
//     same road to the PC (an outbox item of kind 'message' with chat: true, POSTed to the bridge's /sync). A line
//     written here is in the village, and the other way round. Offline or with the PC off it waits, and says so.
//   · ADVICE and the STATE LINE are only ever what a director actually wrote: the parsed "=== APP ===" block of a real
//     answer (appblock.js), or what the bridge's /portal route sends once step 6 builds it. With nothing stored the
//     sheet says so. Nothing is invented on the phone.
//   · a yes on a card places it in today's plan (dayplan.js); not-now sets it down on the shelf, and it is not raised again
//   · "ask about this": TempleDirector.ask(ref, dir), or any element with data-ask="kind:id" data-ask-name="…"
//   · the cross-house lens line: TempleDirector.lenses(practiceId, name). The lines are the houses' content and arrive
//     from the PC; the app never writes one.
//   · on home: A's card, the council (two to four, asked once, through the bridge's meeting), the houses' state lines
//     behind one switch, and the bridge light.
// Cupidity is whole inside and thin outside: nothing of Rak's is drawn on home, and a line to him never asks for a buzz.
// Nothing here sends a notification, counts anything or raises anything twice.
//
// Stores. Shared with the village, never reshaped: village_outbox_v1 (its own items are added, and removed once the PC
// has them), village_drafts_v1, village_read_v1, IndexedDB lysningen/threads. Read only: village_v1 (the pairing, the
// names, briefs and cards), village_cursor_v1 (where to start), link_<app>_v1 (the temples' shelves). Its own:
//   portal_dir_v1      { v:1, cursor, pending:[outbox items not yet acked], asked:[{id,at}], council:{ pick, asked, meet }, briefs:[…] }
//   portal_advice_v1   { v:1, by:{ <director>: { at, state, cards:[{ id, offer, min, full, mark, known, source, ref }], plan } },
//                        answers:{ <card id>: 'yes'|'later' }, shelf:{ <director>: [card] }, doors:{ <practice id>: [{ dir, line }] }, caps:{ left, at } }
//   portal_settings_v1 { v:1, stateLines: true }
(function () {
  'use strict';
  if (window.TempleDirector) return;
  const TS = window.TempleShell, Talk = window.TempleTalk, Block = window.TempleAppBlock, Plan = window.TemplePlan;
  if (!TS || !Talk) return;

  const K = { village: 'village_v1', outbox: 'village_outbox_v1', cursor: 'village_cursor_v1', drafts: 'village_drafts_v1', readAt: 'village_read_v1',
    dir: 'portal_dir_v1', advice: 'portal_advice_v1', settings: 'portal_settings_v1', shelf: 'portal_shelf_v1' };
  const LINE_MAX = 5000;                                                 // the bridge drops a longer line (validItem), so the box refuses it first
  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const esc = Talk.esc;
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(36); };
  const uuid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12));
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const arr = (v) => (Array.isArray(v) ? v : []);

  // ── who is who ──
  const DIRS = TS.DIRECTORS;                                             // a, garr, hekka, rak, thorn, nokka, ngoen, paa, malee
  const ORDER = ['a', 'thorn', 'hekka', 'rak', 'garr', 'nokka', 'ngoen', 'paa', 'malee'];
  const HOUSE_APPS = { esoteric: ['breath', 'inner', 'healing', 'observatory'], hobby: ['strings'], hibrations: ['hibrations'], kaching: ['kaching'], cupidity: ['beast', 'magnetic'] };
  const HOUSE_WORD = { fitness: 'the house of the body', esoteric: 'the house of the sky and the current', cupidity: 'the house of the horns', halohorns: 'the house of the temple app',
    hibrations: 'the house of the page', kaching: 'the house of the ledger', hobby: 'the house of play', baby: 'the house of what is coming' };
  const isDir = (id) => Object.prototype.hasOwnProperty.call(DIRS, id);
  const whoOf = (id) => (id === 'a' ? 'a' : DIRS[id].house + '.d');     // the village's name for their thread
  const idOfWho = (who) => (who === 'a' ? 'a' : ORDER.find((k) => DIRS[k].house && DIRS[k].house + '.d' === who) || null);
  const village = () => obj(read(K.village, null));
  function nameOf(id) {                                                   // the name from the PC's content, once the village has it
    const c = village().content, vs = c && c.data && c.data.villagers, v = id !== 'a' && isDir(id) && vs && vs[whoOf(id)];
    return (v && v.name) || (DIRS[id] || {}).name || String(id || '');
  }
  const agentId = (id) => (id === 'a' ? 'aletheia' : nameOf(id).toLowerCase());   // as the bridge's meeting names them
  const bridge = () => { const b = village().bridge; return b && typeof b.url === 'string' && typeof b.token === 'string' ? b : null; };
  let KEY = null, pageDir = null;
  const onHome = () => KEY === 'portal';

  // ── its own stores, read fresh every time (another page may have written) ──
  function dstate() {
    const s = obj(read(K.dir, null));
    return { v: 1, cursor: Number.isFinite(s.cursor) ? s.cursor : null, pending: arr(s.pending), asked: arr(s.asked), council: obj(s.council), briefs: arr(s.briefs) };
  }
  const saveD = (s) => write(K.dir, s);
  function advice() {
    const a = obj(read(K.advice, null));
    return { v: 1, by: obj(a.by), answers: obj(a.answers), shelf: obj(a.shelf), doors: obj(a.doors), caps: a.caps && typeof a.caps === 'object' ? a.caps : null };
  }
  const saveA = (a) => write(K.advice, a);
  let adviceChanged = false;                                             // a director's words arrived: home draws its plan card again (a suggestion may be in them)
  const settings = () => { const s = obj(read(K.settings, null)); return { v: 1, stateLines: s.stateLines !== false }; };
  const str = (v, n) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');
  function cleanCard(dir, c) {
    c = obj(c); const offer = str(c.offer, 89), min = str(c.min, 139); if (!offer || !min) return null;
    return { id: 'card-' + hash(dir + '|' + offer + '|' + min), offer: offer, min: min, full: str(c.full, 199), mark: str(c.mark, 40) || 'none', known: c.known !== false, source: str(c.source, 80),
      ref: typeof c.ref === 'string' && /^[a-z]+:[a-z0-9_.\/-]{1,60}$/.test(c.ref) ? c.ref : null };
  }
  // A parsed block, from an answer or from /portal. A newer one replaces the state; cards stay as they were unless the
  // block brings cards; the plan suggestion is whatever the newest block says, or nothing.
  function storeBlock(dir, p, at) {
    if (!isDir(dir) || dir === 'a' || !p) return false;
    const a = advice(), was = obj(a.by[dir]); at = typeof at === 'string' ? at : new Date().toISOString();
    if (was.at && was.at > at) return false;
    const cards = arr(p.cards).map((c) => cleanCard(dir, c)).filter(Boolean).slice(0, 3);
    const pl = obj(p.plan), plan = Block && Block.CHANGES.indexOf(pl.change) >= 0 && str(pl.item, 89) ? { change: pl.change, item: str(pl.item, 89), to: str(pl.to, 89), why: str(pl.why, 139) } : null;
    a.by[dir] = { at: at, state: str(p.state, 59) || was.state || '', cards: cards.length ? cards : arr(was.cards), plan: plan };
    adviceChanged = true;
    return saveA(a);
  }

  // ── the road to the PC: the village's own /sync, with this file's own cursor so the village misses nothing ──
  let syncing = false, lastOk = null, lastErr = '';
  const isAway = () => !bridge() || !navigator.onLine || lastOk === false;
  function lightNow() {
    if (!bridge()) return { cls: 'ts-off', text: 'not paired with the PC' };
    if (!navigator.onLine) return { cls: 'ts-off', text: 'phone offline' };
    if (lastOk === true) return { cls: 'ts-ok', text: 'PC reachable' };
    if (lastOk === false) return { cls: 'ts-warn', text: lastErr || 'PC asleep or out of reach' };
    return { cls: 'ts-off', text: 'paired with the PC' };
  }
  function slimMeet(m) {
    m = obj(m);
    return { id: str(m.id, 60), at: str(m.at, 40), state: str(m.state, 20), kind: str(m.kind, 20),
      rows: arr(m.rows).slice(-60).map((r) => ({ id: str(obj(r).id, 60), who: str(r.who, 40), name: str(r.name, 40), text: typeof r.text === 'string' ? r.text.slice(0, 6000) : '', pending: !!r.pending, queued: !!r.queued, error: !!r.error, ref: r.ref || null })) };
  }
  async function take(e) {
    if (!e || typeof e.id !== 'string') return;
    if (e.kind === 'meeting') { if (e.data) { const s = dstate(); s.council.meet = slimMeet(e.data); saveD(s); } return; }
    if (e.kind === 'brief') { const d = obj(e.data); if (d.id && typeof d.text === 'string') { const s = dstate(); s.briefs = s.briefs.filter((b) => b.id !== d.id).concat({ id: d.id, kind: d.kind, day: d.day, at: d.at, text: d.text }).slice(-6); saveD(s); } return; }
    if (typeof e.who !== 'string' || !e.who) return;
    if (e.kind === 'said') { await Talk.addRow(e.who, { id: e.id, at: e.at, me: true, text: e.text }); return; }
    if (e.kind === 'thread') { await Talk.addThread(e.who, e); return; }
    if (e.kind !== 'reply') return;
    await Talk.addRow(e.who, { id: e.id, ref: e.ref, at: e.at, from: e.from, text: e.text, error: !!e.error });
    if (e.ref) { const s = dstate(); if (s.asked.some((x) => x.id === e.ref)) { s.asked = s.asked.filter((x) => x.id !== e.ref); saveD(s); } }
    const dir = idOfWho(e.who);
    if (dir && dir !== 'a' && Block && !e.error) { const p = Block.parseApp(e.text, dir); if (p) storeBlock(dir, p, e.at); }
  }
  // What step 6's /portal route answers, taken only if the bridge's /sync says the route is there ("portal": true).
  function takePortal(j) {
    j = obj(j);
    for (const dir of Object.keys(obj(j.directors))) { const d = obj(j.directors[dir]); storeBlock(dir, { state: d.state, cards: d.cards, plan: d.plan }, d.at); }
    const a = advice(); let touched = false;
    if (j.caps && Number.isFinite(j.caps.left)) { a.caps = { left: Math.max(0, Math.round(j.caps.left)), at: new Date().toISOString() }; touched = true; }
    if (j.doors && typeof j.doors === 'object') {
      a.doors = {};
      for (const pid of Object.keys(j.doors).slice(0, 300)) { const rows = arr(j.doors[pid]).map((r) => ({ dir: str(obj(r).dir, 20), line: str(r.line, 140) })).filter((r) => isDir(r.dir) && r.line).slice(0, 4); if (rows.length) a.doors[str(pid, 60)] = rows; }
      touched = true;
    }
    if (touched) saveA(a);
  }
  const planForPc = () => (Plan ? Plan.acts().map((x) => ({ name: x.name, part: Plan.partOf(typeof x.hour === 'number' ? x.hour : 18), size: x.size || 'full', from: x.from || null })) : []);
  async function sync() {
    const br = bridge();
    if (!br || syncing) return;
    if (!navigator.onLine) { refresh(); return; }
    syncing = true;
    const d = dstate(), vc = obj(read(K.cursor, null));
    const after = d.cursor != null ? d.cursor : (Number.isFinite(vc.seq) ? vc.seq : 0);   // the first time, from where the village has read to
    const content = village().content, head = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + br.token };
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 10000);
    try {
      const res = await fetch(br.url + '/sync', { method: 'POST', signal: ctrl.signal, headers: head, body: JSON.stringify({ outbox: d.pending, after: after, contentHash: content ? content.hash : null }) });
      if (res.status === 401) { lastOk = false; lastErr = 'the PC does not know this phone; pair again in the village'; return; }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = obj(await res.json()), acked = new Set(arr(data.acked));
      if (acked.size) {                                                   // the PC has them: out of this file's list and out of the village's outbox
        const s = dstate(); s.pending = s.pending.filter((m) => !acked.has(m.id)); saveD(s);
        const ob = read(K.outbox, null); if (Array.isArray(ob)) write(K.outbox, ob.filter((m) => !(m && acked.has(m.id))));
      }
      for (const e of arr(data.events)) await take(e);
      const s = dstate(); s.cursor = Math.max(after, Number.isFinite(data.cursor) ? data.cursor : 0); s.asked = s.asked.filter((x) => Date.now() - Date.parse(x.at) < 30 * 60000); saveD(s);
      lastOk = true; lastErr = '';
      if (data.portal) {
        try { const r = await fetch(br.url + '/portal', { method: 'POST', signal: ctrl.signal, headers: head, body: JSON.stringify({ day: Plan ? Plan.today() : null, plan: planForPc() }) }); if (r.ok) takePortal(await r.json()); } catch (e) { /* the route is step 6's; without it nothing changes */ }
      }
    } catch (e) { lastOk = false; lastErr = ''; } finally { clearTimeout(timer); syncing = false; refresh(); }
  }
  function queue(items) {
    const s = dstate(); s.pending = s.pending.concat(items).slice(-80); saveD(s);
    const ob = read(K.outbox, null); write(K.outbox, arr(ob).concat(items));   // so the village shows them waiting too, and sends them if it gets there first
  }

  // ── talk ──
  const ABOUT = /^\(About (.+?) · ([a-z]+:[^\s,)]+), from ([^)\n]+)\)\n/;
  const cleanRef = (r) => { r = obj(r); const kind = str(r.kind, 20), id = str(r.id, 60); return /^[a-z]+$/.test(kind) && /^[a-z0-9_.\/-]{1,60}$/i.test(id) ? { kind: kind, id: id, name: str(r.name, 80) || kind } : null; };
  function send(dir, text, ref) {
    text = String(text || '').trim(); ref = ref ? cleanRef(ref) : null;
    if (!text || !isDir(dir)) return null;
    const full = (ref ? '(About ' + ref.name.replace(/[()]/g, '') + ' · ' + ref.kind + ':' + ref.id + ', from ' + TS.TEMPLES[KEY].name + ')\n' : '') + text;
    if (full.length > LINE_MAX) return null;
    const m = { id: uuid(), kind: 'message', to: whoOf(dir), text: full, at: new Date().toISOString(), chat: true, app: KEY };
    if (ref) m.about = ref;
    if (isAway() && DIRS[dir].house !== 'cupidity') m.letter = true;     // a waited-for answer may buzz, discreetly; never Rak's
    queue([m]);
    const s = dstate(); s.asked = s.asked.concat({ id: m.id, at: m.at }).slice(-40); saveD(s);
    Talk.addRow(m.to, { id: m.id, at: m.at, me: true, text: full }).then(() => paintTalk());
    sync();
    return m;
  }
  function markRead(who, rec) {
    const last = rec.threads.flatMap((t) => t.rows).filter((r) => !r.me && !r.sys).map((r) => r.at).sort().pop();
    const at = obj(read(K.readAt, null));
    if (last && (!at[who] || at[who] < last)) { at[who] = last; write(K.readAt, at); }
  }
  // "talk to Malee and Ngoen together": A ends such an answer with <table>["malee","ngoen"]</table>
  function tableOf(text) {
    const m = /<table>\s*(\[[\s\S]*?\])\s*<\/table>/i.exec(text); let seats = [];
    if (m) { try { seats = JSON.parse(m[1]).map((n) => ORDER.find((k) => nameOf(k).toLowerCase() === String(n).toLowerCase().trim() || (k === 'a' && /^a(letheia)?$/i.test(String(n).trim())))).filter(Boolean); } catch (e) { seats = []; } }
    seats = [...new Set(seats)].slice(0, 4);
    return { text: m ? text.replace(m[0], '').trimEnd() : text, seats: seats.length >= 2 ? seats : [] };
  }

  // ── the sheet ──
  let cur = null;          // { mode: 'director' | 'council' | 'brief', dir, tab, ref, fresh }
  let ui = null, lastFocus = null, expanded = new Set(), rowsNow = new Map(), note = '';
  function build() {
    if (ui) return ui;
    const scrim = el('div', 'ts-scrim'); scrim.id = 'dr-scrim'; scrim.hidden = true; scrim.addEventListener('click', close);
    const sheet = el('div', 'ts-sheet ts-dsheet'); sheet.id = 'dr-sheet'; sheet.hidden = true; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true');
    const head = el('div', 'ts-sheet-head'), nm = el('div'), title = el('b'), sub = el('span');
    const faceBox = el('span', 'ts-dface');
    nm.appendChild(title); nm.appendChild(sub);
    const x = el('button', 'ts-x'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.appendChild(TS.sig('x', 20)); x.addEventListener('click', close);
    head.appendChild(faceBox); head.appendChild(nm); head.appendChild(x);
    const light = el('p', 'ts-pc'); light.id = 'dr-light';
    const tabs = el('div', 'ts-tabs'); tabs.setAttribute('role', 'tablist');
    for (const [id, label] of [['talk', 'Talk'], ['advice', 'Advice'], ['shelf', 'Shelf']]) {
      const b = el('button', '', label); b.type = 'button'; b.dataset.tab = id; b.setAttribute('role', 'tab');
      b.addEventListener('click', () => { if (!cur || cur.mode !== 'director') return; cur.tab = id; cur.fresh = true; note = ''; paint(); });
      tabs.appendChild(b);
    }
    const body = el('div', 'ts-sheet-body'); body.id = 'dr-body';
    const pill = el('button', 'ts-newpill'); pill.type = 'button'; pill.hidden = true;                 // must follow the box: talk.js showPill scrolls its previous sibling
    const foot = el('div', 'ts-compose'); foot.id = 'dr-foot';
    sheet.appendChild(head); sheet.appendChild(light); sheet.appendChild(tabs); sheet.appendChild(body); sheet.appendChild(pill); sheet.appendChild(foot);
    document.body.appendChild(scrim); document.body.appendChild(sheet);
    body.addEventListener('scroll', () => { if (Talk.nearEnd(body)) pill.hidden = true; }, { passive: true });
    body.addEventListener('click', onBodyClick);
    ui = { scrim, sheet, faceBox, title, sub, light, tabs, body, pill, foot };
    return ui;
  }
  function show(next) {
    build();
    if (TS.closeSheet) TS.closeSheet();
    if (!cur) lastFocus = document.activeElement;
    cur = next; cur.fresh = true; note = ''; expanded = new Set();
    ui.body.textContent = ''; ui.foot.textContent = ''; ui.pill.hidden = true;
    ui.scrim.hidden = false; ui.sheet.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    paint();
    const x = ui.sheet.querySelector('.ts-x'); if (x) x.focus({ preventScroll: true });
    sync();
  }
  function open(dir, opts) {
    dir = isDir(dir) ? dir : pageDir; if (!isDir(dir)) return;
    opts = opts || {};
    show({ mode: 'director', dir: dir, tab: ['talk', 'advice', 'shelf'].indexOf(opts.tab) >= 0 ? opts.tab : 'talk', ref: opts.ref ? cleanRef(opts.ref) : null });
  }
  function close() {
    if (!ui || !cur) return;
    cur = null; ui.sheet.hidden = true; ui.scrim.hidden = true; document.documentElement.style.overflow = '';
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) {} }
    refresh();
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && cur) close(); });

  function paintHead() {
    const lt = lightNow();
    ui.light.textContent = ''; ui.light.appendChild(el('i', 'ts-dot ' + lt.cls)); ui.light.appendChild(document.createTextNode(lt.text));
    ui.tabs.hidden = cur.mode !== 'director';
    ui.faceBox.textContent = '';
    if (cur.mode === 'director') {
      const d = cur.dir, st = d !== 'a' && obj(advice().by[d]).state;
      ui.sheet.setAttribute('aria-label', nameOf(d));
      ui.faceBox.appendChild(TS.face(d, 'span', 'ts-lg'));
      ui.title.textContent = nameOf(d);
      ui.sub.textContent = st || (d === 'a' ? 'chief of staff, beside you' : HOUSE_WORD[DIRS[d].house] || '');
      for (const b of ui.tabs.children) { const on = b.dataset.tab === cur.tab; b.classList.toggle('ts-on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); }
    } else if (cur.mode === 'council') {
      ui.sheet.setAttribute('aria-label', 'The council'); ui.title.textContent = 'The council'; ui.sub.textContent = 'two to four, asked once';
      ui.faceBox.appendChild(TS.face('a', 'span', 'ts-lg'));
    } else {
      ui.sheet.setAttribute('aria-label', 'A’s brief'); ui.title.textContent = 'A’s brief'; ui.sub.textContent = 'as she wrote it';
      ui.faceBox.appendChild(TS.face('a', 'span', 'ts-lg'));
    }
  }
  function paint() {
    if (!cur || !ui) return;
    paintHead();
    ui.sheet.dataset.mode = cur.mode === 'director' ? cur.tab : cur.mode;
    if (cur.mode === 'council') return paintCouncil();
    if (cur.mode === 'brief') return paintBrief();
    if (cur.tab === 'talk') { paintComposer(); return paintTalk(); }
    ui.foot.textContent = ''; ui.pill.hidden = true;
    if (cur.tab === 'advice') return paintAdvice();
    return paintShelf();
  }

  // the line under the box: what a question costs, and what happens to it right now
  function statusText() {
    if (!bridge()) return 'This phone is not paired with the PC yet. A question waits here until it is. Pairing is done once, in the village.';
    if (!navigator.onLine) return 'The phone is offline. A question waits here and goes when it is back online.';
    if (lastOk === false) return (lastErr ? 'The PC does not know this phone. ' : 'The PC cannot be reached just now. ') + 'A question waits here and goes when it can.';
    const c = advice().caps;
    return 'Each question is a real run on the PC.' + (c && Date.now() - Date.parse(c.at) < 6 * 3600000 ? ' The village has ' + c.left + ' answers left today.' : '');
  }
  function paintComposer() {
    const dir = cur.dir, who = whoOf(dir), name = nameOf(dir), foot = ui.foot;
    let ta = foot.querySelector('textarea');
    if (!ta || foot.dataset.dir !== dir) {
      foot.textContent = ''; foot.dataset.dir = dir;
      const chip = el('div', 'ts-refchip'); chip.id = 'dr-ref';
      const rowE = el('div', 'ts-crow');
      ta = el('textarea'); ta.id = 'dr-text'; ta.rows = 1; ta.setAttribute('aria-label', 'Your line to ' + name);
      ta.value = obj(read(K.drafts, null))[who] || '';
      const go = el('button', 'ts-yes', 'Send'); go.type = 'button'; go.id = 'dr-send';
      const over = el('p', 'ts-over'); over.id = 'dr-over'; over.hidden = true;
      const status = el('p', 'ts-status'); status.id = 'dr-status';
      const grow = () => { ta.style.height = 'auto'; if (ta.value) ta.style.height = Math.min(ta.scrollHeight + 2, window.innerHeight * 0.3) + 'px'; };
      const fits = () => { const n = ta.value.trim().length - (LINE_MAX - 200); over.hidden = n <= 0; over.textContent = n > 0 ? 'Too long to send: ' + n.toLocaleString('en-GB') + ' characters over. Your words stay here.' : ''; return n <= 0; };
      ta.addEventListener('input', () => { grow(); fits(); const d = obj(read(K.drafts, null)); if (ta.value.trim()) d[who] = ta.value; else delete d[who]; write(K.drafts, d); });
      const fire = () => {
        if (!cur || !ta.value.trim() || !fits()) return;
        if (!send(cur.dir, ta.value, cur.ref)) return;
        ta.value = ''; grow(); cur.ref = null;
        const d = obj(read(K.drafts, null)); delete d[who]; write(K.drafts, d);
        paintComposer();
      };
      go.addEventListener('click', fire);
      ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); fire(); } });
      rowE.appendChild(ta); rowE.appendChild(go);
      foot.appendChild(chip); foot.appendChild(rowE); foot.appendChild(over); foot.appendChild(status);
      grow(); fits();
    }
    ta.placeholder = 'Ask ' + name + '…';
    const chip = foot.querySelector('#dr-ref'); chip.textContent = '';
    if (cur.ref) {
      chip.appendChild(el('span', '', 'about ' + cur.ref.name));
      const off = el('button', 'ts-btn', 'Not about this'); off.type = 'button'; off.addEventListener('click', () => { cur.ref = null; paintComposer(); });
      chip.appendChild(off);
    } else if (!onHome()) {
      const b = el('button', 'ts-link', 'Ask about this page'); b.type = 'button'; b.id = 'dr-attach';
      b.addEventListener('click', () => { cur.ref = { kind: 'page', id: KEY, name: TS.TEMPLES[KEY].name }; paintComposer(); const t = ui.foot.querySelector('textarea'); if (t) t.focus(); });
      chip.appendChild(b);
    }
    foot.querySelector('#dr-status').textContent = statusText();
  }
  async function paintTalk() {
    if (!cur || cur.mode !== 'director' || cur.tab !== 'talk') return;
    const dir = cur.dir, who = whoOf(dir), rec = await Talk.getThread(who);
    if (!cur || cur.mode !== 'director' || cur.dir !== dir || cur.tab !== 'talk') return;
    const name = nameOf(dir), all = rec.threads.flatMap((t) => t.rows), answered = new Set(all.filter((r) => r.ref).map((r) => r.ref));
    const out = new Set(dstate().pending.map((m) => m.id).concat(arr(read(K.outbox, null)).map((m) => m && m.id)));
    const away = isAway(), paired = !!bridge();
    const row = (r) => {
      if (r.sys) return '<div class="ts-msg ts-sys">' + esc(r.text) + '</div>';
      if (r.me) {
        const m = ABOUT.exec(r.text), text = m ? r.text.slice(m[0].length) : r.text;
        const meta = out.has(r.id) ? (!paired ? 'waiting on this phone, not paired with the PC yet' : away ? 'waiting on this phone until the PC is back' : 'on its way to the PC')
          : answered.has(r.id) ? '' : Date.now() - Date.parse(r.at) < 30 * 60000 ? 'with ' + esc(name) + ' at the PC' : '';
        return '<div class="ts-msg ts-me' + (out.has(r.id) ? ' ts-wait' : '') + '">' + (m ? '<span class="ts-about">about ' + esc(m[1]) + '</span>' : '') + esc(text) +
          '<div class="ts-meta">' + esc(Talk.hhmm(r.at)) + (meta ? ' · ' + meta : '') + '</div></div>';
      }
      const tb = dir === 'a' && !r.error ? tableOf(r.text) : { text: r.text, seats: [] };
      const text = Block ? Block.strip(tb.text) : tb.text, long = Talk.isLong(text), fold = long && !expanded.has(r.id);
      return '<div class="ts-msg ts-them' + (r.error ? ' ts-err' : '') + (fold ? ' ts-fold' : '') + '"><div class="ts-md">' + Talk.talkMd(text) + '</div><div class="ts-meta ts-acts"><span>' + esc(r.from || name) + ' · ' + esc(Talk.hhmm(r.at)) + '</span>' +
        (fold ? '<button class="more">Read all</button>' : long ? '<button class="less">Fold it</button>' : '') + '<button class="copy">Copy</button>' +
        (tb.seats.length ? '<button class="together" data-seats="' + esc(tb.seats.join(' ')) + '">Ask ' + esc(tb.seats.map(nameOf).join(' & ')) + ' together</button>' : '') + '</div></div>';
    };
    const items = []; let day = '';
    for (const t of rec.threads) for (const r of t.rows) {
      const d = Talk.dayOf(r.at); if (d !== day) { day = d; items.push({ key: 'd:' + d, html: '<div class="ts-msg ts-day">' + esc(d) + '</div>' }); }
      items.push({ key: r.id, html: row(r), them: !r.me && !r.sys, me: !!r.me, at: r.at });
    }
    if (!all.length) items.push({ key: 'hello', html: '<p class="ts-quiet">Nothing said yet. This is the same thread the village shows: a line written here is there too.</p>' });
    rowsNow = new Map(all.map((r) => [r.id, r]));
    const box = ui.body, before = new Set([...box.children].map((n) => n.dataset.k)), atEnd = Talk.nearEnd(box), first = !before.size || (before.size === 1 && before.has('hello'));
    Talk.patch(box, items);
    const fresh = first ? [] : items.filter((it) => !before.has(it.key)), at = (k) => box.querySelector('[data-k="' + CSS.escape(k) + '"]');
    if (cur.fresh) {
      // just opened: at the first answer that came since he last had this chat open, else the end
      const since = obj(read(K.readAt, null))[who] || '', unread = items.find((it) => it.them && since && it.at > since);
      cur.fresh = false;
      if (unread) Talk.toStart(box, at(unread.key)); else box.scrollTop = box.scrollHeight;
    } else if (fresh.some((it) => it.me)) box.scrollTop = box.scrollHeight;
    else if (fresh.some((it) => it.them)) {
      const it = fresh.find((z) => z.them), r = rowsNow.get(it.key);
      if (atEnd) Talk.toStart(box, at(it.key)); else Talk.showPill(ui.pill, '↓ New from ' + ((r && r.from) || name), at(it.key));
    } else if (atEnd && fresh.length) box.scrollTop = box.scrollHeight;
    if (!document.hidden) markRead(who, rec);
  }
  function onBodyClick(e) {
    const b = e.target.closest && e.target.closest('button'); if (!b || !cur) return;
    const rowEl = b.closest('[data-k]'), k = rowEl && rowEl.dataset.k;
    if (b.classList.contains('more')) { expanded.add(k); paintTalk(); }
    else if (b.classList.contains('less')) { expanded.delete(k); paintTalk().then(() => { const n = ui.body.querySelector('[data-k="' + CSS.escape(k) + '"]'); if (n) Talk.toStart(ui.body, n); }); }
    else if (b.classList.contains('copy')) { const r = rowsNow.get(k); if (r) Talk.copyText(Block ? Block.strip(tableOf(r.text).text) : r.text, b); }
    else if (b.classList.contains('together')) council(b.dataset.seats.split(' '));
  }

  // ── advice ──
  const templeForPlan = (dir) => (KEY && TS.TEMPLES[KEY].dir === dir && ['portal', 'mirror', 'village'].indexOf(KEY) < 0 ? (TS.TEMPLES[KEY].portal || KEY) : null);
  const sizeOf = {};                                                     // card id -> the size picked before the yes
  function cardEl(dir, c) {
    const card = el('section', 'ts-card ts-adv'); card.dataset.card = c.id;
    card.appendChild(el('h2', '', c.offer));
    const mf = el('p', 'ts-minfull'); mf.appendChild(el('b', '', 'Minimum')); mf.appendChild(document.createTextNode(' ' + c.min));
    if (c.full) { mf.appendChild(el('br')); mf.appendChild(el('b', '', 'Full')); mf.appendChild(document.createTextNode(' ' + c.full)); }
    card.appendChild(mf);
    if (c.mark && c.mark !== 'none') { const mk = el('p', 'ts-src'); mk.appendChild(el('span', 'ts-srcmark', c.mark)); if (c.source) mk.appendChild(document.createTextNode(' ' + c.source)); card.appendChild(mk); }
    const road = el('div', 'ts-road'); road.setAttribute('role', 'group'); road.setAttribute('aria-label', 'Which size');
    for (const [v, t] of [['min', 'Minimum'], ['full', 'Full']]) {
      if (v === 'full' && !c.full) continue;
      const b = el('button', (sizeOf[c.id] || 'min') === v ? 'ts-on' : '', t); b.type = 'button'; b.dataset.size = v; b.setAttribute('aria-pressed', (sizeOf[c.id] || 'min') === v ? 'true' : 'false');
      b.addEventListener('click', () => { sizeOf[c.id] = v; paintAdvice(); });
      road.appendChild(b);
    }
    card.appendChild(road);
    const pair = el('div', 'ts-pair');
    const yes = el('button', 'ts-yes', 'Yes'); yes.type = 'button'; yes.setAttribute('aria-label', 'Yes: ' + c.offer);
    yes.addEventListener('click', () => {
      if (!Plan) return;
      Plan.place(c, dir, sizeOf[c.id] || 'min', templeForPlan(dir));
      const a = advice(); a.answers[c.id] = 'yes'; saveA(a);
      note = 'Placed in today’s plan. It can be moved, made smaller or taken off there.'; paintAdvice(); refresh();
    });
    const later = el('button', 'ts-later', 'Not now'); later.type = 'button'; later.setAttribute('aria-label', 'Not now: ' + c.offer);
    later.addEventListener('click', () => { setDown(dir, c); note = 'Set down on the shelf, with no date. It will not be raised again.'; paintAdvice(); refresh(); });
    pair.appendChild(yes); pair.appendChild(later); card.appendChild(pair);
    const ask = el('button', 'ts-link', 'Ask about this'); ask.type = 'button';
    ask.addEventListener('click', () => { const m = /^([a-z]+):(.+)$/.exec(c.ref || ''); open(dir, { ref: m ? { kind: m[1], id: m[2], name: c.offer } : { kind: 'card', id: c.id, name: c.offer } }); });
    card.appendChild(ask);
    return card;
  }
  function setDown(dir, c) {
    const a = advice(); a.answers[c.id] = 'later'; adviceChanged = true;   // home's shelf draws again
    a.shelf[dir] = arr(a.shelf[dir]).filter((x) => x.id !== c.id).concat(c).slice(-40); saveA(a);
    if (DIRS[dir].house === 'cupidity') return;                           // Rak's stays inside his sheet: nothing from Cupidity on home
    const s = obj(read(K.shelf, null)), items = arr(s.items).filter((it) => it && it.key !== 'advice:' + c.id);
    items.push({ key: 'advice:' + c.id, name: c.offer, when: 'from ' + nameOf(dir), temple: null, practiceId: null, star: null, from: dir, card: c.id });
    write(K.shelf, Object.assign({ v: 1 }, s, { items: items }));
  }
  function offShelf(dir, id) {
    const a = advice(); a.shelf[dir] = arr(a.shelf[dir]).filter((x) => x.id !== id); saveA(a); adviceChanged = true;
    const s = obj(read(K.shelf, null)); if (Array.isArray(s.items)) write(K.shelf, Object.assign({}, s, { items: s.items.filter((it) => !(it && it.key === 'advice:' + id)) }));
  }
  function pickUp(dir, id) {                                             // from a shelf, here or on home: into today's plan
    const c = arr(advice().shelf[dir]).find((x) => x.id === id);
    if (c && Plan) { Plan.place(c, dir, 'min', null); const a = advice(); a.answers[id] = 'yes'; saveA(a); }
    offShelf(dir, id); refresh();
    return !!c;
  }
  function letGo(dir, id) { offShelf(dir, id); refresh(); }
  function sugEl(s) {
    const box = el('section', 'ts-card ts-sug'); box.dataset.sug = s.id;
    box.appendChild(el('div', 'ts-eyebrow', 'A change to today’s plan'));
    box.appendChild(el('h2', '', Plan.sentence(s, nameOf(s.dir))));
    if (s.why) box.appendChild(el('p', '', s.why));
    const pair = el('div', 'ts-pair');
    const yes = el('button', 'ts-yes', 'Yes'); yes.type = 'button';
    yes.addEventListener('click', () => { const r = Plan.apply(s, api.offers ? api.offers() : null); note = r.text; paint(); refresh(); });
    const later = el('button', 'ts-later', 'Not now'); later.type = 'button';
    later.addEventListener('click', () => { Plan.later(s); note = 'Left as it is.'; paint(); refresh(); });
    pair.appendChild(yes); pair.appendChild(later); box.appendChild(pair);
    return box;
  }
  function paintAdvice() {
    const dir = cur.dir, box = ui.body, name = nameOf(dir), a = advice(), b = obj(a.by[dir]);
    box.textContent = '';
    if (note) box.appendChild(el('p', 'ts-note', note));
    if (dir === 'a') {
      box.appendChild(el('p', 'ts-quiet', 'A does not hand out cards. Her read of the day is her brief, and the houses’ advice sits with each of them.'));
      const br = el('button', 'ts-btn', 'Read her brief'); br.type = 'button'; br.addEventListener('click', () => brief()); box.appendChild(br);
      return;
    }
    const sugs = Plan ? Plan.suggestions({ dir: dir }) : [];
    sugs.forEach((s) => box.appendChild(sugEl(s)));
    const cards = arr(b.cards), openCards = cards.filter((c) => !a.answers[c.id]), placed = cards.filter((c) => a.answers[c.id] === 'yes');
    openCards.forEach((c) => box.appendChild(cardEl(dir, c)));
    placed.forEach((c) => { const p = el('p', 'ts-quiet'); p.appendChild(document.createTextNode('In today’s plan: ')); p.appendChild(el('b', '', c.offer)); box.appendChild(p); });
    if (!b.at) {
      box.appendChild(el('p', 'ts-quiet', 'Nothing from ' + name + ' yet. Advice is what ' + name + ' actually wrote in an answer from the PC, and none has arrived on this phone. Nothing here is made up.'));
    } else if (!openCards.length && !sugs.length) {
      box.appendChild(el('p', 'ts-quiet', cards.length ? 'Nothing more on offer from ' + name + ' just now.' : name + ' has left no card.'));
    }
    if (b.at) box.appendChild(el('p', 'ts-stamp', 'From ' + name + '’s answer of ' + Talk.dayOf(b.at).toLowerCase() + ', ' + new Date(b.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + '.'));
  }

  // ── shelf: what the director has left for him ──
  function paintShelf() {
    const dir = cur.dir, box = ui.body, name = nameOf(dir), a = advice(), house = DIRS[dir].house;
    box.textContent = '';
    if (note) box.appendChild(el('p', 'ts-note', note));
    let any = false;
    const down = arr(a.shelf[dir]);
    if (down.length) {
      any = true; box.appendChild(el('div', 'ts-sec', 'Set down, with no date'));
      const wrap = el('div', 'ts-shelf');
      down.forEach((c) => {
        const row = el('div', 'ts-shelf-item'); row.dataset.card = c.id; row.appendChild(el('span', '', c.offer));
        const up = el('button', 'ts-btn', 'Pick up'); up.type = 'button'; up.addEventListener('click', () => { pickUp(dir, c.id); note = 'Placed in today’s plan.'; paintShelf(); });
        const go = el('button', 'ts-btn', 'Let go'); go.type = 'button'; go.addEventListener('click', () => { letGo(dir, c.id); note = ''; paintShelf(); });
        row.appendChild(up); row.appendChild(go); wrap.appendChild(row);
      });
      box.appendChild(wrap);
    }
    // what landed on a temple's own shelf after his yes (temple_link.js, level 2)
    const left = [];
    for (const app of HOUSE_APPS[house] || []) for (const it of arr(obj(read('link_' + app + '_v1', null)).shelf)) if (it && !it.away) left.push({ app: app, it: it });
    if (left.length) {
      any = true; box.appendChild(el('div', 'ts-sec', 'Left for you by ' + name));
      left.slice(-20).reverse().forEach(({ app, it }) => {
        const c = el('section', 'ts-card'); c.dataset.left = String(it.id);
        c.appendChild(el('div', 'ts-eyebrow', (TS.TEMPLES[app] && TS.TEMPLES[app].name) || app));
        c.appendChild(el('h2', '', String(it.title || 'a suggestion')));
        if (it.text) { const p = el('p', 'ts-pre', String(it.text)); c.appendChild(p); }
        if (it.why) c.appendChild(el('p', 'ts-why', String(it.why)));
        const ask = el('button', 'ts-link', 'Ask about this'); ask.type = 'button';
        ask.addEventListener('click', () => open(dir, { ref: { kind: 'shelf', id: String(it.id).replace(/[^a-z0-9_.\/-]/gi, '').slice(0, 60) || 'item', name: String(it.title || 'a suggestion') } }));
        c.appendChild(ask); box.appendChild(c);
      });
    }
    // cards waiting on his yes, as the village last heard them. They are answered in the village.
    const cards = Object.values(obj(obj(village().jobs).cards)).filter((k) => k && k.state === 'open' && (dir === 'a' ? (k.house === 'longhouse' || k.agent === 'aletheia') : k.house === house));
    if (cards.length) {
      any = true; box.appendChild(el('div', 'ts-sec', 'Waiting on your yes'));
      cards.slice(0, 12).forEach((k) => { const c = el('section', 'ts-card'); c.appendChild(el('h2', '', String(k.what || 'a card'))); if (k.why) c.appendChild(el('p', '', String(k.why))); box.appendChild(c); });
      const go = el('button', 'ts-btn', 'Answer them in the village'); go.type = 'button'; go.addEventListener('click', () => { close(); door('village', house ? '?house=' + encodeURIComponent(house) : ''); });
      box.appendChild(go);
    }
    if (!any) box.appendChild(el('p', 'ts-quiet', 'Nothing here. What ' + name + ' leaves for you rests here: what you set down, proposals that landed, cards waiting on your yes. None of it has a date.'));
  }

  // ── the council: two to four, asked once (the bridge's meeting, started with them picked) ──
  const seatsInOrder = (pick) => ORDER.filter((k) => pick.indexOf(k) >= 0);   // A sits first when she is picked
  function council(seats) {
    const s = dstate();
    if (Array.isArray(seats) && seats.length) { s.council.pick = seatsInOrder(seats.filter(isDir)).slice(0, 4); saveD(s); }
    show({ mode: 'council' });
  }
  function councilAsk(q) {
    q = String(q || '').trim(); const s = dstate(), pick = seatsInOrder(arr(s.council.pick));
    if (!q || pick.length < 2 || pick.length > 4 || q.length > 1800) return false;
    const ids = pick.map(agentId), at = new Date().toISOString();
    const mk = (op, extra) => ({ id: uuid(), kind: 'meeting', to: 'longhouse', text: JSON.stringify(Object.assign({ op: op }, extra)), at: at });
    const items = [];
    if (!(s.council.meet && s.council.meet.state === 'open')) items.push(mk('start', { kind: 'sala', apprentices: false, with: ids }));   // a second start is ignored by the bridge: one meeting at a time
    const ask = mk('ask', { q: q, to: ids, keepOrder: true }); items.push(ask);
    s.council.asked = { id: ask.id, q: q, at: at, pick: pick }; saveD(s);
    queue(items); sync();
    return true;
  }
  function councilEnd() {
    const s = dstate(); if (!(s.council.meet && s.council.meet.state === 'open')) return;
    s.council.meet.state = 'closing'; saveD(s);
    queue([{ id: uuid(), kind: 'meeting', to: 'longhouse', text: JSON.stringify({ op: 'end' }), at: new Date().toISOString() }]); sync();
  }
  function paintCouncil() {
    const box = ui.body, s = dstate(), pick = seatsInOrder(arr(s.council.pick)), asked = s.council.asked, meet = s.council.meet;
    const keep = box.querySelector('textarea'), draft = keep ? keep.value : '', hadFocus = keep && document.activeElement === keep;
    box.textContent = ''; ui.foot.textContent = ''; ui.pill.hidden = true;
    box.appendChild(el('p', 'ts-quiet', 'Pick two to four and ask once. They answer in turn, each hearing the ones before. A sits first when she is picked.'));
    const grid = el('div', 'ts-seats');
    ORDER.forEach((k) => {
      const on = pick.indexOf(k) >= 0, b = el('button', 'ts-seat' + (on ? ' ts-on' : '')); b.type = 'button'; b.dataset.seat = k; b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.appendChild(TS.face(k, 'span', 'ts-sm')); b.appendChild(el('span', '', nameOf(k)));
      b.addEventListener('click', () => { const z = dstate(), p = arr(z.council.pick); z.council.pick = on ? p.filter((x) => x !== k) : (p.length >= 4 ? p : p.concat(k)); saveD(z); paintCouncil(); });
      grid.appendChild(b);
    });
    box.appendChild(grid);
    const ta = el('textarea', 'ts-ctext'); ta.id = 'dr-council-text'; ta.rows = 3; ta.placeholder = 'One question for the table'; ta.value = draft; ta.setAttribute('aria-label', 'Your question for the council'); box.appendChild(ta);
    const go = el('button', 'ts-yes ts-wide', 'Ask once'); go.type = 'button'; go.id = 'dr-council-ask';
    go.addEventListener('click', () => {
      if (pick.length < 2) { note = 'Pick at least two.'; return paintCouncil(); }
      if (!ta.value.trim()) return;
      if (councilAsk(ta.value)) { ta.value = ''; note = ''; paintCouncil(); }
    });
    box.appendChild(go);
    box.appendChild(el('p', 'ts-status', (note ? note + ' ' : '') + (bridge() ? (isAway() ? 'The PC cannot be reached just now, so a question waits here and goes when it can. ' : '') + 'Each answer at the table is a real run on the PC, from the meetings’ own allowance.'
      : 'This phone is not paired with the PC yet. A question waits here until it is.')));
    if (asked) {
      const waiting = dstate().pending.some((m) => m.id === asked.id);
      box.appendChild(el('div', 'ts-sec', 'Asked'));
      const q = el('div', 'ts-msg ts-me' + (waiting ? ' ts-wait' : '')); q.appendChild(document.createTextNode(asked.q));
      q.appendChild(el('div', 'ts-meta', 'to ' + arr(asked.pick).filter(isDir).map(nameOf).join(', ') + (waiting ? ' · waiting on this phone' : ''))); box.appendChild(q);
      // the answers: the rows after his question in the meeting, as the PC last sent it
      const rows = arr(meet && meet.rows), i = rows.map((r) => r.who === 'lek' && r.text === asked.q).lastIndexOf(true);
      if (i >= 0) rows.slice(i + 1).filter((r) => r.who !== 'lek').forEach((r) => {
        const m = el('div', 'ts-msg ts-them' + (r.error ? ' ts-err' : '')); m.dataset.row = r.id;
        const md = el('div', 'ts-md'); if (r.pending || r.queued) md.textContent = r.queued ? 'waiting their turn' : 'answering at the PC'; else md.innerHTML = Talk.talkMd(r.text);
        m.appendChild(md); m.appendChild(el('div', 'ts-meta', r.name)); box.appendChild(m);
      });
    }
    if (meet && meet.state === 'open') {
      const end = el('button', 'ts-btn', 'Close the table'); end.type = 'button'; end.id = 'dr-council-end'; end.addEventListener('click', () => { councilEnd(); paintCouncil(); });
      box.appendChild(end);
      box.appendChild(el('p', 'ts-stamp', 'Closing lets each who spoke write down what they took, and A sums it up in the minutes. Those are runs too. The same table is open in the village.'));
    }
    if (hadFocus) ta.focus();
  }

  // ── A's brief, opened (it may carry any house, so it is never drawn on home itself) ──
  const briefsAll = () => { const by = {}; for (const b of arr(obj(village().jobs).briefs).concat(dstate().briefs)) if (b && b.id && typeof b.text === 'string') by[b.id] = b; return Object.values(by).sort((x, y) => (String(x.at) < String(y.at) ? 1 : -1)); };
  const briefLabel = (b) => (b.kind === 'day' ? 'Day brief' : 'Evening brief') + ' · ' + (b.day ? new Date(b.day + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : Talk.dayOf(b.at));
  function brief(id) { show({ mode: 'brief', id: id || null }); }
  function paintBrief() {
    const box = ui.body, all = briefsAll(), b = all.find((x) => x.id === cur.id) || all[0];
    box.textContent = ''; ui.foot.textContent = '';
    if (!b) { box.appendChild(el('p', 'ts-quiet', 'No brief on this phone yet. A writes one in the morning and one in the evening, and they arrive when the phone has reached the PC.')); return; }
    box.appendChild(el('div', 'ts-eyebrow', briefLabel(b)));
    const md = el('div', 'ts-md ts-brief'); md.innerHTML = Talk.talkMd(b.text); box.appendChild(md);
    const row = el('div', 'ts-btnrow'), t = el('button', 'ts-btn', 'Talk with A'); t.type = 'button'; t.addEventListener('click', () => open('a')); row.appendChild(t); box.appendChild(row);
    const rest = all.filter((x) => x !== b).slice(0, 5);
    if (rest.length) { box.appendChild(el('div', 'ts-sec', 'Earlier')); rest.forEach((x) => { const e = el('button', 'ts-btn ts-wide', briefLabel(x)); e.type = 'button'; e.addEventListener('click', () => { cur.id = x.id; paintBrief(); ui.body.scrollTop = 0; }); box.appendChild(e); }); }
  }

  // ── doors, lenses, "ask about this" ──
  function door(key, query) {                                             // home holds the overlay; every other page moves as the frame does
    if (onHome() && window.Shell && typeof window.Shell.goTo === 'function') window.Shell.goTo((TS.TEMPLES[key] && TS.TEMPLES[key].portal) || key);
    else TS.go(key, query);
  }
  function ask(ref, dir) { open(isDir(dir) ? dir : pageDir, { ref: ref, tab: 'talk' }); }
  // one lens line per other house that has a door onto this practice. On home, never Rak's.
  function lenses(practiceId, name) {
    const rows = arr(advice().doors[practiceId]);
    return rows.filter((r) => isDir(r.dir) && r.dir !== pageDir && !(onHome() && r.dir === 'rak')).map((r) => {
      const b = el('button', 'ts-lens'); b.type = 'button'; b.dataset.lens = r.dir;
      b.appendChild(TS.face(r.dir, 'span', 'ts-sm'));
      const t = el('span'); t.appendChild(el('b', '', nameOf(r.dir) + '’s lens')); t.appendChild(document.createTextNode(' ' + r.line)); b.appendChild(t);
      b.addEventListener('click', () => open(r.dir, { ref: { kind: 'practice', id: practiceId, name: name || practiceId } }));
      return b;
    });
  }
  document.addEventListener('click', (e) => {
    const b = e.target && e.target.closest ? e.target.closest('[data-ask]') : null; if (!b) return;
    const m = /^([a-z]+):(.+)$/.exec(b.dataset.ask || ''); if (!m) return;
    e.preventDefault(); ask({ kind: m[1], id: m[2], name: b.dataset.askName || m[2] }, b.dataset.askDir);
  });

  // ── what sits on the page itself ──
  function paintStateLine() {                                             // a temple's own header: its director's line, if they have written one
    if (onHome() || !pageDir || pageDir === 'a') return;
    const head = document.querySelector('header.ts-head'); if (!head) return;
    const st = obj(advice().by[pageDir]).state; let b = document.getElementById('dr-state');
    if (!st) { if (b) b.remove(); return; }
    if (!b) { b = el('button', 'ts-state'); b.type = 'button'; b.id = 'dr-state'; b.addEventListener('click', () => open(pageDir)); const row = head.querySelector('.ts-hrow'); head.insertBefore(b, row ? row.nextSibling : head.firstChild); }
    b.textContent = ''; b.appendChild(el('i', '', nameOf(pageDir))); b.appendChild(document.createTextNode(' · ' + st));
  }
  function fillHome() {
    if (!onHome()) return;
    const lightEl = document.getElementById('slot-bridge-light');
    if (lightEl) { const lt = lightNow(); lightEl.hidden = false; lightEl.className = 'ts-light'; lightEl.textContent = ''; lightEl.appendChild(el('i', 'ts-dot ' + lt.cls)); lightEl.appendChild(document.createTextNode(lt.text)); }

    const slot = document.getElementById('slot-a-brief');
    if (slot) {
      slot.hidden = false; slot.textContent = '';
      slot.appendChild(el('div', 'ts-sec', 'A, beside you'));
      const card = el('section', 'ts-card ts-acard'); card.id = 'home-a';
      const top = el('div', 'ts-arow'); top.appendChild(TS.face('a', 'span'));
      const tx = el('div'), b = briefsAll()[0];
      tx.appendChild(el('b', '', b ? briefLabel(b) : 'No brief on this phone yet'));
      tx.appendChild(el('span', '', b ? 'Written ' + Talk.dayOf(b.at).toLowerCase() + ' at ' + new Date(b.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + '. It opens in full.' : 'Her briefs arrive when the phone has reached the PC.'));
      top.appendChild(tx); card.appendChild(top);
      const row = el('div', 'ts-btnrow');
      const mk = (id, label, fn) => { const x = el('button', 'ts-btn', label); x.type = 'button'; x.id = id; x.addEventListener('click', fn); row.appendChild(x); };
      if (b) mk('home-a-brief', 'Read it', () => brief());
      mk('home-a-talk', 'Talk with A', () => open('a'));
      mk('home-council', 'Ask a few together', () => council());
      card.appendChild(row);
      slot.appendChild(card);
    }
    const lines = document.getElementById('slot-house-lines');
    if (lines) {
      const a = advice(), rows = settings().stateLines ? ORDER.filter((k) => k !== 'a' && k !== 'rak' && obj(a.by[k]).state) : [];   // nothing from Cupidity on home
      lines.textContent = ''; lines.hidden = !rows.length;
      if (rows.length) {
        lines.appendChild(el('div', 'ts-sec', 'The houses'));
        const wrap = el('div', 'ts-card ts-rows'); wrap.id = 'home-states';
        rows.forEach((k) => {
          const r = el('button', 'ts-staterow'); r.type = 'button'; r.dataset.director = k;
          r.appendChild(TS.face(k, 'span', 'ts-sm'));
          const t = el('div'); t.appendChild(el('div', 'ts-n', nameOf(k))); t.appendChild(el('div', 'ts-s', a.by[k].state)); r.appendChild(t);
          r.addEventListener('click', () => open(k, { tab: 'advice' }));
          wrap.appendChild(r);
        });
        lines.appendChild(wrap);
      }
    }
    const set = document.getElementById('slot-settings');
    if (set) {
      const on = settings().stateLines;
      set.hidden = false; set.textContent = '';
      set.appendChild(el('div', 'ts-sec', 'Settings'));
      const row = el('div', 'ts-card ts-setrow'); row.appendChild(el('span', '', 'The houses’ state lines on this screen'));
      const sw = el('button', 'ts-btn', on ? 'On' : 'Off'); sw.type = 'button'; sw.id = 'home-switch-states'; sw.setAttribute('role', 'switch'); sw.setAttribute('aria-checked', on ? 'true' : 'false'); sw.setAttribute('aria-label', 'The houses’ state lines on this screen');
      sw.addEventListener('click', () => { write(K.settings, { v: 1, stateLines: !on }); fillHome(); });
      row.appendChild(sw); set.appendChild(row);
    }
  }
  let refreshing = false;
  function refresh() {
    if (refreshing) return; refreshing = true;
    try {
      if (adviceChanged) { adviceChanged = false; try { window.dispatchEvent(new CustomEvent('temple-plan')); } catch (e) {} }
      paintStateLine(); fillHome();
      if (cur && ui) {
        paintHead();
        if (cur.mode === 'council') paintCouncil();
        else if (cur.mode === 'director' && cur.tab === 'talk') { paintComposer(); paintTalk(); }
      }
    } finally { refreshing = false; }
  }

  const api = window.TempleDirector = { open, close, ask, lenses, council, brief, send, sync, fillHome, refresh, pickUp, letGo, storeBlock: (d, p, at) => { const r = storeBlock(d, p, at); refresh(); return r; }, nameOf, light: lightNow, offers: null, isOpen: () => !!cur };

  function boot() {
    KEY = TS.temple || (document.body && document.body.dataset.temple);
    if (!KEY || !TS.TEMPLES[KEY]) return;
    pageDir = TS.TEMPLES[KEY].dir || 'a';
    TS.openDirector = () => open(pageDir);
    refresh();
    const s = dstate();
    if (bridge() && (s.pending.length || s.asked.length || onHome())) sync();
    setInterval(() => { if (document.hidden) return; const z = dstate(); if (cur || z.pending.length || z.asked.length) sync(); }, 20000);
    window.addEventListener('online', sync);
    window.addEventListener('offline', refresh);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { const z = dstate(); if (cur || z.pending.length || z.asked.length) sync(); else refresh(); } });
    window.addEventListener('storage', (e) => { if (e.key === K.advice || e.key === K.settings || e.key === K.dir || e.key === K.village) refresh(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
