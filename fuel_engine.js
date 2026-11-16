// fuel_engine.js — the thinking behind Body Temple's Fuel tab (2026-11-16). Pure logic: no DOM, no storage writes.
//
// What it knows how to do:
//   · search    one search over Lek's own foods, the Danish food database Frida (food_dk.js, offline) and whatever
//               Open Food Facts found before; his own and often-eaten foods first
//   · amounts   grams, pieces, slices, spoons, scoops, servings, in Danish and English ("2 skiver", "300g", "½ dl")
//   · parse     a meal written as he would say it: "2 æg, 2 skiver rugbrød med leverpostej og 300 g skyr"
//   · usual     what he tends to eat at this hour, and how much, from his own log
//   · suggest   what would close today's protein within the energy that is left, from foods he actually eats
//   · targets   training day or rest day, from the Body Temple schedule and today's log (Fitness/training_plan.md:
//               recomposition ~2,200–2,300 kcal on training days, ~2,400 maintenance on rest days, protein 120–150 g)
//   · Open Food Facts: the URLs and the mapping of a product to a food (the page does the fetching)
//
// Food, as this file sees it: { id, name, src: 'mine'|'frida'|'off', per100?: {kcal,p,c,f,fib}, serving: label,
//   servingG?: grams in one serving, perServing?: {kcal,p,c,f,fib}, barcode? }
// A log item keeps the shape the page has always written ({ id, foodId, name, servings, kcal, p, c, f, ts }) and may add
//   g (grams eaten), fib, src, label ("2 slices · 90 g") and q / u (the amount as given: 2, 'slice'). Readers that know none of these read it as before.
(function (root) {
  'use strict';

  // ── targets (Fitness/training_plan.md §nutrition; protein first, carbs around the session) ──
  var DEFAULT_TARGETS = {
    training: { calories: 2250, protein: 140, carbs: 275, fat: 65 },
    rest:     { calories: 2400, protein: 140, carbs: 245, fat: 95 }
  };
  var DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function dayOf(key) { return new Date(key + 'T12:00:00'); }

  // 'training' when the schedule holds a plan that day or a training session was logged; otherwise 'rest'.
  // A rest day logged by hand (Body Temple's "today is a rest day") wins.
  function dayKind(body, key) {
    key = key || dateKey();
    var sessions = (body && body.sessions) || [];
    var todays = sessions.filter(function (s) { return s && s.date === key; });
    if (todays.some(function (s) { return s.rest; })) return { kind: 'rest', why: 'a rest day, logged' };
    var trained = todays.filter(function (s) { return s.type === 'training'; })[0];
    if (trained) return { kind: 'training', why: trained.planName || 'a session', done: true };
    var id = body && body.schedule ? body.schedule[DAYS[dayOf(key).getDay()]] : null;
    var plan = id && (body.plans || []).filter(function (p) { return p.id === id; })[0];
    if (plan) return { kind: 'training', why: plan.name };
    var alt = id && (body.altModes || []).filter(function (m) { return m.id === id; })[0];
    return { kind: 'rest', why: alt ? alt.name : 'no session set' };
  }
  // The targets for a day. fuelStore is body_fuel_v1 (may be null): byDay off means the one set in body_temple_v1.
  function targetsFor(body, fuelStore, key) {
    var fs = fuelStore || {}, base = (body && body.fuel && body.fuel.targets) || DEFAULT_TARGETS.rest;
    if (fs.byDay === false) return { kind: null, why: '', t: base };
    var k = dayKind(body, key);
    var t = (fs[k.kind] && fs[k.kind].calories) ? fs[k.kind] : DEFAULT_TARGETS[k.kind];
    return { kind: k.kind, why: k.why, done: !!k.done, t: t };
  }

  // ── names ──
  function norm(s) {
    return String(s || '').toLowerCase().replace(/[(),.;:!?"'’`´]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function fold(s) {   // æøå kept for Danish, other accents folded
    return norm(s).replace(/[éèêë]/g, 'e').replace(/[áàâä]/g, 'a').replace(/[óòôö]/g, 'o').replace(/[íìîï]/g, 'i').replace(/[úùûü]/g, 'u');
  }
  // Danish ↔ English for the words a food name is most likely to be searched by. Matching tries both.
  var ALIAS = {
    'æg': 'egg', 'æggehvide': 'egg white', 'kylling': 'chicken', 'kyllingebryst': 'chicken breast', 'ris': 'rice', 'havregryn': 'oats',
    'banan': 'banana', 'olivenolie': 'olive oil', 'mandler': 'almonds', 'mælk': 'milk', 'smør': 'butter', 'ost': 'cheese', 'brød': 'bread',
    'kartoffel': 'potato', 'kartofler': 'potato', 'laks': 'salmon', 'tun': 'tuna', 'oksekød': 'beef', 'hakket oksekød': 'minced beef',
    'svinekød': 'pork', 'æble': 'apple', 'appelsin': 'orange', 'pasta': 'pasta', 'nødder': 'nuts', 'jordnøddesmør': 'peanut butter',
    'avocado': 'avocado', 'broccoli': 'broccoli', 'gulerod': 'carrot', 'gulerødder': 'carrot', 'løg': 'onion', 'tomat': 'tomato',
    'agurk': 'cucumber', 'spinat': 'spinach', 'bær': 'berries', 'blåbær': 'blueberries', 'jordbær': 'strawberries', 'honning': 'honey',
    'yoghurt': 'yogurt', 'græsk yoghurt': 'greek yogurt', 'hytteost': 'cottage cheese', 'proteinpulver': 'whey protein', 'valle': 'whey',
    'kaffe': 'coffee', 'te': 'tea', 'vand': 'water', 'øl': 'beer', 'vin': 'wine', 'rugbrød': 'rye bread', 'franskbrød': 'white bread'
  };
  var REVERSE = {}; Object.keys(ALIAS).forEach(function (k) { REVERSE[ALIAS[k]] = k; });
  function variants(q) {
    var n = fold(q), out = [n];
    if (ALIAS[n]) out.push(ALIAS[n]);
    if (REVERSE[n]) out.push(REVERSE[n]);
    n.split(' ').forEach(function (w) { if (ALIAS[w]) out.push(n.replace(w, ALIAS[w])); if (REVERSE[w]) out.push(n.replace(w, REVERSE[w])); });
    // Danish plurals: frikadeller → frikadelle, kartofler → kartofl(el), æbler → æble
    n.split(' ').forEach(function (w) {
      if (w.length > 5 && /er$/.test(w)) { out.push(n.replace(w, w.slice(0, -1))); out.push(n.replace(w, w.slice(0, -2))); }
      else if (w.length > 4 && /e$/.test(w)) out.push(n.replace(w, w.slice(0, -1)));
    });
    return out.filter(function (v, i) { return v && out.indexOf(v) === i; });
  }
  // 0 (no match) … 100 (exact). Every word of the query must start a word of the name (or sit inside a compound,
  // since Danish glues words: "leverpostej" holds "postej").
  function nameScore(name, q) {
    var n = fold(name), words = n.split(' ');
    var best = 0;
    variants(q).forEach(function (v) {
      if (!v) return;
      if (n === v) { best = Math.max(best, 100); return; }
      var qs = v.split(' '), s = 0, ok = true;
      qs.forEach(function (w) {
        if (!w) return;
        var hit = 0;
        words.forEach(function (x, i) {
          if (x === w) hit = Math.max(hit, i === 0 ? 30 : 24);
          else if (x.indexOf(w) === 0) hit = Math.max(hit, i === 0 ? 22 : 16);
          else if (w.length >= 4 && x.indexOf(w) > 0) hit = Math.max(hit, 8);
        });
        if (!hit) ok = false; s += hit;
      });
      if (!ok) return;
      s = s / qs.length + (n.indexOf(v) === 0 ? 20 : 0) - Math.min(20, Math.max(0, words.length - qs.length) * 3);
      best = Math.max(best, Math.min(99, s + 40));
    });
    return best;
  }

  // The everyday one, when a plain word is searched: Frida holds a duck's egg and a dozen breads, and the
  // one meant is nearly always the same. [what was searched, the Frida name it most likely means]
  var USUAL = [
    [/^(æg|egg|eggs)$/, /^Æg, høne, frilands høns, rå/], [/^(mælk|milk)$/, /^Letmælk, konventionel/], [/^(rugbrød|rye bread)$/, /^Rugbrød, fuldkorn, industrifremstillet/],
    [/^(ris|rice)$/, /^Ris, kogte/], [/^pasta$/, /^Pasta, kogt/], [/^(kartofl|kartoffel|kartofler|potato|potatoes)$/, /^Kartoffel, kogt/],
    [/^(laks|salmon)$/, /^Laks, atlantisk, opdræt, rå/], [/^(hakket oksekød|oksekød|minced beef)$/, /^Oksekød, hakket, 8-12% fedt/],
    [/^(smør|butter)$/, /^Smør, saltet/], [/^(ost|cheese)$/, /^Ost, fast, 45\+, alle typer/], [/^(kylling|chicken)$/, /^Kylling, kød og skind, rå/],
    [/^(skyr)$/, /^Skyr/], [/^(havregryn|oats)$/, /^Havregryn, uspec/], [/^(hytteost|cottage cheese)$/, /^Hytteost, 5\+/]
  ];
  var DISH = /(sandwich|fastfood|burger|pizza|salat|med|i olie|dybfrost|konserves)/i;
  function usualBonus(food, q) {
    if (food.src !== 'frida') return 0;
    var n = fold(q), b = 0;
    USUAL.forEach(function (u) { if (u[0].test(n) && u[1].test(food.name)) b += 45; });
    if (DISH.test(food.name) && !DISH.test(n)) b -= 18;                     // a composite dish only when asked for
    return b;
  }

  // ── foods from every source, as one shape ──
  function servingGrams(label) {
    var m = String(label || '').match(/(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i);
    return m ? parseFloat(m[1].replace(',', '.')) : null;
  }
  function fromMine(fd) {
    var sg = fd.g || servingGrams(fd.serving);
    var ps = { kcal: +fd.kcal || 0, p: +fd.p || 0, c: +fd.c || 0, f: +fd.f || 0, fib: +fd.fib || 0 };
    var per100 = fd.per100 || (sg ? scale(ps, 100 / sg) : null);
    return { id: fd.id, name: fd.name, src: 'mine', from: fd.src || null, serving: fd.serving || '1 serving', servingG: sg || null, perServing: ps, per100: per100, barcode: fd.barcode || null };
  }
  // food_dk.js rows: [id, Danish name, English name, kcal, protein, carbs, fat, fibre] per 100 g
  function fromFrida(r) {
    return { id: 'frida:' + r[0], name: r[1], alt: r[2] || '', src: 'frida', serving: '100 g', servingG: 100,
      per100: { kcal: r[3] || 0, p: r[4] || 0, c: r[5] || 0, f: r[6] || 0, fib: r[7] || 0 } };
  }
  function scale(n, k) { return { kcal: (n.kcal || 0) * k, p: (n.p || 0) * k, c: (n.c || 0) * k, f: (n.f || 0) * k, fib: (n.fib || 0) * k }; }

  // ── how much ──
  var NUMWORDS = { en: 1, et: 1, 'ét': 1, one: 1, a: 1, an: 1, to: 2, two: 2, tre: 3, three: 3, fire: 4, four: 4, fem: 5, five: 5,
    seks: 6, six: 6, syv: 7, seven: 7, otte: 8, eight: 8, halv: 0.5, halvt: 0.5, half: 0.5, 'en halv': 0.5, 'et halvt': 0.5 };
  var FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
  // unit words → [canonical, grams (or ml) per unit when the food doesn't say]
  var UNITS = {
    g: ['g', 1], gram: ['g', 1], grams: ['g', 1], kg: ['g', 1000], ml: ['ml', 1], dl: ['ml', 100], cl: ['ml', 10], l: ['ml', 1000], liter: ['ml', 1000],
    stk: ['piece', null], styk: ['piece', null], piece: ['piece', null], pieces: ['piece', null], pcs: ['piece', null],
    skive: ['slice', null], skiver: ['slice', null], slice: ['slice', null], slices: ['slice', null],
    spsk: ['tbsp', 15], tbsp: ['tbsp', 15], spiseske: ['tbsp', 15], spiseskefuld: ['tbsp', 15],
    tsk: ['tsp', 5], tsp: ['tsp', 5], teske: ['tsp', 5],
    scoop: ['scoop', 30], scoops: ['scoop', 30], skovl: ['scoop', 30], måleske: ['scoop', 30],
    glas: ['glass', 200], glass: ['glass', 200], kop: ['cup', 240], kopper: ['cup', 240], cup: ['cup', 240], cups: ['cup', 240],
    håndfuld: ['handful', 28], handful: ['handful', 28], portion: ['portion', null], portioner: ['portion', null], serving: ['portion', null], servings: ['portion', null],
    dåse: ['can', null], can: ['can', null], bæger: ['tub', null], pakke: ['pack', null]
  };
  // grams of one piece or slice, for foods whose name says what they are
  var PIECE = [
    [/\b(æg|egg)/, 60], [/rugbrød|rye bread/, 45], [/franskbrød|toast|white bread|bolle|bun/, 30], [/knækbrød|crispbread/, 12],
    [/banan|banana/, 120], [/æble|apple/, 150], [/appelsin|orange/, 160], [/pære|pear/, 170], [/kiwi/, 75], [/mandarin|clementin/, 70],
    [/kartoffel|potato/, 100], [/gulerod|carrot/, 70], [/tomat|tomato/, 100], [/avocado/, 150], [/frikadelle/, 60], [/pålæg|ham|skinke|salami/, 15],
    [/leverpostej|liver paste|pate/, 25], [/ost|cheese/, 20], [/kyllingebryst|chicken breast/, 150], [/pølse|sausage|hotdog/, 75], [/tortilla|wrap/, 60],
    [/proteinbar|protein bar/, 55], [/riskage|rice cake/, 8]
  ];
  // grams of one piece when the food's name says it comes in pieces (an egg, a slice of bread), else null
  function namedPiece(food) {
    var n = fold(food.name + ' ' + (food.alt || ''));
    for (var i = 0; i < PIECE.length; i++) if (PIECE[i][0].test(n)) return PIECE[i][1];
    return null;
  }
  function pieceGrams(food, unit) {
    if (food.servingG && (unit === 'portion' || unit === 'can' || unit === 'tub' || unit === 'pack')) return food.servingG;
    var n = fold(food.name + ' ' + (food.alt || ''));
    for (var i = 0; i < PIECE.length; i++) if (PIECE[i][0].test(n)) return PIECE[i][1];
    if (food.servingG) return food.servingG;
    return null;
  }
  // What an amount of a food holds. unit: 'serving' | 'g' | 'ml' | a UNITS canonical. Returns { servings, g, label, n }
  function amountOf(food, qty, unit) {
    qty = qty > 0 ? qty : 1;
    unit = unit || (food.src === 'mine' ? 'serving' : (food.per100 && !food.perServing ? 'g' : 'serving'));
    var g = null;
    if (unit === 'g' || unit === 'ml') g = qty;
    else if (unit !== 'serving') {
      var u = null; Object.keys(UNITS).forEach(function (k) { if (UNITS[k][0] === unit && UNITS[k][1]) u = UNITS[k][1]; });
      var each = (unit === 'piece' || unit === 'slice' || unit === 'portion' || unit === 'can' || unit === 'tub' || unit === 'pack') ? pieceGrams(food, unit) : u;
      if (each) g = qty * each;
      else unit = 'serving';
    }
    var n, servings;
    if (g !== null && food.per100) { n = scale(food.per100, g / 100); servings = food.servingG ? g / food.servingG : g / 100; }
    else if (g !== null && food.servingG && food.perServing) { servings = g / food.servingG; n = scale(food.perServing, servings); }
    else if (food.perServing) { servings = qty; n = scale(food.perServing, qty); g = food.servingG ? qty * food.servingG : null; unit = 'serving'; }
    else { servings = qty; g = qty * 100; n = scale(food.per100 || {}, qty); }
    return { servings: servings, g: g, qty: qty, unit: unit, n: n, label: labelFor(food, qty, unit, g) };
  }
  var UNIT_WORD = { piece: ['piece', 'pieces'], slice: ['slice', 'slices'], tbsp: ['tbsp', 'tbsp'], tsp: ['tsp', 'tsp'], scoop: ['scoop', 'scoops'],
    glass: ['glass', 'glasses'], cup: ['cup', 'cups'], handful: ['handful', 'handfuls'], portion: ['portion', 'portions'], can: ['can', 'cans'], tub: ['tub', 'tubs'], pack: ['pack', 'packs'] };
  function num(x) { var r = Math.round(x * 10) / 10; return (r % 1 === 0 ? r.toFixed(0) : r.toFixed(1)).replace('.5', '½').replace(/^0½$/, '½'); }
  function labelFor(food, qty, unit, g) {
    if (unit === 'g' || unit === 'ml') return Math.round(qty) + ' ' + unit;
    if (unit === 'serving' && g && /^\s*\d+(?:[.,]\d+)?\s*(g|ml)\s*$/i.test(food.serving || '')) return Math.round(g) + ' ' + (/ml/i.test(food.serving) ? 'ml' : 'g');
    if (unit === 'serving') return num(qty) + ' × ' + (food.serving || 'serving') + (g && !/\d\s*(g|ml)\b/.test(food.serving || '') ? ' · ' + Math.round(g) + ' g' : '');
    var w = UNIT_WORD[unit] || [unit, unit];
    return num(qty) + ' ' + (qty > 1 ? w[1] : w[0]) + (g ? ' · ' + Math.round(g) + ' g' : '');
  }
  // One log item from a food and an amount, in the shape the page writes.
  function logItem(food, amt, uid, now) {
    var n = amt.n, r1 = function (x) { return Math.round(x * 10) / 10; };
    var it = { id: uid, foodId: food.id, name: food.name, servings: r1(amt.servings), kcal: Math.round(n.kcal), p: r1(n.p), c: r1(n.c), f: r1(n.f), ts: now || Date.now() };
    if (amt.g) it.g = Math.round(amt.g);
    if (n.fib) it.fib = r1(n.fib);
    if (food.src !== 'mine') it.src = food.src;
    it.label = amt.label;
    it.q = Math.round(amt.qty * 100) / 100; it.u = amt.unit;   // the amount as he gave it, so "the usual" repeats it exactly
    return it;
  }

  // ── search ──
  // sources: { mine: [foods as stored], frida: [rows] | null, off: [OFF foods already mapped] }, usage from usage()
  function search(sources, q, usageMap, limit) {
    var out = [], seen = {};
    var add = function (food, bonus) {
      var key = fold(food.name);
      if (seen[key]) return;
      var s = Math.max(nameScore(food.name, q), food.alt ? nameScore(food.alt, q) - 4 : 0);
      if (!s) return;
      seen[key] = true;
      var u = usageMap && (usageMap[food.id] || usageMap['name:' + key]);
      out.push({ food: food, score: s + bonus + usualBonus(food, q) + (u ? Math.min(25, 6 + u.count * 2) : 0) });
    };
    if (!fold(q)) return [];
    (sources.mine || []).forEach(function (fd) { add(fromMine(fd), 50); });   // his own first, above Frida's everyday pick
    (sources.off || []).forEach(function (fd) { add(fd, 5); });
    (sources.frida || []).forEach(function (r) { add(fromFrida(r), 0); });
    out.sort(function (a, b) { return b.score - a.score || a.food.name.length - b.food.name.length; });
    return out.slice(0, limit || 30).map(function (x) { return x.food; });
  }

  // ── his habits, from the log ──
  // { <foodId or 'name:<name>'>: { count, last: { servings, g, label, ts }, hours: [..], name, foodId } }
  function usage(log, days, todayKey) {
    var out = {}, keys = Object.keys(log || {}).sort().reverse(), cutoff = null;
    if (days) { var d = dayOf(todayKey || dateKey()); d.setDate(d.getDate() - days); cutoff = dateKey(d); }
    keys.forEach(function (k) {
      if (cutoff && k < cutoff) return;
      (log[k] || []).forEach(function (it) {
        var key = it.foodId || ('name:' + fold(it.name));
        var u = out[key] || (out[key] = { count: 0, last: null, lastDay: null, hours: [], name: it.name, foodId: it.foodId || null });
        u.count++;
        if (!u.lastDay || k > u.lastDay || (k === u.lastDay && (it.ts || 0) > ((u.last && u.last.ts) || 0))) { u.lastDay = k; u.last = it; }
        if (it.ts) u.hours.push(new Date(it.ts).getHours() + new Date(it.ts).getMinutes() / 60);
      });
    });
    return out;
  }
  // What he tends to eat around this hour: [{ key, name, foodId, last, score }]
  function usualNow(log, hour, todayKey, max) {
    var u = usage(log, 45, todayKey), today = (log && log[todayKey || dateKey()]) || [];
    var had = {}; today.forEach(function (it) { had[it.foodId || ('name:' + fold(it.name))] = true; });
    var list = Object.keys(u).map(function (k) {
      var x = u[k], dist = function (h) { var d = Math.abs(h - hour); return Math.min(d, 24 - d); };
      var near = x.hours.filter(function (h) { return dist(h) <= 2; }).length;
      var closest = x.hours.length ? Math.min.apply(null, x.hours.map(dist)) : 24;
      x = { key: k, name: x.name, foodId: x.foodId, last: x.last, count: x.count, score: x.count + near * 3 + Math.max(0, 2 - closest) * 2 - (had[k] ? 6 : 0) };
      x.near = near; return x;
    }).filter(function (x) { return x.count >= 2 || x.score >= 3; });
    if (list.filter(function (x) { return x.near > 0; }).length >= 2) list = list.filter(function (x) { return x.near > 0; });   // enough from this hour: only those
    list.sort(function (a, b) { return b.score - a.score || a.name.localeCompare(b.name); });
    return list.slice(0, max || 6);
  }
  // The meal of the day a time falls in, and the same meal on another day (for "as yesterday morning").
  function mealOf(ts) {
    var h = new Date(ts).getHours();
    return h < 11 ? 'morning' : h < 15 ? 'midday' : h < 18 ? 'afternoon' : 'evening';
  }
  function mealItems(log, key, meal) { return ((log && log[key]) || []).filter(function (it) { return it.ts && mealOf(it.ts) === meal; }); }

  // ── what would close today ──
  // pool: foods (one shape) he eats, each with a usual amount; left: { kcal, p }. Returns up to 3 ideas:
  //   [{ items: [{ food, amt }], p, kcal }] — each closes most of the protein without going past the energy left.
  function suggest(pool, left, max) {
    if (!left || left.p < 8 || left.kcal < 80) return [];
    var cands = pool.map(function (x) {
      var a = x.amt; if (!a || !a.n || a.n.p < 4) return null;
      return { food: x.food, amt: a, p: a.n.p, kcal: a.n.kcal, dens: a.n.p / Math.max(1, a.n.kcal) };
    }).filter(Boolean).sort(function (a, b) { return b.dens - a.dens; }).slice(0, 8);
    var ideas = [];
    var make = function (parts) {
      var p = 0, kcal = 0; parts.forEach(function (x) { p += x.amt.n.p; kcal += x.amt.n.kcal; });
      if (kcal > left.kcal + 40) return;
      ideas.push({ items: parts.map(function (x) { return { food: x.food, amt: x.amt }; }), p: p, kcal: kcal, fit: Math.min(p, left.p) / left.p - (kcal / Math.max(1, left.kcal)) * 0.15 });
    };
    cands.forEach(function (c) {
      var k = Math.max(1, Math.min(2, Math.round(left.p / c.p)));     // the usual amount, or twice it, never more
      var amt = amountOf(c.food, c.amt.qty * k, c.amt.unit);
      make([{ food: c.food, amt: amt }]);
    });
    for (var i = 0; i < cands.length; i++) for (var j = i + 1; j < cands.length; j++) {
      if (cands[i].p + cands[j].p > left.p * 1.35) continue;
      make([cands[i], cands[j]]);
    }
    ideas.sort(function (a, b) { return b.fit - a.fit; });
    var out = [], names = {};
    ideas.forEach(function (x) {
      var key = x.items.map(function (i) { return i.food.name; }).sort().join('+');
      if (names[key] || out.length >= (max || 3)) return; names[key] = true; out.push(x);
    });
    return out;
  }

  // ── a meal as he'd say it ──
  function readQty(tok) {
    if (tok == null) return null;
    var t = String(tok).toLowerCase();
    if (FRACTIONS[t]) return FRACTIONS[t];
    var m = t.match(/^(\d+)?([½¼¾⅓⅔])$/); if (m) return (m[1] ? +m[1] : 0) + FRACTIONS[m[2]];
    m = t.match(/^(\d+)\/(\d+)$/); if (m && +m[2]) return +m[1] / +m[2];
    m = t.match(/^\d+(?:[.,]\d+)?$/); if (m) return parseFloat(t.replace(',', '.'));
    if (NUMWORDS[t] != null) return NUMWORDS[t];
    return null;
  }
  // "2 skiver rugbrød med leverpostej, 300g skyr og en banan" → [{ text, query, qty, unit }]
  function splitMeal(text) {
    return String(text || '').split(/\s*(?:[,;\n+&]|\bog\b|\band\b|\bmed\b|\bwith\b|\bsamt\b)\s*/i).map(function (chunk) {
      var c = chunk.trim(); if (!c) return null;
      c = c.replace(/(\d)\s*(g|kg|ml|dl|cl|l)\b/gi, '$1 $2');           // 300g → 300 g
      var w = c.split(/\s+/), qty = null, unit = null, i = 0;
      if (w.length > 1 && (w[0] + ' ' + w[1]).toLowerCase() in NUMWORDS) { qty = NUMWORDS[(w[0] + ' ' + w[1]).toLowerCase()]; i = 2; }
      else { var q0 = readQty(w[0]); if (q0 !== null && w.length > 1) { qty = q0; i = 1; } }
      if (w[i] && UNITS[w[i].toLowerCase()]) { unit = UNITS[w[i].toLowerCase()][0]; if (/^kg$/i.test(w[i])) qty = (qty || 1) * 1000; if (/^dl$/i.test(w[i])) qty = (qty || 1) * 100; if (/^cl$/i.test(w[i])) qty = (qty || 1) * 10; if (/^(l|liter)$/i.test(w[i])) qty = (qty || 1) * 1000; i++; }
      var rest = w.slice(i);
      if (qty === null && rest.length > 2) {                                // "skyr 300 g" — the amount after the name
        var t2 = rest[rest.length - 1].toLowerCase(), t1 = rest[rest.length - 2];
        if (UNITS[t2] && readQty(t1) !== null) { qty = readQty(t1); unit = UNITS[t2][0]; if (t2 === 'kg') qty *= 1000; if (t2 === 'dl') qty *= 100; rest = rest.slice(0, -2); }
      }
      if (rest[0] && /^(af|of)$/i.test(rest[0])) rest = rest.slice(1);
      var query = rest.join(' ').trim();
      return query ? { text: chunk.trim(), query: query, qty: qty, unit: unit } : null;
    }).filter(Boolean);
  }
  // Each part with its best food and amount. A part with no food found comes back with food: null.
  function parseMeal(sources, text, usageMap, lastAmount) {
    return splitMeal(text).map(function (part) {
      var hits = search(sources, part.query, usageMap, 4), food = hits[0] || null;
      if (!food) return { part: part, food: null, alts: [] };
      var qty = part.qty, unit = part.unit;
      if (qty === null && unit === null && lastAmount) {                     // no amount said: what he had last time
        var la = lastAmount(food);
        if (la) { qty = la.qty; unit = la.unit; }
      }
      var named = PIECE.some(function (r) { return r[0].test(fold(part.query)); });   // "½ kyllingebryst": a piece, by what was said
      if (unit === null && named && !(qty > 20) && !/^1 (large|medium|small|slice|stk|piece)/i.test(food.serving || '')) unit = 'piece';
      if (unit === null) unit = (food.src === 'mine' && !(qty > 20)) ? 'serving' : (qty > 20 ? 'g' : (pieceGrams(food, 'piece') ? 'piece' : 'serving'));
      return { part: part, food: food, alts: hits.slice(1), amt: amountOf(food, qty === null ? 1 : qty, unit) };
    });
  }

  // ── Open Food Facts ──
  var OFF_FIELDS = 'code,product_name,product_name_da,product_name_en,generic_name,brands,serving_size,serving_quantity,nutriments';
  var OFF = {
    productUrl: function (code) { return 'https://world.openfoodfacts.org/api/v2/product/' + encodeURIComponent(code) + '.json?fields=' + OFF_FIELDS; },
    searchUrl: function (q) { return 'https://dk.openfoodfacts.org/cgi/search.pl?search_simple=1&json=1&page_size=15&search_terms=' + encodeURIComponent(q) + '&fields=' + OFF_FIELDS; },
    // a product → a food, or null when it has no energy written
    toFood: function (p) {
      if (!p) return null;
      var n = p.nutriments || {}, kcal = n['energy-kcal_100g'];
      if (kcal == null && n['energy_100g'] != null) kcal = n['energy_100g'] / 4.184;
      if (kcal == null) return null;
      var name = (p.product_name_da || p.product_name || p.product_name_en || p.generic_name || '').trim();
      if (!name) return null;
      var brand = String(p.brands || '').split(',')[0].trim();
      if (brand && fold(name).indexOf(fold(brand)) < 0) name = name + ' (' + brand + ')';
      var sq = parseFloat(p.serving_quantity);
      return { id: 'off:' + p.code, name: name, src: 'off', barcode: String(p.code || ''),
        per100: { kcal: +kcal || 0, p: +n.proteins_100g || 0, c: +n.carbohydrates_100g || 0, f: +n.fat_100g || 0, fib: +n.fiber_100g || 0 },
        servingG: sq > 0 ? sq : null, serving: sq > 0 ? (p.serving_size || (sq + ' g')) : '100 g' };
    }
  };
  // A found food as it is kept in "my foods" (so it is there offline and in every search after)
  function toMine(food, uid) {
    var sg = food.servingG || 100, ps = scale(food.per100 || {}, sg / 100), r1 = function (x) { return Math.round(x * 10) / 10; };
    var out = { id: uid, name: food.name, serving: food.servingG ? (/\d\s*g\b/.test(food.serving) ? food.serving : food.serving + ' (' + Math.round(sg) + ' g)') : '100 g',
      kcal: Math.round(ps.kcal), p: r1(ps.p), c: r1(ps.c), f: r1(ps.f), g: Math.round(sg), per100: food.per100, src: food.src };
    if (ps.fib) out.fib = r1(ps.fib);
    if (food.barcode) out.barcode = food.barcode;
    return out;
  }

  root.FuelEngine = {
    DEFAULT_TARGETS: DEFAULT_TARGETS, dateKey: dateKey, dayKind: dayKind, targetsFor: targetsFor,
    norm: norm, fold: fold, nameScore: nameScore, fromMine: fromMine, fromFrida: fromFrida, scale: scale,
    UNITS: UNITS, amountOf: amountOf, pieceGrams: pieceGrams, namedPiece: namedPiece, logItem: logItem, search: search,
    usage: usage, usualNow: usualNow, mealOf: mealOf, mealItems: mealItems, suggest: suggest,
    splitMeal: splitMeal, parseMeal: parseMeal, readQty: readQty, OFF: OFF, toMine: toMine, UNIT_WORD: UNIT_WORD
  };
})(typeof window !== 'undefined' ? window : globalThis);
