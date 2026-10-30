const CACHE = "osunnote-shell-v3";
self.addEventListener("install", (event) => {
  const appRoot = new URL("./", self.registration.scope).href;
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([appRoot])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    }
    return response;
  }).catch(async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    if (event.request.mode === "navigate") {
      const shell = await caches.match(new URL("./", self.registration.scope).href);
      if (shell) return shell;
    }
    return Response.error();
  }));
});
