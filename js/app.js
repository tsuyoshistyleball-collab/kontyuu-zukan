/* むしずかん — メイン（しゃしん → AIすいそく → カテゴリーわけ → ずかん） */
(() => {
  "use strict";

  const APP_VERSION = "v94";

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
  const MAX_SHOTS = 3;        // AIに わたす しゃしんは さいだい 3まい
  let pendingShots = [];      // いま しらべて いる しゃしん たち
  let pendingResolved = null;
  let pendingRarity = 1;      // とうろく画面で えらんだ ★の かず
  let rarityTouched = false;  // てで かえたら AIの すいそくで うわがきしない
  let pendingStats = null;    // ★を いじった あとの つよさ（とうろく画面）

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


  /* ============================================================
     たたかいの すうじ（こうげき・しゅび・じゃんけん）
     ・AIが きめた すうじを 100〜900 の 10きざみに ならす
     ・AIが こたえられなかった ときは、なまえから きまった すうじを つくる
       （おなじ なまえなら いつでも おなじ すうじに なる）
     ============================================================ */
  const HANDS = ["グー", "チョキ", "パー"];
  const HAND_EMOJI = { "グー": "✊", "チョキ": "✌️", "パー": "🖐️" };

  const clampPower = (n) => {
    let v = parseInt(n, 10);
    if (!isFinite(v) || v <= 0) return 0;
    v = Math.round(v / 10) * 10;
    return Math.min(900, Math.max(100, v));
  };
  function normHand(h) {
    const t = String(h || "");
    if (/グー|ぐー|グウ|rock|石|いし/i.test(t)) return "グー";
    if (/チョキ|ちょき|scissors|はさみ/i.test(t)) return "チョキ";
    if (/パー|ぱー|paper|かみ/i.test(t)) return "パー";
    return "";
  }
  function nameHash(name) {
    let h = 2166136261;
    const t = String(name || "");
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }
  // なまえと レアどから きまった すうじを つくる（AIが なくても カードが そろう）
  function autoStats(name, rarity) {
    const h = nameHash(name);
    const base = 80 + clampR(rarity) * 110;                 // ★1→190、★5→630
    const atk = clampPower(base + ((h % 15) - 7) * 20);
    const def = clampPower(base - 30 + (((h >> 8) % 15) - 7) * 20);
    return { attack: atk, defense: def, hand: HANDS[(h >> 16) % 3] };
  }
  // カードや ページに はる「たたかいの すうじ」
  function battleRow(g, big) {
    const el = document.createElement("div");
    el.className = "battle" + (big ? " big" : "");
    el.innerHTML =
      `<span class="bt-hand h-${g.hand === "グー" ? "g" : g.hand === "チョキ" ? "c" : "p"}">` +
        `${HAND_EMOJI[g.hand] || "✊"}<b>${escapeHtml(g.hand || "")}</b></span>` +
      `<span class="bt-atk">⚔️<b>${g.attack}</b></span>` +
      `<span class="bt-def">🛡️<b>${g.defense}</b></span>`;
    return el;
  }

  /* ひっさつわざ。AIが つけて くれれば それを、なければ 名前から つくる。*/
  const MOVE_KINDS = ["きり", "ほのお", "かみなり", "かぜ", "こおり", "どく", "ひかり", "しょうげき", "いわ"];
  const MOVE_KIND_EN = { "きり": "kiri", "ほのお": "honoo", "かみなり": "kaminari", "かぜ": "kaze",
                         "こおり": "koori", "どく": "doku", "ひかり": "hikari", "しょうげき": "shougeki", "いわ": "iwa" };
  const MOVE_COLOR = { "きり": "#ffe14d", "ほのお": "#ff7a2f", "かみなり": "#ffe64a", "かぜ": "#8ef0c8",
                       "こおり": "#8fdcff", "どく": "#c07df0", "ひかり": "#fff2a8", "しょうげき": "#ffd36b", "いわ": "#d8a86a" };
  const MOVE_TAIL = ["アタック", "クラッシュ", "スラッシュ", "ストーム", "ブレイク", "スパーク", "ダイブ", "キック"];
  function normKind(k) {
    const t = String(k || "").trim();
    if (MOVE_KINDS.includes(t)) return t;
    const map = { "斬": "きり", "切": "きり", "炎": "ほのお", "火": "ほのお", "雷": "かみなり", "風": "かぜ",
                  "氷": "こおり", "毒": "どく", "光": "ひかり", "衝撃": "しょうげき", "岩": "いわ" };
    for (const key in map) if (t.indexOf(key) >= 0) return map[key];
    return "";
  }
  const okColor = (c) => (/^#[0-9a-fA-F]{6}$/.test(String(c || "").trim()) ? String(c).trim() : "");
  function autoMove(name, rarity) {
    const h = nameHash(name);
    const kind = MOVE_KINDS[h % MOVE_KINDS.length];
    const head = plain(name).replace(/[^\u3040-\u30FF\u4E00-\u9FFFa-zA-Z]/g, "").slice(0, 4) || "むし";
    return {
      move: head + MOVE_TAIL[(h >> 5) % MOVE_TAIL.length],
      moveKind: kind,
      moveColor: MOVE_COLOR[kind],
      moveCry: "",
    };
  }
  function moveFor(name, rarity, src) {
    const auto = autoMove(name, rarity);
    const nm = String((src && src.move) || (src && src.move_name) || "").trim().slice(0, 14);
    const kind = normKind((src && src.moveKind) || (src && src.move_kind));
    const col = okColor((src && src.moveColor) || (src && src.move_color));
    const cry = String((src && src.moveCry) || (src && src.move_cry) || "").trim().slice(0, 40);
    return {
      move: nm || auto.move,
      moveKind: kind || auto.moveKind,
      moveColor: col || MOVE_COLOR[kind] || auto.moveColor,
      moveCry: cry,
    };
  }

  /* ★が かわったら つよさも かわる。
     ★1=190 → ★5=630 を めやすに、いまの つよさを そのまま のばす／ちぢめる。*/
  const rarBase = (r) => 80 + clampR(r) * 110;
  function scaleStats(st, fromR, toR) {
    const f = rarBase(toR) / rarBase(fromR);
    return {
      attack: clampPower(Math.round((st.attack || 0) * f)),
      defense: clampPower(Math.round((st.defense || 0) * f)),
      hand: st.hand,
    };
  }

  function statsFor(name, rarity, src) {
    const a = clampPower(src && src.attack);
    const d = clampPower(src && src.defense);
    const hd = normHand(src && src.hand);
    if (a && d && hd) return { attack: a, defense: d, hand: hd };
    const auto = autoStats(name, rarity);
    return { attack: a || auto.attack, defense: d || auto.defense, hand: hd || auto.hand };
  }

  function illustFor(name) {
    const hana = Zukan.id === "hana";
    const k = hana ? matchKnownFlower(name) : matchKnown(name);
    const gen = hana ? GENERIC_FLOWER : GENERIC_BUG;
    return k
      ? { svg: k.svg, color: k.color, knownId: k.id, kana: k.kana, fact: k.fact, where: k.where, rarity: k.stars,
          family: k.family || "", trivia: k.trivia || [], habitat: k.habitat || "", season: k.season || "", food: k.food || "", size: k.size || "", care: k.care || "",
          attack: k.attack || 0, defense: k.defense || 0, hand: k.hand || "",
          move: k.move || "", moveKind: k.moveKind || "", moveColor: k.moveColor || "", moveCry: k.moveCry || "" }
      : { svg: gen.svg, color: gen.color, knownId: null, kana: "", fact: "", where: "", rarity: 1,
          family: "", trivia: [], habitat: "", season: "", food: "", size: "", care: "",
          attack: 0, defense: 0, hand: "", move: "", moveKind: "", moveColor: "", moveCry: "" };
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
  let rescued = false;         // 「ほぞん場所さがし」は 1かいだけ
  async function reload() {
    captures = await DB.getAll();
    /* からっぽに 見える ときは、もう いっぽうの ほぞん場所を さがす。
       （電波や たんまつの ちょうしで 一時的に よみこめない ことが ある）*/
    if (!captures.length && !rescued) {
      rescued = true;
      try { if (await DB.rescue()) captures = await DB.getAll(); } catch (e) {}
    }
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
      const st = statsFor(g.name, g.rarity, { attack: pick("attack"), defense: pick("defense"), hand: pick("hand") });
      g.attack = st.attack; g.defense = st.defense; g.hand = st.hand;
      const mv = moveFor(g.name, g.rarity, { move: pick("move"), moveKind: pick("moveKind"), moveColor: pick("moveColor"), moveCry: pick("moveCry") });
      g.move = mv.move; g.moveKind = mv.moveKind; g.moveColor = mv.moveColor; g.moveCry = mv.moveCry;
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
    $("#arena-open").hidden = n === 0;
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

  let placeThenSelect = false;      // ばしょを ほぞんしたら、むしの がめんで えらぶ
  function openPlaceModal(id, opts) {
    placeThenSelect = !!(opts && opts.fromResult);
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
    if (opts && opts.here) setTimeout(() => useCurrentPlace(), 120);   // すぐ 現在地を しらべる
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
      let revName = "";
      try {
        const r = await Geo.reverse(fix.lat, fix.lng);
        placeAddress = r.address;
        revName = r.name || "";
        $("#pl-address").textContent = "📍 " + r.address;
        if (!$("#pl-name").value.trim()) $("#pl-name").value = revName.slice(0, 20);
        msg.textContent = "✓ 今(いま)の 場所(ばしょ)が わかったよ！ 近(ちか)くを さがして いるよ…";
      } catch (e) {
        $("#pl-address").textContent = `📍 ${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}`;
        msg.textContent = "✓ 位置(いち)を 記録(きろく)したよ。近(ちか)くを さがして いるよ…";
      }
      msg.className = "pl-search-msg ok";
      rubyifyDOM(msg);

      // ちかくの こうえん・もり などを こうほに だす
      try {
        const rows = await Geo.nearby(fix.lat, fix.lng);
        if (rows.length) {
          showPlaceCandidates(rows);
          msg.textContent = "📍 近(ちか)くの 場所(ばしょ)だよ。タップして 選(えら)んでね";
          msg.className = "pl-search-msg ok";
        } else {
          msg.textContent = "✓ 今(いま)の 場所(ばしょ)を 記録(きろく)したよ（近(ちか)くに 名前(なまえ)の ある 場所(ばしょ)は なかったよ）";
        }
      } catch (e) {
        msg.textContent = revName
          ? "✓ 今(いま)の 場所(ばしょ)が わかったよ！"
          : "✓ 位置(いち)を 記録(きろく)したよ（名前(なまえ)は 手(て)で 入(い)れてね）";
      }
      rubyifyDOM(msg);
    } catch (err) {
      msg.textContent = "✕ " + (err.message || "位置(いち)が わかりませんでした");
      msg.className = "pl-search-msg warn";
    }
  }

  /* ばしょの こうほを ボタンで ならべる（けんさく けっか／ちかくの ばしょ）*/
  function showPlaceCandidates(rows) {
    const box = $("#pl-results");
    box.innerHTML = "";
    for (const r of rows) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "pl-result";
      const sub = r.dist != null ? `${r.address}・ここから ${r.dist}m` : r.address;
      b.innerHTML = `<b>${r.emoji ? r.emoji + " " : ""}${escapeHtml(r.name)}</b><span>${escapeHtml(sub)}</span>`;
      b.addEventListener("click", () => {
        placeCoord = { lat: r.lat, lng: r.lng };
        placeAddress = r.address || placeAddress;
        $("#pl-name").value = r.name.slice(0, 20);
        if (r.emoji && PLACE_EMOJI.includes(r.emoji)) {
          placeEmoji = r.emoji;
          $$("#pl-emoji .pl-emoji").forEach((x) => x.classList.toggle("active", x.textContent === r.emoji));
        }
        $("#pl-address").textContent = "📍 " + (r.address || r.name);
        box.innerHTML = "";
        const msg = $("#pl-search-msg");
        msg.textContent = "✓ 場所(ばしょ)を 選(えら)んだよ！"; msg.className = "pl-search-msg ok";
        updatePlaceMap();
        rubyifyDOM($("#place-modal"));
        sound.blip();
      });
      box.appendChild(b);
    }
    rubyifyDOM(box);
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
      showPlaceCandidates(rows);
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
    const newId = placeEditingId || ("p" + now);
    try { Places.all = all; } catch (e) { return; }
    $("#place-modal").close();
    renderPlaces();
    if (!placeEditingId) { sound.blip(); confetti(1); }
    // むしの とうろく画面から ひらいた ときは、その ばしょを えらんで おく
    if (placeThenSelect) {
      placeThenSelect = false;
      fillPlaceSelect(newId);
      $("#r-place").value = newId;
      miniNote("🗺️ 場所(ばしょ)を 登録(とうろく)して えらんだよ！");
    }
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

  // ★5だけの にじいろオーラと、ななめに はしる ひかり
  function addR5Deco(el) {
    const aura = document.createElement("span");
    aura.className = "r5-aura"; aura.setAttribute("aria-hidden", "true");
    const shine = document.createElement("span");
    shine.className = "r5-shine"; shine.setAttribute("aria-hidden", "true");
    el.appendChild(aura); el.appendChild(shine);
  }

  function buildCard(g) {
    const ill = illustFor(g.name);
    const card = document.createElement("button");
    card.className = "card found r" + g.rarity;
    card.style.setProperty("--c", ill.color);
    card.setAttribute("aria-label", g.name);
    // ★5は カードごとに にじの いろを ずらす＋オーラを つける
    if (g.rarity >= 5) {
      let h = 0; for (let i = 0; i < g.name.length; i++) h += g.name.charCodeAt(i);
      card.style.animationDelay = "-" + ((h % 32) / 10).toFixed(2) + "s";
      addR5Deco(card);
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
    card.appendChild(battleRow(g));

    card.addEventListener("click", () => openBook(g.name));
    return card;
  }


  /* ============================================================
     とうぎじょう（カードで たたかう）
     ・じゃんけんで かった ほうが こうげき
     ・じぶんの カードの とくいわざ（グー/チョキ/パー）を えらぶと つよい
     ・たいりょくは しゅび力から きめる
     ============================================================ */
  const AR_KEY = "mz-arena";
  const arRecord = () => { try { return JSON.parse(localStorage.getItem(AR_KEY) || "{}"); } catch (e) { return {}; } };
  function arSave(rec) { try { localStorage.setItem(AR_KEY, JSON.stringify(rec)); } catch (e) {} }
  const arSleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const arHp = (f) => Math.round((f.defense * 2 + 200) / 10) * 10;
  function arDamage(att, def, boosted) {
    let d = att.attack - Math.round(def.defense / 3);
    if (boosted) d = Math.round(d * 1.6);
    return Math.round(Math.max(60, d) / 10) * 10;
  }
  // じゃんけん： 1=かち 0=あいこ -1=まけ
  function arJudge(a, b) {
    if (a === b) return 0;
    if ((a === "グー" && b === "チョキ") || (a === "チョキ" && b === "パー") || (a === "パー" && b === "グー")) return 1;
    return -1;
  }

  const AR_TEAM = 3;          // 3たい3
  const AR_HEAL_MAX = 2;      // かいふくは じぶんだけ 2かいまで
  let arMyTeam = [], arFoeTeam = [], arMyIdx = 0, arFoeIdx = 0;
  let arMe = null, arFoe = null, arBusy = false, arOver = false;
  let arHeal = AR_HEAL_MAX;
  let arSel = [];             // えらんだ なかま

  function arFighterFromGroup(g) {
    return {
      name: g.name, hand: g.hand, attack: g.attack, defense: g.defense,
      move: g.move, moveKind: g.moveKind, moveColor: g.moveColor, moveCry: g.moveCry,
      rarity: g.rarity, photo: g.cover && g.cover.blob ? urlFor(g.cover.blob) : "",
      svg: illustFor(g.name).svg, wild: false,
    };
  }
  // ずかんに 1しゅるいしか いない ときの「やせいの むし」
  function arWildFighter(exclude) {
    const list = (Zukan.id === "hana" ? FLOWERS : INSECTS).filter((k) => k.name !== exclude);
    const k = list[Math.floor(Math.random() * list.length)] || (Zukan.id === "hana" ? FLOWERS[0] : INSECTS[0]);
    const st = statsFor(k.name, k.stars, k);
    const mv = moveFor(k.name, k.stars, k);
    return { name: k.name, hand: st.hand, attack: st.attack, defense: st.defense,
             move: mv.move, moveKind: mv.moveKind, moveColor: mv.moveColor, moveCry: mv.moveCry,
             rarity: clampR(k.stars), photo: "", svg: k.svg, wild: true };
  }

  // ステージに たつ むし（しゃしん が なければ イラスト）
  function arChHTML(f) {
    return f.photo ? `<img src="${f.photo}" alt="">` : `<span class="svgbox">${f.svg}</span>`;
  }
  function arTeamDots(team, idx) {
    return `<span class="as-team">` +
      team.map((f, i) => `<i class="${f.hp <= 0 ? "dead" : i === idx ? "now" : ""}"></i>`).join("") +
      `</span>`;
  }
  // うえの たいりょく バー
  function arSideHTML(f, team, idx) {
    const pct = Math.max(0, Math.min(100, (f.hp / f.maxHp) * 100));
    const cls = pct <= 20 ? " crit" : pct <= 45 ? " low" : "";
    return (
      `<div class="as-top"><span class="as-name">${escapeHtml(f.name)}${f.wild ? "（やせい）" : ""}</span>` +
        `<span class="as-atk">${HAND_EMOJI[f.hand] || "✊"} ${f.attack}</span></div>` +
      `<div class="as-bar${cls}"><i style="width:${pct}%"></i></div>` +
      `<p class="as-hp"><span>${f.hp} / ${f.maxHp}</span></p>`
    );
  }
  /* たいりょくバーは じわじわ へる（すうじも いっしょに うごく）*/
  function arPaintBars() {
    arPaintSide($("#ar-foe-bar"), arFoe, arFoeTeam, arFoeIdx);
    arPaintSide($("#ar-me-bar"), arMe, arMyTeam, arMyIdx);
    arSyncSideTeams();
  }
  function arPaintSide(box, f, team, idx) {
    // たたかう 子が かわった ときだけ 作りなおす
    if (box.dataset.name !== f.name || !box.firstElementChild) {
      box.innerHTML = arSideHTML(f, team, idx);
      box.dataset.name = f.name;
      box.dataset.hp = String(f.hp);
      rubyifyDOM(box);
      return;
    }
    const from = parseInt(box.dataset.hp, 10);
    box.dataset.hp = String(f.hp);
    if (!isFinite(from) || from === f.hp) return;
    arAnimHp(box, f, from, f.hp);
  }
  // すうじと バーを ゆっくり うごかす
  function arAnimHp(box, f, from, to) {
    const bar = box.querySelector(".as-bar");
    const fill = box.querySelector(".as-bar i");
    const num = box.querySelector(".as-hp span");
    if (!bar || !fill || !num) return;
    const dur = Math.min(900, Math.max(360, Math.abs(to - from) * 1.4));
    if (to < from) {
      bar.classList.remove("hurt"); void bar.offsetWidth; bar.classList.add("hurt");
      setTimeout(() => bar.classList.remove("hurt"), 430);
    }
    cancelAnimationFrame(box._hpRaf || 0);
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      const v = Math.round(from + (to - from) * e);
      const pct = Math.max(0, Math.min(100, (v / f.maxHp) * 100));
      fill.style.width = pct + "%";
      num.textContent = `${v} / ${f.maxHp}`;
      bar.classList.toggle("low", pct <= 45 && pct > 20);
      bar.classList.toggle("crit", pct <= 20);
      if (p < 1) box._hpRaf = requestAnimationFrame(step);
    };
    box._hpRaf = requestAnimationFrame(step);
  }
  // はしっこの もちふだ（チームの のこり）
  function arSideTeamHTML(team, idx, mine) {
    return team.map((f, i) => {
      const cls = `stm${i === idx ? " now" : ""}${f.hp <= 0 ? " dead" : ""}`;
      const inner = `<span class="stm-in">${f.photo ? `<img src="${f.photo}" alt="">` : f.svg}</span>` +
                    (mine ? `<i class="stm-swap"${i === idx || f.hp <= 0 ? " hidden" : ""}>🔄</i>` : "");
      // じぶんの なかまは タップで こうたい できる（ゆびで おしやすい ように おおきめ）
      return mine
        ? `<button type="button" class="${cls}" data-i="${i}" title="${escapeHtml(f.name)}"` +
          `${i === idx || f.hp <= 0 ? " disabled" : ""}>${inner}</button>`
        : `<span class="${cls}" title="${escapeHtml(f.name)}">${inner}</span>`;
    }).join("");
  }
  function arBuildSideTeams() {
    $("#ar-foe-team").innerHTML = arSideTeamHTML(arFoeTeam, arFoeIdx, false);
    $("#ar-me-team").innerHTML = arSideTeamHTML(arMyTeam, arMyIdx, true);
  }
  // クラスだけ つけかえる（しゃしんを よみなおさない）
  function arSyncSideTeams() {
    const pair = [[$("#ar-foe-team"), arFoeTeam, arFoeIdx], [$("#ar-me-team"), arMyTeam, arMyIdx]];
    for (const [box, team, idx] of pair) {
      const items = box ? box.children : [];
      if (items.length !== team.length) { arBuildSideTeams(); return; }
      for (let i = 0; i < team.length; i++) {
        items[i].classList.toggle("now", i === idx);
        items[i].classList.toggle("dead", team[i].hp <= 0);
        if (items[i].tagName === "BUTTON") items[i].disabled = (i === idx || team[i].hp <= 0);
        const mark = items[i].querySelector(".stm-swap");
        if (mark) mark.hidden = (i === idx || team[i].hp <= 0);
      }
    }
  }
  function arPaintFighters() {
    $("#ar-foe").innerHTML = arChHTML(arFoe);
    $("#ar-me").innerHTML = arChHTML(arMe);
  }
  // まんなかに おおきい もじを だす
  function arCenter(text, cls) {
    const el = $("#ar-center");
    // ながい ことばは ちいさめに
    el.className = "ar-center" + (cls ? " " + cls : "") + (String(text).length >= 5 ? " sm" : "");
    el.hidden = false;
    const b = el.querySelector("b");
    b.textContent = text;
    // アニメを かならず さいしょから
    const burst = el.querySelector(".ar-burst");
    for (const n of [b, burst]) { n.style.animation = "none"; void n.offsetWidth; n.style.animation = ""; }
  }
  const arHideCenter = () => { $("#ar-center").hidden = true; };
  // だれが なにを だしたかの ふだ
  function arShowHand(sel, who, hand) {
    const el = $(sel);
    el.innerHTML =
      `<span class="ah-emo hd-${hand === "グー" ? "g" : hand === "チョキ" ? "c" : "p"}"></span>` +
      `<b class="ah-who">${who}</b><b class="ah-nm">${escapeHtml(hand)}</b>`;
    el.style.animation = "none"; void el.offsetWidth; el.style.animation = "";
  }
  // ざんげき（やられた ほうの うえに はしる）
  function arSlash(side, super_, color) {
    const el = $("#ar-slash");
    el.className = "ar-slash " + side + (super_ ? " super" : "");
    el.style.setProperty("--mv", color || "#ffd34d");
    el.innerHTML = "<span></span>".repeat(super_ ? 5 : 3);
    setTimeout(() => { if (el.className.indexOf(side) >= 0) el.innerHTML = ""; }, 700);
  }
  /* ひっさつわざの エフェクト。ぞくせいごとに かたちを かえる。
     つぶ（i）に すきな むきや ずれを もたせて、まいかい すこし ちがう 見た目に。*/
  function arFx(side, kind, color) {
    const el = $("#ar-fx");
    const en = MOVE_KIND_EN[kind] || (/^[a-z]+$/.test(String(kind)) ? String(kind) : "kiri");
    el.className = "ar-fx " + side + " mv-" + en;
    const n = en === "iwa" ? 10 : en === "honoo" || en === "doku" || en === "mizu" ? 14
            : en === "bomb" ? 9 : en === "kaminari" ? 4 : en === "koori" ? 7 : 4;
    let html = "";
    for (let i = 0; i < n; i++) {
      const a = en === "koori" ? -70 + (140 / Math.max(1, n - 1)) * i : Math.round(Math.random() * 360);
      const dx = Math.round((Math.random() - 0.5) * 260);
      const dy = Math.round(-40 - Math.random() * 110);
      html += `<i style="--i:${i};--a:${a};--x:${Math.round((Math.random() - 0.5) * 60)};--dx:${dx};--dy:${dy};--mv:${color}"></i>`;
    }
    el.innerHTML = html;
    setTimeout(() => { if (el.className.indexOf("mv-" + en) >= 0) el.innerHTML = ""; }, 1200);
  }
  function arQuake() {
    const st = $("#ar-stage");
    st.classList.remove("quake"); void st.offsetWidth; st.classList.add("quake");
    setTimeout(() => st.classList.remove("quake"), 700);
  }
  // とくいわざの ため（くらくして、こうげきする ほうが 金いろに ひかる）
  async function arCharge(attEl, att) {
    $("#ar-dim").hidden = false;
    attEl.style.setProperty("--mv", att.moveColor || "#ffd64a");
    attEl.classList.add("charge");
    arCenter(att.move || "とくいわざ！", "super");
    sound.charge();
    if (navigator.vibrate) navigator.vibrate([0, 30, 60, 30, 60, 60]);
    await arSleep(1000);
    arHideCenter();
    $("#ar-dim").hidden = true;
    attEl.classList.remove("charge");
  }
  function arFlash() {
    const el = $("#ar-flash");
    el.classList.remove("on"); void el.offsetWidth; el.classList.add("on");
  }

  function openArena() {
    if (groups.size === 0) return;
    document.body.classList.add("noscroll");
    $("#arena").hidden = false;
    $("#arena").classList.remove("fighting");
    $("#ar-fight").hidden = true;
    $("#ar-pick").hidden = false;
    const rec = arRecord();
    $("#ar-record").textContent = rec.win
      ? `🏆 ${rec.win}かい かった（${rec.play || 0}かい たたかった）`
      : "はじめての たたかい！";
    const list = $("#ar-list");
    list.innerHTML = "";
    for (const nm of flatOrder) {
      const g = groups.get(nm);
      if (!g) continue;
      const b = document.createElement("button");
      b.className = "ar-pickcard r" + g.rarity;
      b.innerHTML =
        `<img src="${urlFor(g.cover.blob)}" alt="">` +
        `<span class="apc-name">${escapeHtml(g.name)}</span>` +
        `<span class="card-stars apc-stars s${clampR(g.rarity)}">${stars(g.rarity)}</span>` +
        `<span class="battle"><span class="bt-hand h-${g.hand === "グー" ? "g" : g.hand === "チョキ" ? "c" : "p"}">` +
        `${HAND_EMOJI[g.hand] || "✊"}</span><span class="bt-atk">⚔️<b>${g.attack}</b></span>` +
        `<span class="bt-def">🛡️<b>${g.defense}</b></span></span>`;
      b.dataset.name = nm;
      b.insertAdjacentHTML("afterbegin", `<span class="apc-no" hidden></span>`);
      if (clampR(g.rarity) >= 5) addR5Deco(b);
      b.addEventListener("click", () => arToggleSel(nm));
      list.appendChild(b);
    }
    arSel = arSel.filter((n) => groups.has(n));
    arSelPaint();
    rubyifyDOM($("#arena"));
  }
  // なかまを えらぶ／やめる
  let arJustAdded = -1;      // いま はいった ばしょ（アニメ用）
  function arToggleSel(nm) {
    const i = arSel.indexOf(nm);
    if (i >= 0) { arSel.splice(i, 1); arJustAdded = -1; }
    else {
      if (arSel.length >= AR_TEAM) arSel.shift();
      arSel.push(nm);
      arJustAdded = arSel.length - 1;
    }
    sound.blip();
    arSelPaint();
  }
  // うえに ならぶ「えらんだ なかま」
  function arTeamPaint() {
    const box = $("#ar-team");
    const slots = Math.max(arSel.length, Math.min(AR_TEAM, groups.size));
    let html = `<p class="ar-team-lead">えらんだ なかま <b>${arSel.length}</b> / ${slots}</p><div class="ar-team-row">`;
    for (let i = 0; i < slots; i++) {
      const nm = arSel[i];
      if (nm) {
        const g = groups.get(nm);
        html += `<button class="ar-slot filled r${g ? g.rarity : 1}${i === arJustAdded ? " pop" : ""}" data-i="${i}">` +
          `<span class="slot-in"><span class="slot-no">${i + 1}</span>` +
          `<img src="${urlFor(g.cover.blob)}" alt="">` +
          `<b class="slot-name">${escapeHtml(nm)}</b>` +
          `<span class="card-stars slot-stars s${g ? clampR(g.rarity) : 1}">${stars(g ? g.rarity : 1)}</span>` +
          `</span></button>`;
      } else {
        html += `<span class="ar-slot empty"><span class="slot-in"><span class="slot-q">？</span></span></span>`;
      }
    }
    html += `</div>`;
    box.innerHTML = html;
    box.classList.toggle("ready", arSel.length >= slots);
    for (const b of $$("#ar-team .ar-slot.filled")) {
      b.addEventListener("click", () => { arSel.splice(+b.dataset.i, 1); arJustAdded = -1; sound.blip(); arSelPaint(); });
    }
    arJustAdded = -1;
  }
  function arSelPaint() {
    for (const b of $$("#ar-list .ar-pickcard")) {
      const i = arSel.indexOf(b.dataset.name);
      b.classList.toggle("on", i >= 0);
      const no = b.querySelector(".apc-no");
      no.textContent = i >= 0 ? String(i + 1) : "";
      no.hidden = i < 0;
    }
    const go = $("#ar-go");
    go.hidden = arSel.length === 0;
    go.textContent = `⚔️ この ${arSel.length}ひきで たたかう！`;
    const left = Math.min(AR_TEAM, groups.size) - arSel.length;
    $(".ar-sub").textContent = arSel.length === 0
      ? "3(さん)びき えらんで チームを つくろう！"
      : left > 0 ? `あと ${left}ひき えらべるよ` : "チーム かんせい！ たたかおう！";
    arTeamPaint();
    rubyifyDOM($("#ar-pick"));
  }
  function closeArena() {
    bgm.stop();
    $("#arena").hidden = true;
    $("#arena").classList.remove("fighting");
    document.body.classList.remove("noscroll");
  }

  function arStart(names) {
    const picked = (Array.isArray(names) ? names : [names]).filter((n) => groups.has(n)).slice(0, AR_TEAM);
    if (!picked.length) return;
    arMyTeam = picked.map((n) => arFighterFromGroup(groups.get(n)));

    // あいての チーム（おなじ かず）。たりない ぶんは やせいの むし
    const pool = flatOrder.filter((n) => groups.has(n)).sort(() => Math.random() - 0.5);
    arFoeTeam = pool.slice(0, picked.length).map((n) => arFighterFromGroup(groups.get(n)));
    while (arFoeTeam.length < picked.length) arFoeTeam.push(arWildFighter(""));

    for (const f of arMyTeam.concat(arFoeTeam)) { f.maxHp = arHp(f); f.hp = f.maxHp; }
    arMyIdx = 0; arFoeIdx = 0; arHeal = AR_HEAL_MAX;
    arMe = arMyTeam[0]; arFoe = arFoeTeam[0];
    arOver = false; arBusy = false;
    bgm.start();
    $("#arena").classList.add("fighting");
    $("#ar-pick").hidden = true;
    $("#ar-fight").hidden = false;
    $("#ar-end").hidden = true;
    $("#ar-hands").hidden = false;
    $("#ar-item-row").hidden = false;
    $("#ar-foe-hand").innerHTML = "";
    $("#ar-me-hand").innerHTML = "";
    $("#ar-msg").textContent = "じゃんけんを えらんでね！";
    arHideCenter();
    $$("#arena .ar-ch").forEach((el) => el.classList.remove("ko", "hit", "lunge", "enter"));
    $("#ar-slash").innerHTML = "";
    $("#ar-fx").innerHTML = "";
    $("#ar-bonus").hidden = true;
    arItemPaint();
    arSwapPaint();
    $("#ar-swap-sheet").hidden = true;
    $$("#ar-hands .ar-hand").forEach((b) => b.classList.toggle("fav", b.dataset.hand === arMe.hand));
    arPaintFighters();
    arBuildSideTeams();
    $("#ar-foe-bar").dataset.name = ""; $("#ar-me-bar").dataset.name = "";
    arPaintBars();
    rubyifyDOM($("#arena"));
    arIntro();                       // とうじょう → HPが たまる
  }

  /* たたかいの はじまり：ふたりが とうじょうして、HPが たまる */
  function arZeroBars() {
    for (const box of [$("#ar-foe-bar"), $("#ar-me-bar")]) {
      const f = box === $("#ar-foe-bar") ? arFoe : arMe;
      box.dataset.hp = "0";
      const fill = box.querySelector(".as-bar i");
      const num = box.querySelector(".as-hp span");
      const bar = box.querySelector(".as-bar");
      if (fill) fill.style.width = "0%";
      if (num) num.textContent = `0 / ${f.maxHp}`;
      if (bar) bar.classList.remove("low", "crit");
    }
  }
  async function arIntro() {
    arBusy = true;
    const foeEl = $("#ar-foe"), meEl = $("#ar-me");
    $("#ar-hands").hidden = true;
    $("#ar-item-row").hidden = true;
    foeEl.classList.add("pre"); meEl.classList.add("pre");
    arZeroBars();
    $("#ar-msg").textContent = "たたかいの じゅんび…";
    await arSleep(350);

    // あいての とうじょう
    foeEl.classList.remove("pre");
    foeEl.classList.remove("enter"); void foeEl.offsetWidth; foeEl.classList.add("enter");
    arCenter(`あいては ${arFoe.name}！`);
    $("#ar-msg").textContent = `${arFoe.name}が あらわれた！`;
    sound.blip();
    if (navigator.vibrate) navigator.vibrate(40);
    await arSleep(1000);

    // じぶんの とうじょう
    meEl.classList.remove("pre");
    meEl.classList.remove("enter"); void meEl.offsetWidth; meEl.classList.add("enter");
    arCenter(`いけっ！ ${arMe.name}！`);
    $("#ar-msg").textContent = `${arMe.name}、しゅつじん！`;
    sound.blip();
    if (navigator.vibrate) navigator.vibrate(40);
    await arSleep(1000);
    arHideCenter();
    foeEl.classList.remove("enter"); meEl.classList.remove("enter");

    // たいりょくが たまる
    $("#ar-msg").textContent = "たいりょく MAX！";
    arPaintBars();
    sound.fill();
    await arSleep(1000);

    // かいし！
    arCenter("しょうぶ かいし！");
    sound.fanfare(3);
    if (navigator.vibrate) navigator.vibrate([0, 60, 40, 60]);
    await arSleep(950);
    arHideCenter();
    $("#ar-hands").hidden = false;
    $("#ar-item-row").hidden = false;
    $("#ar-msg").textContent = "じゃんけんを えらんでね！";
    arBusy = false;
  }

  const AR_CRY = ["ガンガン いくぜ！", "それっ！", "くらえー！", "とりゃー！", "いっけー！"];
  const AR_OW = ["いてっ！", "うわっ…！", "きかないぞ！", "ぐぬぬ…"];
  const AR_BAM = ["ドカッ！", "バシッ！", "ポカッ！", "ガツン！", "ズドン！"];
  const AR_SUPER = ["ドッカーン！", "だいばくはつ！", "とくいわざ！", "ズガーン！"];
  const arPick = (a) => a[Math.floor(Math.random() * a.length)];

  async function arPlay(myHand) {
    if (arBusy || arOver) return;
    arBusy = true;
    const foeHand = HANDS[Math.floor(Math.random() * 3)];
    $("#ar-me-hand").innerHTML = "";
    $("#ar-foe-hand").innerHTML = "";

    // じゃん…けん…ぽん！
    $("#ar-msg").textContent = "しょうぶ！";
    arCenter("ジャン"); sound.blip(); await arSleep(600);
    arCenter("ケン"); sound.blip(); await arSleep(600);
    for (const id of ["#ar-me-hand", "#ar-foe-hand"]) $(id).classList.remove("win", "lose", "tie");
    arShowHand("#ar-me-hand", "じぶん", myHand);
    arShowHand("#ar-foe-hand", "あいて", foeHand);
    arCenter("ポン！"); sound.blip(); await arSleep(1000);
    arHideCenter();

    const r = arJudge(myHand, foeHand);
    if (r === 0) {
      $("#ar-me-hand").classList.add("tie");
      $("#ar-foe-hand").classList.add("tie");
      arCenter("あいこ！");
      $("#ar-msg").textContent = "おなじ だった！ もう一度(いちど)！";
      await arSleep(1100);
      arHideCenter();
      arBusy = false;
      return;
    }
    // じゃんけんの かちまけを はっきり つたえる（かった ての ふだが ひかる）
    const iWin = r === 1;
    $(iWin ? "#ar-me-hand" : "#ar-foe-hand").classList.add("win");
    $(iWin ? "#ar-foe-hand" : "#ar-me-hand").classList.add("lose");
    arCenter(iWin ? "じぶんの かち！" : "あいての かち！", iWin ? "" : "bad");
    $("#ar-msg").textContent = iWin
      ? `${HAND_EMOJI[myHand]}${myHand}の かち！ ${arMe.name}の こうげき！`
      : `あいての ${HAND_EMOJI[foeHand]}${foeHand}の かち。${arFoe.name}の こうげき！`;
    sound.blip();
    await arSleep(1400);
    arHideCenter();
    const att = iWin ? arMe : arFoe;
    const def = iWin ? arFoe : arMe;
    const attEl = iWin ? $("#ar-me") : $("#ar-foe");
    const defEl = iWin ? $("#ar-foe") : $("#ar-me");
    const boosted = iWin ? myHand === arMe.hand : foeHand === arFoe.hand;
    const dmg = arDamage(att, def, boosted);
    def.hp = Math.max(0, def.hp - dmg);

    // つっこむ → ぶつかる
    $("#ar-msg").textContent = boosted
      ? (att.moveCry || `${att.name}の ひっさつわざ！ ${att.move}！`)
      : (iWin ? arPick(AR_CRY) : arPick(AR_OW));
    if (boosted) await arCharge(attEl, att);      // ためて…
    attEl.classList.add("lunge");
    await arSleep(220);
    arFlash();
    const side = iWin ? "foe" : "me";
    if (boosted) arFx(side, att.moveKind, att.moveColor || "#ffd64a");
    arSlash(side, boosted, att.moveColor);
    arCenter(boosted ? (att.move || arPick(AR_SUPER)) : arPick(AR_BAM), boosted ? "super" : "");
    defEl.classList.add("hit");
    sound.hit(boosted);
    if (boosted) { arQuake(); if (iWin) confetti(3); }
    if (navigator.vibrate) navigator.vibrate(boosted ? [0, 160, 40, 120] : iWin ? [0, 40, 30, 40] : [0, 90]);
    await arSleep(boosted ? 520 : 360);
    attEl.classList.remove("lunge");
    defEl.classList.remove("hit");

    // ダメージの すうじ
    arCenter(String(dmg), (iWin ? "dmg" : "dmg bad") + (boosted ? " super" : ""));
    arPaintBars();
    $("#ar-msg").textContent =
      (iWin ? "かった！ " : "やられた… ") + (boosted ? "とくいわざ で " : "") + `${dmg} の ダメージ！`;
    await arSleep(950);
    arHideCenter();

    if (def.hp <= 0) { await arDown(!iWin); return; }
    if (await arMaybeBonus()) return;          // たからばこ（ときどき）
    if (arOver) return;
    $("#ar-msg").textContent = "じゃんけんを えらんでね！";
    arBusy = false;
  }

  /* たおれた ときの こうたい。meDown=true なら じぶんの なかまが たおれた */
  async function arDown(meDown) {
    const team = meDown ? arMyTeam : arFoeTeam;
    const cur = meDown ? arMe : arFoe;
    const downEl = meDown ? $("#ar-me") : $("#ar-foe");
    downEl.classList.remove("hit");
    downEl.classList.add("ko");
    arQuake();
    arCenter("たおれた…", "bad");
    $("#ar-msg").textContent = `${cur.name}は たおれた！`;
    sound.down();
    if (navigator.vibrate) navigator.vibrate([0, 130, 70, 200]);
    await arSleep(1600);
    arHideCenter();

    const rest = team.map((f, i) => i).filter((i) => team[i].hp > 0);
    if (!rest.length) { arFinish(!meDown); return; }

    let idx = rest[0];
    if (meDown) {
      // じぶんの なかまは、だれを だすか えらべる
      if (rest.length > 1) { const c = await arOpenSwap(true); if (c >= 0) idx = c; }
      arMyIdx = idx; arMe = arMyTeam[idx];
    } else { arFoeIdx = idx; arFoe = arFoeTeam[idx]; }
    downEl.classList.remove("ko");
    arPaintFighters();
    arPaintBars();
    arSwapPaint();
    $$("#ar-hands .ar-hand").forEach((b) => b.classList.toggle("fav", b.dataset.hand === arMe.hand));
    const el = meDown ? $("#ar-me") : $("#ar-foe");
    el.classList.remove("enter"); void el.offsetWidth; el.classList.add("enter");
    const next = meDown ? arMe : arFoe;
    arCenter("つぎは…");
    $("#ar-msg").textContent = `つぎは ${next.name}！ いけー！`;
    await arSleep(1300);
    arHideCenter();
    el.classList.remove("enter");
    $("#ar-msg").textContent = "じゃんけんを えらんでね！";
    arBusy = false;
  }

  /* なかまの こうたい */
  let arSwapDone = null;
  const arAlive = () => arMyTeam.map((f, i) => i).filter((i) => arMyTeam[i].hp > 0 && i !== arMyIdx);
  function arSwapPaint() {
    const b = $("#ar-swap");
    b.disabled = arAlive().length === 0 || arOver;
  }
  // つよそうな なかまを えらぶ シート。forced=true なら やめられない
  function arOpenSwap(forced) {
    const list = $("#ar-swap-list");
    list.innerHTML = "";
    for (const i of arAlive()) {
      const f = arMyTeam[i];
      const pct = Math.max(0, (f.hp / f.maxHp) * 100);
      const btn = document.createElement("button");
      btn.className = "ar-swap-item";
      btn.innerHTML =
        (f.photo ? `<img src="${f.photo}" alt="">` : `<span class="sw-svg">${f.svg}</span>`) +
        `<span class="sw-info"><b class="sw-name">${escapeHtml(f.name)}</b>` +
        `<span class="battle"><span class="bt-hand h-${f.hand === "グー" ? "g" : f.hand === "チョキ" ? "c" : "p"}">` +
        `${HAND_EMOJI[f.hand] || "✊"}</span><span class="bt-atk">⚔️<b>${f.attack}</b></span>` +
        `<span class="bt-def">🛡️<b>${f.defense}</b></span></span>` +
        `<span class="sw-bar"><i style="width:${pct}%"></i></span>` +
        `<small class="sw-hp">${f.hp} / ${f.maxHp}</small></span>`;
      btn.addEventListener("click", () => arCloseSwap(i));
      list.appendChild(btn);
    }
    $("#ar-swap-title").textContent = forced ? "つぎは だれで いく？" : "だれと こうたい する？";
    $("#ar-swap-cancel").hidden = !!forced;
    $("#ar-swap-sheet").hidden = false;
    rubyifyDOM($("#ar-swap-sheet"));
    return new Promise((res) => { arSwapDone = res; });
  }
  function arCloseSwap(idx) {
    $("#ar-swap-sheet").hidden = true;
    const done = arSwapDone; arSwapDone = null;
    if (done) done(idx);
  }
  async function arSwapTo(idx, quiet) {
    arMyIdx = idx; arMe = arMyTeam[idx];
    arPaintFighters(); arPaintBars(); arSwapPaint();
    $$("#ar-hands .ar-hand").forEach((b) => b.classList.toggle("fav", b.dataset.hand === arMe.hand));
    const el = $("#ar-me");
    el.classList.remove("enter"); void el.offsetWidth; el.classList.add("enter");
    arCenter("こうたい！");
    $("#ar-msg").textContent = `いけっ！ ${arMe.name}！`;
    sound.blip();
    await arSleep(1200);
    arHideCenter();
    el.classList.remove("enter");
    if (!quiet) $("#ar-msg").textContent = "じゃんけんを えらんでね！";
  }
  async function arSwapBtn() {
    if (arBusy || arOver || !arAlive().length) return;
    arBusy = true;
    const idx = await arOpenSwap(false);
    if (idx >= 0) await arSwapTo(idx);
    arBusy = false;
  }

  /* ============================================================
     たからばこ → ルーレット → とくしゅ こうげき
     ・たたかいの あと、5かいに 1かいくらい たからばこが でる
     ・タップすると ルーレットが まわり、とまった わざで こうげき
     ============================================================ */
  const SPECIALS = [
    { key: "bomb",  icon: "💣", name: "ばくだん", color: "#ff7a2f", mul: 1.9, fx: "bomb", deg: 315,
      cry: "ドッカーン！ ばくだん こうげき！", word: "ドッカーン！" },
    { key: "fire",  icon: "🔥", name: "ほのお",   color: "#ff5a1f", mul: 1.6, fx: "honoo", deg: 45,
      cry: "ゴォォ！ ほのおの こうげき！", word: "ゴォォ！" },
    { key: "sword", icon: "⚔️", name: "けん",     color: "#dfe9ff", mul: 1.7, fx: "kiri", deg: 225,
      cry: "スパッ！ けんの こうげき！", word: "スパーン！" },
    { key: "water", icon: "💧", name: "みず",     color: "#4dc4ff", mul: 1.4, fx: "mizu", deg: 135,
      cry: "ザブーン！ みずの こうげき！", word: "ザブーン！" },
  ];
  const BONUS_RATE = 0.2;            // 5かいに 1かいくらい
  let arChestDone = null;

  // たからばこを だして、タップ（か 6びょう）を まつ
  function arShowChest() {
    $("#ar-bonus").hidden = false;
    $("#ar-chest").hidden = false;
    $("#ar-roul").hidden = true;
    $("#ar-msg").textContent = "たからばこが でた！ タップしてね";
    sound.blip();
    if (navigator.vibrate) navigator.vibrate([0, 30, 60, 30]);
    return new Promise((res) => {
      let done = false;
      const fin = () => { if (!done) { done = true; clearTimeout(t); res(); } };
      arChestDone = fin;
      const t = setTimeout(fin, 6000);
    });
  }
  /* ルーレットを まわす。うえの ▼に とまった ところが わざ。
     わの ならびは 上(うえ)から 時計(とけい)まわりに
     ほのお(45°) → みず(135°) → けん(225°) → ばくだん(315°) */
  async function arSpinRoulette() {
    const win = Math.floor(Math.random() * SPECIALS.length);
    const sp = SPECIALS[win];
    const wheel = $("#ar-wheel");
    $("#ar-chest").hidden = true;
    $("#ar-roul").hidden = false;
    $("#ar-roul").classList.remove("hit");
    $("#ar-roul-msg").textContent = "なにが でるかな…？";
    $("#ar-msg").textContent = "ルーレット！";
    // とまる いち（すこし ばらつかせる）
    const jitter = (Math.random() - 0.5) * 46;
    const deg = 360 * 5 + (360 - sp.deg) + jitter;
    wheel.style.transition = "none";
    wheel.style.transform = "rotate(0deg)";
    void wheel.offsetWidth;
    wheel.style.transition = "transform 3.1s cubic-bezier(.12,.78,.2,1)";
    wheel.style.transform = `rotate(${deg}deg)`;
    for (let i = 0; i < 16; i++) setTimeout(() => sound.blip(), 80 + i * i * 11);
    await arSleep(3300);
    $("#ar-roul").classList.add("hit");
    $("#ar-roul-msg").textContent = `${sp.icon} ${sp.name} が でた！`;
    sound.fanfare(4);
    if (navigator.vibrate) navigator.vibrate([0, 60, 40, 90]);
    await arSleep(1200);
    $("#ar-bonus").hidden = true;
    return sp;
  }
  // とくしゅ こうげき（あいてに おおきな ダメージ）
  async function arSpecialAttack(sp) {
    const dmg = Math.round(Math.max(120, arMe.attack * sp.mul - arFoe.defense / 4) / 10) * 10;
    arFoe.hp = Math.max(0, arFoe.hp - dmg);

    $("#ar-msg").textContent = sp.cry;
    $("#ar-me").classList.add("lunge");
    arCenter(sp.name + "！", "super");
    sound.charge();
    await arSleep(800);
    arHideCenter();

    arFlash();
    arQuake();
    arFx("foe", sp.fx === "kiri" ? "きり" : sp.fx === "honoo" ? "ほのお" : sp.fx, sp.color);
    if (sp.fx === "kiri") arSlash("foe", true, sp.color);
    arCenter(sp.word, "super");
    $("#ar-foe").classList.add("hit");
    sound.special(sp.key);
    confetti(4);
    if (navigator.vibrate) navigator.vibrate([0, 180, 50, 140]);
    await arSleep(700);
    $("#ar-me").classList.remove("lunge");
    $("#ar-foe").classList.remove("hit");

    arCenter(String(dmg), "dmg super");
    arPaintBars();
    $("#ar-msg").textContent = `${sp.name}で ${dmg} の 大(だい)ダメージ！`;
    await arSleep(1100);
    arHideCenter();
    if (arFoe.hp <= 0) { await arDown(false); return true; }
    return false;
  }
  /* 5かいに 1かいくらい たからばこ。おわったら true（けっちゃく が ついた）*/
  async function arMaybeBonus() {
    if (arOver || Math.random() >= BONUS_RATE) return false;
    await arShowChest();
    const sp = await arSpinRoulette();
    return await arSpecialAttack(sp);
  }

  /* かいふく（じぶんだけ・1しあい 2かいまで）*/
  function arItemPaint() {
    const b = $("#ar-item");
    b.disabled = arHeal <= 0 || arOver;
    // つかった ぶんだけ みどりの バーが へる（2かい ぶん）
    b.style.setProperty("--used", String(AR_HEAL_MAX - arHeal));
  }
  async function arUseItem() {
    if (arBusy || arOver || arHeal <= 0) return;
    if (arMe.hp >= arMe.maxHp) { $("#ar-msg").textContent = "げんき いっぱい だよ！"; return; }
    arBusy = true;
    arHeal--;
    const heal = Math.min(arMe.maxHp - arMe.hp, Math.round((arMe.maxHp * 0.4) / 10) * 10);
    arMe.hp += heal;
    arItemPaint();
    arPaintBars();
    arCenter("+" + heal, "heal");
    $("#ar-msg").textContent = `${arMe.name}は げんきに なった！`;
    sound.heal();
    if (navigator.vibrate) navigator.vibrate(30);
    await arSleep(1100);
    arHideCenter();
    $("#ar-msg").textContent = "じゃんけんを えらんでね！";
    arBusy = false;
  }

  function arFinish(iWin) {
    arOver = true; arBusy = false;
    bgm.stop(true);
    const rec = arRecord();
    rec.play = (rec.play || 0) + 1;
    if (iWin) rec.win = (rec.win || 0) + 1;
    rec.byName = rec.byName || {};
    // かった ときは、さいごまで のこった なかま みんなに 1しょう
    if (iWin) for (const f of arMyTeam) { if (f.hp > 0) rec.byName[f.name] = (rec.byName[f.name] || 0) + 1; }
    arSave(rec);
    $("#ar-hands").hidden = true;
    $("#ar-item-row").hidden = true;
    $("#ar-swap-sheet").hidden = true;
    $("#ar-end").hidden = false;
    const alive = arMyTeam.filter((f) => f.hp > 0);
    $("#ar-end-msg").textContent = iWin
      ? `🏆 ${arMe.name}たちの かち！ のこり ${alive.length}ひき！`
      : `${arFoe.name}たちの かち。つぎは がんばろう！`;
    $("#ar-msg").textContent = iWin ? "やったー！" : "うーん、おしい！";
    arCenter(iWin ? "しょうり！" : "まけ…", iWin ? "" : "bad");
    if (iWin) { sound.fanfare(arMe.rarity); confetti(clampR(arMe.rarity)); }
    rubyifyDOM($("#arena"));
  }

  /* ---- 右(みぎ)から でる メニュー ---- */
  let drawerTimer = 0;
  const drawerOpen = () => $("#drawer").classList.contains("open");
  function openDrawer() {
    clearTimeout(drawerTimer);
    const dr = $("#drawer"), bg = $("#drawer-bg");
    dr.hidden = false; bg.hidden = false;
    $("#drawer-ver").textContent = "むしずかん " + APP_VERSION;
    void dr.offsetWidth;                       // アニメを かならず さいしょから
    dr.classList.add("open"); bg.classList.add("open");
    $("#menu-btn").setAttribute("aria-expanded", "true");
    sound.blip();
  }
  function closeDrawer() {
    const dr = $("#drawer"), bg = $("#drawer-bg");
    dr.classList.remove("open"); bg.classList.remove("open");
    $("#menu-btn").setAttribute("aria-expanded", "false");
    clearTimeout(drawerTimer);
    drawerTimer = setTimeout(() => { dr.hidden = true; bg.hidden = true; }, 320);
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
    page.appendChild(battleRow(g, true));

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

    // 🤖 しゃしんを もういちど AIに みてもらう（なまえ＋まめちしき）
    const reask = document.createElement("button");
    reask.className = "page-reask";
    reask.textContent = "🤖 写真(しゃしん)から 名前(なまえ)を 聞(き)きなおす";
    reask.hidden = !(Settings.key && g.cover && g.cover.blob);
    reask.addEventListener("click", () => reAskName(g, reask));
    page.appendChild(reask);

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
    const wins = (arRecord().byName || {})[g.name] || 0;
    mt.textContent = `みつけた 回数(かいすう)：${g.count}回(かい) ・ はじめて：${fmtDate(g.firstDate)}` +
      (wins ? ` ・ 🏆 ${wins}勝(しょう)` : "");
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

  /* AIの こたえ（identify）から、ずかんに かきこむ ないようを つくる。
     なまえも まめちしきも いっしょに あたらしく する。*/
  function patchFromAI(name, ai) {
    const rar = rarityFor(name, ai.rarity);
    return Object.assign({
      name,
      kana: ai.kana || "",
      fact: ai.fact || "",
      where: ai.where || "",
      rarity: rar,
      category: ai.category || "",
      aiCategory: ai.category || "",
      aiName: ai.name || name,
      confidence: typeof ai.confidence === "number" ? ai.confidence : null,
      family: String(ai.family || "").trim(),
      trivia: Array.isArray(ai.trivia) ? ai.trivia.filter(Boolean).slice(0, 4) : [],
      habitat: ai.habitat || "", season: ai.season || "",
      food: ai.food || "", size: ai.size || "", care: ai.care || "",
    }, statsFor(name, rar, ai), moveFor(name, rar, ai));
  }

  /* ずかんの ページから「もういちど AIに みてもらう」。
     なまえが かわったら まめちしきも まとめて 入れかえる。*/
  async function reAskName(g, btn) {
    if (!Settings.key) { say("⚙️設定(せってい)で AIの キーを 入(い)れてね"); return; }
    const blob = g.cover && g.cover.blob;
    if (!blob) { say("写真(しゃしん)が ないよ"); return; }
    const before = btn.textContent;
    btn.disabled = true;
    btn.textContent = "🤖 AIに 聞(き)いて いるよ…";
    rubyifyDOM(btn);
    try {
      const ai = await Gemini.identify(blob, Settings.key, Settings.model, null, Zukan.id);
      if (!ai || !ai.is_creature || !ai.name) {
        say("うまく わからなかったよ 😢\nべつの 写真(しゃしん)で ためしてみてね。");
        return;
      }
      const newName = String(ai.name).trim().slice(0, 24);
      const pct = typeof ai.confidence === "number" ? Math.round(ai.confidence * 100) : null;
      if (newName === g.name) {
        await DB.patchByName(g.name, patchFromAI(g.name, ai));
        await afterChange(g.name, true);
        sound.blip();
        miniNote(`🤖 AIも「${g.name}」だと 言(い)って いるよ！ 豆知識(まめちしき)を 新(あたら)しくしたよ`);
        return;
      }
      const okToChange = ask(
        `AIは この 写真(しゃしん)を「${newName}」だと 思(おも)って いるよ` +
        (pct != null ? `（自信(じしん) ${pct}%）` : "") + "。\n" +
        `「${g.name}」から 変(か)えますか？\n（豆知識(まめちしき)も 新(あたら)しく なります）`);
      if (!okToChange) return;
      await DB.renameGroup(g.name, newName);
      await DB.patchByName(newName, patchFromAI(newName, ai));
      Covers.rename(g.name, newName);
      await afterChange(newName, true);
      sound.blip(); confetti(1);
      miniNote(`🤖 「${newName}」に 直(なお)したよ！`);
    } catch (err) {
      const m = String(err.message || err);
      if (m.startsWith("QUOTA_DAY")) say("今日(きょう)の AIの 分(ぶん)は 使(つか)いきったみたい。明日(あした)まで 待(ま)ってね。");
      else if (m.startsWith("BUSY")) say("いま AIが とても 混(こ)んで います。\n少(すこ)し 待(ま)ってから もう一度(いちど) 押(お)してね。");
      else if (m.startsWith("QUOTA")) say("AIが 混(こ)んで いるみたい。少(すこ)し 待(ま)ってから もう一度(いちど) 押(お)してね。");
      else if (m.startsWith("BAD_KEY")) say("APIキーが 違(ちが)うかも。⚙️設定(せってい)を 確(たし)かめてね。");
      else if (m === "NETWORK") say("ネットに つながらなかったよ。");
      else say("聞(き)けませんでした 😢\n〔" + m.slice(0, 120) + "〕");
    } finally {
      btn.disabled = false;
      btn.textContent = before;
      rubyifyDOM(btn);
    }
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
        ...statsFor(name, (groups.get(name) || {}).rarity, d),
        ...moveFor(name, (groups.get(name) || {}).rarity, d),
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
      else if (m.startsWith("BUSY")) say("いま AIが とても 混(こ)んで います。\n少(すこ)し 待(ま)ってから もう一度(いちど) 押(お)してね。\n（アプリの 制限(せいげん)では ないよ）");
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
    // ★に あわせて こうげき力・しゅび力も 上下(じょうげ)させる
    const st = scaleStats({ attack: g.attack, defense: g.defense, hand: g.hand }, g.rarity, v);
    try { await DB.patchByName(name, { rarity: v, attack: st.attack, defense: st.defense, hand: st.hand }); }
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
    const files = Array.from((e.target.files || [])).slice(0, MAX_SHOTS);
    e.target.value = "";
    if (!files.length) return;
    let blobs = [];
    try {
      for (const f of files) blobs.push(await resizeImage(f, 1024, 0.8));
    } catch (err) { say("写真(しゃしん)を 読(よ)みこめなかったよ。"); return; }
    const blob = blobs[0];

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
    const fromCamera = e.target && e.target.id === "file-camera";
    if (addingShot) {                 // 「写真を たす」から きた とき → すぐ AIへ
      addingShot = false;
      pendingShots = pendingShots.concat(blobs).slice(0, MAX_SHOTS);
      pendingBlob = pendingShots[0];
      await askAI(pendingShots);
      return;
    }
    if (collecting) {                 // カメラで「もう1枚」
      collecting = false;
      pendingShots = pendingShots.concat(blobs).slice(0, MAX_SHOTS);
      pendingBlob = pendingShots[0];
      openShotsSheet();
      return;
    }
    pendingShots = blobs;
    pendingBlob = pendingShots[0];
    if (fromCamera) { openShotsSheet(); return; }   // カメラは「これで 登録する」まで まつ
    await askAI(pendingShots);
  }

  /* カメラで とった あとの かくにん がめん。
     もう1枚 たすか、これで とうろくに すすむかを えらべる。*/
  let collecting = false;
  function openShotsSheet() {
    drawShotsList();
    $("#shots-more").hidden = pendingShots.length >= MAX_SHOTS;
    $("#shots-sheet").hidden = false;
    rubyifyDOM($("#shots-sheet"));
  }
  function closeShotsSheet() { $("#shots-sheet").hidden = true; }
  function drawShotsList() {
    const box = $("#shots-list");
    box.innerHTML = "";
    pendingShots.forEach((b, i) => {
      const cell = document.createElement("div");
      cell.className = "shot-cell" + (i === 0 ? " cover" : "");
      cell.innerHTML = `<img src="${urlFor(b)}" alt="">` +
        (i === 0 ? `<i class="cover-tag">★ 表紙(ひょうし)</i>` : `<i>${i + 1}</i>`);
      // タップした しゃしんを 表紙(ひょうし)に する
      if (i > 0) {
        cell.addEventListener("click", () => {
          const [pick] = pendingShots.splice(i, 1);
          pendingShots.unshift(pick);
          pendingBlob = pendingShots[0];
          drawShotsList();
          sound.blip();
        });
      }
      if (pendingShots.length > 1) {
        const del = document.createElement("button");
        del.type = "button"; del.textContent = "✕"; del.setAttribute("aria-label", "この写真を はずす");
        del.addEventListener("click", (e) => {
          e.stopPropagation();
          pendingShots.splice(i, 1);
          pendingBlob = pendingShots[0];
          drawShotsList();
          $("#shots-more").hidden = pendingShots.length >= MAX_SHOTS;
        });
        cell.appendChild(del);
      }
      box.appendChild(cell);
    });
    rubyifyDOM(box);
  }

  // 「写真(しゃしん)を たして もう一度 きく」を おした あとか
  let addingShot = false;

  // AIに しゃしんを みてもらう（けっか モーダルを ひらく）
  async function askAI(blobOrList) {
    const list = (Array.isArray(blobOrList) ? blobOrList : [blobOrList]).filter(Boolean);
    const main = list[0];
    const key = Settings.key;
    if (!key) { openResult(main, null, "NO_KEY"); return; }
    startThinking(main);
    try {
      const ai = await Gemini.identify(list, key, Settings.model, onAiWait, Zukan.id);
      stopThinking();
      openResult(main, ai, null);
    } catch (err) {
      stopThinking();
      openResult(main, null, String(err.message || err));
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
                family: "", trivia: [], habitat: "", season: "", food: "", size: "", care: "",
          attack: 0, defense: 0, hand: "" };
    if (ai && ai.is_creature && ai.name) {
      r.name = ai.name; r.kana = ai.kana || ""; r.fact = ai.fact || ""; r.where = ai.where || "";
      r.rarity = clampR(ai.rarity); r.category = ai.category || ""; r.aiName = ai.name;
      r.confidence = typeof ai.confidence === "number" ? ai.confidence : null;
      r.family = (ai.family || "").trim();
      r.trivia = Array.isArray(ai.trivia) ? ai.trivia.filter(Boolean) : [];
      r.habitat = ai.habitat || ""; r.season = ai.season || ""; r.food = ai.food || ""; r.size = ai.size || ""; r.care = ai.care || "";
      r.attack = ai.attack || 0; r.defense = ai.defense || 0; r.hand = ai.hand || "";
      r.move = ai.move_name || ""; r.moveKind = ai.move_kind || "";
      r.moveColor = ai.move_color || ""; r.moveCry = ai.move_cry || "";
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
      r.attack = r.attack || known.attack || 0;
      r.defense = r.defense || known.defense || 0;
      r.hand = r.hand || known.hand || "";
      r.move = r.move || known.move || ""; r.moveKind = r.moveKind || known.moveKind || "";
      r.moveColor = r.moveColor || known.moveColor || ""; r.moveCry = r.moveCry || known.moveCry || "";
      r.care = r.care || known.care || "";
      if (!(ai && ai.is_creature)) r.rarity = known.stars;
    }
    pendingResolved = r;

    $("#r-photo").src = urlFor(blob);
    drawResultShots();
    updateResultIllust(r.name);
    $("#r-name-input").value = r.name;
    $("#r-kana").textContent = r.kana || "";
    $("#r-fact").textContent = r.fact || "";
    $("#r-hint").textContent = r.where ? "🔍 " + r.where : "";
    $("#r-hint").hidden = !r.where;
    pendingRarity = rarityFor(r.name, r.rarity);
    rarityTouched = false;
    pendingStats = null;
    drawResultStars();
    drawResultBattle();

    const note = $("#r-note");
    note.className = "r-note";
    const detail = (e) => {
      const i = String(e).indexOf(":");
      const raw = i >= 0 ? String(e).slice(i + 1).trim() : "";
      return raw ? `<br><span class='r-note-sub'>〔${escapeHtml(raw.slice(0, 160))}〕</span>` : "";
    };
    // AIに もういちど きく ボタンは エラーの ときだけ だす
    $("#r-retry").hidden = !(err && err !== "NO_KEY" && Settings.key);
    $("#r-add-photo").hidden = !Settings.key;
    $("#r-add-photo").textContent = pendingShots.length > 1
      ? `📷 写真(しゃしん)を たす（いま ${pendingShots.length}枚(まい)）`
      : "📷 写真(しゃしん)を たして もう一度(いちど) 聞(き)く";
    const tip = $("#r-shots-tip");
    if (tip) {
      tip.hidden = !Settings.key;
      tip.innerHTML = pendingShots.length > 1
        ? `💡 この ${pendingShots.length}枚(まい)は ぜんぶ 図鑑(ずかん)に 保存(ほぞん)されるよ`
        : "💡 写真(しゃしん)が 多(おお)いほど AIは よく 当(あ)てられるよ（3枚(まい)まで・ぜんぶ 保存(ほぞん)されます）";
      rubyifyDOM(tip);
    }
    rubyifyDOM($("#r-add-photo"));

    if (err === "NO_KEY") {
      note.classList.add("warn");
      note.innerHTML = "AIキーが まだ ないよ。名前(なまえ)を 手(て)で 入(い)れてね。<br><span class='r-note-sub'>⚙️設定(せってい)で キーを 入(い)れると 自動(じどう)で 名前(なまえ)が 出(で)ます</span>";
    } else if (err && err.startsWith("BAD_KEY")) {
      note.classList.add("warn"); note.innerHTML = "APIキーが 違(ちが)うかも。⚙️設定(せってい)を 確(たし)かめてね。<br>名前(なまえ)は 手(て)で 入(い)れられます。" + detail(err);
    } else if (err && err.startsWith("BUSY")) {
      note.classList.add("warn");
      note.innerHTML = "いま AIが とても 混(こ)んで いるみたい。少(すこ)し 待(ま)ってから もう一度(いちど) 押(お)してね。<br><span class='r-note-sub'>Google 側(がわ)が 混雑(こんざつ)して います（アプリの 制限(せいげん)では ありません）。名前(なまえ)は 手(て)で 入(い)れられます</span>" + detail(err);
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

  // とうろく がめんの たたかいの すうじ
  /* とうろく画面の した に、しらべた しゃしんを ならべる（2まい いじょうの とき）*/
  function drawResultShots() {
    const box = $("#r-shots");
    if (!box) return;
    box.innerHTML = "";
    box.hidden = pendingShots.length < 2;
    if (box.hidden) return;
    pendingShots.forEach((b, i) => {
      const cell = document.createElement("div");
      cell.className = "r-shot" + (i === 0 ? " cover" : "");
      cell.innerHTML = `<img src="${urlFor(b)}" alt="">` + (i === 0 ? `<i class="cover-tag">★</i>` : `<i>${i + 1}</i>`);
      cell.title = i === 0 ? "表紙(ひょうし)の 写真" : "タップで 表紙(ひょうし)に する";
      if (i > 0) {
        cell.addEventListener("click", () => {
          const [pick] = pendingShots.splice(i, 1);
          pendingShots.unshift(pick);
          pendingBlob = pendingShots[0];
          $("#r-photo").src = urlFor(pendingBlob);
          drawResultShots();
          sound.blip();
        });
      }
      if (pendingShots.length > 1) {
        const del = document.createElement("button");
        del.type = "button"; del.textContent = "✕"; del.title = "この 写真を はずす";
        del.addEventListener("click", (e) => {
          e.stopPropagation();
          pendingShots.splice(i, 1);
          pendingBlob = pendingShots[0];
          $("#r-photo").src = urlFor(pendingBlob);
          drawResultShots();
        });
        cell.appendChild(del);
      }
      box.appendChild(cell);
    });
  }

  // いま とうろく画面に 出て いる つよさ（★を いじる まえの もと）
  function currentResultStats() {
    const name = ($("#r-name-input").value || (pendingResolved && pendingResolved.name) || "").trim();
    const g = groups.get(name);
    const st = g ? { attack: g.attack, defense: g.defense, hand: g.hand }
                 : detailsForName(name || "?", pendingResolved || {});
    return { attack: st.attack, defense: st.defense, hand: st.hand };
  }
  function drawResultBattle() {
    const box = $("#r-battle");
    if (!box) return;
    const st = pendingStats || currentResultStats();
    box.innerHTML = "";
    box.appendChild(battleRow(st, true));
    rubyifyDOM(box);
  }

  const RARITY_NAME = ["", "ふつう", "ちょっと めずらしい", "めずらしい", "とても めずらしい", "でんせつ！"];
  function drawResultStars(pop) {
    const box = $("#r-stars");
    renderStars(box, pendingRarity, (v) => {
      // いまの つよさを ★に あわせて のばす／ちぢめる
      const now = pendingStats || currentResultStats();
      pendingStats = scaleStats(now, pendingRarity, v);
      pendingRarity = v;
      rarityTouched = true;
      drawResultStars(true);
      drawResultBattle();
      sound.blip();
      if (navigator.vibrate) navigator.vibrate(18);
    });
    const nm = $("#r-star-name");
    if (nm) {
      nm.textContent = RARITY_NAME[clampR(pendingRarity)] || "";
      nm.className = "star-name s" + clampR(pendingRarity);
    }
    box.classList.remove("pop");
    if (pop) { void box.offsetWidth; box.classList.add("pop"); }
    rubyifyDOM($(".m-stars-row"));
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
        ...statsFor(name, known.stars, known),
        ...moveFor(name, known.stars, known),
      };
    }
    const sameAsAi = r.aiName && _norm(name) === _norm(r.aiName);
    if (!sameAsAi) {
      const g0 = groups.get(name);
      const keep = g0
        ? { attack: g0.attack, defense: g0.defense, hand: g0.hand,
            move: g0.move, moveKind: g0.moveKind, moveColor: g0.moveColor, moveCry: g0.moveCry }
        : null;
      return Object.assign({ where: "", family: "", trivia: [], habitat: "", season: "", food: "", size: "", care: "" },
        keep || Object.assign(statsFor(name, pendingRarity, null), moveFor(name, pendingRarity, null)));
    }
    return {
      where: r.where || "", family: r.family || "",
      trivia: Array.isArray(r.trivia) ? r.trivia.slice(0, 4) : [],
      habitat: r.habitat || "", season: r.season || "",
      food: r.food || "", size: r.size || "", care: r.care || "",
      ...statsFor(name, pendingRarity, r),
      ...moveFor(name, pendingRarity, r),
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
    drawResultBattle();
    if (rarityTouched) return;   // てで えらんだ ★は そのまま
    pendingRarity = rarityFor(name, r.rarity);
    drawResultStars();
    drawResultBattle();
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
    // ★を いじって つよさを かえた ときは、その あたいを つかう
    if (pendingStats) {
      rec.attack = pendingStats.attack;
      rec.defense = pendingStats.defense;
      if (pendingStats.hand) rec.hand = pendingStats.hand;
    }
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
      // しらべる のに つかった ほかの しゃしんも おなじ なまえで ほぞん
      for (const extra of pendingShots.slice(1)) {
        try { await DB.add(Object.assign({}, rec, { blob: extra, date: Date.now() })); }
        catch (e) { console.warn("extra photo save failed:", e); }
      }
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
    const shots = Math.max(1, pendingShots.length);
    // 何枚か ある ときは、1まいめ（★）を カードの 表紙に する
    if (shots > 1) { Covers.set(name, rec.date); try { await afterChange(name, false); } catch (e) {} }
    pendingShots = [];                 // つぎの とうろくに もちこさない
    if (isNew) celebrate(rec, leveledUp); else miniCheer(rec);
    if (shots > 1) setTimeout(() => miniNote(`📷 写真(しゃしん) ${shots}枚(まい)を 図鑑(ずかん)に 入(い)れたよ！`), 900);
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
      ctx() { return ac(); },
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
      // ノイズを 1つ つくる（ぶつかる・たおれる おとの もと）
      noise(dur, env) {
        const c = ac();
        const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * env(i / d.length);
        const src = c.createBufferSource(); src.buffer = buf;
        return src;
      },
      /* こうげきが あたった おと。
         シュッ（ざんげき）＋ ドンッ（ぶつかる）＋ パキッ（しん）*/
      hit(strong) {
        if (!on) return;
        try {
          const c = ac(), t = c.currentTime;
          // シュッ：たかい ノイズが すーっと さがる
          const dur = 0.24;
          const src = this.noise(dur, (x) => Math.pow(1 - x, 1.5));
          const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.1;
          bp.frequency.setValueAtTime(strong ? 6000 : 4800, t);
          bp.frequency.exponentialRampToValueAtTime(800, t + dur);
          const sg = c.createGain();
          sg.gain.setValueAtTime(strong ? 0.24 : 0.17, t);
          sg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          src.connect(bp); bp.connect(sg); sg.connect(c.destination);
          src.start(t); src.stop(t + dur + 0.02);
          // ドンッ：ひくい おとが ずんと おちる
          const o = c.createOscillator(), og = c.createGain();
          o.type = "triangle";
          o.frequency.setValueAtTime(strong ? 220 : 175, t + 0.02);
          o.frequency.exponentialRampToValueAtTime(48, t + 0.28);
          og.gain.setValueAtTime(0.0001, t + 0.02);
          og.gain.linearRampToValueAtTime(strong ? 0.3 : 0.22, t + 0.05);
          og.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
          o.connect(og); og.connect(c.destination);
          o.start(t + 0.02); o.stop(t + 0.42);
          // バシッ：たいこを たたいた ような しんの おと
          const sm = this.noise(0.075, (x) => Math.pow(1 - x, 3));
          const bpm2 = c.createBiquadFilter(); bpm2.type = "bandpass"; bpm2.Q.value = 1.8;
          bpm2.frequency.value = strong ? 820 : 640;
          const smg = c.createGain();
          smg.gain.setValueAtTime(strong ? 0.3 : 0.22, t);
          smg.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);
          sm.connect(bpm2); bpm2.connect(smg); smg.connect(c.destination);
          sm.start(t); sm.stop(t + 0.1);
          // たたいた ものの「ボンッ」という からだの おと
          const bo = c.createOscillator(), bg = c.createGain();
          bo.type = "sine";
          bo.frequency.setValueAtTime(strong ? 380 : 320, t);
          bo.frequency.exponentialRampToValueAtTime(strong ? 120 : 110, t + 0.09);
          bg.gain.setValueAtTime(strong ? 0.22 : 0.16, t);
          bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
          bo.connect(bg); bg.connect(c.destination);
          bo.start(t); bo.stop(t + 0.16);
        } catch (e) {}
      },
      // とくいわざを ためる おと（ぐんぐん 上がって いく）
      charge() {
        if (!on) return;
        try {
          const c = ac(), t = c.currentTime;
          const o = c.createOscillator(), g = c.createGain();
          o.type = "sawtooth";
          o.frequency.setValueAtTime(110, t);
          o.frequency.exponentialRampToValueAtTime(1500, t + 0.85);
          const lp = c.createBiquadFilter(); lp.type = "lowpass";
          lp.frequency.setValueAtTime(600, t);
          lp.frequency.exponentialRampToValueAtTime(6500, t + 0.85);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.13, t + 0.55);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
          o.connect(lp); lp.connect(g); g.connect(c.destination);
          o.start(t); o.stop(t + 1);
          // きらきらと 上がる おと
          [659, 880, 1047, 1319, 1568].forEach((f, i) => note(f, i * 0.13, 0.26, "triangle", 0.09));
          // ちからが すいこまれる ノイズ
          const src = this.noise(0.9, (x) => Math.pow(x, 2.2));
          const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1800;
          const ng = c.createGain();
          ng.gain.setValueAtTime(0.0001, t);
          ng.gain.linearRampToValueAtTime(0.15, t + 0.8);
          ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.96);
          src.connect(hp); hp.connect(ng); ng.connect(c.destination);
          src.start(t); src.stop(t + 0.96);
        } catch (e) {}
      },
      // たおれた おと（よろよろ さがって、ドサッ）
      down() {
        if (!on) return;
        try {
          const c = ac(), t = c.currentTime;
          const o = c.createOscillator(), g = c.createGain();
          o.type = "sawtooth";
          o.frequency.setValueAtTime(430, t);
          o.frequency.exponentialRampToValueAtTime(70, t + 0.7);
          const lp = c.createBiquadFilter(); lp.type = "lowpass";
          lp.frequency.setValueAtTime(2400, t);
          lp.frequency.exponentialRampToValueAtTime(420, t + 0.7);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.15, t + 0.06);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
          o.connect(lp); lp.connect(g); g.connect(c.destination);
          o.start(t); o.stop(t + 0.85);
          // ドサッ：つちに たおれる
          const dur = 0.45;
          const src = this.noise(dur, (x) => Math.pow(1 - x, 2.2) * Math.min(1, x * 22));
          const lp2 = c.createBiquadFilter(); lp2.type = "lowpass"; lp2.frequency.value = 520;
          const ng = c.createGain();
          ng.gain.setValueAtTime(0.24, t + 0.55);
          ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.55 + dur);
          src.connect(lp2); lp2.connect(ng); ng.connect(c.destination);
          src.start(t + 0.55); src.stop(t + 0.55 + dur + 0.02);
        } catch (e) {}
      },
      /* とくしゅ こうげきの おと（わざごとに ぜんぜん ちがう）*/
      special(key) {
        if (!on) return;
        try {
          const c = ac(), t = c.currentTime;
          if (key === "bomb") {
            // ドッカーン：ひくい ばくはつ＋ゴロゴロ
            const src = this.noise(1.1, (x) => Math.pow(1 - x, 1.7) * Math.min(1, x * 40));
            const lp = c.createBiquadFilter(); lp.type = "lowpass";
            lp.frequency.setValueAtTime(2600, t);
            lp.frequency.exponentialRampToValueAtTime(160, t + 1.0);
            const g = c.createGain();
            g.gain.setValueAtTime(0.42, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
            src.connect(lp); lp.connect(g); g.connect(c.destination);
            src.start(t); src.stop(t + 1.15);
            const o = c.createOscillator(), og = c.createGain();
            o.type = "sine";
            o.frequency.setValueAtTime(150, t);
            o.frequency.exponentialRampToValueAtTime(28, t + 0.9);
            og.gain.setValueAtTime(0.45, t);
            og.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
            o.connect(og); og.connect(c.destination);
            o.start(t); o.stop(t + 1);
            return;
          }
          if (key === "fire") {
            // ゴォォ：もえあがる かぜの おと
            const src = this.noise(1.2, (x) => Math.sin(Math.PI * Math.min(1, x * 1.15)) ** 1.2);
            const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 0.7;
            bp.frequency.setValueAtTime(320, t);
            bp.frequency.exponentialRampToValueAtTime(2600, t + 0.45);
            bp.frequency.exponentialRampToValueAtTime(700, t + 1.15);
            const g = c.createGain();
            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(0.34, t + 0.18);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
            src.connect(bp); bp.connect(g); g.connect(c.destination);
            src.start(t); src.stop(t + 1.25);
            // パチパチ
            for (let i = 0; i < 7; i++) note(900 + Math.random() * 1400, 0.1 + i * 0.11, 0.05, "square", 0.05);
            return;
          }
          if (key === "sword") {
            // シャキーン：きんぞくの きりおと 3れんぱつ
            for (let i = 0; i < 3; i++) {
              const st = t + i * 0.16;
              const src = this.noise(0.2, (x) => Math.pow(1 - x, 1.4));
              const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.4;
              bp.frequency.setValueAtTime(7000, st);
              bp.frequency.exponentialRampToValueAtTime(1200, st + 0.2);
              const g = c.createGain();
              g.gain.setValueAtTime(0.3, st);
              g.gain.exponentialRampToValueAtTime(0.0001, st + 0.2);
              src.connect(bp); bp.connect(g); g.connect(c.destination);
              src.start(st); src.stop(st + 0.22);
            }
            // キーン（きんぞくの ひびき）
            [2093, 3136, 4186].forEach((f, i) => note(f, 0.3 + i * 0.015, 0.9, "triangle", 0.09));
            return;
          }
          // みず：ザブーン＋ぽこぽこ
          const src = this.noise(0.9, (x) => Math.pow(1 - x, 1.3) * Math.min(1, x * 12));
          const lp = c.createBiquadFilter(); lp.type = "lowpass";
          lp.frequency.setValueAtTime(3800, t);
          lp.frequency.exponentialRampToValueAtTime(500, t + 0.85);
          const g = c.createGain();
          g.gain.setValueAtTime(0.32, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
          src.connect(lp); lp.connect(g); g.connect(c.destination);
          src.start(t); src.stop(t + 0.95);
          for (let i = 0; i < 6; i++) {
            const o = c.createOscillator(), og = c.createGain();
            const st = t + 0.12 + i * 0.09;
            o.type = "sine";
            o.frequency.setValueAtTime(280 + Math.random() * 500, st);
            o.frequency.exponentialRampToValueAtTime(90 + Math.random() * 90, st + 0.12);
            og.gain.setValueAtTime(0.12, st);
            og.gain.exponentialRampToValueAtTime(0.0001, st + 0.14);
            o.connect(og); og.connect(c.destination);
            o.start(st); o.stop(st + 0.16);
          }
        } catch (e) {}
      },
      // たいりょくが たまる おと（ピピピピ…と あがる）
      fill() {
        if (!on) return;
        try { for (let i = 0; i < 10; i++) note(440 + i * 62, i * 0.075, 0.12, "square", 0.07); } catch (e) {}
      },
      // かいふくの おと（きらきら あがる）
      heal() {
        if (!on) return;
        try { [523, 659, 880, 1047].forEach((f, i) => note(f, i * 0.07, 0.3, "sine", 0.12)); } catch (e) {}
      },
    };
  })();

  /* ============================================================
     とうぎじょうの おんがく
     ・むかしの ゲームみたいな 音で、ぜんぶ その場で つくって いる
     ・ベース＋アルペジオ＋メロディ＋ドラム の 4パート、8小節で くりかえし
     ============================================================ */
  const bgm = (() => {
    const KEY = "mz-bgm";
    const BPM = 152;
    const STEP = 60 / BPM / 4;          // 16ぶおんぷ 1つぶんの ながさ
    const BARS = 8, PER_BAR = 16, LEN = BARS * PER_BAR;
    const mid = (n) => 440 * Math.pow(2, (n - 69) / 12);

    // 8小節の コード（ラ短調： Am - F - G - Am - F - G - E - E）
    const ROOT = [45, 41, 43, 45, 41, 43, 40, 40];
    const TRIAD = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [57, 60, 64],
                   [53, 57, 60], [55, 59, 62], [52, 56, 59], [52, 56, 59]];
    // メロディ（0は やすみ）
    const LEAD = [
      [69, 0, 0, 72, 71, 0, 69, 0, 64, 0, 0, 0, 69, 0, 0, 0],
      [65, 0, 0, 69, 67, 0, 65, 0, 60, 0, 0, 0, 65, 0, 0, 0],
      [67, 0, 0, 71, 69, 0, 67, 0, 62, 0, 0, 0, 67, 0, 0, 0],
      [69, 0, 72, 0, 71, 0, 69, 0, 67, 0, 69, 0, 71, 0, 72, 0],
      [72, 0, 0, 74, 72, 0, 69, 0, 65, 0, 0, 0, 69, 0, 0, 0],
      [74, 0, 0, 76, 74, 0, 71, 0, 67, 0, 0, 0, 71, 0, 0, 0],
      [76, 0, 74, 0, 72, 0, 71, 0, 68, 0, 71, 0, 72, 0, 74, 0],
      [76, 0, 0, 0, 0, 0, 0, 0, 71, 0, 72, 0, 74, 0, 76, 0],
    ];
    // ベース（8ぶおんぷ 8つ ぶんの かた）
    const BASS = [0, 0, 12, 0, 0, 7, 12, 0];

    let on = true;
    try { on = localStorage.getItem(KEY) !== "off"; } catch (e) {}
    let timer = null, step = 0, nextT = 0, master = null, playing = false;

    function gainNode(c) {
      if (!master) { master = c.createGain(); master.gain.value = 0; master.connect(c.destination); }
      return master;
    }
    // かんたんな 音を 1つ ならす
    function tone(c, out, freq, t, dur, type, gain, cutoff) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = freq;
      let last = g;
      if (cutoff) {
        const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = cutoff;
        o.connect(lp); lp.connect(g);
      } else o.connect(g);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      last.connect(out);
      o.start(t); o.stop(t + dur + 0.03);
    }
    function noiseHit(c, out, t, dur, hp, gain) {
      const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
      const src = c.createBufferSource(); src.buffer = buf;
      const f = c.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp;
      const g = c.createGain(); g.gain.value = gain;
      src.connect(f); f.connect(g); g.connect(out);
      src.start(t); src.stop(t + dur + 0.02);
    }
    function kick(c, out, t) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.11);
      g.gain.setValueAtTime(0.34, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.2);
    }

    function playStep(i, t) {
      const c = sound.ctx(), out = gainNode(c);
      const bar = Math.floor(i / PER_BAR), k = i % PER_BAR;
      // ドラム
      if (k === 0 || k === 3 || k === 8 || k === 10 || k === 14) kick(c, out, t);
      if (k === 4 || k === 12) noiseHit(c, out, t, 0.16, 1300, 0.16);
      if (k % 2 === 0) noiseHit(c, out, t, 0.035, 7000, 0.05);
      // ベース（8ぶおんぷ）
      if (k % 2 === 0) tone(c, out, mid(ROOT[bar] + BASS[k / 2]), t, STEP * 1.7, "square", 0.11, 700);
      // アルペジオ（16ぶおんぷ）
      const tri = TRIAD[bar];
      tone(c, out, mid(tri[k % 3] + (k % 6 >= 3 ? 12 : 0)), t, STEP * 0.9, "triangle", 0.05);
      // メロディ
      const n = LEAD[bar][k];
      if (n) {
        tone(c, out, mid(n), t, STEP * 2.6, "square", 0.075, 4200);
        tone(c, out, mid(n) * 1.005, t, STEP * 2.6, "square", 0.04, 3200);   // ちょっと ずらして あつく
      }
      // さいごの 小節の おわりで もりあげる
      if (bar === 7 && k >= 12) noiseHit(c, out, t, 0.09, 4000, 0.09);
    }

    function tick() {
      const c = sound.ctx();
      while (nextT < c.currentTime + 0.28) {
        try { playStep(step, nextT); } catch (e) {}
        step = (step + 1) % LEN;
        nextT += STEP;
      }
    }

    return {
      get on() { return on; },
      get playing() { return playing; },
      toggle() {
        on = !on;
        try { localStorage.setItem(KEY, on ? "on" : "off"); } catch (e) {}
        if (!on) this.stop(); else if (arenaOpen()) this.start();
        return on;
      },
      start() {
        if (!on || !sound.on || playing) return;
        try {
          const c = sound.ctx();
          if (c.state === "suspended") c.resume();
          const g = gainNode(c);
          g.gain.cancelScheduledValues(c.currentTime);
          g.gain.setValueAtTime(0.0001, c.currentTime);
          g.gain.linearRampToValueAtTime(0.5, c.currentTime + 0.6);
          step = 0; nextT = c.currentTime + 0.08;
          playing = true;
          tick();
          timer = setInterval(tick, 60);
        } catch (e) { playing = false; }
      },
      stop(quick) {
        if (timer) { clearInterval(timer); timer = null; }
        playing = false;
        try {
          const c = sound.ctx();
          if (master) {
            master.gain.cancelScheduledValues(c.currentTime);
            master.gain.setValueAtTime(master.gain.value, c.currentTime);
            master.gain.linearRampToValueAtTime(0.0001, c.currentTime + (quick ? 0.08 : 0.35));
          }
        } catch (e) {}
      },
    };
  })();
  const arenaOpen = () => !$("#arena").hidden;

  /* ずかんが 空に 見える ときの 救出ボタン。
     しゃしんは スマホの 中の 2つの ほぞん場所（IndexedDB / localStorage）の
     どちらかに 入って いる。おおい ほうに つなぎ直して 読みこむ。*/
  async function findMyData() {
    const out = $("#s-find-result");
    out.className = "s-test-result";
    out.textContent = "さがして います…";
    try {
      const moved = await DB.rescue();
      const after = await DB.counts();
      await reload(); renderProgress(); renderGrid(); renderPlaces();
      const n = captures.length;
      if (n > 0) {
        out.className = "s-test-result ok";
        out.textContent = moved
          ? `✓ 見(み)つけたよ！ 写真(しゃしん)${n}枚(まい)を よみこみました`
          : `✓ 写真(しゃしん)は ${n}枚(まい) あります`;
        if (moved) sound.blip();
      } else {
        out.className = "s-test-result warn";
        out.textContent =
          `この スマホには 写真(しゃしん)が 見(み)つかりませんでした` +
          `（中(なか)の ほぞん場所A：${after.idb < 0 ? "使(つか)えない" : after.idb + "枚(まい)"} ／ ` +
          `B：${after.ls}枚(まい)）。バックアップの ファイルが あれば「復元(ふくげん)」から もどせます。`;
      }
      rubyifyDOM(out);
    } catch (err) {
      out.className = "s-test-result warn";
      out.textContent = "✕ " + (err.message || "できませんでした");
    }
  }

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
  /* ファイル名は 時刻(じこく)まで 入れる。
     おなじ 名前だと ブラウザが「もう一度 ダウンロードしますか？」と
     きいて きて、あそびの じゃまに なる ため。*/
  function backupFileName() {
    const d = new Date();
    const p2 = (n) => String(n).padStart(2, "0");
    return `mushizukan-backup-${toDateInput(d.getTime())}-${p2(d.getHours())}${p2(d.getMinutes())}.json`;
  }
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
    $("#shots-more").addEventListener("click", () => { collecting = true; closeShotsSheet(); $("#file-camera").click(); });
    $("#shots-go").addEventListener("click", () => { closeShotsSheet(); askAI(pendingShots); });
    $("#shots-cancel").addEventListener("click", () => { collecting = false; pendingShots = []; pendingBlob = null; closeShotsSheet(); });
    $("#pick-file").addEventListener("click", () => { closePicker(); $("#file-gallery").click(); });
    $("#pick-cancel").addEventListener("click", closePicker);
    $("#picker").addEventListener("click", (e) => { if (e.target.id === "picker") closePicker(); });
    $("#file-camera").addEventListener("change", onFile);
    $("#file-gallery").addEventListener("change", onFile);

    $("#arena-open").addEventListener("click", openArena);
    // ---- 右(みぎ)から でる メニュー ----
    $("#menu-btn").addEventListener("click", () => (drawerOpen() ? closeDrawer() : openDrawer()));
    $("#drawer-close").addEventListener("click", closeDrawer);
    $("#drawer-bg").addEventListener("click", closeDrawer);
    $("#drawer").addEventListener("click", (e) => { if (e.target.closest(".drawer-item")) closeDrawer(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && drawerOpen()) closeDrawer(); });
    $("#ar-close").addEventListener("click", closeArena);
    // 「なかまを かえる」は えらび直し（せんたくを まっさらに）
    $("#ar-back").addEventListener("click", () => { bgm.stop(); arSel = []; openArena(); });
    $("#ar-go").addEventListener("click", () => arStart(arSel.slice()));
    $("#ar-again").addEventListener("click", () =>
      arStart(arMyTeam.length ? arMyTeam.map((f) => f.name) : arSel.slice()));
    $("#ar-item").addEventListener("click", arUseItem);
    $("#ar-chest").addEventListener("click", () => { if (arChestDone) arChestDone(); });
    // まっている なかまの しゃしんを タップ → こうたい
    $("#ar-me-team").addEventListener("click", async (e) => {
      const b = e.target.closest(".stm");
      if (!b || b.disabled || arBusy || arOver) return;
      const i = +b.dataset.i;
      if (!(i >= 0) || !arMyTeam[i] || arMyTeam[i].hp <= 0 || i === arMyIdx) return;
      arBusy = true;
      await arSwapTo(i);
      arBusy = false;
    });
    const bgmBtn = $("#ar-bgm");
    const paintBgm = () => {
      bgmBtn.textContent = bgm.on ? "🎵" : "🔇";
      bgmBtn.classList.toggle("off", !bgm.on);
    };
    paintBgm();
    bgmBtn.addEventListener("click", () => { bgm.toggle(); paintBgm(); });
    // アプリを うしろに やったら 音楽を とめる
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) bgm.stop(true);
      else if (arenaOpen() && !$("#ar-fight").hidden && !arOver) bgm.start();
    });
    $("#ar-swap").addEventListener("click", arSwapBtn);
    $("#ar-swap-cancel").addEventListener("click", () => arCloseSwap(-1));
    $$("#ar-hands .ar-hand").forEach((b) => b.addEventListener("click", () => arPlay(b.dataset.hand)));
    $("#book-open").addEventListener("click", () => openBook(flatOrder[0]));
    $("#book-close").addEventListener("click", closeBook);
    $("#book-prev").addEventListener("click", () => bookNav(-1));
    $("#book-next").addEventListener("click", () => bookNav(1));
    wireBookDrag();

    $("#r-save").addEventListener("click", saveResult);
    $("#r-cancel").addEventListener("click", () => $("#result").close());
    $("#r-retry").addEventListener("click", () => {
      if (!pendingShots.length) return;
      const list = pendingShots.slice();
      $("#result").close();
      askAI(list);
    });
    // 写真(しゃしん)を たして もう一度 きく
    $("#r-add-photo").addEventListener("click", () => {
      if (pendingShots.length >= MAX_SHOTS) {
        say(`写真(しゃしん)は ${MAX_SHOTS}枚(まい)まで だよ。\n いらない 写真(しゃしん)は ✕で はずせるよ。`);
        return;
      }
      addingShot = true;
      pendingMode = "discover";
      $("#result").close();
      $("#picker").hidden = false;
    });
    $("#r-name-input").addEventListener("input", (e) => onResultNameInput(e.target.value));

    $("#cel-ok").addEventListener("click", () => { const ov = $("#celebrate"); ov.classList.remove("show"); setTimeout(() => (ov.hidden = true), 300); });

    $("#settings-btn").addEventListener("click", openSettings);
    $("#api-hint").addEventListener("click", openSettings);
    $("#s-close").addEventListener("click", () => $("#settings").close());
    $("#s-save").addEventListener("click", saveSettings);
    $("#s-test").addEventListener("click", testSettings);
    $("#s-reclass").addEventListener("click", reclassifyWithAI);
    $("#s-find").addEventListener("click", findMyData);
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

    $("#pl-close").addEventListener("click", () => $("#place-modal").close());
    // はいけいを タップでも とじられる
    for (const id of ["#place-modal", "#settings", "#result"]) {
      $(id).addEventListener("click", (e) => { if (e.target === $(id)) $(id).close(); });
    }
    $("#pl-save").addEventListener("click", savePlace);
    $("#pl-here").addEventListener("click", useCurrentPlace);
    $("#r-place-add").addEventListener("click", () => openPlaceModal(null, { fromResult: true, here: true }));
    $("#pl-today").addEventListener("click", () => { $("#pl-date").value = toDateInput(Date.now()); });
    $("#pl-search-btn").addEventListener("click", searchPlace);
    $("#pl-search").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); searchPlace(); } });
    $("#pl-photo-btn").addEventListener("click", () => $("#pl-photo-input").click());
    $("#pl-photo-input").addEventListener("change", onPlacePhoto);
    $("#pl-photo-del").addEventListener("click", () => setPlacePhoto(null));
    $("#pl-visit").addEventListener("click", visitAgain);
    $("#pl-delete").addEventListener("click", deletePlace);

    const sb = $("#sound-btn");
    const refreshSound = () => {
      sb.textContent = sound.on ? "🔊 音(おと)は オン" : "🔈 音(おと)は オフ";
      rubyifyDOM(sb);
    };
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
