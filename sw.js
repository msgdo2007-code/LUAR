const LUAR_SHELL_CACHE = 'luar-shell-v2';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(LUAR_SHELL_CACHE).then(cache => cache.addAll(['/manifest.webmanifest', '/scripts/icon-192.png', '/scripts/icon-512.png'])).catch(() => null));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('luar-shell-') && key !== LUAR_SHELL_CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});
