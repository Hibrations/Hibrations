// talk.js · the chat code the village and the temples' director sheet share (Portal remake, step 5).
//
// Everything between the two MOVED marks was cut out of village/index.html byte for byte by
// portal_remake/tools/step5/apply_village.js, and the village now loads this file. One chat, two doors: a line written
// in a temple is in the village's thread, and the other way round, because both read and write the same records:
//   IndexedDB 'lysningen' · store 'threads' · one record per villager { who, threads: [{ id, at, rows }] }
//   rows: Lek's { id, at, me, text } · an answer { id, ref, at, from, text, error } · a quiet line { id, at, sys, text }
// The helpers under the second mark are new: they read a record fresh and change it inside one transaction, so a page
// that holds no copy in memory never writes an old one back over the village's.
(function () {
  'use strict';
  if (window.TempleTalk) return;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ── MOVED from village/index.html, unchanged ──
const TDB = (() => { let p = null; return () => p || (p = new Promise((res) => {
  try { const r = indexedDB.open('lysningen', 1); r.onupgradeneeded = () => r.result.createObjectStore('threads', { keyPath: 'who' }); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch { res(null); }
})); })();
function dayOf(iso) {
  const d = new Date(iso), t = new Date(); if (isNaN(d)) return '';
  const k = (x) => x.toDateString(), y = new Date(t); y.setDate(t.getDate() - 1);
  if (k(d) === k(t)) return 'Today'; if (k(d) === k(y)) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...(d.getFullYear() !== t.getFullYear() ? { year: 'numeric' } : {}) });
}
const isLong = (s) => String(s || '').length > 900 || String(s || '').split('\n').length > 14;
// Markdown, the small part the villagers use: headings, lists, quotes, code, bold, italics, links. Escaped first.
function talkMd(src) {
  const inline = (s) => { // code spans are set aside first, so **bold around `a path`** still works
    const codes = [];
    return esc(String(s).replace(/`([^`\n]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`))
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/__(.+?)__/g, '<b>$1</b>')
      .replace(/(^|[\s(])\*(?!\s)([^*\n]+?)\*(?=[\s).,;:!?]|$)/g, '$1<i>$2</i>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[i])}</code>`);
  };
  const lines = String(src || '').replace(/\r/g, '').split('\n'), out = []; let para = [], list = null, code = null;
  const flush = () => { if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; if (list) { out.push(`<${list.t}>${list.items.map((x) => `<li>${inline(x)}</li>`).join('')}</${list.t}>`); list = null; } };
  for (const l of lines) {
    if (code) { if (/^\s*```/.test(l)) { out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); code = null; } else code.push(l); continue; }
    if (/^\s*```/.test(l)) { flush(); code = []; continue; }
    let m;
    if (!l.trim()) { flush(); continue; }
    if ((m = /^\s{0,3}#{1,6}\s+(.*)$/.exec(l))) { flush(); out.push(`<h4>${inline(m[1].replace(/\s#+$/, ''))}</h4>`); continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { flush(); out.push('<hr>'); continue; }
    if ((m = /^\s*>\s?(.*)$/.exec(l))) { flush(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue; }
    if ((m = /^\s*(?:([-*•+])|(\d+)[.)])\s+(.*)$/.exec(l))) {
      const t = m[1] ? 'ul' : 'ol'; if (para.length || (list && list.t !== t)) flush();
      (list = list || { t, items: [] }).items.push(m[3]); continue;
    }
    if (list && /^\s{2,}\S/.test(l)) { list.items[list.items.length - 1] += ' ' + l.trim(); continue; }
    if (list) flush();
    para.push(l);
  }
  if (code) out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
  flush(); return out.join('');
}
// redraw only what changed, keyed by row: a sync no longer throws away the scroll, a selection or an open answer
function patch(box, items) {
  const have = new Map();
  for (const el of [...box.children]) { if (el.dataset.k && !have.has(el.dataset.k)) have.set(el.dataset.k, el); else if (!el.classList.contains('newPill')) el.remove(); }
  const make = (it) => { const t = document.createElement('div'); t.innerHTML = it.html; const n = t.firstElementChild || document.createElement('div'); n.dataset.k = it.key; n._h = it.html; return n; };
  let prev = null;
  for (const it of items) {
    let el = have.get(it.key);
    if (el && el._h !== it.html) { const n = make(it); el.replaceWith(n); el = n; } else if (!el) el = make(it);
    have.delete(it.key);
    const want = prev ? prev.nextSibling : box.firstChild;
    if (el !== want) box.insertBefore(el, want);
    prev = el;
  }
  for (const el of have.values()) el.remove();
}
const nearEnd = (box) => box.scrollHeight - box.scrollTop - box.clientHeight < 48;
// a long answer opens at its first line; a short one just brings the end into view
function toStart(box, el) {
  if (!el) { box.scrollTop = box.scrollHeight; return; }
  const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 10;
  box.scrollTop = el.offsetHeight > box.clientHeight * .75 ? top : box.scrollHeight;
}
function showPill(pill, text, el) {
  pill.textContent = text; pill.hidden = false;
  pill.onclick = () => { pill.hidden = true; const box = pill.previousElementSibling; if (el && el.isConnected) toStart(box, el); else box.scrollTop = box.scrollHeight; };
}
function copyText(text, btn) {
  const done = () => { const was = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = was; }, 1400); };
  const fallback = () => { const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch {} t.remove(); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
}
// ── end of MOVED ──

  const time = (iso) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  const hhmm = (iso) => (dayOf(iso) === 'Today' ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : time(iso));

  // one transaction: fn gets the store and a setter for what the promise resolves to
  function tx(mode, fn) {
    return TDB().then((d) => new Promise((res) => {
      if (!d) return res(null);
      try {
        const t = d.transaction('threads', mode), s = t.objectStore('threads'); let out = null;
        fn(s, (v) => { out = v; });
        t.oncomplete = () => res(out); t.onerror = t.onabort = () => res(null);
      } catch (e) { res(null); }
    }));
  }
  const blank = (who) => ({ who, threads: [{ id: 't0', at: new Date().toISOString(), rows: [] }] });
  const getThread = (who) => tx('readonly', (s, out) => { const q = s.get(who); q.onsuccess = () => out(q.result || null); }).then((r) => r || blank(who));
  // true when the row was added, false when a row with that id was already there, null when the store is unavailable
  const addRow = (who, row) => tx('readwrite', (s, out) => {
    const q = s.get(who);
    q.onsuccess = () => {
      const rec = q.result || blank(who);
      if (rec.threads.some((t) => t.rows.some((r) => r.id === row.id))) return out(false);
      rec.threads[rec.threads.length - 1].rows.push(row); s.put(rec); out(true);
    };
  });
  // a new thread after a handover note, as the village's talkIn writes it
  const addThread = (who, e) => tx('readwrite', (s, out) => {
    const q = s.get(who);
    q.onsuccess = () => {
      const rec = q.result || blank(who);
      if (rec.threads.some((t) => t.id === e.id)) return out(false);
      rec.threads.push({ id: e.id, at: e.at, rows: [{ id: e.id + ':h', at: e.at, sys: true, text: e.text ? 'A new thread. ' + e.text : 'A new thread.' }] });
      s.put(rec); out(true);
    };
  });

  window.TempleTalk = { esc, dayOf, isLong, talkMd, patch, nearEnd, toStart, showPill, copyText, time, hhmm, db: TDB, getThread, addRow, addThread };
})();
