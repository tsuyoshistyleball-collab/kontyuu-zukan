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
      "- rarity: めずらしさ 1〜5。1=どこにでも いる / 2=よく みる / 3=ときどき みる / 4=なかなか みない / 5=とても めずらしい（マニアが よろこぶ）",
      "- fact: その むしの おもしろい ひとこと（みじかく）",
      "- where: どこで みつかるか（みじかく）",
      "- category: おおきな なかまわけ。つぎの どれか ひとつ： こうちゅう / ちょう・が / とんぼ / せみ / ばった・かまきり / はち・あり / くも / かたつむり / みずのむし / かえる・いきもの / そのほか",
      "- family: せいぶつがくの「科（か）」の なまえ。カタカナ＋『科』で かいて ください。",
      "  れい: クワガタムシ科 / コガネムシ科 / テントウムシ科 / アゲハチョウ科 / シロチョウ科 / トンボ科 / セミ科 / バッタ科 / カマキリ科 / ミツバチ科 / アリ科 / ジョロウグモ科。",
      "  科が わからない ときは からっぽに して ください（むりに つくらない）。",
      "- trivia: まめちしき を 3つ（はいれつ。それぞれ 1ぶん・4さいが「へぇ！」と おもう ないよう）",
      "- habitat: すんで いる ところ（くわしく 1〜2ぶん。にほんの どこに いるか、どんな ばしょが すきか）",
      "- season: みられる きせつと じかんたい（れい: 6月(がつ)〜8月(がつ) の 夜(よる)）",
      "- attack: この むしの つよさ（こうげき力）。100〜900 の 10きざみの すうじ。",
      "  れい: 150 / 370 / 860。おおきい あご・つの・どく・すばやさが ある ほど たかく、",
      "  レアど（rarity）が たかい ほど たかく して ください。",
      "- defense: この むしの まもり（しゅび力）。100〜900 の 10きざみの すうじ。",
      "  かたい からだ・から・まるまる など まもりが つよい ほど たかく して ください。",
      "- hand: じゃんけんの ぞくせい。「グー」「チョキ」「パー」の どれか ひとつ。",
      "  つので おす・ぶつかる むし は グー、はさむ・きる あごや かま を もつ むし は チョキ、",
      "  はねを ひろげる・つつむ・すばやい むし は パー、を めやすに して ください。",
      "- move_name: この むしだけの「ひっさつわざ」の 名前(なまえ)。カタカナ中心(ちゅうしん)で 4〜9もじ。",
      "  その むしの からだの とくちょう（つの・かま・はね・どく・すばやさ・においなど）から かんがえて ください。",
      "  れい:「ツノクラッシュ」「カマイタリ」「ローリングガード」。",
      "- move_cry: わざを だす ときの かけ声(ごえ)。みじかく 1ぶん。れい:「くらえー！ ツノクラッシュ！」",
      "- move_kind: わざの 見(み)ため。つぎの どれか ひとつ だけ：",
      "  きり / ほのお / かみなり / かぜ / こおり / どく / ひかり / しょうげき / いわ",
      "  （あご・かま・つめ で きる わざ＝きり、つので おす・たいあたり＝しょうげき、",
      "   はねで かぜを おこす＝かぜ、どくや においを だす＝どく、すばやく ひかる＝ひかり、",
      "   かたい からだで ぶつかる＝いわ、を めやすに）",
      "- move_color: わざの いろ。#RRGGBB の かたち（れい: #ffcc33）。その むしの からだの いろに 近(ちか)い ものを。",
      "- size: その しゅるいの ふつうの おおきさ。たいちょう を cm か mm で。",
      "  れい:「体長(たいちょう) 3〜5cm（角(つの)を いれると 8cm）・重(おも)さ 5〜10g」。",
      "  ※ しゃしんから はかった ものでは なく、その しゅるいの ふつうの おおきさを かいて ください。",
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
      "- rarity: めずらしさ 1〜5。1=どこにでも いる / 2=よく みる / 3=ときどき みる / 4=なかなか みない / 5=とても めずらしい（マニアが よろこぶ）",
      "- fact: その おはなの おもしろい ひとこと（みじかく）",
      "- where: どこで みつかるか・いつ さくか（みじかく）",
      "- category: おおきな なかまわけ。つぎの どれか ひとつ： きの おはな / みちばたの おはな / にわの おはな / はっぱ・くさ / み・たね・どんぐり / きのこ / そのほか",
      "- family: しょくぶつの「科（か）」の なまえ。カタカナ＋『科』で かいて ください。",
      "  れい: キク科 / バラ科 / マメ科 / ユリ科 / アブラナ科 / ヒルガオ科 / ブナ科 / ムクロジ科 / ツツジ科 / シソ科。",
      "  科が わからない ときは からっぽに して ください（むりに つくらない）。",
      "- trivia: まめちしき を 3つ（はいれつ。それぞれ 1ぶん・4さいが「へぇ！」と おもう ないよう）",
      "- habitat: はえて いる ところ（くわしく 1〜2ぶん。にほんの どこに はえるか、ひなた/ひかげ など）",
      "- season: はなが さく きせつ（れい: 3月(がつ)〜5月(がつ)）",
      "- move_name: この 花(はな)だけの「ひっさつわざ」の 名前(なまえ)。カタカナ中心(ちゅうしん)で 4〜9もじ。",
      "  その 花(はな)の からだの とくちょう（つの・かま・はね・どく・すばやさ・においなど）から かんがえて ください。",
      "  れい:「ツノクラッシュ」「カマイタリ」「ローリングガード」。",
      "- move_cry: わざを だす ときの かけ声(ごえ)。みじかく 1ぶん。れい:「くらえー！ ツノクラッシュ！」",
      "- move_kind: わざの 見(み)ため。つぎの どれか ひとつ だけ：",
      "  きり / ほのお / かみなり / かぜ / こおり / どく / ひかり / しょうげき / いわ",
      "  （あご・かま・つめ で きる わざ＝きり、つので おす・たいあたり＝しょうげき、",
      "   はねで かぜを おこす＝かぜ、どくや においを だす＝どく、すばやく ひかる＝ひかり、",
      "   かたい からだで ぶつかる＝いわ、を めやすに）",
      "- move_color: わざの いろ。#RRGGBB の かたち（れい: #ffcc33）。その 花(はな)の からだの いろに 近(ちか)い ものを。",
      "- attack: この しょくぶつの つよさ（こうげき力）。100〜900 の 10きざみの すうじ。",
      "  とげ・どく・せの たかさ・はなの おおきさが ある ほど たかく、",
      "  レアど（rarity）が たかい ほど たかく して ください。",
      "- defense: まもり（しゅび力）。100〜900 の 10きざみの すうじ。",
      "  かたい み・から・ふとい みき・つよい ねっこ ほど たかく して ください。",
      "- hand: じゃんけんの ぞくせい。「グー」「チョキ」「パー」の どれか ひとつ。",
      "  まるい み・つぼみ・どんぐり は グー、とがった は・とげ は チョキ、",
      "  ひろがる はなびら・はっぱ は パー、を めやすに して ください。",
      "- size: その しゅるいの ふつうの おおきさ。はなの おおきさと せの たかさを。",
      "  れい:「花(はな) 3〜5cm・高(たか)さ 10〜30cm」。",
      "  ※ しゃしんから はかった ものでは なく、その しゅるいの ふつうの おおきさを かいて ください。",
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
      size: { type: "STRING" },
      care: { type: "STRING" },
      attack: { type: "INTEGER" },
      defense: { type: "INTEGER" },
      hand: { type: "STRING" },
      move_name: { type: "STRING" },
      move_cry: { type: "STRING" },
      move_kind: { type: "STRING" },
      move_color: { type: "STRING" },
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
      size: { type: "STRING" },
      care: { type: "STRING" },
      attack: { type: "INTEGER" },
      defense: { type: "INTEGER" },
      hand: { type: "STRING" },
      move_name: { type: "STRING" },
      move_cry: { type: "STRING" },
      move_kind: { type: "STRING" },
      move_color: { type: "STRING" },
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
      "- attack: こうげき力 100〜900（10きざみ）。つよい むし ほど たかく。",
      "- defense: しゅび力 100〜900（10きざみ）。まもりが かたい ほど たかく。",
      "- hand: じゃんけんの ぞくせい「グー」「チョキ」「パー」の どれか ひとつ。",
      "- move_name: この むしだけの「ひっさつわざ」の 名前(なまえ)。カタカナ中心(ちゅうしん)で 4〜9もじ。",
      "  その むしの からだの とくちょう（つの・かま・はね・どく・すばやさ・においなど）から かんがえて ください。",
      "  れい:「ツノクラッシュ」「カマイタリ」「ローリングガード」。",
      "- move_cry: わざを だす ときの かけ声(ごえ)。みじかく 1ぶん。れい:「くらえー！ ツノクラッシュ！」",
      "- move_kind: わざの 見(み)ため。つぎの どれか ひとつ だけ：",
      "  きり / ほのお / かみなり / かぜ / こおり / どく / ひかり / しょうげき / いわ",
      "  （あご・かま・つめ で きる わざ＝きり、つので おす・たいあたり＝しょうげき、",
      "   はねで かぜを おこす＝かぜ、どくや においを だす＝どく、すばやく ひかる＝ひかり、",
      "   かたい からだで ぶつかる＝いわ、を めやすに）",
      "- move_color: わざの いろ。#RRGGBB の かたち（れい: #ffcc33）。その むしの からだの いろに 近(ちか)い ものを。",
      "- size: その しゅるいの ふつうの おおきさ（体長(たいちょう)。おもさも わかれば）",
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
      "- attack: こうげき力 100〜900（10きざみ）。",
      "- defense: しゅび力 100〜900（10きざみ）。",
      "- hand: じゃんけんの ぞくせい「グー」「チョキ」「パー」の どれか ひとつ。",
      "- move_name: この 花(はな)だけの「ひっさつわざ」の 名前(なまえ)。カタカナ中心(ちゅうしん)で 4〜9もじ。",
      "  その 花(はな)の とくちょう（つの・かま・はね・どく・すばやさ・においなど）から かんがえて ください。",
      "  れい:「ツノクラッシュ」「カマイタリ」「ローリングガード」。",
      "- move_cry: わざを だす ときの かけ声(ごえ)。みじかく 1ぶん。れい:「くらえー！ ツノクラッシュ！」",
      "- move_kind: わざの 見(み)ため。つぎの どれか ひとつ だけ：",
      "  きり / ほのお / かみなり / かぜ / こおり / どく / ひかり / しょうげき / いわ",
      "  （あご・かま・つめ で きる わざ＝きり、つので おす・たいあたり＝しょうげき、",
      "   はねで かぜを おこす＝かぜ、どくや においを だす＝どく、すばやく ひかる＝ひかり、",
      "   かたい からだで ぶつかる＝いわ、を めやすに）",
      "- move_color: わざの いろ。#RRGGBB の かたち（れい: #ffcc33）。その 花(はな)の いろに 近(ちか)い ものを。",
      "- size: その しゅるいの ふつうの おおきさ（花(はな)の おおきさ・せの たかさ）",
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
    const resp = await callGemini(model, key, {
      contents: [{ parts: [{ text: make(name) }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: DETAIL_SCHEMA, temperature: 0.3 },
    });
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
  // サーバーが こんで いる（503 / overloaded / high demand）？
  const isBusy = (status, msg) =>
    status === 503 || status === 502 ||
    /overload|high demand|unavailable|try again later/i.test(String(msg || ""));

  /* Gemini を よぶ。こんで いる ときは すこし まって もういちど。
     429（つかいすぎ）と 503（こんで いる）を どちらも あつかう。*/
  async function callGemini(model, key, body, onWait) {
    for (let attempt = 0; ; attempt++) {
      let resp = null;
      try {
        resp = await fetch(endpoint(model || DEFAULT_MODEL, key), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (e) { throw new Error("NETWORK"); }
      if (resp.ok) return resp;

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
          continue;
        }
        throw new Error((info.daily ? "QUOTA_DAY:" : "QUOTA:") + (info.quotaId ? info.quotaId + " / " : "") + msg);
      }
      if (isBusy(resp.status, msg)) {
        if (attempt < MAX_RETRY) {
          const wait = 3 + attempt * 4;                 // 3びょう → 7びょう
          if (typeof onWait === "function") onWait(wait, attempt + 1);
          await sleep(wait * 1000);
          continue;
        }
        throw new Error("BUSY:" + msg);
      }
      if (resp.status >= 500 && attempt < MAX_RETRY) { await sleep(2000 * (attempt + 1)); continue; }
      throw new Error("API:" + msg);
    }
  }

  // ぶんあたりの せいげんは まてば なおるので、じどうで リトライする
  const MAX_RETRY = 2;
  const MAX_WAIT_S = 40;

  /* しゃしんは 1まいでも、はいれつで 何まいでも わたせる。
     何まいか わたすと「おなじ 1ぴきを ちがう むきから とった もの」として
     まとめて 見て もらえる ので、あたりやすく なる。*/
  async function identify(blob, key, model, onWait, kind) {
    if (!key) throw new Error("NO_KEY");
    const blobs = (Array.isArray(blob) ? blob : [blob]).filter(Boolean).slice(0, 4);
    if (!blobs.length) throw new Error("NO_IMAGE");
    const b64s = [];
    for (const b of blobs) b64s.push(await blobToBase64(b));
    const many = b64s.length > 1
      ? `\n【しゃしんに ついて】これは おなじ 1ぴき（1つ）を ${b64s.length}まい、` +
        "ちがう むき・ちがい あかるさで とった ものです。" +
        "ぜんぶの しゃしんを あわせて 見て、いちばん あう なまえを 1つ こたえて ください。" +
        "とくちょうが よく 見える しゃしんを 手がかりに して ください。"
      : "";
    const body = {
      contents: [
        {
          parts: [
            { text: promptFor(kind) + many },
            ...b64s.map((d) => ({ inline_data: { mime_type: "image/jpeg", data: d } })),
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        temperature: 0.2,
      },
    };

    const resp = await callGemini(model, key, body, onWait);
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
    const resp = await callGemini(model, key, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: CLASSIFY_SCHEMA,
        temperature: 0,
      },
    });
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
