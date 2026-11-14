// dayplan.js · the dynamic day plan (Portal remake step 5; portal_remake/BUILD_PLAN.md §5, "The dynamic day plan").
//
// Today's plan on home is a living list on the day arc. It changes three ways: by Lek's hand (add, move, minimum or
// full, take off), by a yes on a director's advice card, and by a director's suggestion that he answers yes or not now.
// Nothing in it is owed: what is left untouched is simply not there tomorrow, and nothing counts it.
//
// Stores. portal_plan_v1 keeps its shape: { 'YYYY-MM-DD': { activities: [{ id, name, stack, done }] } }. An activity
// may now also carry any of: hour (where it sits on the arc), size ('min' | 'full'), min, full, from (a director's id),
// mark, source, ref, card (the advice card it came from), temple, practiceId. A day stored before this step has none
// of them and reads exactly as it did. One sibling store, for today only:
//   portal_dayplan_v1  { v:1, day:'YYYY-MM-DD', over: { <offer key>: { hour?, size?, off? } }, sug: { <suggestion id>: 'yes'|'later'|'gone' } }
// `over` is how the offers that are not plan activities (the schedule's slots, today's training, the flow extras) are
// moved, resized or taken off for today without touching the stores they come from. On a new day it starts empty.
// This file reads portal_advice_v1 (the directors' parsed blocks, written by director.js) for suggestions.
(function () {
  'use strict';
  if (window.TemplePlan) return;
  const PLAN = 'portal_plan_v1', DAY = 'portal_dayplan_v1', ADVICE = 'portal_advice_v1';
  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const today = () => new Date().toISOString().slice(0, 10);          // the key home has always used for portal_plan_v1
  const num = (v) => typeof v === 'number' && isFinite(v);
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(36); };
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const changed = () => { try { window.dispatchEvent(new CustomEvent('temple-plan')); } catch (e) {} };

  const PARTS = { morning: 8, daytime: 13.5, evening: 19.5 };
  const partOf = (h) => (h < 11 ? 'morning' : h < 17 ? 'daytime' : 'evening');
  // a yes on a card lands a little ahead of now, never in the small hours
  function sensibleHour(now) { const d = now || new Date(), h = Math.round((d.getHours() + d.getMinutes() / 60 + 1) * 2) / 2; return Math.max(6.5, Math.min(21.5, h)); }

  // ── today's activities, in portal_plan_v1 ──
  function acts() { const s = read(PLAN, {}), d = s && s[today()]; return d && Array.isArray(d.activities) ? d.activities : []; }
  function saveActs(list) {
    let s = read(PLAN, {}); if (!s || typeof s !== 'object' || Array.isArray(s)) s = {};
    const t = today(); s[t] = Object.assign({}, s[t], { activities: list });
    const keys = Object.keys(s).sort(); while (keys.length > 30) delete s[keys.shift()];   // the same thirty days home keeps
    write(PLAN, s); changed();
  }
  const EXTRA = ['size', 'min', 'full', 'from', 'mark', 'source', 'ref', 'card', 'temple', 'practiceId'];
  function add(it) {
    const name = String((it && it.name) || '').trim().slice(0, 120); if (!name) return null;
    const a = { id: 'act-' + Math.random().toString(36).slice(2, 9), name: name, stack: Array.isArray(it.stack) ? it.stack : [], done: false, hour: num(it.hour) ? it.hour : sensibleHour() };
    for (const k of EXTRA) if (it[k] != null && it[k] !== '') a[k] = it[k];
    const list = acts(); list.push(a); saveActs(list);
    return a.id;
  }
  function update(id, patch) { const list = acts(), a = list.find((x) => x.id === id); if (!a) return false; Object.assign(a, patch); saveActs(list); return true; }
  function remove(id) {
    const list = acts(), a = list.find((x) => x.id === id); if (!a) return false;
    saveActs(list.filter((x) => x.id !== id));
    if (a.card) { const adv = read(ADVICE, null); if (adv && adv.answers && adv.answers[a.card]) { delete adv.answers[a.card]; write(ADVICE, adv); } }   // off the plan, so the card is simply on offer again in the sheet
    return true;
  }

  // ── today's changes to everything else ──
  function day() { const d = read(DAY, null), t = today(); return d && d.day === t ? { v: 1, day: t, over: d.over || {}, sug: d.sug || {} } : { v: 1, day: t, over: {}, sug: {} }; }
  function setOver(key, p) { const d = day(); d.over[key] = Object.assign({}, d.over[key], p); write(DAY, d); changed(); }

  // What home draws: the day's offers with the plan's fields laid over them, without what was taken off, in arc order.
  // An offer made from a plan activity carries it as o.act.
  function shape(offers) {
    const d = day(), out = [];
    (offers || []).forEach((o, i) => {
      const a = o.act;
      if (a) {
        if (num(a.hour)) o.hour = a.hour;
        for (const k of ['size', 'min', 'full', 'from', 'mark', 'source', 'ref', 'card']) if (a[k] != null) o[k] = a[k];
        if (a.temple) { o.temple = a.temple; o.practiceId = a.practiceId || null; o.star = a.temple === 'grimoire' ? 'healing' : a.temple === 'magnetic' ? 'beast' : a.temple; }
      }
      const ov = d.over[o.key] || {};
      if (ov.off) return;
      if (num(ov.hour)) o.hour = ov.hour;
      if (ov.size) o.size = ov.size;
      // Cupidity is whole inside and thin outside: on home, something placed from Rak's sheet shows no words of its own
      if (o.from === 'rak') { o.thin = true; o.name = 'Something from the Beast Temple'; o.sub = ''; o.min = ''; o.full = ''; o.mark = null; o.source = ''; o.meta = []; o.temple = null; o.practiceId = null; o.star = 'beast'; }
      o.part = partOf(o.hour); o._i = i;
      out.push(o);
    });
    return out.sort((x, y) => (x.hour - y.hour) || (x._i - y._i));
  }

  // ── by his hand ──
  const setHour = (o, h) => (o.act ? update(o.act.id, { hour: h }) : setOver(o.key, { hour: h }));
  const setSize = (o, s) => (o.act ? update(o.act.id, { size: s }) : setOver(o.key, { size: s }));
  const takeOff = (o) => (o.act ? remove(o.act.id) : setOver(o.key, { off: true }));
  function moveTo(o, part, offers) {
    if (!num(PARTS[part])) return false;
    const there = (offers || []).filter((x) => x !== o && x.key !== o.key && partOf(x.hour) === part).length;
    setHour(o, PARTS[part] + Math.min(there, 4) * 0.6);                 // beside what is already there, not on top of it
    return true;
  }

  // which director an offer belongs to, and what "ask about this" attaches
  function dirOf(o) {
    if (o.from) return o.from;
    const ts = window.TempleShell, k = o.star || (o.temple === 'grimoire' ? 'healing' : o.temple);
    return (ts && k && ts.TEMPLES[k] && ts.TEMPLES[k].dir) || 'a';
  }
  function refOf(o) {
    const m = typeof o.ref === 'string' && /^([a-z]+):(.+)$/.exec(o.ref);
    if (m) return { kind: m[1], id: m[2], name: o.name };
    if (o.practiceId) return { kind: String(o.key).indexOf('training:') === 0 ? 'plan' : 'practice', id: String(o.practiceId).slice(0, 60), name: o.name };
    return { kind: 'page', id: 'portal', name: o.name };
  }

  // The tray under an offer on home: where it sits, how big it is, and the way off. api: { render, toast, offers }.
  function controls(o, api) {
    const box = el('div', 'hm-plan');
    if (o.min || o.full) {
      const mf = el('p', 'ts-minfull');
      if (o.min) { mf.appendChild(el('b', '', 'Minimum')); mf.appendChild(document.createTextNode(' ' + o.min)); }
      if (o.min && o.full) mf.appendChild(el('br'));
      if (o.full) { mf.appendChild(el('b', '', 'Full')); mf.appendChild(document.createTextNode(' ' + o.full)); }
      box.appendChild(mf);
    }
    if (o.mark && o.mark !== 'none') { const mk = el('p', 'hm-src'); mk.appendChild(el('span', 'ts-srcmark', o.mark)); if (o.source) mk.appendChild(document.createTextNode(' ' + o.source)); box.appendChild(mk); }
    const pills = (label, opts, cur, pick) => {
      const row = el('div', 'hm-ctl'); row.appendChild(el('span', '', label));
      const p = el('div', 'ts-pills');
      opts.forEach(([v, t]) => {
        const b = el('button', v === cur ? 'ts-on' : '', t); b.type = 'button'; b.dataset.set = v;
        b.setAttribute('aria-pressed', v === cur ? 'true' : 'false');
        b.addEventListener('click', () => { pick(v); api.render(); });
        p.appendChild(b);
      });
      row.appendChild(p); return row;
    };
    box.appendChild(pills('Where', [['morning', 'Morning'], ['daytime', 'Daytime'], ['evening', 'Evening']], partOf(o.hour), (v) => moveTo(o, v, api.offers)));
    box.appendChild(pills('Size', [['min', 'Minimum'], ['full', 'Full']], o.size || 'full', (v) => setSize(o, v)));
    const row = el('div', 'ts-btnrow');
    if (!o.thin && window.TempleDirector) {
      const ask = el('button', 'ts-btn', 'Ask about this'); ask.type = 'button'; ask.dataset.act = 'ask';
      ask.addEventListener('click', () => window.TempleDirector.ask(refOf(o), dirOf(o)));
      row.appendChild(ask);
    }
    if (!o.extraId) {                                                    // a flow extra keeps the way off it already had
      const off = el('button', 'ts-btn', 'Take it off today'); off.type = 'button'; off.dataset.act = 'off';
      off.addEventListener('click', () => { takeOff(o); if (api.toast) api.toast('Taken off today. Nothing is counted.'); api.render(); });
      row.appendChild(off);
    }
    if (row.firstChild) box.appendChild(row);
    return box;
  }

  // ── by a director's suggestion ──
  // Open suggestions: stored today, not yet answered. opts.home leaves out Rak's (nothing from Cupidity on home);
  // opts.dir keeps one director's.
  function suggestions(opts) {
    const adv = read(ADVICE, {}), d = day(), out = [], t = today();
    for (const dir of Object.keys((adv && adv.by) || {})) {
      const b = adv.by[dir], p = b && b.plan;
      if (!p || !p.item || !p.change) continue;
      if (String(b.at || '').slice(0, 10) !== t) continue;               // it was about another day's plan
      const id = 'sug-' + hash([dir, p.change, p.item, p.to || ''].join('|'));
      if (d.sug[id]) continue;
      if (opts && opts.home && dir === 'rak') continue;
      if (opts && opts.dir && opts.dir !== dir) continue;
      out.push({ id: id, dir: dir, change: p.change, item: p.item, to: p.to || '', why: p.why || '' });
    }
    return out;
  }
  function sentence(s, name) {
    const q = '“' + s.item + '”';
    if (s.change === 'add') return name + ' suggests adding ' + q + (PARTS[s.to] ? ' in the ' + s.to : '') + '.';
    if (s.change === 'move') return name + ' suggests moving ' + q + ' to the ' + (s.to || 'another part of the day') + '.';
    if (s.change === 'lighten') return name + ' suggests the minimum of ' + q + ' today.';
    if (s.change === 'swap') return name + ' suggests “' + s.to + '” in place of ' + q + '.';
    return name + ' suggests leaving ' + q + ' out today.';
  }
  const mark = (id, a) => { const d = day(); d.sug[id] = a; write(DAY, d); changed(); };
  // Yes. offers is home's list; on another page only the plan's own activities can be seen, and the rest is answered on home.
  function apply(s, offers) {
    const here = !!offers, list = here ? offers : acts().map((a) => ({ key: 'plan:' + a.id, name: a.name, hour: num(a.hour) ? a.hour : 18, act: a }));
    const want = s.item.toLowerCase().trim();
    const find = () => list.find((o) => !o.thin && String(o.name).toLowerCase().trim() === want) || list.find((o) => !o.thin && (String(o.name).toLowerCase().indexOf(want) >= 0 || want.indexOf(String(o.name).toLowerCase().trim()) >= 0));
    if (s.change === 'add') { add({ name: s.item, hour: num(PARTS[s.to]) ? PARTS[s.to] : sensibleHour(), from: s.dir }); mark(s.id, 'yes'); return { ok: true, text: 'Placed in today’s plan.' }; }
    const o = find();
    if (!o) {
      if (!here) return { ok: false, text: 'That one is answered on the home screen, where today’s plan is.' };
      mark(s.id, 'gone'); return { ok: false, text: 'That is not in today’s plan any more. Nothing was changed.' };
    }
    if (s.change === 'move') { if (!moveTo(o, s.to, list)) { mark(s.id, 'gone'); return { ok: false, text: 'It names no part of the day. Nothing was changed.' }; } mark(s.id, 'yes'); return { ok: true, text: 'Moved to the ' + s.to + '.' }; }
    if (s.change === 'lighten') { setSize(o, 'min'); mark(s.id, 'yes'); return { ok: true, text: 'Set to its minimum.' }; }
    if (s.change === 'swap') { if (!s.to) { mark(s.id, 'gone'); return { ok: false, text: 'It names nothing to swap in. Nothing was changed.' }; } const h = o.hour; takeOff(o); add({ name: s.to, hour: h, from: s.dir }); mark(s.id, 'yes'); return { ok: true, text: 'Swapped.' }; }
    takeOff(o); mark(s.id, 'yes'); return { ok: true, text: 'Taken off today.' };
  }
  const later = (s) => mark(s.id, 'later');                              // set down for the day; it is not raised again

  // a yes on an advice card: into today's plan, at a sensible hour, in the size he chose
  function place(card, dir, size, temple) {
    const m = /^(practice|plan):(.+)$/.exec(card.ref || '');
    return add({ name: card.offer, size: size === 'full' ? 'full' : 'min', min: card.min, full: card.full, from: dir, mark: card.mark, source: card.source, ref: card.ref, card: card.id, temple: temple || null, practiceId: temple && m ? m[2] : null });
  }

  window.TemplePlan = { PLAN, DAY, PARTS, today, partOf, sensibleHour, acts, add, update, remove, day, setOver, shape, setHour, setSize, takeOff, moveTo, controls, dirOf, refOf, suggestions, sentence, apply, later, place };
})();
