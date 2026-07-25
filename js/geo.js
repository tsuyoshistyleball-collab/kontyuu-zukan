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

  return { current, search, reverse, distance, tileUrl, mapLink };
})();
