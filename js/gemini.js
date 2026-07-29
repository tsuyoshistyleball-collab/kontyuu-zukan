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

  /* ぜんぶの ずかんで きょうつうの「なまえの きまり」。
     AIは、それらしい なまえを その場(ば)で つくって しまう ことが ある。
     じっさいに ある なまえ だけを つかわせ、じしんが ない ときは
     「○○の なかま」と 大(おお)きく こたえさせる ための きまり。
     さきに「見(み)えた とくちょう」と「思(おも)いあたる 名前(なまえ)」を
     書(か)かせてから 答(こた)えを 決(き)めさせると、あて が よく なる。*/
  const NAME_RULES = (one, egSp, egGrp, egNg) => [
    "",
    "━━━ いちばん だいじな きまり：名前(なまえ)を つくらない ━━━",
    `・name には、日本(にほん)で じっさいに つかわれて いる ${one}の 名前(なまえ)だけを 書(か)いて ください。`,
    "・それらしい 名前(なまえ)を あたらしく つくっては いけません。",
    `  たとえば「${egNg}」の ような、図鑑(ずかん)に のって いない 名前(なまえ)は だめです。`,
    `・種(しゅ)まで はっきり しない ときは、むりに 決(き)めずに「${egGrp}」の ように`,
    "  大(おお)きな まとまりで 答(こた)えて ください。それでも りっぱな 答(こた)えです。",
    "・写真(しゃしん)で 見(み)えて いる ことだけで 決(き)めて ください。",
    "  写(うつ)って いない ところを 想像(そうぞう)して 決(き)めては いけません。",
    "",
    "━━━ 答(こた)える じゅんばん ━━━",
    "1. observed: 写真(しゃしん)で 見(み)えた 特徴(とくちょう)を 1〜2文(ぶん)で。",
    "   形(かたち)・色(いろ)・もよう・大(おお)きさ・脚(あし)や 羽(はね)の ようす・まわりの ようす。",
    "2. candidates: 思(おも)いあたる 名前(なまえ)を 6つ、あてはまる 順(じゅん)に。",
    "   それぞれ name（ひらがな）・kana（カタカナ）・why（そう 思(おも)う 理由(りゆう)を みじかく）・",
    "   confidence（0.0〜1.0）。ぜんぶ じっさいに ある 名前(なまえ) だけ。",
    "   ★ candidates は かならず 種(しゅ)の 名前(なまえ)に して ください。",
    `   「${egGrp}」の ような 大(おお)きな まとまりの 名前(なまえ)を`,
    "   candidates に 入(い)れては いけません（えらんでも うれしく ない ので）。",
    "   6つ そろえる ために、つぎの ものを 候補(こうほ)に 入(い)れて かまいません：",
    "   ・見(み)た目(め)が よく にた 別(べつ)の 種(しゅ)（同(おな)じ 科(か)の 仲間(なかま)の 種(しゅ)）",
    "   ・その あたりに ふつうに いる、にた すがたの 種(しゅ)",
    "   ・オス／メスや 子(こ)どもで 見(み)た目(め)が ちがう ときの、その 呼(よ)び名(な)",
    "   どうしても 思(おも)いつかない ときは 少(すく)なくても かまいませんが、",
    "   数(かず)を そろえる ために ない 名前(なまえ)を つくっては いけません。",
    "3. name_level: 答(こた)えの こまかさ。つぎの どれか ひとつ だけ：",
    `   「しゅ」＝ 種(しゅ)まで 分(わ)かる（れい: ${egSp}）`,
    `   「なかま」＝ 大(おお)きな まとまりまで 分(わ)かる（れい: ${egGrp}）`,
    "   「わからない」＝ ぶれて いる・小(ちい)さすぎる など で 分(わ)からない",
    "4. name: name_level が「しゅ」なら candidates の 1つめを そのまま。",
    `   「なかま」なら「${egGrp}」の ような まとまりの 名前(なまえ)に して ください。`,
    "   「わからない」なら name は からっぽに して ください。",
    "5. confidence: name が 当(あ)たって いる 自信(じしん) 0.0〜1.0。",
    "   すこしでも あやしい ときは 低(ひく)く つけて ください。",
    "   0.9より 上(うえ)に して いいのは、だれが 見(み)ても まちがえない ときだけです。",
  ].join("\n");


  /* かきかたの きまり。ぜんぶの プロンプトの さいごに つける。
     これを 書(か)かないと、trivia や riddle だけ ひらがな だらけに なる。
     （フィールドの せつめいを ひらがなで 書(か)いて いる ので、
       AIが その ちょうしに ひきずられる）*/
  const WRITE_RULES = [
    "",
    "━━━ かきかたの きまり（とても だいじ）━━━",
    "・name と kana いがいの ぶんしょうは、ぜんぶ ふつうに 漢字(かんじ)を つかって ください。",
    "  fact / where / trivia / habitat / season / food / size / care / riddle / riddle_hint、ぜんぶ です。",
    "  ひらがな だけの ぶんしょうは だめです。小学校(しょうがっこう)で ならう 漢字(かんじ)は つかって ください。",
    "・漢字(かんじ)の すぐ あとに、よみがなを まるかっこで つけて ください。",
    "・4さいが よめるように、たんごの あいだは はんかくスペースで くぎって ください。",
    "  ○ よい れい:「3本(ぼん)の 角(つの)が あって、とても かっこいい よ。」",
    "  ○ よい れい:「体(からだ)が きらきら 光(ひか)って、日(ひ)に あたると きれい だよ。」",
    "  ○ よい れい:「南(みなみ)の あたたかい 国(くに)の 森(もり)に 住(す)んで いるよ。」",
    "  ✕ わるい れい:「3つ の つの が あって、とても かっこいい よ。」← 漢字(かんじ)が ない",
    "  ✕ わるい れい:「からだ が きらきら して いて、ひかり に あたる と きれい だよ。」← 漢字(かんじ)が ない",
    "・name は ひらがな だけ、kana は カタカナ だけ（ふりがなの かっこは つけない）。",
  ].join("\n");


  /* なぞなぞの きまり。
     「大(おお)きな 角(つの)が ある」の ような、見(み)れば わかる ことだけ だと
     つまらない ので、あまり 知(し)られて いない びっくりする ことを 入(い)れさせる。*/
  const RIDDLE_RULE = (one, eg) => [
    `- riddle: この ${one}の「なぞなぞ」。おとなが 読(よ)んで あげて、4さいが`,
    "  「へぇ！」と おどろく もの。3文(ぶん)で つくって ください。",
    `  その ${one}に なりきって、「ぼく」「わたし」で 話(はな)します。`,
    "  1文目(ぶんめ): あまり 知(し)られて いない、びっくりする こと。",
    `    ほかの ${one}には あてはまらない、その 子(こ) ならでは の ひみつを 1つ。`,
    "    からだの しくみ・かくれた 力(ちから)・かわった くらしかた・すごい 数字(すうじ) など。",
    "  2文目(ぶんめ): もう 1つ、おもしろい こと。1文目とは ちがう ことを。",
    "  3文目(ぶんめ): 見(み)ためや いる 場所(ばしょ)の ヒント。これで 分(わ)かる ように。",
    "    さいごは「だあれ？」で しめて ください。",
    "  ※ 答(こた)えの 名前(なまえ)を なぞなぞの 中(なか)に 入(い)れては いけません。",
    "  ※「大(おお)きい」「かっこいい」だけ の、どの 子(こ)にも あてはまる ことは だめです。",
    "  ※ ほんとうの ことだけ 書(か)いて ください。おもしろく する ために",
    "    ないことを つくっては いけません。",
    `  ○ よい れい:「${eg}」`,
    "- riddle_hint: わからない ときの ヒント。1文(ぶん)で、名前(なまえ)は 入(い)れない。",
    "  なぞなぞより やさしい、見(み)た目(め)や 色(いろ)の ヒントに して ください。",
  ];

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
      "  ※ 漢字(かんじ)＋ふりがなで 書(か)いて ください。",
      "  れい:「3本(ぼん)の 角(つの)は オスだけ。メスには ない んだよ。」",
      "- habitat: すんで いる ところ（くわしく 1〜2ぶん。にほんの どこに いるか、どんな ばしょが すきか）",
      "- season: みられる きせつと じかんたい（れい: 6月(がつ)〜8月(がつ) の 夜(よる)）",
      "- attack: この むしの つよさ（こうげき力）。100〜900 の 10きざみの すうじ。",
      "  れい: 150 / 370 / 860。おおきい あご・つの・どく・すばやさが ある ほど たかく、",
      "  レアど（rarity）が たかい ほど たかく して ください。",
      "- defense: この むしの まもり（しゅび力）。100〜900 の 10きざみの すうじ。",
      "  かたい からだ・から・まるまる など まもりが つよい ほど たかく して ください。",
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
      ...RIDDLE_RULE("虫(むし)", "ぼくの 耳(みみ)は、前(まえ)あしの ひざの ところに あるんだ。羽(はね)を こすりあわせて 歌(うた)を うたうよ。秋(あき)の 草(くさ)むらから コロコロ 聞(き)こえて くるよ。だあれ？"),
      "いきものが いない ときは name を からっぽ、is_creature を false にして ください。",
    ].join("\n") + NAME_RULES("虫(むし)", "ナナホシテントウ", "てんとうむしの なかま", "ミドリオオツノカブト") + WRITE_RULES,
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
      "  ※ 漢字(かんじ)＋ふりがなで 書(か)いて ください。",
      "  れい:「3本(ぼん)の 角(つの)は オスだけ。メスには ない んだよ。」",
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
      "- size: その しゅるいの ふつうの おおきさ。はなの おおきさと せの たかさを。",
      "  れい:「花(はな) 3〜5cm・高(たか)さ 10〜30cm」。",
      "  ※ しゃしんから はかった ものでは なく、その しゅるいの ふつうの おおきさを かいて ください。",
      "- food: そだつのに すきな もの（ひあたり・みず・つち など、みじかく）",
      "- care: そだてかた。たねや なえから そだてる ほうほうを みじかく。",
      "  そだてるのが むずかしい ときは「育(そだ)てるのは 難(むずか)しいよ。外(そと)で 見(み)て 楽(たの)しもう」の ように かいて ください。",
      "  さわると あぶない しょくぶつは、そのことも かいて ください。",
      ...RIDDLE_RULE("花(はな)や 草(くさ)", "わたしの 花(はな)は 1つに 見(み)えて、じつは 小(ちい)さな 花(はな)が 200こも 集(あつ)まって いるの。夜(よる)に なると 花(はな)を とじて ねむるよ。春(はる)の 道(みち)ばたで 黄色(きいろ)く さいて いるよ。だあれ？"),
      "しょくぶつが ない ときは name を からっぽ、is_creature を false にして ください。",
    ].join("\n") + NAME_RULES("植物(しょくぶつ)", "セイヨウタンポポ", "たんぽぽの なかま", "アオバナヒメツユクサ") + WRITE_RULES,
    doubutsu: [
      "あなたは こども向けの どうぶつ ずかんの アシスタントです。",
      "この しゃしんに うつっている 動物(どうぶつ)（いぬ・ねこ・とり・さかな・かめ・どうぶつえんの どうぶつ など）が なにか みてください。",
      "ぬいぐるみ・おもちゃ・絵(え)・ぬりえ でも、なんの どうぶつかを こたえて ください。",
      "つぎの JSON だけを かえして ください：",
      "- name: いちばん ありそうな なまえ（ひらがな。れい: しばいぬ）",
      "- kana: カタカナの なまえ（れい: シバイヌ）",
      "- is_creature: しゃしんに 動物(どうぶつ)が うつって いるなら true、いないなら false",
      "- confidence: どれくらい じしんが あるか 0.0〜1.0 の すうじ",
      "- rarity: めずらしさ 1〜5。1=まいにち 会(あ)える / 2=よく みる / 3=ときどき みる / 4=なかなか 会(あ)えない / 5=動物園(どうぶつえん)などでしか 会(あ)えない",
      "- fact: その どうぶつの おもしろい ひとこと（みじかく）",
      "- where: どこで 会(あ)えるか（みじかく）",
      "- category: おおきな なかまわけ。つぎの どれか ひとつ： ぺっと・いえの どうぶつ / とり / のやまの どうぶつ / みずの いきもの / はちゅうるい・りょうせいるい / どうぶつえんの どうぶつ / ぼくじょうの どうぶつ / そのほか",
      "- family: せいぶつがくの「科（か）」の なまえ。カタカナ＋『科』で かいて ください。",
      "  れい: イヌ科 / ネコ科 / ウサギ科 / スズメ科 / カラス科 / カモ科 / ゾウ科 / キリン科 / ウシ科 / コイ科。",
      "  科が わからない ときは からっぽに して ください（むりに つくらない）。",
      "- trivia: まめちしき を 3つ（はいれつ。それぞれ 1ぶん・4さいが「へぇ！」と おもう ないよう）",
      "  ※ 漢字(かんじ)＋ふりがなで 書(か)いて ください。",
      "  れい:「3本(ぼん)の 角(つの)は オスだけ。メスには ない んだよ。」",
      "- habitat: すんで いる ところ（くわしく 1〜2ぶん。にほんの どこで 会(あ)えるか、どんな ばしょが すきか）",
      "- season: 会(あ)える きせつと じかんたい（一年中(いちねんじゅう) なら そう かいて ください）",
      "- attack: この どうぶつの つよさ（こうげき力）。100〜900 の 10きざみの すうじ。",
      "  からだが おおきい・つめや きばが つよい・はやく はしれる ほど たかく、",
      "  レアど（rarity）が たかい ほど たかく して ください。",
      "- defense: まもり（しゅび力）。100〜900 の 10きざみの すうじ。",
      "  こうら・あつい かわ・おおきな からだ・むれで まもる ほど たかく して ください。",
      "- move_name: この どうぶつだけの「ひっさつわざ」の 名前(なまえ)。カタカナ中心(ちゅうしん)で 4〜9もじ。",
      "  その どうぶつの とくちょう（つの・きば・つめ・はな・つばさ・はやさ・こえ など）から かんがえて ください。",
      "  れい:「ハナムチストライク」「タテガミロアー」「ダッシュクロー」。",
      "- move_cry: わざを だす ときの かけ声(ごえ)。みじかく 1ぶん。れい:「いくぞー！ ダッシュクロー！」",
      "- move_kind: わざの 見(み)ため。つぎの どれか ひとつ だけ：",
      "  きり / ほのお / かみなり / かぜ / こおり / どく / ひかり / しょうげき / いわ",
      "  （つめ・きば で きる わざ＝きり、たいあたり・つので おす＝しょうげき、",
      "   はやく はしる・つばさで かぜを おこす＝かぜ、おおごえ で ひびかせる＝かみなり、",
      "   おおきな からだで ぶつかる＝いわ、を めやすに）",
      "- move_color: わざの いろ。#RRGGBB の かたち（れい: #ffcc33）。その どうぶつの けの いろに 近(ちか)い ものを。",
      "- size: その しゅるいの ふつうの おおきさ。たいちょう（と おもさ）を かいて ください。",
      "  れい:「体長(たいちょう) 45〜55cm・重(おも)さ 3〜5kg」。",
      "  ※ しゃしんから はかった ものでは なく、その しゅるいの ふつうの おおきさを かいて ください。",
      "- food: たべもの（みじかく）",
      "- care: なかよく する コツ。ペットなら せわの しかたを みじかく。",
      "  やせいの どうぶつや 動物園(どうぶつえん)の どうぶつは「飼(か)えないよ。遠(とお)くから そっと 見(み)ようね」の ように、",
      "  さわると あぶない ときは そのことも かいて ください。",
      ...RIDDLE_RULE("動物(どうぶつ)", "ぼくの 長(なが)い 鼻(はな)には、骨(ほね)が 1本(ぽん)も ないんだ。足(あし)の うらで、遠(とお)くの なかまの 声(こえ)を 感(かん)じられるよ。大(おお)きな 耳(みみ)を ぱたぱた させて すずんで いるよ。だあれ？"),
      "動物(どうぶつ)が いない ときは name を からっぽ、is_creature を false にして ください。",
    ].join("\n") + NAME_RULES("動物(どうぶつ)", "シバイヌ", "いぬの なかま", "キタホンドオオリス") + WRITE_RULES,
  };
  const promptFor = (kind) => PROMPTS[kind] || PROMPTS.mushi;

  /* こたえの じゅんばんが だいじ。
     さきに observed（見(み)えた とくちょう）と candidates（思(おも)いあたる 名前）を
     書(か)かせて から name を きめさせる。こう すると、いきなり 名前を 言(い)って
     しまう ときより あて が よく なり、つくった 名前も でにくく なる。*/
  const REASON_FIRST = ["observed", "candidates", "name_level", "name", "kana", "is_creature", "confidence"];
  const SCHEMA = {
    type: "OBJECT",
    propertyOrdering: REASON_FIRST.concat([
      "rarity", "fact", "where", "category", "family", "trivia", "habitat", "season",
      "food", "size", "care", "attack", "defense",
      "move_name", "move_cry", "move_kind", "move_color", "riddle", "riddle_hint",
    ]),
    properties: {
      observed: { type: "STRING" },
      candidates: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          propertyOrdering: ["name", "kana", "why", "confidence"],
          properties: {
            name: { type: "STRING" }, kana: { type: "STRING" },
            why: { type: "STRING" }, confidence: { type: "NUMBER" },
          },
          required: ["name"],
        },
      },
      name_level: { type: "STRING" },
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
      move_name: { type: "STRING" },
      move_cry: { type: "STRING" },
      move_kind: { type: "STRING" },
      move_color: { type: "STRING" },
      riddle: { type: "STRING" },
      riddle_hint: { type: "STRING" },
    },
    required: ["observed", "candidates", "name_level", "name", "is_creature", "confidence", "rarity", "fact"],
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
      move_name: { type: "STRING" },
      move_cry: { type: "STRING" },
      move_kind: { type: "STRING" },
      move_color: { type: "STRING" },
      riddle: { type: "STRING" },
      riddle_hint: { type: "STRING" },
    },
    required: ["trivia", "habitat", "season", "care", "riddle"],
  };

  const DETAIL_PROMPT = {
    mushi: (name) => [
      "あなたは こども向けの こんちゅう ずかんの アシスタントです。",
      `「${name}」に ついて、4さいの こどもが よめる やさしい ひらがな で おしえて ください。`,
      "つぎの JSON だけを かえして ください：",
      "- fact: おもしろい ひとこと（みじかく）",
      "- family: せいぶつがくの「科（か）」の なまえ（カタカナ＋『科』。れい: クワガタムシ科）。わからなければ からっぽ。",
      "- trivia: まめちしき を 3つ（はいれつ。それぞれ 1ぶん）",
      "  ※ 漢字(かんじ)＋ふりがなで 書(か)いて ください。",
      "  れい:「3本(ぼん)の 角(つの)は オスだけ。メスには ない んだよ。」",
      "- habitat: すんで いる ところ（くわしく 1〜2ぶん）",
      "- season: みられる きせつと じかんたい",
      "- attack: こうげき力 100〜900（10きざみ）。つよい むし ほど たかく。",
      "- defense: しゅび力 100〜900（10きざみ）。まもりが かたい ほど たかく。",
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
      ...RIDDLE_RULE("虫(むし)", "ぼくの 耳(みみ)は、前(まえ)あしの ひざの ところに あるんだ。羽(はね)を こすりあわせて 歌(うた)を うたうよ。秋(あき)の 草(くさ)むらから コロコロ 聞(き)こえて くるよ。だあれ？"),
    ].join("\n") + WRITE_RULES,
    hana: (name) => [
      "あなたは こども向けの しょくぶつ ずかんの アシスタントです。",
      `「${name}」に ついて、4さいの こどもが よめる やさしい ひらがな で おしえて ください。`,
      "つぎの JSON だけを かえして ください：",
      "- fact: おもしろい ひとこと（みじかく）",
      "- family: しょくぶつの「科（か）」の なまえ（カタカナ＋『科』。れい: キク科）。わからなければ からっぽ。",
      "- trivia: まめちしき を 3つ（はいれつ。それぞれ 1ぶん）",
      "  ※ 漢字(かんじ)＋ふりがなで 書(か)いて ください。",
      "  れい:「3本(ぼん)の 角(つの)は オスだけ。メスには ない んだよ。」",
      "- habitat: はえて いる ところ（くわしく 1〜2ぶん）",
      "- season: はなが さく きせつ",
      "- attack: こうげき力 100〜900（10きざみ）。",
      "- defense: しゅび力 100〜900（10きざみ）。",
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
      ...RIDDLE_RULE("花(はな)や 草(くさ)", "わたしの 花(はな)は 1つに 見(み)えて、じつは 小(ちい)さな 花(はな)が 200こも 集(あつ)まって いるの。夜(よる)に なると 花(はな)を とじて ねむるよ。春(はる)の 道(みち)ばたで 黄色(きいろ)く さいて いるよ。だあれ？"),
    ].join("\n") + WRITE_RULES,
    doubutsu: (name) => [
      "あなたは こども向けの どうぶつ ずかんの アシスタントです。",
      `「${name}」に ついて、4さいの こどもが よめる やさしい ひらがな で おしえて ください。`,
      "つぎの JSON だけを かえして ください：",
      "- fact: おもしろい ひとこと（みじかく）",
      "- family: せいぶつがくの「科（か）」の なまえ（カタカナ＋『科』。れい: ネコ科）。わからなければ からっぽ。",
      "- trivia: まめちしき を 3つ（はいれつ。それぞれ 1ぶん）",
      "  ※ 漢字(かんじ)＋ふりがなで 書(か)いて ください。",
      "  れい:「3本(ぼん)の 角(つの)は オスだけ。メスには ない んだよ。」",
      "- habitat: すんで いる ところ（くわしく 1〜2ぶん）",
      "- season: 会(あ)える きせつと じかんたい（一年中(いちねんじゅう) なら そう かいて ください）",
      "- attack: こうげき力 100〜900（10きざみ）。おおきくて つよい どうぶつ ほど たかく。",
      "- defense: しゅび力 100〜900（10きざみ）。こうらや あつい かわ・おおきな からだ ほど たかく。",
      "- move_name: この どうぶつだけの「ひっさつわざ」の 名前(なまえ)。カタカナ中心(ちゅうしん)で 4〜9もじ。",
      "  れい:「ハナムチストライク」「タテガミロアー」「ダッシュクロー」。",
      "- move_cry: わざを だす ときの かけ声(ごえ)。みじかく 1ぶん。れい:「いくぞー！ ダッシュクロー！」",
      "- move_kind: わざの 見(み)ため。つぎの どれか ひとつ だけ：",
      "  きり / ほのお / かみなり / かぜ / こおり / どく / ひかり / しょうげき / いわ",
      "  （つめ・きば で きる＝きり、たいあたり＝しょうげき、はやさ・つばさ＝かぜ、",
      "   おおごえ＝かみなり、おおきな からだで ぶつかる＝いわ、を めやすに）",
      "- move_color: わざの いろ。#RRGGBB の かたち（れい: #ffcc33）。その どうぶつの けの いろに 近(ちか)い ものを。",
      "- size: その しゅるいの ふつうの おおきさ（体長(たいちょう)。おもさも わかれば）",
      "- food: たべもの（みじかく）",
      "- care: なかよく する コツ。やせいの どうぶつや 動物園(どうぶつえん)の どうぶつは",
      "  「飼(か)えないよ。遠(とお)くから そっと 見(み)ようね」の ように かいて ください。",
      "  さわると あぶない ときは、care に そのことも かいて ください。",
      ...RIDDLE_RULE("動物(どうぶつ)", "ぼくの 長(なが)い 鼻(はな)には、骨(ほね)が 1本(ぽん)も ないんだ。足(あし)の うらで、遠(とお)くの なかまの 声(こえ)を 感(かん)じられるよ。大(おお)きな 耳(みみ)を ぱたぱた させて すずんで いるよ。だあれ？"),
    ].join("\n") + WRITE_RULES,
  };

  async function details(name, key, model, kind) {
    if (!key) throw new Error("NO_KEY");
    if (!name) throw new Error("NO_NAME");
    const make = DETAIL_PROMPT[kind] || DETAIL_PROMPT.mushi;
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
        temperature: 0,          // 0だと 名前を つくりにくく、おなじ 写真で おなじ 答えに なる
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

  /* なぞなぞを まとめて つくる（もじだけ・やすい）。
     むかし とうろくした ものにも あとから なぞなぞを つけられる ように。*/
  const RIDDLE_SCHEMA = {
    type: "OBJECT",
    properties: {
      items: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          propertyOrdering: ["name", "riddle", "hint"],
          properties: { name: { type: "STRING" }, riddle: { type: "STRING" }, hint: { type: "STRING" } },
          required: ["name", "riddle"],
        },
      },
    },
    required: ["items"],
  };
  const RIDDLE_WORD = {
    mushi: ["虫(むし)", "ぼくの 耳(みみ)は、前(まえ)あしの ひざの ところに あるんだ。羽(はね)を こすりあわせて 歌(うた)を うたうよ。秋(あき)の 草(くさ)むらから コロコロ 聞(き)こえて くるよ。だあれ？"],
    hana: ["花(はな)や 草(くさ)", "わたしの 花(はな)は 1つに 見(み)えて、じつは 小(ちい)さな 花(はな)が 200こも 集(あつ)まって いるの。夜(よる)に なると 花(はな)を とじて ねむるよ。春(はる)の 道(みち)ばたで 黄色(きいろ)く さいて いるよ。だあれ？"],
    doubutsu: ["動物(どうぶつ)", "ぼくの 長(なが)い 鼻(はな)には、骨(ほね)が 1本(ぽん)も ないんだ。足(あし)の うらで、遠(とお)くの なかまの 声(こえ)を 感(かん)じられるよ。大(おお)きな 耳(みみ)を ぱたぱた させて すずんで いるよ。だあれ？"],
  };
  async function makeRiddles(names, key, model, kind) {
    if (!key) throw new Error("NO_KEY");
    if (!names || !names.length) return {};
    const [one, eg] = RIDDLE_WORD[kind] || RIDDLE_WORD.mushi;
    const prompt = [
      `つぎの ${one}の それぞれに ついて、おとなが 読(よ)んで あげて`,
      "4さいが「へぇ！」と おどろく「なぞなぞ」を 1つずつ 作(つく)って ください。",
      // 「- riddle:」「- riddle_hint:」の 見出しは この プロンプトでは つかわない
      ...RIDDLE_RULE(one, eg).filter((t) => !/^- /.test(t)).map((t) => "・" + t.trim()),
      "・hint は わからない ときの ヒント。1文(ぶん)で、名前(なまえ)は 入(い)れない。",
      "・name は わたした 名前(なまえ)を そのまま かえして ください。",
      WRITE_RULES,
      "",
      "名前(なまえ)：",
      ...names.map((n) => "- " + n),
    ].join("\n");
    const resp = await callGemini(model, key, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: RIDDLE_SCHEMA, temperature: 0.8 },
    });
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let obj = {};
    try { obj = JSON.parse(text); } catch (e) { return {}; }
    const out = {};
    for (const it of obj.items || []) {
      if (it && it.name && it.riddle) out[it.name] = { riddle: it.riddle, hint: it.hint || "" };
    }
    return out;
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
    doubutsu: "ぺっと・いえの どうぶつ / とり / のやまの どうぶつ / みずの いきもの / はちゅうるい・りょうせいるい / どうぶつえんの どうぶつ / ぼくじょうの どうぶつ / そのほか",
  };
  // なかまわけを たのむ ときの、ずかんごとの ことば
  const CLS_WORDS = {
    mushi: { what: "いきもの", extra: "むし以外（かえる・とかげ など）は「かえる・いきもの」に して ください。\n",
             famEg: "（れい: クワガタムシ科 / コガネムシ科 / アゲハチョウ科 / トンボ科 / アリ科）。" },
    hana: { what: "しょくぶつ", extra: "",
            famEg: "（れい: キク科 / バラ科 / ユリ科 / マメ科 / ブナ科）。" },
    doubutsu: { what: "どうぶつ", extra: "",
                famEg: "（れい: イヌ科 / ネコ科 / スズメ科 / カモ科 / ゾウ科 / ウシ科）。" },
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
    const w = CLS_WORDS[kind] || CLS_WORDS.mushi;
    const prompt =
      `つぎの ${w.what}の なまえを、` +
      "それぞれ なかまわけ して ください。\n" +
      "category は かならず つぎの どれか ひとつ：" + (CATS[kind] || CATS.mushi) + "\n" +
      w.extra +
      "family は せいぶつがくの「科（か）」の なまえを カタカナ＋『科』で かいて ください" +
      w.famEg +
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

  return { identify, test, classifyNames, details, makeRiddles, DEFAULT_MODEL, OUTDATED_MODELS };
})();
