/* むしずかん — サービスワーカー（オフラインでも つかえる／あたらしい ばんに すぐ なる）*/
const CACHE = "mushizukan-v137";
/* ちずの タイルは バージョンを 上(あ)げても すてない（ためた ぶんが むだに ならない）*/
const TILES = "mushizukan-tiles";
const TILE_HOST = "https://tile.openstreetmap.org/";
const TILE_MAX = 400;

// ためすぎない ように、ふるい ものから すてる
let trimming = false;
async function trimTiles(c) {
  if (trimming) return;
  trimming = true;
  try {
    const keys = await c.keys();
    for (let i = 0; i < keys.length - TILE_MAX; i++) await c.delete(keys[i]);
  } catch (e) {} finally { trimming = false; }
}
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
  "./img/di-map.webp",
  "./img/japan.webp",
  "./img/menu-btn.webp",
  "./img/plate-mushi.webp",
  "./img/plate-hana.webp",
  "./img/plate-doubutsu.webp",
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
    await Promise.all(keys.filter((k) => k !== CACHE && k !== TILES).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (e) => {
  if (e.data === "skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  /* おもいでマップの ちずの タイルは べつの ひきだしに ためて おく。
     おなじ ばしょを 何度(なんど)も ひらいても とりに いかずに すむし、
     ネットが なくても まえに 見(み)た ところは 出(で)る。*/
  if (req.url.startsWith(TILE_HOST)) {
    e.respondWith((async () => {
      const c = await caches.open(TILES);
      const hit = await c.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && res.ok) { c.put(req, res.clone()); trimTiles(c); }
        return res;
      } catch (err) {
        return new Response("", { status: 504 });
      }
    })());
    return;
  }
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
