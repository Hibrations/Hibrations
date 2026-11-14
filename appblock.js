// appblock.js · reads the "=== APP ===" block a director ends an in-app answer with.
// Portal remake step 5 (portal_remake/step2_drafts/2_how_you_answer_in_the_app.md, part 2). One file for both sides:
// the phone loads it as window.TempleAppBlock, node (the bridge, in step 6) can require() it. It reads text and returns
// plain objects. It touches no store, never throws, and never hands raw block text back as something to show.
//
//   parseApp(answer, house) -> null (no block: keep what was stored) or
//     { talk, state, cards: [{ offer, min, full, mark, known, source, ref }], plan: null | { change, item, to, why } }
//   strip(answer)           -> the answer without its block (what Talk shows)
//   marksFor(house)         -> the mark words that house uses
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.TempleAppBlock = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // The four marks every house shares, and each house's own words beside them, taken from
  // <Project>/village/<director>/knowledge/sources.md (2026-11-14). A word that is in neither list is not thrown away:
  // it is shown as the director wrote it, with known: false.
  const SHARED = ['checked', 'narrower', 'doubtful', 'tradition'];
  const HOUSE_MARKS = {
    hekka: ['unchecked'],
    rak: [],
    garr: ["lek's rule"],
    thorn: ['doubtful until run', 'built, not tested'],
    nokka: ["lek's rule", 'unchecked', 'see hekka'],
    paa: ["lek's rule", 'unchecked'],
    ngoen: ['lek', 'guess', 'blank', 'unchecked'],
    malee: ['lek', 'blank', 'checked, and it moves'],
  };
  const marksFor = (house) => SHARED.concat(HOUSE_MARKS[String(house || '').toLowerCase()] || []);

  const CHANGES = ['add', 'move', 'lighten', 'swap', 'drop'];
  const APP_RE = /^[ \t]*=== APP ===[ \t]*\r?\n([\s\S]*?)^[ \t]*=== END ===[ \t]*$/m;
  const SEP = /\s*[·|]\s*|\s+-\s+/;
  const line = (body, key) => { const m = String(body).match(new RegExp('^[ \\t]*' + key + ':[ \\t]*(.*)$', 'm')); return m ? m[1].trim() : ''; };
  const dash = (s) => (s === '-' ? '' : s);

  function parseApp(answer, house) {
    answer = String(answer || '');
    const m = answer.match(APP_RE);
    if (!m) return null;
    const known = marksFor(house);
    // the plan suggestion, if there is one, is the last thing in the block
    const cut = m[1].split(/^[ \t]*PLAN[ \t]*$/m);
    const parts = cut[0].split(/^[ \t]*CARD[ \t]*$/m);
    const state = line(parts[0], 'STATE').slice(0, 59);
    const cards = parts.slice(1, 4).map((b) => {                       // never more than three
      const raw = line(b, 'MARK'), at = raw.search(SEP);
      const word = dash((at < 0 ? raw : raw.slice(0, at)).trim()).slice(0, 40);
      const rest = at < 0 ? '' : raw.slice(at).replace(SEP, '').trim();
      const ref = line(b, 'REF');
      const lower = word.toLowerCase();
      return {
        offer: line(b, 'OFFER').slice(0, 89), min: line(b, 'MIN').slice(0, 139), full: dash(line(b, 'FULL')).slice(0, 199),
        mark: !word || lower === 'none' ? 'none' : known.indexOf(lower) >= 0 ? lower : word,   // an unknown word stays as written
        known: !word || lower === 'none' || known.indexOf(lower) >= 0,
        source: dash(rest).slice(0, 80),
        ref: /^[a-z]+:[a-z0-9_.\/-]{1,60}$/.test(ref) ? ref : null,
      };
    }).filter((c) => c.offer && c.min);                                // a card with no offer or no minimum is dropped
    let plan = null;
    if (cut.length > 1) {
      const b = cut[1], change = line(b, 'CHANGE').toLowerCase(), item = line(b, 'ITEM').slice(0, 89);
      if (CHANGES.indexOf(change) >= 0 && item) plan = { change: change, item: item, to: dash(line(b, 'TO')).slice(0, 89), why: dash(line(b, 'WHY')).slice(0, 139) };
    }
    if (!state && !cards.length && !plan) return null;
    return { talk: answer.slice(0, m.index).trim(), state: state, cards: cards, plan: plan };
  }

  // What Talk shows: the answer without its block. A block that never closed is cut from its first line.
  function strip(answer) {
    answer = String(answer || '');
    const m = answer.match(APP_RE);
    if (m) return (answer.slice(0, m.index) + answer.slice(m.index + m[0].length)).trim();
    const open = answer.search(/^[ \t]*=== APP ===[ \t]*$/m);
    return open >= 0 ? answer.slice(0, open).trim() : answer;
  }

  return { parseApp: parseApp, strip: strip, marksFor: marksFor, SHARED: SHARED, HOUSE_MARKS: HOUSE_MARKS, CHANGES: CHANGES };
});
