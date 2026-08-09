self.options = {
    "domain": "3nbf4.com",
    "zoneId": 11493605
}
self.lary = ""
const LUAR_SHELL_CACHE = 'luar-shell-v1';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(LUAR_SHELL_CACHE).then(cache => cache.addAll(['/manifest.webmanifest', '/scripts/icon-192.png', '/scripts/icon-512.png'])).catch(() => null));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('luar-shell-') && key !== LUAR_SHELL_CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});
try {
  importScripts('https://3nbf4.com/act/files/service-worker.min.js?r=sw')
} catch (error) {
  console.warn('Serviço de publicidade indisponível no service worker.', error)
}
