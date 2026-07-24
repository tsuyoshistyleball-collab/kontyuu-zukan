/* むしずかん — メイン */
(() => {
  "use strict";

  // ---- じょうたい ----
  let captures = [];            // IndexedDB の ぜんぶ
  let byInsect = {};            // insectId -> [captures]
  let urlCache = new Map();     // blob -> objectURL
  let currentInsect = null;     // モーダルで ひらいてる むし
  let filterMode = "all";       // all | found | yet

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  // ---- objectURL（つかいまわし）----
  function urlFor(blob) {
    if (!urlCache.has(blob)) urlCache.set(blob, URL.createObjectURL(blob));
    return urlCache.get(blob);
  }

  // ---- データ よみこみ ----
  async function reload() {
    captures = await DB.getAll();
    byInsect = {};
    for (const c of captures) (byInsect[c.insectId] ||= []).push(c);
    for (const id in byInsect) byInsect[id].sort((a, b) => a.date - b.date);
  }

  const foundCount = () => Object.keys(byInsect).length;
  const isFound = (id) => !!byInsect[id];
  const stars = (n) => "★".repeat(n) + "☆".repeat(3 - n);

  // ---- ヘッダー / しんちょく ----
  function renderProgress() {
    const total = INSECTS.length;
    const got = foundCount();
    const pct = Math.round((got / total) * 100);
    $("#count").textContent = `${got}`;
    $("#total").textContent = `/ ${total}`;
    $("#bar-fill").style.width = pct + "%";
    $("#bar-bug").style.left = `calc(${pct}% - 14px)`;
    const msg = $("#progress-msg");
    if (got === 0) msg.textContent = "さあ、むしを さがしに いこう！";
    else if (got >= total) msg.textContent = "🎉 ぜんぶ あつめた！ すごい！";
    else if (got >= total * 0.66) msg.textContent = "あと ちょっと！ がんばれ！";
    else if (got >= total * 0.33) msg.textContent = "いいちょうし！ どんどん あつめよう！";
    else msg.textContent = "みつけた むしを とうろく しよう！";
  }

  // ---- グリッド ----
  function renderGrid() {
    const grid = $("#grid");
    grid.innerHTML = "";
    const list = INSECTS.filter((ins) => {
      if (filterMode === "found") return isFound(ins.id);
      if (filterMode === "yet") return !isFound(ins.id);
      return true;
    });
    if (list.length === 0) {
      grid.innerHTML = `<p class="empty">まだ ここには ないよ</p>`;
      return;
    }
    for (const ins of list) {
      const found = isFound(ins.id);
      const card = document.createElement("button");
      card.className = "card " + (found ? "found" : "yet");
      card.style.setProperty("--c", ins.color);
      card.setAttribute("aria-label", found ? ins.name : "まだ みつけていない むし");

      const media = document.createElement("div");
      media.className = "card-media";
      if (found) {
        const img = document.createElement("img");
        img.src = urlFor(byInsect[ins.id][byInsect[ins.id].length - 1].blob);
        img.alt = ins.name;
        img.loading = "lazy";
        media.appendChild(img);
        const badge = document.createElement("div");
        badge.className = "card-badge";
        badge.innerHTML = ins.svg;
        media.appendChild(badge);
        if (byInsect[ins.id].length > 1) {
          const cnt = document.createElement("div");
          cnt.className = "card-count";
          cnt.textContent = "×" + byInsect[ins.id].length;
          media.appendChild(cnt);
        }
      } else {
        const sil = document.createElement("div");
        sil.className = "silhouette";
        sil.innerHTML = ins.svg;
        media.appendChild(sil);
        const q = document.createElement("div");
        q.className = "qmark";
        q.textContent = "？";
        media.appendChild(q);
      }
      card.appendChild(media);

      const name = document.createElement("div");
      name.className = "card-name";
      name.textContent = found ? ins.name : "？？？";
      card.appendChild(name);

      const rar = document.createElement("div");
      rar.className = "card-stars s" + ins.stars;
      rar.textContent = stars(ins.stars);
      card.appendChild(rar);

      card.addEventListener("click", () => openInsect(ins));
      grid.appendChild(card);
    }
  }

  // ---- モーダル（むし しょうさい）----
  function openInsect(ins) {
    currentInsect = ins;
    const found = isFound(ins.id);
    const m = $("#modal");
    m.classList.remove("yet", "found");
    m.classList.add(found ? "found" : "yet");
    m.style.setProperty("--c", ins.color);

    $("#m-illust").innerHTML = ins.svg;
    $("#m-stars").textContent = stars(ins.stars);
    $("#m-stars").className = "m-stars s" + ins.stars;

    if (found) {
      $("#m-name").textContent = ins.name;
      $("#m-kana").textContent = ins.kana;
      $("#m-fact").textContent = ins.fact;
      const list = byInsect[ins.id];
      $("#m-meta").textContent = `みつけた かず：${list.length}かい ・ はじめて：${fmtDate(list[0].date)}`;
      renderGallery(ins);
      $("#m-hint").hidden = true;
      $("#m-gallery-wrap").hidden = false;
      $("#btn-shoot").textContent = "📷 もういちど とる";
    } else {
      $("#m-name").textContent = "？？？";
      $("#m-kana").textContent = "まだ みつけていない むし";
      $("#m-fact").textContent = "しゃしんを とると なまえが わかるよ！";
      $("#m-meta").textContent = "";
      $("#m-hint").hidden = false;
      $("#m-hint-text").textContent = ins.where;
      $("#m-gallery-wrap").hidden = true;
      $("#btn-shoot").textContent = "📷 しゃしんを とる！";
    }
    m.showModal();
  }

  function renderGallery(ins) {
    const g = $("#m-gallery");
    g.innerHTML = "";
    for (const c of [...byInsect[ins.id]].reverse()) {
      const cell = document.createElement("div");
      cell.className = "g-cell";
      const img = document.createElement("img");
      img.src = urlFor(c.blob);
      img.alt = ins.name;
      cell.appendChild(img);
      const del = document.createElement("button");
      del.className = "g-del";
      del.textContent = "×";
      del.title = "この しゃしんを けす";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        confirmDelete(c.id, ins);
      });
      cell.appendChild(del);
      const dt = document.createElement("div");
      dt.className = "g-date";
      dt.textContent = fmtDate(c.date);
      cell.appendChild(dt);
      g.appendChild(cell);
    }
  }

  function confirmDelete(captureId, ins) {
    if (!confirm("この しゃしんを けしても いい？")) return;
    DB.remove(captureId).then(async () => {
      await reload();
      renderProgress();
      renderGrid();
      if (isFound(ins.id)) openInsect(ins);
      else $("#modal").close();
    });
  }

  function fmtDate(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  }

  // ---- しゃしん さつえい ----
  function pickPhoto() {
    const input = $("#file-input");
    input.value = "";
    input.click();
  }

  async function onFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file || !currentInsect) return;
    $("#loading").hidden = false;
    try {
      const blob = await resizeImage(file, 1280, 0.82);
      const before = isFound(currentInsect.id);
      await DB.add(currentInsect.id, blob, Date.now());
      await reload();
      renderProgress();
      renderGrid();
      $("#loading").hidden = true;
      $("#modal").close();
      if (!before) celebrate(currentInsect, blob);
      else miniCheer(currentInsect, blob);
    } catch (err) {
      $("#loading").hidden = true;
      alert("しゃしんを ほぞん できなかったよ。もう いちど ためしてね。");
      console.error(err);
    }
  }

  // canvas で ちいさくして JPEG に する（ほぞんの ばしょ せつやく）
  function resizeImage(file, maxSide, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width: w, height: h } = img;
        const scale = Math.min(1, maxSide / Math.max(w, h));
        w = Math.round(w * scale);
        h = Math.round(h * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("image load failed"));
      };
      img.src = url;
    });
  }

  // ---- おいわい えんしゅつ ----
  function celebrate(ins, blob) {
    const ov = $("#celebrate");
    $("#cel-photo").src = urlFor(blob);
    $("#cel-illust").innerHTML = ins.svg;
    $("#cel-name").textContent = ins.name;
    $("#cel-kana").textContent = ins.kana;
    $("#cel-stars").textContent = stars(ins.stars);
    $("#cel-stars").className = "cel-stars s" + ins.stars;
    $("#cel-fact").textContent = ins.fact;
    ov.style.setProperty("--c", ins.color);
    ov.hidden = false;
    ov.classList.add("show");
    confetti(ins.stars);
    sound.fanfare(ins.stars);
    navigator.vibrate && navigator.vibrate([0, 60, 40, 60, 40, 120]);
  }

  function miniCheer(ins, blob) {
    const t = $("#toast");
    $("#toast-photo").src = urlFor(blob);
    $("#toast-text").textContent = `${ins.name}を また みつけたね！（${byInsect[ins.id].length}かいめ）`;
    t.hidden = false;
    t.classList.add("show");
    sound.blip();
    confetti(1);
    clearTimeout(miniCheer._t);
    miniCheer._t = setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => (t.hidden = true), 300);
    }, 2600);
  }

  // ---- こんぺいとう（confetti）----
  function confetti(power) {
    const canvas = $("#confetti");
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const colors = ["#ffd166", "#ef476f", "#06d6a0", "#118ab2", "#f78c6b", "#c77dff"];
    const N = 60 + power * 40;
    const parts = [];
    for (let i = 0; i < N; i++) {
      parts.push({
        x: innerWidth / 2 + (Math.random() - 0.5) * 120,
        y: innerHeight * 0.35,
        vx: (Math.random() - 0.5) * 9,
        vy: -6 - Math.random() * 9,
        s: 6 + Math.random() * 8,
        c: colors[(Math.random() * colors.length) | 0],
        r: Math.random() * 6,
        vr: (Math.random() - 0.5) * 0.4,
      });
    }
    let frame = 0;
    canvas.hidden = false;
    (function tick() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of parts) {
        p.vy += 0.28;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
        ctx.restore();
      }
      if (frame++ < 140) requestAnimationFrame(tick);
      else canvas.hidden = true;
    })();
  }

  // ---- おと（Web Audio、ちいさい）----
  const sound = (() => {
    let ctx = null;
    let on = localStorage.getItem("mz-sound") !== "off";
    const ac = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());
    function note(freq, start, dur, type = "sine", gain = 0.14) {
      const c = ac();
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.value = freq;
      o.connect(g);
      g.connect(c.destination);
      const t = c.currentTime + start;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t);
      o.stop(t + dur + 0.02);
    }
    return {
      get on() { return on; },
      toggle() {
        on = !on;
        localStorage.setItem("mz-sound", on ? "on" : "off");
        if (on) this.blip();
        return on;
      },
      fanfare(power) {
        if (!on) return;
        try {
          const base = [523, 659, 784, 1047];
          base.forEach((f, i) => note(f, i * 0.12, 0.5, "triangle", 0.16));
          if (power >= 3) note(1319, 0.5, 0.7, "triangle", 0.16);
        } catch (e) {}
      },
      blip() {
        if (!on) return;
        try { note(880, 0, 0.16, "triangle", 0.12); note(1175, 0.08, 0.16, "triangle", 0.12); } catch (e) {}
      },
    };
  })();

  // ---- フィルター（ぜんぶ / みつけた / まだ）----
  function setFilter(mode) {
    filterMode = mode;
    $$("#filters .chip").forEach((b) =>
      b.classList.toggle("active", b.dataset.f === mode)
    );
    renderGrid();
  }

  // ---- はいせん ----
  function wire() {
    $("#btn-shoot").addEventListener("click", pickPhoto);
    $("#file-input").addEventListener("change", onFile);
    $("#m-close").addEventListener("click", () => $("#modal").close());
    $("#modal").addEventListener("click", (e) => {
      if (e.target.id === "modal") $("#modal").close(); // はいけいを タップで とじる
    });

    $("#fab").addEventListener("click", () => {
      // まだの むしの さいしょ、なければ すきな むし
      const yet = INSECTS.filter((i) => !isFound(i.id));
      openInsect(yet[0] || INSECTS[0]);
    });

    $$("#filters .chip").forEach((b) =>
      b.addEventListener("click", () => setFilter(b.dataset.f))
    );

    $("#cel-ok").addEventListener("click", () => {
      const ov = $("#celebrate");
      ov.classList.remove("show");
      setTimeout(() => (ov.hidden = true), 300);
    });

    const sb = $("#sound-btn");
    const refreshSound = () => (sb.textContent = sound.on ? "🔊" : "🔈");
    refreshSound();
    sb.addEventListener("click", () => { sound.toggle(); refreshSound(); });

    // だい1かいめ タップで おとを ゆるす（ブラウザの きまり）
    document.body.addEventListener("pointerdown", function once() {
      try { new (window.AudioContext || window.webkitAudioContext)().resume(); } catch (e) {}
      document.body.removeEventListener("pointerdown", once);
    }, { once: true });
  }

  // ---- スタート ----
  async function start() {
    wire();
    await reload();
    renderProgress();
    renderGrid();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {});
    }
  }

  start();
})();
