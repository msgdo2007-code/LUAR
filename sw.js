const CACHE_NAME = "luar-shell-v41";
const APP_SHELL = ["/", "/index.html", "/styles.css", "/statistics.css", "/app.js", "/statistics.js", "/config.js", "/legal.css", "/termos.html", "/privacidade.html", "/cookies.html", "/contato.html", "/404.html", "/pesquisa/", "/pesquisa/pesquisa.css", "/pesquisa/pesquisa.js", "/luarlogo.png?v=2"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const cacheControl = response.headers.get("Cache-Control") || "";
        if (response.ok && response.type === "basic" && !/no-store|private/i.test(cacheControl)) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate") return caches.match("/index.html");
        return new Response("Recurso indisponível offline.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }),
  );
});
