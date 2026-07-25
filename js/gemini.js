/*
 * むしずかん — Gemini で むしの なまえを すいそく
 * ブラウザから ちょくせつ よぶ（API キーは この たんまつだけに ほぞん）。
 */
const Gemini = (() => {
  const DEFAULT_MODEL = "gemini-3-flash-preview";

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

  const PROMPT = [
    "あなたは こども向けの こんちゅう ずかんの アシスタントです。",
    "この しゃしんに うつっている いきもの（むし・こんちゅう・くも・かたつむり・かえる など）が なにか みてください。",
    "4さいの こどもが よめるように、こたえは やさしい ひらがな で かいてください。",
    "つぎの JSON だけを かえして ください：",
    "- name: いちばん ありそうな なまえ（ひらがな。れい: かぶとむし）",
    "- kana: カタカナの なまえ（れい: カブトムシ）",
    "- is_creature: しゃしんに むし等の いきものが いるなら true、いないなら false",
    "- confidence: どれくらい じしんが あるか 0.0〜1.0 の すうじ",
    "- rarity: めずらしさ 1〜3（1=よく みる、2=ときどき、3=めずらしい）",
    "- fact: その むしの おもしろい ひとこと（やさしい ひらがな、みじかく）",
    "- where: どこで みつかるか（やさしい ひらがな、みじかく）",
    "- category: なかまわけ。つぎの どれか ひとつ： こうちゅう / ちょう・が / とんぼ / せみ / ばった・かまきり / はち・あり / くも / かたつむり / みずのむし / かえる・いきもの / そのほか",
    "いきものが いない ときは name を からっぽ、is_creature を false にして ください。",
  ].join("\n");

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
    },
    required: ["name", "is_creature", "confidence", "rarity", "fact"],
  };

  async function identify(blob, key, model) {
    if (!key) throw new Error("NO_KEY");
    const b64 = await blobToBase64(blob);
    const body = {
      contents: [
        {
          parts: [
            { text: PROMPT },
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

    let resp;
    try {
      resp = await fetch(endpoint(model || DEFAULT_MODEL, key), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e) {
      throw new Error("NETWORK");
    }

    if (!resp.ok) {
      let msg = "API " + resp.status;
      try {
        const j = await resp.json();
        if (j.error && j.error.message) msg = j.error.message;
      } catch (e) {}
      if (resp.status === 400 || resp.status === 403) throw new Error("BAD_KEY:" + msg);
      if (resp.status === 429) throw new Error("QUOTA:" + msg);
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

  return { identify, test, DEFAULT_MODEL };
})();
