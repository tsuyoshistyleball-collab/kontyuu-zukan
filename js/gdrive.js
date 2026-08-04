/*
 * むしずかん — Google ドライブに ほぞん（ログイン）
 *
 * ・Google で ログインすると、じぶんの ドライブに「むしずかん」フォルダを
 *   つくって、そこに しゃしんと きろくを おく。ドライブの がめんから
 *   じぶんで 見(み)たり けしたり できる。
 * ・つかう スコープは drive.file。この アプリが つくった ファイルだけ
 *   さわれる ので、ドライブの ほかの ファイルは 見(み)えない。
 * ・DEFAULT_CLIENT_ID を 入(い)れて おけば、つかう 人(ひと)は
 *   「Google で ログイン」を おすだけ。じぶんの IDに することも できる。
 */
const GDrive = (() => {
  /* ============================================================
     ここに この アプリの クライアントID を 入(い)れると、
     つかう 人(ひと)は「Google で ログイン」を 押(お)すだけで
     ドライブに バックアップ できる ように なります。
     （つくりかたは README の「Google ドライブ 連携」を 見(み)てね）
     ※ ウェブアプリの クライアントIDは 公開(こうかい)される もの なので、
        ここに 書(か)いて だいじょうぶ です（ひみつの かぎでは ない）。
     ============================================================ */
  const DEFAULT_CLIENT_ID = "42855051432-rvh3nq4ju8jgd1r4lcnjgf24ncgcp0t2.apps.googleusercontent.com";

  const CLIENT_KEY = "mz-gdrive-client";     // じぶんで 入れた クライアントID（あれば ゆうせん）
  const ON_KEY = "mz-gdrive-on";             // ログイン したことが あるか
  const FOLDER_KEY = "mz-gdrive-folder";     // ドライブの「むしずかん」フォルダの id
  /* drive.file＝この アプリが 作(つく)った ファイルだけ さわれる スコープ。
     ドライブ ぜんたいは 見(み)えない ので、ログインする 人(ひと)も 安心(あんしん)。*/
  const SCOPE = "https://www.googleapis.com/auth/drive.file";
  const FOLDER_NAME = "むしずかん";
  const GIS = "https://accounts.google.com/gsi/client";
  const API = "https://www.googleapis.com/drive/v3";
  const UPLOAD = "https://www.googleapis.com/upload/drive/v3";

  let token = null;          // アクセストークン
  let expires = 0;           // トークンの きげん（ms）
  let client = null;         // GIS の トークンクライアント
  let gisLoading = null;

  const get = (k) => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
  const set = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) {} };

  const clientId = () => get(CLIENT_KEY).trim() || DEFAULT_CLIENT_ID;
  const usingDefault = () => !get(CLIENT_KEY).trim() && !!DEFAULT_CLIENT_ID;
  const configured = () => !!clientId();
  const wasSignedIn = () => get(ON_KEY) === "1";
  const signedIn = () => !!token && Date.now() < expires;

  // ---- GIS（Googleの ログイン ぶひん）を よみこむ ----
  function loadGIS() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (gisLoading) return gisLoading;
    gisLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = GIS; s.async = true; s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("NO_GIS"));
      document.head.appendChild(s);
    });
    return gisLoading;
  }

  async function tokenClient() {
    if (!configured()) throw new Error("NO_CLIENT_ID");
    await loadGIS();
    if (!client) {
      client = google.accounts.oauth2.initTokenClient({
        client_id: clientId(),
        scope: SCOPE,
        callback: () => {},          // よぶ たびに いれかえる
      });
    }
    return client;
  }

  /* トークンを とる。
     interactive=false の ときは、まえに きょかして いれば がめんを ださずに とれる。*/
  async function auth(interactive) {
    if (signedIn()) return token;
    const c = await tokenClient();
    return new Promise((resolve, reject) => {
      let done = false;
      const fin = (fn, v) => { if (!done) { done = true; fn(v); } };
      c.callback = (res) => {
        if (res && res.access_token) {
          token = res.access_token;
          expires = Date.now() + (Number(res.expires_in || 3600) - 120) * 1000;
          set(ON_KEY, "1");
          fin(resolve, token);
        } else {
          fin(reject, new Error(res && res.error ? res.error : "NO_TOKEN"));
        }
      };
      c.error_callback = (err) => fin(reject, new Error((err && err.type) || "AUTH_FAILED"));
      try {
        c.requestAccessToken({ prompt: interactive ? "consent" : "" });
      } catch (e) { fin(reject, e); }
      // だんまりの ときの ほけん
      setTimeout(() => fin(reject, new Error(interactive ? "AUTH_TIMEOUT" : "NEED_SIGNIN")), interactive ? 120000 : 8000);
    });
  }

  const signIn = () => auth(true);
  async function silentSignIn() {
    if (!configured() || !wasSignedIn()) return false;
    try { await auth(false); return true; } catch (e) { return false; }
  }
  function signOut() {
    try {
      if (token && window.google && google.accounts && google.accounts.oauth2) {
        google.accounts.oauth2.revoke(token, () => {});
      }
    } catch (e) {}
    token = null; expires = 0;
    set(ON_KEY, ""); set(FOLDER_KEY, "");
  }

  // ---- ドライブの そうさ ----
  async function req(url, opts) {
    await auth(false).catch(() => { throw new Error("NEED_SIGNIN"); });
    const o = Object.assign({}, opts);
    o.headers = Object.assign({ Authorization: "Bearer " + token }, o.headers || {});
    const r = await fetch(url, o);
    if (r.status === 401 || r.status === 403) { token = null; expires = 0; throw new Error("NEED_SIGNIN"); }
    if (!r.ok) {
      let m = "HTTP " + r.status;
      try { const j = await r.json(); if (j.error && j.error.message) m = j.error.message; } catch (e) {}
      throw new Error(m);
    }
    return r;
  }

  /* ドライブの 中(なか)の「むしずかん」フォルダを さがす。なければ 作(つく)る。
     drive.file スコープでは、この アプリが 作(つく)った ものだけ 見(み)える ので、
     ここで 見(み)つかる フォルダは かならず この アプリの もの。*/
  async function folderId() {
    const saved = get(FOLDER_KEY);
    if (saved) {
      // ごみばこに 入(い)れられて いないか だけ たしかめる
      try {
        const j = await (await req(`${API}/files/${saved}?fields=id,trashed`)).json();
        if (j && j.id && !j.trashed) return saved;
      } catch (e) {}
      set(FOLDER_KEY, "");
    }
    const q = encodeURIComponent(
      `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const found = await (await req(`${API}/files?q=${q}&fields=files(id)&pageSize=1`)).json();
    if (found.files && found.files[0]) { set(FOLDER_KEY, found.files[0].id); return found.files[0].id; }
    const r = await req(`${API}/files?fields=id`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
    });
    const id = (await r.json()).id;
    set(FOLDER_KEY, id);
    return id;
  }

  // 「むしずかん」フォルダの ファイル いちらん（なまえ → {id, size}）
  async function list() {
    const fid = await folderId();
    const out = new Map();
    let pageToken = "";
    do {
      const q = encodeURIComponent(`'${fid}' in parents and trashed=false`);
      const u = `${API}/files?q=${q}&pageSize=1000&fields=nextPageToken,files(id,name,size,modifiedTime)` +
                (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : "");
      const j = await (await req(u)).json();
      for (const f of j.files || []) out.set(f.name, { id: f.id, size: +(f.size || 0), modified: f.modifiedTime });
      pageToken = j.nextPageToken || "";
    } while (pageToken);
    return out;
  }

  async function upload(name, blob, mime, existingId) {
    if (existingId) {
      await req(`${UPLOAD}/files/${existingId}?uploadType=media`, {
        method: "PATCH", headers: { "Content-Type": mime }, body: blob,
      });
      return existingId;
    }
    const b = "mzb" + Math.random().toString(16).slice(2);
    const meta = { name, parents: [await folderId()] };
    const body = new Blob([
      `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`,
      `--${b}\r\nContent-Type: ${mime}\r\n\r\n`,
      blob,
      `\r\n--${b}--\r\n`,
    ], { type: `multipart/related; boundary=${b}` });
    const r = await req(`${UPLOAD}/files?uploadType=multipart&fields=id`, { method: "POST", body });
    return (await r.json()).id;
  }

  async function download(id) { return (await req(`${API}/files/${id}?alt=media`)).blob(); }
  async function downloadJSON(id) {
    try { return JSON.parse(await (await req(`${API}/files/${id}?alt=media`)).text()); }
    catch (e) { return null; }
  }
  async function remove(id) { await req(`${API}/files/${id}`, { method: "DELETE" }); }

  return {
    get clientId() { return clientId(); },
    set clientId(v) { set(CLIENT_KEY, String(v || "").trim()); set(FOLDER_KEY, ""); client = null; token = null; expires = 0; },
    get folderName() { return FOLDER_NAME; },
    configured, usingDefault, wasSignedIn, signedIn,
    signIn, silentSignIn, signOut,
    list, upload, download, downloadJSON, remove,
  };
})();
