// 차 한 잔의 시간 · Time for Tea — stale-while-revalidate 캐시
const CACHE = "chahanjan-v43";
const ASSETS = [
  "./",
  "./index.html",
  "./help.html",
  "./manifest.webmanifest",
  "./icons/favicon-16.png",
  "./icons/favicon-32.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable.png",
  "./icons/apple-touch-icon.png",
  "./assets/vessels/teapot.png",
  "./assets/vessels/eastern-pot-zisha.png",
  "./assets/vessels/gaiwan-glass.png",
  "./assets/vessels/mug.png",
  "./assets/vessels/piaoyibei-glass.png",
  "./assets/tea-preview/chahe.svg",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(hit => {
      const net = fetch(e.request).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit || caches.match("./index.html"));
      return hit || net;
    })
  );
});
