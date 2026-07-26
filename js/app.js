/* むしずかん — メイン（しゃしん → AIすいそく → カテゴリーわけ → ずかん） */
(() => {
  "use strict";

  const APP_VERSION = "v50";

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
  const MAX_R = 5;                                  // レアどは ★1〜★5
  const clampR = (n) => Math.min(MAX_R, Math.max(1, parseInt(n, 10) || 1));
  const stars = (n) => "★".repeat(clampR(n)) + "☆".repeat(MAX_R - clampR(n));
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

  /* ============================================================
     ふりがな（ルビ）
     もじれつの なかの 「漢字(かんじ)」を <ruby>漢字<rt>かんじ</rt></ruby> に かえる。
     ひょうじの ちょくぜんに DOMを あるいて へんかん するので、
     ふつうに textContent で かいて おけば よい。
     ============================================================ */
  const RUBY_PAT = "([\\u4E00-\\u9FFF\\u3005\\u3006\\u30F6々]+)[（(]([\\u3041-\\u309F\\u30A1-\\u30FCー]+)[)）]";
  const rubyRe = () => new RegExp(RUBY_PAT, "g");
  const SKIP_TAGS = { RT: 1, RUBY: 1, RP: 1, SCRIPT: 1, STYLE: 1, TEXTAREA: 1, OPTION: 1, INPUT: 1, SELECT: 1 };

  // 「漢字(かんじ)」の かっこを とって、ただの もじれつに する（alert など ようの）
  const plain = (t) => String(t == null ? "" : t).replace(rubyRe(), "$1");

  function rubyifyDOM(root) {
    if (!root || !root.ownerDocument && root.nodeType !== 9 && root.nodeType !== 1) return;
    const doc = root.ownerDocument || document;
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentNode;
        if (!p || SKIP_TAGS[p.nodeName]) return NodeFilter.FILTER_REJECT;
        return rubyRe().test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const targets = [];
    let n; while ((n = walker.nextNode())) targets.push(n);
    for (const node of targets) {
      const src = node.nodeValue;
      const re = rubyRe();
      const frag = doc.createDocumentFragment();
      let last = 0, m;
      while ((m = re.exec(src))) {
        if (m.index > last) frag.appendChild(doc.createTextNode(src.slice(last, m.index)));
        const ruby = doc.createElement("ruby");
        ruby.appendChild(doc.createTextNode(m[1]));
        const rt = doc.createElement("rt");
        rt.textContent = m[2];
        ruby.appendChild(rt);
        frag.appendChild(ruby);
        last = m.index + m[0].length;
      }
      if (last < src.length) frag.appendChild(doc.createTextNode(src.slice(last)));
      if (node.parentNode) node.parentNode.replaceChild(frag, node);
    }
  }
  // レンダリングが おわった あとに まとめて ルビを つける
  function _rubyLater(el) {
    if (!el) return;
    Promise.resolve().then(() => rubyifyDOM(el));
  }

  // がめん ぜんたいを ふりがな つきに する（レンダリングの あとに よぶ）
  function rubyAll() {
    rubyifyDOM(document.body);
    for (const d of $$("dialog")) rubyifyDOM(d);
  }
  /* がめんの もじが かわったら じどうで ルビを つける。
     こうすると textContent で かいた ところ ぜんぶに ふりがなが つく。*/
  let _rubyQueued = false;
  function startRubyWatch() {
    const obs = new MutationObserver(() => {
      if (_rubyQueued) return;
      _rubyQueued = true;
      requestAnimationFrame(() => { _rubyQueued = false; rubyAll(); });
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  // alert / confirm は ルビが つかえないので かっこを とる
  const say = (t) => alert(plain(t));
  const ask = (t) => confirm(plain(t));

  function illustFor(name) {
    const hana = Zukan.id === "hana";
    const k = hana ? matchKnownFlower(name) : matchKnown(name);
    const gen = hana ? GENERIC_FLOWER : GENERIC_BUG;
    return k
      ? { svg: k.svg, color: k.color, knownId: k.id, kana: k.kana, fact: k.fact, where: k.where, rarity: k.stars,
          family: k.family || "", trivia: k.trivia || [], habitat: k.habitat || "", season: k.season || "", food: k.food || "", size: k.size || "", care: k.care || "" }
      : { svg: gen.svg, color: gen.color, knownId: null, kana: "", fact: "", where: "", rarity: 1,
          family: "", trivia: [], habitat: "", season: "", food: "", size: "", care: "" };
  }

  /* ★3までだった ころの データを ★5の めもりに あわせる（1かいだけ）。
     3→5、2→3、1→1。じゅんばんは そのまま で、いちばん レアな ものが ★5に なる。*/
  async function migrateRarity5() {
    const KEY = "mz-r5-done";
    try { if (localStorage.getItem(KEY) === "1") return; } catch (e) { return; }
    try {
      const rows = await DB.getAllRaw();
      const map = { 1: 1, 2: 3, 3: 5 };
      const names = new Map();
      for (const r of rows) {
        const old = parseInt(r.rarity, 10) || 1;
        if (old <= 3) names.set(`${r.col || "mushi"}|${r.name}`, map[old] || old);
      }
      const before = DB.setCollection;
      for (const [key, val] of names) {
        const [col, name] = key.split("|");
        DB.setCollection(col);
        await DB.patchByName(name, { rarity: val });
      }
      DB.setCollection(Zukan.id);
      localStorage.setItem(KEY, "1");
    } catch (e) { console.warn("rarity migrate:", e); }
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
      const k = (Zukan.id === "hana") ? matchKnownFlower(g.name) : matchKnown(g.name);
      g.rarity = clampR(rep.rarity || (k ? k.stars : 1));
      g.kana = rep.kana || (k ? k.kana : "");
      g.fact = rep.fact || (k ? k.fact : "");
      // くわしい じょうほうは、もっている しゃしんの どれかに あれば つかう
      const pick = (key) => {
        for (let i = g.list.length - 1; i >= 0; i--) {
          const v = g.list[i][key];
          if (Array.isArray(v) ? v.length : v) return v;
        }
        return (k && k[key]) || (Array.isArray(g.list[0] && g.list[0][key]) ? [] : "");
      };
      g.family = String(pick("family") || "").trim();
      g.trivia = pick("trivia") || [];
      if (!Array.isArray(g.trivia)) g.trivia = [];
      g.habitat = pick("habitat") || "";
      g.season = pick("season") || "";
      g.food = pick("food") || "";
      g.size = pick("size") || "";
      g.care = pick("care") || "";
      g.where = pick("where") || "";
      g.hasDetails = !!(g.trivia.length || g.habitat || g.care);
      // なかまわけは そのつど けいさん（ルールを なおしたら むかしの ぶんも なおる）
      g.category = categorize(g.name, rep.aiCategory || rep.category);
    }
  }

  /* 「科(か)」ごとに まとめる（AIが おしえて くれた 科を つかう）。
     科が わからない ものは、おおきな なかまわけ（こうちゅう など）に まとめる。
     ならびは おおきな なかまわけの じゅんばん → 科の 五十音(ごじゅうおん)じゅん。*/
  function groupedByCategory() {
    const order = categoryOrderFor();
    const secs = new Map();   // key -> { catId, family, groups }
    for (const g of groups.values()) {
      const cat = g.category || (Zukan.id === "hana" ? "f_other" : "other");
      const fam = (g.family || "").trim();
      const key = fam ? "f:" + fam : "c:" + cat;
      if (!secs.has(key)) secs.set(key, { catId: cat, family: fam, groups: [] });
      secs.get(key).groups.push(g);
    }
    const out = [...secs.values()];
    for (const sec of out) sec.groups.sort((a, b) => b.lastDate - a.lastDate);
    out.sort((a, b) => {
      const oa = order.indexOf(a.catId), ob = order.indexOf(b.catId);
      if (oa !== ob) return (oa < 0 ? 99 : oa) - (ob < 0 ? 99 : ob);
      if (!a.family !== !b.family) return a.family ? -1 : 1;   // 科が わかる ものが さき
      return a.family.localeCompare(b.family, "ja");
    });
    return out;
  }
  // セクションの みだし（科が あれば 科の なまえ、なければ おおきな なかまわけ）
  const secLabel = (sec) => sec.family || categoryMeta(sec.catId).label;

  // ---- レベル（10しゅるいごとに アップ・じょうげんなし）----
  const PER_LEVEL = 10;
  const levelOf = (n) => Math.floor(n / PER_LEVEL) + 1;
  const LEVEL_TITLES_FALLBACK = [
    "見習(みなら)い", "探偵(たんてい)", "ハンター", "博士(はかせ)", "マスター", "キング", "レジェンド"
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
    // 「タップで ○○に きりかえ」— つぎに きりかわる ずかんの なまえを だす
    const sw = $("#plate-switch");
    if (sw) {
      const others = ZUKANS.filter((x) => x.id !== z.id);
      sw.textContent = others.length === 1
        ? `🔄 タップで ${others[0].title}に 切(き)りかえ`
        : "🔄 タップで 図鑑(ずかん)を 切(き)りかえ";
    }
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
    miniNote(`${Zukan.meta.emoji} ${Zukan.meta.title}に 切(き)りかえたよ！`);
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
        `<span class="zp-sub">${counts[z.id] ? counts[z.id] + "種類(しゅるい) 集(あつ)めたよ" : "まだ からっぽ"}</span></span>` +
        (z.id === Zukan.id ? `<span class="zp-now">今(いま)</span>` : "");
      b.addEventListener("click", () => switchZukan(z.id));
      list.appendChild(b);
    }
    $("#zukan-sheet").hidden = false;
  }
  function closeZukanSheet() { $("#zukan-sheet").hidden = true; }

  // ---- ヘッダー ----
  function renderProgress() {
    _rubyLater($("header"));
    const n = groups.size;
    const total = captures.length;
    $("#count").textContent = n;
    $("#total").textContent = n === 0 ? "" : "種類(しゅるい)";
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
        say("場所(ばしょ)を 保存(ほぞん)できませんでした。\n写真(しゃしん)を 減(へ)らすと 直(なお)るかも しれません。");
        throw e;
      }
    },
  };

  function renderPlaces() {
    _rubyLater($(".places"));
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
          (p.visits > 1 ? `<span class="place-visits">${p.visits}回(かい)</span>` : "") +
          (bugs ? `<span class="place-bugs">🐛${bugs}</span>` : "") +
        `</span>` +
        `<span class="place-date">${fmtDate(p.last)}</span>`;
      card.addEventListener("click", () => openPlaceModal(p.id));
      list.appendChild(card);
    }

    const add = document.createElement("button");
    add.className = "place-card place-add-card";
    add.innerHTML = `<span class="place-emoji big">🗺️</span><span class="place-name">場所(ばしょ)を<br>増(ふ)やす</span>`;
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
      m.innerHTML = `<img src="${Geo.tileUrl(placeCoord.lat, placeCoord.lng)}" alt="地図" loading="lazy">` +
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

    $("#pl-title").textContent = p ? "🗺️ 場所(ばしょ)" : "🗺️ 場所(ばしょ)を 登録(とうろく)";
    $("#pl-name").value = p ? p.name : "";
    $("#pl-note").value = p ? (p.note || "") : "";
    $("#pl-search").value = "";
    $("#pl-results").innerHTML = "";
    $("#pl-search-msg").textContent = "";
    $("#pl-address").textContent = placeAddress ? "📍 " + placeAddress : "";
    $("#pl-date").value = toDateInput(p ? p.last : Date.now());
    $("#pl-first-wrap").hidden = !p;
    $("#pl-date-label").textContent = p ? "📅 最近(さいきん) 行(い)った 日(ひ)" : "📅 行(い)った 日(ひ)";
    if (p) $("#pl-first").value = toDateInput(p.first || p.last);
    $("#pl-meta").textContent = p
      ? `はじめて：${fmtDate(p.first)} ・ 行(い)った 回数(かいすう)：${p.visits}回(かい)`
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
    rubyifyDOM($("#place-modal"));
    // じどうで キーボードを ださない（なまえの らんを タップ したら ひらく）
  }

  // 📍 いまいる ばしょ
  async function useCurrentPlace() {
    const msg = $("#pl-search-msg");
    msg.className = "pl-search-msg";
    msg.textContent = "📍 今(いま)の 場所(ばしょ)を 調(しら)べて いるよ…";
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
        msg.textContent = "✓ 今(いま)の 場所(ばしょ)が わかったよ！";
      } catch (e) {
        $("#pl-address").textContent = `📍 ${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}`;
        msg.textContent = "✓ 位置(いち)を 記録(きろく)したよ（名前(なまえ)は 手(て)で 入(い)れてね）";
      }
      msg.className = "pl-search-msg ok";
    } catch (err) {
      msg.textContent = "✕ " + (err.message || "位置(いち)が わかりませんでした");
      msg.className = "pl-search-msg warn";
    }
  }

  // 🔎 ばしょを さがす
  async function searchPlace() {
    const q = $("#pl-search").value.trim();
    const msg = $("#pl-search-msg");
    const box = $("#pl-results");
    if (!q) { msg.textContent = "さがす 言葉(ことば)を 入(い)れてね"; msg.className = "pl-search-msg warn"; return; }
    msg.textContent = "さがして いるよ…"; msg.className = "pl-search-msg"; box.innerHTML = "";
    try {
      const rows = await Geo.search(q);
      if (!rows.length) { msg.textContent = "みつかりませんでした"; msg.className = "pl-search-msg warn"; return; }
      msg.textContent = "タップして 選(えら)んでね";
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
          msg.textContent = "✓ 場所(ばしょ)を 選(えら)んだよ！"; msg.className = "pl-search-msg ok";
          updatePlaceMap();
        });
        box.appendChild(b);
      }
    } catch (err) {
      msg.textContent = "✕ " + (err.message || "検索(けんさく)できませんでした");
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
    } catch (err) { say("写真(しゃしん)を 読(よ)みこめなかったよ。"); }
  }

  function savePlace() {
    const name = $("#pl-name").value.trim();
    if (!name) { say("場所(ばしょ)の 名前(なまえ)を 入(い)れてね"); $("#pl-name").focus(); return; }
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
    if (!ask(`「${p.name}」を 消(け)しても いい？`)) return;
    Places.all = Places.all.filter((x) => x.id !== placeEditingId);
    $("#place-modal").close();
    renderPlaces();
  }

  // むしを とうろく する ときの「ばしょ」えらび
  function fillPlaceSelect(preferId) {
    const sel = $("#r-place");
    const all = Places.all.sort((a, b) => b.last - a.last);
    sel.innerHTML = `<option value="">（選(えら)ばない）</option>`;
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
    for (let i = 1; i <= MAX_R; i++) {
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
    _rubyLater($("#sections"));
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
      head.innerHTML = `<span class="cat-emoji">${meta.emoji}</span>` +
        `<span class="cat-label">${escapeHtml(secLabel(sec))}` +
        (sec.family ? `<small class="cat-sub">${escapeHtml(meta.label)}</small>` : "") +
        `</span><span class="cat-count">${sec.groups.length}</span>`;
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
    // ★5は カードごとに にじの いろを ずらす
    if (g.rarity >= 5) {
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

  /* ---- ページを めくる（3Dの ぺージターン）----
     ページは かさねて おき、いま みている 1まいだけ ひょうじ する。
     つぎへ：いまの ページを 左(ひだり)の せぼねを じくに −180° まわす。
     まえへ：まえの ページを −180° から 0° に もどす。*/
  let bookIdx = 0;
  let flipping = false;

  function pageEls() { return $$("#book-track > .page"); }

  function showBookPage(i, opts) {
    const els = pageEls();
    if (!els.length) return;
    bookIdx = Math.max(0, Math.min(els.length - 1, i));
    const keepLive = !!(opts && opts.keepLive);
    els.forEach((el, k) => {
      el.classList.remove("is-show", "is-top", "is-under");
      if (!keepLive) el.classList.remove("is-live");
      clearFlipPaint(el);
      // まえ・いま・つぎ の 3まいは ならべて おく（めくり はじめの カクつき ふうじ）
      if (!keepLive && Math.abs(k - bookIdx) <= 1) el.classList.add("is-live");
      if (k === bookIdx) {
        el.classList.add("is-live", "is-show", "is-top");
        if (!opts || !opts.keepScroll) { const inr = el.querySelector(".page-inner"); if (inr) inr.scrollTop = 0; }
      }
    });
    updateBookCounter();
  }

  function rebuildBook(focusName) {
    _rubyLater($("#book-track"));
    const track = $("#book-track");
    track.innerHTML = "";
    flatOrder.forEach((nm) => track.appendChild(buildPage(groups.get(nm))));
    const idx = Math.max(0, flatOrder.indexOf(focusName));
    requestAnimationFrame(() => showBookPage(idx));
  }

  // めくる ときの かげ（じくの ちかくを こく）
  function flipShadow(deg) {
    const t = Math.min(1, Math.abs(deg) / 180);
    return `0 8px 22px rgba(0,0,0,${0.35 + 0.25 * t}), inset ${7 + 26 * t}px 0 ${12 + 30 * t}px -6px rgba(90,65,35,${0.35 + 0.35 * t})`;
  }

  /* かみが しなって めくれる ように みせる。
     まいフレーム さわるのは transform と opacity だけ（グラデーションは かえない）。
     こうすると スマホでも カクつかない。*/
  const FLIP_MS = 620;
  // 45°で いちばん しなり、90°で ぴったり まっすぐに もどる。
  // （90°で かみは よこを むいて きえる ので、そこで ふくらんで いると パッと きえて みえる）
  function bowOf(t) {
    const x = Math.min(1, Math.max(0, t));
    return x < 0.5 ? Math.sin(x * 2 * Math.PI) : 0;
  }

  function paintFlip(el, under, deg) {
    const t = Math.min(1, Math.abs(deg) / 180);
    const b = bowOf(t);
    el.style.transform =
      `rotateY(${deg.toFixed(2)}deg) skewY(${(-2.4 * b).toFixed(2)}deg) ` +
      `scaleY(${(1 - 0.026 * b).toFixed(4)}) rotate(${(-0.7 * b).toFixed(2)}deg)`;
    // 90°（よこむき）を こえたら みえなく する
    el.style.opacity = t < 0.46 ? "1" : t < 0.5 ? ((0.5 - t) / 0.04).toFixed(3) : "0";

    const sh = el.querySelector(".pg-shade");
    if (sh) sh.style.opacity = (0.78 * b).toFixed(3);
    const gl = el.querySelector(".pg-gloss");
    if (gl) {
      gl.style.opacity = "1";
      const i = gl.firstElementChild;
      if (i) i.style.transform = `translateX(${(-70 + 480 * Math.min(t, 0.5)).toFixed(1)}%)`;
    }
    const cast = under && under.querySelector(".pg-cast");
    if (cast) {
      const w = Math.max(0.05, Math.cos((deg * Math.PI) / 180));
      cast.style.opacity = (1 - t).toFixed(3);
      cast.style.transform = `scaleX(${w.toFixed(3)})`;
    }
  }

  function clearFlipPaint(el) {
    el.style.transform = "";
    el.style.opacity = "";
    el.style.transition = "";
    el.classList.remove("flip-next", "flip-prev", "cast-out", "cast-in", "is-anim");
    for (const q of [".pg-shade", ".pg-gloss", ".pg-cast"]) {
      const n = el.querySelector(q);
      if (n) { n.style.opacity = ""; n.style.transform = ""; n.style.transition = ""; }
    }
    const gi = el.querySelector(".pg-gloss > i");
    if (gi) gi.style.transform = "";
  }

  const _reduce = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  function bookNav(dir) {
    if (flipping) return;
    const els = pageEls();
    const to = bookIdx + dir;
    if (to < 0 || to >= els.length) { bounceBook(dir); return; }
    flipping = true;
    const cur = els[bookIdx], nxt = els[to];
    const turning = dir > 0 ? cur : nxt;
    const under   = dir > 0 ? nxt : cur;
    const ms = _reduce() ? 260 : FLIP_MS;

    clearFlipPaint(turning); clearFlipPaint(under);
    under.classList.add("is-live", "is-show", "is-under");
    turning.classList.add("is-live", "is-show", "is-top");
    const toInner = (dir > 0 ? nxt : cur).querySelector(".page-inner");
    if (toInner) toInner.scrollTop = 0;
    $("#book-track").classList.add("flipping");

    turning.style.setProperty("--fms", ms + "ms");
    under.style.setProperty("--fms", ms + "ms");
    void turning.offsetWidth;
    turning.classList.add(dir > 0 ? "flip-next" : "flip-prev");
    under.classList.add(dir > 0 ? "cast-out" : "cast-in");
    sound.page();

    let done = false;
    const fin = () => {
      if (done) return; done = true;
      turning.removeEventListener("animationend", fin);
      clearTimeout(tmo);
      finishFlip(to);
    };
    turning.addEventListener("animationend", fin);
    const tmo = setTimeout(fin, ms + 260);
  }

  /* めくり おわりの かたづけ。
     ・まず あたらしい ページを おもてに する（この フレームで きりかわる）
     ・ならべて おく ページの いれかえ（display の きりかえ）は あとまわし
       …こうしないと、めくった すぐ あとに おもい フレームが きて チカッと する */
  function finishFlip(to) {
    showBookPage(to, { keepScroll: true, keepLive: true });
    requestAnimationFrame(() => {
      $("#book-track").classList.remove("flipping");
      flipping = false;
      clearTimeout(finishFlip._t);
      finishFlip._t = setTimeout(() => {
        if (flipping) return;
        pageEls().forEach((el, k) => {
          if (Math.abs(k - bookIdx) <= 1) el.classList.add("is-live");
          else el.classList.remove("is-live");
        });
      }, 280);
    });
  }

  // はじ の ページで めくろうと した ときの ちいさな はねかえり
  function bounceBook(dir) {
    const el = pageEls()[bookIdx];
    if (!el) return;
    el.style.transition = "transform .16s ease-out";
    el.style.transform = `rotateY(${dir > 0 ? -8 : 8}deg)`;
    setTimeout(() => {
      el.style.transform = "rotateY(0deg)";
      setTimeout(() => { el.style.transition = ""; el.style.transform = ""; }, 200);
    }, 160);
  }

  /* ---- ゆびで ドラッグして めくる ---- */
  function wireBookDrag() {
    const stage = $("#book-stage");
    let sx = 0, sy = 0, active = false, decided = false, dir = 0;
    let turning = null, underEl = null, w = 1, moved = 0, pid = null, t0 = 0, onCtrl = false;

    const reset = () => {
      if (pid != null) { try { stage.releasePointerCapture(pid); } catch (e) {} }
      active = false; decided = false; dir = 0; turning = null; underEl = null; pid = null;
    };

    stage.addEventListener("pointerdown", (e) => {
      if (flipping) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.target.closest("input, select, textarea")) return;
      // ボタンの うえからでも めくれる（ただし すこし おおきく うごかしたら）
      onCtrl = !!e.target.closest("button, a");
      sx = e.clientX; sy = e.clientY; active = true; decided = false; moved = 0;
      pid = e.pointerId; t0 = performance.now();
      w = stage.clientWidth || 1;
    });

    stage.addEventListener("pointermove", (e) => {
      if (!active || flipping) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      moved = Math.abs(dx);
      if (!decided) {
        // よこの うごきが たての 1.1ばい を こえたら「めくる」と はんだん
        if (Math.abs(dx) < (onCtrl ? 13 : 6)) return;
        if (Math.abs(dx) < Math.abs(dy) * 0.9) {
          if (Math.abs(dy) > 10) { reset(); }      // たてスクロール なので やめる
          return;
        }
        const els = pageEls();
        dir = dx < 0 ? 1 : -1;
        const to = bookIdx + dir;
        if (to < 0 || to >= els.length) { reset(); return; }
        turning = dir > 0 ? els[bookIdx] : els[to];
        underEl = dir > 0 ? els[to] : els[bookIdx];
        clearFlipPaint(turning); clearFlipPaint(underEl);
        underEl.classList.add("is-live", "is-show", "is-under");
        turning.classList.add("is-live", "is-show", "is-top");
        $("#book-track").classList.add("flipping");
        try { stage.setPointerCapture(e.pointerId); } catch (err) {}
        decided = true;
      }
      const p = Math.max(0, Math.min(1, Math.abs(dx) / w));
      const deg = dir > 0 ? -180 * p : -180 * (1 - p);
      paintFlip(turning, underEl, deg);
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    const end = (e) => {
      if (!active) return;
      const dx = (e.clientX || 0) - sx;
      if (!decided) { reset(); return; }
      const p = Math.min(1, Math.abs(dx) / w);
      const speed = Math.abs(dx) / Math.max(1, performance.now() - t0);   // px/ms
      const go = p > 0.18 || speed > 0.32;     // すこしでも いきおいが あれば めくる
      const el = turning, un = underEl, d = dir, to = bookIdx + dir;
      swallowClick = moved > 10;
      const endDeg = d > 0 ? (go ? -180 : 0) : (go ? 0 : -180);
      const ms = Math.round((_reduce() ? 200 : 380) * Math.max(0.35, 1 - p));
      flipping = true;
      if (go) sound.page();
      // のこりは CSSトランジションで（コンポジタで うごくので なめらか）
      const eased = "cubic-bezier(.22,.61,.36,1)";
      el.style.transition = `transform ${ms}ms ${eased}, opacity ${ms}ms ${eased}`;
      for (const q of [".pg-shade", ".pg-gloss > i"]) {
        const n = el.querySelector(q); if (n) n.style.transition = `opacity ${ms}ms ${eased}, transform ${ms}ms ${eased}`;
      }
      const ca = un && un.querySelector(".pg-cast");
      if (ca) ca.style.transition = `opacity ${ms}ms ${eased}, transform ${ms}ms ${eased}`;
      requestAnimationFrame(() => paintFlip(el, un, endDeg));
      let ended = false;
      const fin = () => {
        if (ended) return; ended = true;
        clearTimeout(tmo);
        el.removeEventListener("transitionend", fin);
        finishFlip(go ? to : bookIdx);
      };
      el.addEventListener("transitionend", fin);
      const tmo = setTimeout(fin, ms + 240);
      reset();
    };
    stage.addEventListener("pointerup", end);
    stage.addEventListener("pointercancel", end);

    // ドラッグの あと、ゆびを はなした ところの ボタンが おされない ように
    stage.addEventListener("click", (e) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.stopPropagation(); e.preventDefault();
    }, true);
  }
  let swallowClick = false;

  function buildPage(g) {
    const ill = illustFor(g.name);
    const meta = categoryMeta(g.category);
    let page = document.createElement("section");
    page.className = "page r" + g.rarity;
    page.dataset.name = g.name;
    page.style.setProperty("--c", ill.color);

    // ★5は ページぜんたいを キラキラ（ホロ）に
    // ホロと キラキラは スクロールしない「かみ」の うえに おく（とちゅうで きれない ように）
    if (g.rarity >= 5) {
      const holo = document.createElement("div");
      holo.className = "page-holo";
      holo.setAttribute("aria-hidden", "true");
      page.appendChild(holo);
    }

    // めくる ときの かげ（この かみ）と、うえの かみから おちる かげ
    const shade = document.createElement("div");
    shade.className = "pg-shade"; shade.setAttribute("aria-hidden", "true");
    page.appendChild(shade);
    const gloss = document.createElement("div");
    gloss.className = "pg-gloss"; gloss.setAttribute("aria-hidden", "true");
    gloss.innerHTML = "<i></i>";
    page.appendChild(gloss);
    const cast = document.createElement("div");
    cast.className = "pg-cast"; cast.setAttribute("aria-hidden", "true");
    page.appendChild(cast);

    // なかみ（ここだけ たてに スクロール する）
    const inner = document.createElement("div");
    inner.className = "page-inner";
    page.appendChild(inner);
    const _pg = page;
    page = inner;   // これいこう appendChild は なかみに はいる

    const cat = document.createElement("div");
    cat.className = "page-cat";
    cat.textContent = `${meta.emoji} ${g.family || meta.label}`;
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
    stHint.textContent = "★を タップで 変(か)えられるよ";
    page.appendChild(stHint);

    // なまえ（＋ しゅうせい）
    const nameRow = document.createElement("div");
    nameRow.className = "page-name-row";
    const h2 = document.createElement("h2");
    h2.className = "page-name"; h2.textContent = g.name;
    const edit = document.createElement("button");
    edit.className = "page-name-edit"; edit.textContent = "✏️"; edit.title = "名前を なおす";
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
      if (!v) { say("名前(なまえ)を 入(い)れてね"); return; }
      if (v === g.name) { renameRow.hidden = true; nameRow.hidden = false; return; }
      await DB.renameGroup(g.name, v);
      // なまえを かえたら、まえの むし（はな）の まめちしきは あわないので けす
      await DB.patchByName(v, Object.assign({ aiCategory: "" }, detailsForName(v, {})));
      Covers.rename(g.name, v);
      await afterChange(v, true);
    });

    if (g.kana) { const k = document.createElement("p"); k.className = "page-kana"; k.textContent = g.kana; page.appendChild(k); }
    if (g.fact) { const f = document.createElement("p"); f.className = "page-fact"; f.textContent = g.fact; page.appendChild(f); }

    // ---- くわしい じょうほう（まめちしき / すみか / そだてかた）----
    page.appendChild(buildInfoBlock(g));

    const mt = document.createElement("p");
    mt.className = "page-meta";
    mt.textContent = `みつけた 回数(かいすう)：${g.count}回(かい) ・ はじめて：${fmtDate(g.firstDate)}`;
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
    gtitle.className = "page-gallery-title"; gtitle.textContent = "📸 撮(と)った 写真(しゃしん)";
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
      cov.title = "この写真をカードの表紙にする";
      cov.addEventListener("click", (e) => { e.stopPropagation(); setCover(g.name, c.date); });
      cell.appendChild(cov);
      const dl = document.createElement("button"); dl.className = "g-save"; dl.textContent = "⬇"; dl.title = "この写真を端末に保存";
      dl.addEventListener("click", (e) => { e.stopPropagation(); downloadCapture(c, g.name); });
      cell.appendChild(dl);
      const del = document.createElement("button"); del.className = "g-del"; del.textContent = "×"; del.title = "消す";
      del.addEventListener("click", (e) => { e.stopPropagation(); confirmDelete(c.id, g.name); });
      cell.appendChild(del);
      const dt = document.createElement("div"); dt.className = "g-date"; dt.textContent = fmtDate(c.date); cell.appendChild(dt);
      gal.appendChild(cell);
    }
    page.appendChild(gal);

    const again = document.createElement("button");
    again.className = "page-again"; again.textContent = "📷 もう一度(いちど) 撮(と)る";
    again.addEventListener("click", () => openPicker("append", g.name));
    page.appendChild(again);

    const del = document.createElement("button");
    del.className = "page-delete"; del.textContent = Zukan.meta.delGroup;
    del.addEventListener("click", () => deleteGroup(g.name));
    page.appendChild(del);

    page = _pg;   // かみ（そと）に もどす
    if (g.rarity >= 4) {
      const sp = document.createElement("div");
      sp.className = "page-sparkles";
      sp.setAttribute("aria-hidden", "true");
      sp.innerHTML = "<span>✨</span><span>⭐</span><span>✨</span><span>💫</span><span>✨</span><span>⭐</span>";
      page.appendChild(sp);
    }

    return page;
  }


  // ---- くわしい じょうほうの ブロック ----
  function buildInfoBlock(g) {
    const hana = Zukan.id === "hana";
    const box = document.createElement("div");
    box.className = "page-info";

    // まめちしき
    if (g.trivia && g.trivia.length) {
      const h = document.createElement("p");
      h.className = "info-head"; h.textContent = "💡 豆知識(まめちしき)";
      box.appendChild(h);
      const ul = document.createElement("ul");
      ul.className = "info-trivia";
      for (const t of g.trivia.slice(0, 4)) {
        const li = document.createElement("li"); li.textContent = t; ul.appendChild(li);
      }
      box.appendChild(ul);
    }

    const rows = [
      [hana ? "🌱 生(は)えて いる 場所(ばしょ)" : "🏠 住(す)んで いる 場所(ばしょ)", g.habitat || g.where],
      [hana ? "🌸 咲(さ)く 季節(きせつ)" : "📅 見(み)られる 季節(きせつ)", g.season],
      ["📏 大(おお)きさ", g.size],
      [hana ? "☀️ 好(す)きな 場所(ばしょ)" : "🍽️ 食(た)べもの", g.food],
      [hana ? "🪴 育(そだ)て方(かた)" : "🧺 飼(か)い方(かた)", g.care],
    ];
    let any = false;
    for (const [label, val] of rows) {
      if (!val) continue;
      any = true;
      const row = document.createElement("div");
      row.className = "info-row";
      const l = document.createElement("span"); l.className = "info-label"; l.textContent = label;
      const v = document.createElement("span"); v.className = "info-val"; v.textContent = val;
      row.appendChild(l); row.appendChild(v);
      box.appendChild(row);
    }

    // AIに くわしく きく ボタン
    const btn = document.createElement("button");
    btn.className = "info-more";
    const enough = (g.trivia && g.trivia.length >= 2) && any;
    btn.textContent = enough ? "🔄 豆知識(まめちしき)を もう一度(いちど) 調(しら)べる" : "🤖 AIに くわしく 聞(き)く";
    btn.addEventListener("click", () => fetchDetails(g.name, btn));
    box.appendChild(btn);

    if (!g.trivia.length && !any) {
      const p = document.createElement("p");
      p.className = "info-empty";
      p.textContent = hana
        ? "まだ くわしい ことが わからないよ。ボタンを 押(お)すと AIが 調(しら)べて くれます。"
        : "まだ くわしい ことが わからないよ。ボタンを 押(お)すと AIが 調(しら)べて くれます。";
      box.insertBefore(p, btn);
    }
    return box;
  }

  // AIに くわしい じょうほうを きいて、その なまえ ぜんぶに かきこむ
  async function fetchDetails(name, btn) {
    const key = Settings.key;
    if (!key) { say("さきに ⚙️設定(せってい)で Gemini の APIキーを 入(い)れてね。"); return; }
    const before = btn.textContent;
    btn.disabled = true;
    btn.textContent = "🔎 AIが 調(しら)べて いるよ…";
    try {
      const d = await Gemini.details(name, key, Settings.model, Zukan.id);
      const patch = {
        family: (d.family || "").trim(),
        trivia: Array.isArray(d.trivia) ? d.trivia.filter(Boolean).slice(0, 4) : [],
        habitat: d.habitat || "",
        season: d.season || "",
        food: d.food || "",
        size: (d.size || "").trim(),
        care: d.care || "",
      };
      if (d.fact) patch.fact = d.fact;
      await DB.patchByName(name, patch);
      await afterChange(name, true);
      sound.blip();
      miniNote("💡 豆知識(まめちしき)が 増(ふ)えたよ！");
    } catch (err) {
      btn.disabled = false;
      btn.textContent = before;
      const m = String(err.message || err);
      if (m.startsWith("QUOTA_DAY")) say("今日(きょう)の AIの 分(ぶん)は 使(つか)いきったみたい。明日(あした)まで 待(ま)ってね。");
      else if (m.startsWith("QUOTA")) say("AIが 混(こ)んで いるみたい。少(すこ)し 待(ま)ってから もう一度(いちど) 押(お)してね。");
      else if (m.startsWith("BAD_KEY")) say("APIキーが 違(ちが)うかも。⚙️設定(せってい)を 確(たし)かめてね。");
      else say("調(しら)べられませんでした 😢\n〔" + m.slice(0, 120) + "〕");
    }
  }

  // カードの ひょうしに する しゃしんを えらぶ
  async function setCover(name, date) {
    const g = groups.get(name);
    if (!g) return;
    // おなじ ★を もう いちど おしたら「いちばん あたらしい しゃしん」に もどす
    Covers.set(name, Covers.get(name) === date ? 0 : date);
    sound.blip();
    await afterChange(name, true);
    miniNote("★ 表紙(ひょうし)の 写真(しゃしん)を 変(か)えたよ！");
  }

  // ★の かずを かえて ほぞん（おなじ なまえ ぜんぶ）
  async function setRarity(name, v) {
    const g = groups.get(name);
    if (!g || g.rarity === v) return;
    try { await DB.patchByName(name, { rarity: v }); }
    catch (e) { console.error(e); say("★を 変(か)えられませんでした"); return; }
    sound.blip();
    if (v === 3) { confetti(3); }
    await afterChange(name, true);
  }

  // むし（なまえ）ごと ぜんぶ けす
  async function deleteGroup(name) {
    const g = groups.get(name);
    if (!g) return;
    if (!ask(`「${name}」を 図鑑(ずかん)から 消(け)しますか？\n（写真(しゃしん) ${g.count}枚(まい)が 消(き)えます。元(もと)に 戻(もど)せません）`)) return;
    $("#loading").hidden = false;
    try {
      for (const c of g.list.slice()) { await DB.remove(c.id); }
    } catch (e) { console.error("delete group:", e); }
    markDeleted(g.list.map((c) => capKey(c)));
    Covers.set(name, 0);
    $("#loading").hidden = true;
    await afterChange(name, true);
  }

  function currentPageName() {
    return flatOrder[Math.min(flatOrder.length - 1, Math.max(0, bookIdx))];
  }
  function updateBookCounter() {
    const total = flatOrder.length;
    $("#book-counter").textContent = total ? `${Math.min(total, bookIdx + 1)} / ${total}` : "";
  }

  function confirmDelete(id, name) {
    if (!ask("この 写真(しゃしん)を 消(け)しても いい？")) return;
    const g = groups.get(name);
    const rec = g && g.list.find((c) => c.id === id);
    if (rec) markDeleted([capKey(rec)]);
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
    catch (err) { say("写真(しゃしん)を 読(よ)みこめなかったよ。"); return; }

    if (pendingMode === "append" && pendingAppendName) {
      const rec = { name: pendingAppendName, ...pickMeta(pendingAppendName), blob, date: Date.now() };
      $("#loading").hidden = false;
      try {
        await DB.add(rec);
      } catch (err) {
        $("#loading").hidden = true;
        console.error("save failed:", err);
        say("保存(ほぞん)できなかったよ 😢\n〔" + errText(err) + "〕");
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
      if (el) el.textContent = `AIが 混(こ)んで いるみたい…${left}秒(びょう) 待(ま)ってね（${attempt}回目(かいめ)）`;
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
    const r = { name: "", kana: "", fact: "", where: "", rarity: 1, category: "", aiName: null, confidence: null,
                family: "", trivia: [], habitat: "", season: "", food: "", size: "", care: "" };
    if (ai && ai.is_creature && ai.name) {
      r.name = ai.name; r.kana = ai.kana || ""; r.fact = ai.fact || ""; r.where = ai.where || "";
      r.rarity = clampR(ai.rarity); r.category = ai.category || ""; r.aiName = ai.name;
      r.confidence = typeof ai.confidence === "number" ? ai.confidence : null;
      r.family = (ai.family || "").trim();
      r.trivia = Array.isArray(ai.trivia) ? ai.trivia.filter(Boolean) : [];
      r.habitat = ai.habitat || ""; r.season = ai.season || ""; r.food = ai.food || ""; r.size = ai.size || ""; r.care = ai.care || "";
    }
    const known = (Zukan.id === "hana") ? matchKnownFlower(r.name) : matchKnown(r.name);
    if (known) {
      r.kana = r.kana || known.kana; r.fact = r.fact || known.fact; r.where = r.where || known.where;
      r.family = r.family || known.family || "";
      if (!r.trivia.length && known.trivia) r.trivia = known.trivia.slice();
      r.habitat = r.habitat || known.habitat || "";
      r.season = r.season || known.season || "";
      r.food = r.food || known.food || "";
      r.size = r.size || known.size || "";
      r.care = r.care || known.care || "";
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
    pendingRarity = rarityFor(r.name, r.rarity);
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
      note.innerHTML = "AIキーが まだ ないよ。名前(なまえ)を 手(て)で 入(い)れてね。<br><span class='r-note-sub'>⚙️設定(せってい)で キーを 入(い)れると 自動(じどう)で 名前(なまえ)が 出(で)ます</span>";
    } else if (err && err.startsWith("BAD_KEY")) {
      note.classList.add("warn"); note.innerHTML = "APIキーが 違(ちが)うかも。⚙️設定(せってい)を 確(たし)かめてね。<br>名前(なまえ)は 手(て)で 入(い)れられます。" + detail(err);
    } else if (err && err.startsWith("QUOTA_DAY")) {
      note.classList.add("warn");
      note.innerHTML = "今日(きょう)の AIの 分(ぶん)は 使(つか)いきったみたい。明日(あした)まで 待(ま)ってね。<br><span class='r-note-sub'>Google 側(がわ)の 1日(にち)の 上限(じょうげん)（無料枠(むりょうわく)）です。名前(なまえ)は 手(て)で 入(い)れられます</span>" + detail(err);
    } else if (err && err.startsWith("QUOTA")) {
      note.classList.add("warn");
      note.innerHTML = "AIが 混(こ)んで いるみたい。少(すこ)し 待(ま)ってから もう一度(いちど) 押(お)してね。<br><span class='r-note-sub'>Google 側(がわ)の「1分(ぷん)あたり」の 上限(じょうげん)です（アプリの 制限(せいげん)では ありません）</span>" + detail(err);
    } else if (err === "NETWORK") {
      note.classList.add("warn"); note.textContent = "ネットに つながらなかったよ。名前(なまえ)を 手(て)で 入(い)れてね。";
    } else if (err) {
      note.classList.add("warn"); note.innerHTML = "AIが 使(つか)えなかったよ。名前(なまえ)を 手(て)で 入(い)れてね。" + detail(err);
    } else if (ai && !ai.is_creature) {
      note.classList.add("warn"); note.textContent = Zukan.meta.notFound;
    } else if (ai) {
      const pct = r.confidence != null ? Math.round(r.confidence * 100) : null;
      note.innerHTML = `🤖 AIの 予想(よそう)：<b>${escapeHtml(r.name)}</b>` + (pct != null ? `（自信(じしん) ${pct}%）` : "") + "<br><span class='r-note-sub'>違(ちが)ったら 名前(なまえ)を 直(なお)してね</span>";
    }
    fillPlaceSelect("");
    $("#result").showModal();
    rubyifyDOM($("#result"));
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

  /* くわしい じょうほうは「なまえが あって いる とき」だけ つかう。
     AIが すいそくした なまえを てで なおした ばあいは、その むしの ものでは ない ので すてる。*/
  function detailsForName(name, r) {
    const known = (Zukan.id === "hana") ? matchKnownFlower(name) : matchKnown(name);
    if (known) {
      return {
        where: known.where || "", family: known.family || "",
        trivia: (known.trivia || []).slice(0, 4),
        habitat: known.habitat || "", season: known.season || "",
        food: known.food || "", size: known.size || "", care: known.care || "",
      };
    }
    const sameAsAi = r.aiName && _norm(name) === _norm(r.aiName);
    if (!sameAsAi) return { where: "", family: "", trivia: [], habitat: "", season: "", food: "", size: "", care: "" };
    return {
      where: r.where || "", family: r.family || "",
      trivia: Array.isArray(r.trivia) ? r.trivia.slice(0, 4) : [],
      habitat: r.habitat || "", season: r.season || "",
      food: r.food || "", size: r.size || "", care: r.care || "",
    };
  }

  /* ★の きめかた（うえから じゅんばんに）
     1) この がめんで てで えらんだ  … それが さいゆうせん
     2) もう ずかんに いる むし      … そのときの ★を そのまま つかう
                                       （てで なおした ★が AIに うわがき されない）
     3) ずかんに ある きまった むし  … きまった ★
     4) AIの すいそく（1〜5）
     5) わからなければ ★1 */
  function rarityFor(name, aiRarity) {
    const g = groups.get(name);
    if (g) return clampR(g.rarity);
    const ill = illustFor(name);
    if (ill.knownId) return clampR(ill.rarity);
    return clampR(aiRarity || 1);
  }

  // なまえを なおしたら、ずかんの むしと あえば レアど表示も こうしん
  function onResultNameInput(name) {
    updateResultIllust(name);
    const r = pendingResolved || {};
    if (rarityTouched) return;   // てで えらんだ ★は そのまま
    pendingRarity = rarityFor(name, r.rarity);
    drawResultStars();
  }

  async function saveResult() {
    const name = $("#r-name-input").value.trim();
    if (!name) { say("名前(なまえ)を 入(い)れてね"); $("#r-name-input").focus(); return; }
    const ill = illustFor(name);
    const r = pendingResolved || {};
    const rec = {
      name,
      kana: ill.kana || ((r.aiName && _norm(name) === _norm(r.aiName)) ? r.kana : "") || "",
      fact: ill.fact || ((r.aiName && _norm(name) === _norm(r.aiName)) ? r.fact : "") || "",
      rarity: clampR(pendingRarity),
      color: ill.color, knownId: ill.knownId,
      category: categorize(name, r.category),
      aiCategory: (r.aiName && name === r.aiName) ? (r.category || "") : "",
      aiName: r.aiName || null,
      confidence: r.confidence != null ? r.confidence : null,
      ...detailsForName(name, r),
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
      say("保存(ほぞん)できなかったよ 😢\n〔" + errText(err) + "〕\nもう一度(いちど)「登録(とうろく)」を 押(お)してね。");
      $("#result").showModal(); // やりなおせる ように もどす
      return;
    }
    try { await reload(); renderProgress(); renderGrid(); renderPlaces(); } catch (e) { console.error("render after save:", e); }
    $("#loading").hidden = true;
    const leveledUp = levelOf(groups.size) > lvBefore;
    if (isNew) celebrate(rec, leveledUp); else miniCheer(rec);
    setTimeout(() => { maybeAutoBackup(); }, 1200);
    if (gdAutoOn() && GDrive.wasSignedIn()) setTimeout(() => syncDrive({ quiet: true }), 2200);
  }

  function errText(err) {
    if (!err) return "不明(ふめい)な エラー";
    if (err.name === "QuotaExceededError") return "スマホの 保存容量(ほぞんようりょう)が いっぱいです";
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
    $("#toast-text").textContent = `${rec.name}を また みつけたね！（${g ? g.count : ""}回目(かいめ)）`;
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
      fanfare(p) { if (!on) return; try { [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.12, 0.5, "triangle", 0.16)); if (clampR(p) >= 4) note(1319, 0.5, 0.7, "triangle", 0.16); if (clampR(p) >= 5) note(1568, 0.62, 0.8, "triangle", 0.16); } catch (e) {} },
      blip() { if (!on) return; try { note(880, 0, 0.16, "triangle", 0.12); note(1175, 0.08, 0.16, "triangle", 0.12); } catch (e) {} },
      // かみを めくる おと（ノイズを フィルターで うごかして「シャラッ」）
      page() {
        if (!on) return;
        try {
          const c = ac(), t = c.currentTime, dur = 0.42;
          const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
          const d = buf.getChannelData(0);
          for (let i = 0; i < d.length; i++) {
            const x = i / d.length;
            // はじめは しずか → まんなかで いちばん おおきく → すっと きえる
            const env = Math.pow(Math.sin(Math.PI * Math.min(1, x * 1.15)), 1.6);
            d[i] = (Math.random() * 2 - 1) * env;
          }
          const src = c.createBufferSource(); src.buffer = buf;
          const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 0.9;
          bp.frequency.setValueAtTime(900, t);
          bp.frequency.exponentialRampToValueAtTime(3800, t + 0.16);
          bp.frequency.exponentialRampToValueAtTime(1100, t + dur);
          const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 480;
          const g = c.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.13, t + 0.05);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          src.connect(bp); bp.connect(hp); hp.connect(g); g.connect(c.destination);
          src.start(t); src.stop(t + dur + 0.02);
          // さいごに かみが「ぱさっ」と おちる ひくい おと
          const o = c.createOscillator(), og = c.createGain();
          o.type = "sine"; o.frequency.setValueAtTime(160, t + 0.3);
          o.frequency.exponentialRampToValueAtTime(70, t + 0.42);
          og.gain.setValueAtTime(0.0001, t + 0.3);
          og.gain.linearRampToValueAtTime(0.05, t + 0.33);
          og.gain.exponentialRampToValueAtTime(0.0001, t + 0.46);
          o.connect(og); og.connect(c.destination);
          o.start(t + 0.3); o.stop(t + 0.5);
        } catch (e) {}
      },
    };
  })();

  // ---- せってい ----
  function openSettings() {
    $("#s-key").value = Settings.key;
    $("#s-model").value = Settings.model;
    $("#s-test-result").textContent = ""; $("#s-test-result").className = "s-test-result";
    $("#s-auto-backup").checked = autoBackupOn();
    refreshGDriveUI();
    $("#settings").showModal();
    rubyifyDOM($("#settings"));
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
    if (!key) { out.textContent = "APIキーを 入(い)れてね"; out.className = "s-test-result warn"; return; }
    out.textContent = "確(たし)かめ中(ちゅう)…"; out.className = "s-test-result";
    try { await Gemini.test(key, model); out.textContent = "✓ 接続(せつぞく)できたよ！"; out.className = "s-test-result ok"; }
    catch (err) { out.textContent = "✕ " + (err.message || "失敗(しっぱい)"); out.className = "s-test-result warn"; }
  }


  // AIに ぜんぶの なかまわけを やりなおして もらう
  async function reclassifyWithAI() {
    const out = $("#s-reclass-result");
    const key = Settings.key;
    if (!key) { out.textContent = "さきに APIキーを 入(い)れてね"; out.className = "s-test-result warn"; rubyifyDOM(out); return; }
    const names = [...groups.keys()];
    if (!names.length) { out.textContent = `まだ ${Zukan.meta.one}が いないよ`; out.className = "s-test-result warn"; rubyifyDOM(out); return; }
    out.textContent = `AIが ${names.length}種類(しゅるい)を 調(しら)べて いるよ…`;
    out.className = "s-test-result";
    rubyifyDOM(out);
    try {
      const map = await Gemini.classifyNames(names, key, Settings.model, Zukan.id);
      let changed = 0;
      for (const name of names) {
        const r = map[name];
        if (!r) continue;
        const g = groups.get(name);
        const before = g ? g.category : "";
        const beforeFam = g ? (g.family || "") : "";
        const patch = {};
        if (r.category) patch.aiCategory = r.category;
        if (r.family) patch.family = r.family;
        if (!Object.keys(patch).length) continue;
        await DB.patchByName(name, patch);
        const after = categorize(name, r.category || "");
        if (after !== before || (r.family || "") !== beforeFam) changed++;
      }
      await reload(); renderProgress(); renderGrid(); renderPlaces();
      out.textContent = changed
        ? `✓ ${changed}種類(しゅるい)の 仲間分(なかまわ)けを 直(なお)したよ！`
        : "✓ ぜんぶ あって たよ！";
      out.className = "s-test-result ok";
      rubyifyDOM(out);
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
    } catch (e) { say("保存(ほぞん)できませんでした"); }
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
      ? "💾 前(まえ)の バックアップから 時間(じかん)が たったよ。タップで 保存(ほぞん)"
      : "💾 大事(だいじ)な 写真(しゃしん)を 守(まも)ろう！ タップで バックアップ";
  }

  // ---- じどう バックアップ ----
  const AUTO_KEY = "mz-auto-backup";   // "0" なら オフ（きほんは オン）
  const SIG_KEY = "mz-backup-sig";     // さいごに ほぞんした データの しるし
  const AUTO_EVERY = 60 * 60 * 1000;   // 1じかんに 1かいまで
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
      miniNote(`💾 自動(じどう)で バックアップしたよ（写真(しゃしん) ${count}枚(まい)）`);
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


  /* ============================================================
     Google ドライブと 同期(どうき)する
     ・meta.json … きろく（なまえ・★・ばしょ・ひょうし・けした もの）
     ・p_〜.jpg  … しゃしん 1まいずつ
     まぜかたは「たしざん」。りょうほうに ある ものは のこす。
     けした ものは meta.json の deleted に のこして、どの 端末でも きえる ように する。
     ============================================================ */
  const GD_META = "meta.json";
  const GD_AUTO_KEY = "mz-gdrive-auto";
  const GD_LAST_KEY = "mz-gdrive-last";
  const DEL_KEY = "mz-deleted";
  const gdAutoOn = () => { try { return localStorage.getItem(GD_AUTO_KEY) !== "0"; } catch (e) { return true; } };
  const capKey = (c) => `${c.col || "mushi"}|${c.name}|${c.date}`;
  const photoName = (c) => `p_${c.col || "mushi"}_${c.date}.jpg`;

  function deletedKeys() { try { return JSON.parse(localStorage.getItem(DEL_KEY) || "[]"); } catch (e) { return []; } }
  function markDeleted(keys) {
    const set = new Set(deletedKeys());
    for (const k of keys) set.add(k);
    // ふえすぎない ように あたらしい 500けん だけ のこす
    try { localStorage.setItem(DEL_KEY, JSON.stringify([...set].slice(-500))); } catch (e) {}
  }

  function gdSay(text, cls) {
    const el = $("#gd-result");
    if (!el) return;
    el.textContent = text;
    el.className = "s-test-result" + (cls ? " " + cls : "");
    rubyifyDOM(el);
  }

  function refreshGDriveUI() {
    const on = GDrive.wasSignedIn() && GDrive.configured();
    const off = $("#gd-off"), onBox = $("#gd-on");
    if (!off || !onBox) return;
    off.hidden = on; onBox.hidden = !on;
    const fold = $("#gd-fold");
    if (fold && on) fold.open = true;   // つかって いる ときは ひらいて おく
    const ci = $("#gd-client"); if (ci && !ci.value) ci.value = GDrive.clientId;
    const au = $("#gd-auto"); if (au) au.checked = gdAutoOn();
    const st = $("#gd-state");
    if (st) {
      let last = 0;
      try { last = parseInt(localStorage.getItem(GD_LAST_KEY) || "0", 10) || 0; } catch (e) {}
      st.textContent = last ? `✓ ログイン中(ちゅう) ・ さいご の 同期(どうき)：${fmtDate(last)}` : "✓ ログイン中(ちゅう)";
      rubyifyDOM(st);
    }
  }

  let gdSyncing = false;
  async function syncDrive(opts) {
    const quiet = opts && opts.quiet;
    if (gdSyncing) return;
    if (!GDrive.configured()) { if (!quiet) gdSay("さきに クライアントID を 入(い)れてね", "warn"); return; }
    gdSyncing = true;
    if (!quiet) gdSay("☁️ 同期中(どうきちゅう)…");
    try {
      await GDrive.silentSignIn();
      if (!GDrive.signedIn()) await GDrive.signIn();

      const remote = await GDrive.list();
      const metaEntry = remote.get(GD_META);
      const meta = metaEntry ? (await GDrive.downloadJSON(metaEntry.id)) : null;

      // ---- けした ものの リスト（ローカル＋クラウド）----
      const gone = new Set(deletedKeys());
      for (const k of (meta && meta.deleted) || []) gone.add(k);

      // ---- いまの ローカル ----
      let localRows = await DB.getAllRaw();
      const localMap = new Map(localRows.map((r) => [capKey(r), r]));

      // ---- クラウド → こちら（ないものを もらう）----
      let got = 0;
      for (const rc of (meta && meta.captures) || []) {
        const k = capKey(rc);
        if (gone.has(k) || localMap.has(k)) continue;
        const f = remote.get(rc.photo || photoName(rc));
        if (!f) continue;
        const blob = await GDrive.download(f.id);
        const rec = Object.assign({}, rc);
        delete rec.photo; delete rec.id;
        rec.blob = blob;
        await DB.add(rec);
        localMap.set(k, rec);
        got++;
      }

      // ---- けした ものを こちらからも 消(け)す ----
      let removed = 0;
      for (const r of localRows) {
        if (gone.has(capKey(r))) { try { await DB.remove(r.id); removed++; } catch (e) {} }
      }

      // ---- ばしょ・ひょうし を まぜる ----
      let places = Places.all.slice();
      const byId = new Map(places.map((p) => [p.id, p]));
      for (const rp of (meta && meta.places) || []) {
        const cur = byId.get(rp.id);
        if (!cur) { places.push(rp); byId.set(rp.id, rp); }
        else if ((rp.last || 0) > (cur.last || 0)) Object.assign(cur, rp);
      }
      Places.all = places;
      const covers = Object.assign({}, (meta && meta.covers) || {}, Covers.all);
      try { localStorage.setItem("mz-covers", JSON.stringify(covers)); } catch (e) {}

      // ---- こちら → クラウド（ない しゃしんを おくる）----
      localRows = (await DB.getAllRaw()).filter((r) => !gone.has(capKey(r)));
      let put = 0;
      for (const r of localRows) {
        const nm = photoName(r);
        if (remote.has(nm)) continue;
        let blob = r.blob;
        if (!blob && r.imgData) blob = dataURLToBlob(r.imgData);
        if (!blob) continue;
        await GDrive.upload(nm, blob, blob.type || "image/jpeg");
        remote.set(nm, { id: "new" });
        put++;
      }

      // ---- meta.json を かきなおす ----
      const caps = localRows.map((r) => {
        const o = Object.assign({}, r);
        delete o.blob; delete o.img; delete o.imgData; delete o.id;
        o.col = o.col || "mushi";
        o.photo = photoName(r);
        return o;
      });
      const nextMeta = {
        app: "mushizukan", v: 1, updatedAt: Date.now(),
        captures: caps, places: Places.all, covers, deleted: [...gone].slice(-500),
      };
      const blob = new Blob([JSON.stringify(nextMeta)], { type: "application/json" });
      await GDrive.upload(GD_META, blob, "application/json", metaEntry ? metaEntry.id : null);

      try { localStorage.setItem(GD_LAST_KEY, String(Date.now())); } catch (e) {}
      if (got || removed) { await reload(); renderProgress(); renderGrid(); renderPlaces(); }
      refreshGDriveUI();
      const msg = `✓ 同期(どうき)できたよ！（もらった ${got}まい・送(おく)った ${put}まい）`;
      if (quiet) { if (got || put) miniNote("☁️ ドライブと 同期(どうき)したよ"); }
      else gdSay(msg, "ok");
    } catch (err) {
      console.warn("drive sync:", err);
      const m = String((err && err.message) || err);
      if (!quiet) {
        if (m === "NEED_SIGNIN" || m === "AUTH_TIMEOUT") gdSay("✕ ログインが 必要(ひつよう)です。もう一度(いちど) おしてね", "warn");
        else if (m === "NO_CLIENT_ID") gdSay("✕ クライアントID を 入(い)れてね", "warn");
        else if (m === "NO_GIS") gdSay("✕ ネットに つながらないと ログインできません", "warn");
        else gdSay("✕ " + m.slice(0, 120), "warn");
      }
    } finally {
      gdSyncing = false;
    }
  }

  // ============ バックアップ（ほぞん / もどす）============
  function blobToDataURL(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(new Error("読みこみ失敗"));
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
    out.textContent = "バックアップを 作(つく)って いるよ…"; out.className = "s-test-result";
    try {
      const { blob, count, sig } = await buildBackup();
      downloadBlob(blob, backupFileName());
      markBackedUp(sig);
      out.textContent = `✓ ${count}枚(まい)の 写真(しゃしん)を 保存(ほぞん)したよ！`;
      out.className = "s-test-result ok";
    } catch (err) {
      console.error(err);
      out.textContent = "✕ " + (err.message || "できませんでした");
      out.className = "s-test-result warn";
    }
  }

  /* バックアップを ほかの アプリへ わたす（Google ドライブ・LINE・メール など）。
     スマホなら 1タップで クラウドに あずけられる ので、機種変更(きしゅへんこう)の ときに らく。*/
  function canShareFiles() {
    try {
      if (!navigator.canShare || !navigator.share) return false;
      const f = new File(["{}"], "t.json", { type: "application/json" });
      return navigator.canShare({ files: [f] });
    } catch (e) { return false; }
  }

  async function shareBackup() {
    const out = $("#s-backup-result");
    out.textContent = "バックアップを 作(つく)って いるよ…"; out.className = "s-test-result"; rubyifyDOM(out);
    try {
      const { blob, count, sig } = await buildBackup();
      const file = new File([blob], backupFileName(), { type: "application/json" });
      if (canShareFiles()) {
        await navigator.share({ files: [file], title: "むしずかんの バックアップ" });
        markBackedUp(sig);
        out.textContent = `✓ ${count}枚(まい)の 写真(しゃしん)を 送(おく)ったよ！`;
        out.className = "s-test-result ok";
      } else {
        downloadBlob(blob, backupFileName());
        markBackedUp(sig);
        out.textContent = `✓ ${count}枚(まい)を この 端末(たんまつ)に 保存(ほぞん)したよ`;
        out.className = "s-test-result ok";
      }
      rubyifyDOM(out);
    } catch (err) {
      if (err && (err.name === "AbortError" || err.name === "NotAllowedError")) { out.textContent = ""; return; }
      console.error(err);
      out.textContent = "✕ " + ((err && err.message) || "できませんでした");
      out.className = "s-test-result warn";
    }
  }

  async function importBackup(file) {
    const out = $("#s-backup-result");
    out.textContent = "読(よ)みこんで いるよ…"; out.className = "s-test-result";
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
      out.textContent = `✓ 写真(しゃしん) ${added}枚(まい)・場所(ばしょ) ${addedPlaces}か所(しょ)を 戻(もど)したよ！`;
      out.className = "s-test-result ok";
      if (added) { sound.fanfare(2); confetti(2); }
    } catch (err) {
      console.error(err);
      out.textContent = "✕ " + (err.message || "戻(もど)せませんでした");
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
    wireBookDrag();

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
    $("#gd-client").addEventListener("change", (e) => { GDrive.clientId = e.target.value; refreshGDriveUI(); });
    $("#gd-signin").addEventListener("click", async () => {
      const v = $("#gd-client").value.trim();
      if (v) GDrive.clientId = v;
      if (!GDrive.configured()) { gdSay("さきに クライアントID を 入(い)れてね", "warn"); return; }
      gdSay("Google の ログイン がめんを ひらきます…");
      try { await GDrive.signIn(); refreshGDriveUI(); await syncDrive(); }
      catch (err) { gdSay("✕ ログインできませんでした（" + String(err.message || err).slice(0, 60) + "）", "warn"); }
    });
    $("#gd-sync").addEventListener("click", () => syncDrive());
    $("#gd-signout").addEventListener("click", () => {
      GDrive.signOut(); refreshGDriveUI();
      gdSay("ログアウトしました。しゃしんは この 端末(たんまつ)に のこって います。");
    });
    $("#gd-auto").addEventListener("change", (e) => {
      try { localStorage.setItem(GD_AUTO_KEY, e.target.checked ? "1" : "0"); } catch (err) {}
    });
    if (canShareFiles()) $("#s-share").hidden = false;
    $("#s-share").addEventListener("click", shareBackup);
    $("#s-export").addEventListener("click", exportBackup);
    $("#backup-hint").addEventListener("click", exportBackup);
    $("#s-import").addEventListener("click", () => $("#s-import-file").click());
    $("#s-import-file").addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (f) importBackup(f);
    });
    $("#s-update").addEventListener("click", forceUpdate);
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
    if (!ask("ぜんぶの 記録(きろく)（写真(しゃしん)）を 消(け)して 最初(さいしょ)から やり直(なお)しますか？\n元(もと)に 戻(もど)せません。")) return;
    location.href = location.pathname + "?reset=" + Date.now();
  }


  /* ============================================================
     アプリを あたらしく する しくみ
     ・サービスワーカーの ファイルは かならず ネットから たしかめる
     ・あたらしい ものが つかえるように なったら、じどうで よみこみ なおす
       （なにか さぎょう中の ときは、おわるまで まつ）
     ============================================================ */
  let swReg = null;
  let updateReady = false;

  function busyNow() {
    if ($$("dialog[open]").length) return true;
    if (!$("#book").hidden) return true;
    if (!$("#thinking").hidden) return true;
    if (!$("#loading").hidden) return true;
    if (!$("#picker").hidden) return true;
    return false;
  }

  function reloadWhenFree() {
    if (!busyNow()) { location.reload(); return; }
    clearInterval(reloadWhenFree._t);
    reloadWhenFree._t = setInterval(() => {
      if (!busyNow()) { clearInterval(reloadWhenFree._t); location.reload(); }
    }, 1500);
  }

  async function setupUpdater() {
    if (!("serviceWorker" in navigator)) return;
    // あたらしい ばんに かわったら よみこみ なおす（1かいだけ）
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      updateReady = true;
      reloadWhenFree();
    });
    try {
      swReg = await navigator.serviceWorker.register("./service-worker.js", { updateViaCache: "none" });
    } catch (e) { return; }
    // ひらいた とき・もどってきた ときに、あたらしい ばんが ないか みる
    const check = () => { try { swReg && swReg.update(); } catch (e) {} };
    setTimeout(check, 1200);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
    window.addEventListener("online", check);
  }

  // せってい の「さいしんに する」
  async function forceUpdate() {
    const out = $("#s-update-result");
    if (out) { out.textContent = "たしかめて いるよ…"; out.className = "s-test-result"; rubyifyDOM(out); }
    try {
      if (swReg) {
        await swReg.update();
        if (swReg.waiting) swReg.waiting.postMessage("skip-waiting");
      }
    } catch (e) {}
    setTimeout(() => location.reload(), 900);
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
      $("#progress-msg").textContent = "データを リセット中(ちゅう)…";
      try { await DB.reset(); } catch (e) { console.error("reset:", e); }
      location.replace(location.pathname); // きれいな URLで ひらきなおし
      return;
    }

    renderPlaces();
    try {
      await migrateRarity5();
      await reload();
      renderProgress();
      renderGrid();
    } catch (e) {
      console.error("load failed:", e);
      $("#progress-msg").textContent = "データを 読(よ)みこめませんでした 😢";
      try { renderGrid(); } catch (_) {}
      setTimeout(() => {
        if (ask(
          "データを 読(よ)みこめませんでした 😢\n〔" + errText(e) + "〕\n\n" +
          "データを リセットして 直(なお)しますか？\n（これまでの 写真(しゃしん)は 消(き)えますが、また 集(あつ)められます）"
        )) {
          location.href = location.pathname + "?reset=" + Date.now();
        }
      }, 150);
    }
    rubyAll();
    startRubyWatch();
    // まえに ログイン して いれば、そっと つないで 同期(どうき)する
    if (GDrive.configured() && GDrive.wasSignedIn()) {
      setTimeout(async () => {
        if (await GDrive.silentSignIn()) { refreshGDriveUI(); if (gdAutoOn()) syncDrive({ quiet: true }); }
      }, 1500);
    }
    setupUpdater();
    // データが かってに けされにくく なるように おねがいする
    try { navigator.storage && navigator.storage.persist && navigator.storage.persist().catch(() => {}); } catch (e) {}
  }
  start();
})();
