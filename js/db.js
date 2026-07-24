/*
 * むしずかん — しゃしんと なまえの ほぞん（IndexedDB）
 * captures ストア: { id(auto), name, kana, fact, rarity, color, knownId, aiName, confidence, blob, date }
 * v1（insectId ベース）から v2（name ベース）へ じどう いこう。
 */
const DB = (() => {
  const NAME = "mushizukan";
  const VERSION = 2;
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        const tx = e.target.transaction;
        let store;
        if (!db.objectStoreNames.contains("captures")) {
          store = db.createObjectStore("captures", { keyPath: "id", autoIncrement: true });
          store.createIndex("name", "name", { unique: false });
        } else {
          store = tx.objectStore("captures");
          if (!store.indexNames.contains("name")) store.createIndex("name", "name", { unique: false });
          // v1 → v2: insectId を なまえに おきかえ
          store.openCursor().onsuccess = (ev) => {
            const cur = ev.target.result;
            if (!cur) return;
            const rec = cur.value;
            if (rec && rec.name == null && rec.insectId != null) {
              const known = (typeof INSECTS !== "undefined")
                ? INSECTS.find((i) => i.id === rec.insectId)
                : null;
              rec.name = known ? known.name : "むし";
              rec.kana = known ? known.kana : "";
              rec.fact = known ? known.fact : "";
              rec.rarity = known ? known.stars : 1;
              rec.color = known ? known.color : GENERIC_BUG.color;
              rec.knownId = known ? known.id : null;
              cur.update(rec);
            }
            cur.continue();
          };
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("DBが ほかの タブで ひらいています"));
    });
    return dbp;
  }

  async function store(mode) {
    const db = await open();
    return db.transaction("captures", mode).objectStore("captures");
  }

  async function add(rec) {
    // がぞうは ArrayBuffer で ほぞん（Blob だと たんまつに よって しっぱいする ため）
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
      req.transaction.onabort = () => reject(req.transaction.error || new Error("hozon chuudan"));
    });
  }

  async function getAll() {
    const s = await store("readonly");
    return new Promise((resolve, reject) => {
      const req = s.getAll();
      req.onsuccess = () => {
        const rows = (req.result || []).map((r) => {
          // ArrayBuffer で ほぞんした ものは Blob に もどす
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

  // グループ（おなじ なまえ）を まとめて リネーム
  async function renameGroup(oldName, newName) {
    const s = await store("readwrite");
    return new Promise((resolve, reject) => {
      const req = s.openCursor();
      req.onsuccess = (e) => {
        const cur = e.target.result;
        if (!cur) return resolve();
        if (cur.value.name === oldName) {
          const v = cur.value;
          v.name = newName;
          cur.update(v);
        }
        cur.continue();
      };
      req.onerror = () => reject(req.error);
    });
  }

  return { add, getAll, remove, renameGroup };
})();
