(function () {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: false });
  const off = document.createElement('canvas');
  const OFF_W = 360;
  const OFF_H = 202;
  off.width = OFF_W;
  off.height = OFF_H;
  const g = off.getContext('2d', { alpha: false });
  g.imageSmoothingEnabled = false;

  const mapCanvas = document.getElementById('miniMap');
  const mapCtx = mapCanvas.getContext('2d', { alpha: false });
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

  const STORAGE_KEY = 'yoinado_v14_github_save';
  const FOV = Math.PI / 3.1;
  const MAX_DEPTH = 24;

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
  };

  const tasks = {
    talkedOkami: false,
    gotTray: false,
    servedGuest: false,
    talkedMaid: false,
    answeredPhone: false,
    checkedBath: false,
    gotNotebook: false,
  };

  const player = {
    x: 2.4,
    y: 8.6,
    a: -0.05,
    area: 'lobby',
    radius: 0.18,
    speed: 2.25,
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
        '#......WWWW....#',
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
      },
      signs: [
        { x: 2.5, y: 7.1, text: '帳場' },
        { x: 12.6, y: 8.7, text: '客室廊下' },
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
        '#...DD.....DD....BB....#',
        '#......................#',
        '#......................#',
        '#......................#',
        '#....SSSSSSSSSS........#',
        '#......................#',
        '########################'
      ],
      spawns: {
        fromLobby: { x: 2.0, y: 7.8, a: 0 },
        fromRoom: { x: 9.4, y: 5.1, a: Math.PI },
        fromBath: { x: 18.0, y: 5.0, a: Math.PI },
        fromArchive: { x: 14.0, y: 2.0, a: Math.PI / 2 },
      },
      signs: [
        { x: 4.2, y: 2.0, text: '201' },
        { x: 11.2, y: 2.0, text: '202' },
        { x: 18.9, y: 2.0, text: '浴場前' },
        { x: 14.3, y: 7.7, text: '北棟・宿帳庫' },
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
      spawns: {
        door: { x: 2.0, y: 5.0, a: 0 },
      },
      signs: [
        { x: 5.9, y: 1.6, text: '201号室' },
      ]
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
      spawns: {
        door: { x: 2.0, y: 5.0, a: 0 },
      },
      signs: [
        { x: 7.0, y: 1.8, text: '浴場前' },
      ]
    },
    archive: {
      name: '宿帳庫',
      skyTop: '#0a1016', skyBottom: '#23343b',
      floorA: '#48423b', floorB: '#3d3732', ceilA: '#171b21', ceilB: '#0f1217',
      map: [
        '##############',
        '#....NNNN....#',
        '#............#',
        '#............#',
        '#...KK.......#',
        '#............#',
        '#............#',
        '##############'
      ],
      spawns: {
        entry: { x: 2.0, y: 5.0, a: 0 },
      },
      signs: [
        { x: 6.8, y: 1.8, text: '宿帳庫' },
      ]
    }
  };

  const textures = createTextures();
  const spriteCanvases = {
    okami: makeSprite('okami'),
    guest: makeSprite('guest'),
    maid: makeSprite('maid'),
    ghost: makeSprite('ghost'),
    tray: makeSprite('tray'),
    phone: makeSprite('phone'),
    notebook: makeSprite('notebook'),
    bathSign: makeSprite('bathSign'),
  };

  function currentArea() { return areas[player.area]; }
  function currentMap() { return currentArea().map; }

  function setStatus(text) { statusBox.textContent = text; }
  function setObjective(text) { state.objective = text; objectiveBox.textContent = text; }

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
  }

  function changeArea(areaId, spawnKey) {
    spawnAt(areaId, spawnKey);
    setStatus('エリア移動: ' + areas[areaId].name);
  }

  function startNew() {
    tasks.talkedOkami = false;
    tasks.gotTray = false;
    tasks.servedGuest = false;
    tasks.talkedMaid = false;
    tasks.answeredPhone = false;
    tasks.checkedBath = false;
    tasks.gotNotebook = false;
    state.step = 0;
    state.day = 1;
    state.phase = 'day';
    state.inDialogue = false;
    state.ending = false;
    state.dialogueQueue = [];
    dayLabel.textContent = 'DAY 1';
    phaseLabel.textContent = '昼勤務';
    endingScreen.classList.add('hidden');
    dialogueBox.classList.add('hidden');
    promptBox.classList.add('hidden');
    spawnAt('lobby', 'start');
    setObjective('女将に話しかける');
    setStatus('起動完了 / v14 GitHub Edition');
    showDialogue([
      ['記録', '住み込み初日。館内は静かすぎるほど静かだ。'],
      ['記録', '女将に挨拶し、最初の仕事を受ける。客の証言は、夜の事件にそのまま繋がる。']
    ]);
  }

  function getSaveData() {
    return {
      player: { x: player.x, y: player.y, a: player.a, area: player.area },
      tasks: { ...tasks },
      state: {
        step: state.step,
        day: state.day,
        phase: state.phase,
        objective: state.objective,
        hudMinimal: state.hudMinimal,
      }
    };
  }

  function saveGame() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getSaveData()));
    setStatus('保存した / v14');
  }

  function loadGame() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { setStatus('保存データなし'); return false; }
    try {
      const data = JSON.parse(raw);
      Object.assign(tasks, data.tasks || {});
      Object.assign(player, data.player || {});
      state.step = data.state?.step || 0;
      state.day = data.state?.day || 1;
      state.phase = data.state?.phase || 'day';
      state.hudMinimal = !!data.state?.hudMinimal;
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
      setStatus('ロードした / v14');
      return true;
    } catch (err) {
      setStatus('ロード失敗');
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
  }

  function endGame(title, text) {
    state.ending = true;
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
          ['女将', 'この宿は、夜になると音がよく響きます。内線が鳴っても、慌てず順番に。'],
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
      case 'toHall':
        changeArea('hall', 'fromLobby');
        break;
      case 'toLobby':
        changeArea('lobby', 'fromHall');
        break;
      case 'toRoom201':
        changeArea('room201', 'door');
        break;
      case 'room201Exit':
        changeArea('hall', 'fromRoom');
        break;
      case 'toBath':
        changeArea('bath', 'door');
        break;
      case 'bathExit':
        changeArea('hall', 'fromBath');
        break;
      case 'toArchive':
        changeArea('archive', 'entry');
        break;
      case 'archiveExit':
        changeArea('hall', 'fromArchive');
        break;
      case 'guest':
        showDialogue([
          ['201号室の客', '……遅かったな。昨日も、同じ時間に湯呑みが二つ来た。'],
          ['201号室の客', '昨夜、浴場前で濡れた足音を聞いた。子どもの足音みたいに軽かった。'],
          ['201号室の客', '女将には言うな。北の宿帳庫に青いノートがある。事件を調べるなら、あれを見ろ。']
        ], () => {
          tasks.servedGuest = true;
          state.step = 3;
          setObjective('廊下の仲居に客の話を伝える');
          setStatus('客の証言を聞いた');
        });
        break;
      case 'maid':
        showDialogue([
          ['仲居・篠', '青いノート？ そんな物は帳場にはないはずです。'],
          ['仲居・篠', 'でも、さっきから内線が一度も止まらないんです。誰もいない浴場前から。'],
          ['仲居・篠', '先に帳場へ戻ってください。女将が電話口で待っています。']
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
          ['受話器の向こう', '浴場の鏡を見ろ。帳場の女は、順番を変えている。'],
          ['女将', '今の、聞きましたか。夜の見回りに入ってください。鍵は開けてあります。']
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
          ['記録', '鏡の曇りを拭うと、背後にいないはずの子どもが立っていた。'],
          ['記録', '次の瞬間、鏡には「帳場ではなく北へ」と指でなぞった跡が残る。']
        ], () => {
          tasks.checkedBath = true;
          state.step = 6;
          setObjective('北の宿帳庫で青いノートを探す');
          setStatus('宿帳庫を調べる');
        });
        break;
      case 'notebook':
        showDialogue([
          ['記録', '青いノートの最後の行には、宿泊者名簿から消えた名前が並んでいる。'],
          ['記録', 'その一番下に、今夜の自分の名前があった。'],
          ['記録', '女将は事件を隠していたのではない。次の消失順を、静かに待っていた。']
        ], () => {
          tasks.gotNotebook = true;
          state.step = 7;
          saveGame();
          endGame('宿帳に書かれた名前', '仕事の中で集めた証言が、失踪の順番を指していた。帳場に戻る前に夜は終わった。続きを作るなら、次は女将との対決と北棟の奥へ進む章。');
        });
        break;
    }
  }

  const areaMapLayout = {
    lobby: { x: 10, y: 20, w: 42, h: 42, label: '帳場' },
    hall: { x: 60, y: 20, w: 52, h: 42, label: '廊下' },
    room201: { x: 118, y: 8, w: 54, h: 24, label: '201' },
    bath: { x: 118, y: 38, w: 54, h: 24, label: '浴場前' },
    archive: { x: 88, y: 62, w: 54, h: 18, label: '宿帳庫' },
  };

  function miniMapObjectiveArea() {
    if (state.step <= 1) return 'lobby';
    if (state.step === 2) return 'room201';
    if (state.step === 3) return 'hall';
    if (state.step === 4) return 'lobby';
    if (state.step === 5) return 'bath';
    if (state.step === 6) return 'archive';
    return player.area;
  }

  function drawMiniMap() {
    mapCtx.fillStyle = '#0d1016';
    mapCtx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
    mapCtx.strokeStyle = 'rgba(255,255,255,.1)';
    mapCtx.lineWidth = 2;
    mapCtx.beginPath();
    mapCtx.moveTo(52, 41); mapCtx.lineTo(60, 41);
    mapCtx.lineTo(112, 41); mapCtx.lineTo(118, 20);
    mapCtx.moveTo(112, 41); mapCtx.lineTo(118, 50);
    mapCtx.moveTo(86, 62); mapCtx.lineTo(86, 62);
    mapCtx.lineTo(86, 68);
    mapCtx.stroke();

    const target = miniMapObjectiveArea();
    for (const [key, box] of Object.entries(areaMapLayout)) {
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
  }

  function activeSprites() {
    const list = [];
    const push = (entry) => {
      if (entry.area === player.area) list.push(entry);
    };
    push({ type:'npc', id:'okami', area:'lobby', x:5.7, y:6.2, kind:'okami', prompt:'女将に話しかける', active: !tasks.talkedOkami });
    push({ type:'item', id:'tray', area:'lobby', x:12.8, y:8.2, kind:'tray', prompt:'配膳盆を取る', active: tasks.talkedOkami && !tasks.gotTray });
    push({ type:'portal', id:'toHall', area:'lobby', x:13.6, y:8.0, kind:'signHall', prompt:'客室廊下へ', active: true });
    push({ type:'item', id:'phone', area:'lobby', x:4.3, y:6.4, kind:'phone', prompt:'黒電話に出る', active: tasks.talkedMaid && !tasks.answeredPhone });

    push({ type:'portal', id:'toLobby', area:'hall', x:1.8, y:7.8, kind:'signHall', prompt:'帳場へ戻る', active: true });
    push({ type:'portal', id:'toRoom201', area:'hall', x:5.0, y:3.6, kind:'door', prompt:'201号室へ入る', active: true });
    push({ type:'portal', id:'toBath', area:'hall', x:18.8, y:3.6, kind:'bathSign', prompt:'浴場前へ行く', active: true });
    push({ type:'portal', id:'toArchive', area:'hall', x:14.0, y:7.3, kind:'archiveDoor', prompt:'北の宿帳庫へ', active: state.phase === 'night' });
    push({ type:'npc', id:'maid', area:'hall', x:10.8, y:5.4, kind:'maid', prompt:'仲居・篠に話しかける', active: tasks.servedGuest && !tasks.talkedMaid });

    push({ type:'portal', id:'room201Exit', area:'room201', x:1.6, y:5.0, kind:'door', prompt:'廊下へ戻る', active: true });
    push({ type:'npc', id:'guest', area:'room201', x:7.4, y:3.1, kind:'guest', prompt:'201号室の客に話しかける', active: tasks.gotTray && !tasks.servedGuest });

    push({ type:'portal', id:'bathExit', area:'bath', x:1.6, y:5.0, kind:'bathSign', prompt:'廊下へ戻る', active: true });
    push({ type:'item', id:'mirror', area:'bath', x:6.6, y:1.9, kind:'ghost', prompt:'鏡を調べる', active: tasks.answeredPhone && !tasks.checkedBath });

    push({ type:'portal', id:'archiveExit', area:'archive', x:1.6, y:5.0, kind:'archiveDoor', prompt:'廊下へ戻る', active: true });
    push({ type:'ghost', id:'ghost', area:'archive', x:9.8, y:2.6, kind:'ghost', prompt:'', active: state.phase === 'night' && !tasks.gotNotebook });
    push({ type:'item', id:'notebook', area:'archive', x:4.6, y:4.2, kind:'notebook', prompt:'青いノートを拾う', active: tasks.checkedBath && !tasks.gotNotebook });

    return list.filter(s => s.active);
  }

  function getNearbyInteraction() {
    const sprites = activeSprites();
    let nearest = null;
    let nearestDist = 999;
    for (const s of sprites) {
      const dx = s.x - player.x;
      const dy = s.y - player.y;
      const d = Math.hypot(dx, dy);
      if (d > 1.25) continue;
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
        x.fillStyle = '#70472f'; x.fillRect(0,0,6,h);
        x.fillRect(w-6,0,6,h);
        x.fillRect(0,0,w,6);
        x.fillRect(0,h-6,w,6);
        x.fillStyle = 'rgba(0,0,0,.08)';
        x.fillRect(w/2-2, 7, 4, h-14);
      }),
      D: make((x,w,h) => {
        x.fillStyle = '#6a2f29'; x.fillRect(0,0,w,h);
        x.fillStyle = '#a65f55'; x.fillRect(8,8,w-16,h-16);
        x.fillStyle = '#e6d1a2'; x.fillRect(w-14,h/2,4,4);
        x.fillStyle = 'rgba(0,0,0,.15)';
        x.fillRect(w/2-1, 8, 2, h-16);
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
        x.fillStyle = '#694720'; x.fillRect(0,0,w,6);
        x.fillRect(0,h-6,w,6);
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
    };
  }

  function makeSprite(kind) {
    const c = document.createElement('canvas');
    c.width = 96; c.height = 144;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    const o = (px, py, w, h, fill, stroke = '#111') => {
      x.fillStyle = stroke; x.fillRect(px-1, py-1, w+2, h+2);
      x.fillStyle = fill; x.fillRect(px, py, w, h);
    };
    if (kind === 'okami') {
      o(32, 12, 30, 16, '#2b2430');
      o(35, 24, 24, 18, '#f1e1cb');
      o(24, 42, 46, 48, '#5d3346');
      o(18, 46, 10, 24, '#f1e1cb');
      o(68, 46, 10, 24, '#f1e1cb');
      o(32, 55, 28, 9, '#d1a267');
      o(28, 90, 14, 28, '#2f2434');
      o(52, 90, 14, 28, '#2f2434');
      o(38, 30, 4, 4, '#111'); o(51, 30, 4, 4, '#111');
      o(41, 38, 10, 2, '#8d5841', '#8d5841');
    } else if (kind === 'guest') {
      o(32, 12, 30, 16, '#252732');
      o(35, 24, 24, 18, '#efddc9');
      o(24, 42, 46, 44, '#6d68b3');
      o(18, 46, 10, 22, '#efddc9');
      o(68, 46, 10, 22, '#efddc9');
      o(28, 86, 14, 28, '#50489a');
      o(52, 86, 14, 28, '#50489a');
      o(38, 30, 4, 4, '#111'); o(51, 30, 4, 4, '#111');
      o(38, 38, 16, 2, '#8d5841', '#8d5841');
    } else if (kind === 'maid') {
      o(31, 10, 34, 14, '#f5f5f5');
      o(36, 22, 24, 18, '#efdcc7');
      o(25, 40, 44, 46, '#34557c');
      o(19, 44, 10, 24, '#efdcc7');
      o(69, 44, 10, 24, '#efdcc7');
      o(30, 86, 14, 28, '#1a2e46');
      o(50, 86, 14, 28, '#1a2e46');
      o(39, 29, 4, 4, '#111'); o(52, 29, 4, 4, '#111');
      o(40, 37, 12, 2, '#845645', '#845645');
    } else if (kind === 'ghost') {
      x.globalAlpha = .7;
      o(32, 12, 30, 18, '#5c6f7f');
      o(34, 24, 26, 20, '#e3e9ee');
      o(26, 44, 42, 52, '#d9e4ee');
      o(18, 48, 10, 26, '#d9e4ee');
      o(68, 48, 10, 26, '#d9e4ee');
      o(34, 30, 6, 6, '#111'); o(54, 30, 6, 6, '#111');
      o(40, 40, 14, 2, '#7a8b98', '#7a8b98');
      x.globalAlpha = 1;
    } else if (kind === 'tray') {
      o(18, 72, 60, 10, '#744d2b');
      o(22, 54, 18, 18, '#e3e0d7');
      o(56, 54, 18, 18, '#e3e0d7');
      o(28, 60, 6, 4, '#7f9eb7');
      o(62, 60, 6, 4, '#7f9eb7');
    } else if (kind === 'phone') {
      o(25, 76, 46, 20, '#1f1f22');
      o(30, 62, 36, 16, '#27282d');
      o(42, 56, 12, 8, '#4c4d57');
    } else if (kind === 'notebook') {
      o(28, 58, 40, 52, '#2a4f86');
      o(34, 64, 26, 38, '#d4e0f0');
      o(32, 58, 4, 52, '#183055');
    } else if (kind === 'bathSign') {
      o(28, 24, 8, 84, '#6a5138');
      o(36, 32, 36, 48, '#bfa56c');
      o(42, 42, 24, 8, '#5f3c2a');
    }
    return c;
  }

  function shadeColor(rgb, factor) {
    return `rgb(${Math.floor(rgb[0]*factor)},${Math.floor(rgb[1]*factor)},${Math.floor(rgb[2]*factor)})`;
  }

  function drawScene(dt) {
    const area = currentArea();
    g.fillStyle = area.skyTop;
    g.fillRect(0, 0, OFF_W, OFF_H / 2);
    const skyGrad = g.createLinearGradient(0, 0, 0, OFF_H / 2);
    skyGrad.addColorStop(0, area.skyTop);
    skyGrad.addColorStop(1, area.skyBottom);
    g.fillStyle = skyGrad;
    g.fillRect(0, 0, OFF_W, OFF_H / 2);

    const floorGrad = g.createLinearGradient(0, OFF_H / 2, 0, OFF_H);
    floorGrad.addColorStop(0, area.floorA);
    floorGrad.addColorStop(1, area.floorB);
    g.fillStyle = floorGrad;
    g.fillRect(0, OFF_H / 2, OFF_W, OFF_H / 2);

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
        if (t !== '.') {
          hit = { tile:t, x:rx, y:ry };
          break;
        }
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
      const shade = Math.min(.78, corrected / 18 + (state.phase === 'night' ? .12 : 0));
      g.fillStyle = `rgba(0,0,0,${shade})`;
      g.fillRect(x, y0, 1, wallH);
    }

    drawSprites(zBuffer);
    drawAreaSigns(zBuffer);
    if (state.phase === 'night') drawNightEffects(dt);
  }

  function drawFloorPattern(area) {
    for (let y = OFF_H/2; y < OFF_H; y += 4) {
      g.fillStyle = y % 8 === 0 ? area.floorA : area.floorB;
      g.fillRect(0, y, OFF_W, 1);
    }
    if (player.area === 'lobby' || player.area === 'hall' || player.area === 'room201') {
      g.fillStyle = 'rgba(0,0,0,.08)';
      for (let x = 0; x < OFF_W; x += 18) g.fillRect(x, OFF_H/2, 2, OFF_H/2);
    }
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
    const h = Math.min(OFF_H * 1.6, (OFF_H / Math.max(0.08, proj.corrected)) * scaleFactor);
    const w = h * (spriteCanvas.width / spriteCanvas.height);
    const x = proj.screenX - w / 2;
    const y = OFF_H / 2 - h * 0.55;
    g.drawImage(spriteCanvas, x, y, w, h);
    const darkness = Math.min(.72, proj.corrected / 16 + (state.phase === 'night' ? .08 : 0));
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
      const h = Math.min(OFF_H * 1.6, (OFF_H / Math.max(0.08, s.proj.corrected)) * (s.kind === 'ghost' ? 1.18 : 1.05));
      const w = h * (spriteCanvas.width / spriteCanvas.height);
      const x = Math.floor(s.proj.screenX - w / 2);
      const y = Math.floor(OFF_H / 2 - h * 0.55);
      let visible = false;
      const x0 = Math.max(0, x);
      const x1 = Math.min(OFF_W - 1, Math.floor(x + w));
      for (let sx = x0; sx <= x1; sx++) {
        if (s.proj.corrected < zBuffer[sx] + 0.1) { visible = true; break; }
      }
      if (!visible) continue;
      drawSpriteCanvas(s.proj, spriteCanvas, s.kind === 'ghost' ? 1.18 : 1.05);
    }
  }

  function drawAreaSigns(zBuffer) {
    const signs = currentArea().signs || [];
    for (const sign of signs) {
      const proj = project(sign.x, sign.y);
      if (!proj) continue;
      const h = Math.min(42, (OFF_H / Math.max(0.1, proj.corrected)) * 0.3);
      const w = sign.text.length * 8 + 16;
      const x = proj.screenX - w / 2;
      const y = OFF_H / 2 - h - 4;
      if (proj.corrected > zBuffer[Math.max(0, Math.min(OFF_W - 1, Math.floor(proj.screenX)))] + .2) continue;
      g.fillStyle = 'rgba(10,8,8,.85)';
      g.fillRect(x, y, w, h);
      g.strokeStyle = '#d5bc87';
      g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      g.fillStyle = '#f5efe5';
      g.font = '12px sans-serif';
      g.textAlign = 'center';
      g.fillText(sign.text, x + w / 2, y + h / 2 + 4);
    }
  }

  function drawNightEffects(dt) {
    g.fillStyle = 'rgba(6, 12, 20, 0.24)';
    g.fillRect(0, 0, OFF_W, OFF_H);
    g.fillStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < 22; i++) {
      const x = ((i * 37 + performance.now() * 0.03) % OFF_W) | 0;
      const y = ((i * 17 + performance.now() * 0.02) % OFF_H) | 0;
      g.fillRect(x, y, 1, 1);
    }
    if (state.step >= 6) {
      const flick = (Math.sin(performance.now() * 0.013) * 0.5 + 0.5) * 0.18;
      g.fillStyle = `rgba(255,255,255,${flick})`;
      g.fillRect(0, 0, OFF_W, 3);
    }
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

    const n = (!state.inDialogue && !state.ending) ? getNearbyInteraction() : null;
    state.nearby = n;
    if (n && n.prompt) {
      promptBox.textContent = n.prompt;
      promptBox.classList.remove('hidden');
    } else {
      promptBox.classList.add('hidden');
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
      moveInput.active = false;
      moveInput.pointerId = null;
      center();
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
  window.addEventListener('resize', resize);

  resize();
  applyHudState();
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
