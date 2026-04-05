
(function () {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: false });
  const off = document.createElement('canvas');
  const OFF_W = 420;
  const OFF_H = 236;
  off.width = OFF_W;
  off.height = OFF_H;
  const g = off.getContext('2d', { alpha: false });
  g.imageSmoothingEnabled = false;

  const mapCanvas = document.getElementById('miniMap');
  const mapCtx = mapCanvas.getContext('2d', { alpha: false });
  const portraitCanvas = document.getElementById('portraitCanvas');
  const portraitCtx = portraitCanvas.getContext('2d', { alpha: true });
  portraitCtx.imageSmoothingEnabled = false;

  const hud = document.getElementById('hud');
  const dayLabel = document.getElementById('dayLabel');
  const phaseLabel = document.getElementById('phaseLabel');
  const areaLabel = document.getElementById('areaLabel');
  const objectiveBox = document.getElementById('objectiveBox');
  const promptBox = document.getElementById('promptBox');
  const statusBox = document.getElementById('statusBox');
  const dialogueBox = document.getElementById('dialogueBox');
  const dialogueText = document.getElementById('dialogueText');
  const speakerLabel = document.getElementById('speakerLabel');
  const menuBtn = document.getElementById('menuBtn');
  const menuPanel = document.getElementById('menuPanel');
  const saveBtn = document.getElementById('saveBtn');
  const loadBtn = document.getElementById('loadBtn');
  const hudToggleBtn = document.getElementById('hudToggleBtn');
  const endingScreen = document.getElementById('endingScreen');
  const endingTitle = document.getElementById('endingTitle');
  const endingText = document.getElementById('endingText');
  const actBtn = document.getElementById('actBtn');
  const movePad = document.getElementById('movePad');
  const moveKnob = document.getElementById('moveKnob');

  const STORAGE_KEY = 'yoinado_v16_overdrive_save';
  const FOV = Math.PI / 3.0;
  const MAX_DEPTH = 26;

  const state = {
    step: 0,
    day: 1,
    phase: 'day',
    objective: '女将に話しかける',
    inDialogue: false,
    dialogueQueue: [],
    dialogueOnEnd: null,
    nearby: null,
    ending: false,
    hudMinimal: false,
    pulse: 0,
    areaFlash: 0,
    menuOpen: false,
    chaseActive: false,
    chasedBefore: false,
    lastStatusTimer: 0,
    portraitKind: 'narrator',
  };

  const tasks = {
    talkedOkami: false,
    gotTray: false,
    servedGuest: false,
    talkedMaid: false,
    answeredPhone: false,
    checkedBath: false,
    heard202: false,
    gotMasterKey: false,
    gotNotebook: false,
    escapedGuide: false,
    talkedOkamiAgain: false,
    checkedClosedWing: false,
    readLedger: false,
    day2Started: false,
    talkedMaidDay2: false,
    heard203: false,
    checkedCourtyard: false,
    gotFilm: false,
    escapedGuide2: false,
    finalTalked: false,
  };

  const player = {
    x: 2.4,
    y: 8.6,
    a: -0.05,
    area: 'lobby',
    radius: 0.18,
    speed: 2.3,
  };

  const guide = {
    x: 10.0,
    y: 2.0,
    area: 'archive',
    active: false,
    speed: 1.18,
  };

  const keys = { w:false, a:false, s:false, d:false, shift:false };
  const moveInput = { active:false, x:0, y:0, pointerId:null };
  const lookInput = { active:false, lastX:0, pointerId:null, dx:0 };

  const areas = {
    lobby: {
      name: '帳場',
      skyTop: '#191a24', skyBottom: '#6c5034',
      floorA: '#6a573f', floorB: '#5a4934', ceilA: '#2a2430', ceilB: '#19151d',
      map: [
        '################',
        '#..KKK.WWWW....#',
        '#......W..W....#',
        '#......W..W....#',
        '#......WWWW....#',
        '#..............#',
        '#..CCCC........#',
        '#..............#',
        '#...........TT.#',
        '################'
      ],
      spawns: {
        start: { x: 2.4, y: 8.4, a: -0.02 },
        fromHall: { x: 12.7, y: 8.0, a: Math.PI },
        fromKitchen: { x: 2.8, y: 3.8, a: 1.2 },
      },
      signs: [
        { x: 2.5, y: 7.1, text: '帳場' },
        { x: 12.6, y: 8.7, text: '客室廊下' },
        { x: 2.8, y: 1.6, text: '厨房' },
      ]
    },
    hall: {
      name: '客室廊下',
      skyTop: '#111723', skyBottom: '#503928',
      floorA: '#655038', floorB: '#56442f', ceilA: '#21212a', ceilB: '#15131b',
      map: [
        '########################',
        '#......................#',
        '#......................#',
        '#...DD.....DD....DD.BB.#',
        '#......................#',
        '#......................#',
        '#......................#',
        '#..DD.SSSSSSSSSS..GG.C.#',
        '#......................#',
        '########################'
      ],
      spawns: {
        fromLobby: { x: 2.0, y: 7.8, a: 0 },
        fromRoom: { x: 5.8, y: 5.0, a: Math.PI },
        fromRoom202: { x: 11.6, y: 5.0, a: Math.PI },
        fromBath: { x: 18.0, y: 5.0, a: Math.PI },
        fromArchive: { x: 14.0, y: 2.0, a: Math.PI / 2 },
        fromRoom203: { x: 16.2, y: 5.0, a: Math.PI },
        fromStaff: { x: 3.2, y: 7.2, a: 0 },
        fromCourtyard: { x: 21.0, y: 7.2, a: Math.PI },
        fromClosedWing: { x: 18.4, y: 7.2, a: Math.PI },
      },
      signs: [
        { x: 4.2, y: 2.0, text: '201' },
        { x: 11.2, y: 2.0, text: '202' },
        { x: 16.2, y: 2.0, text: '203' },
        { x: 18.9, y: 2.0, text: '浴場前' },
        { x: 3.2, y: 7.7, text: '従業員室' },
        { x: 14.3, y: 7.7, text: '北棟・宿帳庫' },
        { x: 18.8, y: 7.7, text: '閉鎖棟' },
        { x: 21.2, y: 7.7, text: '中庭' },
      ]
    },
    room201: {
      name: '201号室',
      skyTop: '#19161d', skyBottom: '#6c4c34',
      floorA: '#7a6b4e', floorB: '#665a43', ceilA: '#251f25', ceilB: '#19161a',
      map: [
        '############',
        '#....SS....#',
        '#..........#',
        '#....TT....#',
        '#..........#',
        '#..........#',
        '#..........#',
        '############'
      ],
      spawns: { door: { x: 2.0, y: 5.0, a: 0 } },
      signs: [{ x: 5.9, y: 1.6, text: '201号室' }]
    },
    room202: {
      name: '202号室',
      skyTop: '#16171f', skyBottom: '#5a4b38',
      floorA: '#75694d', floorB: '#665842', ceilA: '#262128', ceilB: '#18161b',
      map: [
        '############',
        '#....SS....#',
        '#..........#',
        '#..TT......#',
        '#..........#',
        '#..........#',
        '#..........#',
        '############'
      ],
      spawns: { door: { x: 2.0, y: 5.0, a: 0 } },
      signs: [{ x: 5.9, y: 1.6, text: '202号室' }]
    },
    bath: {
      name: '浴場前',
      skyTop: '#0e1319', skyBottom: '#33444f',
      floorA: '#5f6665', floorB: '#4f5554', ceilA: '#1d2128', ceilB: '#12151b',
      map: [
        '##############',
        '#....MMMM....#',
        '#............#',
        '#............#',
        '#....TT......#',
        '#............#',
        '#............#',
        '##############'
      ],
      spawns: { door: { x: 2.0, y: 5.0, a: 0 } },
      signs: [{ x: 7.0, y: 1.8, text: '浴場前' }]
    },
    kitchen: {
      name: '厨房',
      skyTop: '#15161c', skyBottom: '#423221',
      floorA: '#66605a', floorB: '#4e4842', ceilA: '#201d21', ceilB: '#151218',
      map: [
        '##############',
        '#............#',
        '#....KKKK....#',
        '#............#',
        '#....TT......#',
        '#............#',
        '#............#',
        '##############'
      ],
      spawns: { door: { x: 10.8, y: 5.0, a: Math.PI } },
      signs: [{ x: 5.0, y: 1.7, text: '厨房' }]
    },
    archive: {
      name: '宿帳庫',
      skyTop: '#0a1016', skyBottom: '#23343b',
      floorA: '#48423b', floorB: '#3d3732', ceilA: '#171b21', ceilB: '#0f1217',
      map: [
        '################',
        '#....NNNNNN....#',
        '#..............#',
        '#..............#',
        '#...KK.........#',
        '#..............#',
        '#..............#',
        '#..........TT..#',
        '################'
      ],
      spawns: { entry: { x: 2.0, y: 7.0, a: 0 } },
      signs: [{ x: 8.0, y: 1.8, text: '宿帳庫' }]
    },
    closedWing: {
      name: '閉鎖棟',
      skyTop: '#101018', skyBottom: '#2f2530',
      floorA: '#55473c', floorB: '#46392f', ceilA: '#1b1820', ceilB: '#121015',
      map: [
        '##################',
        '#................#',
        '#..SSSSS.........#',
        '#................#',
        '#.............TT.#',
        '#................#',
        '#....AAAA........#',
        '#................#',
        '#................#',
        '##################'
      ],
      spawns: { entry: { x: 2.0, y: 8.0, a: 0 } },
      signs: [{ x: 13.8, y: 3.7, text: '祭壇前' }, { x: 6.0, y: 1.8, text: '閉鎖棟' }]
    }
,
room203: {
  name: '203号室',
  skyTop: '#17161d', skyBottom: '#5c4635',
  floorA: '#786b52', floorB: '#655841', ceilA: '#262127', ceilB: '#18161b',
  map: [
    '############',
    '#....SS....#',
    '#..........#',
    '#..TT......#',
    '#..........#',
    '#..........#',
    '#..........#',
    '############'
  ],
  spawns: { door: { x: 2.0, y: 5.0, a: 0 } },
  signs: [{ x: 5.9, y: 1.6, text: '203号室' }]
},
staff: {
  name: '従業員室',
  skyTop: '#141820', skyBottom: '#4a3728',
  floorA: '#5e5448', floorB: '#4b4339', ceilA: '#1f2328', ceilB: '#14171b',
  map: [
    '##############',
    '#....NNNN....#',
    '#............#',
    '#....KKKK....#',
    '#............#',
    '#....TT......#',
    '#............#',
    '##############'
  ],
  spawns: { door: { x: 11.0, y: 5.0, a: Math.PI } },
  signs: [{ x: 6.4, y: 1.7, text: '従業員室' }]
},
courtyard: {
  name: '中庭',
  skyTop: '#081019', skyBottom: '#1e2c34',
  floorA: '#374136', floorB: '#2a3229', ceilA: '#11161a', ceilB: '#0a0d10',
  map: [
    '##################',
    '#................#',
    '#....TT....TT....#',
    '#................#',
    '#................#',
    '#....SS....SS....#',
    '#................#',
    '#.............A..#',
    '#................#',
    '##################'
  ],
  spawns: { door: { x: 2.0, y: 8.0, a: 0 } },
  signs: [{ x: 8.8, y: 1.8, text: '中庭' }, { x: 14.7, y: 7.6, text: '離れ通路' }]
},
annex: {
  name: '離れ通路',
  skyTop: '#090d12', skyBottom: '#1f2b35',
  floorA: '#4a433c', floorB: '#3a342f', ceilA: '#171b20', ceilB: '#0e1216',
  map: [
    '####################',
    '#..................#',
    '#....NNNN..........#',
    '#..................#',
    '#.........TT.......#',
    '#..................#',
    '#...............A..#',
    '#..................#',
    '#..................#',
    '####################'
  ],
  spawns: { entry: { x: 2.0, y: 8.0, a: 0 } },
  signs: [{ x: 8.5, y: 1.8, text: '離れ通路' }, { x: 16.0, y: 6.6, text: '記録保管棚' }]
}

  };

  const textures = createTextures();
  const spriteCanvases = {
    okami: makeCharacterSprite('okami', false),
    guest: makeCharacterSprite('guest', false),
    maid: makeCharacterSprite('maid', false),
    guest202: makeCharacterSprite('guest202', false),
    guest203: makeCharacterSprite('guest203', false),
    guide: makeCharacterSprite('guide', false),
    narrator: makePortrait('narrator'),
    okamiPortrait: makePortrait('okami'),
    guestPortrait: makePortrait('guest'),
    maidPortrait: makePortrait('maid'),
    guest202Portrait: makePortrait('guest202'),
    guest203Portrait: makePortrait('guest203'),
    guidePortrait: makePortrait('guide'),
    tray: makeItemSprite('tray'),
    phone: makeItemSprite('phone'),
    notebook: makeItemSprite('notebook'),
    bathSign: makeItemSprite('bathSign'),
    key: makeItemSprite('key'),
    ledger: makeItemSprite('ledger'),
    lantern: makeItemSprite('lantern'),
    film: makeItemSprite('film'),
    shrine: makeItemSprite('shrine'),
    archiveDoor: makeItemSprite('archiveDoor'),
    closedDoor: makeItemSprite('closedDoor'),
    door: makeItemSprite('door'),
    signHall: makeItemSprite('bathSign'),
  };

  const speakerPortraitMap = {
    '記録': 'narrator',
    '女将': 'okamiPortrait',
    '201号室の客': 'guestPortrait',
    '仲居・篠': 'maidPortrait',
    '202号室の客': 'guest202Portrait',
    '203号室の客': 'guest203Portrait',
    '誘導員': 'guidePortrait',
    '受話器の向こう': 'guidePortrait',
  };

  function currentArea() { return areas[player.area]; }
  function currentMap() { return currentArea().map; }

  function setStatus(text, seconds=2.6) {
    statusBox.textContent = text;
    state.lastStatusTimer = seconds;
  }
  function setObjective(text) {
    state.objective = text;
    objectiveBox.textContent = text;
  }

  function tileAt(x, y) {
    const mx = Math.floor(x), my = Math.floor(y);
    const map = currentMap();
    if (mx < 0 || my < 0 || my >= map.length || mx >= map[0].length) return '#';
    return map[my][mx];
  }
  function isSolid(x, y) { return tileAt(x, y) !== '.'; }

  function spawnAt(areaId, spawnKey) {
    const sp = areas[areaId].spawns[spawnKey] || Object.values(areas[areaId].spawns)[0];
    player.area = areaId;
    player.x = sp.x;
    player.y = sp.y;
    player.a = sp.a;
    areaLabel.textContent = areas[areaId].name;
    state.areaFlash = 1;
    if (state.chaseActive) syncGuideSpawnForArea(areaId);
  }

  function changeArea(areaId, spawnKey) {
    spawnAt(areaId, spawnKey);
    setStatus('エリア移動: ' + areas[areaId].name, 1.6);
    if (state.chaseActive && areaId === 'lobby' && !tasks.escapedGuide) {
      state.chaseActive = false;
      guide.active = false;
      tasks.escapedGuide = true;
      state.step = 9;
      setObjective('女将に追跡のことを伝える');
      showDialogue([
        ['記録', '帳場まで戻った瞬間、廊下の向こうにいた誘導員の気配が途切れた。'],
        ['記録', '女将だけが、逃げ帰ってくることを最初から知っていたように立っている。']
      ]);
    }
    if (state.chaseActive && areaId === 'lobby' && tasks.gotFilm && !tasks.escapedGuide2) {
      state.chaseActive = false;
      guide.active = false;
      tasks.escapedGuide2 = true;
      state.step = 16;
      setObjective('女将にフィルムのことを話す');
      showDialogue([
        ['記録', '二度目の追跡は、一度目より近かった。帳場へ滑り込んだ瞬間、ようやく息が戻る。'],
        ['記録', '女将は逃げてくることを見越していたように、帳場の灯りだけを明るくして立っていた。']
      ]);
    }
  }

  function startNew() {
    for (const key of Object.keys(tasks)) tasks[key] = false;
    state.step = 0;
    state.day = 1;
    state.phase = 'day';
    state.inDialogue = false;
    state.ending = false;
    state.dialogueQueue = [];
    state.chaseActive = false;
    state.chasedBefore = false;
    state.menuOpen = false;
    dayLabel.textContent = 'DAY 1';
    phaseLabel.textContent = '昼勤務';
    endingScreen.classList.add('hidden');
    dialogueBox.classList.add('hidden');
    promptBox.classList.add('hidden');
    spawnAt('lobby', 'start');
    guide.active = false;
    setObjective('女将に話しかける');
    setStatus('起動完了 / v16 Overdrive Web', 3.0);
    showDialogue([
      ['記録', '住み込み初日。館内は静かすぎるほど静かだ。'],
      ['記録', '今夜は客の話を拾うほど、深夜に調べられる範囲が増えていく。'],
      ['記録', '二日目には従業員室、203号室、中庭、離れ通路まで順番が伸びる。'],
      ['記録', 'ただし、宿帳庫のノートや離れのフィルムを手にした瞬間だけは、走る準備をしておいた方がいい。']
    ]);
  }

  function getSaveData() {
    return {
      player: { x: player.x, y: player.y, a: player.a, area: player.area },
      tasks: { ...tasks },
      guide: { ...guide },
      state: {
        step: state.step,
        day: state.day,
        phase: state.phase,
        objective: state.objective,
        hudMinimal: state.hudMinimal,
        chaseActive: state.chaseActive,
      }
    };
  }

  function saveGame() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getSaveData()));
    setStatus('保存した / v16', 1.8);
  }

  function loadGame() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { setStatus('保存データなし', 1.8); return false; }
    try {
      const data = JSON.parse(raw);
      Object.assign(tasks, data.tasks || {});
      Object.assign(player, data.player || {});
      Object.assign(guide, data.guide || {});
      state.step = data.state?.step || 0;
      state.day = data.state?.day || 1;
      state.phase = data.state?.phase || 'day';
      state.hudMinimal = !!data.state?.hudMinimal;
      state.chaseActive = !!data.state?.chaseActive;
      dayLabel.textContent = 'DAY ' + state.day;
      phaseLabel.textContent = state.phase === 'night' ? '深夜調査' : '昼勤務';
      areaLabel.textContent = areas[player.area].name;
      setObjective(data.state?.objective || '続きから再開');
      applyHudState();
      endingScreen.classList.add('hidden');
      dialogueBox.classList.add('hidden');
      promptBox.classList.add('hidden');
      state.ending = false;
      state.inDialogue = false;
      setStatus('ロードした / v16', 1.8);
      return true;
    } catch (err) {
      setStatus('ロード失敗', 1.8);
      return false;
    }
  }

  function applyHudState() {
    hud.classList.toggle('hud-minimal', state.hudMinimal);
    hudToggleBtn.textContent = state.hudMinimal ? 'HUD ON' : 'HUD OFF';
  }

  function toggleMenu(force) {
    state.menuOpen = typeof force === 'boolean' ? force : !state.menuOpen;
    menuPanel.classList.toggle('hidden', !state.menuOpen);
  }

  function updatePortrait(kind) {
    portraitCtx.clearRect(0, 0, portraitCanvas.width, portraitCanvas.height);
    const sprite = spriteCanvases[kind] || spriteCanvases.narrator;
    portraitCtx.drawImage(sprite, 0, 0, portraitCanvas.width, portraitCanvas.height);
  }

  function showDialogue(lines, onEnd) {
    state.inDialogue = true;
    state.dialogueQueue = lines.slice();
    state.dialogueOnEnd = onEnd || null;
    dialogueBox.classList.remove('hidden');
    promptBox.classList.add('hidden');
    toggleMenu(false);
    advanceDialogue();
  }

  function advanceDialogue() {
    if (!state.inDialogue) return;
    if (!state.dialogueQueue.length) {
      state.inDialogue = false;
      dialogueBox.classList.add('hidden');
      const fn = state.dialogueOnEnd;
      state.dialogueOnEnd = null;
      if (typeof fn === 'function') fn();
      return;
    }
    const [speaker, text] = state.dialogueQueue.shift();
    speakerLabel.textContent = speaker;
    dialogueText.textContent = text;
    updatePortrait(speakerPortraitMap[speaker] || 'narrator');
  }

  function endGame(title, text) {
    state.ending = true;
    state.chaseActive = false;
    guide.active = false;
    endingTitle.textContent = title;
    endingText.textContent = text;
    endingScreen.classList.remove('hidden');
    promptBox.classList.add('hidden');
  }

  function scriptedStepAction(actionId) {
    switch (actionId) {
      case 'okami':
        showDialogue([
          ['女将', '今日から帳場と二階の手伝いに入ってもらいます。まずは201号室へお茶を。'],
          ['女将', '二階の客は、仕事のついでに余計なことまで喋ります。聞いた内容まで持ってきてください。'],
          ['記録', '帳場の横に置かれた配膳盆を持っていく。']
        ], () => {
          tasks.talkedOkami = true;
          state.step = 1;
          setObjective('帳場の配膳盆を取る');
          setStatus('仕事開始: 配膳盆を持つ');
        });
        break;
      case 'tray':
        showDialogue([
          ['記録', '湯呑みが二つ。依頼は一人客のはずなのに、盆はやけに重い。']
        ], () => {
          tasks.gotTray = true;
          state.step = 2;
          setObjective('201号室の客にお茶を届ける');
          setStatus('配膳盆を持った');
        });
        break;
      case 'guest':
        showDialogue([
          ['201号室の客', '……遅かったな。昨日も、同じ時間に湯呑みが二つ来た。'],
          ['201号室の客', '昨夜、浴場前で濡れた足音を聞いた。子どもの足音みたいに軽かった。'],
          ['201号室の客', 'もし本気で調べる気なら、廊下の仲居と202の客にも当たれ。二人とも、何かを見て黙ってる。']
        ], () => {
          tasks.servedGuest = true;
          state.step = 3;
          setObjective('廊下の仲居に客の話を伝える');
          setStatus('客の証言を聞いた');
        });
        break;
      case 'maid':
        showDialogue([
          ['仲居・篠', '202の方、さっきから部屋の外を何度も確認しているんです。'],
          ['仲居・篠', 'でも、その前に帳場へ戻ってください。黒電話がずっと鳴っていて……女将があなたを呼んでいます。'],
          ['仲居・篠', '深夜に動くなら、聞いた話を順番に繋げてください。順番を間違えると、帰れなくなるから。']
        ], () => {
          tasks.talkedMaid = true;
          state.step = 4;
          setObjective('帳場の黒電話に出る');
          setStatus('帳場へ戻る');
        });
        break;
      case 'phone':
        showDialogue([
          ['受話器の向こう', '……二つ、足りない。'],
          ['受話器の向こう', '浴場の鏡を見ろ。次に二〇二だ。そのあとで鍵を取れ。'],
          ['女将', '今の、聞きましたか。夜の見回りに入ってください。順番だけは、守るように。']
        ], () => {
          tasks.answeredPhone = true;
          state.step = 5;
          state.phase = 'night';
          phaseLabel.textContent = '深夜調査';
          setObjective('浴場前の鏡を調べる');
          setStatus('深夜調査に切り替わった');
        });
        break;
      case 'mirror':
        showDialogue([
          ['記録', '鏡の曇りを拭うと、背後に子どもの影が一瞬だけ立っていた。'],
          ['記録', '次の瞬間、鏡には「二〇二へ」と指でなぞった跡が残る。']
        ], () => {
          tasks.checkedBath = true;
          state.step = 6;
          setObjective('202号室の客から話を聞く');
          setStatus('202号室へ向かう');
        });
        break;
      case 'guest202':
        showDialogue([
          ['202号室の客', '白いヘルメットの男を見た。館内図も持たず、ただ廊下の角に立ってた。'],
          ['202号室の客', '俺が目を離した瞬間、浴場前から宿帳庫の方へ滑るみたいに消えた。'],
          ['202号室の客', '古い北棟を開けるなら、厨房の壁棚に予備鍵がある。従業員しか知らない。']
        ], () => {
          tasks.heard202 = true;
          state.step = 7;
          setObjective('厨房で予備鍵を取る');
          setStatus('厨房で鍵を探す');
        });
        break;
      case 'key':
        showDialogue([
          ['記録', '壁棚の奥から、錆びた予備鍵と赤いタグが出てきた。'],
          ['記録', 'タグには「北棟・宿帳庫」とだけ書かれている。']
        ], () => {
          tasks.gotMasterKey = true;
          state.step = 8;
          setObjective('北の宿帳庫で青いノートを探す');
          setStatus('宿帳庫へ');
        });
        break;
      case 'notebook':
        showDialogue([
          ['記録', '青いノートの最後の行には、宿泊者名簿から消えた名前が並んでいる。'],
          ['記録', 'その一番下に、今夜の自分の名前があった。'],
          ['誘導員', '順番を、外れたな。']
        ], () => {
          tasks.gotNotebook = true;
          state.step = 9;
          state.chaseActive = true;
          state.chasedBefore = true;
          syncGuideSpawnForArea(player.area);
          setObjective('誘導員から逃げて帳場へ戻る');
          setStatus('追跡開始: 帳場まで逃げろ', 3.0);
        });
        break;
      case 'okami2':
        showDialogue([
          ['女将', '逃げ切れたんですね。なら、次は閉鎖棟です。'],
          ['女将', '宿帳庫のノートだけでは足りません。あそこに残った台帳が、失踪の順番を決めている。'],
          ['女将', '誘導員が現れたなら、もう隠し通せません。閉鎖棟の祭壇前にある台帳を見てください。']
        ], () => {
          tasks.talkedOkamiAgain = true;
          state.step = 10;
          setObjective('閉鎖棟の祭壇前で古い台帳を調べる');
          setStatus('閉鎖棟が開いた');
        });
        break;
      case 'ledger':
        showDialogue([
          ['記録', '台帳には、失踪した宿泊客が「誘導完了」とだけ記されていた。'],
          ['記録', '最後の空欄には、女将の筆跡で「次: 誘導員を見た者」とある。'],
          ['記録', 'つまり今夜の順番は、自分だけではなかった。宿の全員が、もう選ばれている。'],
          ['記録', 'だが夜が明けても、終わりにはならなかった。台帳の裏表紙に「二日目は中庭から」と走り書きされている。']
        ], () => {
          tasks.readLedger = true;
          tasks.day2Started = true;
          state.step = 12;
          state.day = 2;
          state.phase = 'day';
          dayLabel.textContent = 'DAY 2';
          phaseLabel.textContent = '昼勤務';
          spawnAt('lobby', 'start');
          setObjective('従業員室で仲居・篠を探す');
          setStatus('二日目が始まった', 2.4);
          showDialogue([
            ['記録', '短い仮眠のあと、また同じ木の匂いで目が覚めた。'],
            ['記録', '帳場の奥には、昨夜見たはずのない新しい宿帳が一冊増えている。'],
            ['女将', '続きが見たいなら、篠を探しなさい。あの子だけが、中庭の順番を知っています。']
          ]);
        });
        break;
      case 'maid2':
        showDialogue([
          ['仲居・篠', '昨夜のこと、誰にも話していません。でも二日目になると、中庭の提灯に火が入るんです。'],
          ['仲居・篠', '203号室の客は、その火を見た人だけが離れへ行けるって言っていました。'],
          ['仲居・篠', 'もし行くなら、もう一度追われるかもしれません。今度はもっと近いです。']
        ], () => {
          tasks.talkedMaidDay2 = true;
          state.step = 13;
          setObjective('203号室の客から話を聞く');
          setStatus('203号室へ');
        });
        break;
      case 'guest203':
        showDialogue([
          ['203号室の客', '昨夜、赤い子どもが提灯の下に立っていた。顔だけが妙に近かった。'],
          ['203号室の客', 'そのあと離れ通路から、映写機みたいな回る音がした。写真みたいなものを保管してるらしい。'],
          ['203号室の客', '提灯の下に落ちてる黒い札を拾えば、離れの鍵になる。行くなら今のうちだ。']
        ], () => {
          tasks.heard203 = true;
          state.step = 14;
          setObjective('中庭の提灯を調べる');
          setStatus('中庭へ向かう');
        });
        break;
      case 'lantern':
        showDialogue([
          ['記録', '提灯の足元に、焼けた黒い札と細い金具が落ちている。'],
          ['記録', '拾い上げると、離れ通路の戸が少しだけ開く音がした。'],
          ['記録', '提灯の明かりに照らされて、濡れた足跡が離れの方へ伸びている。']
        ], () => {
          tasks.checkedCourtyard = true;
          state.step = 15;
          setObjective('離れ通路で黒いフィルムを探す');
          setStatus('離れ通路が開いた');
        });
        break;
      case 'film':
        showDialogue([
          ['記録', '保管棚には、宿泊客の顔が焼き付いた黒いフィルムが巻かれていた。'],
          ['記録', '最後の一枚に映っているのは、白ヘルメットの誘導員の背後に並ばされた従業員たち。'],
          ['誘導員', '二日目の順番も、見たな。']
        ], () => {
          tasks.gotFilm = true;
          state.step = 16;
          state.phase = 'night';
          phaseLabel.textContent = '深夜調査';
          state.chaseActive = true;
          syncGuideSpawnForArea(player.area);
          setObjective('誘導員から逃げて帳場へ戻る');
          setStatus('第二追跡開始: 帳場へ逃げろ', 3.0);
        });
        break;
      case 'okami3':
        showDialogue([
          ['女将', 'フィルムまで見てしまったのですね。なら、もう宿の外側の話はできません。'],
          ['女将', 'この旅館は、消えた客を隠しているんじゃない。順番を守り続けないと、館内そのものが夜に飲まれるんです。'],
          ['女将', 'あなたが記録を持ち出すなら、私は残る。宿泊客を連れて逃げるなら、もう一度閉鎖棟へ戻りなさい。'],
          ['記録', '夜はまだ終わっていない。だが少なくとも、この宿が何を守っていたのかだけは見えた。']
        ], () => {
          tasks.finalTalked = true;
          state.step = 17;
          saveGame();
          endGame('二日目の記録', 'DAY2まで到達。従業員室、203号室、中庭、離れ通路、第二追跡まで実装した長編拡張版です。次は救出ルート、女将側ルート、宿からの脱出ルートの分岐に伸ばせます。');
        });
        break;
      case 'toHall': changeArea('hall', 'fromLobby'); break;
      case 'toLobby': changeArea('lobby', 'fromHall'); break;
      case 'toKitchen': changeArea('kitchen', 'door'); break;
      case 'kitchenExit': changeArea('lobby', 'fromKitchen'); break;
      case 'toRoom201': changeArea('room201', 'door'); break;
      case 'room201Exit': changeArea('hall', 'fromRoom'); break;
      case 'toRoom202': changeArea('room202', 'door'); break;
      case 'room202Exit': changeArea('hall', 'fromRoom202'); break;
      case 'toRoom203': changeArea('room203', 'door'); break;
      case 'room203Exit': changeArea('hall', 'fromRoom203'); break;
      case 'toBath': changeArea('bath', 'door'); break;
      case 'bathExit': changeArea('hall', 'fromBath'); break;
      case 'toArchive': if (tasks.gotMasterKey) changeArea('archive', 'entry'); break;
      case 'archiveExit': changeArea('hall', 'fromArchive'); break;
      case 'toCourtyard': if (tasks.heard203 || tasks.checkedCourtyard || tasks.gotFilm) changeArea('courtyard', 'door'); break;
      case 'courtyardExit': changeArea('hall', 'fromCourtyard'); break;
      case 'toAnnex': if (tasks.checkedCourtyard) changeArea('annex', 'entry'); break;
      case 'annexExit': changeArea('courtyard', 'door'); break;
      case 'toClosedWing': if (tasks.talkedOkamiAgain) changeArea('closedWing', 'entry'); break;
      case 'closedWingExit': changeArea('hall', 'fromClosedWing'); break;
      case 'shrine':
        showDialogue([
          ['記録', '祭壇には使い古された誘導旗と、白いヘルメットの写真が置かれている。'],
          ['記録', '誘導員は怪異ではなく、この宿で順番を運ぶ役目そのものだった。'],
          ['記録', '台帳はすぐ近くにある。今のうちに読めば、夜の仕組みが分かる。']
        ], () => {
          tasks.checkedClosedWing = true;
          setObjective('祭壇前の古い台帳を読む');
          setStatus('台帳を読める');
        });
        break;
    }
  }

  function areaMapLayout() {
    return {
      lobby: { x: 10, y: 20, w: 46, h: 42, label: '帳場' },
      hall: { x: 64, y: 20, w: 64, h: 42, label: '廊下' },
      room201: { x: 136, y: 6, w: 48, h: 22, label: '201' },
      room202: { x: 136, y: 30, w: 48, h: 22, label: '202' },
      bath: { x: 192, y: 8, w: 52, h: 22, label: '浴場' },
      kitchen: { x: 10, y: 68, w: 46, h: 20, label: '厨房' },
      archive: { x: 86, y: 68, w: 58, h: 20, label: '宿帳庫' },
      closedWing: { x: 156, y: 68, w: 74, h: 20, label: '閉鎖棟' },
      staff: { x: 10, y: 92, w: 46, h: 20, label: '従業員室' },
      room203: { x: 136, y: 54, w: 48, h: 22, label: '203' },
      courtyard: { x: 238, y: 68, w: 62, h: 20, label: '中庭' },
      annex: { x: 238, y: 38, w: 62, h: 20, label: '離れ' },
    };
  }

  function miniMapObjectiveArea() {
    if (state.step <= 1) return 'lobby';
    if (state.step === 2) return 'room201';
    if (state.step === 3) return 'hall';
    if (state.step === 4) return 'lobby';
    if (state.step === 5) return 'bath';
    if (state.step === 6) return 'room202';
    if (state.step === 7) return 'kitchen';
    if (state.step === 8) return 'archive';
    if (state.step === 9) return tasks.escapedGuide ? 'lobby' : 'hall';
    if (state.step === 10) return 'closedWing';
    if (state.step === 12) return 'staff';
    if (state.step === 13) return 'room203';
    if (state.step === 14) return 'courtyard';
    if (state.step === 15) return 'annex';
    if (state.step === 16) return 'lobby';
    return player.area;
  }

  function drawMiniMap() {
    const layout = areaMapLayout();
    mapCtx.fillStyle = '#0d1016';
    mapCtx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
    mapCtx.strokeStyle = 'rgba(255,255,255,.10)';
    mapCtx.lineWidth = 2;
    mapCtx.beginPath();
    mapCtx.moveTo(56, 41); mapCtx.lineTo(64, 41); mapCtx.lineTo(128, 41);
    mapCtx.moveTo(33, 62); mapCtx.lineTo(33, 68);
    mapCtx.moveTo(96, 62); mapCtx.lineTo(96, 68); mapCtx.lineTo(144, 68);
    mapCtx.stroke();

    const target = miniMapObjectiveArea();
    for (const [key, box] of Object.entries(layout)) {
      const active = key === player.area;
      const objective = key === target;
      mapCtx.fillStyle = active ? '#cfaa74' : objective ? '#6a8cc5' : '#1d2430';
      mapCtx.fillRect(box.x, box.y, box.w, box.h);
      mapCtx.strokeStyle = objective ? '#b4d1ff' : 'rgba(255,255,255,.18)';
      mapCtx.strokeRect(box.x + .5, box.y + .5, box.w - 1, box.h - 1);
      mapCtx.fillStyle = active ? '#18130f' : '#f5efe5';
      mapCtx.font = '10px sans-serif';
      mapCtx.textAlign = 'center';
      mapCtx.fillText(box.label, box.x + box.w / 2, box.y + box.h / 2 + 3);
    }
    if (state.chaseActive) {
      const box = layout[player.area];
      if (box) {
        mapCtx.fillStyle = 'rgba(215,100,100,.9)';
        mapCtx.beginPath();
        mapCtx.arc(box.x + box.w - 8, box.y + 8, 4, 0, Math.PI * 2);
        mapCtx.fill();
      }
    }
  }

  function syncGuideSpawnForArea(areaId) {
    if (!state.chaseActive) { guide.active = false; return; }
    guide.area = areaId;
    if (areaId === 'archive') {
      guide.x = 13.2; guide.y = 2.1;
      guide.active = true;
    } else if (areaId === 'hall') {
      guide.x = 20.0; guide.y = 2.0;
      guide.active = true;
    } else if (areaId === 'closedWing') {
      guide.x = 14.5; guide.y = 2.0;
      guide.active = true;
    } else if (areaId === 'annex') {
      guide.x = 16.8; guide.y = 2.4;
      guide.active = true;
    } else if (areaId === 'courtyard') {
      guide.x = 14.5; guide.y = 2.2;
      guide.active = true;
    } else {
      guide.active = false;
    }
  }

  function activeSprites() {
    const list = [];
    const push = (entry) => { if (entry.area === player.area) list.push(entry); };

    push({ type:'npc', id:'okami', area:'lobby', x:5.7, y:6.2, kind:'okami', prompt:'女将に話しかける', active: !tasks.talkedOkami });
    push({ type:'npc', id:'okami2', area:'lobby', x:5.7, y:6.2, kind:'okami', prompt:'女将に話しかける', active: tasks.escapedGuide && !tasks.talkedOkamiAgain });
    push({ type:'item', id:'tray', area:'lobby', x:12.8, y:8.2, kind:'tray', prompt:'配膳盆を取る', active: tasks.talkedOkami && !tasks.gotTray });
    push({ type:'portal', id:'toHall', area:'lobby', x:13.6, y:8.0, kind:'signHall', prompt:'客室廊下へ', active: true });
    push({ type:'portal', id:'toKitchen', area:'lobby', x:2.6, y:1.9, kind:'door', prompt:'厨房へ入る', active: true });
    push({ type:'item', id:'phone', area:'lobby', x:4.3, y:6.4, kind:'phone', prompt:'黒電話に出る', active: tasks.talkedMaid && !tasks.answeredPhone });

    push({ type:'portal', id:'toLobby', area:'hall', x:1.8, y:7.8, kind:'signHall', prompt:'帳場へ戻る', active: true });
    push({ type:'portal', id:'toRoom201', area:'hall', x:5.0, y:3.6, kind:'door', prompt:'201号室へ入る', active: true });
    push({ type:'portal', id:'toRoom202', area:'hall', x:11.0, y:3.6, kind:'door', prompt:'202号室へ入る', active: true });
    push({ type:'portal', id:'toBath', area:'hall', x:18.8, y:3.6, kind:'bathSign', prompt:'浴場前へ行く', active: true });
    push({ type:'portal', id:'toRoom203', area:'hall', x:16.1, y:3.6, kind:'door', prompt:'203号室へ入る', active: tasks.talkedMaidDay2 || tasks.heard203 || tasks.checkedCourtyard || tasks.gotFilm || tasks.escapedGuide2 });
    push({ type:'portal', id:'toStaff', area:'hall', x:3.2, y:7.3, kind:'door', prompt:'従業員室へ入る', active: tasks.day2Started });
    push({ type:'portal', id:'toArchive', area:'hall', x:14.0, y:7.3, kind:'archiveDoor', prompt:'北の宿帳庫へ', active: tasks.gotMasterKey });
    push({ type:'portal', id:'toClosedWing', area:'hall', x:19.0, y:7.3, kind:'closedDoor', prompt:'閉鎖棟へ入る', active: tasks.talkedOkamiAgain });
    push({ type:'portal', id:'toCourtyard', area:'hall', x:21.2, y:7.3, kind:'lantern', prompt:'中庭へ出る', active: tasks.heard203 || tasks.checkedCourtyard || tasks.gotFilm });
    push({ type:'npc', id:'maid', area:'hall', x:9.8, y:5.4, kind:'maid', prompt:'仲居・篠に話しかける', active: tasks.servedGuest && !tasks.talkedMaid });
    push({ type:'npc', id:'guide', area:'hall', x:guide.x, y:guide.y, kind:'guide', prompt:'', active: state.chaseActive && guide.active && guide.area === 'hall' });

    push({ type:'portal', id:'room201Exit', area:'room201', x:1.6, y:5.0, kind:'door', prompt:'廊下へ戻る', active: true });
    push({ type:'npc', id:'guest', area:'room201', x:7.4, y:3.1, kind:'guest', prompt:'201号室の客に話しかける', active: tasks.gotTray && !tasks.servedGuest });

    push({ type:'portal', id:'room202Exit', area:'room202', x:1.6, y:5.0, kind:'door', prompt:'廊下へ戻る', active: true });
    push({ type:'npc', id:'guest202', area:'room202', x:6.6, y:3.2, kind:'guest202', prompt:'202号室の客に話しかける', active: tasks.checkedBath && !tasks.heard202 });

    push({ type:'portal', id:'room203Exit', area:'room203', x:1.6, y:5.0, kind:'door', prompt:'廊下へ戻る', active: true });
    push({ type:'npc', id:'guest203', area:'room203', x:7.0, y:3.2, kind:'guest203', prompt:'203号室の客に話しかける', active: tasks.talkedMaidDay2 && !tasks.heard203 });

    push({ type:'portal', id:'bathExit', area:'bath', x:1.6, y:5.0, kind:'bathSign', prompt:'廊下へ戻る', active: true });
    push({ type:'item', id:'mirror', area:'bath', x:6.6, y:1.9, kind:'guide', prompt:'鏡を調べる', active: tasks.answeredPhone && !tasks.checkedBath });

    push({ type:'portal', id:'kitchenExit', area:'kitchen', x:10.8, y:5.0, kind:'door', prompt:'帳場へ戻る', active: true });
    push({ type:'item', id:'key', area:'kitchen', x:5.2, y:4.2, kind:'key', prompt:'予備鍵を取る', active: tasks.heard202 && !tasks.gotMasterKey });

    push({ type:'portal', id:'staffExit', area:'staff', x:10.8, y:5.0, kind:'door', prompt:'廊下へ戻る', active: true });
    push({ type:'npc', id:'maid2', area:'staff', x:5.6, y:4.0, kind:'maid', prompt:'仲居・篠に話しかける', active: tasks.day2Started && !tasks.talkedMaidDay2 });

    push({ type:'portal', id:'archiveExit', area:'archive', x:12.8, y:7.1, kind:'archiveDoor', prompt:'廊下へ戻る', active: true });
    push({ type:'item', id:'notebook', area:'archive', x:4.6, y:4.2, kind:'notebook', prompt:'青いノートを拾う', active: tasks.gotMasterKey && !tasks.gotNotebook });
    push({ type:'npc', id:'guide', area:'archive', x:guide.x, y:guide.y, kind:'guide', prompt:'', active: state.chaseActive && guide.active && guide.area === 'archive' });

    push({ type:'portal', id:'courtyardExit', area:'courtyard', x:1.8, y:8.0, kind:'door', prompt:'廊下へ戻る', active: true });
    push({ type:'portal', id:'toAnnex', area:'courtyard', x:14.8, y:7.8, kind:'archiveDoor', prompt:'離れ通路へ進む', active: tasks.checkedCourtyard || tasks.gotFilm });
    push({ type:'item', id:'lantern', area:'courtyard', x:8.8, y:2.4, kind:'lantern', prompt:'提灯を調べる', active: tasks.heard203 && !tasks.checkedCourtyard });
    push({ type:'npc', id:'guide', area:'courtyard', x:guide.x, y:guide.y, kind:'guide', prompt:'', active: state.chaseActive && guide.active && guide.area === 'courtyard' });

    push({ type:'portal', id:'annexExit', area:'annex', x:1.8, y:8.0, kind:'archiveDoor', prompt:'中庭へ戻る', active: true });
    push({ type:'item', id:'film', area:'annex', x:16.0, y:6.4, kind:'film', prompt:'黒いフィルムを拾う', active: tasks.checkedCourtyard && !tasks.gotFilm });
    push({ type:'npc', id:'guide', area:'annex', x:guide.x, y:guide.y, kind:'guide', prompt:'', active: state.chaseActive && guide.active && guide.area === 'annex' });

    push({ type:'portal', id:'closedWingExit', area:'closedWing', x:1.6, y:8.0, kind:'closedDoor', prompt:'廊下へ戻る', active: true });
    push({ type:'item', id:'shrine', area:'closedWing', x:14.6, y:4.1, kind:'shrine', prompt:'祭壇を調べる', active: tasks.talkedOkamiAgain && !tasks.checkedClosedWing });
    push({ type:'item', id:'ledger', area:'closedWing', x:6.0, y:6.1, kind:'ledger', prompt:'古い台帳を読む', active: tasks.checkedClosedWing && !tasks.readLedger });
    push({ type:'npc', id:'guide', area:'closedWing', x:guide.x, y:guide.y, kind:'guide', prompt:'', active: state.chaseActive && guide.active && guide.area === 'closedWing' });
    push({ type:'npc', id:'okami3', area:'lobby', x:5.7, y:6.2, kind:'okami', prompt:'女将に話しかける', active: tasks.escapedGuide2 && !tasks.finalTalked });

    return list.filter(s => s.active);
  }

  function getNearbyInteraction() {
    const sprites = activeSprites();
    let nearest = null;
    let nearestDist = 999;
    for (const s of sprites) {
      if (!s.prompt) continue;
      const dx = s.x - player.x;
      const dy = s.y - player.y;
      const d = Math.hypot(dx, dy);
      if (d > 1.3) continue;
      const ang = normalizeAngle(Math.atan2(dy, dx) - player.a);
      if (Math.abs(ang) > 0.75) continue;
      if (d < nearestDist) { nearest = s; nearestDist = d; }
    }
    return nearest;
  }

  function act() {
    if (state.ending) return;
    if (state.inDialogue) { advanceDialogue(); return; }
    const target = getNearbyInteraction();
    if (!target) return;
    scriptedStepAction(target.id);
  }

  function normalizeAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function createTextures() {
    const make = (draw) => {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = false;
      draw(x, c.width, c.height);
      return c;
    };
    return {
      '#': make((x,w,h) => {
        x.fillStyle = '#4d3725'; x.fillRect(0,0,w,h);
        for (let i=0;i<8;i++) {
          x.fillStyle = i%2 ? '#6c4e33' : '#573c28';
          x.fillRect(i*8,0,4,h);
        }
        x.fillStyle = 'rgba(0,0,0,.15)';
        for (let i=0;i<8;i++) x.fillRect(0, i*8, w, 1);
      }),
      W: make((x,w,h) => {
        x.fillStyle = '#5b3f2b'; x.fillRect(0,0,w,h);
        x.fillStyle = '#d8cab3'; x.fillRect(7,7,w-14,h-14);
        x.fillStyle = '#70472f'; x.fillRect(0,0,6,h); x.fillRect(w-6,0,6,h);
        x.fillRect(0,0,w,6); x.fillRect(0,h-6,w,6);
        x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(w/2-2, 7, 4, h-14);
      }),
      D: make((x,w,h) => {
        x.fillStyle = '#6a2f29'; x.fillRect(0,0,w,h);
        x.fillStyle = '#a65f55'; x.fillRect(8,8,w-16,h-16);
        x.fillStyle = '#e6d1a2'; x.fillRect(w-14,h/2,4,4);
        x.fillStyle = 'rgba(0,0,0,.15)'; x.fillRect(w/2-1, 8, 2, h-16);
      }),
      B: make((x,w,h) => {
        x.fillStyle = '#43525a'; x.fillRect(0,0,w,h);
        x.fillStyle = '#8ca6b0'; x.fillRect(8,8,w-16,h-16);
        x.fillStyle = 'rgba(255,255,255,.16)'; x.fillRect(12,12,w-24,6);
      }),
      N: make((x,w,h) => {
        x.fillStyle = '#2c3338'; x.fillRect(0,0,w,h);
        for (let i=0;i<5;i++) {
          x.fillStyle = i%2 ? '#566067' : '#3f494f';
          x.fillRect(8+i*10, 8, 7, h-16);
        }
      }),
      S: make((x,w,h) => {
        x.fillStyle = '#7f5d2a'; x.fillRect(0,0,w,h);
        x.fillStyle = '#d1bb89'; x.fillRect(10,12,w-20,h-24);
        x.fillStyle = '#694720'; x.fillRect(0,0,w,6); x.fillRect(0,h-6,w,6);
      }),
      T: make((x,w,h) => {
        x.fillStyle = '#3b2f24'; x.fillRect(0,0,w,h);
        x.fillStyle = '#8a6637'; x.fillRect(8,14,w-16,h-18);
        x.fillStyle = '#c8a76a'; x.fillRect(12,18,w-24,h-26);
      }),
      C: make((x,w,h) => {
        x.fillStyle = '#3a2a1c'; x.fillRect(0,0,w,h);
        x.fillStyle = '#62442a'; x.fillRect(4,10,w-8,h-10);
      }),
      M: make((x,w,h) => {
        x.fillStyle = '#4d5c64'; x.fillRect(0,0,w,h);
        x.fillStyle = '#b0c8d1'; x.fillRect(8,8,w-16,h-16);
      }),
      K: make((x,w,h) => {
        x.fillStyle = '#3c3027'; x.fillRect(0,0,w,h);
        x.fillStyle = '#625449'; x.fillRect(6,6,w-12,h-12);
      }),
      A: make((x,w,h) => {
        x.fillStyle = '#35261c'; x.fillRect(0,0,w,h);
        x.fillStyle = '#6d3a30'; x.fillRect(12,12,w-24,h-24);
        x.fillStyle = '#d9c59c'; x.fillRect(18,18,w-36,h-36);
      }),
      G: make((x,w,h) => {
        x.fillStyle = '#2d2533'; x.fillRect(0,0,w,h);
        x.fillStyle = '#544d68'; x.fillRect(8,8,w-16,h-16);
        x.fillStyle = '#c3c1cb'; x.fillRect(16,16,w-32,8);
      }),
    };
  }

  function makeItemSprite(kind) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 180;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    const o = (px, py, w, h, fill, stroke = '#101010') => {
      x.fillStyle = stroke; x.fillRect(px-1, py-1, w+2, h+2);
      x.fillStyle = fill; x.fillRect(px, py, w, h);
    };
    if (kind === 'tray') {
      o(22, 102, 84, 14, '#744d2b');
      o(28, 78, 24, 24, '#e3e0d7'); o(76, 78, 24, 24, '#e3e0d7');
      o(34, 84, 12, 8, '#7f9eb7'); o(82, 84, 12, 8, '#7f9eb7');
    } else if (kind === 'phone') {
      o(34, 98, 60, 26, '#1f1f22'); o(40, 76, 48, 20, '#27282d'); o(52, 68, 24, 8, '#4c4d57');
    } else if (kind === 'notebook') {
      o(42, 64, 48, 68, '#2a4f86'); o(50, 72, 30, 50, '#d4e0f0'); o(46, 64, 5, 68, '#183055');
    } else if (kind === 'bathSign') {
      o(46, 20, 10, 110, '#6a5138'); o(56, 36, 44, 58, '#bfa56c'); o(66, 48, 24, 12, '#5f3c2a');
    } else if (kind === 'key') {
      o(54, 74, 18, 8, '#cfb56d'); o(70, 72, 18, 12, '#cfb56d'); o(84, 74, 10, 8, '#cfb56d');
      o(48, 66, 16, 16, 'rgba(0,0,0,0)');
      x.strokeStyle = '#cfb56d'; x.lineWidth = 6; x.beginPath(); x.arc(56, 74, 10, 0, Math.PI*2); x.stroke();
    } else if (kind === 'ledger') {
      o(34, 56, 60, 80, '#6d3a30'); o(42, 66, 44, 60, '#edd9b4'); o(38, 56, 6, 80, '#3d1d17');
    } else if (kind === 'lantern') {
      o(58, 26, 10, 108, '#5a4631'); o(42, 48, 42, 48, '#d2b27c'); o(46, 54, 34, 36, '#f3d07a');
    } else if (kind === 'film') {
      o(38, 64, 52, 18, '#151618'); o(36, 84, 56, 28, '#2a2d33'); o(48, 88, 12, 20, '#9297a0'); o(68, 88, 12, 20, '#9297a0');
    } else if (kind === 'shrine') {
      o(30, 100, 68, 18, '#6a4827'); o(40, 54, 50, 46, '#9c2f34'); o(52, 34, 26, 20, '#d8c389');
    } else if (kind === 'archiveDoor' || kind === 'closedDoor' || kind === 'door') {
      const main = kind === 'closedDoor' ? '#544d68' : '#8f5f48';
      o(38, 28, 52, 110, main); o(46, 36, 36, 94, kind === 'closedDoor' ? '#73698e' : '#b47a61'); o(78, 84, 6, 6, '#d7c287');
    }
    return c;
  }

  function drawHead(ctx, x, y, w, h, skin, hair, eye='dark') {
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.ellipse(x, y - 4, w * 0.54, h * 0.56, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(x, y + 2, w * 0.42, h * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.beginPath(); ctx.ellipse(x - w*0.14, y - h*0.05, w*0.12, h*0.09, -0.5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = eye === 'red' ? '#7b2020' : '#121212';
    ctx.fillRect(x - w*0.17, y, w*0.08, h*0.035);
    ctx.fillRect(x + w*0.09, y, w*0.08, h*0.035);
    ctx.fillStyle = '#80574a';
    ctx.fillRect(x - w*0.02, y + h*0.12, w*0.04, h*0.11);
    ctx.fillRect(x - w*0.09, y + h*0.22, w*0.18, h*0.03);
  }

  function drawBody(ctx, opts, portrait=false) {
    const { body='#445', accent='#ccb', skirt=null, sleeve='#d8cab3', face='#efdcc7', hair='#222', eye='dark', helmet=false } = opts;
    const w = portrait ? 180 : 140;
    const h = portrait ? 220 : 250;
    ctx.clearRect(0,0,ctx.canvas.width, ctx.canvas.height);
    if (portrait) {
      const grad = ctx.createLinearGradient(0,0,0,h);
      grad.addColorStop(0, 'rgba(18,24,33,.95)');
      grad.addColorStop(1, 'rgba(6,9,15,.98)');
      ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);
    }
    ctx.save();
    if (!portrait) ctx.translate(10, 0);
    const cx = portrait ? 90 : 70;
    const headY = portrait ? 62 : 44;
    const headW = portrait ? 60 : 44;
    const headH = portrait ? 72 : 52;
    if (helmet) {
      ctx.fillStyle = '#eef1f5';
      ctx.beginPath(); ctx.ellipse(cx, headY-18, headW*0.62, headH*0.36, 0, Math.PI, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#d8dde6'; ctx.fillRect(cx - headW*0.62, headY - 18, headW*1.24, 10);
      ctx.fillStyle = '#99a9ba'; ctx.fillRect(cx - 8, headY - 44, 16, 20);
    }
    drawHead(ctx, cx, headY, headW, headH, face, hair, eye);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(cx - 34, portrait ? 116 : 92);
    ctx.lineTo(cx + 34, portrait ? 116 : 92);
    ctx.lineTo(cx + 26, portrait ? 198 : 170);
    ctx.lineTo(cx - 26, portrait ? 198 : 170);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = sleeve;
    ctx.fillRect(cx - 56, portrait ? 124 : 98, 18, portrait ? 54 : 48);
    ctx.fillRect(cx + 38, portrait ? 124 : 98, 18, portrait ? 54 : 48);
    if (accent) { ctx.fillStyle = accent; ctx.fillRect(cx - 20, portrait ? 130 : 106, 40, portrait ? 12 : 10); }
    if (skirt) {
      ctx.fillStyle = skirt;
      ctx.beginPath();
      ctx.moveTo(cx - 28, portrait ? 172 : 146);
      ctx.lineTo(cx + 28, portrait ? 172 : 146);
      ctx.lineTo(cx + 22, portrait ? 216 : 204);
      ctx.lineTo(cx - 22, portrait ? 216 : 204);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = portrait ? '#1a1c24' : '#191a1f';
    ctx.fillRect(cx - 20, portrait ? 198 : 170, 14, portrait ? 24 : 38);
    ctx.fillRect(cx + 6, portrait ? 198 : 170, 14, portrait ? 24 : 38);
    if (opts.flag) {
      ctx.fillStyle = '#d9d9d9'; ctx.fillRect(cx + 42, portrait ? 134 : 108, 6, portrait ? 68 : 66);
      ctx.fillStyle = '#c33'; ctx.fillRect(cx + 48, portrait ? 136 : 110, portrait ? 32 : 28, portrait ? 18 : 16);
      ctx.fillStyle = '#fff'; ctx.fillRect(cx + 48, portrait ? 154 : 126, portrait ? 32 : 28, portrait ? 18 : 16);
    }
    if (!portrait) {
      ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 2; ctx.strokeRect(8, 6, ctx.canvas.width - 26, ctx.canvas.height - 12);
    }
    ctx.restore();
  }

  function makeCharacterSprite(kind, portrait=false) {
    const c = document.createElement('canvas');
    c.width = portrait ? 180 : 160;
    c.height = portrait ? 220 : 260;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    if (kind === 'okami') {
      drawBody(x, { face:'#efdcc7', hair:'#2b2430', body:'#4f3042', accent:'#d1a267', sleeve:'#efdcc7', skirt:'#2d2333' }, portrait);
    } else if (kind === 'guest') {
      drawBody(x, { face:'#efddc9', hair:'#23262f', body:'#5f6ca0', accent:'#d9dbe8', sleeve:'#efddc9', skirt:'#4a5681' }, portrait);
    } else if (kind === 'maid') {
      drawBody(x, { face:'#efdcc7', hair:'#f3f3f1', body:'#335c88', accent:'#e8eef8', sleeve:'#efdcc7', skirt:'#1d3048' }, portrait);
    } else if (kind === 'guest202') {
      drawBody(x, { face:'#f0ddc9', hair:'#403126', body:'#6f5a45', accent:'#c9b89a', sleeve:'#f0ddc9', skirt:'#514234' }, portrait);
    } else if (kind === 'guest203') {
      drawBody(x, { face:'#edd9c4', hair:'#1b1f26', body:'#737b87', accent:'#d7dee8', sleeve:'#edd9c4', skirt:'#49505b' }, portrait);
    } else if (kind === 'guide') {
      drawBody(x, { face:'#e7dccf', hair:'#4a545f', body:'#2d4b6b', accent:'#eef1f5', sleeve:'#d6d9df', skirt:'#223447', eye:'red', helmet:true, flag:true }, portrait);
      if (portrait) {
        x.fillStyle = 'rgba(215,100,100,.18)';
        x.fillRect(0,0,c.width,c.height);
      }
    } else if (kind === 'narrator') {
      const grad = x.createLinearGradient(0,0,0,c.height);
      grad.addColorStop(0, 'rgba(20,28,40,.95)'); grad.addColorStop(1, 'rgba(5,8,13,.98)');
      x.fillStyle = grad; x.fillRect(0,0,c.width,c.height);
      x.fillStyle = '#cfaa74'; x.font = 'bold 44px sans-serif'; x.fillText('宵', 60, 110); x.fillText('宿', 60, 160);
    }
    return c;
  }

  function makePortrait(kind) { return makeCharacterSprite(kind, true); }

  function drawScene(dt) {
    const area = currentArea();
    const skyGrad = g.createLinearGradient(0, 0, 0, OFF_H / 2);
    skyGrad.addColorStop(0, area.skyTop); skyGrad.addColorStop(1, area.skyBottom);
    g.fillStyle = skyGrad; g.fillRect(0, 0, OFF_W, OFF_H / 2);
    const floorGrad = g.createLinearGradient(0, OFF_H / 2, 0, OFF_H);
    floorGrad.addColorStop(0, area.floorA); floorGrad.addColorStop(1, area.floorB);
    g.fillStyle = floorGrad; g.fillRect(0, OFF_H / 2, OFF_W, OFF_H / 2);

    drawFloorPattern(area);
    const zBuffer = new Array(OFF_W).fill(MAX_DEPTH);

    for (let x = 0; x < OFF_W; x++) {
      const cameraX = (x / OFF_W) - 0.5;
      const rayAngle = player.a + cameraX * FOV;
      const rayDirX = Math.cos(rayAngle);
      const rayDirY = Math.sin(rayAngle);
      let depth = 0.02;
      let hit = null;
      while (depth < MAX_DEPTH) {
        const rx = player.x + rayDirX * depth;
        const ry = player.y + rayDirY * depth;
        const t = tileAt(rx, ry);
        if (t !== '.') { hit = { tile:t, x:rx, y:ry }; break; }
        depth += 0.02;
      }
      if (!hit) continue;
      zBuffer[x] = depth;
      const corrected = depth * Math.cos(rayAngle - player.a);
      const wallH = Math.min(OFF_H * 2, (OFF_H / Math.max(0.01, corrected)) * 0.92);
      const y0 = Math.floor(OFF_H / 2 - wallH / 2);
      const tex = textures[hit.tile] || textures['#'];
      const fx = hit.x - Math.floor(hit.x);
      const fy = hit.y - Math.floor(hit.y);
      const texX = Math.floor(((fx > fy ? fx : fy) % 1) * tex.width);
      g.drawImage(tex, texX, 0, 1, tex.height, x, y0, 1, wallH);
      const shade = Math.min(.78, corrected / 18 + (state.phase === 'night' ? .10 : 0));
      g.fillStyle = `rgba(0,0,0,${shade})`;
      g.fillRect(x, y0, 1, wallH);
    }

    drawSprites(zBuffer);
    drawAreaSigns(zBuffer);
    drawAreaDecor();
    if (state.phase === 'night') drawNightEffects(dt);
    if (state.chaseActive) drawChaseWarning();
    drawVignette();
  }

  function drawFloorPattern(area) {
    for (let y = OFF_H/2; y < OFF_H; y += 4) {
      g.fillStyle = y % 8 === 0 ? area.floorA : area.floorB;
      g.fillRect(0, y, OFF_W, 1);
    }
    g.fillStyle = 'rgba(0,0,0,.08)';
    for (let x = 0; x < OFF_W; x += 18) g.fillRect(x, OFF_H/2, 2, OFF_H/2);
  }

  function project(wx, wy) {
    const dx = wx - player.x;
    const dy = wy - player.y;
    const dist = Math.hypot(dx, dy);
    const angle = normalizeAngle(Math.atan2(dy, dx) - player.a);
    if (Math.abs(angle) > FOV * 0.72) return null;
    const corrected = dist * Math.cos(angle);
    if (corrected <= 0.05) return null;
    const screenX = (angle / FOV + 0.5) * OFF_W;
    return { screenX, dist, corrected, angle };
  }

  function drawSpriteCanvas(proj, spriteCanvas, scaleFactor = 1) {
    const h = Math.min(OFF_H * 1.85, (OFF_H / Math.max(0.08, proj.corrected)) * scaleFactor);
    const w = h * (spriteCanvas.width / spriteCanvas.height);
    const x = proj.screenX - w / 2;
    const y = OFF_H / 2 - h * 0.60;
    g.drawImage(spriteCanvas, x, y, w, h);
    const darkness = Math.min(.74, proj.corrected / 16 + (state.phase === 'night' ? .08 : 0));
    g.fillStyle = `rgba(0,0,0,${darkness})`;
    g.fillRect(x, y, w, h);
  }

  function drawSprites(zBuffer) {
    const sprites = activeSprites().filter(s => s.kind && spriteCanvases[s.kind]);
    const projected = [];
    for (const s of sprites) {
      const proj = project(s.x, s.y);
      if (!proj) continue;
      projected.push({ ...s, proj });
    }
    projected.sort((a, b) => b.proj.corrected - a.proj.corrected);
    for (const s of projected) {
      const spriteCanvas = spriteCanvases[s.kind];
      const scale = s.kind === 'guide' ? 1.32 : s.type === 'item' ? 0.95 : 1.18;
      const h = Math.min(OFF_H * 1.8, (OFF_H / Math.max(0.08, s.proj.corrected)) * scale);
      const w = h * (spriteCanvas.width / spriteCanvas.height);
      const x = Math.floor(s.proj.screenX - w / 2);
      let visible = false;
      const x0 = Math.max(0, x);
      const x1 = Math.min(OFF_W - 1, Math.floor(x + w));
      for (let sx = x0; sx <= x1; sx++) {
        if (s.proj.corrected < zBuffer[sx] + 0.12) { visible = true; break; }
      }
      if (!visible) continue;
      drawSpriteCanvas(s.proj, spriteCanvas, scale);
    }
  }

  function drawAreaSigns(zBuffer) {
    const signs = currentArea().signs || [];
    for (const sign of signs) {
      const proj = project(sign.x, sign.y);
      if (!proj) continue;
      const h = Math.min(44, (OFF_H / Math.max(0.1, proj.corrected)) * 0.3);
      const w = sign.text.length * 8 + 18;
      const x = proj.screenX - w / 2;
      const y = OFF_H / 2 - h - 4;
      if (proj.corrected > zBuffer[Math.max(0, Math.min(OFF_W - 1, Math.floor(proj.screenX)))] + .2) continue;
      g.fillStyle = 'rgba(10,8,8,.85)'; g.fillRect(x, y, w, h);
      g.strokeStyle = '#d5bc87'; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      g.fillStyle = '#f5efe5'; g.font = '12px sans-serif'; g.textAlign = 'center'; g.fillText(sign.text, x + w / 2, y + h / 2 + 4);
    }
  }


function drawAreaDecor() {
  const name = player.area;
  if (name === 'lobby') {
    g.fillStyle = 'rgba(230,180,90,.08)';
    g.fillRect(18, 26, 52, 80); g.fillRect(OFF_W-72, 24, 48, 78);
  }
  if (name === 'hall' || name === 'courtyard') {
    for (let i=0;i<3;i++) {
      const px = 60 + i*110;
      const glow = g.createRadialGradient(px, 52, 2, px, 52, 38);
      glow.addColorStop(0, 'rgba(243,201,118,.20)');
      glow.addColorStop(1, 'rgba(243,201,118,0)');
      g.fillStyle = glow; g.beginPath(); g.arc(px, 52, 38, 0, Math.PI*2); g.fill();
    }
  }
  if (name === 'courtyard') {
    g.fillStyle = 'rgba(120,160,190,.06)';
    for (let i=0;i<18;i++) g.fillRect((i*23 + performance.now()*0.03)%OFF_W, 0, 1, OFF_H);
  }
  if (name === 'annex') {
    g.fillStyle = 'rgba(180,210,230,.04)';
    g.fillRect(0, 0, OFF_W, OFF_H);
  }
}

function drawVignette() {
  const grad = g.createRadialGradient(OFF_W/2, OFF_H/2, OFF_H*0.18, OFF_W/2, OFF_H/2, OFF_W*0.7);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,.36)');
  g.fillStyle = grad;
  g.fillRect(0,0,OFF_W,OFF_H);
}

  function drawNightEffects(dt) {
    g.fillStyle = 'rgba(6, 12, 20, 0.24)'; g.fillRect(0, 0, OFF_W, OFF_H);
    g.fillStyle = 'rgba(255,255,255,0.03)';
    const now = performance.now();
    for (let i = 0; i < 22; i++) {
      const x = ((i * 37 + now * 0.03) % OFF_W) | 0;
      const y = ((i * 17 + now * 0.02) % OFF_H) | 0;
      g.fillRect(x, y, 1, 1);
    }
    if (state.step >= 8) {
      const flick = (Math.sin(now * 0.013) * 0.5 + 0.5) * 0.18;
      g.fillStyle = `rgba(255,255,255,${flick})`;
      g.fillRect(0, 0, OFF_W, 3);
    }
  }

  function drawChaseWarning() {
    const flash = (Math.sin(performance.now() * 0.024) * 0.5 + 0.5) * 0.18;
    g.fillStyle = `rgba(180,20,20,${flash})`;
    g.fillRect(0, 0, OFF_W, OFF_H);
    g.fillStyle = 'rgba(255,255,255,.76)';
    g.font = 'bold 16px sans-serif';
    g.textAlign = 'center';
    g.fillText('誘導員が追ってくる', OFF_W / 2, 26);
  }

  function drawFrame(dt) {
    state.pulse += dt;
    if (state.areaFlash > 0) state.areaFlash = Math.max(0, state.areaFlash - dt * 1.6);
    drawScene(dt);
    if (state.areaFlash > 0) {
      g.fillStyle = `rgba(255, 236, 189, ${state.areaFlash * 0.18})`;
      g.fillRect(0,0,OFF_W,OFF_H);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
  }

  function updateGuide(dt) {
    if (!state.chaseActive || state.inDialogue || state.ending || state.menuOpen) return;
    if (!guide.active || guide.area !== player.area) return;
    const dx = player.x - guide.x;
    const dy = player.y - guide.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.58) {
      endGame('誘導員に捕まった', '青いノートを持ったまま順番から外れたあなたを、白ヘルメットの誘導員が静かに回収した。v16では、宿帳庫と離れ通路の二段階追跡がゲームオーバー条件付きで入っています。');
      return;
    }
    const move = guide.speed * dt;
    const nx = guide.x + (dx / Math.max(0.001, d)) * move;
    const ny = guide.y + (dy / Math.max(0.001, d)) * move;
    const map = areas[guide.area].map;
    const solidAt = (x, y) => {
      const mx = Math.floor(x), my = Math.floor(y);
      if (mx < 0 || my < 0 || my >= map.length || mx >= map[0].length) return true;
      return map[my][mx] !== '.';
    };
    if (!solidAt(nx, guide.y)) guide.x = nx;
    if (!solidAt(guide.x, ny)) guide.y = ny;
  }

  function update(dt) {
    if (!state.inDialogue && !state.menuOpen && !state.ending) {
      const speed = player.speed * (keys.shift ? 1.34 : 1);
      const moveForward = (keys.w ? 1 : 0) - (keys.s ? 1 : 0) + (-moveInput.y);
      const moveSide = (keys.d ? 1 : 0) - (keys.a ? 1 : 0) + moveInput.x;
      const lookTurn = lookInput.dx * 0.0042;
      player.a += lookTurn;
      lookInput.dx = 0;
      const sin = Math.sin(player.a), cos = Math.cos(player.a);
      const vx = (cos * moveForward + Math.cos(player.a + Math.PI / 2) * moveSide) * speed * dt;
      const vy = (sin * moveForward + Math.sin(player.a + Math.PI / 2) * moveSide) * speed * dt;
      tryMove(player.x + vx, player.y + vy);
    }

    updateGuide(dt);

    const n = (!state.inDialogue && !state.ending) ? getNearbyInteraction() : null;
    state.nearby = n;
    if (n && n.prompt) {
      promptBox.textContent = n.prompt;
      promptBox.classList.remove('hidden');
    } else {
      promptBox.classList.add('hidden');
    }

    if (state.lastStatusTimer > 0) {
      state.lastStatusTimer = Math.max(0, state.lastStatusTimer - dt);
      statusBox.style.opacity = String(Math.min(1, state.lastStatusTimer * 1.4));
    } else {
      statusBox.style.opacity = '0.35';
    }

    drawMiniMap();
    drawFrame(dt);
  }

  function tryMove(nx, ny) {
    if (!isSolid(nx, player.y)) player.x = nx;
    if (!isSolid(player.x, ny)) player.y = ny;
  }

  function resize() {
    canvas.width = Math.floor(window.innerWidth * Math.min(window.devicePixelRatio || 1, 2));
    canvas.height = Math.floor(window.innerHeight * Math.min(window.devicePixelRatio || 1, 2));
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
  }

  function handlePointerDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (movePad.contains(e.target)) return;
    if (dialogueBox.contains(e.target)) return;
    if (menuPanel.contains(e.target)) return;
    if (x > rect.width * 0.45 && !state.inDialogue && !state.menuOpen) {
      lookInput.active = true;
      lookInput.lastX = e.clientX;
      lookInput.pointerId = e.pointerId;
    }
  }

  function handlePointerMove(e) {
    if (lookInput.active && e.pointerId === lookInput.pointerId) {
      lookInput.dx += e.clientX - lookInput.lastX;
      lookInput.lastX = e.clientX;
    }
  }

  function handlePointerUp(e) {
    if (lookInput.active && e.pointerId === lookInput.pointerId) {
      lookInput.active = false;
      lookInput.pointerId = null;
    }
  }

  function setupMovePad() {
    const center = () => {
      moveKnob.style.left = '50%';
      moveKnob.style.top = '50%';
      moveInput.x = 0;
      moveInput.y = 0;
    };
    center();
    const updatePad = (clientX, clientY) => {
      const rect = movePad.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const max = rect.width * 0.32;
      const dist = Math.hypot(dx, dy);
      const clamped = dist > max ? max / dist : 1;
      const ox = dx * clamped;
      const oy = dy * clamped;
      moveKnob.style.left = `${50 + (ox / (rect.width / 2)) * 50}%`;
      moveKnob.style.top = `${50 + (oy / (rect.height / 2)) * 50}%`;
      moveInput.x = ox / max;
      moveInput.y = oy / max;
    };
    movePad.addEventListener('pointerdown', (e) => {
      moveInput.active = true;
      moveInput.pointerId = e.pointerId;
      updatePad(e.clientX, e.clientY);
    });
    window.addEventListener('pointermove', (e) => {
      if (moveInput.active && e.pointerId === moveInput.pointerId) updatePad(e.clientX, e.clientY);
    });
    window.addEventListener('pointerup', (e) => {
      if (moveInput.active && e.pointerId === moveInput.pointerId) {
        moveInput.active = false;
        moveInput.pointerId = null;
        center();
      }
    });
    window.addEventListener('pointercancel', () => {
      moveInput.active = false; moveInput.pointerId = null; center();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'w' || e.key === 'W') keys.w = true;
    else if (e.key === 'a' || e.key === 'A') keys.a = true;
    else if (e.key === 's' || e.key === 'S') keys.s = true;
    else if (e.key === 'd' || e.key === 'D') keys.d = true;
    else if (e.key === 'Shift') keys.shift = true;
    else if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') act();
    else if (e.key === 'Escape') toggleMenu();
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'w' || e.key === 'W') keys.w = false;
    else if (e.key === 'a' || e.key === 'A') keys.a = false;
    else if (e.key === 's' || e.key === 'S') keys.s = false;
    else if (e.key === 'd' || e.key === 'D') keys.d = false;
    else if (e.key === 'Shift') keys.shift = false;
  });

  canvas.addEventListener('pointerdown', handlePointerDown);
  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp);
  window.addEventListener('pointercancel', handlePointerUp);

  menuBtn.addEventListener('click', () => toggleMenu());
  saveBtn.addEventListener('click', () => { saveGame(); toggleMenu(false); });
  loadBtn.addEventListener('click', () => { loadGame(); toggleMenu(false); });
  hudToggleBtn.addEventListener('click', () => { state.hudMinimal = !state.hudMinimal; applyHudState(); });
  actBtn.addEventListener('click', act);
  dialogueBox.addEventListener('click', act);
  setupMovePad();

document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
let __lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - __lastTouchEnd < 320) e.preventDefault();
  __lastTouchEnd = now;
}, { passive: false });
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
  window.addEventListener('resize', resize);

  resize();
  applyHudState();
  updatePortrait('narrator');
  if (window.__YOINADO_CONTINUE__) {
    if (!loadGame()) startNew();
  } else {
    startNew();
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
