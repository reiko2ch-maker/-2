const SAVE_KEY = "yoinari-ryokan-save-v1";
const canvas = document.getElementById("viewport");
const ctx = canvas.getContext("2d");
const textBox = document.getElementById("text-box");
const choiceBox = document.getElementById("choice-box");
const controls = document.getElementById("controls");
const statsEl = document.getElementById("stats");
const dayLabel = document.getElementById("day-label");
const phaseLabel = document.getElementById("phase-label");
const objectiveLabel = document.getElementById("objective-label");
const turnLabel = document.getElementById("turn-label");

const DIRS = [
  { x: 0, y: -1, name: "北" },
  { x: 1, y: 0, name: "東" },
  { x: 0, y: 1, name: "南" },
  { x: -1, y: 0, name: "西" },
];

const roomMeta = {
  H: { name: "廊下", tint: "#34281b", floor: "#5a4127", ceiling: "#2c1d12" },
  E: { name: "従業員室", tint: "#2d2c2a", floor: "#615340", ceiling: "#2a2824" },
  D: { name: "帳場", tint: "#382919", floor: "#5b4028", ceiling: "#2c1d10" },
  G: { name: "客室", tint: "#3b2c1d", floor: "#654b2b", ceiling: "#302215" },
  B: { name: "浴場前", tint: "#23333d", floor: "#3f5a66", ceiling: "#1a2329" },
  S: { name: "倉庫", tint: "#292626", floor: "#4d423b", ceiling: "#201d1d" },
  K: { name: "階段前", tint: "#34261b", floor: "#5e472f", ceiling: "#24190f" },
  A: { name: "離れ前の渡り廊下", tint: "#231d1d", floor: "#45302d", ceiling: "#1b1414" },
  Z: { name: "0号室", tint: "#1f1622", floor: "#2d2033", ceiling: "#140f17" },
  R: { name: "神棚の間", tint: "#32291d", floor: "#58462e", ceiling: "#23190e" },
  W: { name: "裏庭への出口", tint: "#212b20", floor: "#334433", ceiling: "#171b16" },
  O: { name: "離れの客室", tint: "#292323", floor: "#473434", ceiling: "#1b1515" },
};

const game = {
  started: false,
  mode: "title",
  day: 1,
  phase: "title",
  tasksDone: 0,
  nightTurns: 0,
  maxNightTurns: 0,
  currentNight: 1,
  objective: "",
  currentMap: null,
  pos: { x: 1, y: 1 },
  dir: 0,
  visited: {},
  eventSeen: {},
  log: [],
  stats: {
    女将従順: 0,
    仲居信頼: 0,
    好奇心: 0,
    正気度: 5,
    疑念: 0,
  },
  flags: {
    guestbookMark: false,
    reported303: false,
    heardMaid: false,
    gotStorehouseKey: false,
    readLedger: false,
    foundName: false,
    promisedMaid: false,
    preparedRoom0: false,
    destroyedBell: false,
    openedDetached: false,
    tookHelmet: false,
    tookFlags: false,
    metGuide: false,
    followedGuide: false,
    savedGuest: false,
    resigned: false,
  },
};

const DAY_EVENTS = {
  1: {
    opening: `山奥にある古い旅館「宵鳴り旅館」。\nあなたは住み込みの従業員として、この館で働き始めた。\n\n給料は悪くない。寝床も食事も出る。\nただし、初日から一つだけ妙な決まりを告げられた。\n\n「三階の突き当たりには、夜は行かないこと」`,
    tasks: [
      {
        title: "客室清掃を手伝う",
        text: "畳の目を整え、湯呑みを下げる。303号室だけ、誰も泊まっていないはずなのに布団に人の重みが残っていた。",
        effects: { 好奇心: 1, 疑念: 1 },
      },
      {
        title: "帳場で宿帳を整理する",
        text: "宿帳の端に、赤い筆で塗りつぶされた一行を見つけた。名前だけが読めない。",
        effects: { 好奇心: 1 },
        setFlags: { guestbookMark: true },
      },
      {
        title: "浴場前の見回りをする",
        text: "夜でもないのに、浴場の曇りガラスに人影が一つ映った。中には誰もいない。",
        effects: { 疑念: 1, 正気度: -1 },
      },
      {
        title: "玄関当番で客を迎える",
        text: "白い手袋の古い客が一人。部屋番号を聞いても『いつもの部屋だ』とだけ言って笑った。",
        effects: { 女将従順: 1 },
      },
    ],
    eveningText: `夕方。女将が帳場の奥で湯呑みを置き、静かに言った。\n\n「呼び鈴が鳴っても、返事がなければ二回以上は叩かないこと」`,
    eveningChoices: [
      {
        title: "素直にうなずく",
        result: "あなたは余計なことを聞かず、女将の目を見てうなずいた。",
        effects: { 女将従順: 1 },
      },
      {
        title: "無口な仲居に話しかける",
        result: "若い仲居は小さな声で言う。『夜に鳴る鈴は、返事をしない方がいいです』",
        effects: { 仲居信頼: 1, 好奇心: 1 },
        setFlags: { heardMaid: true },
      },
    ],
  },
  2: {
    opening: `二日目。館の空気に少し慣れた頃、三階の303号室から昨夜のことが離れない。\n宿帳には載っていないのに、確かにあの部屋には人の気配があった。`,
    tasks: [
      {
        title: "朝食を配膳する",
        text: "無言の客が、箸袋の裏に『見たら、名前を呼ぶな』と書いて返してきた。",
        effects: { 疑念: 1, 好奇心: 1 },
      },
      {
        title: "クレーム対応をする",
        text: "『夜中、廊下を旗を振りながら歩く男がいる』という苦情。女将は表情を変えなかった。",
        effects: { 女将従順: 1 },
        setFlags: { metGuide: true },
      },
      {
        title: "備品倉庫の在庫を確認する",
        text: "倉庫の鍵だけが見当たらない。代わりに白いヘルメットの顎紐が一本、床に落ちていた。",
        effects: { 好奇心: 1 },
      },
      {
        title: "離れの廊下を掃除する",
        text: "女将に禁止されていたはずの離れ。掃除をしていると、障子の向こうで赤い旗が一度だけ振られた。",
        effects: { 正気度: -1, 疑念: 1 },
      },
    ],
    eveningText: `夜支度の前。303号室の件をどうするか、選ばなければならない。`,
    eveningChoices: [
      {
        title: "女将に303号室の異変を報告する",
        result: "女将は少しだけ笑い、『余計な詮索をしないのが長続きの秘訣よ』と言った。",
        effects: { 女将従順: 1 },
        setFlags: { reported303: true },
      },
      {
        title: "仲居にだけ打ち明ける",
        result: "仲居は急いで小さな鍵を押しつけた。『倉庫の帳面を見てください。きっと分かる』",
        effects: { 仲居信頼: 1, 好奇心: 1 },
        setFlags: { gotStorehouseKey: true, heardMaid: true },
      },
    ],
  },
  3: {
    opening: `三日目。館内の視線が、あなたを“新入り”ではなく“次の番”として見始めている気がする。\n従業員の名札が一枚、昨日までなかった場所に増えていた。`,
    tasks: [
      {
        title: "宴会場の準備をする",
        text: "人数分より一膳だけ多い箸が並んでいた。片付けても、振り返くとまた一本増えている。",
        effects: { 正気度: -1, 疑念: 1 },
      },
      {
        title: "送迎帳を確認する",
        text: "昨夜の送迎欄に、来館記録のない“誘導員一名”という筆跡を見つけた。",
        effects: { 好奇心: 1, 疑念: 1 },
      },
      {
        title: "布団敷きを手伝う",
        text: "0号室の分だと言われた布団が、館内図にない部屋番号で一組だけ用意されていた。",
        effects: { 女将従順: 1 },
        setFlags: { preparedRoom0: true },
      },
      {
        title: "裏口の見回りをする",
        text: "裏口の砂利に、片足だけの足跡が並んでいた。先には白いヘルメットと赤白の旗の影。",
        effects: { 好奇心: 1 },
        setFlags: { metGuide: true },
      },
    ],
    eveningText: `消灯前。女将は『今夜は離れに近づかないで』と念を押した。\n一方で仲居は、倉庫の帳面を確かめてほしいと視線だけで訴える。`,
    eveningChoices: [
      {
        title: "女将の指示を守ると決める",
        result: "あなたはこれ以上深入りしないと自分に言い聞かせた。",
        effects: { 女将従順: 1 },
      },
      {
        title: "宿帳の赤い名前を追うと決める",
        result: "あなたは赤く塗られた名前の下に、かすかに残る文字列を思い出した。『霧生 アキラ』。",
        effects: { 好奇心: 1, 仲居信頼: 1 },
        setFlags: { foundName: true },
      },
    ],
  },
  4: {
    opening: `四日目。朝から館内が妙に静かだ。\n女将は0号室用の食事を用意しろと言い、仲居は今夜が最後の機会だと囁いた。`,
    tasks: [
      {
        title: "0号室の食事を用意する",
        text: "湯気の立つ膳を持つと、どこからか『遅い』という男の声がした。声の主は見当たらない。",
        effects: { 女将従順: 1, 正気度: -1 },
        setFlags: { preparedRoom0: true },
      },
      {
        title: "客の忘れ物を調べる",
        text: "白いヘルメットの内側に、古びた名札が差し込まれていた。『霧生 アキラ』。",
        effects: { 好奇心: 1 },
        setFlags: { foundName: true },
      },
      {
        title: "神棚を掃除する",
        text: "鈴が一つ、縄のないまま棚に置かれていた。触れると耳鳴りがした。",
        effects: { 疑念: 1 },
      },
      {
        title: "退職希望の書き置きを破る",
        text: "何枚も、何枚も、同じ筆跡の退職届。最後の一枚だけ、あなたの名前で書かれていた。",
        effects: { 正気度: -1, 女将従順: 1 },
      },
    ],
    eveningText: `消灯直前。あなたは決めなければならない。\n鈴を守るか、壊すか。館に残るか、終わらせるか。`,
    eveningChoices: [
      {
        title: "女将の命令通り、鈴を離れへ運ぶ",
        result: "あなたは鈴を抱え、冷たい金属の重みを感じた。女将が満足そうに目を細める。",
        effects: { 女将従順: 1 },
      },
      {
        title: "仲居の頼みを聞き、鈴を壊す覚悟を決める",
        result: "仲居は初めてはっきりと笑った。『出口は裏庭です。夜明け前なら、まだ』",
        effects: { 仲居信頼: 1, 好奇心: 1 },
        setFlags: { promisedMaid: true },
      },
    ],
  },
};

const NIGHT_MAPS = {
  1: {
    start: { x: 2, y: 4, dir: 0 },
    maxTurns: 14,
    objective: "3階の303号室から鳴る呼び鈴の正体を確かめる",
    grid: [
      "#####",
      "#HGH#",
      "#HHH#",
      "#HKH#",
      "#HEH#",
      "#####",
    ],
    tileText: {
      G: "303号室。障子の隙間から、水のような冷気が漏れている。",
      K: "階段前。上から、かすかな鈴の音。",
      E: "従業員室。狭いが今だけは唯一落ち着ける。",
    },
    events: [
      {
        id: "n1-room303",
        x: 2, y: 1,
        inspectText: `303号室の障子を二度だけ叩く。\n返事はない。\nそれでも障子を開けると、部屋の中央に濡れた足跡だけが残っていた。\n\n床の間には、宿帳にない部屋札が一枚。『0』。`,
        effects: { 疑念: 1, 好奇心: 1 },
        onDone() {
          endNight(`あなたは303号室の異変を胸に刻み、部屋札『0』を隠して持ち帰った。`);
        },
      },
    ],
  },
  2: {
    start: { x: 2, y: 5, dir: 0 },
    maxTurns: 16,
    objective: "倉庫の帳面を見つける。離れの渡り廊下では“誘導員”に注意",
    grid: [
      "######",
      "#HSHA#",
      "#HHH##",
      "#HBHH#",
      "#HKDH#",
      "#HEHH#",
      "######",
    ],
    tileText: {
      S: "備品倉庫。古びた錠前がかかっている。",
      A: "渡り廊下。夜気が冷たく、先が妙に長く見える。",
      B: "浴場前。滴るような音が壁の向こうを這っている。",
      D: "帳場。夜の帳場は生き物のように静かだ。",
    },
    events: [
      {
        id: "n2-guide",
        x: 4, y: 1,
        inspectText: `渡り廊下の奥。\n青い制服、白いヘルメット、紅白の旗。\n笑っているのか歯を剥いているのか分からない顔で、男が左右の旗を交互に振る。\n\n『こちら、安全です』`,
        effects: { 正気度: -1 },
        choices: [
          {
            title: "旗に従って進む",
            result: "足元が抜けるような感覚。気づくと浴場前に立っていた。口の中が鉄臭い。",
            effects: { 正気度: -1 },
            setFlags: { followedGuide: true, metGuide: true },
            moveTo: { x: 2, y: 3, dir: 2 },
          },
          {
            title: "目を合わせず戻る",
            result: "視界の端で、赤い旗だけがしばらく振られていた。",
            effects: { 好奇心: 1 },
            setFlags: { metGuide: true },
          },
        ],
      },
      {
        id: "n2-storehouse",
        x: 2, y: 1,
        inspectText(game) {
          if (!game.flags.gotStorehouseKey) {
            return `倉庫の錠前は固く閉じている。\n仲居が渡してくれた鍵がなければ開けられそうにない。`;
          }
          return `倉庫の中には古い帳面と、従業員の名札箱。\n帳面には同じ記録が繰り返されている。\n\n『夜勤従業員 霧生アキラ　退職届受理』\n『夜勤従業員 霧生アキラ　配属：誘導』\n\n退職したはずの名が、そのまま勤務表に残っている。`;
        },
        effects(game) {
          if (!game.flags.gotStorehouseKey) return {};
          return { 好奇心: 1, 疑念: 1 };
        },
        setFlags(game) {
          if (!game.flags.gotStorehouseKey) return {};
          return { readLedger: true };
        },
        onDone(game) {
          if (!game.flags.gotStorehouseKey) return;
          endNight(`帳面を閉じた瞬間、どこかで鈴が一度だけ鳴った。\nあなたは“霧生アキラ”という名を忘れられなくなる。`);
        },
      },
    ],
  },
  3: {
    start: { x: 1, y: 5, dir: 0 },
    maxTurns: 18,
    objective: "倉庫の奥と帳場を調べ、0号室に繋がる記録を追う",
    grid: [
      "#######",
      "#SHHAA#",
      "#HHHHH#",
      "#HDRHH#",
      "#HHKHH#",
      "#EHHWH#",
      "#######",
    ],
    tileText: {
      S: "倉庫。昨日見た帳面のさらに奥に、まだ何かある。",
      A: "渡り廊下。今夜は風がないのに旗の布が鳴っている。",
      D: "帳場。宿帳と鍵箱の匂いが混ざっている。",
      R: "神棚の間。鈴の残響が壁に染みついている。",
      W: "裏庭への出口。戸は重いが開きそうだ。",
    },
    events: [
      {
        id: "n3-storehouse-secret",
        x: 1, y: 1,
        inspectText: `倉庫の棚の裏から、白いヘルメットと紅白の旗が一組出てきた。\n名札の裏にはこう書いてある。\n\n『誘導は笑って行うこと』`,
        effects: { 正気度: -1 },
        choices: [
          {
            title: "触れずに戻す",
            result: "ヘルメットの内側から誰かの吐息のような温度を感じたが、見なかったことにした。",
            effects: { 仲居信頼: 1 },
          },
          {
            title: "ヘルメットを持っていく",
            result: "重さはないのに、被った記憶だけが頭に差し込まれる。",
            effects: { 正気度: -1 },
            setFlags: { tookHelmet: true },
          },
          {
            title: "旗を持っていく",
            result: "白旗は冷たく、赤旗は妙に生ぬるい。手放したくなくなる。",
            effects: { 正気度: -1 },
            setFlags: { tookFlags: true },
          },
        ],
      },
      {
        id: "n3-desk-name",
        x: 2, y: 3,
        inspectText: `帳場の奥の宿帳。\n赤く塗られた一行に、爪で削ったような跡がある。\n\n『霧生アキラ　住み込み従業員』\n\nその下に、薄く重なってもう一つの文字。\n\n『次の名を上書きすること』`,
        effects: { 好奇心: 1, 疑念: 1 },
        setFlags: { foundName: true },
      },
      {
        id: "n3-shrine-bell",
        x: 3, y: 3,
        inspectText: `神棚の間の鈴に触れる。\n耳鳴りの向こうで、仲居の声がした。\n\n『0号室に運ばれる前に壊してください。じゃないと、あなたの名前で上書きされる』`,
        effects: { 仲居信頼: 1 },
        setFlags: { promisedMaid: true },
        onDone() {
          endNight(`今夜の探索で、館の仕組みはほぼ見えた。\n残るのは、壊すか、従うかだけだ。`);
        },
      },
    ],
  },
  4: {
    start: { x: 1, y: 5, dir: 0 },
    maxTurns: 22,
    objective: "離れの先、0号室へ向かう。鈴を壊すか、運ぶか、逃げるかを選ぶ",
    grid: [
      "#######",
      "#AAAOZ#",
      "#HHHHH#",
      "#HDRHH#",
      "#HHKHH#",
      "#EHHWH#",
      "#######",
    ],
    tileText: {
      A: "離れへの渡り廊下。今夜は一歩ごとに床が軋む。",
      O: "離れの客室。誰かが先に通った気配。",
      Z: "0号室。存在してはいけない部屋番号。",
      R: "神棚の間。鈴を壊すならここだ。",
      W: "裏庭への出口。逃げるなら今しかない。",
    },
    events: [
      {
        id: "n4-guide-final",
        x: 3, y: 1,
        inspectText: `渡り廊下の中央。\nあの誘導員が、今夜はあなたの正面に立っている。\n白い旗が出口を、赤い旗が0号室を示している。\n\n『交代の時間です』`,
        effects: { 正気度: -1 },
        choices: [
          {
            title: "赤い旗の方へ進む",
            result: "あなたは0号室の方へ足を向けた。誘導員の笑みが深くなる。",
            setFlags: { metGuide: true, followedGuide: true },
            moveTo: { x: 5, y: 1, dir: 3 },
          },
          {
            title: "白い旗の方へ進む",
            result: "裏庭の湿った空気が、一瞬だけ肺に入った。",
            setFlags: { metGuide: true },
            moveTo: { x: 4, y: 5, dir: 0 },
          },
          {
            title: "目を閉じて神棚へ戻る",
            result: "鈴を壊すなら今しかない。あなたは踵を返した。",
            moveTo: { x: 3, y: 3, dir: 0 },
          },
        ],
      },
      {
        id: "n4-shrine-choice",
        x: 3, y: 3,
        inspectText: `神棚の鈴が冷たく震えている。\n叩き割れば、何かが終わる。\n運べば、何かが続く。`,
        choices: [
          {
            title: "鈴を叩き割る",
            result: "金属が裂ける音と同時に、館中の足音が止まった。",
            setFlags: { destroyedBell: true },
            onDone() {
              triggerEnding();
            },
          },
          {
            title: "鈴を抱えて0号室へ運ぶ",
            result: "重くもない鈴が、腕の中で脈打っている。",
            setFlags: { preparedRoom0: true },
            moveTo: { x: 5, y: 1, dir: 3 },
          },
        ],
      },
      {
        id: "n4-zero-room",
        x: 5, y: 1,
        inspectText: `0号室の襖が開く。\n中には畳も布団もなく、帳場の机と宿帳だけが置かれていた。\n宿帳の最下段には、まだ乾いていないあなたの名前。`,
        effects: { 正気度: -1 },
        setFlags: { openedDetached: true },
        choices: [
          {
            title: "自分の名前を消す",
            result: "爪が割れるほど擦る。後ろで誰かが怒鳴った。",
            setFlags: { savedGuest: true },
            onDone() {
              triggerEnding();
            },
          },
          {
            title: "そのまま署名する",
            result: "筆が勝手に動き、最後の一画を足した。",
            onDone() {
              triggerEnding();
            },
          },
          {
            title: "裏庭へ逃げる",
            result: "あなたは襖を蹴り、湿った夜気の方へ走った。",
            setFlags: { resigned: true },
            onDone() {
              triggerEnding();
            },
          },
        ],
      },
      {
        id: "n4-exit",
        x: 4, y: 5,
        inspectText: `裏庭の戸口。\n外はまだ暗い。山道は危険だが、館の中よりはましに見える。`,
        choices: [
          {
            title: "そのまま逃げる",
            result: "後ろで鈴が狂ったように鳴り始める。あなたは振り返らない。",
            setFlags: { resigned: true },
            onDone() {
              triggerEnding();
            },
          },
          {
            title: "戻って終わらせる",
            result: "逃げるだけでは終わらない。あなたはもう一度館へ戻った。",
            moveTo: { x: 3, y: 3, dir: 0 },
          },
        ],
      },
    ],
  },
};

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function resetGame() {
  Object.assign(game, {
    started: true,
    mode: "story",
    day: 1,
    phase: "opening",
    tasksDone: 0,
    nightTurns: 0,
    maxNightTurns: 0,
    currentNight: 1,
    objective: "",
    currentMap: null,
    pos: { x: 1, y: 1 },
    dir: 0,
    visited: {},
    eventSeen: {},
    log: [],
    stats: { 女将従順: 0, 仲居信頼: 0, 好奇心: 0, 正気度: 5, 疑念: 0 },
    flags: {
      guestbookMark: false,
      reported303: false,
      heardMaid: false,
      gotStorehouseKey: false,
      readLedger: false,
      foundName: false,
      promisedMaid: false,
      preparedRoom0: false,
      destroyedBell: false,
      openedDetached: false,
      tookHelmet: false,
      tookFlags: false,
      metGuide: false,
      followedGuide: false,
      savedGuest: false,
      resigned: false,
    },
  });
}

function saveGame() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(game));
  toast("保存しました。GitHub Pagesでもこの端末なら続きから遊べます。");
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    Object.assign(game, parsed);
    return true;
  } catch (e) {
    return false;
  }
}

function clearChoices() {
  choiceBox.innerHTML = "";
}

function setText(text) {
  textBox.textContent = text;
}

function addChoice(label, onClick, opts = {}) {
  const btn = document.createElement("button");
  btn.className = "choice-btn";
  if (opts.secondary) btn.classList.add("secondary");
  if (opts.ghost) btn.classList.add("ghost");
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  choiceBox.appendChild(btn);
}

function showControls(show = true) {
  controls.classList.toggle("hidden", !show);
}

function updateHUD() {
  dayLabel.textContent = `Day ${game.day}`;
  phaseLabel.textContent = phaseName(game.phase);
  objectiveLabel.textContent = `目的: ${game.objective || "まだありません"}`;
  turnLabel.textContent = game.phase === "night" ? `残り行動 ${Math.max(0, game.maxNightTurns - game.nightTurns)}` : "";
  statsEl.innerHTML = Object.entries(game.stats)
    .map(([k, v]) => `<div class="stat"><span class="k">${k}</span><span class="v">${v}</span></div>`)
    .join("");
}

function phaseName(phase) {
  return ({
    title: "タイトル",
    opening: "導入",
    tasks: "接客シミュ",
    evening: "夕方",
    night: "探索",
    ending: "エンディング",
    story: "物語",
  })[phase] || phase;
}

function toast(msg) {
  setText(msg);
  clearChoices();
  addChoice("戻る", () => routeByState(), { ghost: true });
  showControls(false);
  updateHUD();
}

function routeByState() {
  if (game.mode === "title") return showTitle();
  if (game.phase === "opening") return showOpening();
  if (game.phase === "tasks") return showTaskSelection();
  if (game.phase === "evening") return showEveningChoice();
  if (game.phase === "night") return enterNightMode(false);
  if (game.phase === "ending") return renderEndingScreen();
}

function applyEffects(effects = {}) {
  Object.entries(effects).forEach(([key, value]) => {
    game.stats[key] = (game.stats[key] || 0) + value;
  });
  game.stats.正気度 = Math.max(0, Math.min(7, game.stats.正気度));
}

function applySetFlags(setFlags = {}) {
  Object.entries(setFlags).forEach(([key, value]) => {
    game.flags[key] = value;
  });
}

function showTitle() {
  game.mode = "title";
  game.phase = "title";
  game.objective = "働くか、終わらせるか、取り込まれるか。";
  updateHUD();
  setText(`山奥の古い和風旅館で住み込み勤務を始めたあなた。\n\n昼は接客。夜は探索。\n異変を追うか、見て見ぬふりをするか。\n選択で結末が変わります。\n\n※ 縦画面向け / GitHub Pages対応 / セーブあり`);
  clearChoices();
  addChoice("はじめから", () => {
    resetGame();
    showOpening();
  });
  addChoice("続きから", () => {
    if (!loadGame()) {
      toast("セーブデータがありません。");
      return;
    }
    routeByState();
  });
  addChoice("操作説明", () => {
    setText(`操作\n\n・昼: 選択肢で接客や会話を進めます\n・夜: 左右で向きを変え、前進/後退で移動\n・調べる: 今いる場所の異変やイベントを確認\n・保存: その場でセーブ\n\n“青い制服・白ヘルメット・紅白の旗”を持つ誘導員は、あなたが送ってくれた写真の要素をもとにしたオリジナル怪異キャラとして入っています。`);
    clearChoices();
    addChoice("戻る", showTitle, { ghost: true });
  }, { ghost: true });
  showControls(false);
  render();
}

function showOpening() {
  game.mode = "story";
  game.phase = "opening";
  game.tasksDone = 0;
  game.objective = "昼の仕事をこなし、夜の異変に備える";
  updateHUD();
  clearChoices();
  setText(DAY_EVENTS[game.day].opening);
  addChoice("仕事を始める", () => {
    game.phase = "tasks";
    showTaskSelection();
  });
  showControls(false);
  render();
  saveSilently();
}

function showTaskSelection() {
  game.phase = "tasks";
  updateHUD();
  const dayData = DAY_EVENTS[game.day];
  setText(`${dayData.opening}\n\n今日の仕事を2つ選んでください。\n選んだ内容で夜の展開やエンディングが少しずつ変わります。`);
  clearChoices();
  const selectedTitles = game.log.filter((x) => x.day === game.day && x.type === "task").map((x) => x.title);
  dayData.tasks.forEach((task) => {
    if (selectedTitles.includes(task.title)) return;
    addChoice(task.title, () => {
      const effects = typeof task.effects === "function" ? task.effects(game) : task.effects;
      const flags = typeof task.setFlags === "function" ? task.setFlags(game) : task.setFlags;
      applyEffects(effects || {});
      applySetFlags(flags || {});
      game.tasksDone += 1;
      game.log.push({ day: game.day, type: "task", title: task.title });
      setText(task.text + `\n\n(${game.tasksDone}/2 完了)`);
      clearChoices();
      if (game.tasksDone >= 2) {
        addChoice("夕方へ進む", () => {
          game.phase = "evening";
          showEveningChoice();
        });
      } else {
        addChoice("もう一つ仕事を選ぶ", showTaskSelection);
      }
      updateHUD();
      render();
      saveSilently();
    });
  });
  if (selectedTitles.length > 0) {
    addChoice("このまま夕方へ", () => {
      game.phase = "evening";
      showEveningChoice();
    }, { ghost: true });
  }
  showControls(false);
  render();
}

function showEveningChoice() {
  game.phase = "evening";
  updateHUD();
  const dayData = DAY_EVENTS[game.day];
  setText(dayData.eveningText);
  clearChoices();
  dayData.eveningChoices.forEach((choice) => {
    addChoice(choice.title, () => {
      applyEffects(choice.effects || {});
      applySetFlags(choice.setFlags || {});
      setText(choice.result);
      clearChoices();
      addChoice("夜の見回りへ", () => startNight(game.day));
      updateHUD();
      render();
      saveSilently();
    });
  });
  showControls(false);
  render();
}

function startNight(day) {
  game.phase = "night";
  game.currentNight = day;
  const night = NIGHT_MAPS[day];
  game.currentMap = night;
  game.pos = { x: night.start.x, y: night.start.y };
  game.dir = night.start.dir;
  game.nightTurns = 0;
  game.maxNightTurns = night.maxTurns;
  game.objective = night.objective;
  game.visited = {};
  updateHUD();
  enterNightMode(true);
  saveSilently();
}

function enterNightMode(announce = false) {
  game.phase = "night";
  updateHUD();
  showControls(true);
  clearChoices();
  if (announce) {
    const room = currentRoom();
    setText(`深夜の見回りが始まった。\n\n現在地: ${roomMeta[room]?.name || "不明"}\n${describeCurrentTile()}\n\n目的: ${game.objective}`);
  } else {
    setText(`${describeCurrentTile()}\n\n向き: ${DIRS[game.dir].name}`);
  }
  render();
}

function currentRoom() {
  const row = game.currentMap.grid[game.pos.y];
  return row ? row[game.pos.x] : "#";
}

function isPassable(x, y) {
  const row = game.currentMap.grid[y];
  if (!row) return false;
  const tile = row[x];
  return tile && tile !== "#";
}

function relativeDir(offset) {
  return (game.dir + offset + 4) % 4;
}

function move(offset) {
  const d = DIRS[relativeDir(offset)];
  const nx = game.pos.x + d.x;
  const ny = game.pos.y + d.y;
  if (!isPassable(nx, ny)) {
    setText(`その先は進めない。\n\n${describeCurrentTile()}`);
    render();
    return;
  }
  game.pos = { x: nx, y: ny };
  stepTurn();
  setText(`${describeCurrentTile()}\n\n向き: ${DIRS[game.dir].name}`);
  render();
  maybeAutoEnding();
  saveSilently();
}

function stepTurn() {
  game.nightTurns += 1;
  if (game.nightTurns >= game.maxNightTurns) {
    timeoutNight();
  }
  updateHUD();
}

function timeoutNight() {
  if (game.day < 4) {
    endNight(`見回りの時間が尽きた。\n戻った帳場で、女将は何も言わずに湯呑みを差し出した。\n何も知らないふりをするには、まだ間に合う。`);
  } else {
    game.phase = "ending";
    renderEnding("夜回り失敗", `離れへ向かう前に夜が明け、あなたの名前は宿帳の最後に静かに書き加えられた。\n\n館を終わらせることも、逃げることもできなかった。`);
  }
}

function endNight(summaryText) {
  if (game.day >= 4) {
    triggerEnding();
    return;
  }
  setText(summaryText);
  clearChoices();
  showControls(false);
  addChoice("次の日へ", () => {
    game.day += 1;
    game.tasksDone = 0;
    game.phase = "opening";
    showOpening();
  });
  render();
  saveSilently();
}

function inspectCurrent() {
  const ev = findEventAt(game.pos.x, game.pos.y);
  if (!ev) {
    setText(`この場所を調べても、今は目立った手掛かりはない。\n\n${describeCurrentTile()}`);
    render();
    return;
  }

  const text = typeof ev.inspectText === "function" ? ev.inspectText(game) : ev.inspectText;
  const effects = typeof ev.effects === "function" ? ev.effects(game) : ev.effects;
  const setFlags = typeof ev.setFlags === "function" ? ev.setFlags(game) : ev.setFlags;

  if (!game.eventSeen[ev.id]) {
    applyEffects(effects || {});
    applySetFlags(setFlags || {});
    game.eventSeen[ev.id] = true;
  }

  setText(text);
  clearChoices();
  showControls(false);

  if (ev.choices) {
    ev.choices.forEach((choice) => {
      addChoice(choice.title, () => {
        applyEffects(choice.effects || {});
        applySetFlags(choice.setFlags || {});
        if (choice.moveTo) {
          game.pos = { x: choice.moveTo.x, y: choice.moveTo.y };
          game.dir = choice.moveTo.dir ?? game.dir;
        }
        setText(choice.result);
        clearChoices();
        const onDone = choice.onDone || ev.onDone;
        if (onDone) {
          addChoice("進む", () => {
            onDone(game);
            if (game.phase === "night") enterNightMode(false);
          });
        } else {
          addChoice("戻る", () => {
            game.phase = "night";
            enterNightMode(false);
          });
        }
        render();
        saveSilently();
      });
    });
  } else {
    addChoice("戻る", () => {
      if (ev.onDone) {
        ev.onDone(game);
      }
      if (game.phase === "night") enterNightMode(false);
    });
  }

  render();
  saveSilently();
}

function findEventAt(x, y) {
  const events = game.currentMap?.events || [];
  return events.find((e) => e.x === x && e.y === y);
}

function describeCurrentTile() {
  const room = currentRoom();
  const meta = roomMeta[room] || { name: "不明" };
  const custom = game.currentMap.tileText[room] || `${meta.name}にいる。`;
  let extra = "";
  if (room === "A" && game.flags.metGuide) extra = "\n気のせいか、前方から布が切る風の音がする。";
  if (room === "Z") extra = "\nこの部屋は、旅館の図面にはない。";
  return `現在地: ${meta.name}\n${custom}${extra}`;
}

function triggerEnding() {
  game.phase = "ending";
  const s = game.stats;
  const f = game.flags;

  if ((f.tookHelmet && f.tookFlags) || (s.正気度 <= 1 && f.followedGuide)) {
    renderEnding("導き手エンド", `あなたはいつのまにか青い制服を着ていた。\n白いヘルメットの内側には、あなたの名前。\n\n夜が来るたび、紅白の旗で次の従業員を案内する。\n\n“こちら、安全です”`);
    return;
  }

  if (f.destroyedBell && f.promisedMaid && s.仲居信頼 >= 2 && f.foundName) {
    renderEnding("夜明けの退館エンド", `鈴が壊れた瞬間、館に張りついていた音がすべて途切れた。\n裏庭には仲居が立っていて、小さくうなずく。\n\nあなたは山道を下り、夜明けの光の中へ出る。\n後日、宵鳴り旅館は休業になったと聞いた。\n\n霧生アキラの名も、あなたの名も、もう宿帳には残っていない。`);
    return;
  }

  if (f.savedGuest && f.openedDetached && s.好奇心 >= 4) {
    renderEnding("真相到達エンド", `0号室の宿帳から自分の名を削り取ると、背後で何人もの足音が遠ざかっていった。\n\n帳場の机の下には、これまで消えた住み込み従業員たちの名札。\nあなたはそれを持ち出し、館の仕組みを外へ持ち帰る。\n\nだが時々、信号待ちの向こうで白い旗が見える。`);
    return;
  }

  if (f.resigned && !f.destroyedBell) {
    renderEnding("逃走エンド", `あなたは裏庭から逃げ出した。\n命は助かった。だが翌朝、ポケットの中から小さな鈴が見つかった。\n\nそれ以来、深夜になると、誰もいない廊下から二度だけノックの音がする。`);
    return;
  }

  if (s.女将従順 >= 4 || (!f.destroyedBell && f.preparedRoom0)) {
    renderEnding("宵鳴りの従業員エンド", `女将は湯呑みを差し出し、静かに言った。\n『これで長く働けるわ』\n\n翌朝、あなたの名札は帳場の奥に掛けられていた。\n部屋割りは、0号室担当。`);
    return;
  }

  renderEnding("契約満了エンド", `一定の日数を働き終え、あなたは館を離れた。\n異変は確かにあった。だが真相に届く前に、あなたは見切りをつけた。\n\nただ、履歴書の職歴欄に“宵鳴り旅館”と書こうとすると、なぜか指が止まる。`);
}

function renderEnding(title, body) {
  game.mode = "story";
  game.phase = "ending";
  game.objective = "結末に到達しました";
  game.endingTitle = title;
  game.endingBody = body;
  renderEndingScreen();
  saveSilently();
}

function renderEndingScreen() {
  updateHUD();
  showControls(false);
  clearChoices();
  setText(`【${game.endingTitle}】\n\n${game.endingBody}`);
  addChoice("タイトルへ戻る", showTitle);
  addChoice("最初からやり直す", () => {
    resetGame();
    showOpening();
  }, { secondary: true });
  addChoice("この状態を保存", saveGame, { ghost: true });
  render();
}

function maybeAutoEnding() {
  if (game.day === 4 && game.flags.destroyedBell) {
    triggerEnding();
  }
}

function render() {
  updateHUD();
  drawScene();
}

function drawScene() {
  const room = game.phase === "night" ? currentRoom() : "E";
  const meta = roomMeta[room] || roomMeta.E;
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  const sanity = game.stats.正気度;
  const dark = 0.25 + (5 - sanity) * 0.05;

  // Ceiling
  const ceilingGrad = ctx.createLinearGradient(0, 0, 0, h * 0.45);
  ceilingGrad.addColorStop(0, shade(meta.ceiling, -10));
  ceilingGrad.addColorStop(1, shade(meta.ceiling, 10));
  ctx.fillStyle = ceilingGrad;
  ctx.fillRect(0, 0, w, h * 0.45);

  // Floor
  const floorGrad = ctx.createLinearGradient(0, h * 0.45, 0, h);
  floorGrad.addColorStop(0, shade(meta.floor, 18));
  floorGrad.addColorStop(1, shade(meta.floor, -18));
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, h * 0.45, w, h * 0.55);

  // Perspective walls
  drawPerspectiveRoom(room);

  // Vignette and noise
  ctx.fillStyle = `rgba(0,0,0,${dark})`;
  ctx.fillRect(0, 0, w, h);
  drawVignette(w, h);
  drawNoise(w, h, sanity);

  if (game.phase !== "night") {
    drawTitleSymbol();
  } else {
    drawGuideIfNeeded();
    drawRoomLabel(room);
  }
}

function drawPerspectiveRoom(room) {
  const w = canvas.width;
  const h = canvas.height;
  const centerX = w / 2;
  const horizon = h * 0.44;
  const nearTop = 42;
  const nearBottom = h - 36;
  const farLeft = 42;
  const farRight = w - 42;
  const nearLeft = 8;
  const nearRight = w - 8;
  const sideColor = "rgba(20,14,12,0.55)";
  const wallColor = "rgba(220,190,150,0.08)";
  const front = frontTile();
  const leftOpen = sideOpen(-1);
  const rightOpen = sideOpen(1);

  // Side walls
  ctx.fillStyle = sideColor;
  ctx.beginPath();
  ctx.moveTo(nearLeft, nearTop);
  ctx.lineTo(farLeft, horizon);
  ctx.lineTo(farLeft, h - 90);
  ctx.lineTo(nearLeft, nearBottom);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(nearRight, nearTop);
  ctx.lineTo(farRight, horizon);
  ctx.lineTo(farRight, h - 90);
  ctx.lineTo(nearRight, nearBottom);
  ctx.closePath();
  ctx.fill();

  // Front wall or opening
  if (front === "#") {
    ctx.fillStyle = wallColor;
    ctx.fillRect(farLeft, horizon, farRight - farLeft, h - 90 - horizon);
    drawShojiDoor(farLeft + 8, horizon + 8, farRight - farLeft - 16, h - 106 - horizon);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(farLeft, horizon, farRight - farLeft, h - 90 - horizon);
    drawDepthHall(farLeft + 12, horizon + 10, farRight - farLeft - 24, h - 110 - horizon, front);
  }

  // Left opening
  if (leftOpen) {
    ctx.fillStyle = "rgba(120,90,60,0.18)";
    ctx.beginPath();
    ctx.moveTo(nearLeft, nearTop + 28);
    ctx.lineTo(farLeft, horizon + 22);
    ctx.lineTo(farLeft, h - 112);
    ctx.lineTo(nearLeft, nearBottom - 40);
    ctx.closePath();
    ctx.fill();
  } else {
    drawShojiPanel(nearLeft + 2, nearTop + 16, 24, h - 78);
  }

  // Right opening
  if (rightOpen) {
    ctx.fillStyle = "rgba(120,90,60,0.18)";
    ctx.beginPath();
    ctx.moveTo(nearRight, nearTop + 28);
    ctx.lineTo(farRight, horizon + 22);
    ctx.lineTo(farRight, h - 112);
    ctx.lineTo(nearRight, nearBottom - 40);
    ctx.closePath();
    ctx.fill();
  } else {
    drawShojiPanel(w - 28, nearTop + 16, 24, h - 78);
  }

  // Floor lines
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  for (let i = 0; i < 5; i++) {
    const y = horizon + 20 + i * 30;
    ctx.beginPath();
    ctx.moveTo(farLeft - i * 6, y);
    ctx.lineTo(farRight + i * 6, y);
    ctx.stroke();
  }

  // Hanging light
  ctx.fillStyle = "rgba(255,244,220,0.8)";
  ctx.beginPath();
  ctx.ellipse(centerX, 34, 26, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,244,220,0.08)";
  ctx.beginPath();
  ctx.ellipse(centerX, 54, 62, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  // Special props by room
  if (room === "D") drawFrontDesk();
  if (room === "R") drawShrine();
  if (room === "S") drawShelves();
  if (room === "B") drawBathSteam();
  if (room === "Z") drawZeroRoomBook();
}

function frontTile() {
  const d = DIRS[game.dir];
  const x = game.pos.x + d.x;
  const y = game.pos.y + d.y;
  return isPassable(x, y) ? game.currentMap.grid[y][x] : "#";
}

function sideOpen(offset) {
  const d = DIRS[relativeDir(offset)];
  const x = game.pos.x + d.x;
  const y = game.pos.y + d.y;
  return isPassable(x, y);
}

function drawShojiDoor(x, y, w, h) {
  ctx.fillStyle = "rgba(230,220,205,0.12)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.strokeRect(x, y, w, h);
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x + (w / 4) * i, y);
    ctx.lineTo(x + (w / 4) * i, y + h);
    ctx.stroke();
  }
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(x, y + (h / 5) * i);
    ctx.lineTo(x + w, y + (h / 5) * i);
    ctx.stroke();
  }
}

function drawShojiPanel(x, y, w, h) {
  ctx.fillStyle = "rgba(230,220,205,0.06)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.strokeRect(x, y, w, h);
}

function drawDepthHall(x, y, w, h, frontRoom) {
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(x + w * 0.42, y + 14, w * 0.16, 12);
  if (frontRoom === "G" || frontRoom === "O") {
    ctx.fillStyle = "rgba(255,230,210,0.08)";
    ctx.fillRect(x + w * 0.32, y + 40, w * 0.36, h * 0.45);
  }
}

function drawFrontDesk() {
  ctx.fillStyle = "rgba(72,45,28,0.95)";
  ctx.fillRect(44, 204, 92, 28);
  ctx.fillStyle = "rgba(210,190,160,0.18)";
  ctx.fillRect(56, 198, 68, 8);
}

function drawShrine() {
  ctx.fillStyle = "rgba(86,56,22,0.9)";
  ctx.fillRect(60, 116, 60, 16);
  ctx.fillRect(66, 96, 48, 22);
  ctx.fillStyle = "rgba(255,215,120,0.5)";
  ctx.beginPath();
  ctx.arc(90, 136, 10, 0, Math.PI * 2);
  ctx.fill();
}

function drawShelves() {
  ctx.fillStyle = "rgba(66,55,49,0.9)";
  ctx.fillRect(34, 116, 18, 92);
  ctx.fillRect(128, 116, 18, 92);
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(34, 124 + i * 20, 18, 3);
    ctx.fillRect(128, 124 + i * 20, 18, 3);
  }
}

function drawBathSteam() {
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = `rgba(190,220,230,${0.06 + i * 0.02})`;
    ctx.beginPath();
    ctx.arc(50 + i * 18, 170 - (i % 2) * 12, 18, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawZeroRoomBook() {
  ctx.fillStyle = "rgba(70,25,25,0.85)";
  ctx.fillRect(66, 188, 48, 30);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.strokeRect(66, 188, 48, 30);
}

function drawGuideIfNeeded() {
  if (game.phase !== "night") return;
  const room = currentRoom();
  const shouldDraw =
    room === "A" ||
    (game.currentNight >= 2 && game.flags.metGuide && Math.random() < 0.22) ||
    (game.currentNight === 4 && (game.pos.x === 3 && game.pos.y === 1));
  if (!shouldDraw) return;

  const jitter = (game.stats.正気度 <= 2 ? (Math.random() * 4 - 2) : 0);
  const x = 90 + jitter;
  const y = 172 + jitter;

  // body
  ctx.fillStyle = "rgba(17,49,128,0.92)";
  ctx.fillRect(x - 16, y - 10, 32, 56);
  ctx.fillRect(x - 10, y + 46, 8, 28);
  ctx.fillRect(x + 2, y + 46, 8, 28);
  ctx.fillRect(x - 34, y + 2, 18, 8);
  ctx.fillRect(x + 16, y + 2, 18, 8);
  // arms
  ctx.fillRect(x - 44, y - 4, 28, 8);
  ctx.fillRect(x + 16, y - 4, 28, 8);
  // helmet
  ctx.fillStyle = "rgba(245,245,245,0.95)";
  ctx.beginPath();
  ctx.ellipse(x, y - 18, 18, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - 15, y - 18, 30, 7);
  // face
  ctx.fillStyle = "rgba(255,220,200,0.92)";
  ctx.fillRect(x - 10, y - 12, 20, 14);
  ctx.fillStyle = "#111";
  ctx.fillRect(x - 7, y - 8, 4, 2);
  ctx.fillRect(x + 3, y - 8, 4, 2);
  ctx.fillRect(x - 6, y - 2, 12, 2);
  // flags
  ctx.fillStyle = "rgba(230,230,230,0.96)";
  ctx.fillRect(x - 52, y - 10, 2, 26);
  ctx.beginPath();
  ctx.moveTo(x - 50, y - 10);
  ctx.lineTo(x - 24, y - 2);
  ctx.lineTo(x - 50, y + 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(200,28,28,0.96)";
  ctx.fillRect(x + 50, y - 10, 2, 26);
  ctx.beginPath();
  ctx.moveTo(x + 52, y - 10);
  ctx.lineTo(x + 78, y - 2);
  ctx.lineTo(x + 52, y + 6);
  ctx.closePath();
  ctx.fill();

  // armband
  ctx.fillStyle = "rgba(120,255,220,0.8)";
  ctx.fillRect(x + 12, y + 10, 12, 5);

  // glow
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 66, 88, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawRoomLabel(room) {
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(8, 282, 88, 16);
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = "8px sans-serif";
  ctx.fillText(roomMeta[room]?.name || "不明", 12, 293);
}

function drawTitleSymbol() {
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.beginPath();
  ctx.arc(90, 132, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(88, 88, 4, 90);
  ctx.fillRect(48, 130, 84, 4);
  ctx.fillStyle = "rgba(180,30,30,0.16)";
  ctx.beginPath();
  ctx.arc(90, 132, 12, 0, Math.PI * 2);
  ctx.fill();
}

function drawVignette(w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 30, w / 2, h / 2, 180);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.52)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawNoise(w, h, sanity) {
  const density = sanity <= 2 ? 180 : sanity <= 4 ? 90 : 45;
  for (let i = 0; i < density; i++) {
    const x = (Math.random() * w) | 0;
    const y = (Math.random() * h) | 0;
    const a = Math.random() * (sanity <= 2 ? 0.18 : 0.08);
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(x, y, 1, 1);
  }
  if (sanity <= 2) {
    ctx.fillStyle = "rgba(255,0,0,0.05)";
    ctx.fillRect(0, 0, w, h);
  }
}

function shade(color, amt) {
  let usePound = false;
  if (color[0] === "#") {
    color = color.slice(1);
    usePound = true;
  }
  let num = parseInt(color, 16);
  let r = (num >> 16) + amt;
  let b = ((num >> 8) & 0x00ff) + amt;
  let g = (num & 0x0000ff) + amt;
  r = Math.max(Math.min(255, r), 0);
  b = Math.max(Math.min(255, b), 0);
  g = Math.max(Math.min(255, g), 0);
  return (usePound ? "#" : "") + ((g | (b << 8) | (r << 16)).toString(16).padStart(6, "0"));
}

function saveSilently() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(game));
}

controls.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  if (game.phase !== "night") return;
  if (action === "turnLeft") {
    game.dir = (game.dir + 3) % 4;
    enterNightMode(false);
  }
  if (action === "turnRight") {
    game.dir = (game.dir + 1) % 4;
    enterNightMode(false);
  }
  if (action === "forward") move(0);
  if (action === "back") move(2);
  if (action === "inspect") inspectCurrent();
  if (action === "menu") saveGame();
});

showTitle();

