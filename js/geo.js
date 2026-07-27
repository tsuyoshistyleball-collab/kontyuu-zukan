/*
 * むしずかん — いちじょうほう（GPS）と ばしょの けんさく
 * ・げんざいち: navigator.geolocation（HTTPS ひつよう）
 * ・けんさく / ぎゃくジオコーディング: OpenStreetMap Nominatim（むりょう・キー不要）
 * ・ちずの がぞう: OpenStreetMap の タイル
 */
const Geo = (() => {
  const NOMINATIM = "https://nominatim.openstreetmap.org";

  // いまいる ばしょ（いど・けいど）
  function current(timeout = 12000) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("この きかいでは いちじょうほうが つかえません"));
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }),
        (err) => {
          const msg =
            err.code === 1 ? "いちじょうほうの きょかが ひつようです" :
            err.code === 2 ? "いまの ばしょが わかりませんでした" :
            "いちじょうほうの しゅとくに じかんが かかりました";
          reject(new Error(msg));
        },
        { enableHighAccuracy: true, timeout, maximumAge: 60000 }
      );
    });
  }

  // なまえで ばしょを さがす
  async function search(query) {
    const url = `${NOMINATIM}/search?format=jsonv2&limit=6&accept-language=ja&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("けんさく できませんでした（" + res.status + "）");
    const rows = await res.json();
    return rows.map((r) => ({
      name: shortName(r.display_name),
      address: r.display_name,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    }));
  }

  // いど・けいど → じゅうしょ
  async function reverse(lat, lng) {
    const url = `${NOMINATIM}/reverse?format=jsonv2&accept-language=ja&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("ばしょの なまえが わかりませんでした");
    const r = await res.json();
    return { name: shortName(r.display_name), address: r.display_name || "", lat, lng };
  }

  /* いまいる ばしょの ちかくに ある「なまえの ある ばしょ」を さがす。
     OpenStreetMap の Overpass を つかう（むりょう・キー不要）。
     こうえん・もり・かわ・がっこう など、むし とりに いきそうな ところを ひろう。*/
  async function nearby(lat, lng, radius = 900) {
    const q = `[out:json][timeout:20];(` +
      `nwr(around:${radius},${lat},${lng})[leisure~"^(park|garden|nature_reserve|playground|pitch)$"][name];` +
      `nwr(around:${radius},${lat},${lng})[landuse~"^(forest|meadow|grass|orchard|farmland)$"][name];` +
      `nwr(around:${radius},${lat},${lng})[natural~"^(wood|water|beach|scrub|wetland)$"][name];` +
      `nwr(around:${radius},${lat},${lng})[tourism~"^(zoo|camp_site|picnic_site|attraction|museum)$"][name];` +
      `nwr(around:${radius},${lat},${lng})[amenity~"^(school|kindergarten|community_centre)$"][name];` +
      `nwr(around:${radius},${lat},${lng})[waterway~"^(river|stream)$"][name];` +
      `);out center 40;`;
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(q),
    });
    if (!res.ok) throw new Error("ちかくの ばしょが しらべられませんでした");
    const j = await res.json();
    const here = { lat, lng };
    const seen = new Set();
    const out = [];
    for (const el of j.elements || []) {
      const t = el.tags || {};
      const nm = (t["name:ja"] || t.name || "").trim();
      if (!nm || seen.has(nm)) continue;
      seen.add(nm);
      const c = el.center || el;
      if (c.lat == null || c.lon == null) continue;
      out.push({
        name: nm,
        address: kindOf(t),
        lat: c.lat, lng: c.lon,
        dist: Math.round(distance(here, { lat: c.lat, lng: c.lon })),
        emoji: emojiOf(t),
      });
    }
    out.sort((a, b) => a.dist - b.dist);
    return out.slice(0, 8);
  }
  // どんな ところ？（にほんごの ラベルと えもじ）
  function kindOf(t) {
    if (t.leisure === "park") return "公園(こうえん)";
    if (t.leisure === "garden") return "庭園(ていえん)";
    if (t.leisure === "nature_reserve") return "自然(しぜん)の 森(もり)";
    if (t.leisure === "playground") return "あそび場(ば)";
    if (t.leisure === "pitch") return "グラウンド";
    if (t.landuse === "forest" || t.natural === "wood") return "森(もり)・林(はやし)";
    if (t.landuse === "meadow" || t.landuse === "grass") return "草(くさ)むら";
    if (t.landuse === "orchard") return "くだもの畑(ばたけ)";
    if (t.landuse === "farmland") return "畑(はたけ)・田(た)んぼ";
    if (t.natural === "water" || t.waterway) return "川(かわ)・池(いけ)";
    if (t.natural === "beach") return "うみべ";
    if (t.tourism === "zoo") return "どうぶつえん";
    if (t.tourism === "camp_site") return "キャンプ場(じょう)";
    if (t.tourism === "picnic_site") return "ピクニック場(じょう)";
    if (t.amenity === "school") return "学校(がっこう)";
    if (t.amenity === "kindergarten") return "ようちえん・ほいくえん";
    return "ちかくの ばしょ";
  }
  function emojiOf(t) {
    if (t.leisure === "park" || t.leisure === "garden") return "🌳";
    if (t.leisure === "nature_reserve" || t.landuse === "forest" || t.natural === "wood") return "🌲";
    if (t.natural === "water" || t.waterway) return "🏞️";
    if (t.natural === "beach") return "🏖️";
    if (t.tourism === "camp_site") return "🏕️";
    if (t.landuse === "meadow" || t.landuse === "grass" || t.landuse === "farmland") return "🌿";
    if (t.amenity === "school" || t.amenity === "kindergarten") return "🏫";
    if (t.leisure === "playground") return "🏡";
    return "🌳";
  }

  // ながい じゅうしょ → みじかい なまえ
  function shortName(display) {
    if (!display) return "";
    const parts = display.split(",").map((s) => s.trim()).filter(Boolean);
    return parts[0] || display;
  }

  // 2てんの きょり（メートル）
  function distance(a, b) {
    if (!a || !b || a.lat == null || b.lat == null) return Infinity;
    const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  // ちずの タイル がぞう（OpenStreetMap）
  function tileUrl(lat, lng, z = 15) {
    const n = Math.pow(2, z);
    const x = Math.floor(((lng + 180) / 360) * n);
    const r = (lat * Math.PI) / 180;
    const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
    return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  }

  // ちずアプリで ひらく リンク
  function mapLink(lat, lng) {
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
  }

  return { current, search, reverse, nearby, distance, tileUrl, mapLink };
})();
