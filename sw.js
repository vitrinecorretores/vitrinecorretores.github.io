/* Service worker simples da Vitrine. Nunca toca em chamadas a outros domínios (Supabase etc.). */
var CACHE = "vitrine-20261028-b";
var ESTATICO = /\.(js|css|png|jpg|svg|webmanifest|woff2?)$/;

self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // Supabase, fontes etc.: direto na rede
  if (url.pathname.indexOf("/rest/") >= 0 || url.pathname.indexOf("/functions/") >= 0) return;

  // páginas HTML: rede primeiro, cache só como reserva offline
  if (req.mode === "navigate" || /\.html$/.test(url.pathname) || url.pathname.slice(-1) === "/") {
    e.respondWith(fetch(req).then(function (r) {
      if (r && r.ok) { var c = r.clone(); caches.open(CACHE).then(function (ch) { ch.put(req, c); }); }
      return r;
    }).catch(function () { return caches.match(req).then(function (m) { return m || caches.match("./"); }); }));
    return;
  }
  // estáticos versionados (?v=...): cache primeiro
  if (ESTATICO.test(url.pathname) && url.search.indexOf("v=") >= 0) {
    e.respondWith(caches.match(req).then(function (m) {
      return m || fetch(req).then(function (r) {
        if (r && r.ok) { var c = r.clone(); caches.open(CACHE).then(function (ch) { ch.put(req, c); }); }
        return r;
      });
    }));
  }
});

/* ---------- notificações no celular (Web Push) ---------- */
self.addEventListener("push", function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: "Vitrine", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Vitrine", {
    body: d.body || "", icon: "icon-192.png", badge: "icon-192.png", data: { url: d.url || "./" }
  }));
});
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (ls) {
    for (var i = 0; i < ls.length; i++) { if (ls[i].url.indexOf(self.location.origin) === 0 && "focus" in ls[i] && url === "./") return ls[i].focus(); }
    return self.clients.openWindow(url);
  }));
});
