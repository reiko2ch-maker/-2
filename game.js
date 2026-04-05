(function () {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: false });
  const mapCanvas = document.getElementById('miniMap');
  const mapCtx = mapCanvas.getContext('2d', { alpha: false });

  const statusBox = document.getElementById('statusBox');
  const objectiveBox = document.getElementById('objectiveBox');
  const promptBox = document.getElementById('promptBox');
  const dialogueBox = document.getElementById('dialogueBox');
  const dialogueText = document.getElementById('dialogueText');
  const speakerLabel = document.getElementById('speakerLabel');
  const phaseLabel = document.getElementById('phaseLabel');
  const areaLabel = document.getElementById('areaLabel');
  const dayLabel = document.getElementById('dayLabel');
  const endingScreen = document.getElementById('endingScreen');
  const endingTitle = document.getElementById('endingTitle');
  const endingText = document.getElementById('endingText');
  const actBtn = document.getElementById('actBtn');
  const movePad = document.getElementById('movePad');
  const moveKnob = document.getElementById('moveKnob');
  const saveBtn = document.getElementById('saveBtn');
  const loadBtn = document.getElementById('loadBtn');

  const STORAGE_KEY = 'yoinado_v13_save';
  const OFF_W = 320;
  const OFF_H = 200;
  const FOV = Math.PI / 3.2;
  const MAX_DEPTH = 22;
  const off = document.createElement('canvas');
  off.width = OFF_W;
  off.height = OFF_H;
  const g = off.getContext('2d', { alpha: false });
  g.imageSmoothingEnabled = false;

  const player = { x: 2.5, y: 9.6, a: -0.03, radius: 0.18, speed: 2.1, area: 'lobby' };
  const keys = { w:false, a:false, s:false, d:false };
  const moveInput = { active:false, x:0, y:0, pointerId:null };
  const lookInput = { active:false, lastX:0, pointerId:null, dx:0 };

  const state = {
    phase: 'day',
    day: 1,
    objective: '女将に話しかける',
    inDialogue: false,
    dialogueQueue: [],
    dialogueOnEnd: null,
    nearby: null,
    ending: false,
    pulse: 0,
    areaFlash: 0,
  };

  const tasks = {
    talkedToOkami: false,
    gotTray: false,
    servedTea: false,
    heardRumor: false,
    readLedger: false,
    startedNight: false,
    talkedWorker: false,
    checked203: false,
  };

  const areas = {
    lobby: {
      name: '帳場',
      skyTop: '#1b1a26', skyBottom: '#6b5137',
      floorA: '#6d593f', floorB: '#5b4934', ceilA: '#2a2430', ceilB: '#19151e',
      map: [
        '####################',
        '#......WWWWWW......#',
        '#......W....W......#',
        '#......W....W......#',
        '#......W....W......#',
        '#......W....W......#',
        '#......WWWWWW......#',
        '#..................#',
        '#..................#',
        '#..................#',
        '#..................#',
        '####################'
      ],
      spawns: {
        start: { x: 2.5, y: 9.6, a: -0.03 },
        fromHall: { x: 16.6, y: 9.1, a: Math.PI },
      },
    },
    hall: {
      name: '客室廊下',
      skyTop: '#10161f', skyBottom: '#4d3827',
      floorA: '#6a533a', floorB: '#5c4732', ceilA: '#21202b', ceilB: '#17141d',
      map: [
        '########################',
        '#......................#',
        '#......................#',
        '#......................#',
        '#....DD....DD....DD....#',
        '#......................#',
        '#......................#',
        '#......................#',
        '#....SSSSSSSSSSSS......#',
        '#......................#',
        '#......................#',
        '########################'
      ],
      spawns: {
        fromLobby: { x: 2.2, y: 9.2, a: 0 },
        fromRoom: { x: 18.6, y: 5.6, a: Math.PI },
        fromNorth: { x: 11.5, y: 2.2, a: Math.PI / 2 },
      },
    },
    room201: {
      name: '201号室',
      skyTop: '#15141d', skyBottom: '#614431',
      floorA: '#7a6b4e', floorB: '#665a43', ceilA: '#241e25', ceilB: '#19161b',
      map: [
        '############',
        '#....SS....#',
        '#..........#',
        '#..........#',
        '#..........#',
        '#..........#',
        '#..........#',
        '#..........#',
        '#..........#',
        '############'
      ],
      spawns: {
        door: { x: 2.1, y: 5.4, a: 0 },
      },
    },
    north: {
      name: '北の裏廊下',
      skyTop: '#091116', skyBottom: '#20363f',
      floorA: '#4d524f', floorB: '#3d4341', ceilA: '#171b21', ceilB: '#0d1016',
      map: [
        '####################',
        '#..................#',
        '#..SSSSSS..SSSS....#',
        '#..................#',
        '#..................#',
        '#..........DD......#',
        '#..................#',
        '#..................#',
        '#..................#',
        '####################'
      ],
      spawns: {
        entry: { x: 2.2, y: 7.5, a: 0 },
      },
    }
  };

  function currentArea() { return areas[player.area]; }
  function currentMap() { return currentArea().map; }
  function mapW() { return currentMap()[0].length; }
  function mapH() { return currentMap().length; }

  function setStatus(text) { statusBox.textContent = text; }
  function setObjective(text) { state.objective = text; }

  function tileAt(x, y) {
    const mx = Math.floor(x), my = Math.floor(y);
    const map = currentMap();
    if (mx < 0 || my < 0 || mx >= map[0].length || my >= map.length) return '#';
    return map[my][mx];
  }

  function isWall(x, y) {
    const t = tileAt(x, y);
    return t !== '.';
  }

  function moveAndCollide(nx, ny) {
    if (!isWall(nx, player.y)) player.x = nx;
    if (!isWall(player.x, ny)) player.y = ny;
  }

  function showDialogue(lines, onEnd) {
    state.inDialogue = true;
    state.dialogueQueue = lines.slice();
    state.dialogueOnEnd = onEnd || null;
    dialogueBox.classList.remove('hidden');
    promptBox.classList.add('hidden');
    advanceDialogue();
  }

  function advanceDialogue() {
    if (!state.inDialogue) return;
    if (state.dialogueQueue.length === 0) {
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
  }

  function endGame(title, text) {
    state.ending = true;
    endingTitle.textContent = title;
    endingText.textContent = text;
    endingScreen.classList.remove('hidden');
    promptBox.classList.add('hidden');
  }

  function getSaveData() {
    return {
      player: { x: player.x, y: player.y, a: player.a, area: player.area },
      tasks: { ...tasks },
      phase: state.phase,
      day: state.day,
      objective: state.objective,
    };
  }

  function saveGame() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getSaveData()));
    setStatus('保存した / v13');
  }

  function loadGame() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { setStatus('保存データなし'); return false; }
    try {
      const data = JSON.parse(raw);
      Object.assign(player, data.player || {});
      Object.assign(tasks, data.tasks || {});
      state.phase = data.phase || 'day';
      state.day = data.day || 1;
      dayLabel.textContent = 'DAY ' + state.day;
      phaseLabel.textContent = state.phase === 'night' ? '深夜調査' : '昼勤務';
      areaLabel.textContent = currentArea().name;
      state.ending = false;
      state.inDialogue = false;
      dialogueBox.classList.add('hidden');
      endingScreen.classList.add('hidden');
      setObjective(data.objective || '続きから再開');
      setStatus('ロードした / v13');
      return true;
    } catch (e) {
      setStatus('ロード失敗');
      return false;
    }
  }

  function changeArea(areaId, spawnKey) {
    const area = areas[areaId];
    if (!area) return;
    player.area = areaId;
    const sp = area.spawns[spawnKey] || Object.values(area.spawns)[0];
    player.x = sp.x; player.y = sp.y; player.a = sp.a;
    areaLabel.textContent = area.name;
    state.areaFlash = 1.0;
    setStatus('エリア移動: ' + area.name);
  }

  function startNew() {
    player.area = 'lobby';
    changeArea('lobby', 'start');
    Object.keys(tasks).forEach(k => tasks[k] = false);
    state.phase = 'day';
    state.day = 1;
    state.ending = false;
    state.inDialogue = false;
    dayLabel.textContent = 'DAY 1';
    phaseLabel.textContent = '昼勤務';
    endingScreen.classList.add('hidden');
    dialogueBox.classList.add('hidden');
    setObjective('女将に話しかける');
    setStatus('起動完了 / v13');
    showDialogue([
      ['記録', '今日は住み込み初日。まずは帳場で女将の指示を受ける。'],
      ['記録', '昼は仕事、夜は調査。客の話が、そのまま事件の入口になる。']
    ]);
  }

  function outlineRect(x, y, w, h, fill, stroke = '#111') { return { x, y, w, h, fill, stroke }; }
  function drawShapes(ctx2, shapes) {
    for (const s of shapes) {
      ctx2.fillStyle = s.stroke; ctx2.fillRect(s.x - 1, s.y - 1, s.w + 2, s.h + 2);
      ctx2.fillStyle = s.fill; ctx2.fillRect(s.x, s.y, s.w, s.h);
    }
  }

  function makeSprite(kind) {
    const c = document.createElement('canvas');
    c.width = 88; c.height = 132;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.clearRect(0, 0, 88, 132);
    if (kind === 'okami') {
      drawShapes(x, [
        outlineRect(28, 10, 32, 18, '#2b2430'), outlineRect(31, 22, 26, 18, '#f1e3d0'),
        outlineRect(22, 40, 44, 46, '#5b3445'), outlineRect(16, 46, 12, 22, '#f1e3d0'),
        outlineRect(60, 46, 12, 22, '#f1e3d0'), outlineRect(30, 54, 28, 10, '#d1a267'),
        outlineRect(26, 86, 14, 24, '#2d2432'), outlineRect(48, 86, 14, 24, '#2d2432')
      ]);
    } else if (kind === 'guest') {
      drawShapes(x, [
        outlineRect(28, 10, 32, 18, '#2a2733'), outlineRect(32, 22, 24, 16, '#f0e0cb'),
        outlineRect(24, 40, 40, 42, '#7c67b3'), outlineRect(18, 44, 10, 20, '#f0e0cb'),
        outlineRect(60, 44, 10, 20, '#f0e0cb'), outlineRect(30, 82, 14, 24, '#5d4a9c'),
        outlineRect(48, 82, 14, 24, '#5d4a9c'), outlineRect(26, 28, 36, 6, '#111')
      ]);
    } else if (kind === 'worker') {
      drawShapes(x, [
        outlineRect(26, 8, 36, 14, '#f5f5f5'), outlineRect(32, 20, 24, 8, '#dcdcdc'),
        outlineRect(33, 28, 22, 18, '#f3dfc7'), outlineRect(24, 46, 40, 44, '#2150a0'),
        outlineRect(18, 50, 10, 24, '#18335c'), outlineRect(60, 50, 10, 24, '#18335c'),
        outlineRect(57, 50, 14, 8, '#79d6b5'), outlineRect(28, 90, 14, 24, '#132440'),
        outlineRect(48, 90, 14, 24, '#132440'), outlineRect(12, 48, 18, 12, '#f2f2f2'),
        outlineRect(58, 44, 18, 14, '#cb4141'), outlineRect(28, 42, 2, 30, '#7a5b41'),
        outlineRect(58, 40, 2, 32, '#7a5b41')
      ]);
    } else if (kind === 'tray') {
      drawShapes(x, [outlineRect(24, 58, 40, 10, '#5d3d28'), outlineRect(28, 52, 12, 8, '#7bd0bd'), outlineRect(48, 52, 10, 8, '#f0e0cb')]);
    } else if (kind === 'ledger') {
      drawShapes(x, [outlineRect(24, 34, 40, 56, '#ece2d0'), outlineRect(24, 34, 10, 56, '#9f3b3b')]);
      x.fillStyle = '#7a664f'; x.fillRect(38, 48, 16, 3); x.fillRect(38, 58, 16, 3); x.fillRect(38, 68, 12, 3);
    } else if (kind === 'door201') {
      drawShapes(x, [outlineRect(18, 16, 52, 80, '#9d7a56'), outlineRect(24, 22, 40, 68, '#d1c3ad'), outlineRect(56, 54, 4, 4, '#d0b35b')]);
      x.fillStyle = '#281f18'; x.font = 'bold 18px sans-serif'; x.textAlign = 'center'; x.fillText('201', 44, 48);
    } else if (kind === 'northDoor') {
      drawShapes(x, [outlineRect(18, 16, 52, 80, '#56646b'), outlineRect(24, 22, 40, 68, '#93a1a7')]);
      x.fillStyle = '#12181d'; x.font = 'bold 16px sans-serif'; x.textAlign = 'center'; x.fillText('北', 44, 48); x.fillText('裏廊下', 44, 70);
    } else if (kind === 'hallDoor') {
      drawShapes(x, [outlineRect(18, 16, 52, 80, '#9e7a57'), outlineRect(24, 22, 40, 68, '#d1c1a6')]);
      x.fillStyle = '#281f18'; x.font = 'bold 16px sans-serif'; x.textAlign = 'center'; x.fillText('客室', 44, 48); x.fillText('廊下', 44, 70);
    } else if (kind === 'lantern') {
      drawShapes(x, [outlineRect(30, 8, 4, 12, '#7a5d38'), outlineRect(18, 20, 36, 42, '#f0c873'), outlineRect(16, 18, 40, 4, '#9b452c'), outlineRect(16, 62, 40, 4, '#9b452c')]);
      x.fillStyle = 'rgba(255,245,210,0.85)'; x.fillRect(28, 28, 16, 16);
    } else if (kind === 'signLobby') {
      drawShapes(x, [outlineRect(16, 24, 56, 32, '#d8ccb6'), outlineRect(42, 56, 4, 24, '#6c5137')]);
      x.fillStyle = '#2b231c'; x.font = 'bold 16px sans-serif'; x.textAlign = 'center'; x.fillText('帳場', 44, 46);
    } else if (kind === 'sign203') {
      drawShapes(x, [outlineRect(18, 16, 52, 80, '#7f6950'), outlineRect(24, 22, 40, 68, '#a58c70')]);
      x.fillStyle = '#1e1814'; x.font = 'bold 18px sans-serif'; x.textAlign = 'center'; x.fillText('203', 44, 48);
      x.fillStyle = '#b73d3d'; x.fillRect(24, 24, 40, 4);
    }
    return c;
  }

  function makeTexture(kind) {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    if (kind === 'wood') {
      x.fillStyle = '#563922'; x.fillRect(0, 0, 32, 32);
      for (let i = 0; i < 32; i += 8) {
        x.fillStyle = i % 16 === 0 ? '#7f5635' : '#69462d'; x.fillRect(i, 0, 6, 32);
      }
      x.fillStyle = 'rgba(34,20,12,0.45)'; for (let i = 0; i < 32; i += 4) x.fillRect(i, 0, 1, 32);
    } else if (kind === 'shoji') {
      x.fillStyle = '#d8ccb5'; x.fillRect(0, 0, 32, 32);
      x.fillStyle = '#826646';
      for (let i = 0; i < 32; i += 8) { x.fillRect(i, 0, 1, 32); x.fillRect(0, i, 32, 1); }
      x.fillStyle = 'rgba(255,240,210,0.14)'; x.fillRect(0, 0, 32, 32);
    } else if (kind === 'door') {
      x.fillStyle = '#9f7a56'; x.fillRect(0, 0, 32, 32); x.fillStyle = '#ccbea6'; x.fillRect(4, 4, 24, 24);
      x.fillStyle = '#715637'; x.fillRect(15, 4, 2, 24); x.fillStyle = '#d3b55e'; x.fillRect(24, 15, 3, 3);
    } else {
      x.fillStyle = '#4b565d'; x.fillRect(0, 0, 32, 32); x.fillStyle = '#7f8e95'; x.fillRect(4, 4, 24, 24);
      x.fillStyle = '#324047'; x.fillRect(0, 14, 32, 4);
    }
    return x.getImageData(0, 0, 32, 32).data;
  }

  const textures = {
    '#': makeTexture('wood'),
    'W': makeTexture('wood'),
    'S': makeTexture('shoji'),
    'D': makeTexture('door'),
  };

  const sprites = {
    okami: makeSprite('okami'), guest: makeSprite('guest'), worker: makeSprite('worker'),
    tray: makeSprite('tray'), ledger: makeSprite('ledger'), door201: makeSprite('door201'), northDoor: makeSprite('northDoor'),
    hallDoor: makeSprite('hallDoor'), lantern: makeSprite('lantern'), signLobby: makeSprite('signLobby'), sign203: makeSprite('sign203')
  };

  const decor = [
    { area:'lobby', id:'lobbySign', x:1.6, y:8.9, r:.6, sprite:'signLobby' },
    { area:'lobby', id:'lan1', x:9.7, y:1.8, r:.65, sprite:'lantern' },
    { area:'lobby', id:'lan2', x:12.3, y:1.8, r:.65, sprite:'lantern' },
    { area:'hall', id:'lanh1', x:6.0, y:3.0, r:.6, sprite:'lantern' },
    { area:'hall', id:'lanh2', x:12.0, y:3.0, r:.6, sprite:'lantern' },
    { area:'hall', id:'lanh3', x:18.0, y:3.0, r:.6, sprite:'lantern' },
    { area:'north', id:'lanN1', x:5.4, y:2.1, r:.6, sprite:'lantern' },
    { area:'north', id:'lanN2', x:13.4, y:2.1, r:.6, sprite:'lantern' },
  ];

  const interactives = [
    {
      id:'okami', area:'lobby', x:4.2, y:8.8, r:.85, sprite:'okami', label:'女将', phase:'day',
      visible:()=>true,
      onInteract(){
        if (!tasks.talkedToOkami) {
          tasks.talkedToOkami = true;
          setObjective('配膳盆を取って201号室へ向かう');
          showDialogue([
            ['女将', 'まずは201号室へお茶を持っていって。今日の仕事はそこから。'],
            ['女将', '客室廊下は右の戸の先。終わったら帳場に戻っておいで。']
          ]);
        } else if (tasks.servedTea && !tasks.readLedger) {
          showDialogue([
            ['女将', '客は何か言っていたかい。'],
            ['女将', '帳場ノートを見てきな。昔から203のことだけ、帳面の書き方が変なんだよ。']
          ]);
        } else if (tasks.readLedger && !tasks.startedNight) {
          tasks.startedNight = true;
          state.phase = 'night';
          phaseLabel.textContent = '深夜調査';
          setObjective('客室廊下から北の裏廊下へ向かう');
          showDialogue([
            ['女将', '表の仕事は終わり。ここからは見回りだ。'],
            ['女将', '北の裏廊下に、今日もいないはずの客が出る。']
          ]);
        } else {
          showDialogue([['女将', state.phase === 'day' ? 'まずは201号室へ。' : '北の裏廊下へ。もう客の声は仕事じゃなく、手掛かりになる。']]);
        }
      }
    },
    {
      id:'tray', area:'lobby', x:7.0, y:8.8, r:.6, sprite:'tray', label:'配膳盆', phase:'day',
      visible:()=>tasks.talkedToOkami && !tasks.gotTray,
      onInteract(){
        tasks.gotTray = true;
        setObjective('客室廊下へ移動し、201号室へ入る');
        showDialogue([['記録', '湯呑みの載った盆を持った。ぬるいのに、指先だけ熱い。']]);
      }
    },
    {
      id:'hallDoorFromLobby', area:'lobby', x:17.2, y:8.9, r:.95, sprite:'hallDoor', label:'客室廊下へ', phase:'any',
      visible:()=>true,
      onInteract(){ changeArea('hall', 'fromLobby'); }
    },
    {
      id:'lobbyDoorFromHall', area:'hall', x:2.0, y:9.1, r:.95, sprite:'signLobby', label:'帳場へ戻る', phase:'any',
      visible:()=>true,
      onInteract(){ changeArea('lobby', 'fromHall'); }
    },
    {
      id:'door201', area:'hall', x:18.7, y:5.5, r:.95, sprite:'door201', label:'201号室', phase:'any',
      visible:()=>true,
      onInteract(){
        if (!tasks.gotTray) {
          showDialogue([['記録', '先に帳場でお茶を受け取る。']]);
          return;
        }
        changeArea('room201', 'door');
      }
    },
    {
      id:'guest201', area:'room201', x:8.6, y:4.9, r:.85, sprite:'guest', label:'201号室の客', phase:'day',
      visible:()=>tasks.gotTray && !tasks.servedTea,
      onInteract(){
        tasks.servedTea = true;
        tasks.heardRumor = true;
        setObjective('帳場に戻って帳面を調べる');
        showDialogue([
          ['宿泊客', 'ありがとうございます。……ところで、203号室って今も使ってますか。'],
          ['宿泊客', 'さっき廊下で、誰もいない部屋から咳払いが聞こえたんです。'],
          ['宿泊客', 'しかも足音だけ、一拍遅れて追いかけてくるみたいで。']
        ]);
      }
    },
    {
      id:'roomExit', area:'room201', x:1.8, y:5.4, r:.95, sprite:'door201', label:'客室廊下へ戻る', phase:'any',
      visible:()=>true,
      onInteract(){ changeArea('hall', 'fromRoom'); }
    },
    {
      id:'ledger', area:'lobby', x:9.0, y:8.8, r:.65, sprite:'ledger', label:'帳場ノート', phase:'day',
      visible:()=>tasks.heardRumor && !tasks.readLedger,
      onInteract(){
        tasks.readLedger = true;
        setObjective('女将に報告する');
        showDialogue([
          ['帳場ノート', '「203: 宿帳なし。だが灯りは毎晩落ちる」'],
          ['帳場ノート', '「白旗の誘導員は、客を外へ出すのではなく、奥へ入れる」']
        ]);
      }
    },
    {
      id:'northDoor', area:'hall', x:11.5, y:1.9, r:.95, sprite:'northDoor', label:'北の裏廊下', phase:'any',
      visible:()=>true,
      onInteract(){
        if (!tasks.startedNight) {
          showDialogue([['記録', '今はまだ昼勤務。夜の見回りが始まってから開く。']]);
          return;
        }
        changeArea('north', 'entry');
        setObjective('裏廊下の作業員に話を聞く');
      }
    },
    {
      id:'worker', area:'north', x:8.6, y:7.0, r:.9, sprite:'worker', label:'誘導員', phase:'night',
      visible:()=>tasks.startedNight && !tasks.talkedWorker,
      onInteract(){
        tasks.talkedWorker = true;
        setObjective('203号室の前を確認する');
        showDialogue([
          ['誘導員', '白旗なら進め。赤旗でも進め。ここでは戻る方向が消えている。'],
          ['誘導員', '203の前に立つと、宿帳にいない客の息だけが先に届く。']
        ]);
      }
    },
    {
      id:'room203', area:'north', x:15.5, y:5.5, r:.95, sprite:'sign203', label:'203号室', phase:'night',
      visible:()=>tasks.startedNight,
      onInteract(){
        if (!tasks.talkedWorker) {
          showDialogue([['記録', '先に裏廊下の作業員の話を聞く。']]);
          return;
        }
        tasks.checked203 = true;
        showDialogue([
          ['記録', '戸を開けた瞬間、昼に歩いた客室廊下が、部屋の中から続いていた。'],
          ['記録', '201の客の声、女将の声、誰の宿帳にもない咳払いが、同じ距離で重なっている。']
        ], () => {
          endGame('203号室の反転', '昼の仕事で聞いた違和感は、夜にはすべて旅館の構造そのものになっていた。宵宿は客を泊めるのではなく、噂ごと閉じ込めている。');
        });
      }
    },
    {
      id:'northReturn', area:'north', x:2.0, y:7.6, r:.95, sprite:'northDoor', label:'客室廊下へ戻る', phase:'night',
      visible:()=>true,
      onInteract(){ changeArea('hall', 'fromNorth'); }
    },
  ];

  function currentObjectiveTargetId() {
    if (!tasks.talkedToOkami) return 'okami';
    if (!tasks.gotTray) return 'tray';
    if (!tasks.servedTea) return player.area === 'room201' ? 'guest201' : 'door201';
    if (!tasks.readLedger) return player.area === 'lobby' ? 'ledger' : 'lobbyDoorFromHall';
    if (!tasks.startedNight) return 'okami';
    if (!tasks.talkedWorker) return player.area === 'north' ? 'worker' : 'northDoor';
    if (!tasks.checked203) return player.area === 'north' ? 'room203' : 'northDoor';
    return null;
  }

  function interactivesInArea(area) {
    return interactives.filter(obj => obj.area === area && obj.visible() && (obj.phase === 'any' || obj.phase === state.phase));
  }
  function decorInArea(area) { return decor.filter(obj => obj.area === area); }

  function getNearbyInteractive() {
    const list = interactivesInArea(player.area);
    let best = null;
    for (const obj of list) {
      const dx = obj.x - player.x, dy = obj.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > obj.r + 0.75) continue;
      let rel = Math.atan2(dy, dx) - player.a;
      while (rel < -Math.PI) rel += Math.PI * 2;
      while (rel > Math.PI) rel -= Math.PI * 2;
      if (Math.abs(rel) > 0.7) continue;
      if (!best || dist < best.dist) best = { obj, dist };
    }
    return best ? best.obj : null;
  }

  function directionText(angle) {
    if (Math.abs(angle) < 0.35) return '前方';
    if (angle > 0.35 && angle < 1.2) return '前方右';
    if (angle < -0.35 && angle > -1.2) return '前方左';
    if (angle >= 1.2) return '右奥';
    return '左奥';
  }

  function getActiveTarget() {
    const targetId = currentObjectiveTargetId();
    return interactives.find(obj => obj.id === targetId && obj.area === player.area && obj.visible() && (obj.phase === state.phase || obj.phase === 'any')) || null;
  }

  function updateObjectiveDisplay() {
    const targetId = currentObjectiveTargetId();
    const target = interactives.find(obj => obj.id === targetId && obj.visible() && (obj.phase === state.phase || obj.phase === 'any')) || null;
    if (!target) { objectiveBox.textContent = state.objective; return; }
    if (target.area !== player.area) {
      objectiveBox.textContent = `目標: ${state.objective} / 現在地: ${currentArea().name} / 目的地: ${areas[target.area].name}`;
      return;
    }
    let rel = Math.atan2(target.y - player.y, target.x - player.x) - player.a;
    while (rel < -Math.PI) rel += Math.PI * 2;
    while (rel > Math.PI) rel -= Math.PI * 2;
    const dist = Math.hypot(target.x - player.x, target.y - player.y);
    objectiveBox.textContent = `目標: ${state.objective} / ${directionText(rel)} / 約${dist.toFixed(1)}m`;
  }

  function sampleTexture(tex, u, v, brightness) {
    const tx = (((u % 1) + 1) % 1 * 31) | 0;
    const ty = (((v % 1) + 1) % 1 * 31) | 0;
    const idx = (ty * 32 + tx) * 4;
    return [Math.min(255, tex[idx] * brightness), Math.min(255, tex[idx + 1] * brightness), Math.min(255, tex[idx + 2] * brightness)];
  }

  function drawBackground() {
    const area = currentArea();
    const gradSky = g.createLinearGradient(0, 0, 0, OFF_H / 2);
    gradSky.addColorStop(0, area.skyTop); gradSky.addColorStop(1, area.skyBottom);
    g.fillStyle = gradSky; g.fillRect(0, 0, OFF_W, OFF_H / 2);

    const gradFloor = g.createLinearGradient(0, OFF_H / 2, 0, OFF_H);
    gradFloor.addColorStop(0, area.floorA); gradFloor.addColorStop(1, area.floorB);
    g.fillStyle = gradFloor; g.fillRect(0, OFF_H / 2, OFF_W, OFF_H / 2);

    g.fillStyle = 'rgba(255,255,255,0.035)';
    for (let y = OFF_H / 2; y < OFF_H; y += 10) g.fillRect(0, y, OFF_W, 1);
    g.fillStyle = 'rgba(0,0,0,0.14)';
    for (let y = 0; y < OFF_H; y += 4) g.fillRect(0, y, OFF_W, 1);
  }

  function renderWorld() {
    drawBackground();
    const zBuffer = new Array(OFF_W).fill(MAX_DEPTH);

    for (let x = 0; x < OFF_W; x++) {
      const rayAngle = player.a - FOV / 2 + (x / OFF_W) * FOV;
      const sin = Math.sin(rayAngle), cos = Math.cos(rayAngle);
      let dist = 0.02, hit = false, hitX = 0, hitY = 0, tile = '#';
      while (dist < MAX_DEPTH && !hit) {
        hitX = player.x + cos * dist;
        hitY = player.y + sin * dist;
        tile = tileAt(hitX, hitY);
        if (tile !== '.') hit = true; else dist += 0.02;
      }
      const perp = Math.max(0.001, dist * Math.cos(rayAngle - player.a));
      zBuffer[x] = perp;
      const wallH = Math.min(OFF_H * 1.5, (OFF_H / perp) * 0.9);
      const startY = ((OFF_H - wallH) / 2) | 0;
      const tex = textures[tile] || textures['#'];
      const fracX = hitX - Math.floor(hitX), fracY = hitY - Math.floor(hitY);
      const useU = (fracX < 0.05 || fracX > 0.95) ? fracY : fracX;
      const sideShade = (fracX < 0.05 || fracX > 0.95) ? 0.88 : 1.0;
      const brightness = Math.max(0.22, (state.phase === 'night' ? 0.72 : 1.04) * sideShade * (1.55 - perp * 0.06));
      for (let y = 0; y < wallH; y++) {
        const v = y / wallH;
        const [r, gg, b] = sampleTexture(tex, useU, v, brightness);
        g.fillStyle = `rgb(${r|0},${gg|0},${b|0})`;
        g.fillRect(x, startY + y, 1, 1);
      }
      g.fillStyle = `rgba(0,0,0,${Math.min(0.5, perp / MAX_DEPTH)})`;
      g.fillRect(x, 0, 1, OFF_H);
    }

    const allSprites = [];
    for (const obj of decorInArea(player.area)) allSprites.push({ ...obj, interactive:false });
    for (const obj of interactivesInArea(player.area)) allSprites.push({ ...obj, interactive:true });

    allSprites.sort((a, b) => {
      const da = (a.x - player.x) ** 2 + (a.y - player.y) ** 2;
      const db = (b.x - player.x) ** 2 + (b.y - player.y) ** 2;
      return db - da;
    });

    const objectiveId = currentObjectiveTargetId();
    for (const sp of allSprites) {
      const dx = sp.x - player.x, dy = sp.y - player.y;
      const dist = Math.hypot(dx, dy);
      let rel = Math.atan2(dy, dx) - player.a;
      while (rel < -Math.PI) rel += Math.PI * 2;
      while (rel > Math.PI) rel -= Math.PI * 2;
      if (Math.abs(rel) > FOV * 0.75 || dist < 0.2) continue;
      const screenX = (0.5 + (rel / FOV)) * OFF_W;
      const size = Math.min(180, (OFF_H / dist) * (sp.r * 0.95 + 0.6));
      const screenY = OFF_H * 0.58 - size * 0.76;
      const left = (screenX - size / 2) | 0;
      const right = (screenX + size / 2) | 0;
      let visible = false;
      for (let sx = Math.max(0, left); sx < Math.min(OFF_W, right); sx++) {
        if (dist < zBuffer[sx] + 0.15) { visible = true; break; }
      }
      if (!visible) continue;
      if (sp.id === objectiveId) {
        g.fillStyle = 'rgba(255, 218, 96, 0.18)';
        g.beginPath(); g.ellipse(screenX, screenY + size * 0.64, size * 0.44, size * 0.16, 0, 0, Math.PI * 2); g.fill();
      }
      g.drawImage(sprites[sp.sprite], left, screenY, size, size * 1.5);
      if (sp.interactive && dist < 2.7) {
        g.fillStyle = 'rgba(0,0,0,0.56)'; g.fillRect(screenX - 30, screenY - 16, 60, 12);
        g.fillStyle = '#f4eee3'; g.font = '10px sans-serif'; g.textAlign = 'center'; g.fillText(sp.label, screenX, screenY - 7);
      }
    }

    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.fillRect(0, 0, OFF_W, 4); g.fillRect(0, OFF_H - 4, OFF_W, 4);
    g.fillStyle = 'rgba(255,255,255,0.66)';
    g.fillRect(OFF_W/2 - 1, OFF_H/2 - 10, 2, 20); g.fillRect(OFF_W/2 - 10, OFF_H/2 - 1, 20, 2);

    if (state.areaFlash > 0) {
      g.fillStyle = `rgba(255,240,190,${state.areaFlash * 0.12})`;
      g.fillRect(0, 0, OFF_W, OFF_H);
    }
  }

  function renderMiniMap() {
    const area = currentArea();
    const map = area.map;
    const scale = Math.min(mapCanvas.width / map[0].length, mapCanvas.height / map.length);
    mapCtx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
    mapCtx.fillStyle = '#11131b'; mapCtx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[0].length; x++) {
        const t = map[y][x];
        mapCtx.fillStyle = t === '.' ? '#2b302d' : (t === 'S' ? '#c8bda4' : t === 'D' ? '#a58561' : '#65452c');
        mapCtx.fillRect(x * scale, y * scale, scale - 1, scale - 1);
      }
    }
    const targetId = currentObjectiveTargetId();
    for (const it of interactives) {
      if (it.area !== player.area || !it.visible() || (it.phase !== state.phase && it.phase !== 'any')) continue;
      mapCtx.fillStyle = it.id === targetId ? '#ffd86a' : '#6cd5b5';
      mapCtx.fillRect((it.x - 0.15) * scale, (it.y - 0.15) * scale, scale * 0.3, scale * 0.3);
    }
    mapCtx.fillStyle = '#ff5d5d';
    mapCtx.beginPath(); mapCtx.arc(player.x * scale, player.y * scale, 3, 0, Math.PI * 2); mapCtx.fill();
    mapCtx.strokeStyle = '#ffffff';
    mapCtx.beginPath();
    mapCtx.moveTo(player.x * scale, player.y * scale);
    mapCtx.lineTo((player.x + Math.cos(player.a) * 0.8) * scale, (player.y + Math.sin(player.a) * 0.8) * scale);
    mapCtx.stroke();
  }

  function updatePrompt() {
    if (state.inDialogue || state.ending) { promptBox.classList.add('hidden'); return; }
    state.nearby = getNearbyInteractive();
    if (state.nearby) {
      promptBox.textContent = `ACT / E : ${state.nearby.label}`;
      promptBox.classList.remove('hidden');
    } else {
      promptBox.classList.add('hidden');
    }
  }

  function interact() {
    if (state.ending) return;
    if (state.inDialogue) { advanceDialogue(); return; }
    if (state.nearby && typeof state.nearby.onInteract === 'function') state.nearby.onInteract();
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(320, window.innerWidth);
    const h = Math.max(480, window.innerHeight);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.imageSmoothingEnabled = false;
  }

  function update(dt) {
    if (!state.inDialogue && !state.ending) {
      let moveX = 0, moveY = 0;
      if (keys.w) moveY += 1; if (keys.s) moveY -= 1; if (keys.a) moveX -= 1; if (keys.d) moveX += 1;
      moveX += moveInput.x; moveY += moveInput.y;
      const len = Math.hypot(moveX, moveY) || 1;
      moveX /= len; moveY /= len;
      const moveSpeed = player.speed * dt;
      const nx = player.x + (Math.cos(player.a) * moveY + Math.cos(player.a - Math.PI / 2) * moveX) * moveSpeed;
      const ny = player.y + (Math.sin(player.a) * moveY + Math.sin(player.a - Math.PI / 2) * moveX) * moveSpeed;
      moveAndCollide(nx, ny);
      player.a += lookInput.dx * 0.0045;
      lookInput.dx *= 0.72;
    }
    state.pulse += dt * 2.4;
    state.areaFlash = Math.max(0, state.areaFlash - dt * 1.6);
    areaLabel.textContent = currentArea().name;
    updatePrompt();
    updateObjectiveDisplay();
  }

  function draw() {
    renderWorld();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
    renderMiniMap();
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') keys.w = true;
      if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') keys.s = true;
      if (e.key === 'a' || e.key === 'A') keys.a = true;
      if (e.key === 'd' || e.key === 'D') keys.d = true;
      if (e.key === 'e' || e.key === 'E' || e.key === ' ') { e.preventDefault(); interact(); }
    }, { passive:false });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') keys.w = false;
      if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') keys.s = false;
      if (e.key === 'a' || e.key === 'A') keys.a = false;
      if (e.key === 'd' || e.key === 'D') keys.d = false;
    });
  }

  function bindMovePad() {
    const rectInfo = () => movePad.getBoundingClientRect();
    function setStick(clientX, clientY) {
      const rect = rectInfo();
      const cx = rect.left + rect.width / 2; const cy = rect.top + rect.height / 2;
      let dx = clientX - cx, dy = clientY - cy;
      const max = rect.width * 0.34;
      const len = Math.hypot(dx, dy) || 1;
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      moveKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      moveInput.x = dx / max; moveInput.y = -dy / max;
    }
    movePad.addEventListener('pointerdown', (e) => {
      moveInput.active = true; moveInput.pointerId = e.pointerId; movePad.setPointerCapture(e.pointerId); setStick(e.clientX, e.clientY);
    });
    movePad.addEventListener('pointermove', (e) => {
      if (!moveInput.active || e.pointerId !== moveInput.pointerId) return; setStick(e.clientX, e.clientY);
    });
    function endStick(e) {
      if (!moveInput.active || (e && e.pointerId !== moveInput.pointerId)) return;
      moveInput.active = false; moveInput.pointerId = null; moveInput.x = 0; moveInput.y = 0; moveKnob.style.transform = 'translate(-50%, -50%)';
    }
    movePad.addEventListener('pointerup', endStick); movePad.addEventListener('pointercancel', endStick);
  }

  function bindLook() {
    canvas.addEventListener('pointerdown', (e) => {
      if (e.clientX < window.innerWidth * 0.45) return;
      lookInput.active = true; lookInput.pointerId = e.pointerId; lookInput.lastX = e.clientX; canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!lookInput.active || e.pointerId !== lookInput.pointerId) return;
      const dx = e.clientX - lookInput.lastX; lookInput.lastX = e.clientX; lookInput.dx += dx;
    });
    function endLook(e) { if (!lookInput.active || e.pointerId !== lookInput.pointerId) return; lookInput.active = false; lookInput.pointerId = null; }
    canvas.addEventListener('pointerup', endLook); canvas.addEventListener('pointercancel', endLook);
  }

  saveBtn.addEventListener('click', saveGame);
  loadBtn.addEventListener('click', loadGame);
  actBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); interact(); });
  dialogueBox.addEventListener('pointerdown', () => { if (state.inDialogue) advanceDialogue(); });

  bindKeyboard(); bindMovePad(); bindLook();
  window.addEventListener('resize', resize);
  resize();

  if (window.__YOINADO_CONTINUE__) {
    if (!loadGame()) startNew();
  } else {
    startNew();
  }

  requestAnimationFrame(loop);
})();
