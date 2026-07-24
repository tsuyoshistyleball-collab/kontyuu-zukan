/*
 * むしずかん — しゃしんと なまえの ほぞん（IndexedDB）
 * captures: { id(auto), name, kana, fact, rarity, color, knownId, category, aiName, confidence, img(ArrayBuffer), mime, date }
 * ・がぞうは ArrayBuffer で ほぞん（どの たんまつでも かくじつ）。よみだし時に Blob へ もどす。
 * ・open は タイムアウト・onblocked・onversionchange を あつかい、ハングを ふせぐ。
 */
const DB = (() => {
  const NAME = "mushizukan";
  const VERSION = 2;
  const OPEN_TIMEOUT = 8000;
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      let settled = false;
      const finish = (fn, v) => { if (!settled) { settled = true; fn(v); } };
      const timer = setTimeout(
        () => finish(reject, new Error("TIMEOUT: データベースを ひらけませんでした")),
        OPEN_TIMEOUT
      );

      let req;
      try { req = indexedDB.open(NAME, VERSION); }
      catch (e) { clearTimeout(timer); return finish(reject, e); }

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        const tx = e.target.transaction;
        let s;
        if (!db.objectStoreNames.contains("captures")) {
          s = db.createObjectStore("captures", { keyPath: "id", autoIncrement: true });
          s.createIndex("name", "name", { unique: false });
        } else {
          s = tx.objectStore("captures");
          if (!s.indexNames.contains("name")) s.createIndex("name", "name", { unique: false });
          // v1(insectId) → v2(name)
          s.openCursor().onsuccess = (ev) => {
            const cur = ev.target.result;
            if (!cur) return;
            const rec = cur.value;
            if (rec && rec.name == null && rec.insectId != null) {
              const known = (typeof INSECTS !== "undefined") ? INSECTS.find((i) => i.id === rec.insectId) : null;
              rec.name = known ? known.name : "むし";
              rec.kana = known ? known.kana : "";
              rec.fact = known ? known.fact : "";
              rec.rarity = known ? known.stars : 1;
              rec.color = known ? known.color : (typeof GENERIC_BUG !== "undefined" ? GENERIC_BUG.color : "#8a9a5b");
              rec.knownId = known ? known.id : null;
              cur.update(rec);
            }
            cur.continue();
          };
        }
      };
      req.onsuccess = () => {
        clearTimeout(timer);
        const db = req.result;
        // ほかの タブ/PWAが アップグレードしたい ときは この せつぞくを とじる（ブロック ふせぎ）
        db.onversionchange = () => { try { db.close(); } catch (e) {} dbp = null; };
        finish(resolve, db);
      };
      req.onerror = () => { clearTimeout(timer); finish(reject, req.error); };
      req.onblocked = () => { clearTimeout(timer); finish(reject, new Error("BLOCKED: べつの がめんで ひらいています")); };
    });
    // しっぱいしたら つぎに やりなおせるように キャッシュを クリア
    dbp.catch(() => { dbp = null; });
    return dbp;
  }

  async function store(mode) {
    const db = await open();
    return db.transaction("captures", mode).objectStore("captures");
  }

  async function add(rec) {
    let toStore = rec;
    if (rec && rec.blob instanceof Blob) {
      const buf = await rec.blob.arrayBuffer();
      toStore = Object.assign({}, rec, { img: buf, mime: rec.blob.type || "image/jpeg" });
      delete toStore.blob;
    }
    const s = await store("readwrite");
    return new Promise((resolve, reject) => {
      const req = s.add(toStore);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.transaction.onabort = () => reject(req.transaction.error || new Error("ほぞんが ちゅうだん されました"));
    });
  }

  async function getAll() {
    const s = await store("readonly");
    return new Promise((resolve, reject) => {
      const req = s.getAll();
      req.onsuccess = () => {
        const rows = (req.result || []).map((r) => {
          if (r && !r.blob && r.img) r.blob = new Blob([r.img], { type: r.mime || "image/jpeg" });
          return r;
        });
        resolve(rows);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function remove(id) {
    const s = await store("readwrite");
    return new Promise((resolve, reject) => {
      const req = s.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function renameGroup(oldName, newName) {
    const s = await store("readwrite");
    return new Promise((resolve, reject) => {
      const req = s.openCursor();
      req.onsuccess = (e) => {
        const cur = e.target.result;
        if (!cur) return resolve();
        if (cur.value.name === oldName) { const v = cur.value; v.name = newName; cur.update(v); }
        cur.continue();
      };
      req.onerror = () => reject(req.error);
    });
  }

  // こまった ときの さいごの てだん：DBを けす
  function reset() {
    dbp = null;
    return new Promise((resolve, reject) => {
      let done = false;
      const fin = (ok, e) => { if (!done) { done = true; ok ? resolve() : reject(e); } };
      const r = indexedDB.deleteDatabase(NAME);
      r.onsuccess = () => fin(true);
      r.onerror = () => fin(false, r.error);
      r.onblocked = () => fin(true); // ベストエフォート
      setTimeout(() => fin(true), 4000);
    });
  }

  return { add, getAll, remove, renameGroup, reset };
})();
