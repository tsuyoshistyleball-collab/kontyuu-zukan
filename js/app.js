/* むしずかん — メイン（しゃしん → AIすいそく → カテゴリーわけ → ずかん） */
(() => {
  "use strict";

  const APP_VERSION = "v34";

  const $ = (s, e = document) => e.querySelector(s);
  const $$ = (s, e = document) => [...e.querySelectorAll(s)];

  // ---- じょうたい ----
  let captures = [];
  let groups = new Map();        // name -> group
  let urlCache = new Map();
  let flatOrder = [];            // ずかんを めくる じゅんばん（なまえの はいれつ）
  let pendingMode = "discovery"; // "discovery" | "append"
  let pendingAppendName = null;
  let pendingBlob = null;
  let pendingResolved = null;
  let pendingRarity = 1;      // とうろく画面で えらんだ ★の かず
  let rarityTouched = false;  // てで かえたら AIの すいそくで うわがきしない

  // ---- ずかんの きりかえ（むし / おはな）----
  const Zukan = {
    get id() {
      const v = localStorage.getItem("mz-zukan");
      return v === "hana" ? "hana" : "mushi";
    },
    set id(v) {
      const id = v === "hana" ? "hana" : "mushi";
      try { localStorage.setItem("mz-zukan", id); } catch (e) {}
      setZukanKind(id);
      DB.setCollection(id);
    },
    get meta() { return zukanMeta(this.id); },
  };

  const Settings = {
    get key() { return localStorage.getItem("mz-gemini-key") || ""; },
    set key(v) { v ? localStorage.setItem("mz-gemini-key", v) : localStorage.removeItem("mz-gemini-key"); },
    get model() {
      const m = localStorage.getItem("mz-gemini-model");
      // まえの バージョンの モデルめいが のこっていたら あたらしい ものに いれかえる
      if (!m || Gemini.OUTDATED_MODELS.indexOf(m) >= 0) {
        try { localStorage.setItem("mz-gemini-model", Gemini.DEFAULT_MODEL); } catch (e) {}
        return Gemini.DEFAULT_MODEL;
      }
      return m;
    },
    set model(v) { localStorage.setItem("mz-gemini-model", v || Gemini.DEFAULT_MODEL); },
  };

  const urlFor = (blob) => { if (!urlCache.has(blob)) urlCache.set(blob, URL.createObjectURL(blob)); return urlCache.get(blob); };
  const clampR = (n) => Math.min(3, Math.max(1, parseInt(n, 10) || 1));
  const stars = (n) => "★".repeat(clampR(n)) + "☆".repeat(3 - clampR(n));
  const fmtDate = (ms) => { const d = new Date(ms); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };
  const toDateInput = (ms) => {
    const d = new Date(ms || Date.now()); const p2 = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  };
  const fromDateInput = (v, fallback) => {
    if (!v) return fallback;
    const [y, m, d] = v.split("-").map(Number);
    if (!y || !m || !d) return fallback;
    return new Date(y, m - 1, d, 12, 0, 0).getTime();   // ひるに して じさの ずれを ふせぐ
  };
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ひょうしに する しゃしん（なまえ → その しゃしんの ひづけ）
  const Covers = {
    get all() { try { return JSON.parse(localStorage.getItem("mz-covers") || "{}"); } catch (e) { return {}; } },
    key(name) { return Zukan.id + "|" + name; },
    get(name) { return this.all[this.key(name)] || 0; },
    set(name, date) {
      const m = this.all, k = this.key(name);
      if (date) m[k] = date; else delete m[k];
      try { localStorage.setItem("mz-covers", JSON.stringify(m)); } catch (e) {}
    },
    rename(oldName, newName) {
      const m = this.all, a = this.key(oldName), b = this.key(newName);
      if (m[a] != null) { m[b] = m[a]; delete m[a]; }
      try { localStorage.setItem("mz-covers", JSON.stringify(m)); } catch (e) {}
    },
  };

  function illustFor(name) {
    const hana = Zukan.id === "hana";
    const k = hana ? matchKnownFlower(name) : matchKnown(name);
    const gen = hana ? GENERIC_FLOWER : GENERIC_BUG;
    return k
      ? { svg: k.svg, color: k.color, knownId: k.id, kana: k.kana, fact: k.fact, where: k.where, rarity: k.stars }
      : { svg: gen.svg, color: gen.color, knownId: null, kana: "", fact: "", where: "", rarity: 1 };
  }

  // ---- データ ----
  async function reload() {
    captures = await DB.getAll();
    groups = new Map();
    for (const c of captures) {
      if (!groups.has(c.name)) groups.set(c.name, { name: c.name, list: [], count: 0, firstDate: c.date, lastDate: c.date });
      const g = groups.get(c.name);
      g.list.push(c); g.count++;
      g.firstDate = Math.min(g.firstDate, c.date);
      g.lastDate = Math.max(g.lastDate, c.date);
    }
    for (const g of groups.values()) {
      g.list.sort((a, b) => a.date - b.date);
      g.latest = g.list[g.list.length - 1];
      // ひょうしの しゃしん（えらんで いなければ いちばん あたらしい もの）
      const cd = Covers.get(g.name);
      g.cover = (cd && g.list.find((c) => c.date === cd)) || g.latest;
      const rep = g.latest;
      const k = matchKnown(g.name);
      g.rarity = clampR(rep.rarity || (k ? k.stars : 1));
      g.kana = rep.kana || (k ? k.kana : "");
      g.fact = rep.fact || (k ? k.fact : "");
      // なかまわけは そのつど けいさん（ルールを なおしたら むかしの ぶんも なおる）
      g.category = categorize(g.name, rep.aiCategory || rep.category);
    }
  }

  // カテゴリーごとに まとめる（グリッドと ブックで きょうつう）
  function groupedByCategory() {
    const byCat = new Map();
    for (const g of groups.values()) {
      const cat = g.category || "other";
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat).push(g);
    }
    const out = [];
    for (const catId of categoryOrderFor()) {
      if (byCat.has(catId)) out.push({ catId, groups: byCat.get(catId).sort((a, b) => b.lastDate - a.lastDate) });
    }
    return out;
  }

  // ---- レベル（10しゅるいごとに アップ・じょうげんなし）----
  const PER_LEVEL = 10;
  const levelOf = (n) => Math.floor(n / PER_LEVEL) + 1;
  const LEVEL_TITLES_FALLBACK = [
    "みならい", "たんてい", "ハンター", "はかせ", "マスター", "キング", "レジェンド"
  ];
  const levelTitle = (lv) => {
    const t = Zukan.meta.levels || LEVEL_TITLES_FALLBACK;
    return t[Math.min(lv, t.length) - 1] + (lv > t.length ? " ⭐️" + (lv - t.length + 1) : "");
  };

  // ---- ずかんの きりかえ ----
  function applyZukanChrome() {
    const z = Zukan.meta;
    document.body.dataset.zukan = z.id;
    const le = $("#logo-emoji"); if (le) le.textContent = z.emoji;
    const lt = $("#logo-text"); if (lt) lt.textContent = z.title;
    const ps = $("#plate-sub"); if (ps) ps.textContent = z.sub;
    const fb = $("#fab-text"); if (fb) fb.textContent = z.fab;
    const bb = $("#bar-bug"); if (bb) bb.textContent = z.emoji;
    document.title = z.title;
  }
  async function switchZukan(id) {
    if (id === Zukan.id) { closeZukanSheet(); return; }
    closeZukanSheet();
    Zukan.id = id;
    applyZukanChrome();
    $("#loading").hidden = false;
    try { await reload(); } catch (e) { console.error("switch zukan:", e); }
    renderProgress(); renderGrid(); renderPlaces();
    $("#loading").hidden = true;
    sound.blip();
    miniNote(`${Zukan.meta.emoji} ${Zukan.meta.title}に きりかえたよ！`);
  }
  async function openZukanSheet() {
    const list = $("#zukan-list");
    list.innerHTML = "";
    // それぞれ なんしゅるい あつめたか かぞえる
    let counts = {};
    try {
      const rows = await DB.getAllRaw();
      for (const z of ZUKANS) {
        counts[z.id] = new Set(rows.filter((r) => (r.col || "mushi") === z.id).map((r) => r.name)).size;
      }
    } catch (e) {}
    for (const z of ZUKANS) {
      const b = document.createElement("button");
      b.className = "zukan-pick" + (z.id === Zukan.id ? " active" : "");
      b.dataset.zukan = z.id;
      b.innerHTML =
        `<span class="zp-emoji">${z.emoji}</span>` +
        `<span class="zp-body"><span class="zp-title">${escapeHtml(z.title)}</span>` +
        `<span class="zp-sub">${counts[z.id] ? counts[z.id] + "しゅるい あつめたよ" : "まだ からっぽ"}</span></span>` +
        (z.id === Zukan.id ? `<span class="zp-now">いま</span>` : "");
      b.addEventListener("click", () => switchZukan(z.id));
      list.appendChild(b);
    }
    $("#zukan-sheet").hidden = false;
  }
  function closeZukanSheet() { $("#zukan-sheet").hidden = true; }

  // ---- ヘッダー ----
  function renderProgress() {
    const n = groups.size;
    const total = captures.length;
    $("#count").textContent = n;
    $("#total").textContent = n === 0 ? "" : "しゅるい";
    $("#photo-count").textContent = total ? `📷${total}` : "";

    const lv = levelOf(n);
    const inLv = n % PER_LEVEL;
    const pct = (inLv / PER_LEVEL) * 100;
    $("#bar-fill").style.width = pct + "%";
    $("#bar-bug").style.left = `calc(${pct}% - 13px)`;
    $("#level-badge").textContent = "Lv." + lv;
    $("#level-badge").className = "level-badge lv" + Math.min(lv, 7);
    $("#level-title").textContent = levelTitle(lv);
    $("#level-next").textContent = `あと${PER_LEVEL - inLv}`;

    // はげましの ことばは さいしょだけ（ばしょを ひろく つかう）
    const msg = $("#progress-msg");
    if (n === 0) { msg.textContent = Zukan.meta.hint0; msg.hidden = false; }
    else if (n === 1) { msg.textContent = Zukan.meta.hint1; msg.hidden = false; }
    else msg.hidden = true;
    $("#api-hint").hidden = !!Settings.key;
    $("#book-open").hidden = n === 0;
    updateBackupHint();
  }

  // ============ いった ばしょ（GPS・けんさく・しゃしん）============
  const PLACE_EMOJI = ["🌳", "🏞️", "🏕️", "🌲", "🏖️", "🌊", "🏔️", "🌸", "🏡", "🏫", "🪴", "🦋"];
  const NEAR_M = 400; // これいないなら「その ばしょ」とみなす
  let placeEditingId = null;
  let placeEmoji = PLACE_EMOJI[0];
  let placeCoord = null;   // { lat, lng }
  let placeAddress = "";
  let placePhoto = null;   // dataURL
  let lastFix = null;      // さいごに とれた げんざいち

  const Places = {
    get all() {
      try { return JSON.parse(localStorage.getItem("mz-places") || "[]"); }
      catch (e) { return []; }
    },
    set all(v) {
      try { localStorage.setItem("mz-places", JSON.stringify(v)); }
      catch (e) {
        alert("ばしょを ほぞん できませんでした。\nしゃしんを へらすと なおるかも しれません。");
        throw e;
      }
    },
  };

  function renderPlaces() {
    const list = $("#places-list");
    const all = Places.all.sort((a, b) => b.last - a.last);
    $("#places-count").textContent = all.length;
    list.innerHTML = "";

    for (const p of all) {
      const card = document.createElement("button");
      card.className = "place-card";
      const bugs = bugsAtPlace(p.id).length;
      const thumb = p.photo
        ? `<img class="place-thumb" src="${p.photo}" alt="">`
        : (p.lat != null ? `<img class="place-thumb map" src="${Geo.tileUrl(p.lat, p.lng)}" alt="" loading="lazy">` : "");
      card.innerHTML =
        `<span class="place-pic">${thumb}<span class="place-emoji">${p.emoji || "🌳"}</span></span>` +
        `<span class="place-name">${escapeHtml(p.name)}</span>` +
        `<span class="place-tags">` +
          (p.visits > 1 ? `<span class="place-visits">${p.visits}かい</span>` : "") +
          (bugs ? `<span class="place-bugs">🐛${bugs}</span>` : "") +
        `</span>` +
        `<span class="place-date">${fmtDate(p.last)}</span>`;
      card.addEventListener("click", () => openPlaceModal(p.id));
      list.appendChild(card);
    }

    const add = document.createElement("button");
    add.className = "place-card place-add-card";
    add.innerHTML = `<span class="place-emoji big">🗺️</span><span class="place-name">ばしょを<br>ふやす</span>`;
    add.addEventListener("click", () => openPlaceModal(null));
    list.appendChild(add);
  }

  // その ばしょで みつけた むし
  function bugsAtPlace(placeId) {
    if (!placeId) return [];
    const seen = new Map();
    for (const c of captures) {
      if (c.placeId === placeId && !seen.has(c.name)) seen.set(c.name, c);
    }
    return [...seen.values()];
  }

  function setPlacePhoto(dataUrl) {
    placePhoto = dataUrl || null;
    const img = $("#pl-photo");
    if (placePhoto) { img.src = placePhoto; img.hidden = false; $("#pl-photo-del").hidden = false; }
    else { img.removeAttribute("src"); img.hidden = true; $("#pl-photo-del").hidden = true; }
    updatePlaceMap();
  }

  function updatePlaceMap() {
    const m = $("#pl-map");
    if (!placePhoto && placeCoord) {
      m.innerHTML = `<img src="${Geo.tileUrl(placeCoord.lat, placeCoord.lng)}" alt="ちず" loading="lazy">` +
                    `<span class="pl-map-pin">📍</span>`;
      m.hidden = false;
    } else { m.innerHTML = ""; m.hidden = true; }
  }

  function openPlaceModal(id) {
    const p = id ? Places.all.find((x) => x.id === id) : null;
    placeEditingId = p ? p.id : null;
    placeEmoji = p ? (p.emoji || PLACE_EMOJI[0]) : PLACE_EMOJI[0];
    placeCoord = p && p.lat != null ? { lat: p.lat, lng: p.lng } : null;
    placeAddress = p ? (p.address || "") : "";

    $("#pl-title").textContent = p ? "🗺️ ばしょ" : "🗺️ ばしょを とうろく";
    $("#pl-name").value = p ? p.name : "";
    $("#pl-note").value = p ? (p.note || "") : "";
    $("#pl-search").value = "";
    $("#pl-results").innerHTML = "";
    $("#pl-search-msg").textContent = "";
    $("#pl-address").textContent = placeAddress ? "📍 " + placeAddress : "";
    $("#pl-date").value = toDateInput(p ? p.last : Date.now());
    $("#pl-first-wrap").hidden = !p;
    $("#pl-date-label").textContent = p ? "📅 さいきん いった ひ" : "📅 いった ひ";
    if (p) $("#pl-first").value = toDateInput(p.first || p.last);
    $("#pl-meta").textContent = p
      ? `はじめて：${fmtDate(p.first)} ・ いった かず：${p.visits}かい`
      : "";
    $("#pl-visit").hidden = !p;
    $("#pl-delete").hidden = !p;
    setPlacePhoto(p ? p.photo : null);

    // ここで みつけた むし
    const bugs = p ? bugsAtPlace(p.id) : [];
    $("#pl-bugs-wrap").hidden = bugs.length === 0;
    const bw = $("#pl-bugs");
    bw.innerHTML = "";
    for (const c of bugs) {
      const cell = document.createElement("button");
      cell.className = "pl-bug";
      cell.innerHTML = `<img src="${urlFor(c.blob)}" alt=""><span>${escapeHtml(c.name)}</span>`;
      cell.addEventListener("click", () => { $("#place-modal").close(); openBook(c.name); });
      bw.appendChild(cell);
    }

    // アイコン えらび
    const row = $("#pl-emoji");
    row.innerHTML = "";
    for (const e of PLACE_EMOJI) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pl-emoji" + (e === placeEmoji ? " active" : "");
      b.textContent = e;
      b.addEventListener("click", () => {
        placeEmoji = e;
        $$("#pl-emoji .pl-emoji").forEach((x) => x.classList.toggle("active", x.textContent === e));
      });
      row.appendChild(b);
    }

    $("#place-modal").showModal();
    // じどうで キーボードを ださない（なまえの らんを タップ したら ひらく）
  }

  // 📍 いまいる ばしょ
  async function useCurrentPlace() {
    const msg = $("#pl-search-msg");
    msg.className = "pl-search-msg";
    msg.textContent = "📍 いまの ばしょを しらべているよ…";
    try {
      const fix = await Geo.current();
      lastFix = fix;
      placeCoord = { lat: fix.lat, lng: fix.lng };
      updatePlaceMap();
      try {
        const r = await Geo.reverse(fix.lat, fix.lng);
        placeAddress = r.address;
        $("#pl-address").textContent = "📍 " + r.address;
        if (!$("#pl-name").value.trim()) $("#pl-name").value = r.name.slice(0, 20);
        msg.textContent = "✓ いまの ばしょが わかったよ！";
      } catch (e) {
        $("#pl-address").textContent = `📍 ${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}`;
        msg.textContent = "✓ いちを きろく したよ（なまえは てで いれてね）";
      }
      msg.className = "pl-search-msg ok";
    } catch (err) {
      msg.textContent = "✕ " + (err.message || "いちが わかりませんでした");
      msg.className = "pl-search-msg warn";
    }
  }

  // 🔎 ばしょを さがす
  async function searchPlace() {
    const q = $("#pl-search").value.trim();
    const msg = $("#pl-search-msg");
    const box = $("#pl-results");
    if (!q) { msg.textContent = "さがす ことばを いれてね"; msg.className = "pl-search-msg warn"; return; }
    msg.textContent = "さがしているよ…"; msg.className = "pl-search-msg"; box.innerHTML = "";
    try {
      const rows = await Geo.search(q);
      if (!rows.length) { msg.textContent = "みつかりませんでした"; msg.className = "pl-search-msg warn"; return; }
      msg.textContent = "タップして えらんでね";
      for (const r of rows) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "pl-result";
        b.innerHTML = `<b>${escapeHtml(r.name)}</b><span>${escapeHtml(r.address)}</span>`;
        b.addEventListener("click", () => {
          placeCoord = { lat: r.lat, lng: r.lng };
          placeAddress = r.address;
          $("#pl-name").value = r.name.slice(0, 20);
          $("#pl-address").textContent = "📍 " + r.address;
          box.innerHTML = "";
          msg.textContent = "✓ ばしょを えらんだよ！"; msg.className = "pl-search-msg ok";
          updatePlaceMap();
        });
        box.appendChild(b);
      }
    } catch (err) {
      msg.textContent = "✕ " + (err.message || "けんさく できませんでした");
      msg.className = "pl-search-msg warn";
    }
  }

  async function onPlacePhoto(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const blob = await resizeImage(file, 640, 0.72);
      const reader = new FileReader();
      reader.onload = () => setPlacePhoto(String(reader.result));
      reader.readAsDataURL(blob);
    } catch (err) { alert("しゃしんを よみこめなかったよ。"); }
  }

  function savePlace() {
    const name = $("#pl-name").value.trim();
    if (!name) { alert("ばしょの なまえを いれてね"); $("#pl-name").focus(); return; }
    const note = $("#pl-note").value.trim();
    const all = Places.all;
    const now = Date.now();
    const when = fromDateInput($("#pl-date").value, now);
    if (placeEditingId) {
      const p = all.find((x) => x.id === placeEditingId);
      if (p) {
        p.name = name; p.note = note; p.emoji = placeEmoji; p.photo = placePhoto || null;
        if (placeCoord) { p.lat = placeCoord.lat; p.lng = placeCoord.lng; }
        if (placeAddress) p.address = placeAddress;
        const firstIn = fromDateInput($("#pl-first").value, p.first || when);
        p.first = Math.min(firstIn, when);
        p.last = Math.max(firstIn, when);
      }
    } else {
      all.push({
        id: "p" + now, name, note, emoji: placeEmoji,
        lat: placeCoord ? placeCoord.lat : null, lng: placeCoord ? placeCoord.lng : null,
        address: placeAddress || "", photo: placePhoto || null,
        first: when, last: when, visits: 1,
      });
    }
    try { Places.all = all; } catch (e) { return; }
    $("#place-modal").close();
    renderPlaces();
    if (!placeEditingId) { sound.blip(); confetti(1); }
  }

  function visitAgain() {
    const all = Places.all;
    const p = all.find((x) => x.id === placeEditingId);
    if (!p) return;
    const when = fromDateInput($("#pl-date").value, Date.now());
    p.visits = (p.visits || 1) + 1;
    p.last = Math.max(p.last || when, when);
    p.first = Math.min(p.first || when, when);
    try { Places.all = all; } catch (e) { return; }
    $("#place-modal").close();
    renderPlaces();
    sound.blip(); confetti(1);
  }

  function deletePlace() {
    const p = Places.all.find((x) => x.id === placeEditingId);
    if (!p) return;
    if (!confirm(`「${p.name}」を けしても いい？`)) return;
    Places.all = Places.all.filter((x) => x.id !== placeEditingId);
    $("#place-modal").close();
    renderPlaces();
  }

  // むしを とうろく する ときの「ばしょ」えらび
  function fillPlaceSelect(preferId) {
    const sel = $("#r-place");
    const all = Places.all.sort((a, b) => b.last - a.last);
    sel.innerHTML = `<option value="">（えらばない）</option>`;
    for (const p of all) {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = `${p.emoji || "🌳"} ${p.name}`;
      sel.appendChild(o);
    }
    if (preferId) sel.value = preferId;
    sel.parentElement && (sel.previousElementSibling.hidden = all.length === 0);
    sel.hidden = all.length === 0;
  }

  // GPSで いちばん ちかい ばしょを さがす（あれば じどう せんたく）
  async function guessPlaceId() {
    const all = Places.all.filter((p) => p.lat != null);
    if (!all.length) return "";
    try {
      const fix = await Geo.current(7000);
      lastFix = fix;
      let best = null, bestD = Infinity;
      for (const p of all) {
        const d = Geo.distance(fix, p);
        if (d < bestD) { bestD = d; best = p; }
      }
      return best && bestD <= NEAR_M ? best.id : "";
    } catch (e) { return ""; }
  }


  // ★の かず（レアど）を タップで えらべる ようにする
  function renderStars(el, rarity, onPick) {
    const r = clampR(rarity);
    el.innerHTML = "";
    el.className = (el.dataset.base || el.className.split(" ")[0]) + " star-pick s" + r;
    el.dataset.base = el.className.split(" ")[0];
    for (let i = 1; i <= 3; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "star" + (i <= r ? " on" : "");
      b.textContent = i <= r ? "★" : "☆";
      b.setAttribute("aria-label", i + "つ");
      if (onPick) b.addEventListener("click", (e) => { e.stopPropagation(); onPick(i); });
      else b.disabled = true;
      el.appendChild(b);
    }
  }

  // ---- カードの おおきさ（1れつの まいすう）----
  function applyCols(n) {
    n = Math.min(5, Math.max(2, parseInt(n, 10) || 2));
    const s = $("#sections");
    s.style.setProperty("--cols", n);
    s.dataset.cols = n;
    localStorage.setItem("mz-cols", n);
    $$(".size-btn").forEach((b) => b.classList.toggle("active", +b.dataset.cols === n));
  }

  // ---- グリッド（ぜんぶ・カテゴリーわけ）----
  function renderGrid() {
    const wrap = $("#sections");
    wrap.innerHTML = "";
    flatOrder = [];
    const sections = groupedByCategory();
    if (sections.length === 0) {
      wrap.innerHTML =
        `<div class="empty"><div class="empty-bug">🔍🐛</div>
         <p>まだ ずかんは からっぽ。<br>${Zukan.meta.empty}</p>
         <div class="empty-arrow">⬇︎</div></div>`;
      return;
    }
    for (const sec of sections) {
      const meta = categoryMeta(sec.catId);
      const head = document.createElement("div");
      head.className = "cat-head";
      head.innerHTML = `<span class="cat-emoji">${meta.emoji}</span><span class="cat-label">${meta.label}</span><span class="cat-count">${sec.groups.length}</span>`;
      wrap.appendChild(head);

      const grid = document.createElement("div");
      grid.className = "grid";
      for (const g of sec.groups) {
        flatOrder.push(g.name);
        grid.appendChild(buildCard(g));
      }
      wrap.appendChild(grid);
    }
  }

  function buildCard(g) {
    const ill = illustFor(g.name);
    const card = document.createElement("button");
    card.className = "card found r" + g.rarity;
    card.style.setProperty("--c", ill.color);
    card.setAttribute("aria-label", g.name);
    // ★3は カードごとに にじの いろを ずらす
    if (g.rarity === 3) {
      let h = 0; for (let i = 0; i < g.name.length; i++) h += g.name.charCodeAt(i);
      card.style.animationDelay = "-" + ((h % 32) / 10).toFixed(2) + "s";
    }

    const media = document.createElement("div");
    media.className = "card-media";
    const img = document.createElement("img");
    img.src = urlFor(g.cover.blob); img.alt = g.name; img.loading = "lazy";
    media.appendChild(img);
    const badge = document.createElement("div");
    badge.className = "card-badge"; badge.innerHTML = ill.svg;
    media.appendChild(badge);
    if (g.count > 1) {
      const cnt = document.createElement("div");
      cnt.className = "card-count"; cnt.textContent = "×" + g.count;
      media.appendChild(cnt);
    }
    card.appendChild(media);

    const name = document.createElement("div");
    name.className = "card-name"; name.textContent = g.name;
    card.appendChild(name);

    const rar = document.createElement("div");
    rar.className = "card-stars s" + g.rarity; rar.textContent = stars(g.rarity);
    card.appendChild(rar);

    card.addEventListener("click", () => openBook(g.name));
    return card;
  }

  // ---- ブック（よこに めくる ずかん）----
  function openBook(name) {
    if (groups.size === 0) return;
    document.body.classList.add("noscroll");
    $("#book").hidden = false;
    rebuildBook(name || flatOrder[0]);
  }
  function closeBook() {
    $("#book").hidden = true;
    document.body.classList.remove("noscroll");
  }

  function rebuildBook(focusName) {
    const track = $("#book-track");
    track.innerHTML = "";
    flatOrder.forEach((nm) => track.appendChild(buildPage(groups.get(nm))));
    let idx = Math.max(0, flatOrder.indexOf(focusName));
    requestAnimationFrame(() => {
      track.scrollLeft = idx * track.clientWidth;
      updateBookCounter();
    });
  }

  function buildPage(g) {
    const ill = illustFor(g.name);
    const meta = categoryMeta(g.category);
    const page = document.createElement("section");
    page.className = "page r" + g.rarity;
    page.dataset.name = g.name;
    page.style.setProperty("--c", ill.color);

    // ★3は ページぜんたいを キラキラ（ホロ）に
    if (g.rarity === 3) {
      const holo = document.createElement("div");
      holo.className = "page-holo";
      holo.setAttribute("aria-hidden", "true");
      page.appendChild(holo);
    }

    const cat = document.createElement("div");
    cat.className = "page-cat";
    cat.innerHTML = `${meta.emoji} ${meta.label}`;
    page.appendChild(cat);

    const pw = document.createElement("div");
    pw.className = "page-photo-wrap";
    const img = document.createElement("img");
    img.className = "page-photo"; img.src = urlFor(g.cover.blob); img.alt = g.name;
    pw.appendChild(img);
    const badge = document.createElement("div");
    badge.className = "page-badge"; badge.innerHTML = ill.svg;
    pw.appendChild(badge);
    if (g.count > 1) {
      const cnt = document.createElement("div");
      cnt.className = "page-count"; cnt.textContent = "×" + g.count;
      pw.appendChild(cnt);
    }
    page.appendChild(pw);

    const st = document.createElement("div");
    st.className = "page-stars";
    renderStars(st, g.rarity, (v) => setRarity(g.name, v));
    page.appendChild(st);
    const stHint = document.createElement("p");
    stHint.className = "star-hint page-star-hint";
    stHint.textContent = "★を タップで かえられるよ";
    page.appendChild(stHint);

    // なまえ（＋ しゅうせい）
    const nameRow = document.createElement("div");
    nameRow.className = "page-name-row";
    const h2 = document.createElement("h2");
    h2.className = "page-name"; h2.textContent = g.name;
    const edit = document.createElement("button");
    edit.className = "page-name-edit"; edit.textContent = "✏️"; edit.title = "なまえを なおす";
    nameRow.appendChild(h2); nameRow.appendChild(edit);
    page.appendChild(nameRow);

    const renameRow = document.createElement("div");
    renameRow.className = "page-rename-row"; renameRow.hidden = true;
    const inp = document.createElement("input");
    inp.className = "page-name-input"; inp.type = "text"; inp.value = g.name; inp.maxLength = 24;
    const ok = document.createElement("button"); ok.className = "rn-ok"; ok.textContent = "OK";
    const ng = document.createElement("button"); ng.className = "rn-ng"; ng.textContent = "やめる";
    renameRow.appendChild(inp); renameRow.appendChild(ok); renameRow.appendChild(ng);
    page.appendChild(renameRow);

    edit.addEventListener("click", () => { nameRow.hidden = true; renameRow.hidden = false; inp.focus(); inp.select(); });
    ng.addEventListener("click", () => { renameRow.hidden = true; nameRow.hidden = false; });
    ok.addEventListener("click", async () => {
      const v = inp.value.trim();
      if (!v) { alert("なまえを いれてね"); return; }
      if (v === g.name) { renameRow.hidden = true; nameRow.hidden = false; return; }
      await DB.renameGroup(g.name, v);
      await DB.patchByName(v, { aiCategory: "" });
      Covers.rename(g.name, v);
      await afterChange(v, true);
    });

    if (g.kana) { const k = document.createElement("p"); k.className = "page-kana"; k.textContent = g.kana; page.appendChild(k); }
    if (g.fact) { const f = document.createElement("p"); f.className = "page-fact"; f.textContent = g.fact; page.appendChild(f); }

    const mt = document.createElement("p");
    mt.className = "page-meta";
    mt.textContent = `みつけた かず：${g.count}かい ・ はじめて：${fmtDate(g.firstDate)}`;
    page.appendChild(mt);

    // みつけた ばしょ
    const spots = [...new Set(g.list.filter((c) => c.placeName).map((c) => c.placeName))];
    if (spots.length) {
      const sp = document.createElement("p");
      sp.className = "page-place";
      sp.textContent = "🗺️ " + spots.join(" ・ ");
      page.appendChild(sp);
    }

    const gtitle = document.createElement("p");
    gtitle.className = "page-gallery-title"; gtitle.textContent = "📸 とった しゃしん";
    page.appendChild(gtitle);
    const gal = document.createElement("div");
    gal.className = "page-gallery";
    for (const c of [...g.list].reverse()) {
      const cell = document.createElement("div"); cell.className = "g-cell";
      if (c.date === g.cover.date) cell.classList.add("is-cover");
      const gi = document.createElement("img"); gi.src = urlFor(c.blob); gi.alt = g.name; cell.appendChild(gi);
      // ひょうしに する（★を タップ）
      const cov = document.createElement("button");
      cov.className = "g-cover"; cov.textContent = c.date === g.cover.date ? "★" : "☆";
      cov.title = "この しゃしんを カードの ひょうしに する";
      cov.addEventListener("click", (e) => { e.stopPropagation(); setCover(g.name, c.date); });
      cell.appendChild(cov);
      const dl = document.createElement("button"); dl.className = "g-save"; dl.textContent = "⬇"; dl.title = "この しゃしんを たんまつに ほぞん";
      dl.addEventListener("click", (e) => { e.stopPropagation(); downloadCapture(c, g.name); });
      cell.appendChild(dl);
      const del = document.createElement("button"); del.className = "g-del"; del.textContent = "×"; del.title = "けす";
      del.addEventListener("click", (e) => { e.stopPropagation(); confirmDelete(c.id, g.name); });
      cell.appendChild(del);
      const dt = document.createElement("div"); dt.className = "g-date"; dt.textContent = fmtDate(c.date); cell.appendChild(dt);
      gal.appendChild(cell);
    }
    page.appendChild(gal);

    const again = document.createElement("button");
    again.className = "page-again"; again.textContent = "📷 もういちど とる";
    again.addEventListener("click", () => openPicker("append", g.name));
    page.appendChild(again);

    const del = document.createElement("button");
    del.className = "page-delete"; del.textContent = Zukan.meta.delGroup;
    del.addEventListener("click", () => deleteGroup(g.name));
    page.appendChild(del);

    if (g.rarity === 3) {
      const sp = document.createElement("div");
      sp.className = "page-sparkles";
      sp.setAttribute("aria-hidden", "true");
      sp.innerHTML = "<span>✨</span><span>⭐</span><span>✨</span><span>💫</span><span>✨</span><span>⭐</span>";
      page.appendChild(sp);
    }

    return page;
  }


  // カードの ひょうしに する しゃしんを えらぶ
  async function setCover(name, date) {
    const g = groups.get(name);
    if (!g) return;
    // おなじ ★を もう いちど おしたら「いちばん あたらしい しゃしん」に もどす
    Covers.set(name, Covers.get(name) === date ? 0 : date);
    sound.blip();
    await afterChange(name, true);
    miniNote("★ ひょうしの しゃしんを かえたよ！");
  }

  // ★の かずを かえて ほぞん（おなじ なまえ ぜんぶ）
  async function setRarity(name, v) {
    const g = groups.get(name);
    if (!g || g.rarity === v) return;
    try { await DB.patchByName(name, { rarity: v }); }
    catch (e) { console.error(e); alert("★を かえられませんでした"); return; }
    sound.blip();
    if (v === 3) { confetti(3); }
    await afterChange(name, true);
  }

  // むし（なまえ）ごと ぜんぶ けす
  async function deleteGroup(name) {
    const g = groups.get(name);
    if (!g) return;
    if (!confirm(`「${name}」を ずかんから けしますか？\n（しゃしん ${g.count}まいが きえます。もとに もどせません）`)) return;
    $("#loading").hidden = false;
    try {
      for (const c of g.list.slice()) { await DB.remove(c.id); }
    } catch (e) { console.error("delete group:", e); }
    Covers.set(name, 0);
    $("#loading").hidden = true;
    await afterChange(name, true);
  }

  function currentPageName() {
    const track = $("#book-track");
    const idx = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    return flatOrder[Math.min(flatOrder.length - 1, Math.max(0, idx))];
  }
  function updateBookCounter() {
    const track = $("#book-track");
    const idx = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    const total = flatOrder.length;
    $("#book-counter").textContent = total ? `${Math.min(total, idx + 1)} / ${total}` : "";
  }
  function bookNav(dir) {
    const track = $("#book-track");
    track.scrollBy({ left: dir * track.clientWidth, behavior: "smooth" });
  }

  function confirmDelete(id, name) {
    if (!confirm("この しゃしんを けしても いい？")) return;
    DB.remove(id).then(() => afterChange(name, true));
  }

  // データが かわった あとの さいびょうが
  async function afterChange(focusName, keepBook) {
    await reload();
    renderProgress();
    renderGrid();
    if (keepBook && !$("#book").hidden) {
      if (groups.has(focusName)) rebuildBook(focusName);
      else if (flatOrder.length) rebuildBook(flatOrder[0]);
      else closeBook();
    }
    // おいわいの あとに そっと じどう バックアップ
    setTimeout(() => { maybeAutoBackup(); }, 1200);
  }

  // ---- しゃしんを えらぶ（カメラ or ファイル）----
  function openPicker(mode, name) {
    pendingMode = mode;
    pendingAppendName = name || null;
    $("#picker").hidden = false;
  }
  function closePicker() { $("#picker").hidden = true; }

  async function onFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    let blob;
    try { blob = await resizeImage(file, 1024, 0.8); }
    catch (err) { alert("しゃしんを よみこめなかったよ。"); return; }

    if (pendingMode === "append" && pendingAppendName) {
      const rec = { name: pendingAppendName, ...pickMeta(pendingAppendName), blob, date: Date.now() };
      $("#loading").hidden = false;
      try {
        await DB.add(rec);
      } catch (err) {
        $("#loading").hidden = true;
        console.error("save failed:", err);
        alert("ほぞん できなかったよ 😢\n〔" + errText(err) + "〕");
        return;
      }
      try { await afterChange(pendingAppendName, true); } catch (e) { console.error(e); }
      $("#loading").hidden = true;
      miniCheer(rec);
      return;
    }

    // discovery
    pendingBlob = blob;
    await askAI(blob);
  }

  // AIに しゃしんを みてもらう（けっか モーダルを ひらく）
  async function askAI(blob) {
    const key = Settings.key;
    if (!key) { openResult(blob, null, "NO_KEY"); return; }
    startThinking(blob);
    try {
      const ai = await Gemini.identify(blob, key, Settings.model, onAiWait, Zukan.id);
      stopThinking();
      openResult(blob, ai, null);
    } catch (err) {
      stopThinking();
      openResult(blob, null, String(err.message || err));
    }
  }

  // AIが こみあって いる とき（429）に まっている あいだの ひょうじ
  function onAiWait(sec, attempt) {
    clearInterval(startThinking._t);
    let left = sec;
    const draw = () => {
      const el = $("#think-sub");
      if (el) el.textContent = `AIが こんでいるみたい…${left}びょう まってね（${attempt}かいめ）`;
    };
    draw();
    clearInterval(onAiWait._t);
    onAiWait._t = setInterval(() => { left = Math.max(0, left - 1); draw(); }, 1000);
    setTimeout(() => clearInterval(onAiWait._t), (sec + 2) * 1000);
  }

  // ---- とうろく中の えんしゅつ ----
  const thinkMsgs = () => Zukan.meta.think;
  function startThinking(blob) {
    const t = $("#thinking");
    $("#think-photo").src = urlFor(blob);
    let i = 0;
    const msgs = thinkMsgs();
    $("#think-sub").textContent = msgs[0];
    clearInterval(startThinking._t);
    startThinking._t = setInterval(() => {
      i = (i + 1) % msgs.length;
      const el = $("#think-sub");
      el.style.opacity = "0";
      setTimeout(() => { el.textContent = msgs[i]; el.style.opacity = "1"; }, 180);
    }, 1800);
    t.hidden = false;
  }
  function stopThinking() {
    clearInterval(startThinking._t);
    clearInterval(onAiWait._t);
    $("#thinking").hidden = true;
  }

  function pickMeta(name) {
    const g = groups.get(name);
    const ill = illustFor(name);
    return {
      kana: (g && g.kana) || ill.kana || "",
      fact: (g && g.fact) || ill.fact || "",
      rarity: g ? g.rarity : ill.rarity,
      color: ill.color, knownId: ill.knownId,
      category: (g && g.category) || categorize(name),
      aiName: null, confidence: null,
      placeId: (g && g.latest && g.latest.placeId) || null,
      placeName: (g && g.latest && g.latest.placeName) || "",
      placeEmoji: (g && g.latest && g.latest.placeEmoji) || "",
    };
  }

  // ---- けっか（AIすいそく＋なまえ しゅうせい）----
  function openResult(blob, ai, err) {
    const r = { name: "", kana: "", fact: "", where: "", rarity: 1, category: "", aiName: null, confidence: null };
    if (ai && ai.is_creature && ai.name) {
      r.name = ai.name; r.kana = ai.kana || ""; r.fact = ai.fact || ""; r.where = ai.where || "";
      r.rarity = clampR(ai.rarity); r.category = ai.category || ""; r.aiName = ai.name;
      r.confidence = typeof ai.confidence === "number" ? ai.confidence : null;
    }
    const known = matchKnown(r.name);
    if (known) {
      r.kana = r.kana || known.kana; r.fact = r.fact || known.fact; r.where = r.where || known.where;
      if (!(ai && ai.is_creature)) r.rarity = known.stars;
    }
    pendingResolved = r;

    $("#r-photo").src = urlFor(blob);
    updateResultIllust(r.name);
    $("#r-name-input").value = r.name;
    $("#r-kana").textContent = r.kana || "";
    $("#r-fact").textContent = r.fact || "";
    $("#r-hint").textContent = r.where ? "🔍 " + r.where : "";
    $("#r-hint").hidden = !r.where;
    pendingRarity = clampR(r.rarity);
    rarityTouched = false;
    drawResultStars();

    const note = $("#r-note");
    note.className = "r-note";
    const detail = (e) => {
      const i = String(e).indexOf(":");
      const raw = i >= 0 ? String(e).slice(i + 1).trim() : "";
      return raw ? `<br><span class='r-note-sub'>〔${escapeHtml(raw.slice(0, 160))}〕</span>` : "";
    };
    // AIに もういちど きく ボタンは エラーの ときだけ だす
    $("#r-retry").hidden = !(err && err !== "NO_KEY" && Settings.key);

    if (err === "NO_KEY") {
      note.classList.add("warn");
      note.innerHTML = "AIキーが まだ ないよ。なまえを てで いれてね。<br><span class='r-note-sub'>⚙️ せってい で キーを いれると じどうで なまえが でます</span>";
    } else if (err && err.startsWith("BAD_KEY")) {
      note.classList.add("warn"); note.innerHTML = "APIキーが ちがうかも。⚙️ せってい を たしかめてね。<br>なまえは てで いれられます。" + detail(err);
    } else if (err && err.startsWith("QUOTA_DAY")) {
      note.classList.add("warn");
      note.innerHTML = "きょうの AIの ぶんは つかいきったみたい。あしたまで まってね。<br><span class='r-note-sub'>Google がわの 1にちの じょうげん（むりょうわく）です。なまえは てで いれられます</span>" + detail(err);
    } else if (err && err.startsWith("QUOTA")) {
      note.classList.add("warn");
      note.innerHTML = "AIが こんでいるみたい。すこし まってから もういちど おしてね。<br><span class='r-note-sub'>Google がわの 「1ぷんあたり」の じょうげんです（アプリの せいげんでは ありません）</span>" + detail(err);
    } else if (err === "NETWORK") {
      note.classList.add("warn"); note.textContent = "ネットに つながらなかったよ。なまえを てで いれてね。";
    } else if (err) {
      note.classList.add("warn"); note.innerHTML = "AIが つかえなかったよ。なまえを てで いれてね。" + detail(err);
    } else if (ai && !ai.is_creature) {
      note.classList.add("warn"); note.textContent = Zukan.meta.notFound;
    } else if (ai) {
      const pct = r.confidence != null ? Math.round(r.confidence * 100) : null;
      note.innerHTML = `🤖 AIの すいそく：<b>${escapeHtml(r.name)}</b>` + (pct != null ? `（じしん ${pct}%）` : "") + "<br><span class='r-note-sub'>ちがったら なまえを なおしてね</span>";
    }
    fillPlaceSelect("");
    $("#result").showModal();
    setTimeout(() => { if (!r.name) $("#r-name-input").focus(); }, 200);
    // GPSで ちかくの ばしょを じどう せんたく
    guessPlaceId().then((id) => { if (id && !$("#r-place").value) $("#r-place").value = id; });
  }

  function drawResultStars() {
    renderStars($("#r-stars"), pendingRarity, (v) => {
      pendingRarity = v;
      rarityTouched = true;
      drawResultStars();
      sound.blip();
    });
  }

  function updateResultIllust(name) {
    const ill = illustFor(name);
    $("#r-illust").innerHTML = ill.svg;
    $("#result").style.setProperty("--c", ill.color);
  }

  // なまえを なおしたら、ずかんの むしと あえば レアど表示も こうしん
  function onResultNameInput(name) {
    updateResultIllust(name);
    const ill = illustFor(name);
    const r = pendingResolved || {};
    if (rarityTouched) return;   // てで えらんだ ★は そのまま
    pendingRarity = clampR(ill.knownId ? ill.rarity : (r.rarity || 1));
    drawResultStars();
  }

  async function saveResult() {
    const name = $("#r-name-input").value.trim();
    if (!name) { alert("なまえを いれてね"); $("#r-name-input").focus(); return; }
    const ill = illustFor(name);
    const r = pendingResolved || {};
    const rec = {
      name,
      kana: r.kana || ill.kana || "",
      fact: r.fact || ill.fact || "",
      rarity: clampR(pendingRarity),
      color: ill.color, knownId: ill.knownId,
      category: categorize(name, r.category),
      aiCategory: (r.aiName && name === r.aiName) ? (r.category || "") : "",
      aiName: r.aiName || null,
      confidence: r.confidence != null ? r.confidence : null,
      blob: pendingBlob, date: Date.now(),
    };
    const selPlace = $("#r-place").value;
    if (selPlace) {
      const pl = Places.all.find((x) => x.id === selPlace);
      rec.placeId = selPlace;
      rec.placeName = pl ? pl.name : "";
      rec.placeEmoji = pl ? (pl.emoji || "🌳") : "";
    }
    const isNew = !groups.has(name);
    const lvBefore = levelOf(groups.size);
    $("#result").close();
    $("#loading").hidden = false;
    try {
      await DB.add(rec);
    } catch (err) {
      $("#loading").hidden = true;
      console.error("save failed:", err);
      alert("ほぞん できなかったよ 😢\n〔" + errText(err) + "〕\nもう いちど「とうろく」を おしてね。");
      $("#result").showModal(); // やりなおせる ように もどす
      return;
    }
    try { await reload(); renderProgress(); renderGrid(); renderPlaces(); } catch (e) { console.error("render after save:", e); }
    $("#loading").hidden = true;
    const leveledUp = levelOf(groups.size) > lvBefore;
    if (isNew) celebrate(rec, leveledUp); else miniCheer(rec);
    setTimeout(() => { maybeAutoBackup(); }, 1200);
  }

  function errText(err) {
    if (!err) return "ふめいな エラー";
    if (err.name === "QuotaExceededError") return "スマホの ほぞん ようりょうが いっぱいです";
    return (err.name ? err.name + ": " : "") + (err.message || String(err));
  }

  // ---- おいわい ----
  function celebrate(rec, leveledUp) {
    const ill = illustFor(rec.name);
    const ov = $("#celebrate");
    const lvEl = $("#cel-level");
    if (leveledUp) {
      const lv = levelOf(groups.size);
      lvEl.innerHTML = `🎉 レベル ${lv} に アップ！<span class="cel-level-title">${escapeHtml(levelTitle(lv))}</span>`;
      lvEl.hidden = false;
    } else {
      lvEl.hidden = true;
    }
    $("#cel-photo").src = urlFor(rec.blob);
    $("#cel-illust").innerHTML = ill.svg;
    $("#cel-name").textContent = rec.name;
    $("#cel-kana").textContent = rec.kana || "";
    $("#cel-stars").textContent = stars(rec.rarity);
    $("#cel-stars").className = "cel-stars s" + clampR(rec.rarity);
    $("#cel-fact").textContent = rec.fact || "";
    const cm = categoryMeta(rec.category);
    $("#cel-cat").textContent = `${cm.emoji} ${cm.label}`;
    ov.style.setProperty("--c", ill.color);
    ov.hidden = false; ov.classList.add("show");
    // レベルアップの ときは もっと はでに！
    confetti(leveledUp ? 3 : rec.rarity);
    sound.fanfare(leveledUp ? 3 : rec.rarity);
    if (leveledUp) setTimeout(() => { confetti(3); sound.blip(); }, 700);
    navigator.vibrate && navigator.vibrate(leveledUp ? [0, 80, 50, 80, 50, 80, 50, 200] : [0, 60, 40, 60, 40, 120]);
  }

  function miniCheer(rec) {
    const g = groups.get(rec.name);
    const t = $("#toast");
    $("#toast-photo").src = urlFor(rec.blob);
    $("#toast-text").textContent = `${rec.name}を また みつけたね！（${g ? g.count : ""}かいめ）`;
    t.hidden = false; t.classList.add("show");
    sound.blip(); confetti(1);
    clearTimeout(miniCheer._t);
    miniCheer._t = setTimeout(() => { t.classList.remove("show"); setTimeout(() => (t.hidden = true), 300); }, 2600);
  }

  // ---- こんぺいとう ----
  function confetti(power) {
    const canvas = $("#confetti"); const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; ctx.scale(dpr, dpr);
    const colors = ["#ffd166", "#ef476f", "#06d6a0", "#118ab2", "#f78c6b", "#c77dff"];
    const N = 60 + clampR(power) * 40; const parts = [];
    for (let i = 0; i < N; i++) parts.push({
      x: innerWidth / 2 + (Math.random() - 0.5) * 120, y: innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 9, vy: -6 - Math.random() * 9,
      s: 6 + Math.random() * 8, c: colors[(Math.random() * colors.length) | 0],
      r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
    });
    let frame = 0; canvas.hidden = false;
    (function tick() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of parts) { p.vy += 0.28; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); ctx.restore(); }
      if (frame++ < 140) requestAnimationFrame(tick); else canvas.hidden = true;
    })();
  }

  // ---- おと ----
  const sound = (() => {
    let ctx = null; let on = localStorage.getItem("mz-sound") !== "off";
    const ac = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());
    function note(freq, start, dur, type = "sine", gain = 0.14) {
      const c = ac(); const o = c.createOscillator(); const g = c.createGain();
      o.type = type; o.frequency.value = freq; o.connect(g); g.connect(c.destination);
      const t = c.currentTime + start;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.start(t); o.stop(t + dur + 0.02);
    }
    return {
      get on() { return on; },
      toggle() { on = !on; localStorage.setItem("mz-sound", on ? "on" : "off"); if (on) this.blip(); return on; },
      fanfare(p) { if (!on) return; try { [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.12, 0.5, "triangle", 0.16)); if (clampR(p) >= 3) note(1319, 0.5, 0.7, "triangle", 0.16); } catch (e) {} },
      blip() { if (!on) return; try { note(880, 0, 0.16, "triangle", 0.12); note(1175, 0.08, 0.16, "triangle", 0.12); } catch (e) {} },
    };
  })();

  // ---- せってい ----
  function openSettings() {
    $("#s-key").value = Settings.key;
    $("#s-model").value = Settings.model;
    $("#s-test-result").textContent = ""; $("#s-test-result").className = "s-test-result";
    $("#s-auto-backup").checked = autoBackupOn();
    $("#settings").showModal();
  }
  function saveSettings() {
    Settings.key = $("#s-key").value.trim();
    Settings.model = $("#s-model").value.trim() || Gemini.DEFAULT_MODEL;
    $("#settings").close(); renderProgress();
  }
  async function testSettings() {
    const key = $("#s-key").value.trim();
    const model = $("#s-model").value.trim() || Gemini.DEFAULT_MODEL;
    const out = $("#s-test-result");
    if (!key) { out.textContent = "APIキーを いれてね"; out.className = "s-test-result warn"; return; }
    out.textContent = "たしかめ中…"; out.className = "s-test-result";
    try { await Gemini.test(key, model); out.textContent = "✓ せつぞく できたよ！"; out.className = "s-test-result ok"; }
    catch (err) { out.textContent = "✕ " + (err.message || "しっぱい"); out.className = "s-test-result warn"; }
  }


  // AIに ぜんぶの なかまわけを やりなおして もらう
  async function reclassifyWithAI() {
    const out = $("#s-reclass-result");
    const key = Settings.key;
    if (!key) { out.textContent = "さきに APIキーを いれてね"; out.className = "s-test-result warn"; return; }
    const names = [...groups.keys()];
    if (!names.length) { out.textContent = `まだ ${Zukan.meta.one}が いないよ`; out.className = "s-test-result warn"; return; }
    out.textContent = `AIが ${names.length}しゅるいを しらべているよ…`;
    out.className = "s-test-result";
    try {
      const map = await Gemini.classifyNames(names, key, Settings.model, Zukan.id);
      let changed = 0;
      for (const name of names) {
        const label = map[name];
        if (!label) continue;
        const before = groups.get(name).category;
        const after = categorize(name, label);
        await DB.patchByName(name, { aiCategory: label });
        if (after !== before) changed++;
      }
      await reload(); renderProgress(); renderGrid(); renderPlaces();
      out.textContent = changed
        ? `✓ ${changed}しゅるいの なかまわけを なおしたよ！`
        : "✓ ぜんぶ あってたよ！";
      out.className = "s-test-result ok";
      if (changed) { sound.blip(); }
    } catch (err) {
      out.textContent = "✕ " + (err.message || "できませんでした");
      out.className = "s-test-result warn";
    }
  }



  // しゃしん 1まいを たんまつに ほぞん
  function downloadCapture(c, name) {
    try {
      const url = URL.createObjectURL(c.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}-${toDateInput(c.date)}.jpg`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      sound.blip();
    } catch (e) { alert("ほぞん できませんでした"); }
  }

  // バックアップの おすすめ（ながらく していない ときだけ）
  const BACKUP_KEY = "mz-last-backup";
  const BACKUP_EVERY = 3 * 24 * 60 * 60 * 1000;
  function updateBackupHint() {
    const el = $("#backup-hint");
    if (!el) return;
    const n = captures.length;
    let last = 0;
    try { last = parseInt(localStorage.getItem(BACKUP_KEY) || "0", 10) || 0; } catch (e) {}
    const need = n > 0 && (!last || Date.now() - last > BACKUP_EVERY);
    el.hidden = !need;
    el.textContent = last
      ? "💾 まえの バックアップから じかんが たったよ。タップで ほぞん"
      : "💾 だいじな しゃしんを まもろう！ タップで バックアップ";
  }

  // ---- じどう バックアップ ----
  const AUTO_KEY = "mz-auto-backup";   // "0" なら オフ（きほんは オン）
  const SIG_KEY = "mz-backup-sig";     // さいごに ほぞんした データの しるし
  const AUTO_EVERY = 6 * 60 * 60 * 1000;
  const autoBackupOn = () => { try { return localStorage.getItem(AUTO_KEY) !== "0"; } catch (e) { return true; } };
  function markBackedUp(sig) {
    try {
      localStorage.setItem(BACKUP_KEY, String(Date.now()));
      if (sig) localStorage.setItem(SIG_KEY, sig);
    } catch (e) {}
    updateBackupHint();
  }
  // データが かわって、まえの じどう ほぞんから じかんが たっていたら ほぞんする
  async function maybeAutoBackup() {
    if (!autoBackupOn()) return;
    let last = 0, lastSig = "";
    try {
      last = parseInt(localStorage.getItem(BACKUP_KEY) || "0", 10) || 0;
      lastSig = localStorage.getItem(SIG_KEY) || "";
    } catch (e) {}
    if (last && Date.now() - last < AUTO_EVERY) return;       // まだ はやい
    try {
      const { blob, count, sig } = await buildBackup();
      if (!count || sig === lastSig) return;                  // なにも かわって いない
      downloadBlob(blob, backupFileName());
      markBackedUp(sig);
      miniNote(`💾 じどうで バックアップしたよ（しゃしん ${count}まい）`);
    } catch (err) {
      console.warn("auto backup failed:", err);
    }
  }
  // ちいさな おしらせ（3びょうで きえる）
  function miniNote(text) {
    const el = $("#mini-note");
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add("show"));
    clearTimeout(miniNote._t);
    miniNote._t = setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => (el.hidden = true), 300);
    }, 3600);
  }

  // ============ バックアップ（ほぞん / もどす）============
  function blobToDataURL(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(new Error("よみこみ しっぱい"));
      r.readAsDataURL(blob);
    });
  }
  function dataURLToBlob(d) {
    const i = d.indexOf(",");
    const mime = (d.slice(0, i).match(/:(.*?);/) || [])[1] || "image/jpeg";
    const bin = atob(d.slice(i + 1));
    const arr = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) arr[k] = bin.charCodeAt(k);
    return new Blob([arr], { type: mime });
  }

  // バックアップの ファイルを つくる（てどうも じどうも これを つかう）
  async function buildBackup() {
    const rows = await DB.getAllRaw();   // ずかん ぜんぶ（むし も おはな も）
    const items = [];
    let newest = 0;
    for (const r of rows) {
      const rec = Object.assign({}, r);
      if (!rec.col) rec.col = "mushi";
      if (!rec.imgData && rec.blob) rec.imgData = await blobToDataURL(rec.blob);
      delete rec.blob; delete rec.img; delete rec.id;
      if (rec.date > newest) newest = rec.date;
      items.push(rec);
    }
    const data = {
      app: "mushizukan", version: APP_VERSION, exportedAt: Date.now(),
      captures: items, places: Places.all, covers: Covers.all,
    };
    return {
      blob: new Blob([JSON.stringify(data)], { type: "application/json" }),
      count: items.length,
      sig: `${items.length}|${newest}|${Places.all.length}`,
    };
  }
  const backupFileName = () => `mushizukan-backup-${toDateInput(Date.now())}.json`;
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function exportBackup() {
    const out = $("#s-backup-result");
    out.textContent = "バックアップを つくっているよ…"; out.className = "s-test-result";
    try {
      const { blob, count, sig } = await buildBackup();
      downloadBlob(blob, backupFileName());
      markBackedUp(sig);
      out.textContent = `✓ ${count}まいの しゃしんを ほぞんしたよ！`;
      out.className = "s-test-result ok";
    } catch (err) {
      console.error(err);
      out.textContent = "✕ " + (err.message || "できませんでした");
      out.className = "s-test-result warn";
    }
  }

  async function importBackup(file) {
    const out = $("#s-backup-result");
    out.textContent = "よみこんでいるよ…"; out.className = "s-test-result";
    try {
      const data = JSON.parse(await file.text());
      if (!data || data.app !== "mushizukan") throw new Error("むしずかんの バックアップ ではないみたい");
      const existing = await DB.getAllRaw();
      const keyOf = (c) => `${c.col || "mushi"}|${c.name}|${c.date}`;
      const have = new Set(existing.map(keyOf));
      let added = 0;
      for (const c of data.captures || []) {
        if (!c || !c.name || have.has(keyOf(c))) continue;
        const rec = Object.assign({}, c);
        delete rec.id;
        if (!rec.col) rec.col = "mushi";
        if (rec.imgData) { rec.blob = dataURLToBlob(rec.imgData); delete rec.imgData; }
        await DB.add(rec);
        have.add(keyOf(c));
        added++;
      }
      // ひょうしの しゃしんの えらび も もどす
      if (data.covers && typeof data.covers === "object") {
        try {
          const m = Object.assign({}, data.covers, Covers.all);
          localStorage.setItem("mz-covers", JSON.stringify(m));
        } catch (e) {}
      }
      let addedPlaces = 0;
      const cur = Places.all;
      const ids = new Set(cur.map((p) => p.id));
      for (const p of data.places || []) {
        if (!p || !p.id || ids.has(p.id)) continue;
        cur.push(p); ids.add(p.id); addedPlaces++;
      }
      if (addedPlaces) Places.all = cur;
      await reload(); renderProgress(); renderGrid(); renderPlaces();
      out.textContent = `✓ しゃしん ${added}まい・ばしょ ${addedPlaces}かしょを もどしたよ！`;
      out.className = "s-test-result ok";
      if (added) { sound.fanfare(2); confetti(2); }
    } catch (err) {
      console.error(err);
      out.textContent = "✕ " + (err.message || "もどせませんでした");
      out.className = "s-test-result warn";
    }
  }

  function resizeImage(file, maxSide, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width: w, height: h } = img;
        const scale = Math.min(1, maxSide / Math.max(w, h));
        w = Math.round(w * scale); h = Math.round(h * scale);
        const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("load")); };
      img.src = url;
    });
  }

  // ---- はいせん ----
  function wire() {
    $("#fab").addEventListener("click", () => openPicker("discovery"));
    $("#zukan-switch").addEventListener("click", openZukanSheet);
    $("#zukan-cancel").addEventListener("click", closeZukanSheet);
    $("#zukan-sheet").addEventListener("click", (e) => { if (e.target.id === "zukan-sheet") closeZukanSheet(); });
    $("#pick-camera").addEventListener("click", () => { closePicker(); $("#file-camera").click(); });
    $("#pick-file").addEventListener("click", () => { closePicker(); $("#file-gallery").click(); });
    $("#pick-cancel").addEventListener("click", closePicker);
    $("#picker").addEventListener("click", (e) => { if (e.target.id === "picker") closePicker(); });
    $("#file-camera").addEventListener("change", onFile);
    $("#file-gallery").addEventListener("change", onFile);

    $("#book-open").addEventListener("click", () => openBook(flatOrder[0]));
    $("#book-close").addEventListener("click", closeBook);
    $("#book-prev").addEventListener("click", () => bookNav(-1));
    $("#book-next").addEventListener("click", () => bookNav(1));
    let raf = null;
    $("#book-track").addEventListener("scroll", () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = null; updateBookCounter(); });
    });

    $("#r-save").addEventListener("click", saveResult);
    $("#r-cancel").addEventListener("click", () => $("#result").close());
    $("#r-retry").addEventListener("click", () => {
      if (!pendingBlob) return;
      const blob = pendingBlob;
      $("#result").close();
      askAI(blob);
    });
    $("#r-name-input").addEventListener("input", (e) => onResultNameInput(e.target.value));

    $("#cel-ok").addEventListener("click", () => { const ov = $("#celebrate"); ov.classList.remove("show"); setTimeout(() => (ov.hidden = true), 300); });

    $("#settings-btn").addEventListener("click", openSettings);
    $("#api-hint").addEventListener("click", openSettings);
    $("#s-close").addEventListener("click", () => $("#settings").close());
    $("#s-save").addEventListener("click", saveSettings);
    $("#s-test").addEventListener("click", testSettings);
    $("#s-reclass").addEventListener("click", reclassifyWithAI);
    $("#s-auto-backup").checked = autoBackupOn();
    $("#s-auto-backup").addEventListener("change", (e) => {
      try { localStorage.setItem(AUTO_KEY, e.target.checked ? "1" : "0"); } catch (err) {}
    });
    $("#s-export").addEventListener("click", exportBackup);
    $("#backup-hint").addEventListener("click", exportBackup);
    $("#s-import").addEventListener("click", () => $("#s-import-file").click());
    $("#s-import-file").addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (f) importBackup(f);
    });
    $("#s-reset").addEventListener("click", resetData);
    $("#s-key-toggle").addEventListener("click", () => {
      const masked = $("#s-key").classList.toggle("masked");
      $("#s-key-toggle").textContent = masked ? "👁" : "🙈";
    });

    $$(".size-btn").forEach((btn) => btn.addEventListener("click", () => applyCols(+btn.dataset.cols)));

    $("#place-add").addEventListener("click", () => openPlaceModal(null));
    $("#pl-close").addEventListener("click", () => $("#place-modal").close());
    // はいけいを タップでも とじられる
    for (const id of ["#place-modal", "#settings", "#result"]) {
      $(id).addEventListener("click", (e) => { if (e.target === $(id)) $(id).close(); });
    }
    $("#pl-save").addEventListener("click", savePlace);
    $("#pl-here").addEventListener("click", useCurrentPlace);
    $("#pl-today").addEventListener("click", () => { $("#pl-date").value = toDateInput(Date.now()); });
    $("#pl-search-btn").addEventListener("click", searchPlace);
    $("#pl-search").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); searchPlace(); } });
    $("#pl-photo-btn").addEventListener("click", () => $("#pl-photo-input").click());
    $("#pl-photo-input").addEventListener("change", onPlacePhoto);
    $("#pl-photo-del").addEventListener("click", () => setPlacePhoto(null));
    $("#pl-visit").addEventListener("click", visitAgain);
    $("#pl-delete").addEventListener("click", deletePlace);

    const sb = $("#sound-btn");
    const refreshSound = () => (sb.textContent = sound.on ? "🔊" : "🔈");
    refreshSound();
    sb.addEventListener("click", () => { sound.toggle(); refreshSound(); });

    document.body.addEventListener("pointerdown", function once() {
      try { new (window.AudioContext || window.webkitAudioContext)().resume(); } catch (e) {}
      document.body.removeEventListener("pointerdown", once);
    }, { once: true });
  }

  // リセット：open する まえに DBを けして きれいに やりなおす ため、URLに しるしを つけて さいよみこみ
  function resetData() {
    if (!confirm("ぜんぶの きろく（しゃしん）を けして さいしょから やりなおしますか？\nもとに もどせません。")) return;
    location.href = location.pathname + "?reset=" + Date.now();
  }

  async function start() {
    Zukan.id = Zukan.id;          // ほぞんして ある ずかんを data.js / db.js に つたえる
    wire();
    applyZukanChrome();
    applyCols(localStorage.getItem("mz-cols") || 2);
    const ver = $("#app-ver"); if (ver) ver.textContent = APP_VERSION;
    const sver = $("#s-ver"); if (sver) sver.textContent = APP_VERSION;

    // リセット モード：DBを ひらく まえに けす（ハング中でも かくじつに けせる）
    if (/[?&]reset=/.test(location.search)) {
      $("#progress-msg").textContent = "データを リセット中…";
      try { await DB.reset(); } catch (e) { console.error("reset:", e); }
      location.replace(location.pathname); // きれいな URLで ひらきなおし
      return;
    }

    renderPlaces();
    try {
      await reload();
      renderProgress();
      renderGrid();
    } catch (e) {
      console.error("load failed:", e);
      $("#progress-msg").textContent = "データを よみこめませんでした 😢";
      try { renderGrid(); } catch (_) {}
      setTimeout(() => {
        if (confirm(
          "データを よみこめませんでした 😢\n〔" + errText(e) + "〕\n\n" +
          "データを リセットして なおしますか？\n（これまでの しゃしんは きえますが、また あつめられます）"
        )) {
          location.href = location.pathname + "?reset=" + Date.now();
        }
      }, 150);
    }
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(() => {});
    // データが かってに けされにくく なるように おねがいする
    try { navigator.storage && navigator.storage.persist && navigator.storage.persist().catch(() => {}); } catch (e) {}
  }
  start();
})();
