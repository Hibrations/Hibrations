// train_gen.js — today's movements, generated from what Lek has actually done (2026-11-15).
//
// Shared by Body Temple (body/index.html) and the Portal (index.html), so both show the same picks.
// It reads body_temple_v1 (plans, library, sessions) and never writes it. Its one store is
//   body_picks_v1  { date: 'YYYY-MM-DD', plans: { <planId>: { <slot id>: <library id> } } }
// the swaps Lek made by hand today; it is forgotten the next day.
//
// How a slot is filled. Every plan movement belongs to a family of movements that do the same job
// (vertical pull, squat, triceps …). For each slot, in plan order:
//   1. never what this slot had in the last session of this same plan, so nothing repeats two sessions
//      (or two weeks) in a row. Sessions logged before 2026-11-15 carry no slot, so then nothing at all
//      from that last session, as long as the family has something else;
//   2. what wasn't in that last session at all comes before what was;
//   3. then the one done longest ago; never done counts as longest ago;
//   4. ties go to the plan's own movement, then the family's order;
//   5. one movement is used once per session.
// A movement in no family (mobility, custom ones) or alone in its family stays as written: an anchor.
// The history is read up to yesterday, so today's picks hold still all day, also after the session.
(function (root) {
  'use strict';

  var FAMILIES = {
    vertical_pull:   ['weighted_pullup', 'pullup', 'lat_pulldown', 'lat_pulldown_close'],
    horizontal_pull: ['barbell_row', 'cable_row', 'db_row', 'kb_renegade_row'],   // pendlay_row left out: the plan's barbell row is one
    bw_pull:         ['inverted_row', 'pullup'],
    rear_delt:       ['rear_delt_fly', 'face_pull'],
    biceps:          ['hammer_curl', 'incline_db_curl'],
    vertical_push:   ['overhead_press', 'db_shoulder_press', 'push_press', 'kb_strict_press', 'kb_bottoms_up_press'],
    horizontal_push: ['incline_db_press', 'flat_db_press', 'bench_press'],
    bw_push:         ['pushup', 'dips'],
    triceps:         ['tricep_pushdown', 'overhead_tricep_extension', 'dips'],
    squat:           ['back_squat', 'front_squat', 'kb_front_squat', 'goblet_squat', 'leg_press'],
    lunge:           ['bulgarian_split_squat', 'walking_lunge', 'pistol_squat'],
    hinge:           ['romanian_deadlift', 'conventional_deadlift', 'trap_bar_deadlift', 'kb_single_arm_dl'],
    abs:             ['hanging_leg_raise', 'l_sit', 'dead_bug'],
    brace:           ['plank', 'side_plank', 'dead_bug', 'pallof_press']
  };
  var FAMILY_IDS = {};
  Object.keys(FAMILIES).forEach(function (k) { FAMILIES[k].forEach(function (id) { FAMILY_IDS[id] = true; }); });
  // At home only what needs no gym: a plan counts as home when its id or name says so.
  var HOME_KIT = ['bodyweight', 'bench', 'wall', 'doorway', 'dip bars'];
  var PICKS = 'body_picks_v1';
  var DAY = 86400000;

  function today() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim(); }
  function libOf(state) { return (state && Array.isArray(state.library)) ? state.library : []; }
  // Body Temple merges its default library in memory; the stored copy the Portal reads can be older and lack some.
  // So the family movements carry their name and kit here too. The stored library wins where it has the movement.
  var KNOWN = {
    weighted_pullup: ['Weighted pull-up', ['pull-up bar', 'dip belt']], pullup: ['Pull-up', ['pull-up bar']], lat_pulldown: ['Lat pulldown', ['cable machine']],
    lat_pulldown_close: ['Lat pulldown — close grip', ['cable machine']], barbell_row: ['Barbell row', ['barbell']], cable_row: ['Cable row', ['cable machine']],
    db_row: ['Single-arm DB row', ['dumbbell', 'bench']], kb_renegade_row: ['Kettlebell renegade row', ['kettlebell × 2']], inverted_row: ['Inverted row', ['bodyweight']],
    rear_delt_fly: ['Rear-delt fly', ['dumbbells']], face_pull: ['Face pull', ['cable machine', 'rope']], hammer_curl: ['Hammer curl', ['dumbbells']],
    incline_db_curl: ['Incline DB curl', ['dumbbells', 'bench']], overhead_press: ['Overhead press', ['barbell']], db_shoulder_press: ['DB shoulder press', ['dumbbells', 'bench']],
    push_press: ['Push press', ['barbell', 'rack']], kb_strict_press: ['Kettlebell strict press', ['kettlebell']], kb_bottoms_up_press: ['Kettlebell bottoms-up press', ['kettlebell']],
    incline_db_press: ['Incline DB press', ['dumbbells', 'bench']], flat_db_press: ['Flat DB press', ['dumbbells', 'bench']], bench_press: ['Barbell bench press', ['barbell', 'bench']],
    pushup: ['Push-up', ['bodyweight']], dips: ['Dips', ['dip bars']], tricep_pushdown: ['Tricep pushdown', ['cable machine']],
    overhead_tricep_extension: ['Overhead tricep extension', ['dumbbell']], back_squat: ['Back squat', ['barbell', 'rack']], front_squat: ['Front squat', ['barbell', 'rack']],
    kb_front_squat: ['Kettlebell front squat', ['kettlebell']], goblet_squat: ['Goblet squat', ['dumbbell']], leg_press: ['Leg press', ['leg press machine']],
    bulgarian_split_squat: ['Bulgarian split squat', ['dumbbells', 'bench']], walking_lunge: ['Walking lunge', ['bodyweight', 'dumbbells']], pistol_squat: ['Pistol squat', ['bodyweight']],
    romanian_deadlift: ['Romanian deadlift', ['barbell']], conventional_deadlift: ['Conventional deadlift', ['barbell']], trap_bar_deadlift: ['Trap bar deadlift', ['trap bar']],
    kb_single_arm_dl: ['Kettlebell single-arm deadlift', ['kettlebell']], hanging_leg_raise: ['Hanging leg raise', ['pull-up bar']], l_sit: ['L-sit', ['parallettes', 'bench']],
    dead_bug: ['Dead bug', ['bodyweight']], plank: ['Plank', ['bodyweight']], side_plank: ['Side plank', ['bodyweight']], pallof_press: ['Pallof press', ['cable machine', 'band']]
  };
  function libById(state, id) {
    var L = libOf(state); for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i];
    return KNOWN[id] ? { id: id, name: KNOWN[id][0], equipment: KNOWN[id][1] } : null;
  }

  // The library id a logged exercise stands for: its libraryId, or (older entries) its name.
  function idOfLogged(state, e) {
    if (!e) return null;
    if (e.libraryId) return e.libraryId;
    var n = norm(e.name); if (!n) return null;
    var L = libOf(state);
    for (var i = 0; i < L.length; i++) if (norm(L[i].name) === n) return L[i].id;
    return null;
  }
  function sessionsBefore(state, date) {
    return ((state && state.sessions) || []).filter(function (s) { return s && s.date && s.date < date && Array.isArray(s.exercises) && s.exercises.length; });
  }

  // { libraryId: last date it was done } from every session before `date`. A movement left unticked doesn't count.
  function lastDoneMap(state, date) {
    var out = {};
    sessionsBefore(state, date || today()).forEach(function (s) {
      var anyTick = s.exercises.some(function (e) { return e && e.done === true; });
      s.exercises.forEach(function (e) {
        if (anyTick && e.done !== true) return;
        var id = idOfLogged(state, e); if (!id) return;
        if (!out[id] || out[id] < s.date) out[id] = s.date;
      });
    });
    return out;
  }

  // ── what was lifted ──
  // The load of a logged movement, in kg: the + / − pill's number, or (older entries) a weight typed in the note,
  // the same two places Body Temple's getWeightFor reads. bw: a bodyweight movement, where the load is what was added on top.
  function loadOf(e) {
    if (!e) return null;
    if (typeof e.weight === 'number' && e.weight > 0) return e.weight;
    var t = String(e.notes || ''), m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilo)/i);
    if (m) return parseFloat(m[1].replace(',', '.'));
    m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:lbs?|pound)/i);
    if (m) return Math.round(parseFloat(m[1].replace(',', '.')) * 0.453592 * 2) / 2;
    return null;
  }
  // A movement's record across every session up to and including `date`, found by its library id (so a plan's
  // "Barbell row (Pendlay)" and the library's "Barbell row" are one history). Deload sessions are passed over for loads,
  // as Body Temple's "last time" does. Returns null if never logged, else
  //   { last: { date, kg, bw, sets, reps }, prev: { date, kg } | null, best: { date, kg } | null }
  function history(state, libraryId, date) {
    if (!libraryId) return null;
    var upto = date || today(), rows = [];
    ((state && state.sessions) || []).forEach(function (s) {
      if (!s || !s.date || s.date > upto || !Array.isArray(s.exercises) || s.deload) return;
      var anyTick = s.exercises.some(function (e) { return e && e.done === true; });
      s.exercises.forEach(function (e) {
        if (anyTick && e.done !== true) return;
        if (idOfLogged(state, e) !== libraryId) return;
        rows.push({ date: s.date, kg: loadOf(e), bw: e.bw === true, sets: e.sets || null, reps: e.reps || null });
      });
    });
    if (!rows.length) return null;
    rows.sort(function (a, b) { return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0); });   // newest first
    var last = rows[0], prev = null, best = null;
    for (var i = 1; i < rows.length; i++) if (rows[i].kg && rows[i].bw === last.bw) { prev = rows[i]; break; }
    rows.forEach(function (r) { if (r.kg && r.bw === last.bw && (!best || r.kg > best.kg)) best = r; });
    return { last: last, prev: prev, best: best };
  }
  function kg(n) { var r = Math.round(n * 10) / 10; return (r % 1 === 0 ? r.toFixed(0) : r.toFixed(1)) + ' kg'; }
  // One line, as Lek reads it: "60 kg · 4×6 · up from 57.5 · top set 62.5 kg". Empty when nothing was logged.
  function loadLine(h) {
    if (!h) return '';
    var L = h.last, out = [];
    if (L.kg) out.push(L.bw ? 'bodyweight + ' + kg(L.kg) : kg(L.kg));
    else if (L.bw) out.push('bodyweight');
    if (L.reps && /,/.test(L.reps)) out.push(L.reps);                 // per set, as typed: 5,5,4
    else if (L.sets && L.reps) out.push(L.sets + '×' + L.reps); else if (L.reps) out.push(L.reps + ' reps');
    if (L.kg && h.prev && h.prev.kg) {
      if (L.kg > h.prev.kg + 0.01) out.push('up from ' + kg(h.prev.kg).replace(' kg', ''));
      else if (L.kg < h.prev.kg - 0.01) out.push('down from ' + kg(h.prev.kg).replace(' kg', ''));
    }
    if (L.kg && h.best && h.best.kg > L.kg + 0.01) out.push('top set ' + kg(h.best.kg));
    return out.join(' · ');
  }
  // The last session of this plan: which ids were in it (ticked or not), and which slot held which id.
  function lastOfPlan(state, planId, date) {
    var best = null;
    sessionsBefore(state, date || today()).forEach(function (s) { if (s.planId === planId && (!best || s.date > best.date)) best = s; });
    var ids = {}, slots = {}, hasSlots = false;
    if (best) best.exercises.forEach(function (e) {
      var id = idOfLogged(state, e); if (!id) return;
      ids[id] = true;
      if (e.slot) { slots[e.slot] = id; hasSlots = true; }
    });
    return { ids: ids, slots: slots, hasSlots: hasSlots };
  }

  function isHomePlan(plan) { return /^home/.test(plan.id || '') || /\bhome\b/i.test(plan.name || ''); }
  function homeOk(entry) {
    var eq = (entry && entry.equipment) || [];
    return !eq.length || eq.indexOf('bodyweight') >= 0 || eq.every(function (q) { return HOME_KIT.indexOf(q) >= 0; });
  }
  // The family a slot draws from: of the families that hold its movement, the one with most usable members.
  function familyFor(state, baseId, home) {
    var best = null;
    Object.keys(FAMILIES).forEach(function (k) {
      if (FAMILIES[k].indexOf(baseId) < 0) return;
      var usable = FAMILIES[k].filter(function (id) { var e = libById(state, id); return e && (id === baseId || !home || homeOk(e)); });
      if (!best || usable.length > best.ids.length) best = { name: k, ids: usable };
    });
    return best;
  }

  function readSwaps(date) {
    try { var o = JSON.parse(localStorage.getItem(PICKS) || 'null'); return o && o.date === (date || today()) && o.plans ? o.plans : {}; }
    catch (e) { return {}; }
  }
  function saveSwap(planId, slotId, libId, date) {
    var plans = readSwaps(date);
    plans[planId] = plans[planId] || {};
    if (libId) plans[planId][slotId] = libId; else delete plans[planId][slotId];
    try { localStorage.setItem(PICKS, JSON.stringify({ date: date || today(), plans: plans })); } catch (e) {}
  }

  // Today's movements for a plan: [{ slot, libraryId, name, rotated, anchor, family, lastDone, options }]
  // `options` is the slot's ranked list (what ↻ cycles through).
  function pick(state, plan, opts) {
    opts = opts || {};
    var date = opts.date || today();
    if (!plan || !Array.isArray(plan.exercises)) return [];
    var done = lastDoneMap(state, date), last = lastOfPlan(state, plan.id, date);
    var swaps = opts.swaps || readSwaps(date)[plan.id] || {};
    var home = isHomePlan(plan), taken = {};
    var fams = plan.exercises.map(function (ex) { return ex.libraryId ? familyFor(state, ex.libraryId, home) : null; });
    // first pass: the anchors keep their own movement, so no rotating slot can take it from them
    plan.exercises.forEach(function (ex, i) { if (ex.libraryId && (!fams[i] || fams[i].ids.length < 2)) taken[ex.libraryId] = true; });
    return plan.exercises.map(function (ex, i) {
      var base = ex.libraryId || null, fam = fams[i];
      var out = { slot: ex, libraryId: base, name: ex.name, rotated: false, anchor: true, family: fam ? fam.name : null, lastDone: base ? (done[base] || null) : null, options: base ? [base] : [] };
      if (!fam || fam.ids.length < 2) return out;
      var free = fam.ids.filter(function (id) { return !taken[id]; });
      if (!free.length) free = [base];                                   // siblings took the whole family: keep the plan's own
      var rank = function (list) {
        return list.slice().sort(function (a, b) {
          var da = done[a] || '', db = done[b] || '';
          if (da !== db) return da < db ? -1 : 1;                       // longest ago (or never) first
          if (a === base || b === base) return a === base ? -1 : 1;     // then the plan's own
          return fam.ids.indexOf(a) - fam.ids.indexOf(b);               // then the family's order
        });
      };
      var banned = function (id) { return last.hasSlots ? last.slots[ex.id] === id : !!last.ids[id]; };
      var ok = free.filter(function (id) { return !banned(id); });
      if (!ok.length) ok = free;                                         // the family has nothing else: repeat rather than leave it empty
      var ranked = rank(ok.filter(function (id) { return !last.ids[id]; }))
        .concat(rank(ok.filter(function (id) { return last.ids[id]; })))
        .concat(rank(free.filter(function (id) { return ok.indexOf(id) < 0; })));
      var chosen = (swaps[ex.id] && ranked.indexOf(swaps[ex.id]) >= 0) ? swaps[ex.id] : ranked[0];
      taken[chosen] = true;
      var entry = libById(state, chosen);
      out.libraryId = chosen;
      out.name = chosen === base ? ex.name : (entry ? entry.name : ex.name);
      out.rotated = chosen !== base;
      out.anchor = false;
      out.lastDone = done[chosen] || null;
      out.options = ranked;
      return out;
    });
  }

  // Strength movements from the families that haven't been done for the longest: [{ libraryId, name, lastDone }]
  // Only once there is any history, and only movements the library actually holds.
  function overdue(state, opts) {
    opts = opts || {};
    var date = opts.date || today(), done = lastDoneMap(state, date);
    if (!Object.keys(done).length) return [];
    var skip = opts.exclude || {}, seen = {}, out = [];
    // only what the scheduled plans can bring in: their own movements and every option their slots rotate through
    var sched = (state && state.schedule) || {}, planIds = {};
    Object.keys(sched).forEach(function (d) { if (sched[d]) planIds[sched[d]] = true; });
    ((state && state.plans) || []).forEach(function (plan) {
      if (!planIds[plan.id]) return;
      pick(state, plan, { date: date, swaps: {} }).forEach(function (p) {
        p.options.concat(p.libraryId ? [p.libraryId] : []).forEach(function (id) {
          if (seen[id] || skip[id] || !FAMILY_IDS[id]) return; seen[id] = true;
          var e = libById(state, id); if (!e) return;
          out.push({ libraryId: id, name: e.name, lastDone: done[id] || null });
        });
      });
    });
    var minDays = typeof opts.minDays === 'number' ? opts.minDays : 14;
    out = out.filter(function (o) { return !o.lastDone || daysSince(o.lastDone, date) >= minDays; });
    out.sort(function (a, b) {
      if (!!a.lastDone !== !!b.lastDone) return a.lastDone ? 1 : -1;   // never done first
      return (a.lastDone || '') < (b.lastDone || '') ? -1 : (a.lastDone === b.lastDone ? 0 : 1);
    });
    return out.slice(0, opts.max || 5);
  }

  function daysSince(iso, date) {
    var a = new Date(iso + 'T12:00:00').getTime(), b = new Date((date || today()) + 'T12:00:00').getTime();
    return Math.round((b - a) / DAY);
  }
  // When it was last done, as a date and never as a count: the Body Temple counts no days (step 10's rule).
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function ago(iso, date) {
    if (!iso) return 'not yet';
    var d = daysSince(iso, date);
    if (d <= 0) return 'today';
    if (d === 1) return 'yesterday';
    var t = new Date(iso + 'T12:00:00'), n = new Date((date || today()) + 'T12:00:00');
    return t.getDate() + ' ' + MONTHS[t.getMonth()] + (t.getFullYear() !== n.getFullYear() ? ' ' + t.getFullYear() : '');
  }

  root.TrainGen = { FAMILIES: FAMILIES, pick: pick, overdue: overdue, lastDoneMap: lastDoneMap, history: history, loadLine: loadLine, readSwaps: readSwaps, saveSwap: saveSwap, ago: ago, daysSince: daysSince, today: today, PICKS: PICKS };
})(typeof window !== 'undefined' ? window : globalThis);
