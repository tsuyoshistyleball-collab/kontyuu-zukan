/*
 * むしずかん — 虫データ
 * name  : ひらがなの なまえ（4さいでも よめる）
 * kana  : カタカナの なまえ
 * stars : レアど（1〜3）
 * color : カードの いろ
 * where : どこに いるか（ヒント）
 * fact  : ひとこと（やさしい にほんご）
 * svg   : かわいい イラスト（シルエットにも つかう）
 */

const INSECTS = [
  {
    id: "kabutomushi", name: "かぶとむし", kana: "カブトムシ", stars: 3, color: "#7c5230",
    where: "くぬぎの きの みき", fact: "つので たたかう むしの おうさま！",
    svg: `<svg viewBox="0 0 120 120"><g stroke="#2e1c0c" stroke-width="6" stroke-linecap="round">
    <path d="M44 60 L18 46"/><path d="M44 76 L14 76"/><path d="M46 90 L20 104"/>
    <path d="M76 60 L102 46"/><path d="M76 76 L106 76"/><path d="M74 90 L100 104"/></g>
    <ellipse cx="60" cy="78" rx="28" ry="34" fill="#6b4423"/><path d="M60 46 v64" stroke="#3d2713" stroke-width="3"/>
    <ellipse cx="60" cy="64" rx="24" ry="22" fill="#7c5230"/><circle cx="60" cy="42" r="13" fill="#3d2713"/>
    <path d="M60 34 Q58 12 60 6 M60 15 L50 9 M60 15 L70 9" stroke="#3d2713" stroke-width="6" fill="none" stroke-linecap="round"/>
    <ellipse cx="50" cy="60" rx="5" ry="10" fill="#a06a3a" opacity=".7"/></svg>`
  },
  {
    id: "kuwagata", name: "くわがた", kana: "クワガタ", stars: 3, color: "#3a3a3a",
    where: "きの みつが でる ところ", fact: "おおきな あごが とっても かっこいい！",
    svg: `<svg viewBox="0 0 120 120"><g stroke="#1c1c1c" stroke-width="6" stroke-linecap="round">
    <path d="M44 62 L18 50"/><path d="M44 78 L14 80"/><path d="M46 92 L22 104"/>
    <path d="M76 62 L102 50"/><path d="M76 78 L106 80"/><path d="M74 92 L98 104"/></g>
    <path d="M50 30 Q30 20 36 40 Q42 34 50 40" fill="none" stroke="#222" stroke-width="6" stroke-linecap="round"/>
    <path d="M70 30 Q90 20 84 40 Q78 34 70 40" fill="none" stroke="#222" stroke-width="6" stroke-linecap="round"/>
    <ellipse cx="60" cy="80" rx="27" ry="32" fill="#3a3130"/><path d="M60 50 v62" stroke="#141010" stroke-width="3"/>
    <ellipse cx="60" cy="66" rx="23" ry="20" fill="#4a3f3d"/><circle cx="60" cy="44" r="12" fill="#1c1c1c"/>
    <ellipse cx="51" cy="62" rx="5" ry="9" fill="#6b5b57" opacity=".7"/></svg>`
  },
  {
    id: "tentoumushi", name: "てんとうむし", kana: "テントウムシ", stars: 1, color: "#e63946",
    where: "はっぱの うえや くきの さき", fact: "あかい せなかに くろい ほしが あるよ。",
    svg: `<svg viewBox="0 0 120 120"><g stroke="#2b2b2b" stroke-width="5" stroke-linecap="round">
    <path d="M40 60 L20 50"/><path d="M40 74 L18 74"/><path d="M42 86 L22 98"/>
    <path d="M80 60 L100 50"/><path d="M80 74 L102 74"/><path d="M78 86 L98 98"/></g>
    <circle cx="60" cy="42" r="14" fill="#2b2b2b"/><circle cx="54" cy="40" r="3" fill="#fff"/><circle cx="66" cy="40" r="3" fill="#fff"/>
    <path d="M28 74 a32 32 0 0 1 64 0 a32 32 0 0 1 -64 0" fill="#e63946"/>
    <path d="M60 44 v60" stroke="#2b2b2b" stroke-width="4"/>
    <circle cx="44" cy="66" r="6" fill="#2b2b2b"/><circle cx="76" cy="66" r="6" fill="#2b2b2b"/>
    <circle cx="48" cy="86" r="6" fill="#2b2b2b"/><circle cx="72" cy="86" r="6" fill="#2b2b2b"/>
    <ellipse cx="42" cy="58" rx="6" ry="9" fill="#fff" opacity=".35"/></svg>`
  },
  {
    id: "monshirochou", name: "もんしろちょう", kana: "モンシロチョウ", stars: 1, color: "#eef1f4",
    where: "おはなばたけ", fact: "しろい はねで ひらひら とぶよ。",
    svg: `<svg viewBox="0 0 120 120"><ellipse cx="60" cy="62" rx="4" ry="26" fill="#4a4a4a"/>
    <path d="M60 30 Q56 12 62 8 M60 30 Q64 12 58 8" stroke="#4a4a4a" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M58 48 Q20 24 22 56 Q24 76 58 68 Z" fill="#f4f6f8" stroke="#d7dde2" stroke-width="2"/>
    <path d="M62 48 Q100 24 98 56 Q96 76 62 68 Z" fill="#f4f6f8" stroke="#d7dde2" stroke-width="2"/>
    <path d="M58 66 Q30 70 30 92 Q34 104 58 82 Z" fill="#eef1f4" stroke="#d7dde2" stroke-width="2"/>
    <path d="M62 66 Q90 70 90 92 Q86 104 62 82 Z" fill="#eef1f4" stroke="#d7dde2" stroke-width="2"/>
    <circle cx="38" cy="50" r="4" fill="#3a3a3a"/><circle cx="82" cy="50" r="4" fill="#3a3a3a"/></svg>`
  },
  {
    id: "agehachou", name: "あげはちょう", kana: "アゲハチョウ", stars: 2, color: "#f7c948",
    where: "おはなや みかんの き", fact: "きいろと くろの おおきな はねが きれい。",
    svg: `<svg viewBox="0 0 120 120"><ellipse cx="60" cy="62" rx="4" ry="28" fill="#2b2b2b"/>
    <path d="M60 30 Q56 12 62 8 M60 30 Q64 12 58 8" stroke="#2b2b2b" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M58 46 Q16 22 18 56 Q20 78 58 66 Z" fill="#f7c948" stroke="#2b2b2b" stroke-width="3"/>
    <path d="M62 46 Q104 22 102 56 Q100 78 62 66 Z" fill="#f7c948" stroke="#2b2b2b" stroke-width="3"/>
    <path d="M58 66 Q28 72 30 96 L46 90 Q36 100 58 84 Z" fill="#f7c948" stroke="#2b2b2b" stroke-width="3"/>
    <path d="M62 66 Q92 72 90 96 L74 90 Q84 100 62 84 Z" fill="#f7c948" stroke="#2b2b2b" stroke-width="3"/>
    <path d="M30 44 Q40 52 46 60 M90 44 Q80 52 74 60" stroke="#2b2b2b" stroke-width="3" fill="none"/>
    <circle cx="40" cy="86" r="4" fill="#e63946"/><circle cx="80" cy="86" r="4" fill="#e63946"/></svg>`
  },
  {
    id: "tonbo", name: "とんぼ", kana: "トンボ", stars: 2, color: "#e63946",
    where: "いけや たんぼの ちかく", fact: "すいすい そらを じょうずに とぶよ。",
    svg: `<svg viewBox="0 0 120 120"><ellipse cx="60" cy="66" rx="6" ry="40" fill="#e05a3a"/>
    <path d="M60 96 l-3 16 M60 96 l3 16" stroke="#c0492e" stroke-width="4" stroke-linecap="round"/>
    <circle cx="60" cy="26" r="12" fill="#d94a2e"/><circle cx="55" cy="24" r="4" fill="#2b2b2b"/><circle cx="65" cy="24" r="4" fill="#2b2b2b"/>
    <ellipse cx="34" cy="46" rx="26" ry="8" fill="#bfe6f0" opacity=".8" stroke="#7fbfd0" stroke-width="1.5" transform="rotate(-18 34 46)"/>
    <ellipse cx="86" cy="46" rx="26" ry="8" fill="#bfe6f0" opacity=".8" stroke="#7fbfd0" stroke-width="1.5" transform="rotate(18 86 46)"/>
    <ellipse cx="34" cy="62" rx="24" ry="7" fill="#d7f0f6" opacity=".8" stroke="#7fbfd0" stroke-width="1.5" transform="rotate(-8 34 62)"/>
    <ellipse cx="86" cy="62" rx="24" ry="7" fill="#d7f0f6" opacity=".8" stroke="#7fbfd0" stroke-width="1.5" transform="rotate(8 86 62)"/></svg>`
  },
  {
    id: "semi", name: "せみ", kana: "セミ", stars: 2, color: "#3f7d3f",
    where: "きの みきに とまってる", fact: "なつに みんみん げんきに なくよ。",
    svg: `<svg viewBox="0 0 120 120"><ellipse cx="42" cy="60" rx="24" ry="10" fill="#cfe6df" opacity=".7" stroke="#9dc4ba" stroke-width="1.5" transform="rotate(-14 42 60)"/>
    <ellipse cx="78" cy="60" rx="24" ry="10" fill="#cfe6df" opacity=".7" stroke="#9dc4ba" stroke-width="1.5" transform="rotate(14 78 60)"/>
    <ellipse cx="60" cy="70" rx="18" ry="34" fill="#3f5d3a"/><ellipse cx="60" cy="56" rx="16" ry="16" fill="#4a6b42"/>
    <circle cx="60" cy="34" r="13" fill="#2f4a2c"/><circle cx="52" cy="32" r="4" fill="#111"/><circle cx="68" cy="32" r="4" fill="#111"/>
    <path d="M60 88 h-8 M60 96 h-6 M60 88 h8 M60 96 h6" stroke="#243a22" stroke-width="3"/></svg>`
  },
  {
    id: "batta", name: "ばった", kana: "バッタ", stars: 1, color: "#6fae3f",
    where: "はらっぱの くさむら", fact: "ぴょーんと とおくまで とべるよ。",
    svg: `<svg viewBox="0 0 120 120"><ellipse cx="58" cy="56" rx="34" ry="14" fill="#7cbf4a" transform="rotate(-8 58 56)"/>
    <circle cx="26" cy="52" r="12" fill="#8fd15a"/><circle cx="21" cy="50" r="3.5" fill="#111"/>
    <path d="M30 42 Q20 26 12 22 M32 44 Q24 30 16 24" stroke="#5a9636" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M70 60 Q96 44 98 78 L86 66 Q92 84 70 74 Z" fill="#5a9636"/>
    <path d="M64 66 L92 96 M78 60 L98 82" stroke="#5a9636" stroke-width="5" stroke-linecap="round"/>
    <path d="M52 66 L44 96 M60 66 L56 98" stroke="#6aa840" stroke-width="4" stroke-linecap="round"/></svg>`
  },
  {
    id: "koorogi", name: "こおろぎ", kana: "コオロギ", stars: 2, color: "#5b4636",
    where: "いしや おちばの した", fact: "よるに りりりりと きれいに なくよ。",
    svg: `<svg viewBox="0 0 120 120"><ellipse cx="58" cy="60" rx="34" ry="15" fill="#4a382a" transform="rotate(-6 58 60)"/>
    <circle cx="24" cy="56" r="12" fill="#5b4636"/><circle cx="20" cy="54" r="3.5" fill="#111"/>
    <path d="M28 46 Q14 30 6 30 M30 48 Q18 34 10 34" stroke="#3a2b20" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M74 64 Q100 48 100 82 L88 70 Q94 88 72 76 Z" fill="#3a2b20"/>
    <path d="M66 70 L96 100 M80 64 L100 88" stroke="#3a2b20" stroke-width="5" stroke-linecap="round"/>
    <path d="M84 52 l16 -6 M84 58 l16 -1" stroke="#3a2b20" stroke-width="2.5" stroke-linecap="round"/></svg>`
  },
  {
    id: "kamakiri", name: "かまきり", kana: "カマキリ", stars: 3, color: "#6fae3f",
    where: "くさむらや き", fact: "かまで えものを パッと つかまえる！",
    svg: `<svg viewBox="0 0 120 120"><ellipse cx="66" cy="72" rx="12" ry="36" fill="#6fae3f" transform="rotate(10 66 72)"/>
    <path d="M60 44 Q44 40 40 24 Q52 30 58 40 M60 46 Q46 46 38 34" stroke="#5a9636" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M40 24 l-10 -2 M40 24 l-8 4" stroke="#5a9636" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="60" cy="40" rx="12" ry="10" fill="#8fd15a"/><path d="M52 34 l-8 -8 M68 34 l8 -8" stroke="#5a9636" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="53" cy="38" r="4" fill="#2f4a2c"/><circle cx="67" cy="38" r="4" fill="#2f4a2c"/>
    <path d="M64 66 l18 8 M68 80 l16 10 M70 94 l14 8" stroke="#5a9636" stroke-width="4" stroke-linecap="round"/></svg>`
  },
  {
    id: "ari", name: "あり", kana: "アリ", stars: 1, color: "#3a2b20",
    where: "じめんや ありの す", fact: "ちからもち！ みんなで はたらくよ。",
    svg: `<svg viewBox="0 0 120 120"><g stroke="#2a1e15" stroke-width="4" stroke-linecap="round">
    <path d="M54 58 L34 46"/><path d="M54 62 L32 62"/><path d="M54 66 L34 80"/>
    <path d="M58 58 L78 44"/><path d="M60 62 L84 60"/><path d="M60 66 L82 82"/></g>
    <circle cx="80" cy="62" r="16" fill="#4a3324"/><circle cx="56" cy="62" r="9" fill="#3a2b20"/><circle cx="38" cy="60" r="12" fill="#4a3324"/>
    <path d="M32 50 Q24 40 26 34 M34 50 Q30 40 34 34" stroke="#2a1e15" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="34" cy="58" r="3" fill="#111"/><ellipse cx="76" cy="56" rx="4" ry="6" fill="#6b4a35" opacity=".6"/></svg>`
  },
  {
    id: "dangomushi", name: "だんごむし", kana: "ダンゴムシ", stars: 1, color: "#7a7f88",
    where: "いしや うえきばちの した", fact: "さわると コロンと まるくなるよ。",
    svg: `<svg viewBox="0 0 120 120"><path d="M26 72 a34 30 0 0 1 68 0 Z" fill="#6b7079"/>
    <g stroke="#4a4e56" stroke-width="2.5"><path d="M38 72 v-20"/><path d="M50 72 v-30"/><path d="M62 72 v-33"/><path d="M74 72 v-30"/><path d="M84 72 v-20"/></g>
    <path d="M26 72 a34 30 0 0 1 68 0" fill="none" stroke="#565a62" stroke-width="3"/>
    <circle cx="60" cy="42" r="11" fill="#565a62"/><circle cx="55" cy="41" r="2.5" fill="#111"/><circle cx="65" cy="41" r="2.5" fill="#111"/>
    <g stroke="#4a4e56" stroke-width="3" stroke-linecap="round"><path d="M30 72 l-8 6"/><path d="M90 72 l8 6"/></g></svg>`
  },
  {
    id: "mitsubachi", name: "みつばち", kana: "ミツバチ", stars: 2, color: "#f2b705",
    where: "おはなの うえ", fact: "はなから はちみつを あつめるよ。",
    svg: `<svg viewBox="0 0 120 120"><ellipse cx="40" cy="52" rx="22" ry="12" fill="#e6ecf0" opacity=".8" stroke="#b9c6cf" stroke-width="1.5" transform="rotate(-20 40 52)"/>
    <ellipse cx="72" cy="46" rx="20" ry="11" fill="#e6ecf0" opacity=".8" stroke="#b9c6cf" stroke-width="1.5" transform="rotate(20 72 46)"/>
    <ellipse cx="60" cy="72" rx="24" ry="20" fill="#f2b705"/>
    <path d="M44 66 q16 -8 32 0 M42 78 q18 -6 36 0" stroke="#2b2b2b" stroke-width="6"/>
    <circle cx="60" cy="42" r="14" fill="#2b2b2b"/><circle cx="54" cy="40" r="3" fill="#fff"/><circle cx="66" cy="40" r="3" fill="#fff"/>
    <path d="M54 30 Q50 20 52 16 M66 30 Q70 20 68 16" stroke="#2b2b2b" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`
  },
  {
    id: "katatsumuri", name: "かたつむり", kana: "カタツムリ", stars: 1, color: "#b7d98a",
    where: "あめの ひの はっぱ", fact: "せなかに おうちを のせて いるよ。",
    svg: `<svg viewBox="0 0 120 120"><path d="M18 88 Q18 74 40 74 L84 74 Q98 74 98 86 Q98 92 90 92 L26 92 Q18 92 18 88 Z" fill="#c9a24a"/>
    <circle cx="90" cy="60" r="8" fill="#b7d98a"/>
    <path d="M84 62 Q78 42 90 40 M84 62 Q80 46 90 44" stroke="#8fae5c" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="60" cy="66" r="26" fill="#e0c56a"/><circle cx="60" cy="66" r="19" fill="none" stroke="#b98f34" stroke-width="4"/>
    <circle cx="60" cy="66" r="11" fill="none" stroke="#b98f34" stroke-width="4"/><circle cx="60" cy="66" r="4" fill="#b98f34"/>
    <circle cx="92" cy="41" r="2.5" fill="#111"/></svg>`
  },
  {
    id: "kumo", name: "くも", kana: "クモ", stars: 2, color: "#4a4453",
    where: "くもの すの まんなか", fact: "いとで じょうずに あみを つくるよ。",
    svg: `<svg viewBox="0 0 120 120"><g stroke="#3a3540" stroke-width="4" stroke-linecap="round" fill="none">
    <path d="M48 58 Q28 46 18 30"/><path d="M46 66 Q22 62 10 58"/><path d="M46 74 Q24 80 14 92"/><path d="M50 82 Q36 96 30 106"/>
    <path d="M72 58 Q92 46 102 30"/><path d="M74 66 Q98 62 110 58"/><path d="M74 74 Q96 80 106 92"/><path d="M70 82 Q84 96 90 106"/></g>
    <ellipse cx="60" cy="72" rx="20" ry="22" fill="#4a4453"/><circle cx="60" cy="50" r="14" fill="#5a5464"/>
    <circle cx="54" cy="48" r="3.5" fill="#fff"/><circle cx="66" cy="48" r="3.5" fill="#fff"/><circle cx="54" cy="48" r="1.5" fill="#111"/><circle cx="66" cy="48" r="1.5" fill="#111"/>
    <path d="M52 74 q8 6 16 0" stroke="#2f2b36" stroke-width="3" fill="none"/></svg>`
  },
  {
    id: "koganemushi", name: "こがねむし", kana: "コガネムシ", stars: 2, color: "#3fae7a",
    where: "はっぱの うえ", fact: "せなかが きらきら ひかる たからもの。",
    svg: `<svg viewBox="0 0 120 120"><g stroke="#1f6b48" stroke-width="5" stroke-linecap="round">
    <path d="M44 60 L22 50"/><path d="M44 74 L20 76"/><path d="M46 86 L24 98"/>
    <path d="M76 60 L98 50"/><path d="M76 74 L100 76"/><path d="M74 86 L96 98"/></g>
    <ellipse cx="60" cy="74" rx="26" ry="32" fill="#2f9e6a"/><path d="M60 44 v62" stroke="#1f6b48" stroke-width="3"/>
    <ellipse cx="60" cy="62" rx="22" ry="20" fill="#46c489"/><circle cx="60" cy="42" r="12" fill="#1f6b48"/>
    <ellipse cx="49" cy="58" rx="6" ry="12" fill="#b6f5d6" opacity=".7"/><ellipse cx="70" cy="86" rx="4" ry="7" fill="#b6f5d6" opacity=".5"/></svg>`
  },
  {
    id: "amenbo", name: "あめんぼ", kana: "アメンボ", stars: 2, color: "#5a6b7a",
    where: "いけや みずたまりの うえ", fact: "みずの うえを すいすい すべるよ。",
    svg: `<svg viewBox="0 0 120 120"><ellipse cx="60" cy="120" rx="120" ry="30" fill="#bfe6f0" opacity=".3"/>
    <g stroke="#3a4a56" stroke-width="3.5" stroke-linecap="round" fill="none">
    <path d="M54 52 Q30 44 12 30"/><path d="M52 62 Q22 62 6 74"/><path d="M52 72 Q30 90 20 106"/>
    <path d="M66 52 Q90 44 108 30"/><path d="M68 62 Q98 62 114 74"/><path d="M68 72 Q90 90 100 106"/></g>
    <ellipse cx="60" cy="64" rx="9" ry="24" fill="#4a5a68"/><circle cx="60" cy="42" r="9" fill="#3a4a56"/>
    <circle cx="56" cy="41" r="2.5" fill="#111"/><circle cx="64" cy="41" r="2.5" fill="#111"/></svg>`
  },
  {
    id: "suzumushi", name: "すずむし", kana: "スズムシ", stars: 3, color: "#2b2b2b",
    where: "くさむらの おくの ほう", fact: "りーんりーんと すずみたいに なくよ。",
    svg: `<svg viewBox="0 0 120 120"><ellipse cx="52" cy="66" rx="20" ry="12" fill="#2b2b2b" transform="rotate(-4 52 66)"/>
    <ellipse cx="66" cy="60" rx="20" ry="15" fill="#1f1f1f" transform="rotate(-6 66 60)"/>
    <circle cx="30" cy="62" r="11" fill="#333"/><circle cx="26" cy="60" r="3" fill="#eee"/>
    <path d="M34 52 Q18 30 8 26 M36 54 Q24 34 14 30" stroke="#1a1a1a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M78 66 Q100 52 100 84 L90 72 Q94 88 76 76 Z" fill="#1a1a1a"/>
    <path d="M72 74 L96 100 M84 68 L100 90" stroke="#1a1a1a" stroke-width="4" stroke-linecap="round"/>
    <path d="M40 74 l-6 22 M48 76 l-2 24" stroke="#333" stroke-width="2.5" stroke-linecap="round"/></svg>`
  }
];
