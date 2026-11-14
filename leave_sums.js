// leave_sums.js · Ngoen's leave-sums arithmetic, shared by kaching.html (the sheet) and baby.html (the money strip).
// Portal remake, step 8. Source: Kaching/village/ngoen/drafts/leave_sums_sheet.md (13 Nov 2026, updated 14 Nov), which
// stands on Malee's checked rules (Baby/village/malee/drafts/leave_sums_checks.md).
//
// The one rule of this file: a number Lek has not typed is null, and null is never turned into zero. Every sum that
// needs a missing number is itself null, so the pages draw it blank ("waiting"), never as 0 kr.
//
// Store, new in step 8 and written only by kaching.html: kaching_leave_v1
//   { M, P, U, months, e1, e2, part1, part2 }   all strings, as typed. e1/e2: '' | 'full' | 'none' | 'part'.
(function () {
  'use strict';
  var KEY = 'kaching_leave_v1';
  // C on the sheet. A rule, not Lek's number: Malee checked it on 13 Nov 2026 (borger.dk, the Retsinformation rate table, Azets).
  var CAP = { kr: 5085, note: '2026 rate, a placeholder until borger.dk publishes 2027', by: 'Malee’s check, 13 Nov 2026' };

  function num(v) {
    if (typeof v === 'number') return isFinite(v) && v >= 0 ? v : null;
    if (typeof v !== 'string') return null;
    var s = v.replace(/[^\d]/g, '');
    return s ? parseInt(s, 10) : null;
  }
  function read() {
    var o = null; try { o = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  }
  // the steps of the sheet, one line each
  function compute(o) {
    o = o || {};
    var M = num(o.M), P = num(o.P), U = num(o.U), months = num(o.months), C = CAP.kr;
    var W = M == null ? null : M * 12 / 52;                                   // 1. weekly pay, before tax
    function leavePay(e, part) {                                               // 2. pay while on leave, a week
      if (W == null) return null;
      if (e === 'full') return W;
      if (e === 'none') return Math.min(W, C);
      if (e === 'part') return num(part);
      return null;                                                             // his contract's answer is not in yet
    }
    var L1 = leavePay(o.e1, o.part1), L2 = leavePay(o.e2, o.part2);
    var G1 = L1 == null ? null : Math.max(0, W - L1), G2 = L2 == null ? null : Math.max(0, W - L2);   // 3. gap a week
    var gap1 = G1 == null ? null : 2 * G1;                                     // 4. leave 1: the standard 2 weeks
    var gap2 = G2 == null || P == null ? null : P * G2;                        // 5. leave 2, paid weeks
    var gapU = U == null || W == null ? null : U * W;                          //    and unpaid weeks, only if he chose some
    var total = gap1 == null || gap2 == null ? null : gap1 + gap2 + (gapU || 0);   // 6.
    var monthly = total == null || !months ? null : total / months;            // 7.
    return { M: M, P: P, U: U, months: months, C: C, W: W, L1: L1, L2: L2, G1: G1, G2: G2, gap1: gap1, gap2: gap2, gapU: gapU, total: total, monthly: monthly };
  }
  function kr(v) { return v == null ? '' : Math.round(v).toLocaleString('da-DK') + ' kr'; }

  window.LeaveSums = { KEY: KEY, CAP: CAP, num: num, read: read, compute: compute, kr: kr };
})();
