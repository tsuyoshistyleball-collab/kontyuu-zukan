/*
 * むしずかん — しゃしんの ほぞん（IndexedDB）
 * しゃしんは おおきいので localStorage ではなく IndexedDB に いれる。
 * captures ストア: { id(auto), insectId, blob, date }
 */
const DB = (() => {
  const NAME = "mushizukan";
  const VERSION = 1;
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("captures")) {
          const s = db.createObjectStore("captures", { keyPath: "id", autoIncrement: true });
          s.createIndex("insectId", "insectId", { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  async function tx(mode) {
    const db = await open();
    return db.transaction("captures", mode).objectStore("captures");
  }

  async function add(insectId, blob, date) {
    const store = await tx("readwrite");
    return new Promise((resolve, reject) => {
      const req = store.add({ insectId, blob, date });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getAll() {
    const store = await tx("readonly");
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function remove(id) {
    const store = await tx("readwrite");
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  return { add, getAll, remove };
})();
