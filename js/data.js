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
    where: "くぬぎの 木(き)の 幹(みき)", fact: "角(つの)で 戦(たたか)う 虫(むし)の 王様(おうさま)！",
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
    where: "木(き)の 蜜(みつ)が 出(で)る ところ", fact: "大(おお)きな あごが とっても かっこいい！",
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
    where: "葉(は)っぱの 上(うえ)や 茎(くき)の 先(さき)", fact: "赤(あか)い 背中(せなか)に 黒(くろ)い 星(ほし)が あるよ。",
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
    where: "お花畑(はなばたけ)", fact: "白(しろ)い 羽(はね)で ひらひら 飛(と)ぶよ。",
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
    where: "お花(はな)や みかんの 木(き)", fact: "黄色(きいろ)と 黒(くろ)の 大(おお)きな 羽(はね)が きれい。",
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
    where: "池(いけ)や 田(た)んぼの 近(ちか)く", fact: "すいすい 空(そら)を 上手(じょうず)に 飛(と)ぶよ。",
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
    where: "木(き)の 幹(みき)に とまってる", fact: "夏(なつ)に みんみん 元気(げんき)に 鳴(な)くよ。",
    svg: `<svg viewBox="0 0 120 120"><ellipse cx="42" cy="60" rx="24" ry="10" fill="#cfe6df" opacity=".7" stroke="#9dc4ba" stroke-width="1.5" transform="rotate(-14 42 60)"/>
    <ellipse cx="78" cy="60" rx="24" ry="10" fill="#cfe6df" opacity=".7" stroke="#9dc4ba" stroke-width="1.5" transform="rotate(14 78 60)"/>
    <ellipse cx="60" cy="70" rx="18" ry="34" fill="#3f5d3a"/><ellipse cx="60" cy="56" rx="16" ry="16" fill="#4a6b42"/>
    <circle cx="60" cy="34" r="13" fill="#2f4a2c"/><circle cx="52" cy="32" r="4" fill="#111"/><circle cx="68" cy="32" r="4" fill="#111"/>
    <path d="M60 88 h-8 M60 96 h-6 M60 88 h8 M60 96 h6" stroke="#243a22" stroke-width="3"/></svg>`
  },
  {
    id: "batta", name: "ばった", kana: "バッタ", stars: 1, color: "#6fae3f",
    where: "原(はら)っぱの 草(くさ)むら", fact: "ぴょーんと 遠(とお)くまで 飛(と)べるよ。",
    svg: `<svg viewBox="0 0 120 120"><ellipse cx="58" cy="56" rx="34" ry="14" fill="#7cbf4a" transform="rotate(-8 58 56)"/>
    <circle cx="26" cy="52" r="12" fill="#8fd15a"/><circle cx="21" cy="50" r="3.5" fill="#111"/>
    <path d="M30 42 Q20 26 12 22 M32 44 Q24 30 16 24" stroke="#5a9636" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M70 60 Q96 44 98 78 L86 66 Q92 84 70 74 Z" fill="#5a9636"/>
    <path d="M64 66 L92 96 M78 60 L98 82" stroke="#5a9636" stroke-width="5" stroke-linecap="round"/>
    <path d="M52 66 L44 96 M60 66 L56 98" stroke="#6aa840" stroke-width="4" stroke-linecap="round"/></svg>`
  },
  {
    id: "koorogi", name: "こおろぎ", kana: "コオロギ", stars: 2, color: "#5b4636",
    where: "石(いし)や 落(お)ち葉(ば)の 下(した)", fact: "夜(よる)に りりりりと きれいに 鳴(な)くよ。",
    svg: `<svg viewBox="0 0 120 120"><ellipse cx="58" cy="60" rx="34" ry="15" fill="#4a382a" transform="rotate(-6 58 60)"/>
    <circle cx="24" cy="56" r="12" fill="#5b4636"/><circle cx="20" cy="54" r="3.5" fill="#111"/>
    <path d="M28 46 Q14 30 6 30 M30 48 Q18 34 10 34" stroke="#3a2b20" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M74 64 Q100 48 100 82 L88 70 Q94 88 72 76 Z" fill="#3a2b20"/>
    <path d="M66 70 L96 100 M80 64 L100 88" stroke="#3a2b20" stroke-width="5" stroke-linecap="round"/>
    <path d="M84 52 l16 -6 M84 58 l16 -1" stroke="#3a2b20" stroke-width="2.5" stroke-linecap="round"/></svg>`
  },
  {
    id: "kamakiri", name: "かまきり", kana: "カマキリ", stars: 3, color: "#6fae3f",
    where: "草(くさ)むらや 木(き)", fact: "かまで えものを パッと つかまえる！",
    svg: `<svg viewBox="0 0 120 120"><ellipse cx="66" cy="72" rx="12" ry="36" fill="#6fae3f" transform="rotate(10 66 72)"/>
    <path d="M60 44 Q44 40 40 24 Q52 30 58 40 M60 46 Q46 46 38 34" stroke="#5a9636" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M40 24 l-10 -2 M40 24 l-8 4" stroke="#5a9636" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="60" cy="40" rx="12" ry="10" fill="#8fd15a"/><path d="M52 34 l-8 -8 M68 34 l8 -8" stroke="#5a9636" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="53" cy="38" r="4" fill="#2f4a2c"/><circle cx="67" cy="38" r="4" fill="#2f4a2c"/>
    <path d="M64 66 l18 8 M68 80 l16 10 M70 94 l14 8" stroke="#5a9636" stroke-width="4" stroke-linecap="round"/></svg>`
  },
  {
    id: "ari", name: "あり", kana: "アリ", stars: 1, color: "#3a2b20",
    where: "地面(じめん)や アリの 巣(す)", fact: "力持(ちからも)ち！ みんなで 働(はたら)くよ。",
    svg: `<svg viewBox="0 0 120 120"><g stroke="#2a1e15" stroke-width="4" stroke-linecap="round">
    <path d="M54 58 L34 46"/><path d="M54 62 L32 62"/><path d="M54 66 L34 80"/>
    <path d="M58 58 L78 44"/><path d="M60 62 L84 60"/><path d="M60 66 L82 82"/></g>
    <circle cx="80" cy="62" r="16" fill="#4a3324"/><circle cx="56" cy="62" r="9" fill="#3a2b20"/><circle cx="38" cy="60" r="12" fill="#4a3324"/>
    <path d="M32 50 Q24 40 26 34 M34 50 Q30 40 34 34" stroke="#2a1e15" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="34" cy="58" r="3" fill="#111"/><ellipse cx="76" cy="56" rx="4" ry="6" fill="#6b4a35" opacity=".6"/></svg>`
  },
  {
    id: "dangomushi", name: "だんごむし", kana: "ダンゴムシ", stars: 1, color: "#7a7f88",
    where: "石(いし)や 植木鉢(うえきばち)の 下(した)", fact: "さわると コロンと 丸(まる)くなるよ。",
    svg: `<svg viewBox="0 0 120 120"><path d="M26 72 a34 30 0 0 1 68 0 Z" fill="#6b7079"/>
    <g stroke="#4a4e56" stroke-width="2.5"><path d="M38 72 v-20"/><path d="M50 72 v-30"/><path d="M62 72 v-33"/><path d="M74 72 v-30"/><path d="M84 72 v-20"/></g>
    <path d="M26 72 a34 30 0 0 1 68 0" fill="none" stroke="#565a62" stroke-width="3"/>
    <circle cx="60" cy="42" r="11" fill="#565a62"/><circle cx="55" cy="41" r="2.5" fill="#111"/><circle cx="65" cy="41" r="2.5" fill="#111"/>
    <g stroke="#4a4e56" stroke-width="3" stroke-linecap="round"><path d="M30 72 l-8 6"/><path d="M90 72 l8 6"/></g></svg>`
  },
  {
    id: "mitsubachi", name: "みつばち", kana: "ミツバチ", stars: 2, color: "#f2b705",
    where: "お花(はな)の 上(うえ)", fact: "花(はな)から はちみつを 集(あつ)めるよ。",
    svg: `<svg viewBox="0 0 120 120"><ellipse cx="40" cy="52" rx="22" ry="12" fill="#e6ecf0" opacity=".8" stroke="#b9c6cf" stroke-width="1.5" transform="rotate(-20 40 52)"/>
    <ellipse cx="72" cy="46" rx="20" ry="11" fill="#e6ecf0" opacity=".8" stroke="#b9c6cf" stroke-width="1.5" transform="rotate(20 72 46)"/>
    <ellipse cx="60" cy="72" rx="24" ry="20" fill="#f2b705"/>
    <path d="M44 66 q16 -8 32 0 M42 78 q18 -6 36 0" stroke="#2b2b2b" stroke-width="6"/>
    <circle cx="60" cy="42" r="14" fill="#2b2b2b"/><circle cx="54" cy="40" r="3" fill="#fff"/><circle cx="66" cy="40" r="3" fill="#fff"/>
    <path d="M54 30 Q50 20 52 16 M66 30 Q70 20 68 16" stroke="#2b2b2b" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`
  },
  {
    id: "katatsumuri", name: "かたつむり", kana: "カタツムリ", stars: 1, color: "#b7d98a",
    where: "雨(あめ)の 日(ひ)の 葉(は)っぱ", fact: "背中(せなか)に おうちを のせて いるよ。",
    svg: `<svg viewBox="0 0 120 120"><path d="M18 88 Q18 74 40 74 L84 74 Q98 74 98 86 Q98 92 90 92 L26 92 Q18 92 18 88 Z" fill="#c9a24a"/>
    <circle cx="90" cy="60" r="8" fill="#b7d98a"/>
    <path d="M84 62 Q78 42 90 40 M84 62 Q80 46 90 44" stroke="#8fae5c" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="60" cy="66" r="26" fill="#e0c56a"/><circle cx="60" cy="66" r="19" fill="none" stroke="#b98f34" stroke-width="4"/>
    <circle cx="60" cy="66" r="11" fill="none" stroke="#b98f34" stroke-width="4"/><circle cx="60" cy="66" r="4" fill="#b98f34"/>
    <circle cx="92" cy="41" r="2.5" fill="#111"/></svg>`
  },
  {
    id: "kumo", name: "くも", kana: "クモ", stars: 2, color: "#4a4453",
    where: "クモの 巣(す)の 真(ま)ん中(なか)", fact: "糸(いと)で 上手(じょうず)に 網(あみ)を 作(つく)るよ。",
    svg: `<svg viewBox="0 0 120 120"><g stroke="#3a3540" stroke-width="4" stroke-linecap="round" fill="none">
    <path d="M48 58 Q28 46 18 30"/><path d="M46 66 Q22 62 10 58"/><path d="M46 74 Q24 80 14 92"/><path d="M50 82 Q36 96 30 106"/>
    <path d="M72 58 Q92 46 102 30"/><path d="M74 66 Q98 62 110 58"/><path d="M74 74 Q96 80 106 92"/><path d="M70 82 Q84 96 90 106"/></g>
    <ellipse cx="60" cy="72" rx="20" ry="22" fill="#4a4453"/><circle cx="60" cy="50" r="14" fill="#5a5464"/>
    <circle cx="54" cy="48" r="3.5" fill="#fff"/><circle cx="66" cy="48" r="3.5" fill="#fff"/><circle cx="54" cy="48" r="1.5" fill="#111"/><circle cx="66" cy="48" r="1.5" fill="#111"/>
    <path d="M52 74 q8 6 16 0" stroke="#2f2b36" stroke-width="3" fill="none"/></svg>`
  },
  {
    id: "koganemushi", name: "こがねむし", kana: "コガネムシ", stars: 2, color: "#3fae7a",
    where: "葉(は)っぱの 上(うえ)", fact: "背中(せなか)が きらきら 光(ひか)る 宝物(たからもの)。",
    svg: `<svg viewBox="0 0 120 120"><g stroke="#1f6b48" stroke-width="5" stroke-linecap="round">
    <path d="M44 60 L22 50"/><path d="M44 74 L20 76"/><path d="M46 86 L24 98"/>
    <path d="M76 60 L98 50"/><path d="M76 74 L100 76"/><path d="M74 86 L96 98"/></g>
    <ellipse cx="60" cy="74" rx="26" ry="32" fill="#2f9e6a"/><path d="M60 44 v62" stroke="#1f6b48" stroke-width="3"/>
    <ellipse cx="60" cy="62" rx="22" ry="20" fill="#46c489"/><circle cx="60" cy="42" r="12" fill="#1f6b48"/>
    <ellipse cx="49" cy="58" rx="6" ry="12" fill="#b6f5d6" opacity=".7"/><ellipse cx="70" cy="86" rx="4" ry="7" fill="#b6f5d6" opacity=".5"/></svg>`
  },
  {
    id: "amenbo", name: "あめんぼ", kana: "アメンボ", stars: 2, color: "#5a6b7a",
    where: "池(いけ)や 水(みず)たまりの 上(うえ)", fact: "水(みず)の 上(うえ)を すいすい すべるよ。",
    svg: `<svg viewBox="0 0 120 120"><ellipse cx="60" cy="120" rx="120" ry="30" fill="#bfe6f0" opacity=".3"/>
    <g stroke="#3a4a56" stroke-width="3.5" stroke-linecap="round" fill="none">
    <path d="M54 52 Q30 44 12 30"/><path d="M52 62 Q22 62 6 74"/><path d="M52 72 Q30 90 20 106"/>
    <path d="M66 52 Q90 44 108 30"/><path d="M68 62 Q98 62 114 74"/><path d="M68 72 Q90 90 100 106"/></g>
    <ellipse cx="60" cy="64" rx="9" ry="24" fill="#4a5a68"/><circle cx="60" cy="42" r="9" fill="#3a4a56"/>
    <circle cx="56" cy="41" r="2.5" fill="#111"/><circle cx="64" cy="41" r="2.5" fill="#111"/></svg>`
  },
  {
    id: "suzumushi", name: "すずむし", kana: "スズムシ", stars: 3, color: "#2b2b2b",
    where: "草(くさ)むらの 奥(おく)の ほう", fact: "りーんりーんと 鈴(すず)みたいに 鳴(な)くよ。",
    svg: `<svg viewBox="0 0 120 120"><ellipse cx="52" cy="66" rx="20" ry="12" fill="#2b2b2b" transform="rotate(-4 52 66)"/>
    <ellipse cx="66" cy="60" rx="20" ry="15" fill="#1f1f1f" transform="rotate(-6 66 60)"/>
    <circle cx="30" cy="62" r="11" fill="#333"/><circle cx="26" cy="60" r="3" fill="#eee"/>
    <path d="M34 52 Q18 30 8 26 M36 54 Q24 34 14 30" stroke="#1a1a1a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M78 66 Q100 52 100 84 L90 72 Q94 88 76 76 Z" fill="#1a1a1a"/>
    <path d="M72 74 L96 100 M84 68 L100 90" stroke="#1a1a1a" stroke-width="4" stroke-linecap="round"/>
    <path d="M40 74 l-6 22 M48 76 l-2 24" stroke="#333" stroke-width="2.5" stroke-linecap="round"/></svg>`
  }
];

/* しらない むし ようの かわいい アイコン（AIが きめられない ときや ライブラリに ない とき） */
const GENERIC_BUG = {
  color: "#8a9a5b",
  svg: `<svg viewBox="0 0 120 120"><g stroke="#5f6b3a" stroke-width="5" stroke-linecap="round">
    <path d="M44 58 L22 48"/><path d="M44 72 L20 74"/><path d="M46 84 L24 96"/>
    <path d="M76 58 L98 48"/><path d="M76 72 L100 74"/><path d="M74 84 L96 96"/></g>
    <ellipse cx="60" cy="74" rx="26" ry="32" fill="#8a9a5b"/><path d="M60 44 v62" stroke="#5f6b3a" stroke-width="3"/>
    <ellipse cx="60" cy="62" rx="22" ry="20" fill="#a3b36e"/><circle cx="60" cy="42" r="13" fill="#5f6b3a"/>
    <circle cx="54" cy="40" r="3" fill="#fff"/><circle cx="66" cy="40" r="3" fill="#fff"/>
    <path d="M53 32 Q49 20 51 15 M67 32 Q71 20 69 15" stroke="#5f6b3a" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`
};

/* カタカナ → ひらがな（てらしあわせ ように） */
function _toHira(s) {
  return String(s || "").replace(/[ァ-ヶ]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x60)
  );
}
/* 「漢字(かんじ)」は よみがなの ほうを つかって てらしあわせる */
function _stripRuby(s) {
  return String(s || "").replace(/[\u4E00-\u9FFF\u3005\u3006\u30F6々]+[（(]([\u3041-\u309F\u30A1-\u30FCー]+)[)）]/g, "$1");
}
function _norm(s) {
  return _toHira(_stripRuby(s)).replace(/[\s　　・,、。]/g, "").toLowerCase();
}

/* AIが かえした なまえで、ライブラリの むしと あうか さがす（あれば きれいな イラスト等を つかう）*/
const _ALIASES = {
  kabutomushi: ["甲虫", "兜虫", "かぶと"],
  kuwagata: ["鍬形", "くわがたむし", "のこぎりくわがた", "みやまくわがた"],
  tentoumushi: ["天道虫", "てんとう", "ななほしてんとう", "ナナホシテントウ"],
  monshirochou: ["紋白蝶", "もんしろ", "ちょうちょ", "ちょう", "蝶", "しろちょう"],
  agehachou: ["揚羽蝶", "揚羽", "あげは", "キアゲハ", "きあげは"],
  tonbo: ["蜻蛉", "とんぼう", "しおからとんぼ", "あかとんぼ", "おにやんま"],
  semi: ["蝉", "あぶらぜみ", "みんみんぜみ", "つくつくぼうし", "にいにいぜみ", "くまぜみ"],
  batta: ["飛蝗", "しょうりょうばった", "とのさまばった", "おんぶばった", "いなご"],
  koorogi: ["蟋蟀", "えんまこおろぎ"],
  kamakiri: ["蟷螂", "おおかまきり", "はらびろかまきり"],
  ari: ["蟻", "くろあり", "あかあり", "くろおおあり"],
  dangomushi: ["団子虫", "わらじむし", "だんごむし"],
  mitsubachi: ["蜜蜂", "はち", "せいようみつばち", "にほんみつばち", "みつばち"],
  katatsumuri: ["蝸牛", "でんでんむし", "まいまい"],
  kumo: ["蜘蛛", "じょろうぐも", "こがねぐも", "はえとりぐも"],
  koganemushi: ["黄金虫", "かなぶん", "こがねむし", "どうがねぶいぶい"],
  amenbo: ["水黽", "あめんぼう"],
  suzumushi: ["鈴虫"]
};

/* なまえの てらしあわせ：
   1) まったく おなじ なまえが あれば それ
   2) なければ「いちばん ながい ことば」で ぶぶん いっち（みじかい ことばの ごはんてい を ふせぐ）*/
function _matchFrom(list, aliases, name) {
  const q = _norm(name);
  if (!q) return null;
  let best = null, bestLen = 0;
  for (const it of list) {
    const cands = [it.name, it.kana, ...(aliases[it.id] || [])].map(_norm);
    for (const c of cands) {
      if (!c) continue;
      if (q === c) return it;                       // かんぜんに おなじ
      if (c.length >= 4 && (q.includes(c) || c.includes(q)) && c.length > bestLen) {
        best = it; bestLen = c.length;
      }
    }
  }
  return best;
}

function matchKnown(name) { return _matchFrom(INSECTS, _ALIASES, name); }

/* ====== カテゴリー（しゅるいごとの わけ）====== */
const CATEGORIES = [
  { id: "beetle",    label: "甲虫(こうちゅう)",     emoji: "🪲" },
  { id: "butterfly", label: "チョウ・ガ",           emoji: "🦋" },
  { id: "dragonfly", label: "トンボ",               emoji: "💠" },
  { id: "cicada",    label: "セミ",                 emoji: "🎐" },
  { id: "hopper",    label: "バッタ・カマキリ",     emoji: "🦗" },
  { id: "beeant",    label: "ハチ・アリ",           emoji: "🐝" },
  { id: "spider",    label: "クモ",                 emoji: "🕷️" },
  { id: "snail",     label: "カタツムリ",           emoji: "🐌" },
  { id: "water",     label: "水(みず)の 虫(むし)",  emoji: "💧" },
  { id: "amphibian", label: "カエル・生(い)きもの", emoji: "🐸" },
  { id: "other",     label: "その他(ほか)",         emoji: "🐛" },
];
const CATEGORY_ORDER = CATEGORIES.map((c) => c.id);
/* いまの ずかん（むし / おはな）に あわせて かえす */
function categoryMeta(id, kind) {
  const list = categoriesFor(kind);
  return list.find((c) => c.id === id) || list[list.length - 1];
}

const _KNOWN_CATEGORY = {
  kabutomushi: "beetle", kuwagata: "beetle", tentoumushi: "beetle", koganemushi: "beetle",
  monshirochou: "butterfly", agehachou: "butterfly",
  tonbo: "dragonfly", semi: "cicada",
  batta: "hopper", koorogi: "hopper", suzumushi: "hopper", kamakiri: "hopper",
  mitsubachi: "beeant", ari: "beeant",
  kumo: "spider", katatsumuri: "snail", dangomushi: "other", amenbo: "water",
};

const _CAT_KEYWORDS = [
  ["beetle",    ["こうちゅう", "甲虫", "かぶと", "くわがた", "てんとう", "かなぶん", "こがね", "beetle", "ladybug", "weevil"]],
  ["butterfly", ["ちょう", "蝶", "ちょうちょ", "蛾", "あげは", "もんしろ", "しじみちょう", "butterfly", "moth"]],
  ["dragonfly", ["とんぼ", "蜻蛉", "やんま", "dragonfly", "damselfly"]],
  ["cicada",    ["せみ", "蝉", "cicada"]],
  ["hopper",    ["ばった", "こおろぎ", "きりぎりす", "かまきり", "いなご", "すずむし", "grasshopper", "cricket", "mantis", "locust", "katydid"]],
  ["beeant",    ["はち", "蜂", "あり", "蟻", "bee", "ant", "wasp", "hornet"]],
  ["spider",    ["くも", "蜘蛛", "spider"]],
  ["snail",     ["かたつむり", "でんでん", "まいまい", "snail", "slug", "なめくじ"]],
  ["water",     ["あめんぼ", "みずすまし", "げんごろう", "たがめ", "water"]],
  ["amphibian", ["かえる", "がえる", "蛙", "おたまじゃくし", "とかげ", "やもり", "いもり", "かなへび",
                 "へび", "とんぼの やご", "やご", "frog", "toad", "lizard", "newt", "gecko"]],
];

/* なまえ / AIの カテゴリー もじれつ から カテゴリーidを きめる */
function _matchCat(hay) {
  if (!hay) return null;
  for (const [id, kws] of _CAT_KEYWORDS) {
    for (const kw of kws) {
      const k = _norm(kw);
      // 1もじの ことばは あいまいなので つかわない（「が」が「あまがえる」に あたる など）
      if (k.length >= 2 && hay.includes(k)) return id;
    }
  }
  return null;
}
/* AIが かえす ラベル → カテゴリーid */
const _CAT_LABEL_MAP = {
  "こうちゅう": "beetle", "ちょうが": "butterfly", "とんぼ": "dragonfly", "せみ": "cicada",
  "ばったかまきり": "hopper", "はちあり": "beeant", "くも": "spider", "かたつむり": "snail",
  "みずのむし": "water", "かえるいきもの": "amphibian",
};
function _catFromLabel(label) {
  const k = _norm(label);
  if (!k) return null;
  if (k === "そのほか") return null;      // 「そのほか」は こたえ なし あつかい
  if (_CAT_LABEL_MAP[k]) return _CAT_LABEL_MAP[k];
  for (const key in _CAT_LABEL_MAP) {     // ゆらぎ（ちょう / ばった など）にも たいおう
    if (k.includes(key) || key.includes(k)) return _CAT_LABEL_MAP[key];
  }
  return _matchCat(k);
}

function categorize(name, aiCategory, kind) {
  if ((kind || ZUKAN_KIND) === "hana") return categorizeFlower(name, aiCategory);
  // 1) ずかんに ある むしは きまった なかまわけ
  const known = matchKnown(name);
  if (known && _KNOWN_CATEGORY[known.id]) return _KNOWN_CATEGORY[known.id];
  // 2) AIの なかまわけを ゆうせん
  const byAi = _catFromLabel(aiCategory);
  if (byAi) return byAi;
  // 3) なまえの ことばで はんてい
  const nm = _norm(name);
  const hit = _matchCat(nm);
  if (hit) return hit;
  // 「〜が」で おわる なまえは たいてい 蛾（あまがえる などは のぞく）
  if (nm.length >= 3 && nm.endsWith("が")) return "butterfly";
  return "other";
}

/* ============================================================
   おはなずかん（ずかんの きりかえ よう）
   ============================================================ */

/* ずかんの しゅるい */
const ZUKANS = [
  {
    id: "mushi", title: "むしずかん", sub: "みつけた 虫(むし)の 記録(きろく)", emoji: "🐛", one: "虫(むし)",
    fab: "虫(むし)を みつけた！", empty: "下(した)の ボタンで 虫(むし)の 写真(しゃしん)を 撮(と)って みよう！",
    hint0: "虫(むし)を みつけて 写真(しゃしん)を 撮(と)ろう！", hint1: "最初(さいしょ)の 虫(むし) ゲット！ 次(つぎ)は なにかな？",
    notFound: "虫(むし)が みつからなかったかも。名前(なまえ)を 入(い)れてね。",
    delGroup: "🗑️ この 虫(むし)を 図鑑(ずかん)から 消(け)す",
    levels: ["虫(むし)みつけ 見習(みなら)い", "虫(むし)みつけ 探偵(たんてい)", "虫(むし)ハンター", "虫(むし)博士(はかせ)", "虫(むし)マスター", "虫(むし)キング", "虫(むし)レジェンド"],
    think: ["AIが 虫(むし)を 調(しら)べて いるよ！", "どんな 虫(むし)かな…？", "葉(は)っぱの 裏(うら)まで 確認中(かくにんちゅう)🍃", "もう少(すこ)しで わかるよ！"],
  },
  {
    id: "hana", title: "おはなずかん", sub: "みつけた 花(はな)の 記録(きろく)", emoji: "🌸", one: "花(はな)",
    fab: "花(はな)を みつけた！", empty: "下(した)の ボタンで 花(はな)の 写真(しゃしん)を 撮(と)って みよう！",
    hint0: "花(はな)を みつけて 写真(しゃしん)を 撮(と)ろう！", hint1: "最初(さいしょ)の 花(はな) ゲット！ 次(つぎ)は なにかな？",
    notFound: "花(はな)が みつからなかったかも。名前(なまえ)を 入(い)れてね。",
    delGroup: "🗑️ この 花(はな)を 図鑑(ずかん)から 消(け)す",
    levels: ["お花(はな) 見習(みなら)い", "お花(はな) 探偵(たんてい)", "お花(はな)ハンター", "お花(はな)博士(はかせ)", "お花(はな)マスター", "お花(はな)クイーン", "お花(はな)レジェンド"],
    think: ["AIが 花(はな)を 調(しら)べて いるよ！", "どんな 花(はな)かな…？", "花(はな)びらを 数(かぞ)え中(ちゅう)🌼", "もう少(すこ)しで わかるよ！"],
  },
];
let ZUKAN_KIND = "mushi";
function setZukanKind(k) { ZUKAN_KIND = (k === "hana") ? "hana" : "mushi"; }
function zukanMeta(id) { return ZUKANS.find((z) => z.id === (id || ZUKAN_KIND)) || ZUKANS[0]; }

/* おはなの なかまわけ */
const FLOWER_CATEGORIES = [
  { id: "f_tree",   label: "木(き)の 花(はな)",         emoji: "🌸" },
  { id: "f_wild",   label: "道(みち)ばたの 花(はな)",   emoji: "🌼" },
  { id: "f_garden", label: "庭(にわ)の 花(はな)",       emoji: "🌻" },
  { id: "f_leaf",   label: "葉(は)っぱ・草(くさ)",     emoji: "🍀" },
  { id: "f_fruit",  label: "実(み)・たね・どんぐり",   emoji: "🌰" },
  { id: "f_mush",   label: "キノコ",                   emoji: "🍄" },
  { id: "f_other",  label: "その他(ほか)",             emoji: "🌱" },
];

function categoriesFor(kind) { return (kind || ZUKAN_KIND) === "hana" ? FLOWER_CATEGORIES : CATEGORIES; }
function categoryOrderFor(kind) { return categoriesFor(kind).map((c) => c.id); }

const _FCAT_KEYWORDS = [
  ["f_tree",   ["さくら", "うめ", "もも", "つばき", "さざんか", "つつじ", "あじさい", "もくれん", "こぶし",
                "きんもくせい", "はなみずき", "ふじ", "さるすべり", "みもざ", "れんぎょう", "ゆきやなぎ",
                "cherry", "plum", "camellia", "azalea", "hydrangea", "magnolia", "wisteria"]],
  ["f_wild",   ["たんぽぽ", "すみれ", "しろつめくさ", "つめくさ", "おおいぬのふぐり", "はこべ", "なずな",
                "へびいちご", "かたばみ", "つゆくさ", "ひめじょおん", "はるじおん", "のげし", "げんげ",
                "からすのえんどう", "ほとけのざ", "おおばこ", "れんげ", "のあざみ", "あざみ",
                "dandelion", "violet", "clover flower"]],
  ["f_garden", ["ちゅーりっぷ", "ひまわり", "ばら", "ゆり", "あさがお", "ぱんじー", "びおら", "こすもす",
                "まりーごーるど", "きく", "すいせん", "しゃくやく", "ぼたん", "だりあ", "ぜらにうむ",
                "にちにちそう", "さるびあ", "ひやしんす", "らべんだー", "あじさい", "けいとう", "きんせんか",
                "tulip", "sunflower", "rose", "lily", "cosmos", "pansy", "marigold"]],
  ["f_leaf",   ["はっぱ", "はっぱ", "くろーばー", "よもぎ", "すすき", "しだ", "こけ", "つた", "ささ",
                "もみじ", "いちょう", "かえで", "ねこじゃらし", "えのころぐさ", "しろつめくさのは",
                "leaf", "moss", "fern", "grass", "clover"]],
  ["f_fruit",  ["どんぐり", "まつぼっくり", "まつかさ", "たね", "このみ", "きのみ", "くり", "ぎんなん",
                "さくらんぼ", "いちご", "みかん", "かき", "なんてん", "ひいらぎ",
                "acorn", "pinecone", "seed", "berry"]],
  ["f_mush",   ["きのこ", "しめじ", "えのき", "しいたけ", "べにてんぐ", "ほこりたけ", "きくらげ", "mushroom", "fungus"]],
];

const _FCAT_LABEL_MAP = {
  "きのおはな": "f_tree", "みちばたのおはな": "f_wild", "にわのおはな": "f_garden",
  "はっぱくさ": "f_leaf", "みたねどんぐり": "f_fruit", "きのこ": "f_mush",
};

function _matchFCat(hay) {
  if (!hay) return null;
  for (const [id, kws] of _FCAT_KEYWORDS) {
    for (const kw of kws) {
      const k = _norm(kw);
      if (k.length >= 2 && hay.includes(k)) return id;
    }
  }
  return null;
}
function _fcatFromLabel(label) {
  const k = _norm(label);
  if (!k) return null;
  if (k === "そのほか") return null;
  if (_FCAT_LABEL_MAP[k]) return _FCAT_LABEL_MAP[k];
  for (const key in _FCAT_LABEL_MAP) {
    if (k.includes(key) || key.includes(k)) return _FCAT_LABEL_MAP[key];
  }
  return _matchFCat(k);
}
function categorizeFlower(name, aiCategory) {
  const known = matchKnownFlower(name);
  if (known && known.cat) return known.cat;
  const byAi = _fcatFromLabel(aiCategory);
  if (byAi) return byAi;
  const hit = _matchFCat(_norm(name));
  if (hit) return hit;
  return "f_other";
}

/* おはなの イラスト（すこしだけ。ないものは そうごうアイコン）*/
const FLOWERS = [
  {
    id: "tanpopo", name: "たんぽぽ", kana: "タンポポ", stars: 1, color: "#ffd23f", cat: "f_wild",
    where: "道(みち)ばた・公園(こうえん)の 地面(じめん)", fact: "綿毛(わたげ)に なって 風(かぜ)で 飛(と)んで いくよ。",
    svg: `<svg viewBox="0 0 120 120"><path d="M60 58 V112" stroke="#4c8033" stroke-width="7" stroke-linecap="round"/>
    <path d="M60 90 q-24 -8 -30 10 q22 9 30 -10Z" fill="#5da03d"/><path d="M60 100 q24 -8 30 10 q-22 9 -30 -10Z" fill="#3f7a2b"/>
    <g fill="#ffc107"><ellipse cx="60" cy="28" rx="8" ry="15"/><ellipse cx="60" cy="28" rx="8" ry="15" transform="rotate(45 60 52)"/>
    <ellipse cx="60" cy="28" rx="8" ry="15" transform="rotate(90 60 52)"/><ellipse cx="60" cy="28" rx="8" ry="15" transform="rotate(135 60 52)"/>
    <ellipse cx="60" cy="28" rx="8" ry="15" transform="rotate(180 60 52)"/><ellipse cx="60" cy="28" rx="8" ry="15" transform="rotate(225 60 52)"/>
    <ellipse cx="60" cy="28" rx="8" ry="15" transform="rotate(270 60 52)"/><ellipse cx="60" cy="28" rx="8" ry="15" transform="rotate(315 60 52)"/></g>
    <circle cx="60" cy="52" r="19" fill="#ffd23f"/><circle cx="60" cy="52" r="11" fill="#f0a93c"/></svg>`
  },
  {
    id: "sakura", name: "さくら", kana: "サクラ", stars: 2, color: "#ffb7c5", cat: "f_tree",
    where: "春(はる)の 公園(こうえん)や 川(かわ)ぞい", fact: "春(はる)に いっせいに 咲(さ)いて、ひらひら 散(ち)るよ。",
    svg: `<svg viewBox="0 0 120 120"><g fill="#ffc2d1" stroke="#ff9fb5" stroke-width="2">
    <path d="M60 20 q13 14 8 26 q-8 6 -16 0 q-5 -12 8 -26Z"/>
    <path d="M60 20 q13 14 8 26 q-8 6 -16 0 q-5 -12 8 -26Z" transform="rotate(72 60 58)"/>
    <path d="M60 20 q13 14 8 26 q-8 6 -16 0 q-5 -12 8 -26Z" transform="rotate(144 60 58)"/>
    <path d="M60 20 q13 14 8 26 q-8 6 -16 0 q-5 -12 8 -26Z" transform="rotate(216 60 58)"/>
    <path d="M60 20 q13 14 8 26 q-8 6 -16 0 q-5 -12 8 -26Z" transform="rotate(288 60 58)"/></g>
    <circle cx="60" cy="58" r="10" fill="#fff0f4"/>
    <g stroke="#ffa8bd" stroke-width="2.5" stroke-linecap="round"><path d="M60 58 l0 -11"/><path d="M60 58 l10 -5"/><path d="M60 58 l-10 -5"/><path d="M60 58 l7 8"/><path d="M60 58 l-7 8"/></g>
    <g fill="#ffd23f"><circle cx="60" cy="45" r="2.6"/><circle cx="71" cy="52" r="2.6"/><circle cx="49" cy="52" r="2.6"/><circle cx="67" cy="67" r="2.6"/><circle cx="53" cy="67" r="2.6"/></g></svg>`
  },
  {
    id: "tulip", name: "ちゅーりっぷ", kana: "チューリップ", stars: 1, color: "#e8556d", cat: "f_garden",
    where: "春(はる)の 花壇(かだん)", fact: "赤(あか)・黄色(きいろ)・白(しろ)…いろんな 色(いろ)が あるよ。",
    svg: `<svg viewBox="0 0 120 120"><path d="M60 62 V112" stroke="#4c8033" stroke-width="7" stroke-linecap="round"/>
    <path d="M60 78 q-26 4 -26 30 q24 -2 26 -30Z" fill="#5da03d"/><path d="M60 88 q26 4 26 26 q-24 -2 -26 -26Z" fill="#3f7a2b"/>
    <path d="M36 44 q0 -22 12 -28 q4 12 12 12 q8 0 12 -12 q12 6 12 28 q0 22 -24 22 q-24 0 -24 -22Z" fill="#e8556d"/>
    <path d="M60 28 q-3 20 0 38" stroke="#c33d54" stroke-width="2.5" fill="none"/>
    <path d="M42 40 q2 16 8 24" stroke="#f47c8e" stroke-width="2.5" fill="none"/></svg>`
  },
  {
    id: "himawari", name: "ひまわり", kana: "ヒマワリ", stars: 2, color: "#ffb703", cat: "f_garden",
    where: "夏(なつ)の 畑(はたけ)・花壇(かだん)", fact: "お日(ひ)さまの ほうを 向(む)いて 咲(さ)くよ。",
    svg: `<svg viewBox="0 0 120 120"><path d="M60 66 V112" stroke="#4c8033" stroke-width="7" stroke-linecap="round"/>
    <path d="M60 86 q-24 -4 -28 14 q22 6 28 -14Z" fill="#5da03d"/>
    <g fill="#ffb703"><ellipse cx="60" cy="24" rx="9" ry="17"/>
    <ellipse cx="60" cy="24" rx="9" ry="17" transform="rotate(40 60 54)"/><ellipse cx="60" cy="24" rx="9" ry="17" transform="rotate(80 60 54)"/>
    <ellipse cx="60" cy="24" rx="9" ry="17" transform="rotate(120 60 54)"/><ellipse cx="60" cy="24" rx="9" ry="17" transform="rotate(160 60 54)"/>
    <ellipse cx="60" cy="24" rx="9" ry="17" transform="rotate(200 60 54)"/><ellipse cx="60" cy="24" rx="9" ry="17" transform="rotate(240 60 54)"/>
    <ellipse cx="60" cy="24" rx="9" ry="17" transform="rotate(280 60 54)"/><ellipse cx="60" cy="24" rx="9" ry="17" transform="rotate(320 60 54)"/></g>
    <circle cx="60" cy="54" r="19" fill="#6b4423"/><circle cx="60" cy="54" r="19" fill="none" stroke="#4d3018" stroke-width="3"/>
    <g fill="#4d3018"><circle cx="54" cy="49" r="2"/><circle cx="63" cy="48" r="2"/><circle cx="58" cy="56" r="2"/><circle cx="66" cy="57" r="2"/><circle cx="52" cy="59" r="2"/></g></svg>`
  },
  {
    id: "asagao", name: "あさがお", kana: "アサガオ", stars: 1, color: "#7b6cd9", cat: "f_garden",
    where: "夏(なつ)の 朝(あさ)、つるの 先(さき)", fact: "朝(あさ) 咲(さ)いて、昼(ひる)には しぼんじゃう。",
    svg: `<svg viewBox="0 0 120 120"><path d="M74 70 q-14 20 -6 42" stroke="#4c8033" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M70 86 q-22 -6 -26 12 q20 8 26 -12Z" fill="#5da03d"/>
    <circle cx="60" cy="50" r="32" fill="#8a7ae0"/><circle cx="60" cy="50" r="32" fill="none" stroke="#6a5cc4" stroke-width="3"/>
    <path d="M60 18 v64 M28 50 h64 M37 27 l46 46 M83 27 l-46 46" stroke="#b6aef0" stroke-width="2.5" opacity=".8"/>
    <circle cx="60" cy="50" r="13" fill="#fdf6ff"/><circle cx="60" cy="50" r="5" fill="#ffe08a"/></svg>`
  },
  {
    id: "clover", name: "しろつめくさ", kana: "シロツメクサ", stars: 1, color: "#7cb85e", cat: "f_wild",
    where: "公園(こうえん)の 芝生(しばふ)", fact: "四(よ)つ葉(ば)を みつけたら ラッキー！",
    svg: `<svg viewBox="0 0 120 120"><path d="M60 60 q4 28 -2 50" stroke="#4c8033" stroke-width="6" fill="none" stroke-linecap="round"/>
    <g fill="#5da03d" stroke="#3f7a2b" stroke-width="2">
    <path d="M60 58 q-4 -26 -22 -22 q-14 4 -8 18 q6 12 30 4Z"/>
    <path d="M60 58 q4 -26 22 -22 q14 4 8 18 q-6 12 -30 4Z"/>
    <path d="M60 58 q-26 4 -24 22 q2 12 16 10 q12 -3 8 -32Z"/>
    <path d="M60 58 q26 4 24 22 q-2 12 -16 10 q-12 -3 -8 -32Z"/></g>
    <g fill="#fff" opacity=".85"><ellipse cx="46" cy="44" rx="6" ry="4" transform="rotate(-25 46 44)"/><ellipse cx="74" cy="44" rx="6" ry="4" transform="rotate(25 74 44)"/></g>
    <circle cx="60" cy="58" r="5" fill="#3f7a2b"/></svg>`
  },
  {
    id: "kinoko", name: "きのこ", kana: "キノコ", stars: 2, color: "#e05a47", cat: "f_mush",
    where: "しめった 林(はやし)の 地面(じめん)", fact: "食(た)べられない ものも あるよ。さわったら 手(て)を 洗(あら)おう。",
    svg: `<svg viewBox="0 0 120 120"><path d="M46 62 q-4 34 4 44 q10 4 20 0 q8 -10 4 -44Z" fill="#fdf0dc" stroke="#e0cba6" stroke-width="3"/>
    <path d="M18 64 q0 -42 42 -42 q42 0 42 42 q-42 10 -84 0Z" fill="#e05a47"/>
    <g fill="#fff8ee"><ellipse cx="40" cy="42" rx="9" ry="7"/><ellipse cx="72" cy="36" rx="7" ry="6"/><ellipse cx="86" cy="52" rx="6" ry="5"/><ellipse cx="56" cy="52" rx="6" ry="5"/></g>
    <path d="M18 64 q42 12 84 0" stroke="#b8402f" stroke-width="3" fill="none"/></svg>`
  },
  {
    id: "donguri", name: "どんぐり", kana: "ドングリ", stars: 1, color: "#a8763e", cat: "f_fruit",
    where: "秋(あき)の 公園(こうえん)、木(き)の 下(した)", fact: "春(はる)に なると 芽(め)が 出(で)て 木(き)に なるよ。",
    svg: `<svg viewBox="0 0 120 120"><path d="M60 26 v-12" stroke="#6b4423" stroke-width="6" stroke-linecap="round"/>
    <path d="M32 44 q0 -20 28 -20 q28 0 28 20 q-28 8 -56 0Z" fill="#8a5a2b"/>
    <path d="M32 44 q28 8 56 0" stroke="#6b4423" stroke-width="3" fill="none"/>
    <g stroke="#6b4423" stroke-width="2" opacity=".6"><path d="M42 28 v14"/><path d="M54 25 v18"/><path d="M66 25 v18"/><path d="M78 28 v14"/></g>
    <path d="M32 44 q4 54 28 54 q24 0 28 -54 q-28 8 -56 0Z" fill="#c08a4a"/>
    <ellipse cx="46" cy="62" rx="6" ry="12" fill="#d9a56a" opacity=".7"/></svg>`
  },
  {
    id: "momiji", name: "もみじ", kana: "モミジ", stars: 1, color: "#e0523a", cat: "f_leaf",
    where: "秋(あき)の 山(やま)・公園(こうえん)", fact: "寒(さむ)く なると 赤(あか)や 黄色(きいろ)に 変(か)わるよ。",
    svg: `<svg viewBox="0 0 120 120"><path d="M60 74 q2 20 0 34" stroke="#8a5a2b" stroke-width="5" stroke-linecap="round" fill="none"/>
    <path d="M60 14 l10 22 l20 -8 l-10 20 l22 4 l-20 12 l12 18 l-22 -8 l-2 22 l-10 -22 l-10 22 l-2 -22 l-22 8 l12 -18 l-20 -12 l22 -4 l-10 -20 l20 8Z" fill="#e0523a"/>
    <g stroke="#a83725" stroke-width="2" opacity=".7"><path d="M60 74 V26"/><path d="M60 52 L36 40"/><path d="M60 52 L84 40"/><path d="M60 64 L40 66"/><path d="M60 64 L80 66"/></g></svg>`
  },
];

const GENERIC_FLOWER = {
  color: "#f4a8c0",
  svg: `<svg viewBox="0 0 120 120"><path d="M60 62 V112" stroke="#4c8033" stroke-width="7" stroke-linecap="round"/>
    <path d="M60 84 q-24 -6 -28 12 q22 8 28 -12Z" fill="#5da03d"/><path d="M60 94 q24 -6 28 12 q-22 8 -28 -12Z" fill="#3f7a2b"/>
    <g fill="#f4a8c0" stroke="#e488a4" stroke-width="2">
    <ellipse cx="60" cy="26" rx="12" ry="17"/>
    <ellipse cx="60" cy="26" rx="12" ry="17" transform="rotate(72 60 54)"/>
    <ellipse cx="60" cy="26" rx="12" ry="17" transform="rotate(144 60 54)"/>
    <ellipse cx="60" cy="26" rx="12" ry="17" transform="rotate(216 60 54)"/>
    <ellipse cx="60" cy="26" rx="12" ry="17" transform="rotate(288 60 54)"/></g>
    <circle cx="60" cy="54" r="13" fill="#ffe08a"/><circle cx="60" cy="54" r="7" fill="#f5c141"/></svg>`
};

const _FALIASES = {
  tanpopo: ["蒲公英", "たんぽぽの わたげ", "せいようたんぽぽ"],
  sakura: ["桜", "そめいよしの", "やえざくら", "しだれざくら"],
  tulip: ["チューリップ", "tulip"],
  himawari: ["向日葵", "ヒマワリ", "sunflower"],
  asagao: ["朝顔", "アサガオ"],
  clover: ["白詰草", "クローバー", "くろーばー", "よつば", "よつばの くろーばー", "しろつめぐさ"],
  kinoko: ["茸", "キノコ", "きのこ", "べにてんぐたけ"],
  donguri: ["団栗", "ドングリ", "どんぐりの み"],
  momiji: ["紅葉", "もみじの は", "かえで", "いろはもみじ"],
};

function matchKnownFlower(name) { return _matchFrom(FLOWERS, _FALIASES, name); }


/* ============================================================
   ずかんに ある むし・おはなの くわしい じょうほう
   （AIが つかえない ときでも よめる）
   ============================================================ */
const KNOWN_DETAILS = {
  kabutomushi: {
    family: "コガネムシ科",
    trivia: ["自分(じぶん)の 体(からだ)の 20倍(ばい)の 重(おも)さを 引(ひ)っぱれる、力持(ちからも)ち だよ。",
             "大(おお)きな 角(つの)が あるのは オスだけ。メスには 角(つの)が ないよ。",
             "卵(たまご)から 大人(おとな)に なるまで 1年(ねん) かかるけど、大人(おとな)で いられるのは 2か月(げつ)くらい。"],
    habitat: "本州(ほんしゅう)・四国(しこく)・九州(きゅうしゅう)の 雑木林(ぞうきばやし)。くぬぎや こならの 木(き)が 多(おお)い 林(はやし)に 住(す)んで いるよ。昼間(ひるま)は 落(お)ち葉(ば)の 下(した)や 木(き)の 根元(ねもと)に かくれて いるんだ。",
    season: "6月(がつ)〜8月(がつ)。夜(よる)から 朝(あさ) 早(はや)くが いちばん みつけやすいよ。",
    food: "木(き)の 蜜(みつ)。飼(か)う ときは 昆虫(こんちゅう)ゼリーを あげてね。",
    care: "虫(むし)かごに 黒(くろ)い 土(つち)（マット）を 深(ふか)く 入(い)れて、のぼり木(ぎ)と 昆虫(こんちゅう)ゼリーを 置(お)く。土(つち)が かわいたら 霧吹(きりふ)きで しめらせる。オスどうしは けんかするから 別々(べつべつ)に してね。",
  },
  kuwagata: {
    family: "クワガタムシ科",
    trivia: ["大(おお)きな あごは 戦(たたか)う ための 道具(どうぐ)。ものを はさむ 力(ちから)が とても 強(つよ)いよ。",
             "種類(しゅるい)に よっては、大人(おとな)で 2〜3年(ねん)も 生(い)きる ものが いるんだ。",
             "幼虫(ようちゅう)は くさった 木(き)の 中(なか)を 食(た)べながら 育(そだ)つよ。"],
    habitat: "日本(にほん) 全国(ぜんこく)の 雑木林(ぞうきばやし)。くぬぎ・こなら・やなぎなど、蜜(みつ)が 出(で)る 木(き)の 幹(みき)に 集(あつ)まるよ。木(き)の うろや 皮(かわ)の すきまに かくれて いるんだ。",
    season: "6月(がつ)〜9月(がつ)。夜(よる)や 朝(あさ) 早(はや)くが みつけやすいよ。",
    food: "木(き)の 蜜(みつ)。飼(か)う ときは 昆虫(こんちゅう)ゼリーを あげてね。",
    care: "土(つち)を 深(ふか)く 入(い)れた 虫(むし)かごに、のぼり木(ぎ)と 昆虫(こんちゅう)ゼリー。日(ひ)かげの 涼(すず)しい ところに 置(お)くよ。はさまれると 痛(いた)いから、背中(せなか)を 持(も)つと 安心(あんしん)。",
  },
  tentoumushi: {
    family: "テントウムシ科",
    trivia: ["アブラムシを 1日(にち)に 100匹(ぴき)も 食(た)べる、畑(はたけ)の お手伝(てつだ)い虫(むし) だよ。",
             "敵(てき)に おそわれると、足(あし)から 黄色(きいろ)い 汁(しる)を 出(だ)して 身(み)を 守(まも)るんだ。",
             "星(ほし)の 数(かず)は 種類(しゅるい)に よって 違(ちが)う。ナナホシテントウは 7つ だよ。"],
    habitat: "公園(こうえん)・畑(はたけ)・河原(かわら)の 草(くさ)むら。全国(ぜんこく)に いるよ。アブラムシが つく 草(くさ)の まわりに 多(おお)いんだ。",
    season: "3月(がつ)〜11月(がつ)。春(はる)と 秋(あき)に とくに 多(おお)いよ。",
    food: "アブラムシ。",
    care: "アブラムシが ついた 草(くさ)の 枝(えだ)ごと 虫(むし)かごに 入(い)れると 飼(か)えるよ。えさが なくなったら、そっと 逃(に)がして あげてね。",
  },
  monshirochou: {
    family: "シロチョウ科",
    trivia: ["羽(はね)の 粉(こな)を さわると とれちゃう。やさしく 見(み)るだけに しようね。",
             "キャベツの 葉(は)に 卵(たまご)を 産(う)むよ。幼虫(ようちゅう)は あおむし だよ。",
             "羽(はね)の 黒(くろ)い 点(てん)の 数(かず)で オスと メスが 見分(みわ)けられるんだ。"],
    habitat: "全国(ぜんこく)の 畑(はたけ)・公園(こうえん)・花壇(かだん)。キャベツや 大根(だいこん)など アブラナの 仲間(なかま)が ある ところに 多(おお)いよ。",
    season: "3月(がつ)〜11月(がつ)。あたたかい 昼間(ひるま)に 飛(と)んで いるよ。",
    food: "大人(おとな)は 花(はな)の 蜜(みつ)。幼虫(ようちゅう)（あおむし）は キャベツの 葉(は)。",
    care: "あおむしを キャベツの 葉(は)と いっしょに かごに 入(い)れると、さなぎに なって チョウに なるよ。生(う)まれたら すぐ 外(そと)へ 逃(に)がして あげてね。",
  },
  agehachou: {
    family: "アゲハチョウ科",
    trivia: ["幼虫(ようちゅう)は さわると オレンジの 角(つの)を 出(だ)して、くさい においで 身(み)を 守(まも)るよ。",
             "みかんや さんしょうの 葉(は)を 食(た)べて 育(そだ)つんだ。",
             "羽(はね)を 広(ひろ)げると 10センチ 近(ちか)く。日本(にほん)の チョウの 中(なか)では 大(おお)きい ほうだよ。"],
    habitat: "全国(ぜんこく)の 公園(こうえん)・庭(にわ)・山道(やまみち)。みかんの 木(き)や さんしょうが ある ところに よく 来(く)るよ。",
    season: "4月(がつ)〜10月(がつ)。晴(は)れた 日(ひ)の 昼間(ひるま)に 飛(と)んで いるよ。",
    food: "大人(おとな)は 花(はな)の 蜜(みつ)。幼虫(ようちゅう)は みかん・さんしょうの 葉(は)。",
    care: "幼虫(ようちゅう)を みかんの 葉(は)と いっしょに かごへ。葉(は)は 毎日(まいにち) 新(あたら)しい ものに 取(と)りかえてね。チョウに なったら 外(そと)へ 逃(に)がそう。",
  },
  tonbo: {
    family: "トンボ科",
    trivia: ["目(め)が 2万個(まんこ) 以上(いじょう)の 小(ちい)さな 目(め)で できて いて、ほとんど 全部(ぜんぶ)が 見(み)えるよ。",
             "空(そら)を 飛(と)びながら 他(ほか)の 虫(むし)を つかまえて 食(た)べる ハンター だよ。",
             "子(こ)どもの ころは「ヤゴ」と いって、水(みず)の 中(なか)で くらすんだ。"],
    habitat: "池(いけ)・田(た)んぼ・川(かわ)の 近(ちか)く。全国(ぜんこく)に いるよ。水(みず)べの 草(くさ)や 棒(ぼう)の 先(さき)に とまって いる ことが 多(おお)いんだ。",
    season: "5月(がつ)〜11月(がつ)。晴(は)れた 日(ひ)の 昼間(ひるま)に 飛(と)んで いるよ。",
    food: "小(ちい)さな 虫(むし)（カ・ハエ など）。",
    care: "トンボを 飼(か)うのは とても 難(むずか)しいよ。見(み)たら そっと 逃(に)がして あげてね。ヤゴなら 水槽(すいそう)で 育(そだ)てられるけど、生(い)きた えさが 必要(ひつよう) だよ。",
  },
  semi: {
    family: "セミ科",
    trivia: ["土(つち)の 中(なか)で 何年(なんねん)も 過(す)ごしてから、やっと 外(そと)へ 出(で)て くるんだ。",
             "鳴(な)いて いるのは オスだけ。メスを 呼(よ)んで いるんだよ。",
             "外(そと)に 出(で)て からは 2〜4週間(しゅうかん)くらいしか 生(い)きられないんだ。"],
    habitat: "全国(ぜんこく)の 公園(こうえん)・林(はやし)・町(まち)の 並木(なみき)。さくらや けやきの 幹(みき)に とまって 鳴(な)いて いるよ。",
    season: "7月(がつ)〜9月(がつ)。朝(あさ)から 夕方(ゆうがた)に 鳴(な)いて いるよ。",
    food: "木(き)の 汁(しる)（幹(みき)に 口(くち)を さして 吸(す)う）。",
    care: "セミを 飼(か)うのは とても 難(むずか)しいよ。木(き)の 汁(しる)しか 飲(の)めないんだ。見(み)たら そっと 逃(に)がして あげてね。ぬけがらを 集(あつ)めるのは 楽(たの)しいよ。",
  },
  batta: {
    family: "バッタ科",
    trivia: ["自分(じぶん)の 体(からだ)の 20倍(ばい) 以上(いじょう)の 距離(きょり)を ジャンプ できるよ。",
             "耳(みみ)は 頭(あたま)では なくて、お腹(なか)の 横(よこ)に ついて いるんだ。",
             "草(くさ)むらの 色(いろ)に 似(に)せて、敵(てき)から みつからない ように して いるよ。"],
    habitat: "全国(ぜんこく)の 草(くさ)むら・河原(かわら)・公園(こうえん)の 芝生(しばふ)。日(ひ)あたりの よい ところが 好(す)きだよ。",
    season: "7月(がつ)〜11月(がつ)。昼間(ひるま)に 草(くさ)むらで みつかるよ。",
    food: "イネ科(か)や エノコログサ など、やわらかい 草(くさ)の 葉(は)。",
    care: "虫(むし)かごに 土(つち)を しいて、生(い)きた 草(くさ)を さして おくよ。草(くさ)は 毎日(まいにち) 新(あたら)しい ものに。霧吹(きりふ)きで 少(すこ)し 水(みず)を あげてね。",
  },
  koorogi: {
    family: "コオロギ科",
    trivia: ["羽(はね)を こすり合(あ)わせて「コロコロ」と 鳴(な)いて いるんだ。鳴(な)いて いるのは オスだよ。",
             "気温(きおん)が 高(たか)い ほど、鳴(な)く 速(はや)さが 速(はや)く なるよ。",
             "何(なん)でも 食(た)べる。野菜(やさい)も おかかも 食(た)べるんだ。"],
    habitat: "全国(ぜんこく)の 石(いし)の 下(した)・草(くさ)むら・庭(にわ)の すみ。暗(くら)くて しめった ところに かくれて いるよ。",
    season: "8月(がつ)〜11月(がつ)。夜(よる)に よく 鳴(な)いて いるよ。",
    food: "草(くさ)・野菜(やさい)・かつおぶし など いろいろ。",
    care: "土(つち)を しいた 虫(むし)かごに、かくれる 場所(ばしょ)（たまごパックなど）を 入(い)れる。なすや きゅうり、かつおぶしを 少(すこ)し。水(みず)は 霧吹(きりふ)きで。飼(か)いやすい 虫(むし) だよ。",
  },
  kamakiri: {
    family: "カマキリ科",
    trivia: ["前(まえ)あしで えものを つかまえる、草(くさ)むらの ハンター だよ。",
             "頭(あたま)を ぐるっと 後(うし)ろまで 回(まわ)せるんだ。",
             "卵(たまご)は あわあわの 袋(ふくろ)に つつまれて 冬(ふゆ)を 越(こ)すよ。"],
    habitat: "全国(ぜんこく)の 草(くさ)むら・公園(こうえん)・庭(にわ)。背(せ)の 高(たか)い 草(くさ)や 枝(えだ)の 上(うえ)で じっと 待(ま)って いるよ。",
    season: "8月(がつ)〜11月(がつ)。昼間(ひるま)に 草(くさ)むらで みつかるよ。",
    food: "生(い)きた 虫(むし)（バッタ・コオロギ・ハエ など）。",
    care: "虫(むし)かごに のぼる 枝(えだ)を 入(い)れて、生(い)きた 虫(むし)を あげるよ。生(い)きた えさが 用意(ようい)できない ときは、そっと 逃(に)がして あげてね。",
  },
  ari: {
    family: "アリ科",
    trivia: ["自分(じぶん)の 体重(たいじゅう)の 50倍(ばい)の ものを 持(も)ち上(あ)げられる 力持(ちからも)ち だよ。",
             "においの 道(みち)を つけて、仲間(なかま)に えさの 場所(ばしょ)を 教(おし)えるんだ。",
             "巣(す)の 中(なか)には 卵(たまご)を 産(う)む「女王(じょおう)アリ」が いるよ。"],
    habitat: "全国(ぜんこく)の 地面(じめん)・公園(こうえん)・家(いえ)の まわり。土(つち)の 中(なか)や 石(いし)の 下(した)に 巣(す)を 作(つく)るよ。",
    season: "4月(がつ)〜10月(がつ)。あたたかい 日(ひ)の 昼間(ひるま)に よく 働(はたら)いて いるよ。",
    food: "甘(あま)い もの・虫(むし)の しがい・アブラムシの 出(だ)す 汁(しる)。",
    care: "透明(とうめい)な 入(い)れものに 土(つち)を 入(い)れると、巣(す)を 作(つく)る 様子(ようす)が 見(み)られるよ。砂糖水(さとうみず)を ちょっぴり。逃(に)げやすいから ふたを しっかりね。",
  },
  dangomushi: {
    family: "オカダンゴムシ科",
    trivia: ["さわると 丸(まる)く なるのは、敵(てき)から 身(み)を 守(まも)る ため だよ。",
             "じつは 虫(むし)の 仲間(なかま)では なくて、エビや カニに 近(ちか)い 仲間(なかま) なんだ。",
             "落(お)ち葉(ば)を 食(た)べて、土(つち)を ふかふかに してくれる お手伝(てつだ)いさん だよ。"],
    habitat: "全国(ぜんこく)の 石(いし)の 下(した)・植木鉢(うえきばち)の 下(した)・落(お)ち葉(ば)の 中(なか)。しめって 暗(くら)い ところが 好(す)きだよ。",
    season: "1年中(ねんじゅう)。春(はる)から 秋(あき)が みつけやすいよ。",
    food: "落(お)ち葉(ば)・かれた 草(くさ)・野菜(やさい)の きれはし。",
    care: "土(つち)と 落(お)ち葉(ば)を 入(い)れた 入(い)れものに 入(い)れるだけ。霧吹(きりふ)きで しめらせて、にんじんや きゅうりを 少(すこ)し。とても 飼(か)いやすいよ。",
  },
  mitsubachi: {
    family: "ミツバチ科",
    trivia: ["はちみつ 1キロを 作(つく)るのに、花(はな)を 500万回(まんかい) 訪(たず)ねるんだ。",
             "おどりで 仲間(なかま)に 花(はな)の 場所(ばしょ)を 教(おし)えるよ。",
             "花(はな)から 花(はな)へ 飛(と)んで、たねや 実(み)が できる お手伝(てつだ)いを して いるんだ。"],
    habitat: "全国(ぜんこく)の 花畑(はなばたけ)・公園(こうえん)・花壇(かだん)。花(はな)が たくさん 咲(さ)いて いる ところに 集(あつ)まるよ。",
    season: "3月(がつ)〜10月(がつ)。晴(は)れた 日(ひ)の 昼間(ひるま)に 飛(と)んで いるよ。",
    food: "花(はな)の 蜜(みつ)と 花粉(かふん)。",
    care: "ハチは 針(はり)が あるから、つかまえないで 見(み)るだけに しようね。花(はな)の まわりを そっと 見守(みまも)るのが いちばん だよ。",
  },
  katatsumuri: {
    family: "オナジマイマイ科",
    trivia: ["歯(は)の 数(かず)は 1万(まん) 以上(いじょう)。小(ちい)さな やすりの ような 歯(は)で 葉(は)を けずって 食(た)べるよ。",
             "殻(から)は 体(からだ)の 一部(いちぶ)。とれたら 生(い)きて いけないんだ。",
             "オスと メスの 両方(りょうほう)の 役割(やくわり)を 持(も)って いるよ。"],
    habitat: "全国(ぜんこく)の あじさいの 葉(は)・石(いし)がき・壁(かべ)。雨(あめ)の 日(ひ)や 雨(あめ)あがりに よく 出(で)て くるよ。",
    season: "5月(がつ)〜7月(がつ)（つゆの ころ）が いちばん 多(おお)いよ。",
    food: "やわらかい 葉(は)・きゅうり・にんじん。殻(から)を 作(つく)る ために たまごの 殻(から)も 食(た)べるよ。",
    care: "土(つち)と 落(お)ち葉(ば)を 入(い)れた 入(い)れものに、霧吹(きりふ)きで しめりけを 保(たも)つ。きゅうりや にんじん、そして たまごの 殻(から)を 少(すこ)し 入(い)れて あげてね。さわったら 手(て)を 洗(あら)おう。",
  },
  kumo: {
    family: "ジョロウグモ科",
    trivia: ["巣(す)の 糸(いと)は 同(おな)じ 太(ふと)さの 鋼(はがね)より 強(つよ)いと いわれて いるよ。",
             "虫(むし)では なくて、足(あし)が 8本(ほん)の「クモの 仲間(なかま)」だよ。",
             "巣(す)の 真(ま)ん中(なか)は べたべたしない ところ。自分(じぶん)は くっつかないんだ。"],
    habitat: "全国(ぜんこく)の 木(き)の 間(あいだ)・のき下(した)・草(くさ)むら。人(ひと)の 少(すく)ない 静(しず)かな 場所(ばしょ)に 巣(す)を 張(は)るよ。",
    season: "4月(がつ)〜11月(がつ)。朝(あさ)の 巣(す)は つゆが ついて きれいだよ。",
    food: "巣(す)に かかった 虫(むし)。",
    care: "巣(す)ごと 移(うつ)すのは 難(むずか)しいよ。巣(す)を こわさず、そのまま 観察(かんさつ)するのが いちばん。どんな 虫(むし)が かかるか 見(み)て みよう。",
  },
  koganemushi: {
    family: "コガネムシ科",
    trivia: ["背中(せなか)が 金色(きんいろ)や 緑(みどり)に 光(ひか)るのは、光(ひかり)の 反射(はんしゃ)の しくみ だよ。",
             "幼虫(ようちゅう)は 土(つち)の 中(なか)で 木(き)の 根(ね)を 食(た)べて 育(そだ)つんだ。",
             "飛(と)ぶのが 上手(じょうず)で、ブーンと 音(おと)を 立(た)てて 飛(と)ぶよ。"],
    habitat: "全国(ぜんこく)の 公園(こうえん)・林(はやし)・庭(にわ)。さくらや けやき、くぬぎの 葉(は)に 集(あつ)まるよ。",
    season: "6月(がつ)〜8月(がつ)。昼間(ひるま)も 夜(よる)も みつかるよ。",
    food: "木(き)の 葉(は)・くだもの。飼(か)う ときは 昆虫(こんちゅう)ゼリー。",
    care: "土(つち)を 入(い)れた 虫(むし)かごに、のぼり木(ぎ)と 昆虫(こんちゅう)ゼリー。簡単(かんたん)に 飼(か)えるよ。土(つち)が かわかない ように 霧吹(きりふ)きを。",
  },
  amenbo: {
    family: "アメンボ科",
    trivia: ["足(あし)の 先(さき)に 細(こま)かい 毛(け)が たくさん あって、水(みず)に 沈(しず)まないんだ。",
             "水面(すいめん)の ゆれを 感(かん)じて、落(お)ちた 虫(むし)を みつけるよ。",
             "つかまえると あめのような 甘(あま)い においが するから「アメンボ」って いうんだ。"],
    habitat: "全国(ぜんこく)の 池(いけ)・ぬま・流(なが)れの ゆるやかな 川(かわ)。水面(すいめん)を すべる ように 動(うご)くよ。",
    season: "4月(がつ)〜10月(がつ)。あたたかい 日(ひ)の 昼間(ひるま)に 多(おお)いよ。",
    food: "水(みず)に 落(お)ちた 小(ちい)さな 虫(むし)。",
    care: "広(ひろ)い 水槽(すいそう)と 生(い)きた えさが 必要(ひつよう)で、飼(か)うのは 難(むずか)しいよ。池(いけ)で すべる 様子(ようす)を 見(み)るのが いちばん 楽(たの)しいんだ。",
  },
  suzumushi: {
    family: "コオロギ科",
    trivia: ["「リーンリーン」と 鈴(すず)の ような きれいな 声(こえ)で 鳴(な)くよ。",
             "鳴(な)いて いるのは オスだけ。羽(はね)を こすって 音(おと)を 出(だ)すんだ。",
             "昔(むかし)から 日本(にほん)では、鳴(な)き声(ごえ)を 楽(たの)しむ 虫(むし)と して 飼(か)われて きたよ。"],
    habitat: "全国(ぜんこく)の 草(くさ)むら・林(はやし)の ふち。暗(くら)くて しめった ところに かくれて いるよ。",
    season: "8月(がつ)〜10月(がつ)。夕方(ゆうがた)から 夜(よる)に 鳴(な)いて いるよ。",
    food: "きゅうり・なす・にぼし・かつおぶし。",
    care: "土(つち)を しいた 虫(むし)かごに かくれる 場所(ばしょ)を 入(い)れる。きゅうりや なすを ようじに さして、にぼしも 少(すこ)し。土(つち)を 霧吹(きりふ)きで しめらせてね。飼(か)いやすくて、鳴(な)き声(ごえ)が 楽(たの)しめるよ。",
  },

  /* ---- おはな ---- */
  tanpopo: {
    family: "キク科",
    trivia: ["黄色(きいろ)い 花(はな)は、小(ちい)さな 花(はな)が 100〜200個(こ)も 集(あつ)まって できて いるよ。",
             "綿毛(わたげ)は 風(かぜ)に のって 1キロも 飛(と)ぶ ことが あるんだ。",
             "根(ね)は 1メートル 近(ちか)く 深(ふか)く のびるから、ぬいても また 生(は)えて くるよ。"],
    habitat: "全国(ぜんこく)の 道(みち)ばた・公園(こうえん)・河原(かわら)・グラウンドの すみ。日(ひ)あたりの よい 地面(じめん)なら どこでも 生(は)えるよ。",
    season: "3月(がつ)〜5月(がつ)（秋(あき)に 咲(さ)く ものも あるよ）。",
    food: "日(ひ)なたと 水(みず)はけの よい 土(つち)。",
    care: "綿毛(わたげ)の たねを 土(つち)に まいて、軽(かる)く 土(つち)を かけて 水(みず)を あげるだけ。とても 強(つよ)くて 育(そだ)てやすいよ。鉢(はち)は 深(ふか)い ものを 選(えら)んでね。",
  },
  sakura: {
    family: "バラ科",
    trivia: ["日本(にほん)の ソメイヨシノは 全部(ぜんぶ)、1本(ぽん)の 木(き)から 増(ふ)やした「クローン」なんだ。だから いっせいに 咲(さ)くよ。",
             "花(はな)が 咲(さ)き終(お)わってから 葉(は)っぱが 出(で)て くる 種類(しゅるい)が 多(おお)いよ。",
             "花(はな)びらは 5枚(まい)。よく 見(み)て 数(かぞ)えて みてね。"],
    habitat: "全国(ぜんこく)（沖縄(おきなわ)を のぞく）の 公園(こうえん)・川(かわ)ぞい・学校(がっこう)。日(ひ)あたりの よい 広(ひろ)い 場所(ばしょ)に 植(う)えられて いるよ。",
    season: "3月(がつ)〜4月(がつ)。咲(さ)いてから 散(ち)るまで 1〜2週間(しゅうかん)くらい。",
    food: "日(ひ)なたと、水(みず)はけの よい 広(ひろ)い 土(つち)。",
    care: "大(おお)きな 木(き)に なるから、おうちで 育(そだ)てるなら「さくらんぼの 木(き)の 仲間(なかま)」や 鉢植(はちう)え用(よう)の 小(ちい)さな 種類(しゅるい)を 選(えら)ぼう。枝(えだ)を 切(き)るのは 苦手(にがて)な 木(き)だから、切(き)らない ほうが 元気(げんき) だよ。",
  },
  tulip: {
    family: "ユリ科",
    trivia: ["土(つち)の 中(なか)の「球根(きゅうこん)」から 育(そだ)つよ。たまねぎみたいな 形(かたち) なんだ。",
             "夜(よる)や 雨(あめ)の 日(ひ)は 花(はな)を 閉(と)じて、晴(は)れると また 開(ひら)くよ。",
             "昔(むかし) オランダでは、球根(きゅうこん) 1つが 家(いえ) 1軒(けん)の 値段(ねだん)に なった ことが あるんだ。"],
    habitat: "花壇(かだん)・鉢植(はちう)え・公園(こうえん)の 花壇(かだん)。もともとは トルコあたりの 山(やま)の 花(はな) だよ。",
    season: "3月(がつ)〜5月(がつ)。",
    food: "日(ひ)なたと、水(みず)はけの よい 土(つち)。",
    care: "10月(がつ)〜11月(がつ)に 球根(きゅうこん)を、とがった ほうを 上(うえ)に して 土(つち)に うめる。深(ふか)さは 球根(きゅうこん) 2〜3個分(こぶん)。冬(ふゆ)の 間(あいだ) 外(そと)に 置(お)いて、土(つち)が かわいたら 水(みず)を あげれば 春(はる)に 咲(さ)くよ。",
  },
  himawari: {
    family: "キク科",
    trivia: ["小(ちい)さい うちは 太陽(たいよう)を 追(お)いかけて 向(む)きを 変(か)えるけど、大(おお)きく なると 東(ひがし)を 向(む)いた まま に なるよ。",
             "真(ま)ん中(なか)の たねは うずまきの 並(なら)びかた。数学(すうがく)の きれいな ルールに なって いるんだ。",
             "世界(せかい)で いちばん 高(たか)い ヒマワリは 9メートル 以上(いじょう)に なったよ。"],
    habitat: "花壇(かだん)・畑(はたけ)・学校(がっこう)の 花壇(かだん)。日(ひ)あたりの よい 広(ひろ)い 場所(ばしょ)が 好(す)き だよ。",
    season: "7月(がつ)〜9月(がつ)。",
    food: "たっぷりの 日(ひ)なたと 水(みず)。",
    care: "5月(がつ)ごろ たねを 2〜3センチの 深(ふか)さに まく。芽(め)が 出(で)たら 元気(げんき)な ものを 1本(ぽん) 残(のこ)す。夏(なつ)は 朝(あさ)に たっぷり 水(みず)を あげてね。背(せ)が 高(たか)い 種類(しゅるい)は 棒(ぼう)で 支(ささ)えよう。",
  },
  asagao: {
    family: "ヒルガオ科",
    trivia: ["つるは かならず 左巻(ひだりま)きに 巻(ま)きついて のびるよ。",
             "朝(あさ) 早(はや)く 咲(さ)いて、昼(ひる)には しぼんで しまうんだ。",
             "つぼみは 咲(さ)く 2時間(じかん)くらい 前(まえ)から ゆっくり 開(ひら)きはじめるよ。"],
    habitat: "庭(にわ)・ベランダ・学校(がっこう)の 花壇(かだん)。つるが 巻(ま)きつく ものが あれば どこでも 育(そだ)つよ。",
    season: "7月(がつ)〜9月(がつ)。朝(あさ) 4時(じ)〜7時(じ)ごろに 開(ひら)くよ。",
    food: "日(ひ)なたと、毎日(まいにち)の 水(みず)。",
    care: "5月(がつ)ごろ たねを まいて、芽(め)が 出(で)たら 鉢(はち)に 移(うつ)す。つるが のびる 棒(ぼう)や ネットを 立(た)てて あげてね。夏(なつ)は 朝(あさ)と 夕方(ゆうがた)、水(みず)を たっぷり。1年生(ねんせい)の 定番(ていばん) だよ。",
  },
  clover: {
    family: "マメ科",
    trivia: ["四(よ)つ葉(ば)に なるのは 1万本(まんぼん)に 1本(ぽん)くらい。ふまれた ところに 出(で)やすいと いわれて いるよ。",
             "葉(は)っぱの 白(しろ)い 模様(もよう)は、種類(しゅるい)に よって 形(かたち)が 違(ちが)うんだ。",
             "土(つち)を 豊(ゆた)かに する 力(ちから)が あって、畑(はたけ)の お手伝(てつだ)いに 使(つか)われるよ。"],
    habitat: "全国(ぜんこく)の 公園(こうえん)の 芝生(しばふ)・河原(かわら)・グラウンドの すみ。日(ひ)あたりの よい 地面(じめん)に 広(ひろ)がるよ。",
    season: "花(はな)は 4月(がつ)〜7月(がつ)。葉(は)っぱは 1年中(ねんじゅう) 見(み)られるよ。",
    food: "日(ひ)なたと、ふつうの 土(つち)。",
    care: "たねを 土(つち)に ぱらぱら まいて、軽(かる)く 土(つち)を かけるだけ。とても 強(つよ)いから ほったらかしでも 増(ふ)えるよ。花(はな)かんむりを 作(つく)って 遊(あそ)んで みてね。",
  },
  kinoko: {
    trivia: ["植物(しょくぶつ)では なくて「菌類(きんるい)」の 仲間(なかま)。葉(は)っぱも 根(ね)も ないんだ。",
             "見(み)えて いる 部分(ぶぶん)は ほんの 一部(いちぶ)。土(つち)の 中(なか)に 糸(いと)の ような 体(からだ)が 広(ひろ)がって いるよ。",
             "かれた 木(き)や 葉(は)っぱを 土(つち)に かえす、森(もり)の お掃除(そうじ)やさん だよ。"],
    habitat: "全国(ぜんこく)の 林(はやし)・公園(こうえん)の 木(き)の 根元(ねもと)・落(お)ち葉(ば)の 上(うえ)。雨(あめ)の あとの しめった 場所(ばしょ)に 出(で)て くるよ。",
    season: "6月(がつ)〜11月(がつ)。雨(あめ)の 次(つぎ)の 日(ひ)が みつけやすいよ。",
    food: "かれた 木(き)・落(お)ち葉(ば)（そこから 栄養(えいよう)を もらうよ）。",
    care: "山(やま)の キノコは 食(た)べられない ものや 毒(どく)の ある ものが あるから、絶対(ぜったい)に 口(くち)に 入(い)れないでね。さわったら 手(て)を 洗(あら)おう。食(た)べる キノコは「栽培(さいばい)キット」で おうちでも 育(そだ)てられるよ。",
  },
  donguri: {
    family: "ブナ科",
    trivia: ["どんぐりは「木(き)の たね」。春(はる)に なると 芽(め)が 出(で)て、小(ちい)さな 木(き)に なるよ。",
             "種類(しゅるい)に よって 形(かたち)が 違(ちが)う。丸(まる)いの、細長(ほそなが)いの、ぼうしが もじゃもじゃの ものも あるんだ。",
             "リスや ネズミが 土(つち)に うめて 忘(わす)れた どんぐりが、新(あたら)しい 木(き)に なるんだよ。"],
    habitat: "全国(ぜんこく)の 公園(こうえん)・林(はやし)の、くぬぎ・こなら・しいの 木(き)の 下(した)。秋(あき)に たくさん 落(お)ちて いるよ。",
    season: "9月(がつ)〜11月(がつ)。",
    food: "土(つち)と 水(みず)（芽(め)が 出(で)て からは 日(ひ)なたも 必要(ひつよう)）。",
    care: "水(みず)に 入(い)れて 沈(しず)む どんぐりを 選(えら)んで、鉢(はち)の 土(つち)に 横向(よこむ)きに うめる。外(そと)に 置(お)いて 土(つち)が かわいたら 水(みず)を あげると、春(はる)に 芽(め)が 出(で)るよ。虫(むし)が 出(で)る ことが あるから、拾(ひろ)ったら 1日(にち) 冷凍庫(れいとうこ)に 入(い)れると 安心(あんしん)。",
  },
  momiji: {
    family: "ムクロジ科",
    trivia: ["赤(あか)く なるのは、葉(は)っぱの 緑(みどり)が なくなって、赤(あか)い 色(いろ)が 出(で)て くるから だよ。",
             "たねには 羽(はね)が ついて いて、くるくる 回(まわ)りながら 飛(と)んで いくよ。",
             "昼(ひる)と 夜(よる)の 気温(きおん)の 差(さ)が 大(おお)きい ほど、きれいな 赤(あか)に なるんだ。"],
    habitat: "全国(ぜんこく)の 山(やま)・公園(こうえん)・日本庭園(にほんていえん)。少(すこ)し 日(ひ)かげで しめった 場所(ばしょ)が 好(す)き だよ。",
    season: "葉(は)っぱが 赤(あか)く なるのは 11月(がつ)〜12月(がつ)。",
    food: "半日(はんひ)かげと、かわきすぎない 土(つち)。",
    care: "鉢植(はちう)えでも 育(そだ)てられるよ。夏(なつ)の 強(つよ)い 日(ひ)ざしと かわきが 苦手(にがて)だから、半日(はんひ)かげに 置(お)いて 土(つち)が かわいたら 水(みず)を たっぷり。冬(ふゆ)に 形(かたち)を ととのえる くらいで 大丈夫(だいじょうぶ)。",
  },
};

for (const ins of INSECTS) Object.assign(ins, KNOWN_DETAILS[ins.id] || {});
for (const f of FLOWERS) Object.assign(f, KNOWN_DETAILS[f.id] || {});
