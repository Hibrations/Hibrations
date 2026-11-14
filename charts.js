// charts.js · the small chart kit of the Portal remake (step 3 of portal_remake/BUILD_PLAN.md). Our own SVG, no library.
//
// The rule (plan §2): a graph shows what is there. Trend, rhythm, shape. By default there is no target line, no record,
// no count, and never red, never a streak, never a gap drawn as a failure: an empty week draws as a quiet line, in
// the same hand as a full one. Lek's answer (11-14): a target, a record or a count may be switched on for one graph
// where he asks for it, so each is an option that is off unless a page passes it:
//     { target: 80 }     a thin dashed line at that value          (line, bars)
//     { record: true }   a ring on the highest point, with its value (spark, line, bars)
//     { count: true }    how many entries hold something, as a plain number (line, bars, ribbon); a string names the unit
//
// Every chart reads the tokens of temple.css, so it is in its temple's colour wherever it sits: fills use --t,
// thin lines and text use the text-safe --t-text. Each function returns an SVG string; put it inside an element with
// class="ts-chart", or call Charts.mount(el, 'line', data, opts).
//   spark · line (area on by default) · area · bars · ring · dial · radar · ribbon · wheel
(function () {
  'use strict';
  let uid = 0;
  const f = (n) => (+n).toFixed(1);
  const esc = (s) => (s == null ? '' : String(s)).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nums = (d) => (Array.isArray(d) ? d : []).map((v) => (typeof v === 'number' && isFinite(v) ? v : null));
  const there = (d) => d.filter((v) => v != null);
  const clamp = (v) => Math.max(0, Math.min(1, +v || 0));
  const svg = (w, h, label, body, extra) => `<svg viewBox="0 0 ${w} ${f(h)}" role="img"${label ? ` aria-label="${esc(label)}"` : ' aria-hidden="true"'}${extra || ''}>${body}</svg>`;
  const fmt = (v) => (Math.round(v * 10) / 10).toString();
  const quiet = (w, y) => `<path d="M6 ${f(y)}H${w - 6}" stroke="var(--leaf)" stroke-width="1"/>`;

  // points for the values that are there; a missing value is passed over, never dropped to zero
  function pts(d, w, h, px, pt, pb, also) {
    const v = there(d), all = v.concat(also == null ? [] : [also]);
    const lo = Math.min(...all), hi = Math.max(...all), r = (hi - lo) || 1, n = d.length;
    const y = (val) => (hi === lo ? (h - pb + pt) / 2 : h - pb - (val - lo) / r * (h - pt - pb));
    const p = []; d.forEach((val, i) => { if (val != null) p.push([n > 1 ? px + i * (w - 2 * px) / (n - 1) : w / 2, y(val), val]); });
    return { p, lo, hi, y };
  }
  const curve = (p) => p.reduce((s, q, i) => { if (!i) return `M${f(q[0])} ${f(q[1])}`; const a = p[i - 1], k = (q[0] - a[0]) * 0.4; return s + ` C${f(a[0] + k)} ${f(a[1])} ${f(q[0] - k)} ${f(q[1])} ${f(q[0])} ${f(q[1])}`; }, '');
  const top = (p) => p.reduce((a, q) => (a && a[2] >= q[2] ? a : q), null);
  const countText = (o, n, x, y, anchor) => (o.count ? `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}">${n}${typeof o.count === 'string' ? ' ' + esc(o.count) : ''}</text>` : '');

  function spark(d, o) {
    o = o || {}; d = nums(d); const w = o.w || 120, h = o.h || 36;
    if (!there(d).length) return svg(w, h, o.label, `<path d="M4 ${h / 2}H${w - 4}" stroke="var(--leaf)" stroke-width="1"/>`);
    const { p } = pts(d, w, h, 4, 5, 5), e = p[p.length - 1], t = top(p);
    return svg(w, h, o.label, `<path d="${curve(p)}" fill="none" stroke="var(--t-text)" stroke-width="1.5" stroke-linecap="round"/>` +
      `<circle cx="${f(e[0])}" cy="${f(e[1])}" r="2.6" fill="var(--t-text)"/>` +
      (o.record && t ? `<circle cx="${f(t[0])}" cy="${f(t[1])}" r="5" fill="none" stroke="var(--t2-text)" stroke-width="1"/>` : ''));
  }

  function line(d, o) {
    o = o || {}; d = nums(d); const w = o.w || 311, h = o.h || 132, base = h - 26, unit = o.unit || '', area = o.area !== false;
    const ends = `<text x="6" y="${h - 6}">${esc(o.from)}</text><text x="${w - 6}" y="${h - 6}" text-anchor="end">${esc(o.to)}</text>`;
    if (!there(d).length) return svg(w, h, o.label, quiet(w, base) + ends);
    const tg = typeof o.target === 'number' && isFinite(o.target) ? o.target : null;
    const id = 'tsg' + (++uid), { p, lo, hi, y } = pts(d, w, h, 6, 16, 26, tg), e = p[p.length - 1], t = top(p);
    return svg(w, h, o.label,
      `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--t)" stop-opacity=".42"/><stop offset="1" stop-color="var(--t)" stop-opacity="0"/></linearGradient></defs>` +
      quiet(w, base) +
      (area && p.length > 1 ? `<path d="${curve(p)} L${f(e[0])} ${base} L${f(p[0][0])} ${base}z" fill="url(#${id})"/>` : '') +
      (tg != null ? `<path d="M6 ${f(y(tg))}H${w - 6}" stroke="var(--t2-text)" stroke-width="1" stroke-dasharray="2 5" stroke-linecap="round"/><text x="${w - 6}" y="${f(y(tg) - 5)}" text-anchor="end">${esc(o.targetLabel || fmt(tg) + unit)}</text>` : '') +
      `<path d="${curve(p)}" fill="none" stroke="var(--t-text)" stroke-width="1.7" stroke-linecap="round"/>` +
      p.map((q, i) => { const last = i === p.length - 1; return `<circle cx="${f(q[0])}" cy="${f(q[1])}" r="${last ? 4 : 1.8}" fill="${last ? 'var(--card)' : 'var(--t-text)'}" stroke="var(--t-text)" stroke-width="${last ? 1.7 : 0}"/>`; }).join('') +
      (o.record && t ? `<circle cx="${f(t[0])}" cy="${f(t[1])}" r="7.5" fill="none" stroke="var(--t2-text)" stroke-width="1"/><text x="${f(Math.min(Math.max(t[0], 30), w - 30))}" y="${f(Math.max(t[1] - 12, 11))}" text-anchor="middle">${fmt(t[2])}${esc(unit)}</text>` : '') +
      ends + (o.range === false || o.record ? '' : `<text x="6" y="12">${lo === hi ? fmt(lo) + esc(unit) : fmt(lo) + esc(unit) + ' to ' + fmt(hi) + esc(unit)}</text>`) + countText(o, p.length, w / 2, h - 6, 'middle'));
  }
  const area = (d, o) => line(d, Object.assign({}, o, { area: true }));

  function bars(d, o) {
    o = o || {}; d = nums(d); const w = o.w || 311, h = o.h || 120, labels = o.labels || [], n = d.length || 1, bw = (w - 12) / n, base = h - 24;
    const tg = typeof o.target === 'number' && isFinite(o.target) ? o.target : null;
    const hi = Math.max(0, ...there(d), tg == null ? 0 : tg) || 1, hgt = (v) => v / hi * (base - 14);
    const best = o.record ? Math.max(0, ...there(d)) : 0;
    return svg(w, h, o.label, quiet(w, base) + d.map((v, i) => {
      const x = 6 + i * bw + bw * 0.18, bwid = bw * 0.64, bh = v > 0 ? hgt(v) : 0;
      return (v > 0 ? `<rect x="${f(x)}" y="${f(base - bh)}" width="${f(bwid)}" height="${f(bh)}" rx="${f(Math.min(4, bwid / 2))}" fill="var(--t)" opacity="${i === d.length - 1 ? 0.95 : 0.55}"/>`
        : `<path d="M${f(x)} ${base - 3}h${f(bwid)}" stroke="var(--t)" stroke-width="2" stroke-linecap="round" opacity=".55"/>`) +   // nothing that week: a quiet line, the same hand
        (best && v === best ? `<text x="${f(x + bwid / 2)}" y="${f(base - bh - 4)}" text-anchor="middle">${fmt(v)}</text>` : '') +
        `<text x="${f(x + bwid / 2)}" y="${h - 6}" text-anchor="middle">${esc(labels[i])}</text>`;
    }).join('') +
      (tg != null ? `<path d="M6 ${f(base - hgt(tg))}H${w - 6}" stroke="var(--t2-text)" stroke-width="1" stroke-dasharray="2 5" stroke-linecap="round"/>` : '') +
      countText(o, d.filter((v) => v > 0).length, 6, 12, 'start'));
  }

  // a ring: how far round something is (the day, the moon's month). A place on a circle, never a score.
  function ring(fr, o) {
    o = o || {}; fr = clamp(fr); const size = o.size || 96, stroke = o.stroke || 5, r = size / 2 - stroke - 3, c = 2 * Math.PI * r, a = fr * 2 * Math.PI - Math.PI / 2, m = size / 2;
    return svg(size, size, o.aria || o.label, `<circle cx="${m}" cy="${m}" r="${f(r)}" fill="none" stroke="var(--leaf)" stroke-width="1"/>` +
      `<circle cx="${m}" cy="${m}" r="${f(r)}" fill="none" stroke="var(--t-text)" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${f(c * fr)} ${f(c)}" transform="rotate(-90 ${m} ${m})" opacity=".85"/>` +
      `<circle cx="${f(m + r * Math.cos(a))}" cy="${f(m + r * Math.sin(a))}" r="${f(stroke * 0.9)}" fill="var(--ink)"/>` +
      (o.label ? `<text class="ts-num" x="${m}" y="${m + (o.sub ? 1 : 6)}" text-anchor="middle">${esc(o.label)}</text>` : '') + (o.sub ? `<text x="${m}" y="${m + 17}" text-anchor="middle">${esc(o.sub)}</text>` : ''),
      ` width="${size}" height="${size}" style="width:${size}px"`);
  }

  // a dial: an open arc with one mark on it, for something that sits between two ends (the moon's light, the day's arc)
  function dial(fr, o) {
    o = o || {}; fr = clamp(fr); const w = o.w || 160, sweep = (o.sweep || 220) * Math.PI / 180, R = w / 2 - 12, cx = w / 2, cy = R + 12;
    const a0 = -Math.PI / 2 - sweep / 2, pt = (k) => [cx + R * Math.cos(a0 + sweep * k), cy + R * Math.sin(a0 + sweep * k)];
    const arc = (k0, k1) => { const s = pt(k0), e = pt(k1); return `M${f(s[0])} ${f(s[1])} A${f(R)} ${f(R)} 0 ${sweep * (k1 - k0) > Math.PI ? 1 : 0} 1 ${f(e[0])} ${f(e[1])}`; };
    const end = pt(1), h = Math.max(end[1], cy) + (o.from || o.to ? 22 : 10), m = pt(fr);
    return svg(w, h, o.aria || o.label, `<path d="${arc(0, 1)}" fill="none" stroke="var(--leaf)" stroke-width="1" stroke-linecap="round"/>` +
      (fr > 0.004 ? `<path d="${arc(0, fr)}" fill="none" stroke="var(--t-text)" stroke-width="3" stroke-linecap="round" opacity=".85"/>` : '') +
      `<circle cx="${f(m[0])}" cy="${f(m[1])}" r="4.2" fill="var(--ink)"/>` +
      (o.label ? `<text class="ts-num" x="${cx}" y="${f(cy + (o.sub ? -2 : 6))}" text-anchor="middle">${esc(o.label)}</text>` : '') + (o.sub ? `<text x="${cx}" y="${f(cy + 15)}" text-anchor="middle">${esc(o.sub)}</text>` : '') +
      (o.from ? `<text x="${f(pt(0)[0])}" y="${f(h - 4)}" text-anchor="middle">${esc(o.from)}</text>` : '') + (o.to ? `<text x="${f(end[0])}" y="${f(h - 4)}" text-anchor="middle">${esc(o.to)}</text>` : ''),
      ` style="max-width:${w}px;margin:0 auto"`);
  }

  // a radar: a shape, not a mark out of anything. Values are 0..1 per axis.
  function radar(ax, v, o) {
    o = o || {}; ax = Array.isArray(ax) ? ax : []; const n = ax.length || 1, w = o.w || 311, h = o.h || 250, cx = w / 2, cy = h / 2 + 2, R = o.r || 88;
    const val = ax.map((_, i) => clamp(v && v[i]));
    const pt = (i, k) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + R * k * Math.cos(a), cy + R * k * Math.sin(a)]; };
    const poly = (k) => ax.map((_, i) => pt(i, typeof k === 'number' ? k : k[i]).map(f).join(',')).join(' ');
    return svg(w, h, o.label, [0.34, 0.67, 1].map((k) => `<polygon points="${poly(k)}" fill="none" stroke="var(--leaf)" stroke-width="1"/>`).join('') +
      ax.map((_, i) => { const p = pt(i, 1); return `<path d="M${f(cx)} ${f(cy)}L${f(p[0])} ${f(p[1])}" stroke="var(--leaf)" stroke-width="1" opacity=".6"/>`; }).join('') +
      `<polygon points="${poly(val)}" fill="var(--t)" fill-opacity=".26" stroke="var(--t-text)" stroke-width="1.6" stroke-linejoin="round"/>` +
      val.map((k, i) => { const p = pt(i, k); return `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="2.6" fill="var(--t-text)"/>`; }).join('') +
      ax.map((t, i) => { const p = pt(i, 1.2); return `<text x="${f(p[0])}" y="${f(p[1] + 4)}" text-anchor="middle">${esc(t)}</text>`; }).join(''));
  }

  // a ribbon: a row of soft cells, lit where something happened (levels 0..3). A year reads best as one row of 52.
  function ribbon(cells, o) {
    o = o || {}; cells = Array.isArray(cells) ? cells : []; const w = o.w || 311, cols = o.cols || 52, gap = o.gap == null ? 1.6 : o.gap, labels = o.labels || null;
    const cw = (w - (cols - 1) * gap) / cols, ch = cols > 30 ? 22 : Math.min(cw, 22), rows = Math.max(1, Math.ceil(cells.length / cols)), foot = labels || o.count ? 18 : 0, h = rows * (ch + gap) - gap + foot, op = [0.09, 0.34, 0.62, 0.95];
    const lit = cells.filter((l) => l > 0).length;
    return svg(w, h, o.label, cells.map((l, i) => `<rect x="${f((i % cols) * (cw + gap))}" y="${f(Math.floor(i / cols) * (ch + gap))}" width="${f(cw)}" height="${f(ch)}" rx="${f(Math.min(cw, ch) * 0.28)}" fill="var(--t)" opacity="${op[Math.max(0, Math.min(3, Math.round(+l || 0)))]}"/>`).join('') +
      (labels ? `<text x="0" y="${f(h - 2)}">${esc(labels[0])}</text><text x="${w}" y="${f(h - 2)}" text-anchor="end">${esc(labels[1])}</text>` : '') +
      (o.count ? `<text x="${w / 2}" y="${f(h - 2)}" text-anchor="middle">${lit}${typeof o.count === 'string' ? ' ' + esc(o.count) : ''}</text>` : ''));
  }

  // a wheel: a circle cut into equal houses with marks placed round it (the transit wheel, the lunar month).
  // marks: [{ at: 0..1 clockwise from the top, label, inner: true for the inner track }]
  function wheel(marks, o) {
    o = o || {}; marks = Array.isArray(marks) ? marks : []; const size = o.size || 240, seg = o.segments || 12, m = size / 2, R = m - 18, r2 = R * 0.72, r3 = R * 0.44, labels = o.labels || [];
    const pol = (k, rad) => { const a = -Math.PI / 2 + k * 2 * Math.PI; return [m + rad * Math.cos(a), m + rad * Math.sin(a)]; };
    return svg(size, size, o.label, [R, r2, r3].map((rad, i) => `<circle cx="${m}" cy="${m}" r="${f(rad)}" fill="${i === 0 ? 'var(--t)' : 'none'}" fill-opacity="${i === 0 ? 0.07 : 0}" stroke="var(--leaf)" stroke-width="1"/>`).join('') +
      Array.from({ length: seg }, (_, i) => { const a = pol(i / seg, r2), b = pol(i / seg, R), t = pol((i + 0.5) / seg, R + 11); return `<path d="M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}" stroke="var(--leaf)" stroke-width="1"/>` + (labels[i] != null ? `<text x="${f(t[0])}" y="${f(t[1] + 4)}" text-anchor="middle">${esc(labels[i])}</text>` : ''); }).join('') +
      marks.map((k) => { const at = ((+k.at || 0) % 1 + 1) % 1, rad = k.inner ? (r2 + r3) / 2 : (R + r2) / 2, p = pol(at, rad), t = pol(at, rad - 13);
        return `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${k.inner ? 2.6 : 3.4}" fill="${k.inner ? 'var(--t2-text)' : 'var(--t-text)'}"/>` + (k.label ? `<text x="${f(t[0])}" y="${f(t[1] + 4)}" text-anchor="middle">${esc(k.label)}</text>` : ''); }).join('') +
      (o.centre ? `<text class="ts-num" x="${m}" y="${m + 6}" text-anchor="middle">${esc(o.centre)}</text>` : ''),
      ` style="max-width:${size}px;margin:0 auto"`);
  }

  const kinds = { spark, line, area, bars, ring, dial, radar, ribbon, wheel };
  function mount(el, kind, a, b, c) {
    if (!el || !kinds[kind]) return null;
    el.classList.add('ts-chart');
    el.innerHTML = kinds[kind](a, b, c);
    return el;
  }
  window.Charts = Object.assign({ mount, kinds: Object.keys(kinds) }, kinds);
})();
