/* むしずかん — サービスワーカー（オフラインでも つかえる／あたらしい ばんに すぐ なる）*/
const CACHE = "mushizukan-v126";
const ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./img/arena-bg.webp",
  "./img/pick-bg.webp",
  "./img/fab-mushi.webp",
  "./img/di-book.webp",
  "./img/di-arena.webp",
  "./img/di-quiz.webp",
  "./img/di-sort.webp",
  "./img/di-settings.webp",
  "./img/hand-g.png",
  "./img/hand-c.png",
  "./img/hand-p.png",
  "./img/fav-g.png",
  "./img/fav-c.png",
  "./img/fav-p.png",
  "./img/chest.png",
  "./img/wheel.png",
  "./img/heal.png",
  "./fonts/mochiy-pop-one-jp-subset.woff2",
  "./js/data.js",
  "./js/gemini.js",
  "./js/geo.js",
  "./js/gdrive.js",
  "./js/db.js",
  "./js/app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // cache:"reload" で、ブラウザの ふるい ひかえを つかわず かならず ネットから とる
    await c.addAll(ASSETS.map((u) => new Request(u, { cache: "reload" })));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (e) => {
  if (e.data === "skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  // よその サイト（Google の ログインや API）は そのまま とおす
  if (new URL(req.url).origin !== location.origin) return;

  // ページ本体は ネット ゆうせん（あたらしい ばんごうを すぐ みせる）
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
        return res;
      } catch (err) {
        return (await caches.match(req)) || (await caches.match("./index.html"));
      }
    })());
    return;
  }

  // そのほかは キャッシュを すぐ かえしつつ、うらで あたらしいのを とっておく
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req);
    const net = fetch(req)
      .then((res) => { if (res && res.ok) c.put(req, res.clone()); return res; })
      .catch(() => null);
    return hit || (await net) || caches.match("./index.html");
  })());
});
