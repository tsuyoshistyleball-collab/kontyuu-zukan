/*
 * むしずかん — Gemini で むしの なまえを すいそく
 * ブラウザから ちょくせつ よぶ（API キーは この たんまつだけに ほぞん）。
 */
const Gemini = (() => {
  const DEFAULT_MODEL = "gemini-3.1-flash-lite";
  // ふるい たんまつに のこっている モデルめいは あたらしい ものに いれかえる
  const OUTDATED_MODELS = ["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.5-flash-lite"];

  function endpoint(model, key) {
    return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(key)}`;
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1]);
      r.onerror = () => reject(new Error("よみこみ しっぱい"));
      r.readAsDataURL(blob);
    });
  }

  const PROMPTS = {
    mushi: [
      "あなたは こども向けの こんちゅう ずかんの アシスタントです。",
      "この しゃしんに うつっている いきもの（むし・こんちゅう・くも・かたつむり・かえる など）が なにか みてください。",
      "つぎの JSON だけを かえして ください：",
      "- name: いちばん ありそうな なまえ（ひらがな。れい: かぶとむし）",
      "- kana: カタカナの なまえ（れい: カブトムシ）",
      "- is_creature: しゃしんに むし等の いきものが いるなら true、いないなら false",
      "- confidence: どれくらい じしんが あるか 0.0〜1.0 の すうじ",
      "- rarity: めずらしさ 1〜3（1=よく みる、2=ときどき、3=めずらしい）",
      "- fact: その むしの おもしろい ひとこと（みじかく）",
      "- where: どこで みつかるか（みじかく）",
      "- category: おおきな なかまわけ。つぎの どれか ひとつ： こうちゅう / ちょう・が / とんぼ / せみ / ばった・かまきり / はち・あり / くも / かたつむり / みずのむし / かえる・いきもの / そのほか",
      "- family: せいぶつがくの「科（か）」の なまえ。カタカナ＋『科』で かいて ください。",
      "  れい: クワガタムシ科 / コガネムシ科 / テントウムシ科 / アゲハチョウ科 / シロチョウ科 / トンボ科 / セミ科 / バッタ科 / カマキリ科 / ミツバチ科 / アリ科 / ジョロウグモ科。",
      "  科が わからない ときは からっぽに して ください（むりに つくらない）。",
      "- trivia: まめちしき を 3つ（はいれつ。それぞれ 1ぶん・4さいが「へぇ！」と おもう ないよう）",
      "- habitat: すんで いる ところ（くわしく 1〜2ぶん。にほんの どこに いるか、どんな ばしょが すきか）",
      "- season: みられる きせつと じかんたい（れい: 6月(がつ)〜8月(がつ) の 夜(よる)）",
      "- food: たべもの（みじかく）",
      "- care: かいかた。おうちで かえる なら えさ・いれもの・きを つける ことを みじかく。",
      "  かうのが むずかしい むしは「飼(か)うのは 難(むずか)しいよ。見(み)たら そっと 逃(に)がして あげてね」の ように かいて ください。",
      "【かきかたの きまり】name と kana いがい の ぶんしょうは、かんじを つかい、",
      "  かんじの すぐ あとに よみがなを まるかっこで つけて ください。",
      "  れい：「大(おお)きな 角(つの)」「本州(ほんしゅう)の 林(はやし)」「6月(がつ)〜8月(がつ)」。",
      "  4さいが よめるように、たんごの あいだは はんかくスペースで くぎって ください。",
      "  name は ひらがな だけ、kana は カタカナ だけ（ふりがなの かっこは つけない）。",
      "いきものが いない ときは name を からっぽ、is_creature を false にして ください。",
    ].join("\n"),
    hana: [
      "あなたは こども向けの しょくぶつ（おはな）ずかんの アシスタントです。",
      "この しゃしんに うつっている しょくぶつ（おはな・くさ・はっぱ・き・きのみ・どんぐり・きのこ など）が なにか みてください。",
      "つぎの JSON だけを かえして ください：",
      "- name: いちばん ありそうな なまえ（ひらがな。れい: たんぽぽ）",
      "- kana: カタカナの なまえ（れい: タンポポ）",
      "- is_creature: しゃしんに しょくぶつ等が うつって いるなら true、ないなら false",
      "- confidence: どれくらい じしんが あるか 0.0〜1.0 の すうじ",
      "- rarity: めずらしさ 1〜3（1=よく みる、2=ときどき、3=めずらしい）",
      "- fact: その おはなの おもしろい ひとこと（みじかく）",
      "- where: どこで みつかるか・いつ さくか（みじかく）",
      "- category: おおきな なかまわけ。つぎの どれか ひとつ： きの おはな / みちばたの おはな / にわの おはな / はっぱ・くさ / み・たね・どんぐり / きのこ / そのほか",
      "- family: しょくぶつの「科（か）」の なまえ。カタカナ＋『科』で かいて ください。",
      "  れい: キク科 / バラ科 / マメ科 / ユリ科 / アブラナ科 / ヒルガオ科 / ブナ科 / ムクロジ科 / ツツジ科 / シソ科。",
      "  科が わからない ときは からっぽに して ください（むりに つくらない）。",
      "- trivia: まめちしき を 3つ（はいれつ。それぞれ 1ぶん・4さいが「へぇ！」と おもう ないよう）",
      "- habitat: はえて いる ところ（くわしく 1〜2ぶん。にほんの どこに はえるか、ひなた/ひかげ など）",
      "- season: はなが さく きせつ（れい: 3月(がつ)〜5月(がつ)）",
      "- food: そだつのに すきな もの（ひあたり・みず・つち など、みじかく）",
      "- care: そだてかた。たねや なえから そだてる ほうほうを みじかく。",
      "  そだてるのが むずかしい ときは「育(そだ)てるのは 難(むずか)しいよ。外(そと)で 見(み)て 楽(たの)しもう」の ように かいて ください。",
      "  さわると あぶない しょくぶつは、そのことも かいて ください。",
      "【かきかたの きまり】name と kana いがい の ぶんしょうは、かんじを つかい、",
      "  かんじの すぐ あとに よみがなを まるかっこで つけて ください。",
      "  れい：「大(おお)きな 角(つの)」「本州(ほんしゅう)の 林(はやし)」「6月(がつ)〜8月(がつ)」。",
      "  4さいが よめるように、たんごの あいだは はんかくスペースで くぎって ください。",
      "  name は ひらがな だけ、kana は カタカナ だけ（ふりがなの かっこは つけない）。",
      "しょくぶつが ない ときは name を からっぽ、is_creature を false にして ください。",
    ].join("\n"),
  };
  const promptFor = (kind) => PROMPTS[kind === "hana" ? "hana" : "mushi"];

  const SCHEMA = {
    type: "OBJECT",
    properties: {
      name: { type: "STRING" },
      kana: { type: "STRING" },
      is_creature: { type: "BOOLEAN" },
      confidence: { type: "NUMBER" },
      rarity: { type: "INTEGER" },
      fact: { type: "STRING" },
      where: { type: "STRING" },
      category: { type: "STRING" },
      family: { type: "STRING" },
      trivia: { type: "ARRAY", items: { type: "STRING" } },
      habitat: { type: "STRING" },
      season: { type: "STRING" },
      food: { type: "STRING" },
      care: { type: "STRING" },
    },
    required: ["name", "is_creature", "confidence", "rarity", "fact"],
  };

  /* なまえだけ わかって いる ものを、あとから くわしく しらべる（もじだけ・やすい）*/
  const DETAIL_SCHEMA = {
    type: "OBJECT",
    properties: {
      fact: { type: "STRING" },
      family: { type: "STRING" },
      trivia: { type: "ARRAY", items: { type: "STRING" } },
      habitat: { type: "STRING" },
      season: { type: "STRING" },
      food: { type: "STRING" },
      care: { type: "STRING" },
    },
    required: ["trivia", "habitat", "season", "care"],
  };

  const DETAIL_PROMPT = {
    mushi: (name) => [
      "あなたは こども向けの こんちゅう ずかんの アシスタントです。",
      `「${name}」に ついて、4さいの こどもが よめる やさしい ひらがな で おしえて ください。`,
      "つぎの JSON だけを かえして ください：",
      "- fact: おもしろい ひとこと（みじかく）",
      "- family: せいぶつがくの「科（か）」の なまえ（カタカナ＋『科』。れい: クワガタムシ科）。わからなければ からっぽ。",
      "- trivia: まめちしき を 3つ（はいれつ。それぞれ 1ぶん）",
      "- habitat: すんで いる ところ（くわしく 1〜2ぶん）",
      "- season: みられる きせつと じかんたい",
      "- food: たべもの（みじかく）",
      "- care: かいかた。かうのが むずかしい ときは「飼(か)うのは 難(むずか)しいよ。そっと 逃(に)がして あげてね」の ように かいて ください。",
      "【かきかたの きまり】ぶんしょうは、かんじを つかい、",
      "  かんじの すぐ あとに よみがなを まるかっこで つけて ください。れい：「大(おお)きな 角(つの)」「本州(ほんしゅう)の 林(はやし)」。",
      "  4さいが よめるように、たんごの あいだは はんかくスペースで くぎって ください。",
    ].join("\n"),
    hana: (name) => [
      "あなたは こども向けの しょくぶつ ずかんの アシスタントです。",
      `「${name}」に ついて、4さいの こどもが よめる やさしい ひらがな で おしえて ください。`,
      "つぎの JSON だけを かえして ください：",
      "- fact: おもしろい ひとこと（みじかく）",
      "- family: しょくぶつの「科（か）」の なまえ（カタカナ＋『科』。れい: キク科）。わからなければ からっぽ。",
      "- trivia: まめちしき を 3つ（はいれつ。それぞれ 1ぶん）",
      "- habitat: はえて いる ところ（くわしく 1〜2ぶん）",
      "- season: はなが さく きせつ",
      "- food: そだつのに すきな もの（ひあたり・みず・つち など）",
      "- care: そだてかた。むずかしい ときは「育(そだ)てるのは 難(むずか)しいよ。外(そと)で 見(み)て 楽(たの)しもう」の ように かいて ください。",
      "さわると あぶない しょくぶつは、care に そのことも かいて ください。",
      "【かきかたの きまり】ぶんしょうは、かんじを つかい、",
      "  かんじの すぐ あとに よみがなを まるかっこで つけて ください。れい：「大(おお)きな 角(つの)」「本州(ほんしゅう)の 林(はやし)」。",
      "  4さいが よめるように、たんごの あいだは はんかくスペースで くぎって ください。",
    ].join("\n"),
  };

  async function details(name, key, model, kind) {
    if (!key) throw new Error("NO_KEY");
    if (!name) throw new Error("NO_NAME");
    const make = DETAIL_PROMPT[kind === "hana" ? "hana" : "mushi"];
    const resp = await fetch(endpoint(model || DEFAULT_MODEL, key), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: make(name) }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: DETAIL_SCHEMA, temperature: 0.3 },
      }),
    });
    if (!resp.ok) {
      let j = null;
      try { j = await resp.json(); } catch (e) {}
      const info = parseApiError(j);
      const msg = info.message || "API " + resp.status;
      if (resp.status === 400 || resp.status === 403) throw new Error("BAD_KEY:" + msg);
      if (resp.status === 429) throw new Error((info.daily ? "QUOTA_DAY:" : "QUOTA:") + msg);
      throw new Error("API:" + msg);
    }
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    try { return JSON.parse(text); } catch (e) { return {}; }
  }

  // Google からの エラーを よみとく（429の りゆうと まちじかん）
  function parseApiError(j) {
    const e = (j && j.error) || {};
    const out = { message: e.message || "", retry: 0, daily: false, quotaId: "" };
    for (const d of e.details || []) {
      const t = String(d["@type"] || "");
      if (t.indexOf("RetryInfo") >= 0 && d.retryDelay) {
        out.retry = parseFloat(String(d.retryDelay).replace(/[^0-9.]/g, "")) || 0;
      }
      if (t.indexOf("QuotaFailure") >= 0) {
        for (const v of d.violations || []) {
          const id = v.quotaId || "";
          if (id) out.quotaId = id;
          if (/PerDay/i.test(id)) out.daily = true;
        }
      }
    }
    if (/per day|perday|daily/i.test(out.message)) out.daily = true;
    return out;
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ぶんあたりの せいげんは まてば なおるので、じどうで リトライする
  const MAX_RETRY = 2;
  const MAX_WAIT_S = 40;

  async function identify(blob, key, model, onWait, kind) {
    if (!key) throw new Error("NO_KEY");
    const b64 = await blobToBase64(blob);
    const body = {
      contents: [
        {
          parts: [
            { text: promptFor(kind) },
            { inline_data: { mime_type: "image/jpeg", data: b64 } },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        temperature: 0.2,
      },
    };

    let resp = null;
    for (let attempt = 0; ; attempt++) {
      try {
        resp = await fetch(endpoint(model || DEFAULT_MODEL, key), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (e) {
        throw new Error("NETWORK");
      }
      if (resp.ok) break;

      let j = null;
      try { j = await resp.json(); } catch (e) {}
      const info = parseApiError(j);
      const msg = info.message || "API " + resp.status;

      if (resp.status === 400 || resp.status === 403) throw new Error("BAD_KEY:" + msg);
      if (resp.status === 429) {
        const wait = Math.min(Math.max(info.retry || 6, 3), MAX_WAIT_S);
        if (!info.daily && attempt < MAX_RETRY) {
          if (typeof onWait === "function") onWait(Math.ceil(wait), attempt + 1);
          await sleep(wait * 1000);
          continue; // まってから もういちど
        }
        const tag = info.daily ? "QUOTA_DAY:" : "QUOTA:";
        throw new Error(tag + (info.quotaId ? info.quotaId + " / " : "") + msg);
      }
      if (resp.status >= 500 && attempt < MAX_RETRY) { await sleep(2000 * (attempt + 1)); continue; }
      throw new Error("API:" + msg);
    }

    const data = await resp.json();
    const text =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;
    let obj = {};
    try {
      obj = JSON.parse(text || "{}");
    } catch (e) {
      obj = {};
    }
    return obj;
  }

  // せつぞく テスト（ちいさな てきすとだけ）
  async function test(key, model) {
    const resp = await fetch(endpoint(model || DEFAULT_MODEL, key), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "ping. reply with ok." }] }],
      }),
    });
    if (!resp.ok) {
      let msg = "API " + resp.status;
      try {
        const j = await resp.json();
        if (j.error && j.error.message) msg = j.error.message;
      } catch (e) {}
      throw new Error(msg);
    }
    return true;
  }


  // なまえの リストを まとめて なかまわけ（もじだけ・やすい）
  const CATS = {
    mushi: "こうちゅう / ちょう・が / とんぼ / せみ / ばった・かまきり / はち・あり / くも / かたつむり / みずのむし / かえる・いきもの / そのほか",
    hana: "きの おはな / みちばたの おはな / にわの おはな / はっぱ・くさ / み・たね・どんぐり / きのこ / そのほか",
  };
  const CLASSIFY_SCHEMA = {
    type: "OBJECT",
    properties: {
      items: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: { name: { type: "STRING" }, category: { type: "STRING" }, family: { type: "STRING" } },
          required: ["name", "category", "family"],
        },
      },
    },
    required: ["items"],
  };

  async function classifyNames(names, key, model, kind) {
    if (!key) throw new Error("NO_KEY");
    if (!names || !names.length) return {};
    const isHana = kind === "hana";
    const prompt =
      (isHana ? "つぎの しょくぶつの なまえを、" : "つぎの いきものの なまえを、") +
      "それぞれ なかまわけ して ください。\n" +
      "category は かならず つぎの どれか ひとつ：" + (isHana ? CATS.hana : CATS.mushi) + "\n" +
      (isHana ? "" : "むし以外（かえる・とかげ など）は「かえる・いきもの」に して ください。\n") +
      "family は せいぶつがくの「科（か）」の なまえを カタカナ＋『科』で かいて ください" +
      (isHana ? "（れい: キク科 / バラ科 / ユリ科 / マメ科 / ブナ科）。" : "（れい: クワガタムシ科 / コガネムシ科 / アゲハチョウ科 / トンボ科 / アリ科）。") +
      "わからない ときは からっぽに して ください。\n" +
      "なまえ：\n" + names.map((n) => "- " + n).join("\n");
    const resp = await fetch(endpoint(model || DEFAULT_MODEL, key), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: CLASSIFY_SCHEMA,
          temperature: 0,
        },
      }),
    });
    if (!resp.ok) {
      let msg = "API " + resp.status;
      try { const j = await resp.json(); if (j.error && j.error.message) msg = j.error.message; } catch (e) {}
      throw new Error(msg);
    }
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let obj = {};
    try { obj = JSON.parse(text); } catch (e) { obj = {}; }
    const out = {};
    for (const it of obj.items || []) {
      if (it && it.name) out[it.name] = { category: it.category || "", family: (it.family || "").trim() };
    }
    return out;
  }

  return { identify, test, classifyNames, details, DEFAULT_MODEL, OUTDATED_MODELS };
})();
