/*
 * むしずかん — ほぞん（IndexedDB。つかえない ときは localStorage に じどう きりかえ）
 * どちらの バックエンドでも おなじ こうぞうの レコードを あつかう。
 * レコード: { id, name, kana, fact, rarity, color, knownId, category, aiName, confidence, blob, date }
 */
const DB = (() => {
  const IDB_NAME = "mushizukan";
  const VERSION = 2;
  const OPEN_TIMEOUT = 9000;
  const LS_KEY = "mz-captures-v2";

  let backend = null; // "idb" | "ls"
  let idb = null;
  let ready = null;
  const COLS = ["mushi", "hana", "doubutsu"]; // ずかんの しゅるい
  let colId = "mushi";                       // いまの ずかん
  const recCol = (r) => (r && r.col) || "mushi";
  function setCollection(id) { colId = COLS.indexOf(id) >= 0 ? id : "mushi"; }

  // ---------- きょうつう ヘルパー ----------
  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("よみこみ しっぱい"));
      r.readAsDataURL(blob);
    });
  }
  function dataURLToBlob(d) {
    const i = d.indexOf(",");
    const head = d.slice(0, i), b64 = d.slice(i + 1);
    const mime = (head.match(/:(.*?);/) || [])[1] || "image/jpeg";
    const bin = atob(b64), len = bin.length, arr = new Uint8Array(len);
    for (let k = 0; k < len; k++) arr[k] = bin.charCodeAt(k);
    return new Blob([arr], { type: mime });
  }

  // ---------- IndexedDB ----------
  function openIDB() {
    return new Promise((resolve, reject) => {
      let settled = false;
      const fin = (fn, v) => { if (!settled) { settled = true; fn(v); } };
      const timer = setTimeout(() => fin(reject, new Error("TIMEOUT")), OPEN_TIMEOUT);
      let req;
      try { req = indexedDB.open(IDB_NAME, VERSION); }
      catch (e) { clearTimeout(timer); return fin(reject, e); }
      req.onupgradeneeded = (e) => {
        const db = e.target.result, tx = e.target.transaction;
        let s;
        if (!db.objectStoreNames.contains("captures")) {
          s = db.createObjectStore("captures", { keyPath: "id", autoIncrement: true });
          s.createIndex("name", "name", { unique: false });
        } else {
          s = tx.objectStore("captures");
          if (!s.indexNames.contains("name")) s.createIndex("name", "name", { unique: false });
          s.openCursor().onsuccess = (ev) => {
            const cur = ev.target.result; if (!cur) return;
            const rec = cur.value;
            if (rec && rec.name == null && rec.insectId != null) {
              const k = (typeof INSECTS !== "undefined") ? INSECTS.find((i) => i.id === rec.insectId) : null;
              rec.name = k ? k.name : "むし"; rec.kana = k ? k.kana : ""; rec.fact = k ? k.fact : "";
              rec.rarity = k ? k.stars : 1; rec.color = k ? k.color : "#8a9a5b"; rec.knownId = k ? k.id : null;
              cur.update(rec);
            }
            cur.continue();
          };
        }
      };
      req.onsuccess = () => {
        clearTimeout(timer);
        const db = req.result;
        db.onversionchange = () => { try { db.close(); } catch (e) {} };
        fin(resolve, db);
      };
      req.onerror = () => { clearTimeout(timer); fin(reject, req.error || new Error("IDB error")); };
      req.onblocked = () => { clearTimeout(timer); fin(reject, new Error("BLOCKED")); };
    });
  }

  function idbStore(mode) { return idb.transaction("captures", mode).objectStore("captures"); }

  async function idbAdd(rec) {
    let toStore = Object.assign({ col: colId }, rec);
    if (!toStore.col) toStore.col = colId;
    if (rec && rec.blob instanceof Blob) {
      const buf = await rec.blob.arrayBuffer();
      toStore = Object.assign({}, toStore, { img: buf, mime: rec.blob.type || "image/jpeg" });
      delete toStore.blob;
    }
    return new Promise((resolve, reject) => {
      const req = idbStore("readwrite").add(toStore);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function idbGetAll() {
    return new Promise((resolve, reject) => {
      const req = idbStore("readonly").getAll();
      req.onsuccess = () => resolve((req.result || []).map((r) => {
        if (r && !r.blob && r.img) r.blob = new Blob([r.img], { type: r.mime || "image/jpeg" });
        return r;
      }));
      req.onerror = () => reject(req.error);
    });
  }
  function idbRemove(id) {
    return new Promise((resolve, reject) => {
      const req = idbStore("readwrite").delete(id);
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    });
  }
  function idbRename(oldName, newName) {
    return new Promise((resolve, reject) => {
      const req = idbStore("readwrite").openCursor();
      req.onsuccess = (e) => {
        const cur = e.target.result; if (!cur) return resolve();
        if (cur.value.name === oldName && recCol(cur.value) === colId) { const v = cur.value; v.name = newName; cur.update(v); }
        cur.continue();
      };
      req.onerror = () => reject(req.error);
    });
  }


  // おなじ なまえの レコードに あたいを かきこむ
  function idbPatchByName(name, patch) {
    return new Promise((resolve, reject) => {
      const req = idbStore("readwrite").openCursor();
      req.onsuccess = (e) => {
        const cur = e.target.result; if (!cur) return resolve();
        if (cur.value.name === name && recCol(cur.value) === colId) cur.update(Object.assign({}, cur.value, patch));
        cur.continue();
      };
      req.onerror = () => reject(req.error);
    });
  }
  function lsPatchByName(name, patch) {
    lsWrite(lsRead().map((r) => (r.name === name && recCol(r) === colId ? Object.assign({}, r, patch) : r)));
    return Promise.resolve();
  }

  // ---------- localStorage（フォールバック）----------
  function lsRead() { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch (e) { return []; } }
  function lsWrite(arr) { localStorage.setItem(LS_KEY, JSON.stringify(arr)); }
  async function lsAdd(rec) {
    const arr = lsRead();
    const id = arr.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1;
    let imgData = rec.imgData;
    if (rec.blob instanceof Blob) imgData = await blobToDataURL(rec.blob);
    const row = Object.assign({ col: colId }, rec, { id, imgData });
    if (!row.col) row.col = colId;
    delete row.blob;
    arr.push(row);
    lsWrite(arr); // QuotaExceededError は そのまま なげる
    return id;
  }
  function lsGetAll() {
    return lsRead().map((r) => { if (!r.blob && r.imgData) r.blob = dataURLToBlob(r.imgData); return r; });
  }
  function lsRemove(id) { lsWrite(lsRead().filter((r) => r.id !== id)); return Promise.resolve(); }
  function lsRename(oldName, newName) {
    lsWrite(lsRead().map((r) => (r.name === oldName && recCol(r) === colId ? Object.assign({}, r, { name: newName }) : r)));
    return Promise.resolve();
  }

  // ---------- しょきか（バックエンドを きめる）----------
  function init() {
    if (ready) return ready;
    // まえに IDBが だめだった たんまつは、またずに すぐ localStorage
    try { if (localStorage.getItem("mz-idb-broken") === "1") { backend = "ls"; return (ready = Promise.resolve()); } } catch (e) {}
    ready = openIDB()
      .then((db) => { idb = db; backend = "idb"; try { localStorage.removeItem("mz-idb-broken"); } catch (e) {} })
      .catch((err) => {
        const m = String((err && err.message) || "");
        console.warn("IndexedDB つかえません。localStorage に きりかえます:", m);
        backend = "ls";
        /* おそいだけ（TIMEOUT）や ほかの タブが つかんで いる（BLOCKED）ときは、
           「こわれている」しるしを のこさない。のこすと つぎからも ずっと
           localStorage を みに いって、IndexedDB の データが 見えなく なる。*/
        if (m !== "TIMEOUT" && m !== "BLOCKED") {
          try { localStorage.setItem("mz-idb-broken", "1"); } catch (e) {}
        }
      });
    return ready;
  }

  /* ずかんが からっぽに 見える とき、もう いっぽうの ほぞん場所に
     データが ないか さがして、あれば そちらに きりかえる。
     （電波や たんまつの ちょうしで 一時的に IndexedDB が ひらけなかった とき、
       データは 消えて いないのに 空に 見える ことが ある。その ための 救出）*/
  async function rescue() {
    await init();
    try {
      const lsN = lsRead().length;
      let idbN = 0;
      if (!idb) { try { idb = await openIDB(); } catch (e) { idb = null; } }
      if (idb) { try { idbN = (await idbGetAll()).length; } catch (e) { idbN = 0; } }
      // データが おおい ほうを つかう
      const want = idbN > lsN ? "idb" : (lsN > 0 ? "ls" : backend);
      if (want !== backend) {
        backend = want;
        if (want === "idb") { try { localStorage.removeItem("mz-idb-broken"); } catch (e) {} }
        return true;
      }
    } catch (e) {}
    return false;
  }
  // せってい がめん用：どこに なんこ あるか
  async function counts() {
    await init();
    let idbN = -1;
    if (!idb) { try { idb = await openIDB(); } catch (e) { idb = null; } }
    if (idb) { try { idbN = (await idbGetAll()).length; } catch (e) { idbN = -1; } }
    return { backend, ls: lsRead().length, idb: idbN };
  }

  // ---------- こうかい API ----------
  async function add(rec) { await init(); return backend === "idb" ? idbAdd(rec) : lsAdd(rec); }
  async function getAllRaw() { await init(); return backend === "idb" ? idbGetAll() : lsGetAll(); }
  async function getAll() { return (await getAllRaw()).filter((r) => recCol(r) === colId); }
  async function remove(id) { await init(); return backend === "idb" ? idbRemove(id) : lsRemove(id); }
  async function renameGroup(o, n) { await init(); return backend === "idb" ? idbRename(o, n) : lsRename(o, n); }
  async function patchByName(name, patch) { await init(); return backend === "idb" ? idbPatchByName(name, patch) : lsPatchByName(name, patch); }

  function reset() {
    // りょうほう けす
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
    try { localStorage.removeItem("mz-idb-broken"); } catch (e) {}
    backend = null; idb = null; ready = null;
    return new Promise((resolve) => {
      let done = false; const fin = () => { if (!done) { done = true; resolve(); } };
      try {
        const r = indexedDB.deleteDatabase(IDB_NAME);
        r.onsuccess = fin; r.onerror = fin; r.onblocked = fin;
      } catch (e) { fin(); }
      setTimeout(fin, 3000);
    });
  }

  async function mode() { await init(); return backend; }

  return { add, getAll, getAllRaw, remove, renameGroup, patchByName, reset, mode, setCollection, rescue, counts };
})();
