// 차 한 잔의 시간 · Time for Tea — 문서 갱신 + 정적 자산 cache-first
const CACHE_VERSION = "v66";
const CACHE_PREFIX = "chahanjan-";
const SHELL_CACHE = `${CACHE_PREFIX}shell-${CACHE_VERSION}`;
const STATIC_CACHE = `${CACHE_PREFIX}static-${CACHE_VERSION}`;

// HTML과 manifest는 실행 중 network-first로 갱신한다.
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./help.html",
  "./settings.html",
  "./styles/ui.css",
  "./scripts/tags.js",
  "./scripts/preferences.js",
  "./scripts/i18n.js",
  "./scripts/locales/ko.js",
  "./scripts/locales/ko-settings.js",
  "./scripts/locales/ko-help.js",
  "./scripts/locales/zh-TW.js",
  "./scripts/locales/zh-TW-settings.js",
  "./scripts/locales/zh-TW-help.js",
  "./scripts/announcements.js",
  "./manifest.webmanifest",
];

// 용량이 큰 다구 이미지는 SW 버전이 바뀔 때 한 번만 갱신한다.
const STATIC_ASSETS = [
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

const toCanonicalUrl = path => new URL(path, self.registration.scope).href;
const SHELL_URLS = new Set(SHELL_ASSETS.map(toCanonicalUrl));
const STATIC_URLS = new Set(STATIC_ASSETS.map(toCanonicalUrl));
const INDEX_URL = toCanonicalUrl("./index.html");

function canonicalRequest(request) {
  const url = new URL(request.url);
  url.search = "";
  url.hash = "";
  return new Request(url.href, { method: "GET" });
}

function isCacheable(response) {
  return response.ok && response.type !== "opaque";
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const [shell, staticAssets] = await Promise.all([
      caches.open(SHELL_CACHE),
      caches.open(STATIC_CACHE),
    ]);

    // HTTP 캐시의 오래된 응답 대신 새 SW 버전의 파일을 확실히 가져온다.
    await Promise.all([
      shell.addAll(SHELL_ASSETS.map(url => new Request(toCanonicalUrl(url), { cache: "reload" }))),
      staticAssets.addAll(STATIC_ASSETS.map(url => new Request(toCanonicalUrl(url), { cache: "reload" }))),
    ]);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const activeCaches = new Set([SHELL_CACHE, STATIC_CACHE]);
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key.startsWith(CACHE_PREFIX) && !activeCaches.has(key))
        .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const key = canonicalRequest(request);
  const hit = await cache.match(key);
  if (hit) return hit;

  const response = await fetch(request);
  if (isCacheable(response)) await cache.put(key, response.clone()).catch(() => {});
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const key = canonicalRequest(request);

  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      await cache.put(key, response.clone()).catch(() => {});
      return response;
    }

    // 배포 장애나 일시적 서버 오류에서는 마지막 정상 문서를 유지한다.
    const cached = await cache.match(key);
    if (cached) return cached;
    return response;
  } catch {
    const cached = await cache.match(key);
    if (cached) return cached;

    // 알 수 없는 앱 내부 경로의 오프라인 탐색도 시작 화면으로 복구한다.
    if (request.mode === "navigate") {
      const fallback = await cache.match(INDEX_URL);
      if (fallback) return fallback;
    }
    return Response.error();
  }
}

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const canonicalUrl = `${url.origin}${url.pathname}`;
  if (STATIC_URLS.has(canonicalUrl)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate" || SHELL_URLS.has(canonicalUrl)) {
    event.respondWith(networkFirst(request));
  }
});
