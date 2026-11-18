/* Service Worker – cache-first, fonctionnement hors ligne */
const CACHE = 'mind-lock-pro-v0.3.0';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './src/main.js', './src/ui/styles.css',
  './src/core/config.js', './src/core/storage.js', './src/core/events.js', './src/core/settings.js',
  './src/game/engine.js', './src/game/levels.js', './src/game/progress.js', './src/game/stats.js', './src/game/session.js',
  './src/services/audio.js', './src/services/theme.js', './src/services/haptics.js',
  './src/i18n/index.js', './src/i18n/fr.js', './src/i18n/en.js', './src/i18n/ar.js',
  './src/ui/icons.js', './src/ui/components.js',
  './src/ui/screens/home.js', './src/ui/screens/levels.js', './src/ui/screens/game.js', './src/ui/screens/settings.js',
  './public/icons/icon.svg', './public/icons/icon-maskable.svg'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return res;
  }).catch(() => caches.match('./index.html'))));
});
