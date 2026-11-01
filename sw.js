// Service worker for the whole site — the Portal, every temple, Body Temple and Lysningen.
// Lives at the apps/ root so its scope covers them all (one origin, shared stores).
//
// Pages (HTML) are network-first: online you always get the latest deploy, offline you get
// the last copy seen. Fonts, icons and manifests are cache-first.
// It never touches localStorage or IndexedDB — Lek's history lives there.
//
// Bump VERSION on every deploy that changes a file below.
const VERSION = '2026-11-01.5';
const CACHE = 'halohorns-' + VERSION;

const SHELL = [
  './', './index.html', './manifest.json', './icon.svg',
  './inner_temple.html', './beast_temple.html', './breath_temple.html', './healing_temple.html',
  './magnetic_temple.html', './hibrations.html', './strings.html', './vocal.html', './mirror.html',
  './body/', './body/index.html', './body/manifest.json', './body/icon.svg',
  './village/', './village/index.html', './village/manifest.json', './village/icon.svg',
  './tarot.html', './astrology.html', './kaching.html',
  './observatory/', './observatory/index.html', './observatory/tarot.html', './observatory/astrology.html',
  './fonts/fonts.css',
  './fonts/CormorantGaramond-italic-latin-1.woff2', './fonts/CormorantGaramond-italic-latin-ext-0.woff2',
  './fonts/CormorantGaramond-normal-latin-3.woff2', './fonts/CormorantGaramond-normal-latin-ext-2.woff2',
  './fonts/Inter-normal-latin-5.woff2', './fonts/Inter-normal-latin-ext-4.woff2',
];

self.addEventListener('install', (e) => {
  // Add one by one so a single missing file can't block the install.
  e.waitUntil(caches.open(CACHE).then((c) =>
    Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {})))
  ));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('halohorns-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

// Step 5: the village's buzz. The bridge sends Web Push; the phone shows it and the watch mirrors it.
// The text arrives already discreet (bridge/push.js). Tapping opens the village at that house.
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch {}
  e.waitUntil(self.registration.showNotification(d.title || 'Lysningen', {
    body: d.body || 'Something in the village is waiting for you.', tag: d.tag || 'lysningen', renotify: true,
    icon: './village/icon.svg', data: { house: d.house || null },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const house = e.notification.data && e.notification.data.house;
  const url = new URL('./village/' + (house ? '?house=' + encodeURIComponent(house) : ''), self.registration.scope).href;
  e.waitUntil((async () => {
    for (const c of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) {
      if (new URL(c.url).pathname.endsWith('/village/') || new URL(c.url).pathname.endsWith('/village/index.html')) { await c.focus(); c.postMessage({ type: 'open', house }); return; }
    }
    await self.clients.openWindow(url);
  })());
});

// The village's "new version, tap to reload" sends this.
self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

const isPage = (req, url) =>
  req.mode === 'navigate' || req.destination === 'document' || req.destination === 'iframe' ||
  url.pathname.endsWith('/') || url.pathname.endsWith('.html');

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  e.respondWith(isPage(req, url) ? networkFirst(req) : cacheFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await withTimeout(fetch(req, { cache: 'no-cache' }), 5000);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">' +
      '<body style="background:#0a0908;color:#9a8f80;font:16px system-ui;padding:40px 20px">Offline, and this page has not been opened before on this phone.</body>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

function withTimeout(p, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (err) => { clearTimeout(t); reject(err); });
  });
}
