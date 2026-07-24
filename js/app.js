/* むしずかん — メイン（しゃしん → AIすいそく → カテゴリーわけ → ずかん） */
(() => {
  "use strict";

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

  const Settings = {
    get key() { return localStorage.getItem("mz-gemini-key") || ""; },
    set key(v) { v ? localStorage.setItem("mz-gemini-key", v) : localStorage.removeItem("mz-gemini-key"); },
    get model() { return localStorage.getItem("mz-gemini-model") || Gemini.DEFAULT_MODEL; },
    set model(v) { localStorage.setItem("mz-gemini-model", v || Gemini.DEFAULT_MODEL); },
  };

  const urlFor = (blob) => { if (!urlCache.has(blob)) urlCache.set(blob, URL.createObjectURL(blob)); return urlCache.get(blob); };
  const clampR = (n) => Math.min(3, Math.max(1, parseInt(n, 10) || 1));
  const stars = (n) => "★".repeat(clampR(n)) + "☆".repeat(3 - clampR(n));
  const fmtDate = (ms) => { const d = new Date(ms); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function illustFor(name) {
    const k = matchKnown(name);
    return k
      ? { svg: k.svg, color: k.color, knownId: k.id, kana: k.kana, fact: k.fact, where: k.where, rarity: k.stars }
      : { svg: GENERIC_BUG.svg, color: GENERIC_BUG.color, knownId: null, kana: "", fact: "", where: "", rarity: 1 };
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
      const rep = g.latest;
      const k = matchKnown(g.name);
      g.rarity = clampR(rep.rarity || (k ? k.stars : 1));
      g.kana = rep.kana || (k ? k.kana : "");
      g.fact = rep.fact || (k ? k.fact : "");
      g.category = rep.category || categorize(g.name);
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
    for (const catId of CATEGORY_ORDER) {
      if (byCat.has(catId)) out.push({ catId, groups: byCat.get(catId).sort((a, b) => b.lastDate - a.lastDate) });
    }
    return out;
  }

  // ---- ヘッダー ----
  function renderProgress() {
    const n = groups.size;
    const total = captures.length;
    $("#count").textContent = n;
    $("#total").textContent = n === 0 ? "" : "しゅるい";
    const pct = Math.min(100, n * 8);
    $("#bar-fill").style.width = pct + "%";
    $("#bar-bug").style.left = `calc(${pct}% - 14px)`;
    const msg = $("#progress-msg");
    if (n === 0) msg.textContent = "むしを みつけて しゃしんを とろう！";
    else if (n === 1) msg.textContent = "さいしょの むし ゲット！ つぎは なにかな？";
    else msg.textContent = `${n}しゅるい・ぜんぶで ${total}まい あつめたよ！`;
    $("#api-hint").hidden = !!Settings.key;
    $("#book-open").hidden = n === 0;
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
         <p>まだ ずかんは からっぽ。<br>したの ボタンで むしの しゃしんを とってみよう！</p>
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
    card.className = "card found";
    card.style.setProperty("--c", ill.color);
    card.setAttribute("aria-label", g.name);

    const media = document.createElement("div");
    media.className = "card-media";
    const img = document.createElement("img");
    img.src = urlFor(g.latest.blob); img.alt = g.name; img.loading = "lazy";
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
    page.className = "page";
    page.dataset.name = g.name;
    page.style.setProperty("--c", ill.color);

    const cat = document.createElement("div");
    cat.className = "page-cat";
    cat.innerHTML = `${meta.emoji} ${meta.label}`;
    page.appendChild(cat);

    const pw = document.createElement("div");
    pw.className = "page-photo-wrap";
    const img = document.createElement("img");
    img.className = "page-photo"; img.src = urlFor(g.latest.blob); img.alt = g.name;
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
    st.className = "page-stars s" + g.rarity; st.textContent = stars(g.rarity);
    page.appendChild(st);

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
      await afterChange(v, true);
    });

    if (g.kana) { const k = document.createElement("p"); k.className = "page-kana"; k.textContent = g.kana; page.appendChild(k); }
    if (g.fact) { const f = document.createElement("p"); f.className = "page-fact"; f.textContent = g.fact; page.appendChild(f); }

    const mt = document.createElement("p");
    mt.className = "page-meta";
    mt.textContent = `みつけた かず：${g.count}かい ・ はじめて：${fmtDate(g.firstDate)}`;
    page.appendChild(mt);

    const gtitle = document.createElement("p");
    gtitle.className = "page-gallery-title"; gtitle.textContent = "📸 とった しゃしん";
    page.appendChild(gtitle);
    const gal = document.createElement("div");
    gal.className = "page-gallery";
    for (const c of [...g.list].reverse()) {
      const cell = document.createElement("div"); cell.className = "g-cell";
      const gi = document.createElement("img"); gi.src = urlFor(c.blob); gi.alt = g.name; cell.appendChild(gi);
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

    return page;
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
    try { blob = await resizeImage(file, 1280, 0.82); }
    catch (err) { alert("しゃしんを よみこめなかったよ。"); return; }

    if (pendingMode === "append" && pendingAppendName) {
      const rec = { name: pendingAppendName, ...pickMeta(pendingAppendName), blob, date: Date.now() };
      $("#loading").hidden = false;
      try {
        await DB.add(rec);
        await afterChange(pendingAppendName, true);
        $("#loading").hidden = true;
        miniCheer(rec);
      } catch (err) { $("#loading").hidden = true; alert("ほぞん できなかったよ。"); }
      return;
    }

    // discovery
    pendingBlob = blob;
    const key = Settings.key;
    if (!key) { openResult(blob, null, "NO_KEY"); return; }
    $("#thinking").hidden = false;
    try {
      const ai = await Gemini.identify(blob, key, Settings.model);
      $("#thinking").hidden = true;
      openResult(blob, ai, null);
    } catch (err) {
      $("#thinking").hidden = true;
      openResult(blob, null, String(err.message || err));
    }
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
    $("#r-stars").textContent = stars(r.rarity);
    $("#r-stars").className = "r-stars s" + clampR(r.rarity);

    const note = $("#r-note");
    note.className = "r-note";
    if (err === "NO_KEY") {
      note.classList.add("warn");
      note.innerHTML = "AIキーが まだ ないよ。なまえを てで いれてね。<br><span class='r-note-sub'>⚙️ せってい で キーを いれると じどうで なまえが でます</span>";
    } else if (err && err.startsWith("BAD_KEY")) {
      note.classList.add("warn"); note.innerHTML = "APIキーが ちがうかも。⚙️ せってい を たしかめてね。<br>なまえは てで いれられます。";
    } else if (err && err.startsWith("QUOTA")) {
      note.classList.add("warn"); note.textContent = "きょうは AIが つかいすぎかも。なまえを てで いれてね。";
    } else if (err === "NETWORK") {
      note.classList.add("warn"); note.textContent = "ネットに つながらなかったよ。なまえを てで いれてね。";
    } else if (err) {
      note.classList.add("warn"); note.textContent = "AIが つかえなかったよ。なまえを てで いれてね。";
    } else if (ai && !ai.is_creature) {
      note.classList.add("warn"); note.textContent = "むしが みつからなかったかも。なまえを いれてね。";
    } else if (ai) {
      const pct = r.confidence != null ? Math.round(r.confidence * 100) : null;
      note.innerHTML = `🤖 AIの すいそく：<b>${escapeHtml(r.name)}</b>` + (pct != null ? `（じしん ${pct}%）` : "") + "<br><span class='r-note-sub'>ちがったら なまえを なおしてね</span>";
    }
    $("#result").showModal();
    setTimeout(() => { if (!r.name) $("#r-name-input").focus(); }, 200);
  }

  function updateResultIllust(name) {
    const ill = illustFor(name);
    $("#r-illust").innerHTML = ill.svg;
    $("#result").style.setProperty("--c", ill.color);
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
      rarity: clampR(r.rarity || ill.rarity),
      color: ill.color, knownId: ill.knownId,
      category: categorize(name, r.category),
      aiName: r.aiName || null,
      confidence: r.confidence != null ? r.confidence : null,
      blob: pendingBlob, date: Date.now(),
    };
    const isNew = !groups.has(name);
    $("#result").close();
    $("#loading").hidden = false;
    try {
      await DB.add(rec);
      await reload();
      renderProgress(); renderGrid();
      $("#loading").hidden = true;
      if (isNew) celebrate(rec); else miniCheer(rec);
    } catch (err) { $("#loading").hidden = true; alert("ほぞん できなかったよ。"); }
  }

  // ---- おいわい ----
  function celebrate(rec) {
    const ill = illustFor(rec.name);
    const ov = $("#celebrate");
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
    confetti(rec.rarity); sound.fanfare(rec.rarity);
    navigator.vibrate && navigator.vibrate([0, 60, 40, 60, 40, 120]);
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
    $("#r-name-input").addEventListener("input", (e) => updateResultIllust(e.target.value));

    $("#cel-ok").addEventListener("click", () => { const ov = $("#celebrate"); ov.classList.remove("show"); setTimeout(() => (ov.hidden = true), 300); });

    $("#settings-btn").addEventListener("click", openSettings);
    $("#api-hint").addEventListener("click", openSettings);
    $("#s-close").addEventListener("click", () => $("#settings").close());
    $("#s-save").addEventListener("click", saveSettings);
    $("#s-test").addEventListener("click", testSettings);
    $("#s-key-toggle").addEventListener("click", () => {
      const masked = $("#s-key").classList.toggle("masked");
      $("#s-key-toggle").textContent = masked ? "👁" : "🙈";
    });

    const sb = $("#sound-btn");
    const refreshSound = () => (sb.textContent = sound.on ? "🔊" : "🔈");
    refreshSound();
    sb.addEventListener("click", () => { sound.toggle(); refreshSound(); });

    document.body.addEventListener("pointerdown", function once() {
      try { new (window.AudioContext || window.webkitAudioContext)().resume(); } catch (e) {}
      document.body.removeEventListener("pointerdown", once);
    }, { once: true });
  }

  async function start() {
    wire();
    await reload();
    renderProgress();
    renderGrid();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
  start();
})();
