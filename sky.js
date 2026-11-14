// sky.js · the living sky band of the Portal remake (step 3 of portal_remake/BUILD_PLAN.md).
// A slim canvas behind a page's header: slow stars, the moon drawn from its real phase, and a horizon glow that leans
// to the temple's colour and follows the real sun (dawn gold, day pale, dusk ember, night indigo).
// It is the "where am I, when am I" anchor. It moves a few pixels a minute and never faster; under
// prefers-reduced-motion and in the night skin it is a still picture, redrawn once a minute. Hidden, covered by
// another page, or scrolled out of view it does not run at all (step 12).
// No network, no storage, no library. shell.js mounts it; a page can also call TempleSky.mount(canvas) itself.
(function () {
  'use strict';

  // Where the sun is computed for. No location is ever asked for (nothing nags): this is the middle of Denmark,
  // and a page may set window.TEMPLE_PLACE = { lat, lon } before this file loads.
  const PLACE = Object.assign({ lat: 56.0, lon: 10.5 }, window.TEMPLE_PLACE || {});
  const TINT = 0.08;          // Lek, 11-14: the sky band takes the 8% temple tint
  const FRAME_MS = 500;       // two quiet frames a second is plenty for stars that cross the band in hours

  const h2r = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const r2h = (r) => '#' + r.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const A = h2r(a), B = h2r(b); return r2h(A.map((v, i) => v + (B[i] - v) * t)); };
  const rgba = (h, a) => 'rgba(' + h2r(h).join(',') + ',' + a + ')';
  const hex = (v, d) => { v = String(v || '').trim(); return /^#[0-9a-f]{6}$/i.test(v) ? v : d; };

  // ── the moon: a mean lunar month from a known new moon. True to within a few hours. ──
  function moon(d) {
    d = d || new Date();
    const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14);
    let age = ((d - ref) / 864e5) % syn; if (age < 0) age += syn;
    const p = age / syn;
    const name = p < 0.03 || p > 0.97 ? 'New moon' : p < 0.22 ? 'Waxing crescent' : p < 0.28 ? 'First quarter' : p < 0.47 ? 'Waxing gibbous'
      : p < 0.53 ? 'Full moon' : p < 0.72 ? 'Waning gibbous' : p < 0.78 ? 'Last quarter' : 'Waning crescent';
    return { p, age, name };
  }

  // ── the sun: sunrise and sunset in local clock hours (the NOAA short form). null in a polar day or night. ──
  function sun(d, place) {
    d = d || new Date(); place = place || PLACE;
    const rad = Math.PI / 180;
    const start = new Date(d.getFullYear(), 0, 0), n = Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - start) / 864e5);
    const g = 2 * Math.PI / 365 * (n - 1 + 0.5);
    const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const c = (Math.cos(90.833 * rad) - Math.sin(place.lat * rad) * Math.sin(dec)) / (Math.cos(place.lat * rad) * Math.cos(dec));
    if (c < -1 || c > 1) return null;
    const ha = Math.acos(c) / rad, tz = -d.getTimezoneOffset();
    const noon = (720 - 4 * place.lon - eq + tz) / 60;
    return { rise: noon - ha * 4 / 60, set: noon + ha * 4 / 60, noon };
  }

  // ── the hour's light: [hour, top of the sky, glow, stars, glow strength]. The mockup's keys, hung on the real sun. ──
  const NIGHT = ['#0a0912', '#3d3c92', 1, 0.30], DAWN = ['#1a1830', '#D4A64A', 0.35, 0.52], DAY = ['#1a2134', '#9FB4D0', 0.10, 0.34],
    DUSK = ['#1c1626', '#E0702F', 0.32, 0.52], LATE = ['#0d0b17', '#4a3f9a', 0.9, 0.34];
  function keys(d) {
    const s = sun(d);
    let k = s ? [[s.rise - 2, NIGHT], [s.rise, DAWN], [s.rise + 2.5, DAY], [s.set - 2, DAY], [s.set, DUSK], [s.set + 2.2, LATE]]
      : [[5.5, NIGHT], [7.5, DAWN], [10, DAY], [14.5, DAY], [16.3, DUSK], [18.5, LATE]];
    if (s && s.set - s.rise < 4.6) k = [[s.rise - 2, NIGHT], [s.rise, DAWN], [s.noon, DAY], [s.set, DUSK], [s.set + 2.2, LATE]];   // a very short day has no flat noon
    k = k.filter(([h]) => h > 0 && h < 24);
    return [[0, NIGHT]].concat(k, [[24, NIGHT]]);
  }
  function lightAt(hour, d) {
    const K = keys(d); let i = 0;
    while (i < K.length - 2 && K[i + 1][0] <= hour) i++;
    const a = K[i], b = K[i + 1], t = Math.max(0, Math.min(1, (hour - a[0]) / ((b[0] - a[0]) || 1)));
    return { top: mix(a[1][0], b[1][0], t), glow: mix(a[1][1], b[1][1], t), stars: a[1][2] + (b[1][2] - a[1][2]) * t, str: a[1][3] + (b[1][3] - a[1][3]) * t };
  }

  // the same 64 stars every time, from a fixed seed
  const rnd = (s) => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const STARS = ((r) => Array.from({ length: 64 }, () => ({ x: r(), y: r() * 0.72, s: 0.5 + r() * 0.9, ph: r() * 6.3 })))(rnd(14));

  const mql = window.matchMedia ? window.matchMedia('(prefers-reduced-motion:reduce)') : { matches: false };
  const mounted = [];
  let timer = null;

  function draw(c, at) {
    const w = c.clientWidth, h = c.clientHeight; if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const x = c.getContext('2d'); if (!x) return;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cs = getComputedStyle(c), bg = hex(cs.getPropertyValue('--bg'), '#15131B'), main = hex(cs.getPropertyValue('--t'), '#B8C0D0');
    const now = at || c._at || new Date(), hour = now.getHours() + now.getMinutes() / 60, k = lightAt(hour, now);
    const top = mix(k.top, main, TINT), low = mix(bg, main, TINT);
    let g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, top); g.addColorStop(0.7, low); g.addColorStop(1, bg); x.fillStyle = g; x.fillRect(0, 0, w, h);
    // the horizon glow: the hour's light, leaning to the temple's colour
    const glow = mix(k.glow, main, 0.6), gy = h - 92;
    x.save(); x.translate(w / 2, gy); x.scale(1, 0.5); g = x.createRadialGradient(0, 0, 0, 0, 0, w * 0.78);
    g.addColorStop(0, rgba(glow, k.str)); g.addColorStop(0.55, rgba(glow, k.str * 0.3)); g.addColorStop(1, rgba(glow, 0)); x.fillStyle = g; x.fillRect(-w, -w, 2 * w, 2 * w); x.restore();
    const sec = still() ? 0 : performance.now() / 1000;
    for (const s of STARS) {
      const sx = (s.x * w + sec * 0.035) % w, a = k.stars * (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(sec / 3.2 + s.ph))) * (1 - s.y * 0.6);
      x.fillStyle = 'rgba(236,230,216,' + a.toFixed(3) + ')'; x.beginPath(); x.arc(sx, 8 + s.y * h, s.s, 0, 6.3); x.fill();
    }
    // the moon, drawn from its real phase
    const m = moon(now), R = +c.dataset.moonR || 12, mx = w - (+c.dataset.moonX || 40), my = +c.dataset.moonY || Math.min(142, h - 60), kk = Math.cos(2 * Math.PI * m.p);
    x.save(); x.translate(mx, my);
    g = x.createRadialGradient(0, 0, R * 0.6, 0, 0, R * 3.2); g.addColorStop(0, 'rgba(236,230,216,.16)'); g.addColorStop(1, 'rgba(236,230,216,0)'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, R * 3.2, 0, 6.3); x.fill();
    x.fillStyle = mix(top, '#ECE6D8', 0.1); x.beginPath(); x.arc(0, 0, R, 0, 6.3); x.fill();
    if (m.p > 0.5) x.scale(-1, 1);
    x.fillStyle = '#EDE7D6'; x.beginPath(); x.arc(0, 0, R, -Math.PI / 2, Math.PI / 2); x.ellipse(0, 0, Math.max(R * Math.abs(kk), 0.01), R, 0, Math.PI / 2, -Math.PI / 2, kk > 0); x.closePath(); x.fill();
    x.restore();
    g = x.createLinearGradient(0, h - 64, 0, h); g.addColorStop(0, rgba(bg, 0)); g.addColorStop(1, bg); x.fillStyle = g; x.fillRect(0, h - 64, w, 64);
    c.dataset.drawn = String(Date.now());
  }

  // Still when the reader asked for less motion, and in the night skin (no animation in quiet hours; easier on the battery).
  const still = () => mql.matches || document.documentElement.hasAttribute('data-night');
  const drawAll = () => { for (const c of mounted) if (c.isConnected) draw(c); };
  // Step 12, the battery: the timer only exists while somebody can see the band. It stops (no timer at all, not an
  // idle one) when the page is hidden, when another page covers this one (<html data-covered>, set by home under its
  // overlay), and when every band is scrolled out of view. Whatever ends one of those starts it again with one draw.
  const root = document.documentElement, seen = new Map();
  const covered = () => root.hasAttribute('data-covered');
  const inView = (c) => c.isConnected && seen.get(c) !== false;
  const awake = () => !document.hidden && !covered() && mounted.some(inView);
  const stats = { draws: 0, ticks: 0 };                                  // read by the tests and by the weight check
  const stop = () => { if (timer) clearTimeout(timer); timer = null; };
  function tick() {
    timer = null;
    if (!awake()) return;                                                // asleep: nothing is scheduled until kick()
    stats.ticks++;
    for (const c of mounted) if (inView(c)) { draw(c); stats.draws++; }
    timer = setTimeout(tick, still() ? 60000 : FRAME_MS);
  }
  function kick() { stop(); tick(); }
  const io = window.IntersectionObserver ? new IntersectionObserver((es) => {
    let woke = false;
    for (const e of es) { const was = seen.get(e.target); seen.set(e.target, e.isIntersecting); if (e.isIntersecting && was === false) woke = true; }
    if (woke && !timer) kick();
  }) : null;
  function mount(canvas) {
    if (!canvas || mounted.includes(canvas)) return canvas;
    canvas.setAttribute('aria-hidden', 'true');
    mounted.push(canvas);
    draw(canvas); stats.draws++;
    if (io) io.observe(canvas);
    if (!timer && awake()) timer = setTimeout(tick, still() ? 60000 : FRAME_MS);
    return canvas;
  }
  window.addEventListener('resize', () => { if (awake()) drawAll(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else kick(); });
  if (window.MutationObserver) new MutationObserver(() => { if (covered()) stop(); else kick(); }).observe(root, { attributes: true, attributeFilter: ['data-covered'] });
  if (mql.addEventListener) mql.addEventListener('change', kick);

  window.TempleSky = { mount, redraw: kick, draw, moon, sun, lightAt, PLACE, stats, running: () => !!timer };
})();
