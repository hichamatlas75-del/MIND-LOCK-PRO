/* Service Worker – précache + cache-first, fonctionnement hors ligne.
 * IMPORTANT : incrémenter CACHE (= version de package.json) à chaque déploiement, sinon les joueurs
 * gardent l'ancienne version. Un test (tests/pwa.test.js) vérifie cette cohérence et la liste des fichiers. */
const CACHE = 'mind-lock-pro-v0.3.1';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './src/main.js', './src/ui/styles.css',
  './src/core/config.js', './src/core/storage.js', './src/core/events.js', './src/core/settings.js',
  './src/game/engine.js', './src/game/levels.js', './src/game/progress.js', './src/game/stats.js', './src/game/session.js',
  './src/services/audio.js', './src/services/theme.js', './src/services/haptics.js',
  './src/i18n/index.js', './src/i18n/fr.js', './src/i18n/en.js', './src/i18n/ar.js',
  './src/ui/icons.js', './src/ui/components.js',
  './src/ui/screens/home.js', './src/ui/screens/levels.js', './src/ui/screens/game.js', './src/ui/screens/settings.js',
  './public/icons/icon.svg', './public/icons/icon-maskable.svg',
  './public/icons/icon-180.png', './public/icons/icon-192.png', './public/icons/icon-512.png',
  './public/icons/icon-maskable-192.png', './public/icons/icon-maskable-512.png'
];

self.addEventListener('install', e => {
  // cache:'reload' contourne le cache HTTP du navigateur : on précache bien la NOUVELLE version des fichiers.
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
